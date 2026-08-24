import { afterEach, describe, expect, it } from "bun:test";
import { ApiError, apiClient } from "../web/lib/api.ts";

describe("Web API errors", () => {
	it("uses server error payloads as the user-facing message", () => {
		const error = ApiError.fromResponse(new Response(null, { status: 400, statusText: "Bad Request" }), {
			error: "Comment body cannot contain standalone '---' delimiter lines.",
		});

		expect(error.message).toBe("Comment body cannot contain standalone '---' delimiter lines.");
		expect(error.status).toBe(400);
	});

	it("falls back to HTTP status text when no server error payload exists", () => {
		const error = ApiError.fromResponse(new Response(null, { status: 404, statusText: "Not Found" }));

		expect(error.message).toBe("HTTP 404: Not Found");
	});
});

describe("apiClient.fetchTasks", () => {
	const originalFetch = globalThis.fetch;

	afterEach(() => {
		globalThis.fetch = originalFetch;
	});

	it("sends crossBranch=false explicitly instead of omitting the param", async () => {
		let requestedUrl = "";
		globalThis.fetch = (async (input: RequestInfo | URL) => {
			requestedUrl = String(input);
			return new Response(JSON.stringify([]), { status: 200 });
		}) as typeof fetch;

		await apiClient.fetchTasks({ crossBranch: false });

		expect(new URL(requestedUrl, "http://localhost").searchParams.get("crossBranch")).toBe("false");
	});

	it("sends crossBranch=true by default", async () => {
		let requestedUrl = "";
		globalThis.fetch = (async (input: RequestInfo | URL) => {
			requestedUrl = String(input);
			return new Response(JSON.stringify([]), { status: 200 });
		}) as typeof fetch;

		await apiClient.fetchTasks();

		expect(new URL(requestedUrl, "http://localhost").searchParams.get("crossBranch")).toBe("true");
	});
});
