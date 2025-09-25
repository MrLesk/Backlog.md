import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { McpServer } from "../mcp/server.ts";
import { BacklogSseTransport, type SseTransportOptions } from "../mcp/transports/sse.ts";

describe("BacklogSseTransport", () => {
	let sharedTransport: BacklogSseTransport;
	let sharedMcpServer: McpServer;
	let bearerTransport: BacklogSseTransport;
	let basicTransport: BacklogSseTransport;
	let corsTransport: BacklogSseTransport;
	const testPort = 18080; // Use different port to avoid conflicts
	const bearerPort = 18081;
	const basicPort = 18082;
	const corsPort = 18083;

	beforeAll(async () => {
		sharedMcpServer = new McpServer(process.cwd());

		// Create shared transports for different test scenarios
		sharedTransport = new BacklogSseTransport({
			host: "localhost",
			port: testPort,
			auth: { type: "none" },
		});

		bearerTransport = new BacklogSseTransport({
			host: "localhost",
			port: bearerPort,
			auth: { type: "bearer", token: "secret-token" },
		});

		basicTransport = new BacklogSseTransport({
			host: "localhost",
			port: basicPort,
			auth: { type: "basic", username: "user", password: "pass" },
		});

		corsTransport = new BacklogSseTransport({
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
			const defaultTransport = new BacklogSseTransport();
			const info = defaultTransport.getConnectionInfo();

			expect(info.host).toBe("localhost");
			expect(info.port).toBe(8080);
			expect(info.endpoints).toContain("/sse");
			expect(info.endpoints).toContain("/messages");
			expect(info.endpoints).toContain("/health");
		});

		it("should initialize with custom options", () => {
			const customOptions: SseTransportOptions = {
				host: "127.0.0.1",
				port: 9090,
				auth: { type: "bearer", token: "test-token" },
				cors: { origin: "https://example.com", credentials: true },
			};

			const customTransport = new BacklogSseTransport(customOptions);
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
			expect(data.transport).toBe("sse");
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
			expect(data.error).toBe("Unauthorized");
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
			expect(response.headers.get("Access-Control-Allow-Headers")).toContain("Content-Type");
		});
	});

	describe("endpoints", () => {
		// Use shared transport that's already running

		it("should return 404 for unknown endpoints", async () => {
			const response = await fetch(`http://localhost:${testPort}/unknown`);
			expect(response.status).toBe(404);

			const data = await response.json();
			expect(data.error).toBe("Not found");
		});

		it("should handle SSE endpoint with GET request", async () => {
			// Note: This is a simplified test. In a real scenario, we'd need to handle SSE streams properly
			const response = await fetch(`http://localhost:${testPort}/sse`);
			expect(response.status).toBe(200);
			expect(response.headers.get("Content-Type")).toBe("text/event-stream");
			expect(response.headers.get("Cache-Control")).toBe("no-cache, no-transform");
		});

		it("should reject SSE endpoint with non-GET request", async () => {
			const response = await fetch(`http://localhost:${testPort}/sse`, {
				method: "POST",
			});
			expect(response.status).toBe(404); // Will hit the catch-all 404
		});

		it("should handle messages endpoint validation", async () => {
			// Missing session ID
			const response = await fetch(`http://localhost:${testPort}/messages`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ test: "message" }),
			});
			expect(response.status).toBe(400);

			const data = await response.json();
			expect(data.error).toBe("Missing session ID");
		});

		it("should return 404 for unknown session ID", async () => {
			const response = await fetch(`http://localhost:${testPort}/messages?sessionId=unknown`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ test: "message" }),
			});
			expect(response.status).toBe(404);

			const data = await response.json();
			expect(data.error).toBe("Session not found");
		});
	});

	describe("connection info", () => {
		it("should return correct connection information", () => {
			const info = sharedTransport.getConnectionInfo();

			expect(info.host).toBe("localhost");
			expect(info.port).toBe(testPort);
			expect(info.endpoints).toHaveLength(3);
			expect(info.endpoints).toContain("/sse");
			expect(info.endpoints).toContain("/messages");
			expect(info.endpoints).toContain("/health");
		});
	});
});
