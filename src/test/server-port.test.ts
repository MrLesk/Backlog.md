import { describe, expect, it } from "bun:test";
import { findNextAvailablePort, isPortAvailable } from "../server/index.ts";
import { closeServer, listenOnEphemeralPort } from "./test-utils.ts";

describe("isPortAvailable", () => {
	it("returns true for a free port", async () => {
		const { server, port } = await listenOnEphemeralPort();
		await closeServer(server);

		const result = await isPortAvailable(port);
		expect(result).toBe(true);
	});

	it("returns false when a server already occupies the port", async () => {
		const { server, port } = await listenOnEphemeralPort();
		try {
			const result = await isPortAvailable(port);
			expect(result).toBe(false);
		} finally {
			await closeServer(server);
		}
	});

	it("returns false for port 0 (out-of-range for browser use)", async () => {
		const result = await isPortAvailable(0);
		expect(result).toBe(false);
	});

	it("detects a port held by a production-style Bun.serve on its default interface", async () => {
		// Regression for BACK-538: the probe used to bind 127.0.0.1 while Bun.serve
		// binds the wildcard interface, so on macOS an occupied port looked free.
		const server = Bun.serve({ port: 0, fetch: () => new Response("ok") });
		const port = server.port;
		if (port === undefined) throw new Error("Expected Bun.serve to expose its port");
		try {
			expect(await isPortAvailable(port)).toBe(false);
		} finally {
			await server.stop(true);
		}
		expect(await isPortAvailable(port)).toBe(true);
	});
});

describe("findNextAvailablePort", () => {
	it("returns startPort when it is free", async () => {
		const { server, port } = await listenOnEphemeralPort();
		await closeServer(server);

		const result = await findNextAvailablePort(port);
		expect(result).toBe(port);
	});

	it("skips occupied ports and returns first free one", async () => {
		const { server, port } = await listenOnEphemeralPort();
		try {
			const result = await findNextAvailablePort(port, Math.min(port + 50, 65535));
			expect(result).not.toBeNull();
			expect(result).toBeGreaterThan(port);
		} finally {
			await closeServer(server);
		}
	});

	it("returns null when every port in the bounded range is occupied", async () => {
		const { server, port } = await listenOnEphemeralPort();
		try {
			const result = await findNextAvailablePort(port, port);
			expect(result).toBeNull();
		} finally {
			await closeServer(server);
		}
	});

	it("returns null when the scan would start beyond the maximum browser port", async () => {
		const result = await findNextAvailablePort(65536);
		expect(result).toBeNull();
	});
});
