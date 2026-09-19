import type { TaskUpdateInput } from "../types/index.ts";
import type { TaskEditArgs } from "../types/task-edit-args.ts";

const SCHEMA_PROPERTY_NAMES = new Set([
	"id",
	"title",
	"description",
	"duedate",
	"status",
	"priority",
	"type",
	"project",
	"milestone",
	"ordinal",
	"labels",
	"addlabels",
	"removelabels",
	"assignee",
	"dependencies",
	"adddependencies",
	"removedependencies",
	"references",
	"addreferences",
	"removereferences",
	"documentation",
	"adddocumentation",
	"removedocumentation",
	"modifiedfiles",
	"implementationplan",
	"planset",
	"planappend",
	"planclear",
	"implementationnotes",
	"notesset",
	"notesappend",
	"notesclear",
	"commentsappend",
	"commentauthor",
	"finalsummary",
	"finalsummaryappend",
	"finalsummaryclear",
	"acceptancecriteria",
	"acceptancecriteriaset",
	"acceptancecriteriaadd",
	"acceptancecriteriaremove",
	"acceptancecriteriacheck",
	"acceptancecriteriauncheck",
	"definitionofdoneadd",
	"definitionofdoneremove",
	"definitionofdonecheck",
	"definitionofdoneuncheck",
	"parenttaskid",
	"disabledefinitionofdonedefaults",
]);

// These are valid, human-written short comments (for example, a reviewer may
// literally ask "status?").  They must not be confused with an echoed field
// declaration merely because the declaration happens to resemble a comment.

/**
 * Identify schema property signatures or TypeScript syntax placeholders that AI agents
 * sometimes echo when serializing tool call payloads (e.g., "planSet?", "acceptanceCriteriaSet?[]", "commentAuthor?:").
 */
export function isSchemaPlaceholder(value: string): boolean {
	const trimmed = value.trim();
	if (trimmed.length === 0) return false;

	// Matches TypeScript optional field syntax e.g. "foo?:", "foo?: string", "foo?[]", "foo?[]: string[]"
	if (/^[a-zA-Z][a-zA-Z0-9_]*\s*(?:\?\[\](?:\s*:\s*.*)?|\?:\s*.*)$/.test(trimmed)) {
		return true;
	}

	// Matches explicit type annotations e.g. "foo: string", "foo: number", "foo: boolean[]"
	if (
		/^[a-zA-Z][a-zA-Z0-9_]*\s*:\s*(?:string|number|boolean|null|undefined|any|unknown|void|never|object|Array<[^>]+>|(?:string|number|boolean|null|undefined)\[\])(?:\s*\|\s*(?:string|number|boolean|null|undefined|any|unknown|void|never|object|Array<[^>]+>|(?:string|number|boolean|null|undefined)\[\]))*$/i.test(
			trimmed,
		)
	) {
		return true;
	}

	// Matches known schema property names with TypeScript modifiers (e.g. "planSet?", "commentsAppend?[]", "notesSet?")
	const match = trimmed.match(/^([a-zA-Z][a-zA-Z0-9_]*)(?:(\?)|(\[\])|(:\s*.*)|(\?:\s*.*))?$/);
	if (match?.[1]) {
		const propName = match[1].toLowerCase();
		if (SCHEMA_PROPERTY_NAMES.has(propName)) {
			if (match[2] || match[3] || match[4] || match[5]) {
				return true;
			}
		}
	}

	return false;
}

function isCommentPlaceholder(value: string): boolean {
	if (!isSchemaPlaceholder(value)) return false;
	const name = value
		.trim()
		.match(/^([a-zA-Z][a-zA-Z0-9_]*)\?$/u)?.[1]
		?.toLowerCase();
	return !(name && SCHEMA_PROPERTY_NAMES.has(name));
}

function sanitizeStringArray(values: string[] | undefined): string[] | undefined {
	if (!values) return undefined;
	const trimmed = values
		.map((value) => String(value).trim())
		.filter((value) => value.length > 0 && !isSchemaPlaceholder(value));
	return trimmed.length > 0 ? trimmed : undefined;
}

/**
 * Resolve a clearable list field: blank-only values are a no-op, an explicit empty array clears the list.
 */
function sanitizeClearableStringArray(values: string[] | undefined): string[] | undefined {
	if (values === undefined) return undefined;
	return sanitizeStringArray(values) ?? (values.length === 0 ? [] : undefined);
}

