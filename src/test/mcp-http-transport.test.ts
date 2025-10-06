import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { McpServer } from "../mcp/server.ts";
import { BacklogHttpTransport, type HttpTransportOptions } from "../mcp/transports/http.ts";

describe("BacklogHttpTransport", () => {
	let sharedTransport: BacklogHttpTransport;
	let sharedMcpServer: McpServer;
	let bearerTransport: BacklogHttpTransport;
	let basicTransport: BacklogHttpTransport;
	let corsTransport: BacklogHttpTransport;
	const testPort = 19080; // Use different port to avoid conflicts
	const bearerPort = 19081;
	const basicPort = 19082;
	const corsPort = 19083;

	beforeAll(async () => {
		sharedMcpServer = new McpServer(process.cwd());

		// Create shared transports for different test scenarios
		sharedTransport = new BacklogHttpTransport({
			host: "localhost",
			port: testPort,
			auth: { type: "none" },
		});

		bearerTransport = new BacklogHttpTransport({
			host: "localhost",
			port: bearerPort,
			auth: { type: "bearer", token: "secret-token" },
		});

		basicTransport = new BacklogHttpTransport({
			host: "localhost",
			port: basicPort,
			auth: { type: "basic", username: "user", password: "pass" },
		});

		corsTransport = new BacklogHttpTransport({
			host: "localhost",
			port: corsPort,
			cors: { origin: "*", credentials: true },
		});

		// Start all shared transports
		await sharedTransport.start(sharedMcpServer.getServer());
		await bearerTransport.start(sharedMcpServer.getServer());
		await basicTransport.start(sharedMcpServer.getServer());
		await corsTransport.start(sharedMcpServer.getServer());
	});

	afterAll(async () => {
		// Clean up all shared transports
		if (sharedTransport) {
			await sharedTransport.stop();
		}
		if (bearerTransport) {
			await bearerTransport.stop();
		}
		if (basicTransport) {
			await basicTransport.stop();
		}
		if (corsTransport) {
			await corsTransport.stop();
		}
		if (sharedMcpServer) {
			await sharedMcpServer.stop();
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
		it("should be running and respond to health checks", async () => {
			// Check if server is running by making a health check request
			const response = await fetch(`http://localhost:${testPort}/health`);
			expect(response.status).toBe(200);

			const data = await response.json();
			expect(data.status).toBe("ok");
			expect(data.transport).toBe("http");
		});
	});

	describe("authentication", () => {
		it("should allow access with no auth", async () => {
			// Use shared no-auth transport
			const response = await fetch(`http://localhost:${testPort}/health`);
			expect(response.status).toBe(200);
		});

		it("should reject access without bearer token", async () => {
			// Use shared bearer auth transport without auth header
			const response = await fetch(`http://localhost:${bearerPort}/health`);
			expect(response.status).toBe(401);

			const data = await response.json();
			expect(data.error.message).toBe("Unauthorized");
		});

		it("should allow access with correct bearer token", async () => {
			// Use shared bearer auth transport with correct auth header
			const response = await fetch(`http://localhost:${bearerPort}/health`, {
				headers: {
					Authorization: "Bearer secret-token",
				},
			});
			expect(response.status).toBe(200);
		});

		it("should reject access with wrong bearer token", async () => {
			// Use shared bearer auth transport with wrong auth header
			const response = await fetch(`http://localhost:${bearerPort}/health`, {
				headers: {
					Authorization: "Bearer wrong-token",
				},
			});
			expect(response.status).toBe(401);
		});

		it("should allow access with correct basic auth", async () => {
			// Use shared basic auth transport with correct credentials
			const credentials = btoa("user:pass");
			const response = await fetch(`http://localhost:${basicPort}/health`, {
				headers: {
					Authorization: `Basic ${credentials}`,
				},
			});
			expect(response.status).toBe(200);
		});
	});

	describe("CORS", () => {
		it("should handle preflight requests", async () => {
			// Use shared CORS transport
			const response = await fetch(`http://localhost:${corsPort}/health`, {
				method: "OPTIONS",
			});

			expect(response.status).toBe(204);
			expect(response.headers.get("Access-Control-Allow-Origin")).toBe("*");
			expect(response.headers.get("Access-Control-Allow-Methods")).toContain("GET");
			expect(response.headers.get("Access-Control-Allow-Methods")).toContain("POST");
			expect(response.headers.get("Access-Control-Allow-Methods")).toContain("DELETE");
			expect(response.headers.get("Access-Control-Allow-Headers")).toContain("Content-Type");
			expect(response.headers.get("Access-Control-Allow-Headers")).toContain("Mcp-Session-Id");
		});
	});

	describe("MCP endpoints", () => {
		// Use shared transport that's already running

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
			const info = sharedTransport.getConnectionInfo();

			expect(info.host).toBe("localhost");
			expect(info.port).toBe(testPort);
			expect(info.endpoints).toHaveLength(2);
			expect(info.endpoints).toContain("/");
			expect(info.endpoints).toContain("/health");
		});
	});
});
