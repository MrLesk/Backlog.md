export interface TaskEditArgs {
	title?: string;
	description?: string;
	status?: string;
	priority?: "high" | "medium" | "low";
	milestone?: string | null;
	labels?: string[];
	addLabels?: string[];
	removeLabels?: string[];
	assignee?: string[];
	ordinal?: number;
	dependencies?: string[];
	references?: string[];
	addReferences?: string[];
	removeReferences?: string[];
	documentation?: string[];
	addDocumentation?: string[];
	removeDocumentation?: string[];
	modifiedFiles?: string[];
	implementationPlan?: string;
	planSet?: string;
	planAppend?: string[];
	planClear?: boolean;
	implementationNotes?: string;
	notesSet?: string;
	notesAppend?: string[];
	notesClear?: boolean;
	finalSummary?: string;
	finalSummaryAppend?: string[];
	finalSummaryClear?: boolean;
	acceptanceCriteriaSet?: string[];
	acceptanceCriteriaAdd?: string[];
	acceptanceCriteriaRemove?: number[];
	acceptanceCriteriaCheck?: number[];
	acceptanceCriteriaUncheck?: number[];
	definitionOfDoneAdd?: string[];
	definitionOfDoneRemove?: number[];
	definitionOfDoneCheck?: number[];
	definitionOfDoneUncheck?: number[];
	/** Coder agent alias/binary. Pass an empty string to clear it. */
	agent?: string;
	/** Reviewer agent alias/binary. Pass an empty string to clear it. */
	reviewAgent?: string;
}

export type TaskEditRequest = TaskEditArgs & { id: string };
