import type { JsonSchema } from "../../validation/validators.ts";

const projectSchema: JsonSchema = {
	type: "string",
	minLength: 1,
	maxLength: 100,
	description: "Optional project key from backlog/projects.yml to scope this tool call.",
};

export const definitionOfDoneDefaultsGetSchema: JsonSchema = {
	type: "object",
	properties: {
		project: projectSchema,
	},
	required: [],
	additionalProperties: false,
};

export const definitionOfDoneDefaultsUpsertSchema: JsonSchema = {
	type: "object",
	properties: {
		project: projectSchema,
		items: {
			type: "array",
			items: {
				type: "string",
				maxLength: 500,
			},
			maxItems: 100,
			description:
				"Project-level Definition of Done defaults (replaces existing defaults). New tasks inherit these unless disabled. Items must not contain commas.",
		},
	},
	required: ["items"],
	additionalProperties: false,
};
