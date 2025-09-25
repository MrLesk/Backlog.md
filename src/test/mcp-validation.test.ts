import { describe, expect, test } from "bun:test";
import { McpValidationError } from "../mcp/errors/mcp-errors.ts";
import {
	type JsonSchema,
	sanitizePath,
	sanitizeString,
	validateConfigUpdate,
	validateInput,
	validateTaskCreate,
} from "../mcp/validation/validators.ts";

describe("JSON Schema Validation", () => {
	test("validateInput should validate required fields", () => {
		const schema: JsonSchema = {
			type: "object",
			properties: {
				title: { type: "string", minLength: 1 },
				count: { type: "number", minimum: 0 },
			},
			required: ["title"],
		};

		// Valid input
		const validResult = validateInput({ title: "Test", count: 5 }, schema);
		expect(validResult.isValid).toBe(true);
		expect(validResult.errors).toHaveLength(0);
		expect(validResult.sanitizedData?.title).toBe("Test");
		expect(validResult.sanitizedData?.count).toBe(5);

		// Missing required field
		const invalidResult = validateInput({ count: 5 }, schema);
		expect(invalidResult.isValid).toBe(false);
		expect(invalidResult.errors).toContain("Required field 'title' is missing or null");
	});

	test("validateInput should validate string fields", () => {
		const schema: JsonSchema = {
			type: "object",
			properties: {
				title: { type: "string", minLength: 3, maxLength: 10 },
				status: { type: "string", enum: ["todo", "done"] },
			},
			required: [],
		};

		// Valid strings
		const validResult = validateInput({ title: "Test", status: "todo" }, schema);
		expect(validResult.isValid).toBe(true);

		// Too short
		const shortResult = validateInput({ title: "Hi" }, schema);
		expect(shortResult.isValid).toBe(false);
		expect(shortResult.errors).toContain("Field 'title' must be at least 3 characters long");

		// Too long (should be rejected)
		const longResult = validateInput({ title: "This is way too long" }, schema);
		expect(longResult.isValid).toBe(false);
		expect(longResult.errors).toContain("Field 'title' exceeds maximum length of 10 characters (20 characters)");

		// Invalid enum
		const enumResult = validateInput({ status: "invalid" }, schema);
		expect(enumResult.isValid).toBe(false);
		expect(enumResult.errors).toContain("Field 'status' must be one of: todo, done");
	});

	test("validateInput should validate number fields", () => {
		const schema: JsonSchema = {
			type: "object",
			properties: {
				count: { type: "number", minimum: 0, maximum: 100 },
			},
			required: [],
		};

		// Valid number
		const validResult = validateInput({ count: 50 }, schema);
		expect(validResult.isValid).toBe(true);
		expect(validResult.sanitizedData?.count).toBe(50);

		// String number (should be converted)
		const stringResult = validateInput({ count: "42" }, schema);
		expect(stringResult.isValid).toBe(true);
		expect(stringResult.sanitizedData?.count).toBe(42);

		// Below minimum
		const minResult = validateInput({ count: -5 }, schema);
		expect(minResult.isValid).toBe(false);
		expect(minResult.errors).toContain("Field 'count' must be at least 0");

		// Above maximum
		const maxResult = validateInput({ count: 150 }, schema);
		expect(maxResult.isValid).toBe(false);
		expect(maxResult.errors).toContain("Field 'count' must be at most 100");

		// Invalid number
		const invalidResult = validateInput({ count: "not-a-number" }, schema);
		expect(invalidResult.isValid).toBe(false);
		expect(invalidResult.errors).toContain("Field 'count' must be a number");
	});

	test("validateInput should validate array fields", () => {
		const schema: JsonSchema = {
			type: "object",
			properties: {
				tags: {
					type: "array",
					items: { type: "string", maxLength: 5 },
				},
			},
			required: [],
		};

		// Valid array
		const validResult = validateInput({ tags: ["one", "two"] }, schema);
		expect(validResult.isValid).toBe(true);
		expect(validResult.sanitizedData?.tags).toEqual(["one", "two"]);

		// Invalid array items
		const invalidResult = validateInput({ tags: ["toolong"] }, schema);
		expect(invalidResult.isValid).toBe(false);
		expect(invalidResult.errors).toContain("Field 'tags[0]' exceeds maximum length of 5 characters (7 characters)");

		// Not an array
		const notArrayResult = validateInput({ tags: "not-array" }, schema);
		expect(notArrayResult.isValid).toBe(false);
		expect(notArrayResult.errors).toContain("Field 'tags' must be an array");
	});

	test("validateInput should validate boolean fields", () => {
		const schema: JsonSchema = {
			type: "object",
			properties: {
				enabled: { type: "boolean" },
			},
			required: [],
		};

		// Valid boolean
		const validResult = validateInput({ enabled: true }, schema);
		expect(validResult.isValid).toBe(true);
		expect(validResult.sanitizedData?.enabled).toBe(true);

		// String boolean (should be converted)
		const stringResult = validateInput({ enabled: "false" }, schema);
		expect(stringResult.isValid).toBe(true);
		expect(stringResult.sanitizedData?.enabled).toBe(false);

		// Truthy value
		const truthyResult = validateInput({ enabled: 1 }, schema);
		expect(truthyResult.isValid).toBe(true);
		expect(truthyResult.sanitizedData?.enabled).toBe(true);
	});

	test("validateInput should ignore unknown fields", () => {
		const schema: JsonSchema = {
			type: "object",
			properties: {
				title: { type: "string" },
			},
			required: [],
		};

		const result = validateInput({ title: "Test", unknown: "ignored" }, schema);
		expect(result.isValid).toBe(true);
		expect(result.sanitizedData?.title).toBe("Test");
		expect(result.sanitizedData?.unknown).toBeUndefined();
	});

	test("validateInput should reject non-object input", () => {
		const schema: JsonSchema = { type: "object", properties: {}, required: [] };

		const stringResult = validateInput("not an object", schema);
		expect(stringResult.isValid).toBe(false);
		expect(stringResult.errors).toContain("Input must be an object");

		const nullResult = validateInput(null, schema);
		expect(nullResult.isValid).toBe(false);
		expect(nullResult.errors).toContain("Input must be an object");
	});
});

