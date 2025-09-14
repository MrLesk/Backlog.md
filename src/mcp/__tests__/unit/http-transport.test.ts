import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { McpServer } from "../../server.ts";
import { BacklogHttpTransport, type HttpTransportOptions } from "../../transports/http.ts";

describe("BacklogHttpTransport", () => {
	let transport: BacklogHttpTransport;
	let mcpServer: McpServer;
	const testPort = 19080; // Use different port to avoid conflicts

	beforeEach(async () => {
		mcpServer = new McpServer(process.cwd());
		transport = new BacklogHttpTransport({
			host: "localhost",
			port: testPort,
			auth: { type: "none" },
		});
	});

	afterEach(async () => {
		if (transport) {
			await transport.stop();
		}
		if (mcpServer) {
			await mcpServer.stop();
		}
	});

	describe("constructor", () => {
		it("should initialize with default options", () => {
			const defaultTransport = new BacklogHttpTransport();
			const info = defaultTransport.getConnectionInfo();

			expect(info.host).toBe("localhost");
			expect(info.port).toBe(8080);
			expect(info.endpoints).toContain("/");
			expect(info.endpoints).toContain("/health");
		});

		it("should initialize with custom options", () => {
			const customOptions: HttpTransportOptions = {
				host: "127.0.0.1",
				port: 9090,
				auth: { type: "bearer", token: "test-token" },
				cors: { origin: "https://example.com", credentials: true },
				enableJsonResponse: true,
			};

			const customTransport = new BacklogHttpTransport(customOptions);
			const info = customTransport.getConnectionInfo();

			expect(info.host).toBe("127.0.0.1");
			expect(info.port).toBe(9090);
		});
	});

	describe("server operations", () => {
		it("should start and stop server successfully", async () => {
			await transport.start(mcpServer.getServer());

			// Check if server is running by making a health check request
			const response = await fetch(`http://localhost:${testPort}/health`);
			expect(response.status).toBe(200);

			const data = await response.json();
			expect(data.status).toBe("ok");
			expect(data.transport).toBe("http");

			await transport.stop();

			// Server should be stopped now
			try {
				await fetch(`http://localhost:${testPort}/health`);
				expect.unreachable("Should have thrown connection error");
			} catch (error) {
				// Expected - connection should be refused
				expect(error).toBeDefined();
			}
		});
	});

	describe("authentication", () => {
		it("should allow access with no auth", async () => {
			const noAuthTransport = new BacklogHttpTransport({
				host: "localhost",
				port: testPort + 1,
				auth: { type: "none" },
			});

			await noAuthTransport.start(mcpServer.getServer());

			const response = await fetch(`http://localhost:${testPort + 1}/health`);
			expect(response.status).toBe(200);

			await noAuthTransport.stop();
		});

		it("should reject access without bearer token", async () => {
			const authTransport = new BacklogHttpTransport({
				host: "localhost",
				port: testPort + 2,
				auth: { type: "bearer", token: "secret-token" },
			});

			await authTransport.start(mcpServer.getServer());

			// Request without auth header
			const response = await fetch(`http://localhost:${testPort + 2}/health`);
			expect(response.status).toBe(401);

			const data = await response.json();
			expect(data.error.message).toBe("Unauthorized");

			await authTransport.stop();
		});

		it("should allow access with correct bearer token", async () => {
			const authTransport = new BacklogHttpTransport({
				host: "localhost",
				port: testPort + 3,
				auth: { type: "bearer", token: "secret-token" },
			});

			await authTransport.start(mcpServer.getServer());

			// Request with correct auth header
			const response = await fetch(`http://localhost:${testPort + 3}/health`, {
				headers: {
					Authorization: "Bearer secret-token",
				},
			});
			expect(response.status).toBe(200);

			await authTransport.stop();
		});

		it("should reject access with wrong bearer token", async () => {
			const authTransport = new BacklogHttpTransport({
				host: "localhost",
				port: testPort + 4,
				auth: { type: "bearer", token: "secret-token" },
			});

			await authTransport.start(mcpServer.getServer());

			// Request with wrong auth header
			const response = await fetch(`http://localhost:${testPort + 4}/health`, {
				headers: {
					Authorization: "Bearer wrong-token",
				},
			});
			expect(response.status).toBe(401);

			await authTransport.stop();
		});

		it("should allow access with correct basic auth", async () => {
			const authTransport = new BacklogHttpTransport({
				host: "localhost",
				port: testPort + 5,
				auth: { type: "basic", username: "user", password: "pass" },
			});

			await authTransport.start(mcpServer.getServer());

			// Request with correct basic auth
			const credentials = btoa("user:pass");
			const response = await fetch(`http://localhost:${testPort + 5}/health`, {
				headers: {
					Authorization: `Basic ${credentials}`,
				},
			});
			expect(response.status).toBe(200);

			await authTransport.stop();
		});
	});

	describe("CORS", () => {
		it("should handle preflight requests", async () => {
			const corsTransport = new BacklogHttpTransport({
				host: "localhost",
				port: testPort + 6,
				cors: { origin: "*", credentials: true },
			});

			await corsTransport.start(mcpServer.getServer());

			// Send OPTIONS request
			const response = await fetch(`http://localhost:${testPort + 6}/health`, {
				method: "OPTIONS",
			});

			expect(response.status).toBe(204);
			expect(response.headers.get("Access-Control-Allow-Origin")).toBe("*");
			expect(response.headers.get("Access-Control-Allow-Methods")).toContain("GET");
			expect(response.headers.get("Access-Control-Allow-Methods")).toContain("POST");
			expect(response.headers.get("Access-Control-Allow-Methods")).toContain("DELETE");
			expect(response.headers.get("Access-Control-Allow-Headers")).toContain("Content-Type");
			expect(response.headers.get("Access-Control-Allow-Headers")).toContain("Mcp-Session-Id");

			await corsTransport.stop();
		});
	});

	describe("MCP endpoints", () => {
		beforeEach(async () => {
			await transport.start(mcpServer.getServer());
		});

		it("should return 404 for unknown endpoints", async () => {
			const response = await fetch(`http://localhost:${testPort}/unknown`);
			expect(response.status).toBe(404);

			const data = await response.json();
			expect(data.error.message).toBe("Not found");
		});

		it("should handle POST requests to root endpoint", async () => {
			// Test initialization request
			const initRequest = {
				jsonrpc: "2.0",
				id: 1,
				method: "initialize",
				params: {
					protocolVersion: "2024-11-05",
					capabilities: {},
					clientInfo: {
						name: "test-client",
						version: "1.0.0",
					},
				},
			};

			const response = await fetch(`http://localhost:${testPort}/`, {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					Accept: "application/json, text/event-stream",
				},
				body: JSON.stringify(initRequest),
			});

			expect(response.status).toBe(200);
			expect(response.headers.get("Mcp-Session-Id")).toBeDefined();

			// Should return MCP response
			const data = await response.json();
			expect(data.jsonrpc).toBe("2.0");
			expect(data.id).toBe(1);
		});

		it("should require session ID for non-initialization requests", async () => {
			const toolsRequest = {
				jsonrpc: "2.0",
				id: 2,
				method: "tools/list",
			};

			const response = await fetch(`http://localhost:${testPort}/`, {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					Accept: "application/json, text/event-stream",
				},
				body: JSON.stringify(toolsRequest),
			});

			expect(response.status).toBe(400);
		});

		it("should reject non-POST/GET/DELETE methods on root endpoint", async () => {
			const response = await fetch(`http://localhost:${testPort}/`, {
				method: "PUT",
			});

			expect(response.status).toBe(405);
			const data = await response.json();
			expect(data.error.message).toBe("Method not allowed");
		});

		it("should handle GET requests for SSE with valid session", async () => {
			// First, establish a session with POST
			const initRequest = {
				jsonrpc: "2.0",
				id: 1,
				method: "initialize",
				params: {
					protocolVersion: "2024-11-05",
					capabilities: {},
					clientInfo: {
						name: "test-client",
						version: "1.0.0",
					},
				},
			};

			const postResponse = await fetch(`http://localhost:${testPort}/`, {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					Accept: "application/json, text/event-stream",
				},
				body: JSON.stringify(initRequest),
			});

			const sessionId = postResponse.headers.get("Mcp-Session-Id");
			expect(sessionId).toBeDefined();

			// Now try SSE stream
			const getResponse = await fetch(`http://localhost:${testPort}/`, {
				method: "GET",
				headers: {
					"Mcp-Session-Id": sessionId || "",
				},
			});

			expect(getResponse.status).toBe(200);
			expect(getResponse.headers.get("Content-Type")).toBe("text/event-stream");
		});

		it("should reject GET requests without valid session", async () => {
			const response = await fetch(`http://localhost:${testPort}/`, {
				method: "GET",
				headers: {
					"Mcp-Session-Id": "invalid-session",
				},
			});

			expect(response.status).toBe(400);
		});
	});

	describe("connection info", () => {
		it("should return correct connection information", () => {
			const info = transport.getConnectionInfo();

			expect(info.host).toBe("localhost");
			expect(info.port).toBe(testPort);
			expect(info.endpoints).toHaveLength(2);
			expect(info.endpoints).toContain("/");
			expect(info.endpoints).toContain("/health");
		});
	});
});
