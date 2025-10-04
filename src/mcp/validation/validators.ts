import type { Core } from "../../core/backlog.ts";
import { getValidStatuses } from "../../utils/status.ts";
import { McpValidationError } from "../errors/mcp-errors.ts";

/**
 * JSON Schema validator interface
 */
export interface JsonSchema {
	type?: string; // Made optional to allow "any type" schemas
	properties?: Record<string, JsonSchema>;
	required?: string[];
	items?: JsonSchema;
	enum?: string[];
	minLength?: number;
	maxLength?: number;
	minimum?: number;
	maximum?: number;
	maxItems?: number;
	preserveWhitespace?: boolean;
	description?: string; // Optional field description for documentation
}

/**
 * Validation result interface
 */
export interface ValidationResult {
	isValid: boolean;
	errors: string[];
	sanitizedData?: Record<string, unknown>;
}

/**
 * Validates input against a JSON Schema
 */
export function validateInput(input: unknown, schema: JsonSchema): ValidationResult {
	const errors: string[] = [];
	const sanitizedData: Record<string, unknown> = {};

	if (typeof input !== "object" || input === null) {
		return {
			isValid: false,
			errors: ["Input must be an object"],
		};
	}

	const data = input as Record<string, unknown>;

	// Check required fields
	if (schema.required) {
		for (const field of schema.required) {
			if (!(field in data) || data[field] === undefined || data[field] === null) {
				errors.push(`Required field '${field}' is missing or null`);
			}
		}
	}

	// Validate properties
	if (schema.properties) {
		for (const [key, value] of Object.entries(data)) {
			const fieldSchema = schema.properties[key];
			if (!fieldSchema) {
				// Unknown fields are allowed but not included in sanitized data
				continue;
			}

			const fieldResult = validateField(key, value, fieldSchema);
			if (!fieldResult.isValid) {
				errors.push(...fieldResult.errors);
			} else if (fieldResult.sanitizedValue !== undefined) {
				sanitizedData[key] = fieldResult.sanitizedValue;
			}
		}
	}

	return {
		isValid: errors.length === 0,
		errors,
		sanitizedData: errors.length === 0 ? sanitizedData : undefined,
	};
}

/**
 * Validates a single field against its schema
 */
function validateField(
	fieldName: string,
	value: unknown,
	schema: JsonSchema,
): { isValid: boolean; errors: string[]; sanitizedValue?: unknown } {
	const errors: string[] = [];

	if (value === undefined || value === null) {
		return { isValid: true, errors: [], sanitizedValue: value };
	}

	// If no type is specified, accept any type
	if (!schema.type) {
		return { isValid: true, errors: [], sanitizedValue: value };
	}

	// Type validation
	switch (schema.type) {
		case "string": {
			if (typeof value !== "string") {
				errors.push(`Field '${fieldName}' must be a string`);
				break;
			}

			// Sanitize string input
			// Preserve whitespace for separator fields and when explicitly requested
			const shouldPreserveWhitespace = schema.preserveWhitespace || fieldName === "separator";
			const sanitizedString = shouldPreserveWhitespace
				? sanitizeStringPreserveWhitespace(value)
				: sanitizeString(value);

			// Length validation
			if (schema.minLength !== undefined && sanitizedString.length < schema.minLength) {
				errors.push(`Field '${fieldName}' must be at least ${schema.minLength} characters long`);
			}
			if (schema.maxLength !== undefined && sanitizedString.length > schema.maxLength) {
				errors.push(
					`Field '${fieldName}' exceeds maximum length of ${schema.maxLength} characters (${sanitizedString.length} characters)`,
				);
			}

			// Enum validation
			if (schema.enum && !schema.enum.includes(sanitizedString)) {
				errors.push(`Field '${fieldName}' must be one of: ${schema.enum.join(", ")}`);
			}

			return { isValid: errors.length === 0, errors, sanitizedValue: sanitizedString };
		}

		case "number": {
			const numValue = typeof value === "string" ? Number.parseFloat(value) : value;
			if (typeof numValue !== "number" || Number.isNaN(numValue)) {
				errors.push(`Field '${fieldName}' must be a number`);
				break;
			}

			// Range validation
			if (schema.minimum !== undefined && numValue < schema.minimum) {
				errors.push(`Field '${fieldName}' must be at least ${schema.minimum}`);
			}
			if (schema.maximum !== undefined && numValue > schema.maximum) {
				errors.push(`Field '${fieldName}' must be at most ${schema.maximum}`);
			}

			return { isValid: errors.length === 0, errors, sanitizedValue: numValue };
		}

		case "array": {
			if (!Array.isArray(value)) {
				errors.push(`Field '${fieldName}' must be an array`);
				break;
			}

			// Validate maxItems
			if (schema.maxItems !== undefined && value.length > schema.maxItems) {
				errors.push(`Field '${fieldName}' must have at most ${schema.maxItems} items`);
			}

			const sanitizedArray: unknown[] = [];

			// Validate array items
			if (schema.items) {
				for (let i = 0; i < value.length; i++) {
					const itemResult = validateField(`${fieldName}[${i}]`, value[i], schema.items);
					if (!itemResult.isValid) {
						errors.push(...itemResult.errors);
					} else if (itemResult.sanitizedValue !== undefined) {
						sanitizedArray.push(itemResult.sanitizedValue);
					}
				}
			}

			return { isValid: errors.length === 0, errors, sanitizedValue: sanitizedArray };
		}

		case "boolean": {
			const boolValue = typeof value === "string" ? value.toLowerCase() === "true" : Boolean(value);
			return { isValid: true, errors: [], sanitizedValue: boolValue };
		}

		default: {
			errors.push(`Unknown schema type '${schema.type}' for field '${fieldName}'`);
		}
	}

	return { isValid: errors.length === 0, errors, sanitizedValue: value };
}

