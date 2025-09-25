import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import {
	cleanupMcpServerTestFactory,
	getMcpServerTestFactory,
	type TestFixtureType,
} from "./mcp-server-test-factory.ts";

describe("McpServerTestFactory", () => {
	afterEach(async () => {
		await cleanupMcpServerTestFactory();
	});

	describe("factory creation", () => {
		it("should create isolated server instances", async () => {
			const factory = getMcpServerTestFactory();
			const instance1 = await factory.createIsolatedServer("test-1");
			const instance2 = await factory.createIsolatedServer("test-2");

			expect(instance1.serverId).toBeDefined();
			expect(instance2.serverId).toBeDefined();
			expect(instance1.serverId).not.toBe(instance2.serverId);
			expect(instance1.server).not.toBe(instance2.server);

			await instance1.dispose();
			await instance2.dispose();
		});

		it("should create test context with fixtures", async () => {
			const factory = getMcpServerTestFactory();
			const context = await factory.createTestContext({
				testId: "test-context",
				fixture: "task-focused" as TestFixtureType,
			});

			expect(context.server).toBeDefined();
			expect(context.fixture).toBeDefined();
			expect(context.fixture.tasks).toBeDefined();

			await context.cleanup();
		});

		it("should provide performance metrics", async () => {
			const factory = getMcpServerTestFactory();
			const initialMetrics = factory.getPerformanceMetrics();

			const instance = await factory.createIsolatedServer("test-metrics");
			const metricsAfter = factory.getPerformanceMetrics();

			expect(metricsAfter.serverCreations).toBe(initialMetrics.serverCreations + 1);

			await instance.dispose();
		});
	});

	describe("caching behavior", () => {
		it("should reuse cached instances for read-only operations", async () => {
			const factory = getMcpServerTestFactory();

			const instance1 = await factory.getReadOnlyServer(["minimal"]);
			const instance2 = await factory.getReadOnlyServer(["minimal"]);

			// Should be same cached instance
			expect(instance1.serverId).toBe(instance2.serverId);

			const metrics = factory.getPerformanceMetrics();
			expect(metrics.cacheHits).toBeGreaterThan(0);

			await instance1.release();
			await instance2.release();
		});
	});
});
