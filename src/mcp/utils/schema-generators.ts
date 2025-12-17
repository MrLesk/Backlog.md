import { DEFAULT_STATUSES } from "../../constants/index.ts";
import type { BacklogConfig } from "../../types/index.ts";
import type { JsonSchema } from "../validation/validators.ts";

/**
 * Generates a status field schema with dynamic enum values sourced from config.
 */
export function generateStatusFieldSchema(config: BacklogConfig): JsonSchema {
	const configuredStatuses =
		config.statuses && config.statuses.length > 0 ? [...config.statuses] : [...DEFAULT_STATUSES];
	const defaultStatus = configuredStatuses[0] ?? DEFAULT_STATUSES[0];

	return {
		type: "string",
		maxLength: 100,
		enum: configuredStatuses,
		enumCaseInsensitive: true,
		enumNormalizeWhitespace: true,
		default: defaultStatus,
		description: `Status value (case-insensitive). Valid values: ${configuredStatuses.join(", ")}`,
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
			milestone: {
				type: "string",
				minLength: 1,
				maxLength: 100,
				description: "Optional milestone label (trimmed).",
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
		additionalProperties: false,
	};
}

/**
 * Generates the task_edit input schema with dynamic status enum and MCP-specific operations.
 */
export function generateTaskEditSchema(config: BacklogConfig): JsonSchema {
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
			milestone: {
				type: "string",
				minLength: 1,
				maxLength: 100,
				description: "Set milestone label (string) or clear it (null).",
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
			notesSet: {
				type: "string",
				maxLength: 20000,
			},
			notesAppend: {
				type: "array",
				items: {
					type: "string",
					maxLength: 5000,
				},
				maxItems: 20,
			},
			notesClear: {
				type: "boolean",
			},
			planSet: {
				type: "string",
				maxLength: 20000,
			},
			planAppend: {
				type: "array",
				items: {
					type: "string",
					maxLength: 5000,
				},
				maxItems: 20,
			},
			planClear: {
				type: "boolean",
			},
			acceptanceCriteriaSet: {
				type: "array",
				items: {
					type: "string",
					maxLength: 500,
				},
				maxItems: 50,
			},
			acceptanceCriteriaAdd: {
				type: "array",
				items: {
					type: "string",
					maxLength: 500,
				},
				maxItems: 50,
			},
			acceptanceCriteriaRemove: {
				type: "array",
				items: {
					type: "number",
					minimum: 1,
				},
				maxItems: 50,
			},
			acceptanceCriteriaCheck: {
				type: "array",
				items: {
					type: "number",
					minimum: 1,
				},
				maxItems: 50,
			},
			acceptanceCriteriaUncheck: {
				type: "array",
				items: {
					type: "number",
					minimum: 1,
				},
				maxItems: 50,
			},
		},
		required: ["id"],
		additionalProperties: false,
	};
}
