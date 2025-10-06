import { describe, expect, test } from "bun:test";
import {
	generateDraftPromoteSchema,
	generateStatusFieldSchema,
	generateTaskCreateSchema,
	generateTaskUpdateSchema,
} from "../mcp/utils/schema-generators.ts";
import type { BacklogConfig } from "../types/index.ts";

describe("Schema Generators", () => {
	describe("generateStatusFieldSchema", () => {
		test("should generate status field with config values in description", () => {
			const config: Partial<BacklogConfig> = {
				statuses: ["Backlog", "Active", "Complete"],
			};

			const schema = generateStatusFieldSchema(config as unknown as BacklogConfig);

			expect(schema.type).toBe("string");
			expect(schema.description).toContain("Backlog, Active, Complete");
			expect(schema.description).toContain("case-insensitive");
			expect(schema.maxLength).toBe(100);
		});

		test("should use defaults if config missing statuses", () => {
			const config: Partial<BacklogConfig> = {};

			const schema = generateStatusFieldSchema(config as unknown as BacklogConfig);

			expect(schema.description).toContain("To Do, In Progress, Done");
		});

		test("should handle custom 2-status workflow", () => {
			const config: Partial<BacklogConfig> = {
				statuses: ["Todo", "Done"],
			};

			const schema = generateStatusFieldSchema(config as unknown as BacklogConfig);

			expect(schema.description).toContain("Todo, Done");
		});

		test("should handle 5-status workflow", () => {
			const config: Partial<BacklogConfig> = {
				statuses: ["New", "Ready", "In Progress", "Review", "Done"],
			};

			const schema = generateStatusFieldSchema(config as unknown as BacklogConfig);

			expect(schema.description).toContain("New, Ready, In Progress, Review, Done");
		});
	});

	describe("generateTaskCreateSchema", () => {
		test("should generate schema with dynamic status description", () => {
			const config: Partial<BacklogConfig> = {
				statuses: ["New", "Doing", "Done"],
			};

			const schema = generateTaskCreateSchema(config as unknown as BacklogConfig);

			expect(schema.type).toBe("object");
			expect(schema.properties?.status?.description).toContain("New, Doing, Done");
			expect(schema.properties?.title?.type).toBe("string");
			expect(schema.required).toContain("title");
		});

		test("should preserve static enums (priority)", () => {
			const config: Partial<BacklogConfig> = {
				statuses: ["Custom"],
			};

			const schema = generateTaskCreateSchema(config as unknown as BacklogConfig);

			expect(schema.properties?.priority?.enum).toEqual(["high", "medium", "low"]);
		});

		test("should include all expected fields", () => {
			const config: Partial<BacklogConfig> = {
				statuses: ["To Do"],
			};

			const schema = generateTaskCreateSchema(config as unknown as BacklogConfig);

			expect(schema.properties).toHaveProperty("title");
			expect(schema.properties).toHaveProperty("description");
			expect(schema.properties).toHaveProperty("status");
			expect(schema.properties).toHaveProperty("priority");
			expect(schema.properties).toHaveProperty("labels");
			expect(schema.properties).toHaveProperty("assignee");
			expect(schema.properties).toHaveProperty("dependencies");
			expect(schema.properties).toHaveProperty("acceptanceCriteria");
			expect(schema.properties).toHaveProperty("parentTaskId");
		});
	});

	describe("generateTaskUpdateSchema", () => {
		test("should generate schema with dynamic status description", () => {
			const config: Partial<BacklogConfig> = {
				statuses: ["Backlog", "In Flight", "Shipped"],
			};

			const schema = generateTaskUpdateSchema(config as unknown as BacklogConfig);

			expect(schema.type).toBe("object");
			expect(schema.properties?.status?.description).toContain("Backlog, In Flight, Shipped");
			expect(schema.properties?.id?.type).toBe("string");
			expect(schema.required).toContain("id");
		});

		test("should include update-specific fields", () => {
			const config: Partial<BacklogConfig> = {
				statuses: ["To Do"],
			};

			const schema = generateTaskUpdateSchema(config as unknown as BacklogConfig);

			expect(schema.properties).toHaveProperty("id");
			expect(schema.properties).toHaveProperty("title");
			expect(schema.properties).toHaveProperty("description");
			expect(schema.properties).toHaveProperty("status");
			expect(schema.properties).toHaveProperty("priority");
			expect(schema.properties).toHaveProperty("labels");
			expect(schema.properties).toHaveProperty("assignee");
			expect(schema.properties).toHaveProperty("dependencies");
			expect(schema.properties).toHaveProperty("implementationNotes");
		});
	});

	describe("generateDraftPromoteSchema", () => {
		test("should generate schema with dynamic status description", () => {
			const config: Partial<BacklogConfig> = {
				statuses: ["Todo", "Doing", "Done"],
			};

			const schema = generateDraftPromoteSchema(config as unknown as BacklogConfig);

			expect(schema.type).toBe("object");
			expect(schema.properties?.id?.type).toBe("string");
			expect(schema.properties?.status?.description).toContain("Todo, Doing, Done");
			expect(schema.required).toEqual(["id"]);
		});

		test("should work with minimal config", () => {
			const config: Partial<BacklogConfig> = {};

			const schema = generateDraftPromoteSchema(config as unknown as BacklogConfig);

			expect(schema.properties?.status?.description).toContain("To Do, In Progress, Done");
		});
	});

	describe("schema consistency", () => {
		test("all schemas should use same status values in description from config", () => {
			const config: Partial<BacklogConfig> = {
				statuses: ["A", "B", "C"],
			};

			const taskCreate = generateTaskCreateSchema(config as unknown as BacklogConfig);
			const taskUpdate = generateTaskUpdateSchema(config as unknown as BacklogConfig);
			const draftPromote = generateDraftPromoteSchema(config as unknown as BacklogConfig);

			expect(taskCreate.properties?.status?.description).toContain("A, B, C");
			expect(taskUpdate.properties?.status?.description).toContain("A, B, C");
			expect(draftPromote.properties?.status?.description).toContain("A, B, C");
		});
	});
});
