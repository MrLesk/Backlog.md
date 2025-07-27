import { describe, expect, it, mock } from "bun:test";
import { ApiClient } from "./api.ts";

const client = new ApiClient();

describe("apiClient sequences", () => {
	it("fetchSequences returns parsed data", async () => {
		const fakeResponse = { sequences: [{ number: 1, tasks: [] }] };
		const fetchMock = mock(async () => new Response(JSON.stringify(fakeResponse)));
		const originalFetch = globalThis.fetch;
		// @ts-ignore
		globalThis.fetch = fetchMock;

		const data = await client.fetchSequences();
		expect(data).toEqual(fakeResponse.sequences);

		globalThis.fetch = originalFetch;
	});

	it("moveTaskToSequence posts data", async () => {
		const fetchMock = mock(async (_input, init) => {
			expect(init?.method).toBe("POST");
			return new Response(JSON.stringify({ success: true, task: { id: "task-1" }, sequences: [] }));
		});
		const originalFetch = globalThis.fetch;
		// @ts-ignore
		globalThis.fetch = fetchMock;

		const res = await client.moveTaskToSequence("task-1", 2);
		expect(res.success).toBe(true);

		globalThis.fetch = originalFetch;
	});
});
