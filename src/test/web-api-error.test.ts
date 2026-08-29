import { describe, expect, it } from "bun:test";
import { ApiError } from "../web/lib/api.ts";

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
