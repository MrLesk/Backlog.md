/**
 * JSON Schema validator interface
 */
export interface JsonSchema {
	type?: string; // Optional to allow "any type" schemas
	properties?: Record<string, JsonSchema>;
	required?: string[];
	items?: JsonSchema;
	enum?: string[];
	enumCaseInsensitive?: boolean;
	enumNormalizeWhitespace?: boolean;
	minLength?: number;
	maxLength?: number;
	minimum?: number;
	maximum?: number;
	maxItems?: number;
	additionalProperties?: boolean;
	preserveWhitespace?: boolean;
	description?: string;
	default?: unknown;
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

	if (schema.required) {
		for (const field of schema.required) {
			if (!(field in data) || data[field] === undefined || data[field] === null) {
				errors.push(`Required field '${field}' is missing or null`);
			}
		}
	}

	if (schema.properties) {
		for (const [key, value] of Object.entries(data)) {
			const fieldSchema = schema.properties[key];
			if (!fieldSchema) {
				if (schema.additionalProperties === false) {
					errors.push(`Unknown field '${key}' is not allowed`);
				}
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
			let sanitizedResult = sanitizedString;

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
			if (schema.enum) {
				const normalizeValue = (inputValue: string): string => {
					const withoutWhitespace = schema.enumNormalizeWhitespace ? inputValue.replace(/\s+/g, "") : inputValue;
					return schema.enumCaseInsensitive ? withoutWhitespace.toLowerCase() : withoutWhitespace;
				};

				const normalizedCandidate = normalizeValue(sanitizedString);
				let canonicalMatch: string | undefined;

				for (const option of schema.enum) {
					if (normalizeValue(option) === normalizedCandidate) {
						canonicalMatch = option;
						break;
					}
				}

				if (!canonicalMatch) {
					errors.push(`Field '${fieldName}' must be one of: ${schema.enum.join(", ")}`);
				} else {
					sanitizedResult = canonicalMatch;
				}
			}

			return { isValid: errors.length === 0, errors, sanitizedValue: sanitizedResult };
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
function sanitizeString(input: string): string {
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

	return input.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
}
