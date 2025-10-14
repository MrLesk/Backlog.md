import type { CallToolResult } from "../types.ts";

/**
 * Base MCP error class for all MCP-related errors
 */
export class McpError extends Error {
	constructor(
		message: string,
		public code: string,
		public details?: unknown,
	) {
		super(message);
		this.name = "McpError";
	}
}

/**
 * Validation error for input validation failures
 */
export class McpValidationError extends McpError {
	constructor(message: string, validationError?: unknown) {
		super(message, "VALIDATION_ERROR", validationError);
	}
}

/**
 * Authentication error for auth failures
 */
export class McpAuthenticationError extends McpError {
	constructor(message = "Authentication required") {
		super(message, "AUTH_ERROR");
	}
}

/**
 * Connection error for transport-level failures
 */
export class McpConnectionError extends McpError {
	constructor(message: string, details?: unknown) {
		super(message, "CONNECTION_ERROR", details);
	}
}

/**
 * Internal error for unexpected failures
 */
export class McpInternalError extends McpError {
	constructor(message = "An unexpected error occurred", details?: unknown) {
		super(message, "INTERNAL_ERROR", details);
	}
}

/**
 * Formats MCP errors into standardized tool responses
 */
function buildErrorResult(code: string, message: string, details?: unknown): CallToolResult {
	const includeDetails = !!process.env.DEBUG;
	const structured = details !== undefined ? { code, details } : { code };
	return {
		content: [
			{
				type: "text",
				text: formatErrorMarkdown(code, message, details, includeDetails),
			},
		],
		isError: true,
		structuredContent: structured,
	};
}

export function handleMcpError(error: unknown): CallToolResult {
	if (error instanceof McpError) {
		return buildErrorResult(error.code, error.message, error.details);
	}

	console.error("Unexpected MCP error:", error);

	return {
		content: [
			{
				type: "text",
				text: formatErrorMarkdown("INTERNAL_ERROR", "An unexpected error occurred", error, !!process.env.DEBUG),
			},
		],
		isError: true,
		structuredContent: {
			code: "INTERNAL_ERROR",
			details: error,
		},
	};
}

/**
 * Formats successful responses in a consistent structure
 */
export function handleMcpSuccess(data: unknown): CallToolResult {
	return {
		content: [
			{
				type: "text",
				text: "OK",
			},
		],
		structuredContent: {
			success: true,
			data,
		},
	};
}

/**
 * Format error messages in markdown for consistent MCP error responses
 */
export function formatErrorMarkdown(code: string, message: string, details?: unknown, includeDetails = false): string {
	// Include details only when explicitly requested (e.g., debug mode)
	if (includeDetails && details) {
		let result = `${code}: ${message}`;

		const detailsText = typeof details === "string" ? details : JSON.stringify(details, null, 2);
		result += `\n  ${detailsText}`;

		return result;
	}

	return message;
}