/**
 * Sanitizes string input to prevent various injection attacks
 */
export function sanitizeString(input: string): string {
	if (typeof input !== "string") {
		return String(input);
	}

	// Remove null bytes
	let sanitized = input.replace(/\0/g, "");

	// Trim whitespace
	sanitized = sanitized.trim();

	// Normalize line endings
	sanitized = sanitized.replace(/\r\n/g, "\n").replace(/\r/g, "\n");

	return sanitized;
}

export function sanitizeStringPreserveWhitespace(input: string): string {
	if (typeof input !== "string") {
		return String(input);
	}

	// Don't remove null bytes - let validation catch them
	// Normalize line endings but preserve whitespace
	const sanitized = input.replace(/\r\n/g, "\n").replace(/\r/g, "\n");

	return sanitized;
}

/**
 * Validates and sanitizes file paths to prevent directory traversal
 */
export function sanitizePath(path: string): string {
	if (typeof path !== "string") {
		throw new McpValidationError("Path must be a string");
	}

	// Check for absolute paths first
	if (path.startsWith("/")) {
		throw new McpValidationError("Absolute paths are not allowed");
	}

	// Remove null bytes
	let sanitized = path.replace(/\0/g, "");

	// Remove directory traversal attempts and normalize slashes
	sanitized = sanitized.replace(/\.\./g, "").replace(/\/+/g, "/");

	// Remove leading slash if it was created by the normalization
	if (sanitized.startsWith("/")) {
		sanitized = sanitized.substring(1);
	}

	return sanitized;
}

/**
 * Task creation validation schema
 */
export const taskCreateValidationSchema: JsonSchema = {
	type: "object",
	properties: {
		title: {
			type: "string",
			minLength: 1,
			maxLength: 200,
		},
		description: {
			type: "string",
			maxLength: 10000,
		},
		status: {
			type: "string",
		},
		assignee: {
			type: "array",
			items: { type: "string", maxLength: 100 },
		},
		labels: {
			type: "array",
			items: { type: "string", maxLength: 50 },
		},
		priority: {
			type: "string",
			enum: ["high", "medium", "low"],
		},
		acceptanceCriteria: {
			type: "array",
			items: { type: "string", maxLength: 1000 },
		},
		parentTaskId: {
			type: "string",
			maxLength: 50,
		},
	},
	required: ["title"],
};

/**
 * Validates task creation input with status validation
 */
export async function validateTaskCreate(
	input: unknown,
	core?: Core,
): Promise<{ isValid: boolean; errors: string[]; sanitizedData?: Record<string, unknown> }> {
	const result = validateInput(input, taskCreateValidationSchema);

	if (!result.isValid) {
		return result;
	}

	// Additional status validation
	if (result.sanitizedData?.status && core) {
		const validStatuses = await getValidStatuses(core);
		const status = result.sanitizedData.status as string;

		if (!validStatuses.includes(status)) {
			return {
				isValid: false,
				errors: [`Status '${status}' is not valid. Valid statuses: ${validStatuses.join(", ")}`],
			};
		}
	}

	return result;
}

/**
 * Config update validation schema
 */
export const configUpdateValidationSchema: JsonSchema = {
	type: "object",
	properties: {
		key: {
			type: "string",
			minLength: 1,
			maxLength: 100,
		},
		value: {}, // Can be any type
	},
	required: ["key", "value"],
};

/**
 * Validates config update input
 */
export function validateConfigUpdate(input: unknown): ValidationResult {
	const result = validateInput(input, configUpdateValidationSchema);

	if (!result.isValid) {
		return result;
	}

	const key = result.sanitizedData?.key as string;

	// Additional validation based on config key
	if (key && result.sanitizedData?.value !== undefined) {
		const validationError = validateConfigValue(key, result.sanitizedData.value);
		if (validationError) {
			return {
				isValid: false,
				errors: [validationError],
			};
		}
	}

	return result;
}

/**
 * Validates config values based on the config key
 */
function validateConfigValue(key: string, value: unknown): string | null {
	switch (key) {
		case "defaultEditor":
		case "projectName":
		case "defaultStatus":
		case "dateFormat":
		case "timezonePreference": {
			if (typeof value !== "string") {
				return `Config value for '${key}' must be a string`;
			}
			break;
		}
		case "maxColumnWidth":
		case "defaultPort":
		case "activeBranchDays": {
			const numValue = typeof value === "string" ? Number.parseFloat(value) : value;
			if (typeof numValue !== "number" || Number.isNaN(numValue) || numValue < 0) {
				return `Config value for '${key}' must be a positive number`;
			}
			break;
		}
		case "autoOpenBrowser":
		case "remoteOperations":
		case "autoCommit":
		case "bypassGitHooks":
		case "zeroPaddedIds":
		case "checkActiveBranches":
		case "includeDateTimeInDates": {
			if (typeof value !== "boolean") {
				return `Config value for '${key}' must be a boolean`;
			}
			break;
		}
		case "statuses":
		case "labels":
		case "milestones": {
			if (!Array.isArray(value)) {
				return `Config value for '${key}' must be an array`;
			}
			for (const item of value) {
				if (typeof item !== "string") {
					return `All items in '${key}' must be strings`;
				}
			}
			break;
		}
		default: {
			return `Unknown config key: ${key}`;
		}
	}

	return null;
}