describe("String Sanitization", () => {
	test("sanitizeString should remove null bytes", () => {
		const input = "Hello\x00World";
		const result = sanitizeString(input);
		expect(result).toBe("HelloWorld");
	});

	test("sanitizeString should trim whitespace", () => {
		const input = "  Hello World  ";
		const result = sanitizeString(input);
		expect(result).toBe("Hello World");
	});

	test("sanitizeString should normalize line endings", () => {
		const input = "Line1\r\nLine2\rLine3\nLine4";
		const result = sanitizeString(input);
		expect(result).toBe("Line1\nLine2\nLine3\nLine4");
	});

	test("sanitizeString should handle non-strings", () => {
		const result = sanitizeString(123 as unknown as string);
		expect(result).toBe("123");
	});
});

describe("Path Sanitization", () => {
	test("sanitizePath should prevent directory traversal", () => {
		const input = "../../../etc/passwd";
		const result = sanitizePath(input);
		expect(result).toBe("etc/passwd");
	});

	test("sanitizePath should normalize slashes", () => {
		const input = "path//to///file";
		const result = sanitizePath(input);
		expect(result).toBe("path/to/file");
	});

	test("sanitizePath should reject absolute paths", () => {
		expect(() => sanitizePath("/etc/passwd")).toThrow(McpValidationError);
		expect(() => sanitizePath("/home/user")).toThrow(McpValidationError);
	});

	test("sanitizePath should remove null bytes", () => {
		const input = "path\x00/to/file";
		const result = sanitizePath(input);
		expect(result).toBe("path/to/file");
	});

	test("sanitizePath should reject non-strings", () => {
		expect(() => sanitizePath(123 as unknown as string)).toThrow(McpValidationError);
	});
});

describe("Task Creation Validation", () => {
	test("validateTaskCreate should validate basic task input", async () => {
		const input = {
			title: "Test Task",
			description: "A test task",
			labels: ["test"],
			priority: "high",
		};

		const result = await validateTaskCreate(input);
		expect(result.isValid).toBe(true);
		expect(result.sanitizedData?.title).toBe("Test Task");
	});

	test("validateTaskCreate should enforce title requirement", async () => {
		const input = {
			description: "Missing title",
		};

		const result = await validateTaskCreate(input);
		expect(result.isValid).toBe(false);
		expect(result.errors).toContain("Required field 'title' is missing or null");
	});

	test("validateTaskCreate should validate priority enum", async () => {
		const input = {
			title: "Test Task",
			priority: "invalid",
		};

		const result = await validateTaskCreate(input);
		expect(result.isValid).toBe(false);
		expect(result.errors).toContain("Field 'priority' must be one of: high, medium, low");
	});

	test("validateTaskCreate should enforce length limits", async () => {
		const input = {
			title: "A".repeat(300), // Too long
		};

		const result = await validateTaskCreate(input);
		expect(result.isValid).toBe(false);
		expect(result.errors).toContain("Field 'title' exceeds maximum length of 200 characters (300 characters)");
	});
});

describe("Config Update Validation", () => {
	test("validateConfigUpdate should validate key requirement", () => {
		const input = {
			value: "test",
		};

		const result = validateConfigUpdate(input);
		expect(result.isValid).toBe(false);
		expect(result.errors).toContain("Required field 'key' is missing or null");
	});

	test("validateConfigUpdate should validate string config values", () => {
		const input = {
			key: "defaultEditor",
			value: "vim",
		};

		const result = validateConfigUpdate(input);
		expect(result.isValid).toBe(true);
	});

	test("validateConfigUpdate should validate numeric config values", () => {
		const input = {
			key: "maxColumnWidth",
			value: 80,
		};

		const result = validateConfigUpdate(input);
		expect(result.isValid).toBe(true);
	});

	test("validateConfigUpdate should validate boolean config values", () => {
		const input = {
			key: "autoOpenBrowser",
			value: true,
		};

		const result = validateConfigUpdate(input);
		expect(result.isValid).toBe(true);
	});

	test("validateConfigUpdate should validate array config values", () => {
		const input = {
			key: "statuses",
			value: ["Todo", "In Progress", "Done"],
		};

		const result = validateConfigUpdate(input);
		expect(result.isValid).toBe(true);
	});

	test("validateConfigUpdate should reject invalid config keys", () => {
		const input = {
			key: "unknownConfig",
			value: "test",
		};

		const result = validateConfigUpdate(input);
		expect(result.isValid).toBe(false);
		expect(result.errors).toContain("Unknown config key: unknownConfig");
	});

	test("validateConfigUpdate should validate type mismatches", () => {
		const input = {
			key: "maxColumnWidth",
			value: "not-a-number",
		};

		const result = validateConfigUpdate(input);
		expect(result.isValid).toBe(false);
		expect(result.errors).toContain("Config value for 'maxColumnWidth' must be a positive number");
	});
});
