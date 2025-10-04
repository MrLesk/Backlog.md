import { afterEach, beforeEach, describe, expect, spyOn, test } from "bun:test";
import {
	handleMcpError,
	handleMcpSuccess,
	McpAuthenticationError,
	McpConnectionError,
	McpError,
	McpInternalError,
	McpValidationError,
} from "../mcp/errors/mcp-errors.ts";

describe("MCP Error Classes", () => {
	test("McpError should have correct properties", () => {
		const error = new McpError("Test message", "TEST_CODE", { detail: "test" });

		expect(error.message).toBe("Test message");
		expect(error.code).toBe("TEST_CODE");
		expect(error.details).toEqual({ detail: "test" });
		expect(error.name).toBe("McpError");
		expect(error instanceof Error).toBe(true);
	});

	test("McpValidationError should inherit from McpError", () => {
		const error = new McpValidationError("Validation failed", { field: "title" });

		expect(error.message).toBe("Validation failed");
		expect(error.code).toBe("VALIDATION_ERROR");
		expect(error.details).toEqual({ field: "title" });
		expect(error instanceof McpError).toBe(true);
		expect(error instanceof McpValidationError).toBe(true);
	});

	test("McpAuthenticationError should have default message", () => {
		const error = new McpAuthenticationError();

		expect(error.message).toBe("Authentication required");
		expect(error.code).toBe("AUTH_ERROR");
	});

	test("McpAuthenticationError should accept custom message", () => {
		const error = new McpAuthenticationError("Invalid token");

		expect(error.message).toBe("Invalid token");
		expect(error.code).toBe("AUTH_ERROR");
	});

	test("McpConnectionError should store details", () => {
		const error = new McpConnectionError("Connection lost", { reason: "timeout" });

		expect(error.message).toBe("Connection lost");
		expect(error.code).toBe("CONNECTION_ERROR");
		expect(error.details).toEqual({ reason: "timeout" });
	});

	test("McpInternalError should have default message", () => {
		const error = new McpInternalError();

		expect(error.message).toBe("An unexpected error occurred");
		expect(error.code).toBe("INTERNAL_ERROR");
	});
});

describe("Error Response Handling", () => {
	let consoleErrorSpy: ReturnType<typeof spyOn>;

	beforeEach(() => {
		consoleErrorSpy = spyOn(console, "error").mockImplementation(() => {});
	});

	afterEach(() => {
		consoleErrorSpy?.mockRestore();
	});

	test("handleMcpError should format MCP errors correctly", () => {
		const error = new McpValidationError("Invalid input", { field: "title" });
		const result = handleMcpError(error);

		expect(result.isError).toBe(true);
		expect(result.content).toHaveLength(1);
		expect(result.content[0]?.type).toBe("text");

		// Now returns plain text error message instead of JSON
		expect(result.content[0]?.text).toBe("Invalid input");

		// MCP errors should not trigger console.error
		expect(consoleErrorSpy).not.toHaveBeenCalled();
	});

	test("handleMcpError should handle non-MCP errors", () => {
		const error = new Error("Regular error");
		const result = handleMcpError(error);

		expect(result.isError).toBe(true);
		expect(result.content).toHaveLength(1);
		expect(result.content[0]?.type).toBe("text");

		// Now returns plain text error message instead of JSON
		expect(result.content[0]?.text).toBe("An unexpected error occurred");

		// Verify console.error was called with the unexpected error
		expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
		expect(consoleErrorSpy).toHaveBeenCalledWith("Unexpected MCP error:", error);
	});

	test("handleMcpError should handle non-Error objects", () => {
		const error = "String error";
		const result = handleMcpError(error);

		expect(result.isError).toBe(true);
		expect(result.content).toHaveLength(1);
		expect(result.content[0]?.type).toBe("text");

		// Now returns plain text error message instead of JSON
		expect(result.content[0]?.text).toBe("An unexpected error occurred");

		// Verify console.error was called with the string error
		expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
		expect(consoleErrorSpy).toHaveBeenCalledWith("Unexpected MCP error:", error);
	});

	test("handleMcpSuccess should format success responses", () => {
		const data = { id: "task-123", title: "Test task" };
		const result = handleMcpSuccess(data);

		expect(result.isError).toBeUndefined();
		expect(result.content).toHaveLength(1);
		expect(result.content[0]?.type).toBe("text");

		const responseData = JSON.parse(result.content[0]?.text as string);
		expect(responseData.success).toBe(true);
		expect(responseData.data).toEqual(data);
	});

	test("handleMcpSuccess should handle null data", () => {
		const result = handleMcpSuccess(null);

		const responseData = JSON.parse(result.content[0]?.text as string);
		expect(responseData.success).toBe(true);
		expect(responseData.data).toBe(null);
	});
});
