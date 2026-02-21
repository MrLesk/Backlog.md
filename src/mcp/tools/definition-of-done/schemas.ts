import type { JsonSchema } from "../../validation/validators.ts";

export const definitionOfDoneDefaultsGetSchema: JsonSchema = {
	type: "object",
	properties: {},
	required: [],
	additionalProperties: false,
};

export const definitionOfDoneDefaultsUpsertSchema: JsonSchema = {
	type: "object",
	properties: {
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
