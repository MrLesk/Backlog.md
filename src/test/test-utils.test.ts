import { describe, expect, it } from "bun:test";
import { withTimeout } from "./test-utils.ts";

describe("test utilities", () => {
	it("resolves and rejects with the wrapped operation", async () => {
		await expect(withTimeout(Promise.resolve("ready"), "resolved operation", 100)).resolves.toBe("ready");

		const failure = new Error("operation failed");
		await expect(withTimeout(Promise.reject(failure), "rejected operation", 100)).rejects.toBe(failure);
	});

	it("rejects with a labelled error when the operation does not settle", async () => {
		await expect(withTimeout(new Promise(() => {}), "held operation", 10)).rejects.toThrow(
			"Timed out waiting for held operation",
		);
	});
});
