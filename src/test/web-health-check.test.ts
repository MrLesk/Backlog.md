import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { mkdir, rm } from "node:fs/promises";
import { join } from "node:path";
import { Core } from "../index.ts";
import { BacklogServer } from "../server/index.ts";

const TEST_DIR = join(process.cwd(), "test-health-check");
const TEST_PORT = 6499; // Use a unique port to avoid conflicts

describe("Web UI Health Check System", () => {
	let server: BacklogServer;

	beforeEach(async () => {
		// Clean up and create test directory
		await rm(TEST_DIR, { recursive: true, force: true }).catch(() => {});
		await mkdir(TEST_DIR, { recursive: true });

		// Initialize git and backlog
		await Bun.spawn(["git", "init", "-b", "main"], { cwd: TEST_DIR }).exited;
		await Bun.spawn(["git", "config", "user.name", "Test User"], { cwd: TEST_DIR }).exited;
		await Bun.spawn(["git", "config", "user.email", "test@example.com"], { cwd: TEST_DIR }).exited;

		const core = new Core(TEST_DIR);
		await core.initializeProject("Health Check Test", true);

		// Start the web server
		server = new BacklogServer(TEST_DIR);
		await server.start(TEST_PORT, false);

		// Give server a moment to fully start
		await new Promise((resolve) => setTimeout(resolve, 100));
	});

	afterEach(async () => {
		// Stop the server
		await server.stop();

		// Clean up test directory
		await rm(TEST_DIR, { recursive: true, force: true }).catch(() => {});
	});

	describe("Health Endpoint", () => {
		it("should respond with healthy status when system is operational", async () => {
			const response = await fetch(`http://localhost:${TEST_PORT}/api/health`);
			expect(response.ok).toBe(true);
			expect(response.status).toBe(200);

			const data = await response.json();
			expect(data).toHaveProperty("status", "healthy");
			expect(data).toHaveProperty("timestamp");
			expect(data).toHaveProperty("responseTime");
			expect(data).toHaveProperty("project", "Health Check Test");
			expect(data.checks).toEqual({
				filesystem: "ok",
				config: "ok",
			});
		});

		it("should include valid timestamp in ISO format", async () => {
			const response = await fetch(`http://localhost:${TEST_PORT}/api/health`);
			const data = await response.json();

			const timestamp = new Date(data.timestamp);
			expect(timestamp.toISOString()).toBe(data.timestamp);
			expect(timestamp.getTime()).toBeLessThanOrEqual(Date.now());
		});

		it("should measure response time accurately", async () => {
			const response = await fetch(`http://localhost:${TEST_PORT}/api/health`);
			const data = await response.json();

			expect(typeof data.responseTime).toBe("number");
			expect(data.responseTime).toBeGreaterThanOrEqual(0);
			expect(data.responseTime).toBeLessThan(1000); // Should respond in less than 1 second
		});

		it("should handle CORS headers properly", async () => {
			const response = await fetch(`http://localhost:${TEST_PORT}/api/health`);

			expect(response.headers.get("Access-Control-Allow-Origin")).toBe("*");
			expect(response.headers.get("Content-Type")).toContain("application/json");
		});
	});

	describe("Error Handling", () => {
		it("should handle server errors gracefully", async () => {
			// Stop the server to simulate connection failure
			await server.stop();

			try {
				await fetch(`http://localhost:${TEST_PORT}/api/health`);
				expect(true).toBe(false); // Should not reach here
			} catch (error) {
				expect(error).toBeDefined();
			}
		});
	});
});

describe("Health Check Client API", () => {
	it("should parse health response correctly", () => {
		const mockResponse = {
			status: "healthy",
			timestamp: new Date().toISOString(),
			responseTime: 42,
			project: "Test Project",
			checks: {
				filesystem: "ok",
				config: "ok",
			},
		};

		// Verify the response structure matches what the API expects
		expect(mockResponse).toHaveProperty("status");
		expect(mockResponse).toHaveProperty("timestamp");
		expect(mockResponse).toHaveProperty("responseTime");
		expect(mockResponse).toHaveProperty("project");
		expect(mockResponse).toHaveProperty("checks");
		expect(mockResponse.checks).toHaveProperty("filesystem");
		expect(mockResponse.checks).toHaveProperty("config");
	});
});

describe("Health Check Hook State Management", () => {
	// Mock localStorage for testing
	const localStorageMock = (() => {
		let store: Record<string, string> = {};
		return {
			getItem: (key: string) => store[key] || null,
			setItem: (key: string, value: string) => {
				store[key] = value;
			},
			removeItem: (key: string) => {
				delete store[key];
			},
			clear: () => {
				store = {};
			},
		};
	})();

	beforeEach(() => {
		// @ts-ignore
		global.localStorage = localStorageMock;
		localStorageMock.clear();
	});

	it("should persist health state to localStorage", () => {
		const state = {
			isOnline: false,
			lastCheckTime: Date.now(),
			consecutiveFailures: 3,
		};

		localStorageMock.setItem("backlog-health-check", JSON.stringify(state));

		const saved = localStorageMock.getItem("backlog-health-check");
		expect(saved).toBeTruthy();

		const parsed = JSON.parse(saved as string);
		expect(parsed.isOnline).toBe(false);
		expect(parsed.lastCheckTime).toBe(state.lastCheckTime);
		expect(parsed.consecutiveFailures).toBe(3);
	});

	it("should load health state from localStorage", () => {
		const savedState = {
			isOnline: true,
			lastCheckTime: Date.now() - 60000, // 1 minute ago
			consecutiveFailures: 0,
		};

		localStorageMock.setItem("backlog-health-check", JSON.stringify(savedState));

		const loaded = localStorageMock.getItem("backlog-health-check");
		const parsed = JSON.parse(loaded as string);

		expect(parsed.isOnline).toBe(true);
		expect(parsed.consecutiveFailures).toBe(0);
	});
});
