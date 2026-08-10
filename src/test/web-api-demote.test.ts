import { afterEach, describe, expect, it } from "bun:test";
import { ApiClient, ApiError } from "../web/lib/api.ts";

const originalFetch = globalThis.fetch;

afterEach(() => {
	globalThis.fetch = originalFetch;
});

describe("Web demote API client", () => {
	it("does not retry demotion and preserves the first server error", async () => {
		let calls = 0;
		globalThis.fetch = (async () => {
			calls += 1;
			return Response.json({ error: "Git commit failed after moving the task" }, { status: 500 });
		}) as unknown as typeof globalThis.fetch;

		const client = new ApiClient({ retries: 3 });
		const error = await client.demoteTask("TASK-1").then(
			() => null,
			(reason: unknown) => reason,
		);

		expect(calls).toBe(1);
		expect(error).toBeInstanceOf(ApiError);
		expect(error).toMatchObject({
			message: "Git commit failed after moving the task",
			status: 500,
		});
	});
});