function sanitizeAppend(values: string[] | undefined): string[] | undefined {
	const sanitized = sanitizeStringArray(values);
	if (!sanitized) {
		return undefined;
	}
	return sanitized;
}

function toAcceptanceCriteriaEntries(values: string[] | undefined) {
	if (values === undefined) return undefined;
	const trimmed = values
		.map((value) => String(value).trim())
		.filter((value) => value.length > 0 && !isSchemaPlaceholder(value));
	return trimmed.length > 0
		? trimmed.map((text, index) => ({ text, checked: false, index: index + 1 }))
		: values.length === 0
			? []
			: undefined;
}

export function buildTaskUpdateInput(args: TaskEditArgs): TaskUpdateInput {
	const updateInput: TaskUpdateInput = {};

	if (typeof args.title === "string" && !isSchemaPlaceholder(args.title)) {
		updateInput.title = args.title;
	}

	if (args.dueDate === null) {
		updateInput.dueDate = null;
	} else if (typeof args.dueDate === "string") {
		if (!isSchemaPlaceholder(args.dueDate)) {
			updateInput.dueDate = args.dueDate.trim().length > 0 ? args.dueDate : null;
		}
	}

	if (typeof args.description === "string" && !isSchemaPlaceholder(args.description)) {
		updateInput.description = args.description;
	}

	if (typeof args.status === "string" && !isSchemaPlaceholder(args.status)) {
		updateInput.status = args.status;
	}

	if (typeof args.priority === "string" && !isSchemaPlaceholder(args.priority)) {
		updateInput.priority = args.priority;
	}

	if (typeof args.type === "string" && !isSchemaPlaceholder(args.type)) {
		updateInput.type = args.type;
	}

	if (typeof args.project === "string" && !isSchemaPlaceholder(args.project)) {
		updateInput.project = args.project;
	}

	if (args.milestone === null) {
		updateInput.milestone = null;
	} else if (typeof args.milestone === "string") {
		if (!isSchemaPlaceholder(args.milestone)) {
			const trimmed = args.milestone.trim();
			updateInput.milestone = trimmed.length > 0 ? trimmed : null;
		}
	}

	if (typeof args.ordinal === "number") {
		updateInput.ordinal = args.ordinal;
	}

	if (args.labels !== undefined) {
		const labels = sanitizeStringArray(args.labels);
		if (labels) {
			updateInput.labels = labels;
		} else if (args.labels.length === 0) {
			updateInput.labels = [];
		}
	}

	const addLabels = sanitizeStringArray(args.addLabels);
	if (addLabels) {
		updateInput.addLabels = addLabels;
	}

	const removeLabels = sanitizeStringArray(args.removeLabels);
	if (removeLabels) {
		updateInput.removeLabels = removeLabels;
	}

	const assignee = sanitizeClearableStringArray(args.assignee);
	if (assignee) {
		updateInput.assignee = assignee;
	}

	const dependencies = sanitizeClearableStringArray(args.dependencies);
	if (dependencies) {
		updateInput.dependencies = dependencies;
	}

	const references = sanitizeClearableStringArray(args.references);
	if (references) {
		updateInput.references = references;
	}

	const addReferences = sanitizeStringArray(args.addReferences);
	if (addReferences) {
		updateInput.addReferences = addReferences;
	}

	const removeReferences = sanitizeStringArray(args.removeReferences);
	if (removeReferences) {
		updateInput.removeReferences = removeReferences;
	}

	const documentation = sanitizeClearableStringArray(args.documentation);
	if (documentation) {
		updateInput.documentation = documentation;
	}

	const addDocumentation = sanitizeStringArray(args.addDocumentation);
	if (addDocumentation) {
		updateInput.addDocumentation = addDocumentation;
	}

	const removeDocumentation = sanitizeStringArray(args.removeDocumentation);
	if (removeDocumentation) {
		updateInput.removeDocumentation = removeDocumentation;
	}

	const modifiedFiles = sanitizeStringArray(args.modifiedFiles);
	if (modifiedFiles || args.modifiedFiles?.length === 0) {
		updateInput.modifiedFiles = modifiedFiles ?? [];
	}

	const planSet = args.planSet ?? args.implementationPlan;
	if (typeof planSet === "string" && !isSchemaPlaceholder(planSet)) {
		updateInput.implementationPlan = planSet;
	}

	const planAppends = sanitizeAppend(args.planAppend);
	if (planAppends) {
		updateInput.appendImplementationPlan = planAppends;
	}

	if (args.planClear) {
		updateInput.clearImplementationPlan = true;
	}

	const notesSet = args.notesSet ?? args.implementationNotes;
	if (typeof notesSet === "string" && !isSchemaPlaceholder(notesSet)) {
		updateInput.implementationNotes = notesSet;
	}

	const notesAppends = sanitizeAppend(args.notesAppend);
	if (notesAppends) {
		updateInput.appendImplementationNotes = notesAppends;
	}

	if (args.notesClear) {
		updateInput.clearImplementationNotes = true;
	}

	const commentsAppends = args.commentsAppend
		?.map((value) => String(value).trim())
		.filter((value) => value.length > 0 && !isCommentPlaceholder(value));
	if (commentsAppends && commentsAppends.length > 0) {
		const author =
			typeof args.commentAuthor === "string" &&
			args.commentAuthor.trim().length > 0 &&
			!isSchemaPlaceholder(args.commentAuthor)
				? args.commentAuthor.trim()
				: undefined;
		updateInput.appendComments = commentsAppends.map((body) => ({
			body,
			...(author && { author }),
		}));
	}

	if (typeof args.finalSummary === "string" && !isSchemaPlaceholder(args.finalSummary)) {
		updateInput.finalSummary = args.finalSummary;
	}

	const finalSummaryAppends = sanitizeAppend(args.finalSummaryAppend);
	if (finalSummaryAppends) {
		updateInput.appendFinalSummary = finalSummaryAppends;
	}

	if (args.finalSummaryClear) {
		updateInput.clearFinalSummary = true;
	}

	const criteriaSet = toAcceptanceCriteriaEntries(args.acceptanceCriteriaSet);
	if (criteriaSet) {
		updateInput.acceptanceCriteria = criteriaSet;
	}

	if (Array.isArray(args.acceptanceCriteriaAdd) && args.acceptanceCriteriaAdd.length > 0) {
		const additions = args.acceptanceCriteriaAdd
			.map((text) => String(text).trim())
			.filter((text) => text.length > 0 && !isSchemaPlaceholder(text))
			.map((text) => ({ text, checked: false }));
		if (additions.length > 0) {
			updateInput.addAcceptanceCriteria = additions;
		}
	}

	if (Array.isArray(args.acceptanceCriteriaRemove) && args.acceptanceCriteriaRemove.length > 0) {
		updateInput.removeAcceptanceCriteria = [...args.acceptanceCriteriaRemove];
	}

	if (Array.isArray(args.acceptanceCriteriaCheck) && args.acceptanceCriteriaCheck.length > 0) {
		updateInput.checkAcceptanceCriteria = [...args.acceptanceCriteriaCheck];
	}

	if (Array.isArray(args.acceptanceCriteriaUncheck) && args.acceptanceCriteriaUncheck.length > 0) {
		updateInput.uncheckAcceptanceCriteria = [...args.acceptanceCriteriaUncheck];
	}

	if (Array.isArray(args.definitionOfDoneAdd) && args.definitionOfDoneAdd.length > 0) {
		const additions = args.definitionOfDoneAdd
			.map((text) => String(text).trim())
			.filter((text) => text.length > 0 && !isSchemaPlaceholder(text))
			.map((text) => ({ text, checked: false }));
		if (additions.length > 0) {
			updateInput.addDefinitionOfDone = additions;
		}
	}

	if (Array.isArray(args.definitionOfDoneRemove) && args.definitionOfDoneRemove.length > 0) {
		updateInput.removeDefinitionOfDone = [...args.definitionOfDoneRemove];
	}

	if (Array.isArray(args.definitionOfDoneCheck) && args.definitionOfDoneCheck.length > 0) {
		updateInput.checkDefinitionOfDone = [...args.definitionOfDoneCheck];
	}

	if (Array.isArray(args.definitionOfDoneUncheck) && args.definitionOfDoneUncheck.length > 0) {
		updateInput.uncheckDefinitionOfDone = [...args.definitionOfDoneUncheck];
	}

	return updateInput;
}
