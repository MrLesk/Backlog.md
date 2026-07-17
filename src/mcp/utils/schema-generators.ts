import { DEFAULT_STATUSES } from "../../constants/index.ts";
import type { BacklogConfig } from "../../types/index.ts";
import type { JsonSchema } from "../validation/validators.ts";

/**
 * Generates a status field schema with dynamic enum values sourced from config.
 */
export function generateStatusFieldSchema(config: BacklogConfig): JsonSchema {
	const configuredStatuses =
		config.statuses && config.statuses.length > 0 ? [...config.statuses] : [...DEFAULT_STATUSES];
	const normalizedStatuses = configuredStatuses.map((status) => status.trim());
	const hasDraft = normalizedStatuses.some((status) => status.toLowerCase() === "draft");
	const enumStatuses = hasDraft ? normalizedStatuses : ["Draft", ...normalizedStatuses];
	const defaultStatus = normalizedStatuses[0] ?? DEFAULT_STATUSES[0];

	return {
		type: "string",
		maxLength: 100,
		enum: enumStatuses,
		enumCaseInsensitive: true,
		enumNormalizeWhitespace: true,
		default: defaultStatus,
		description: `Status value (case-insensitive). Valid values: ${enumStatuses.join(", ")}`,
	};
}

/**
 * Generates an agent-field schema for the `agent` / `reviewAgent` task fields.
 * When the project configures named agents, the field becomes a case-insensitive
 * enum of their aliases so the orchestrator can't typo or invent an alias; the
 * description spells out each alias -> binary mapping. With no configured agents
 * it's a free-text string holding a raw CLI binary name.
 */
export function generateAgentFieldSchema(config: BacklogConfig, role: "agent" | "reviewAgent"): JsonSchema {
	const roleText =
		role === "agent"
			? "Agent to run as the coder when this task enters In Progress"
			: "Agent to run as the reviewer when this task enters In Review (falls back to `agent` when unset)";
	const agents = (config.agents ?? []).filter((a) => a?.alias && a.alias.trim().length > 0);
	if (agents.length > 0) {
		const aliases = agents.map((a) => a.alias.trim());
		const mapping = agents.map((a) => `${a.alias.trim()} (${a.binary})`).join(", ");
		return {
			type: "string",
			maxLength: 100,
			enum: aliases,
			enumCaseInsensitive: true,
			description: `${roleText}. Use one of the configured agent aliases: ${mapping}.`,
		};
	}
	return {
		type: "string",
		maxLength: 100,
		description: `${roleText}. No named agents are configured, so pass a raw CLI binary name (e.g. claude, codex, opencode).`,
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
			ordinal: {
				type: "number",
				minimum: 0,
				description:
					"Optional non-negative ordering value for manual task ordering. Lower values sort earlier. Prefer spaced integers such as 1000, 2000, 3000 to leave room for inserts.",
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
			references: {
				type: "array",
				items: {
					type: "string",
					maxLength: 500,
				},
				description: "Reference URLs or file paths related to this task",
			},
			documentation: {
				type: "array",
				items: {
					type: "string",
					maxLength: 500,
				},
				description: "Documentation URLs or file paths for understanding this task",
			},
			modifiedFiles: {
				type: "array",
				items: {
					type: "string",
					maxLength: 500,
				},
				description: "Project-root-relative file paths modified by this task",
			},
			finalSummary: {
				type: "string",
				maxLength: 20000,
				description: "Final summary for PR-style completion notes. Write this only when the task is complete.",
			},
			acceptanceCriteria: {
				type: "array",
				items: {
					type: "string",
					maxLength: 500,
				},
			},
			definitionOfDoneAdd: {
				type: "array",
				items: {
					type: "string",
					maxLength: 500,
				},
				description:
					"Task-specific Definition of Done items to append for this task only. Do not copy project defaults here.",
			},
			disableDefinitionOfDoneDefaults: {
				type: "boolean",
				description:
					"Disable project-level Definition of Done defaults for this task creation. Use definition_of_done_defaults_upsert to change project defaults.",
			},
			parentTaskId: {
				type: "string",
				maxLength: 50,
			},
			agent: generateAgentFieldSchema(config, "agent"),
			reviewAgent: generateAgentFieldSchema(config, "reviewAgent"),
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
			ordinal: {
				type: "number",
				minimum: 0,
				description:
					"Set task ordinal for manual ordering. Lower values sort earlier. Prefer spaced integers such as 1000, 2000, 3000 to leave room for inserts.",
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
			references: {
				type: "array",
				items: {
					type: "string",
					maxLength: 500,
				},
				description: "Set reference URLs or file paths (replaces existing)",
			},
			addReferences: {
				type: "array",
				items: {
					type: "string",
					maxLength: 500,
				},
				description: "Add reference URLs or file paths",
			},
			removeReferences: {
				type: "array",
				items: {
					type: "string",
					maxLength: 500,
				},
				description: "Remove reference URLs or file paths",
			},
			documentation: {
				type: "array",
				items: {
					type: "string",
					maxLength: 500,
				},
				description: "Set documentation URLs or file paths (replaces existing)",
			},
			addDocumentation: {
				type: "array",
				items: {
					type: "string",
					maxLength: 500,
				},
				description: "Add documentation URLs or file paths",
			},
			removeDocumentation: {
				type: "array",
				items: {
					type: "string",
					maxLength: 500,
				},
				description: "Remove documentation URLs or file paths",
			},
			modifiedFiles: {
				type: "array",
				items: {
					type: "string",
					maxLength: 500,
				},
				description: "Set project-root-relative modified file paths (replaces existing)",
			},
			implementationNotes: {
				type: "string",
				maxLength: 10000,
			},
			finalSummary: {
				type: "string",
				maxLength: 20000,
				description: "Final summary for PR-style completion notes. Write this only when the task is complete.",
			},
			finalSummaryAppend: {
				type: "array",
				items: {
					type: "string",
					maxLength: 5000,
				},
				maxItems: 20,
			},
			finalSummaryClear: {
				type: "boolean",
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
			definitionOfDoneAdd: {
				type: "array",
				items: {
					type: "string",
					maxLength: 500,
				},
				maxItems: 50,
				description:
					"Task-specific Definition of Done items to add for this task only. Use definition_of_done_defaults_upsert to change project defaults.",
			},
			definitionOfDoneRemove: {
				type: "array",
				items: {
					type: "number",
					minimum: 1,
				},
				maxItems: 50,
				description: "Remove task-specific Definition of Done items by 1-based index on this task.",
			},
			definitionOfDoneCheck: {
				type: "array",
				items: {
					type: "number",
					minimum: 1,
				},
				maxItems: 50,
				description: "Mark task-specific Definition of Done items as complete by 1-based index on this task.",
			},
			definitionOfDoneUncheck: {
				type: "array",
				items: {
					type: "number",
					minimum: 1,
				},
				maxItems: 50,
				description: "Mark task-specific Definition of Done items as incomplete by 1-based index on this task.",
			},
			agent: generateAgentFieldSchema(config, "agent"),
			reviewAgent: generateAgentFieldSchema(config, "reviewAgent"),
		},
		required: ["id"],
		additionalProperties: false,
	};
}
