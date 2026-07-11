import { describe, expect, it, spyOn } from "bun:test";
import { withTimeout } from "./test-utils.ts";

describe("test utilities", () => {
	it("clears its timeout when the wrapped operation resolves early", async () => {
		const clearTimeoutSpy = spyOn(globalThis, "clearTimeout");
		try {
			await expect(withTimeout(Promise.resolve("ready"), "resolved operation", 100)).resolves.toBe("ready");
			expect(clearTimeoutSpy).toHaveBeenCalledTimes(1);
		} finally {
			clearTimeoutSpy.mockRestore();
		}
	});

	it("clears its timeout when the wrapped operation rejects early", async () => {
		const failure = new Error("operation failed");
		const clearTimeoutSpy = spyOn(globalThis, "clearTimeout");
		try {
			await expect(withTimeout(Promise.reject(failure), "rejected operation", 100)).rejects.toBe(failure);
			expect(clearTimeoutSpy).toHaveBeenCalledTimes(1);
		} finally {
			clearTimeoutSpy.mockRestore();
		}
	});

	it("rejects with a labelled error when the operation does not settle", async () => {
		await expect(withTimeout(new Promise(() => {}), "held operation", 10)).rejects.toThrow(
			"Timed out waiting for held operation",
		);
	});
});
