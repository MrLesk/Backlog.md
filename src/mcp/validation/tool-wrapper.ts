import type { Core } from "../../core/backlog.ts";
import { handleMcpError, McpInternalError, McpValidationError } from "../errors/mcp-errors.ts";
import type { CallToolResult, McpToolHandler } from "../types.ts";
import type { JsonSchema, ValidationResult } from "./validators.ts";
import { validateInput } from "./validators.ts";

/**
 * Circuit breaker for tracking tool failures
 */
interface CircuitBreakerState {
	failures: number;
	lastFailure: number;
	isOpen: boolean;
}

const circuitBreakers = new Map<string, CircuitBreakerState>();

/**
 * Execute a function with graceful degradation including retry logic and circuit breaker
 */
async function executeWithGracefulDegradation<T>(
	fn: () => Promise<T>,
	toolName: string,
	context: ValidationContext,
	maxRetries = 2,
): Promise<T> {
	const circuitBreaker = getCircuitBreaker(toolName);

	// Check circuit breaker state
	if (isCircuitOpen(circuitBreaker)) {
		throw new McpInternalError(
			`Tool '${toolName}' is temporarily unavailable due to repeated failures. Please try again later.`,
		);
	}

	let lastError: Error | undefined;

	for (let attempt = 1; attempt <= maxRetries + 1; attempt++) {
		try {
			const result = await fn();

			// Reset circuit breaker on success
			resetCircuitBreaker(toolName);

			return result;
		} catch (error) {
			lastError = error instanceof Error ? error : new Error(String(error));

			// Don't retry validation errors or auth errors - they won't change
			if (error instanceof McpValidationError || lastError.message.includes("Authentication")) {
				throw error;
			}

			// Record failure in circuit breaker
			recordFailure(toolName);

			// If this is the last attempt, throw the error
			if (attempt > maxRetries) {
				break;
			}

			// Wait with exponential backoff before retry
			const delay = Math.min(1000 * 2 ** (attempt - 1), 5000); // Cap at 5 seconds
			await new Promise((resolve) => setTimeout(resolve, delay));

			console.warn(`Tool '${toolName}' failed (attempt ${attempt}/${maxRetries + 1}), retrying in ${delay}ms...`, {
				clientId: context.clientId,
				error: lastError.message,
			});
		}
	}

	throw new McpInternalError(
		`Tool '${toolName}' failed after ${maxRetries + 1} attempts: ${lastError?.message || "Unknown error"}`,
	);
}

function getCircuitBreaker(toolName: string): CircuitBreakerState {
	if (!circuitBreakers.has(toolName)) {
		circuitBreakers.set(toolName, {
			failures: 0,
			lastFailure: 0,
			isOpen: false,
		});
	}
	return circuitBreakers.get(toolName) as CircuitBreakerState;
}

function isCircuitOpen(breaker: CircuitBreakerState): boolean {
	const now = Date.now();
	const timeoutPeriod = 30000; // 30 seconds

	if (breaker.isOpen) {
		// Check if enough time has passed to attempt reset
		if (now - breaker.lastFailure > timeoutPeriod) {
			breaker.isOpen = false;
			breaker.failures = 0;
		}
	}

	return breaker.isOpen;
}

function recordFailure(toolName: string): void {
	const breaker = getCircuitBreaker(toolName);
	breaker.failures++;
	breaker.lastFailure = Date.now();

	// Open circuit after 5 consecutive failures
	if (breaker.failures >= 5) {
		breaker.isOpen = true;
		console.error(`Circuit breaker opened for tool '${toolName}' due to repeated failures`);
	}
}

function resetCircuitBreaker(toolName: string): void {
	const breaker = getCircuitBreaker(toolName);
	if (breaker.failures > 0 && process.env.DEBUG) {
		console.log(`Circuit breaker reset for tool '${toolName}' - service recovered`);
	}
	breaker.failures = 0;
	breaker.isOpen = false;
}

/**
 * Validation context for tool calls
 */
export interface ValidationContext {
	clientId?: string;
	timestamp: number;
	core?: Core;
}

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

				// Execute handler with graceful degradation and retry logic
				const result = await executeWithGracefulDegradation(
					() => handler(validationResult.sanitizedData as T, context),
					toolDefinition.name,
					context,
				);

				return result;
			} catch (error) {
				// Log error for debugging (but don't expose sensitive details)
				console.error(`Tool '${toolDefinition.name}' error:`, {
					clientId: context.clientId,
					timestamp: context.timestamp,
					error: error instanceof Error ? error.message : String(error),
				});

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
