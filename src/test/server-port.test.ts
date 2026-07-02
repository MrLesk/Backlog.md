import { describe, expect, it } from "bun:test";
import net from "node:net";
import { findNextAvailablePort, isPortAvailable } from "../server/index.ts";

describe("isPortAvailable", () => {
	it("returns true for a free port", async () => {
		const result = await isPortAvailable(49999);
		expect(result).toBe(true);
	});

	it("returns false when a server already occupies the port", async () => {
		const srv = net.createServer();
		await new Promise<void>((resolve) => srv.listen(50001, "127.0.0.1", () => resolve()));
		try {
			const result = await isPortAvailable(50001);
			expect(result).toBe(false);
		} finally {
			await new Promise<void>((resolve) => srv.close(() => resolve()));
		}
	});

	it("returns false for port 0 (out-of-range for browser use)", async () => {
		const result = await isPortAvailable(0);
		expect(result).toBe(false);
	});
});

describe("findNextAvailablePort", () => {
	it("returns startPort when it is free", async () => {
		const port = await findNextAvailablePort(49990);
		expect(port).toBe(49990);
	});

	it("skips occupied ports and returns first free one", async () => {
		const srv = net.createServer();
		await new Promise<void>((resolve) => srv.listen(49985, "127.0.0.1", () => resolve()));
		try {
			const port = await findNextAvailablePort(49985);
			expect(port).toBeGreaterThan(49985);
		} finally {
			await new Promise<void>((resolve) => srv.close(() => resolve()));
		}
	});
});
