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
export function handleMcpError(error: unknown): CallToolResult {
	if (error instanceof McpError) {
		return {
			content: [
				{
					type: "text",
					text: JSON.stringify({
						success: false,
						error: {
							code: error.code,
							message: error.message,
							details: error.details,
						},
					}),
				},
			],
			isError: true,
		};
	}

	// Log unexpected errors for debugging but don't expose details to clients
	console.error("Unexpected MCP error:", error);

	return {
		content: [
			{
				type: "text",
				text: JSON.stringify({
					success: false,
					error: {
						code: "INTERNAL_ERROR",
						message: "An unexpected error occurred",
					},
				}),
			},
		],
		isError: true,
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
				text: JSON.stringify({
					success: true,
					data,
				}),
			},
		],
	};
}
