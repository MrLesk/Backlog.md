export type TaskStatus = string;

// Structured Acceptance Criterion (domain-level)
export interface AcceptanceCriterion {
	index: number; // 1-based
	text: string;
	checked: boolean;
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
	readonly rawContent: string; // Raw markdown content without frontmatter (read-only: do not modify directly)
	description?: string;
	implementationPlan?: string;
	implementationNotes?: string;
	/** Structured acceptance criteria parsed from body (checked state + text + index) */
	acceptanceCriteriaItems?: AcceptanceCriterion[];
	parentTaskId?: string;
	subtasks?: string[];
	priority?: "high" | "medium" | "low";
	branch?: string;
	ordinal?: number;
	// Metadata fields (previously in TaskWithMetadata)
	lastModified?: Date;
	source?: "local" | "remote" | "completed";
}

export interface TaskListFilter {
	status?: string;
	assignee?: string;
	priority?: "high" | "medium" | "low";
	parentTaskId?: string;
	milestone?: string;
}

export interface Decision {
	id: string;
	title: string;
	date: string;
	status: "proposed" | "accepted" | "rejected" | "superseded";
	context: string;
	decision: string;
	consequences: string;
	alternatives?: string;
	readonly rawContent: string; // Raw markdown content without frontmatter
}

export interface Document {
	id: string;
	title: string;
	type: "readme" | "guide" | "specification" | "other";
	createdDate: string;
	updatedDate?: string;
	rawContent: string; // Raw markdown content without frontmatter
	tags?: string[];
	// Web UI specific fields
	name?: string;
	path?: string;
	lastModified?: string;
}

export interface Milestone {
	id: string;
	title: string;
	description?: string;
	status?: "planned" | "active" | "completed" | "archived";
	createdDate?: string;
	updatedDate?: string;
	dueDate?: string;
	readonly rawContent: string; // Raw markdown content without frontmatter
}

export type SearchResultType = "task" | "document" | "decision" | "milestone";

export type SearchPriorityFilter = "high" | "medium" | "low";

export interface SearchMatch {
	key?: string;
	indices: Array<[number, number]>;
	value?: unknown;
}

export interface SearchFilters {
	status?: string | string[];
	priority?: SearchPriorityFilter | SearchPriorityFilter[];
}

export interface SearchOptions {
	query?: string;
	limit?: number;
	types?: SearchResultType[];
	filters?: SearchFilters;
}

export interface TaskSearchResult {
	type: "task";
	score: number | null;
	task: Task;
	matches?: SearchMatch[];
}

export interface DocumentSearchResult {
	type: "document";
	score: number | null;
	document: Document;
	matches?: SearchMatch[];
}

export interface DecisionSearchResult {
	type: "decision";
	score: number | null;
	decision: Decision;
	matches?: SearchMatch[];
}

export interface MilestoneSearchResult {
	type: "milestone";
	score: number | null;
	milestone: Milestone;
	matches?: SearchMatch[];
}

export type SearchResult = TaskSearchResult | DocumentSearchResult | DecisionSearchResult | MilestoneSearchResult;

export interface Sequence {
	/** 1-based sequence index */
	index: number;
	/** Tasks that can be executed in parallel within this sequence */
	tasks: Task[];
}

export interface BacklogConfig {
	projectName: string;
	defaultAssignee?: string;
	defaultReporter?: string;
	statuses: string[];
	labels: string[];
	milestones: string[];
	defaultStatus?: string;
	dateFormat: string;
	maxColumnWidth?: number;
	taskResolutionStrategy?: "most_recent" | "most_progressed";
	defaultEditor?: string;
	autoOpenBrowser?: boolean;
	defaultPort?: number;
	remoteOperations?: boolean;
	autoCommit?: boolean;
	zeroPaddedIds?: number;
	timezonePreference?: string; // e.g., 'UTC', 'America/New_York', or 'local'
	includeDateTimeInDates?: boolean; // Whether to include time in new dates
	bypassGitHooks?: boolean;
	checkActiveBranches?: boolean; // Check task states across active branches (default: true)
	activeBranchDays?: number; // How many days a branch is considered active (default: 30)
}

export interface ParsedMarkdown {
	frontmatter: Record<string, unknown>;
	content: string;
}
