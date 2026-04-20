import type { JsonSchema } from "../../validation/validators.ts";

const projectSchema: JsonSchema = {
	type: "string",
	minLength: 1,
	maxLength: 100,
	description: "Optional project key from backlog/projects.yml to scope this tool call.",
};

export const documentListSchema: JsonSchema = {
	type: "object",
	properties: {
		project: projectSchema,
		search: {
			type: "string",
			maxLength: 200,
		},
	},
	required: [],
	additionalProperties: false,
};

export const documentViewSchema: JsonSchema = {
	type: "object",
	properties: {
		project: projectSchema,
		id: {
			type: "string",
			minLength: 1,
			maxLength: 100,
		},
	},
	required: ["id"],
	additionalProperties: false,
};

export const documentCreateSchema: JsonSchema = {
	type: "object",
	properties: {
		project: projectSchema,
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

export const documentUpdateSchema: JsonSchema = {
	type: "object",
	properties: {
		project: projectSchema,
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

export const documentSearchSchema: JsonSchema = {
	type: "object",
	properties: {
		project: projectSchema,
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
