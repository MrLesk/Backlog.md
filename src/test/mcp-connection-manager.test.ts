import { afterEach, beforeEach, describe, expect, spyOn, test } from "bun:test";
import { ConnectionManager, type TimeProvider } from "../mcp/connection/manager.ts";
import { McpConnectionError } from "../mcp/errors/mcp-errors.ts";

class MockTimeProvider implements TimeProvider {
	private currentTime = 0;

	now(): number {
		return this.currentTime;
	}

	advance(ms: number): void {
		this.currentTime += ms;
	}

	set(time: number): void {
		this.currentTime = time;
	}
}

describe("ConnectionManager", () => {
	let manager: ConnectionManager;
	let mockTime: MockTimeProvider;
	let consoleErrorSpy: ReturnType<typeof spyOn>;

	beforeEach(() => {
		consoleErrorSpy = spyOn(console, "error").mockImplementation(() => {});
		mockTime = new MockTimeProvider();
		manager = new ConnectionManager(
			{
				inactivity: 30000, // 30 seconds - realistic production timeout
				absolute: 3600000, // 1 hour - realistic production timeout
			},
			mockTime,
		);
	});

	afterEach(async () => {
		manager.stopPeriodicCleanup();
		await manager.removeAllConnections("Test cleanup");
		consoleErrorSpy?.mockRestore();
	});

	test("should register new connections", async () => {
		const transport = { id: "test-transport" };
		await manager.registerConnection("conn-1", transport, "client-1");

		expect(manager.hasActiveConnection("conn-1")).toBe(true);
		const connection = manager.getConnection("conn-1");
		expect(connection).toBeDefined();
		expect(connection?.id).toBe("conn-1");
		expect(connection?.clientId).toBe("client-1");
		expect(connection?.transport).toBe(transport);
	});

	test("should update connection activity", async () => {
		const transport = { id: "test-transport" };
		await manager.registerConnection("conn-1", transport);

		const connection = manager.getConnection("conn-1");
		const initialActivity = connection?.lastActivity;

		// Advance time then update activity
		mockTime.advance(1000);
		const updated = manager.updateActivity("conn-1");

		expect(updated).toBe(true);
		const updatedConnection = manager.getConnection("conn-1");
		expect(updatedConnection?.lastActivity).toBeGreaterThan(initialActivity || 0);
	});

	test("should return false for non-existent connection activity update", () => {
		const updated = manager.updateActivity("non-existent");
		expect(updated).toBe(false);
	});

	test("should get connection statistics", async () => {
		await manager.registerConnection("conn-1", {}, "client-1");
		await manager.registerConnection("conn-2", {}, "client-1");
		await manager.registerConnection("conn-3", {}, "client-2");

		const stats = manager.getStats();
		expect(stats.activeConnections).toBe(3);
		expect(stats.connectionsPerClient["client-1"]).toBe(2);
		expect(stats.connectionsPerClient["client-2"]).toBe(1);
		expect(typeof stats.oldestConnection).toBe("number");
		if (stats.oldestConnection !== null) {
			expect(stats.oldestConnection).toBeGreaterThanOrEqual(0);
		}
	});

	test("should remove individual connections", async () => {
		await manager.registerConnection("conn-1", {});
		await manager.registerConnection("conn-2", {});

		expect(manager.hasActiveConnection("conn-1")).toBe(true);
		expect(manager.hasActiveConnection("conn-2")).toBe(true);

		const removed = await manager.removeConnection("conn-1");
		expect(removed).toBe(true);
		expect(manager.hasActiveConnection("conn-1")).toBe(false);
		expect(manager.hasActiveConnection("conn-2")).toBe(true);
	});

	test("should return false when removing non-existent connection", async () => {
		const removed = await manager.removeConnection("non-existent");
		expect(removed).toBe(false);
	});

	test("should remove all connections", async () => {
		await manager.registerConnection("conn-1", {});
		await manager.registerConnection("conn-2", {});
		await manager.registerConnection("conn-3", {});

		expect(manager.getStats().activeConnections).toBe(3);

		await manager.removeAllConnections("Test removal");
		expect(manager.getStats().activeConnections).toBe(0);
	});

	test("should replace existing connection with same ID", async () => {
		const transport1 = { id: "transport-1" };
		const transport2 = { id: "transport-2" };

		await manager.registerConnection("conn-1", transport1, "client-1");
		expect(manager.getConnection("conn-1")?.transport).toBe(transport1);

		await manager.registerConnection("conn-1", transport2, "client-2");
		expect(manager.getConnection("conn-1")?.transport).toBe(transport2);
		expect(manager.getConnection("conn-1")?.clientId).toBe("client-2");
		expect(manager.getStats().activeConnections).toBe(1);
	});

	test("should clean up expired connections due to inactivity", async () => {
		await manager.registerConnection("conn-1", {});
		await manager.registerConnection("conn-2", {});

		expect(manager.getStats().activeConnections).toBe(2);

		// Advance time past inactivity timeout (30 seconds)
		mockTime.advance(30001);

		// Single cleanup call now marks and removes in one go
		const cleaned = await manager.cleanupExpiredConnections();

		expect(cleaned).toBeGreaterThan(0);
		expect(manager.getStats().activeConnections).toBe(0);
	});

	test("should clean up connections due to absolute timeout", async () => {
		await manager.registerConnection("conn-1", {});

		// Advance time to just before absolute timeout while updating activity
		mockTime.advance(3599000); // 59 minutes 59 seconds
		manager.updateActivity("conn-1");

		// Advance past absolute timeout (1 hour total)
		mockTime.advance(2000); // 2 more seconds

		// Single cleanup call now marks and removes in one go
		const cleaned = await manager.cleanupExpiredConnections();

		expect(cleaned).toBeGreaterThan(0);
		expect(manager.getStats().activeConnections).toBe(0);
	});

	test("should validate connections and throw for missing ones", async () => {
		await manager.registerConnection("conn-1", {});

		const connection = manager.validateConnection("conn-1");
		expect(connection.id).toBe("conn-1");

		expect(() => manager.validateConnection("non-existent")).toThrow(McpConnectionError);
	});

	test("should handle transport cleanup on connection removal", async () => {
		let closed = false;
		const transport = {
			close: async () => {
				closed = true;
			},
		};

		await manager.registerConnection("conn-1", transport);
		await manager.removeConnection("conn-1");

		expect(closed).toBe(true);
	});

	test("should handle transport cleanup errors gracefully", async () => {
		const transport = {
			close: async () => {
				throw new Error("Cleanup failed");
			},
		};

		await manager.registerConnection("conn-1", transport);

		// Should not throw despite transport cleanup error
		// The error should be caught and logged, but not propagate
		const removed = await manager.removeConnection("conn-1");
		expect(removed).toBe(true);
		expect(manager.hasActiveConnection("conn-1")).toBe(false);

		// Verify that the error was logged to console
		expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
		expect(consoleErrorSpy).toHaveBeenCalledWith("Error closing transport for connection conn-1:", expect.any(Error));
	});

	test("should update timeout configuration", () => {
		const initialTimeouts = manager.getTimeouts();
		expect(initialTimeouts.inactivity).toBe(30000);
		expect(initialTimeouts.absolute).toBe(3600000);

		manager.updateTimeouts({ inactivity: 60000 });
		const updatedTimeouts = manager.getTimeouts();
		expect(updatedTimeouts.inactivity).toBe(60000);
		expect(updatedTimeouts.absolute).toBe(3600000); // Unchanged
	});

	test("should start and stop periodic cleanup", async () => {
		await manager.registerConnection("conn-1", {});

		// Advance time past inactivity timeout
		mockTime.advance(30001);

		// Manually trigger cleanup to simulate periodic cleanup
		await manager.cleanupExpiredConnections();

		// Connection should be cleaned up due to inactivity
		expect(manager.getStats().activeConnections).toBe(0);
	});

	test("should store and retrieve connection metadata", async () => {
		const metadata = { userAgent: "test", version: "1.0" };
		await manager.registerConnection("conn-1", {}, "client-1", metadata);

		const connection = manager.getConnection("conn-1");
		expect(connection?.metadata).toEqual(metadata);
	});

	test("should handle connections without client ID", async () => {
		await manager.registerConnection("conn-1", {});

		const stats = manager.getStats();
		expect(stats.connectionsPerClient.unknown).toBe(1);
	});

	test("should get all connections", async () => {
		await manager.registerConnection("conn-1", {}, "client-1");
		await manager.registerConnection("conn-2", {}, "client-2");

		const connections = manager.getAllConnections();
		expect(connections).toHaveLength(2);
		expect(connections.map((c) => c.id)).toContain("conn-1");
		expect(connections.map((c) => c.id)).toContain("conn-2");
	});

	test("should mark connections as expired and remove them in single cleanup call", async () => {
		await manager.registerConnection("conn-1", {});

		// Initially connection should be active
		expect(manager.hasActiveConnection("conn-1")).toBe(true);

		// Advance time past inactivity timeout
		mockTime.advance(30001);

		// Run cleanup - this will mark and remove in single call
		const cleaned = await manager.cleanupExpiredConnections();

		// Connection should be removed
		expect(cleaned).toBe(1);
		expect(manager.getConnection("conn-1")).toBeUndefined();
		expect(manager.hasActiveConnection("conn-1")).toBe(false);
	});

	test("should reject activity updates for marked connections", async () => {
		// Use a transport that fails to close, so connection stays marked
		const failingTransport = {
			close: async () => {
				throw new Error("Transport close failed");
			},
		};

		await manager.registerConnection("conn-1", failingTransport);

		// Advance time past inactivity timeout and run cleanup to mark it
		mockTime.advance(30001);
		await manager.cleanupExpiredConnections();

		// Connection should still exist but be marked for removal
		expect(manager.getConnection("conn-1")).toBeDefined();

		// Activity update should be rejected
		const updated = manager.updateActivity("conn-1");
		expect(updated).toBe(false);
	});

	test("should throw error when validating marked connections", async () => {
		// Use a transport that fails to close, so connection stays marked
		const failingTransport = {
			close: async () => {
				throw new Error("Transport close failed");
			},
		};

		await manager.registerConnection("conn-1", failingTransport);

		// Initially should validate fine
		expect(() => manager.validateConnection("conn-1")).not.toThrow();

		// Advance time past inactivity timeout and run cleanup to mark it
		mockTime.advance(30001);
		await manager.cleanupExpiredConnections();

		// Should now throw for expired connection
		expect(() => manager.validateConnection("conn-1")).toThrow("Connection expired: conn-1");
	});

	test("should retry failed removals and eventually force remove", async () => {
		let callCount = 0;
		const transport = {
			close: async () => {
				callCount++;
				if (callCount <= 3) {
					throw new Error("Simulated failure");
				}
			},
		};

		await manager.registerConnection("conn-1", transport);

		// Advance time past inactivity timeout
		mockTime.advance(30001);

		// Run cleanup multiple times to trigger retries
		await manager.cleanupExpiredConnections(); // Mark + first attempt
		await manager.cleanupExpiredConnections(); // Second attempt
		await manager.cleanupExpiredConnections(); // Third attempt
		await manager.cleanupExpiredConnections(); // Force removal

		// Connection should be removed after force removal
		expect(manager.hasActiveConnection("conn-1")).toBe(false);
		expect(manager.getConnection("conn-1")).toBeUndefined();
	});

	test("should stop and start periodic cleanup", async () => {
		const cleanup1 = manager.startPeriodicCleanup(1000);
		expect(cleanup1).toBeDefined();

		// Starting again should stop the first one
		const cleanup2 = manager.startPeriodicCleanup(500);
		expect(cleanup2).toBeDefined();
		expect(cleanup2).not.toBe(cleanup1);

		manager.stopPeriodicCleanup();
		// Should be safe to call multiple times
		manager.stopPeriodicCleanup();
	});
});
