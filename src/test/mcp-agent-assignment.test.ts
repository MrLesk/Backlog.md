import { describe, expect, it } from "bun:test";
import type { BacklogConfig } from "../types/index.ts";
import { validateInput } from "../mcp/validation/validators.ts";
import {
	generateAgentFieldSchema,
	generateTaskCreateSchema,
	generateTaskEditSchema,
} from "../mcp/utils/schema-generators.ts";
import { buildTaskUpdateInput } from "../utils/task-edit-builder.ts";

const baseConfig = (overrides: Partial<BacklogConfig> = {}): BacklogConfig => ({
	projectName: "Test Project",
	statuses: ["To Do", "In Progress", "In Review", "Human Review", "Done"],
	labels: [],
	dateFormat: "yyyy-mm-dd",
	...overrides,
});

const withAgents = () =>
	baseConfig({
		agents: [
			{ alias: "Claudio", binary: "claude", model: "opus" },
			{ alias: "Godex", binary: "codex" },
		],
	});

describe("MCP agent-field schema", () => {
	it("exposes agent + reviewAgent on both create and edit schemas", () => {
		for (const schema of [generateTaskCreateSchema(withAgents()), generateTaskEditSchema(withAgents())]) {
			// biome-ignore lint/suspicious/noExplicitAny: reaching into the generated JSON schema
			const props = (schema as any).properties;
			expect(props.agent).toBeDefined();
			expect(props.reviewAgent).toBeDefined();
		}
	});

	it("is a case-insensitive enum of the configured aliases", () => {
		const schema = generateAgentFieldSchema(withAgents(), "agent");
		expect(schema.enum).toEqual(["Claudio", "Godex"]);
		expect(schema.enumCaseInsensitive).toBe(true);
		expect(schema.description).toContain("Claudio (claude)");
		expect(schema.description).toContain("Godex (codex)");
	});

	it("is free text when no agents are configured", () => {
		const schema = generateAgentFieldSchema(baseConfig(), "reviewAgent");
		expect(schema.enum).toBeUndefined();
		expect(schema.type).toBe("string");
	});
});

describe("MCP agent-field validation", () => {
	it("accepts a configured alias regardless of case and canonicalizes it", () => {
		const schema = generateTaskCreateSchema(withAgents());
		const result = validateInput({ title: "Do the thing", agent: "claudio" }, schema);
		expect(result.isValid).toBe(true);
		expect(result.sanitizedData?.agent).toBe("Claudio");
	});

	it("rejects an alias that is not in the config", () => {
		const schema = generateTaskCreateSchema(withAgents());
		const result = validateInput({ title: "Do the thing", agent: "Nonexistent" }, schema);
		expect(result.isValid).toBe(false);
		expect(result.errors.join(" ")).toContain("Claudio");
	});
});

describe("buildTaskUpdateInput agent mapping", () => {
	it("passes agent + reviewAgent through when present", () => {
		expect(buildTaskUpdateInput({ agent: "Claudio", reviewAgent: "Godex" })).toMatchObject({
			agent: "Claudio",
			reviewAgent: "Godex",
		});
	});

	it("passes an empty string through so the core edit clears the field", () => {
		expect(buildTaskUpdateInput({ agent: "" })).toEqual({ agent: "" });
	});

	it("leaves the fields untouched when not provided", () => {
		const update = buildTaskUpdateInput({ title: "x" });
		expect(update).not.toHaveProperty("agent");
		expect(update).not.toHaveProperty("reviewAgent");
	});
});
