/**
 * SSE (Server-Sent Events) Transport for MCP Server
 *
 * ⚠️ This transport binds to localhost only by default.
 * Attempting to bind to 0.0.0.0 or public IPs will throw an error.
 *
 * Authentication exists to prevent accidental cross-process conflicts,
 * NOT for network security. See docs/mcp/SECURITY.md for details.
 */

import type { IncomingMessage, ServerResponse } from "node:http";
import type { AuthInfo } from "@modelcontextprotocol/sdk/server/auth/types.js";
import type { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import type { ConnectionManager } from "../connection/manager.ts";
import { McpConnectionError } from "../errors/mcp-errors.ts";

export interface SseTransportOptions {
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
}

export class BacklogSseTransport {
	private server?: ReturnType<typeof Bun.serve>;
	private sseTransports: Map<string, SSEServerTransport> = new Map();
	private connectionManager?: ConnectionManager;
	private options: Required<SseTransportOptions>;

	constructor(options: SseTransportOptions = {}) {
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
				`Security error: SSE transport can only bind to localhost (got: ${host}). ` +
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

		headers["Access-Control-Allow-Methods"] = "GET, POST, OPTIONS";
		headers["Access-Control-Allow-Headers"] = "Content-Type, Authorization, X-Requested-With";

		return headers;
	}

	private handlePreflight(): Response {
		return new Response(null, {
			status: 204,
			headers: this.createCorsHeaders(),
		});
	}

	private createErrorResponse(status: number, message: string): Response {
		return new Response(JSON.stringify({ error: message }), {
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

					// SSE endpoint for establishing event stream
					if (url.pathname === "/sse" && req.method === "GET") {
						// Check if the connection was aborted
						if (req.signal?.aborted) {
							return this.createErrorResponse(400, "Request aborted");
						}

						// Create a custom response stream for SSE
						const stream = new ReadableStream({
							start: (controller) => {
								const sessionId = crypto.randomUUID();

								// Create a mock response object for SSEServerTransport
								const mockResponse = {
									writeHead: (_statusCode: number, _headers?: Record<string, string>) => {
										// Headers are handled by the Response constructor
									},
									write: (data: string) => {
										const encoder = new TextEncoder();
										try {
											controller.enqueue(encoder.encode(data));
										} catch {
											// Stream may be closed
										}
									},
									end: (data?: string) => {
										if (data) {
											const encoder = new TextEncoder();
											try {
												controller.enqueue(encoder.encode(data));
											} catch {
												// Stream may be closed
											}
										}
										try {
											controller.close();
										} catch {
											// Stream may already be closed
										}
									},
									on: (event: string, callback: () => void) => {
										if (event === "close") {
											req.signal?.addEventListener("abort", callback);
										}
									},
								};

								// Create SSE transport
								const transport = new SSEServerTransport("/messages", mockResponse as ServerResponse<IncomingMessage>, {
									enableDnsRebindingProtection: this.options.enableDnsRebindingProtection,
									allowedHosts: this.options.allowedHosts,
									allowedOrigins: this.options.allowedOrigins,
								});

								// Register connection with ConnectionManager
								if (this.connectionManager) {
									this.connectionManager
										.registerConnection(sessionId, transport, undefined, {
											transportType: "sse",
											host: this.options.host,
											port: this.options.port,
										})
										.catch((error) => {
											console.error(`Failed to register SSE connection: ${error}`);
										});
								}

								// Store transport for message routing
								this.sseTransports.set(sessionId, transport);

								// Connect to MCP server
								mcpServer
									.connect(transport)
									.then(() => {
										// Transport automatically starts when connected
									})
									.catch(async (error) => {
										console.error("Failed to connect transport:", error);
										this.sseTransports.delete(sessionId);

										// Remove from ConnectionManager
										if (this.connectionManager) {
											await this.connectionManager.removeConnection(sessionId, "Connection failed");
										}

										try {
											controller.error(error);
										} catch {
											// Stream may be closed
										}
									});

								// Cleanup on connection close
								req.signal?.addEventListener("abort", async () => {
									this.sseTransports.delete(sessionId);

									// Remove from ConnectionManager
									if (this.connectionManager) {
										await this.connectionManager.removeConnection(sessionId, "Client disconnected");
									}

									transport.close().catch((error) => {
										console.error("Error closing transport:", error);
									});
								});
							},
						});

						return new Response(stream, {
							status: 200,
							headers: {
								"Content-Type": "text/event-stream",
								"Cache-Control": "no-cache, no-transform",
								Connection: "keep-alive",
								"X-Accel-Buffering": "no", // Disable nginx buffering
								...this.createCorsHeaders(),
							},
						});
					}

					// Message endpoint for receiving client messages
					if (url.pathname === "/messages" && req.method === "POST") {
						try {
							const sessionId = url.searchParams.get("sessionId");
							if (!sessionId) {
								return this.createErrorResponse(400, "Missing session ID");
							}

							const transport = this.sseTransports.get(sessionId);
							if (!transport) {
								return this.createErrorResponse(404, "Session not found");
							}

							const body = await req.json();

							// Convert Bun Request to Node.js-like request for handlePostMessage
							const headers: Record<string, string> = {};
							req.headers.forEach((value, key) => {
								headers[key] = value;
							});
							const nodeReq = {
								headers,
								auth: undefined as AuthInfo | undefined,
							};

							const nodeRes = {
								writeHead: (statusCode: number) => ({ end: (data?: string) => ({ statusCode, data }) }),
							};

							// Handle the message through the transport
							await transport.handlePostMessage(
								nodeReq as IncomingMessage & { auth?: AuthInfo | undefined },
								nodeRes as unknown as ServerResponse<IncomingMessage>,
								body,
							);

							return new Response(JSON.stringify({ status: "accepted" }), {
								status: 202,
								headers: {
									"Content-Type": "application/json",
									...this.createCorsHeaders(),
								},
							});
						} catch (error) {
							console.error("Message handling error:", error);
							return this.createErrorResponse(400, "Invalid request");
						}
					}

					// Health check endpoint
					if (url.pathname === "/health" && req.method === "GET") {
						return new Response(JSON.stringify({ status: "ok", transport: "sse" }), {
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

			console.log(`MCP server running on ${this.server.hostname}:${this.server.port} (SSE transport)`);
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : String(error);
			throw new Error(`Failed to start SSE transport on port ${this.options.port}: ${errorMessage}`);
		}
	}

	getPort(): number | undefined {
		return this.server?.port;
	}

	async stop(): Promise<void> {
		if (this.server) {
			// First close all SSE transports
			for (const transport of this.sseTransports.values()) {
				try {
					await transport.close();
				} catch (error) {
					console.error("Error closing transport:", error);
				}
			}

			this.sseTransports.clear();

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
			endpoints: ["/sse", "/messages", "/health"],
		};
	}
}
