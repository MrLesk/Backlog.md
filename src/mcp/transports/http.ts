/**
 * HTTP Transport for MCP Server
 *
 * ⚠️ This transport binds to localhost only by default.
 * Attempting to bind to 0.0.0.0 or public IPs will throw an error.
 *
 * Authentication exists to prevent accidental cross-process conflicts,
 * NOT for network security. See docs/mcp/SECURITY.md for details.
 */

import { randomUUID } from "node:crypto";
import type { IncomingMessage, ServerResponse } from "node:http";
import type { AuthInfo } from "@modelcontextprotocol/sdk/server/auth/types.js";
import type { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import type { ConnectionManager } from "../connection/manager.ts";
import { McpAuthenticationError, McpConnectionError } from "../errors/mcp-errors.ts";

export interface HttpTransportOptions {
	host?: string;
	port?: number;
	cors?: {
		origin?: string | string[];
		credentials?: boolean;
	};
	auth?: {
		type: "bearer" | "basic" | "none";
		token?: string;
		username?: string;
		password?: string;
	};
	enableDnsRebindingProtection?: boolean;
	allowedHosts?: string[];
	allowedOrigins?: string[];
	enableJsonResponse?: boolean;
}

export class BacklogHttpTransport {
	private server?: ReturnType<typeof Bun.serve>;
	private transports: Map<string, StreamableHTTPServerTransport> = new Map();
	private connectionManager?: ConnectionManager;
	private options: Required<HttpTransportOptions>;

	constructor(options: HttpTransportOptions = {}) {
		const host = options.host || "localhost";

		// Security: Enforce localhost-only binding
		this.validateLocalhostOnly(host);

		this.options = {
			host,
			port: options.port ?? 8080,
			cors: {
				origin: options.cors?.origin || "*",
				credentials: options.cors?.credentials || false,
			},
			auth: options.auth || { type: "none" },
			enableDnsRebindingProtection: options.enableDnsRebindingProtection || false,
			allowedHosts: options.allowedHosts || [],
			allowedOrigins: options.allowedOrigins || [],
			enableJsonResponse: options.enableJsonResponse || false,
		};
	}

	/**
	 * Validates that the host is localhost-only
	 * Throws an error if attempting to bind to 0.0.0.0 or public IPs
	 */
	private validateLocalhostOnly(host: string): void {
		const normalizedHost = host.toLowerCase().trim();

		// Allow only localhost and 127.0.0.1
		const allowedHosts = ["localhost", "127.0.0.1", "::1"];

		if (!allowedHosts.includes(normalizedHost)) {
			throw new McpConnectionError(
				`Security error: HTTP transport can only bind to localhost (got: ${host}). ` +
					`Binding to ${host} would expose the MCP server to the network. ` +
					"See docs/mcp/SECURITY.md for details.",
			);
		}
	}

	private authenticate(req: Request): boolean {
		const auth = this.options.auth;

		if (auth.type === "none") {
			return true;
		}

		const authHeader = req.headers.get("Authorization");
		if (!authHeader) {
			return false;
		}

		if (auth.type === "bearer" && auth.token) {
			return authHeader === `Bearer ${auth.token}`;
		}

		if (auth.type === "basic" && auth.username && auth.password) {
			const expectedAuth = btoa(`${auth.username}:${auth.password}`);
			return authHeader === `Basic ${expectedAuth}`;
		}

		return false;
	}

	private createCorsHeaders(): Record<string, string> {
		const headers: Record<string, string> = {};

		if (this.options.cors.origin) {
			if (typeof this.options.cors.origin === "string") {
				headers["Access-Control-Allow-Origin"] = this.options.cors.origin;
			} else {
				headers["Access-Control-Allow-Origin"] = this.options.cors.origin.join(", ");
			}
		}

		if (this.options.cors.credentials) {
			headers["Access-Control-Allow-Credentials"] = "true";
		}

		headers["Access-Control-Allow-Methods"] = "GET, POST, DELETE, OPTIONS";
		headers["Access-Control-Allow-Headers"] = "Content-Type, Authorization, X-Requested-With, Mcp-Session-Id";
		headers["Access-Control-Expose-Headers"] = "Mcp-Session-Id";

		return headers;
	}

	private handlePreflight(): Response {
		return new Response(null, {
			status: 204,
			headers: this.createCorsHeaders(),
		});
	}

	private createErrorResponse(status: number, message: string, code?: string): Response {
		const errorBody = {
			success: false,
			error: {
				code: code || "HTTP_ERROR",
				message,
				statusCode: status,
			},
		};

		// Log error for debugging
		console.error(`HTTP Transport Error [${status}]:`, message, code ? `(${code})` : "");

		return new Response(JSON.stringify(errorBody), {
			status,
			headers: {
				"Content-Type": "application/json",
				...this.createCorsHeaders(),
			},
		});
	}

	async start(mcpServer: Server, connectionManager?: ConnectionManager): Promise<void> {
		this.connectionManager = connectionManager;
		try {
			this.server = Bun.serve({
				hostname: this.options.host,
				port: this.options.port,
				fetch: async (req: Request): Promise<Response> => {
					const url = new URL(req.url);

					// Handle CORS preflight
					if (req.method === "OPTIONS") {
						return this.handlePreflight();
					}

					// Authentication check
					if (!this.authenticate(req)) {
						return this.createErrorResponse(401, "Unauthorized");
					}

					// Main MCP endpoint - handles POST, GET, DELETE according to MCP spec
					if (url.pathname === "/") {
						try {
							const sessionId = req.headers.get("Mcp-Session-Id");

							if (req.method === "POST") {
								// Handle POST requests (JSON-RPC messages)
								const body = await req.json();

								let transport: StreamableHTTPServerTransport;

								if (sessionId && this.transports.has(sessionId)) {
									// Reuse existing transport
									const existingTransport = this.transports.get(sessionId);
									if (!existingTransport) {
										throw new Error(`Transport not found for session: ${sessionId}`);
									}
									transport = existingTransport;

									// Update connection activity
									if (this.connectionManager) {
										this.connectionManager.updateActivity(sessionId);
									}
								} else {
									// Create new transport for initialization requests
									transport = new StreamableHTTPServerTransport({
										sessionIdGenerator: () => randomUUID(),
										enableJsonResponse: true, // Always enable JSON response for HTTP transport
										enableDnsRebindingProtection: this.options.enableDnsRebindingProtection,
										allowedHosts: this.options.allowedHosts,
										allowedOrigins: this.options.allowedOrigins,
										onsessioninitialized: async (sessionId: string) => {
											if (process.env.DEBUG) {
												console.error(`HTTP session initialized: ${sessionId}`);
											}
											this.transports.set(sessionId, transport);

											// Register connection with ConnectionManager
											if (this.connectionManager) {
												await this.connectionManager.registerConnection(sessionId, transport, undefined, {
													transportType: "http",
													host: this.options.host,
													port: this.options.port,
												});
											}
										},
										onsessionclosed: async (sessionId: string) => {
											if (process.env.DEBUG) {
												console.error(`HTTP session closed: ${sessionId}`);
											}
											this.transports.delete(sessionId);

											// Remove connection from ConnectionManager
											if (this.connectionManager) {
												await this.connectionManager.removeConnection(sessionId, "Session closed");
											}
										},
									});

									// Connect transport to MCP server
									await mcpServer.connect(transport);

									// Setup cleanup on transport close
									transport.onclose = () => {
										const sid = transport.sessionId;
										if (sid && this.transports.has(sid)) {
											this.transports.delete(sid);
										}
									};
								}

								// Convert Bun Request to Node.js-like request for StreamableHTTP
								const nodeReq = this.bunRequestToNodeRequest(req, body);
								const nodeRes = this.createNodeResponse();

								await transport.handleRequest(nodeReq, nodeRes, body);

								// Wait for response to finish if needed
								if (!nodeRes.finished) {
									await new Promise<void>((resolve) => {
										nodeRes.on("finish", resolve);
										// Timeout after 5 seconds
										setTimeout(() => resolve(), 5000);
									});
								}

								// Return the response created by the transport
								return nodeRes.getResponse();
							}

							if (req.method === "GET") {
								// Handle GET requests for SSE streams
								if (!sessionId || !this.transports.has(sessionId)) {
									return this.createErrorResponse(400, "Invalid or missing session ID");
								}

								// Return SSE stream for established session
								const stream = new ReadableStream({
									start(controller) {
										// Send initial connection message
										const encoder = new TextEncoder();
										const message = `data: {"jsonrpc":"2.0","method":"notifications/initialized"}\n\n`;
										controller.enqueue(encoder.encode(message));

										// Keep connection alive
										const keepAlive = setInterval(() => {
											try {
												controller.enqueue(encoder.encode(`data: {"type":"heartbeat"}\n\n`));
											} catch {
												clearInterval(keepAlive);
											}
										}, 30000);

										// Cleanup when stream is closed
										return () => {
											clearInterval(keepAlive);
										};
									},
								});

								return new Response(stream, {
									status: 200,
									headers: {
										"Content-Type": "text/event-stream",
										"Cache-Control": "no-cache",
										Connection: "keep-alive",
										...this.createCorsHeaders(),
									},
								});
							}

							if (req.method === "DELETE") {
								// Handle DELETE requests for session termination
								if (!sessionId || !this.transports.has(sessionId)) {
									return this.createErrorResponse(400, "Invalid or missing session ID");
								}

								const transport = this.transports.get(sessionId);
								if (!transport) {
									return this.createErrorResponse(400, "Session not found");
								}
								const nodeReq = this.bunRequestToNodeRequest(req);
								const nodeRes = this.createNodeResponse();

								await transport.handleRequest(nodeReq, nodeRes);
								return nodeRes.getResponse();
							}

							return this.createErrorResponse(405, "Method not allowed");
						} catch (error) {
							console.error("HTTP transport error:", error);

							if (error instanceof McpConnectionError) {
								return this.createErrorResponse(400, error.message, error.code);
							}
							if (error instanceof McpAuthenticationError) {
								return this.createErrorResponse(401, error.message, error.code);
							}

							// Handle network/connection errors
							if (error instanceof Error && error.message.includes("Connection")) {
								return this.createErrorResponse(503, "Connection error occurred", "CONNECTION_ERROR");
							}

							// Generic server error
							return this.createErrorResponse(500, "Internal server error", "INTERNAL_ERROR");
						}
					}

					// Health check endpoint
					if (url.pathname === "/health" && req.method === "GET") {
						return new Response(JSON.stringify({ status: "ok", transport: "http" }), {
							status: 200,
							headers: {
								"Content-Type": "application/json",
								...this.createCorsHeaders(),
							},
						});
					}

					return this.createErrorResponse(404, "Not found");
				},
			});

			console.log(`MCP server running on ${this.server.hostname}:${this.server.port} (HTTP transport)`);
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : String(error);
			throw new Error(`Failed to start HTTP transport on port ${this.options.port}: ${errorMessage}`);
		}
	}

	private bunRequestToNodeRequest(req: Request, body?: unknown): IncomingMessage & { auth?: AuthInfo | undefined } {
		const headers: Record<string, string> = {};
		req.headers.forEach((value, key) => {
			headers[key] = value;
		});

		const url = new URL(req.url);

		return {
			method: req.method,
			url: url.pathname + url.search,
			headers,
			body,
			auth: undefined,
		} as unknown as IncomingMessage & { auth?: AuthInfo | undefined };
	}

	private createNodeResponse(): ServerResponse & { getResponse: () => Response } {
		let statusCode = 200;
		let headers: Record<string, string> = {};
		let body: string | Buffer = "";
		let _ended = false;

		const eventHandlers: Record<string, (() => void)[]> = {};

		const nodeRes = {
			writeHead: (code: number, responseHeaders?: Record<string, string>) => {
				statusCode = code;
				if (responseHeaders) {
					headers = { ...headers, ...responseHeaders };
				}
				// Return this for chaining (like res.writeHead().end())
				return nodeRes;
			},
			finished: false,
			setHeader: (name: string, value: string) => {
				headers[name] = value;
				return nodeRes;
			},
			getHeaders: () => headers,
			write: (chunk: string | Buffer) => {
				if (typeof chunk === "string") {
					body += chunk;
				} else {
					body = Buffer.concat([Buffer.isBuffer(body) ? body : Buffer.from(body), chunk]);
				}
				return true; // Node.js write returns boolean
			},
			end: (chunk?: string | Buffer) => {
				if (chunk) {
					if (typeof chunk === "string") {
						body += chunk;
					} else {
						body = Buffer.concat([Buffer.isBuffer(body) ? body : Buffer.from(body), chunk]);
					}
				}
				_ended = true;
				nodeRes.finished = true;
				// Emit 'finish' event
				if (eventHandlers.finish) {
					for (const handler of eventHandlers.finish) {
						handler();
					}
				}
				return nodeRes;
			},
			on: (event: string, handler: () => void) => {
				if (!eventHandlers[event]) {
					eventHandlers[event] = [];
				}
				eventHandlers[event].push(handler);
				return nodeRes;
			},
			emit: (event: string, ..._args: unknown[]) => {
				if (eventHandlers[event]) {
					for (const handler of eventHandlers[event]) {
						handler();
					}
				}
				return true;
			},
			getResponse: (): Response => {
				// Add CORS headers to all responses
				const responseHeaders = {
					...headers,
					...this.createCorsHeaders(),
				};

				return new Response(body as BodyInit, {
					status: statusCode,
					headers: responseHeaders,
				});
			},
		};

		return nodeRes as ServerResponse & { getResponse: () => Response };
	}

	getPort(): number | undefined {
		return this.server?.port;
	}

	async stop(): Promise<void> {
		if (this.server) {
			// First close all HTTP transports
			for (const transport of this.transports.values()) {
				try {
					await transport.close();
				} catch (error) {
					console.error("Error closing transport:", error);
				}
			}

			this.transports.clear();

			// Then stop the server - wrap in Promise since Bun.serve().stop() is synchronous
			await new Promise<void>((resolve) => {
				this.server?.stop();
				// Small delay to ensure server has fully stopped
				setTimeout(resolve, 10);
			});

			this.server = undefined;
		}
	}

	getConnectionInfo(): { host: string; port: number; endpoints: string[] } {
		return {
			host: this.server?.hostname ?? this.options.host,
			port: this.server?.port ?? this.options.port,
			endpoints: ["/", "/health"],
		};
	}
}
