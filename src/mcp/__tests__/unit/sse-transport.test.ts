import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { McpServer } from "../../server.ts";
import { BacklogSseTransport, type SseTransportOptions } from "../../transports/sse.ts";

describe("BacklogSseTransport", () => {
	let transport: BacklogSseTransport;
	let mcpServer: McpServer;
	const testPort = 18080; // Use different port to avoid conflicts

	beforeEach(async () => {
		mcpServer = new McpServer(process.cwd());
		transport = new BacklogSseTransport({
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
		it("should start and stop server successfully", async () => {
			await transport.start(mcpServer.getServer());

			// Check if server is running by making a health check request
			const response = await fetch(`http://localhost:${testPort}/health`);
			expect(response.status).toBe(200);

			const data = await response.json();
			expect(data.status).toBe("ok");
			expect(data.transport).toBe("sse");

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
			const noAuthTransport = new BacklogSseTransport({
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
			const authTransport = new BacklogSseTransport({
				host: "localhost",
				port: testPort + 2,
				auth: { type: "bearer", token: "secret-token" },
			});

			await authTransport.start(mcpServer.getServer());

			// Request without auth header
			const response = await fetch(`http://localhost:${testPort + 2}/health`);
			expect(response.status).toBe(401);

			const data = await response.json();
			expect(data.error).toBe("Unauthorized");

			await authTransport.stop();
		});

		it("should allow access with correct bearer token", async () => {
			const authTransport = new BacklogSseTransport({
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
			const authTransport = new BacklogSseTransport({
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
			const authTransport = new BacklogSseTransport({
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
			const corsTransport = new BacklogSseTransport({
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
			expect(response.headers.get("Access-Control-Allow-Headers")).toContain("Content-Type");

			await corsTransport.stop();
		});
	});

	describe("endpoints", () => {
		beforeEach(async () => {
			await transport.start(mcpServer.getServer());
		});

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
			const info = transport.getConnectionInfo();

			expect(info.host).toBe("localhost");
			expect(info.port).toBe(testPort);
			expect(info.endpoints).toHaveLength(3);
			expect(info.endpoints).toContain("/sse");
			expect(info.endpoints).toContain("/messages");
			expect(info.endpoints).toContain("/health");
		});
	});
});
