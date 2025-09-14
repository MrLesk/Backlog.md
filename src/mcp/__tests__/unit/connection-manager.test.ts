import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { ConnectionManager } from "../../connection/manager.ts";
import { McpConnectionError } from "../../errors/mcp-errors.ts";

describe("ConnectionManager", () => {
	let manager: ConnectionManager;

	beforeEach(() => {
		manager = new ConnectionManager({
			inactivity: 100, // 100ms for faster testing
			absolute: 1000, // 1s for faster testing
		});
	});

	afterEach(async () => {
		await manager.removeAllConnections("Test cleanup");
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

		// Wait a bit then update activity
		await new Promise((resolve) => setTimeout(resolve, 10));
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

		// Wait for inactivity timeout (100ms) - give extra time for timeout to trigger
		await new Promise((resolve) => setTimeout(resolve, 200));

		const _cleaned = await manager.cleanupExpiredConnections();
		// Note: connections might already be cleaned up by automatic timeout
		expect(manager.getStats().activeConnections).toBe(0);
	});

	test("should clean up connections due to absolute timeout", async () => {
		await manager.registerConnection("conn-1", {});

		// Keep updating activity but wait for absolute timeout
		const interval = setInterval(() => {
			manager.updateActivity("conn-1");
		}, 50);

		// Wait for absolute timeout (1000ms)
		await new Promise((resolve) => setTimeout(resolve, 1100));
		clearInterval(interval);

		const _cleaned = await manager.cleanupExpiredConnections();
		// Connection should be removed by automatic timeout or manual cleanup
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
		const removed = await manager.removeConnection("conn-1");
		expect(removed).toBe(true);
		expect(manager.hasActiveConnection("conn-1")).toBe(false);
	});

	test("should update timeout configuration", () => {
		const initialTimeouts = manager.getTimeouts();
		expect(initialTimeouts.inactivity).toBe(100);
		expect(initialTimeouts.absolute).toBe(1000);

		manager.updateTimeouts({ inactivity: 200 });
		const updatedTimeouts = manager.getTimeouts();
		expect(updatedTimeouts.inactivity).toBe(200);
		expect(updatedTimeouts.absolute).toBe(1000); // Unchanged
	});

	test("should start and stop periodic cleanup", async () => {
		await manager.registerConnection("conn-1", {});

		const cleanupInterval = manager.startPeriodicCleanup(50); // 50ms interval

		// Wait for cleanup to run
		await new Promise((resolve) => setTimeout(resolve, 200));

		clearInterval(cleanupInterval);

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
});
