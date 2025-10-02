import { DEFAULT_STATUSES } from "../../constants/index.ts";
import type { BacklogConfig } from "../../types/index.ts";
import type { JsonSchema } from "../validation/validators.ts";

/**
 * Generates a status field schema with dynamic values shown in description
 *
 * Note: We use description instead of enum to allow the custom validator
 * to perform case-insensitive normalization. The schema validation happens
 * before custom validation, so a strict enum would block normalization.
 */
export function generateStatusFieldSchema(config: BacklogConfig): JsonSchema {
	const statuses = config.statuses || DEFAULT_STATUSES;

	return {
		type: "string",
		maxLength: 100,
		description: `Status value (case-insensitive). Valid values: ${statuses.join(", ")}`,
	};
}

/**
 * Generates the task_create input schema with dynamic status enum
 */
export function generateTaskCreateSchema(config: BacklogConfig): JsonSchema {
	return {
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
			status: generateStatusFieldSchema(config),
			priority: {
				type: "string",
				enum: ["high", "medium", "low"],
			},
			labels: {
				type: "array",
				items: {
					type: "string",
					maxLength: 50,
				},
			},
			assignee: {
				type: "array",
				items: {
					type: "string",
					maxLength: 100,
				},
			},
			dependencies: {
				type: "array",
				items: {
					type: "string",
					maxLength: 50,
				},
			},
			acceptanceCriteria: {
				type: "array",
				items: {
					type: "string",
					maxLength: 500,
				},
			},
			parentTaskId: {
				type: "string",
				maxLength: 50,
			},
		},
		required: ["title"],
	};
}

/**
 * Generates the task_update input schema with dynamic status enum
 */
export function generateTaskUpdateSchema(config: BacklogConfig): JsonSchema {
	return {
		type: "object",
		properties: {
			id: {
				type: "string",
				minLength: 1,
				maxLength: 50,
			},
			title: {
				type: "string",
				maxLength: 200,
			},
			description: {
				type: "string",
				maxLength: 10000,
			},
			status: generateStatusFieldSchema(config),
			priority: {
				type: "string",
				enum: ["high", "medium", "low"],
			},
			labels: {
				type: "array",
				items: {
					type: "string",
					maxLength: 50,
				},
			},
			assignee: {
				type: "array",
				items: {
					type: "string",
					maxLength: 100,
				},
			},
			dependencies: {
				type: "array",
				items: {
					type: "string",
					maxLength: 50,
				},
			},
			implementationNotes: {
				type: "string",
				maxLength: 10000,
			},
		},
		required: ["id"],
	};
}

/**
 * Generates the draft_promote input schema with dynamic status enum
 */
export function generateDraftPromoteSchema(config: BacklogConfig): JsonSchema {
	return {
		type: "object",
		properties: {
			id: {
				type: "string",
				minLength: 1,
				maxLength: 50,
			},
			status: generateStatusFieldSchema(config),
		},
		required: ["id"],
	};
}
