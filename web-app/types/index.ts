export type TaskStatus = string;

export interface AcceptanceCriterion {
	index: number; // 1-based
	text: string;
	checked: boolean;
}

export interface AcceptanceCriterionInput {
	text: string;
	checked?: boolean;
}

export interface Task {
	id: string;
	title: string;
	status: TaskStatus;
	assignee: string[];
	reporter?: string;
	createdDate: string;
	updatedDate?: string;
	labels: string[];
	milestone?: string;
	dependencies: string[];
	description?: string;
	implementationPlan?: string;
	implementationNotes?: string;
	acceptanceCriteriaItems?: AcceptanceCriterion[];
	parentTaskId?: string;
	subtasks?: string[];
	priority?: "high" | "medium" | "low";
	ordinal?: number;
	isDraft?: boolean;
	isArchived?: boolean;
	isCompleted?: boolean;
	branch?: string; // For display only (no git in web app, kept for component compat)
}

export interface TaskCreateInput {
	title: string;
	description?: string;
	status?: TaskStatus;
	priority?: "high" | "medium" | "low";
	labels?: string[];
	assignee?: string[];
	dependencies?: string[];
	parentTaskId?: string;
	implementationPlan?: string;
	implementationNotes?: string;
	acceptanceCriteria?: AcceptanceCriterionInput[];
	isDraft?: boolean;
}

export interface TaskUpdateInput {
	title?: string;
	description?: string;
	status?: TaskStatus;
	priority?: "high" | "medium" | "low";
	labels?: string[];
	assignee?: string[];
	ordinal?: number;
	dependencies?: string[];
	implementationPlan?: string;
	implementationNotes?: string;
	acceptanceCriteria?: AcceptanceCriterionInput[];
	/** Alias for acceptanceCriteria used by TaskDetailsModal */
	acceptanceCriteriaItems?: AcceptanceCriterion[];
	isDraft?: boolean;
	isArchived?: boolean;
	isCompleted?: boolean;
}

export interface Document {
	id: string;
	title: string;
	content: string; // Markdown
	createdDate: string;
	updatedDate?: string;
}

export interface Decision {
	id: string;
	title: string;
	status?: string;
	content: string; // Markdown
	createdDate: string;
	updatedDate?: string;
}

export interface BacklogConfig {
	projectName: string;
	statuses: string[];
	labels: string[];
	milestones: string[];
	defaultStatus: string;
}

export type SearchResultType = "task" | "document" | "decision";

export interface TaskSearchResult {
	type: "task";
	task: Task;
}

export interface DocumentSearchResult {
	type: "document";
	document: Document;
}

export interface DecisionSearchResult {
	type: "decision";
	decision: Decision;
}

export type SearchResult = TaskSearchResult | DocumentSearchResult | DecisionSearchResult;

export interface TaskStatistics {
	statusCounts: Record<string, number>;
	priorityCounts: Record<string, number>;
	totalTasks: number;
	completedTasks: number;
	completionPercentage: number;
	draftCount: number;
}
