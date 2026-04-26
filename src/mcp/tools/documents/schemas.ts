import { DOCUMENT_TYPE_VALUES } from "../../../types/index.ts";
import type { JsonSchema } from "../../validation/validators.ts";

const DOCUMENT_TYPE_ENUM = [...DOCUMENT_TYPE_VALUES];

export const documentListSchema: JsonSchema = {
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

export const documentViewSchema: JsonSchema = {
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

export const documentCreateSchema: JsonSchema = {
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
		type: {
			type: "string",
			maxLength: 50,
			enum: DOCUMENT_TYPE_ENUM,
		},
		path: {
			type: "string",
			maxLength: 300,
		},
		tags: {
			type: "array",
			items: { type: "string", maxLength: 100 },
			maxItems: 50,
		},
	},
	required: ["title", "content"],
	additionalProperties: false,
};

export const documentUpdateSchema: JsonSchema = {
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
		type: {
			type: "string",
			maxLength: 50,
			enum: DOCUMENT_TYPE_ENUM,
		},
		path: {
			type: "string",
			maxLength: 300,
		},
		tags: {
			type: "array",
			items: { type: "string", maxLength: 100 },
			maxItems: 50,
		},
	},
	required: ["id", "content"],
	additionalProperties: false,
};

export const documentSearchSchema: JsonSchema = {
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
