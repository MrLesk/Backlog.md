import type { JsonSchema } from "../../validation/validators.ts";

export const decisionListSchema: JsonSchema = {
	type: "object",
	properties: {
		search: {
			type: "string",
			maxLength: 200,
		},
	},
	required: [],
	additionalProperties: false,
};

export const decisionViewSchema: JsonSchema = {
	type: "object",
	properties: {
		id: {
			type: "string",
			minLength: 1,
			maxLength: 100,
		},
	},
	required: ["id"],
	additionalProperties: false,
};

export const decisionCreateSchema: JsonSchema = {
	type: "object",
	properties: {
		title: {
			type: "string",
			minLength: 1,
			maxLength: 200,
		},
		content: {
			type: "string",
		},
	},
	required: ["title", "content"],
	additionalProperties: false,
};

export const decisionUpdateSchema: JsonSchema = {
	type: "object",
	properties: {
		id: {
			type: "string",
			minLength: 1,
			maxLength: 100,
		},
		title: {
			type: "string",
			minLength: 1,
			maxLength: 200,
		},
		content: {
			type: "string",
		},
	},
	required: ["id", "content"],
	additionalProperties: false,
};

export const decisionSearchSchema: JsonSchema = {
	type: "object",
	properties: {
		query: {
			type: "string",
			minLength: 1,
			maxLength: 200,
		},
		limit: {
			type: "number",
			minimum: 1,
			maximum: 100,
		},
	},
	required: ["query"],
	additionalProperties: false,
};
