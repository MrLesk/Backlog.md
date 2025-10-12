import { handleMcpError, McpValidationError } from "../errors/mcp-errors.ts";
import type { CallToolResult, McpToolHandler } from "../types.ts";
import type { JsonSchema, ValidationResult } from "./validators.ts";
import { validateInput } from "./validators.ts";

/**
 * Validation context for tool calls
 */
export type ValidationContext = {
	clientId?: string;
	timestamp: number;
};

/**
 * Tool handler function with validation context
 */
export type ValidatedToolHandler<T = Record<string, unknown>> = (
	input: T,
	context: ValidationContext,
) => Promise<CallToolResult>;

/**
 * Creates a validated tool wrapper that adds comprehensive validation and error handling
 */
export function createValidatedTool<T extends Record<string, unknown>>(
	toolDefinition: Omit<McpToolHandler, "handler">,
	validator: (input: unknown, context?: ValidationContext) => Promise<ValidationResult> | ValidationResult,
	handler: ValidatedToolHandler<T>,
): McpToolHandler {
	return {
		...toolDefinition,
		async handler(request: Record<string, unknown>, clientId?: string): Promise<CallToolResult> {
			const context: ValidationContext = {
				clientId,
				timestamp: Date.now(),
			};

			try {
				// Input validation
				const validationResult = await validator(request, context);

				if (!validationResult.isValid) {
					throw new McpValidationError(
						`Validation failed: ${validationResult.errors.join(", ")}`,
						validationResult.errors,
					);
				}

				// Execute handler directly
				const result = await handler(validationResult.sanitizedData as T, context);

				return result;
			} catch (error) {
				// Log error for debugging (but don't expose sensitive details)
				if (process.env.DEBUG) {
					console.error(`Tool '${toolDefinition.name}' error:`, {
						clientId: context.clientId,
						timestamp: context.timestamp,
						error: error instanceof Error ? error.message : String(error),
					});
				}

				return handleMcpError(error);
			}
		},
	};
}

/**
 * Creates a simple validator from a JSON Schema
 */
export function createSchemaValidator(schema: JsonSchema): (input: unknown) => ValidationResult {
	return (input: unknown) => validateInput(input, schema);
}

/**
 * Creates an async validator that includes core-dependent validation
 */
export function createAsyncValidator(
	schema: JsonSchema,
	customValidator?: (input: Record<string, unknown>, context?: ValidationContext) => Promise<string[]>,
): (input: unknown, context?: ValidationContext) => Promise<ValidationResult> {
	return async (input: unknown, context?: ValidationContext) => {
		// Basic schema validation
		const baseResult = validateInput(input, schema);

		if (!baseResult.isValid) {
			return baseResult;
		}

		// Custom async validation
		if (customValidator && baseResult.sanitizedData) {
			try {
				const customErrors = await customValidator(baseResult.sanitizedData, context);
				if (customErrors.length > 0) {
					return {
						isValid: false,
						errors: [...baseResult.errors, ...customErrors],
					};
				}
			} catch (error) {
				return {
					isValid: false,
					errors: [`Validation error: ${error instanceof Error ? error.message : String(error)}`],
				};
			}
		}

		return baseResult;
	};
}

/**
 * Validates that all strings in the input are properly sanitized
 */
export function validateSanitizedStrings(data: Record<string, unknown>): string[] {
	const errors: string[] = [];

	function checkValue(key: string, value: unknown): void {
		if (typeof value === "string") {
			// Check for potential injection attempts
			if (value.includes("\0")) {
				errors.push(`Field '${key}' contains null bytes`);
			}
			if (value !== value.trim()) {
				errors.push(`Field '${key}' has leading or trailing whitespace`);
			}
		} else if (Array.isArray(value)) {
			for (let i = 0; i < value.length; i++) {
				checkValue(`${key}[${i}]`, value[i]);
			}
		} else if (typeof value === "object" && value !== null) {
			const obj = value as Record<string, unknown>;
			for (const [nestedKey, nestedValue] of Object.entries(obj)) {
				checkValue(`${key}.${nestedKey}`, nestedValue);
			}
		}
	}

	for (const [key, value] of Object.entries(data)) {
		checkValue(key, value);
	}

	return errors;
}

/**
 * Wrapper for tools that don't need custom validation beyond schema
 */
export function createSimpleValidatedTool<T extends Record<string, unknown>>(
	toolDefinition: Omit<McpToolHandler, "handler">,
	schema: JsonSchema,
	handler: ValidatedToolHandler<T>,
): McpToolHandler {
	return createValidatedTool(toolDefinition, createSchemaValidator(schema), handler);
}

/**
 * Wrapper for tools that need async validation (e.g., status validation)
 */
export function createAsyncValidatedTool<T extends Record<string, unknown>>(
	toolDefinition: Omit<McpToolHandler, "handler">,
	schema: JsonSchema,
	customValidator: (input: Record<string, unknown>, context?: ValidationContext) => Promise<string[]>,
	handler: ValidatedToolHandler<T>,
): McpToolHandler {
	return createValidatedTool(toolDefinition, createAsyncValidator(schema, customValidator), handler);
}
