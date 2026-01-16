import type { TaskUpdateInput } from "../types/index.ts";
import type { TaskEditArgs } from "../types/task-edit-args.ts";
import { normalizeStringList } from "./task-builders.ts";

function sanitizeStringArray(values: string[] | undefined): string[] | undefined {
	if (!values) return undefined;
	const trimmed = values.map((value) => String(value).trim()).filter((value) => value.length > 0);
	return trimmed.length > 0 ? trimmed : undefined;
}

function sanitizeAppend(values: string[] | undefined): string[] | undefined {
	const sanitized = sanitizeStringArray(values);
	if (!sanitized) {
		return undefined;
	}
	return sanitized;
}

function toAcceptanceCriteriaEntries(values: string[] | undefined) {
	if (!values) return undefined;
	const trimmed = values.map((value) => String(value).trim()).filter((value) => value.length > 0);
	if (trimmed.length === 0) {
		return undefined;
	}
	return trimmed.map((text, index) => ({ text, checked: false, index: index + 1 }));
}

export function buildTaskUpdateInput(args: TaskEditArgs): TaskUpdateInput {
	const updateInput: TaskUpdateInput = {};

	if (typeof args.title === "string") {
		updateInput.title = args.title;
	}

	if (typeof args.description === "string") {
		updateInput.description = args.description;
	}

	if (typeof args.status === "string") {
		updateInput.status = args.status;
	}

	if (typeof args.priority === "string") {
		updateInput.priority = args.priority;
	}

	if (args.milestone === null) {
		updateInput.milestone = null;
	} else if (typeof args.milestone === "string") {
		const trimmed = args.milestone.trim();
		updateInput.milestone = trimmed.length > 0 ? trimmed : null;
	}

	if (typeof args.ordinal === "number") {
		updateInput.ordinal = args.ordinal;
	}

	const labels = normalizeStringList(args.labels);
	if (labels) {
		updateInput.labels = labels;
	}

	const addLabels = normalizeStringList(args.addLabels);
	if (addLabels) {
		updateInput.addLabels = addLabels;
	}

	const removeLabels = normalizeStringList(args.removeLabels);
	if (removeLabels) {
		updateInput.removeLabels = removeLabels;
	}

	const assignee = normalizeStringList(args.assignee);
	if (assignee) {
		updateInput.assignee = assignee;
	}

	const dependencies = sanitizeStringArray(args.dependencies);
	if (dependencies) {
		updateInput.dependencies = dependencies;
	}

	const references = sanitizeStringArray(args.references);
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

	const planSet = args.planSet ?? args.implementationPlan;
	if (typeof planSet === "string") {
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
	if (typeof notesSet === "string") {
		updateInput.implementationNotes = notesSet;
	}

	const notesAppends = sanitizeAppend(args.notesAppend);
	if (notesAppends) {
		updateInput.appendImplementationNotes = notesAppends;
	}

	if (args.notesClear) {
		updateInput.clearImplementationNotes = true;
	}

	const criteriaSet = toAcceptanceCriteriaEntries(args.acceptanceCriteriaSet);
	if (criteriaSet) {
		updateInput.acceptanceCriteria = criteriaSet;
	}

	if (Array.isArray(args.acceptanceCriteriaAdd) && args.acceptanceCriteriaAdd.length > 0) {
		const additions = args.acceptanceCriteriaAdd
			.map((text) => String(text).trim())
			.filter((text) => text.length > 0)
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

	return updateInput;
}
