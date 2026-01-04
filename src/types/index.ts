export type TaskStatus = string;

/**
 * Entity types in the backlog system.
 * Used for ID generation and prefix resolution.
 */
export enum EntityType {
	Task = "task",
	Draft = "draft",
	Document = "document",
	Decision = "decision",
}

// Structured Acceptance Criterion (domain-level)
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
	readonly rawContent?: string; // Raw markdown content without frontmatter (read-only: do not modify directly)
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
	filePath?: string;
	// Metadata fields
	lastModified?: Date;
	source?: "local" | "remote" | "completed" | "local-branch";
	/** Optional per-task callback command to run on status change (overrides global config) */
	onStatusChange?: string;
}

export interface MilestoneBucket {
	key: string;
	label: string;
	milestone?: string;
	isNoMilestone: boolean;
	tasks: Task[];
	statusCounts: Record<string, number>;
	total: number;
	doneCount: number;
	progress: number;
}

export interface MilestoneSummary {
	milestones: string[];
	buckets: MilestoneBucket[];
}

/**
 * Check if a task is locally editable (not from a remote or other local branch)
 */
export function isLocalEditableTask(task: Task): boolean {
	return task.source === undefined || task.source === "local" || task.source === "completed";
}

export interface TaskCreateInput {
	title: string;
	description?: string;
	status?: TaskStatus;
	priority?: "high" | "medium" | "low";
	milestone?: string;
	labels?: string[];
	assignee?: string[];
	dependencies?: string[];
	parentTaskId?: string;
	implementationPlan?: string;
	implementationNotes?: string;
	acceptanceCriteria?: AcceptanceCriterionInput[];
	rawContent?: string;
}

export interface TaskUpdateInput {
	title?: string;
	description?: string;
	status?: TaskStatus;
	priority?: "high" | "medium" | "low";
	milestone?: string | null;
	labels?: string[];
	addLabels?: string[];
	removeLabels?: string[];
	assignee?: string[];
	ordinal?: number;
	dependencies?: string[];
	addDependencies?: string[];
	removeDependencies?: string[];
	implementationPlan?: string;
	appendImplementationPlan?: string[];
	clearImplementationPlan?: boolean;
	implementationNotes?: string;
	appendImplementationNotes?: string[];
	clearImplementationNotes?: boolean;
	acceptanceCriteria?: AcceptanceCriterionInput[];
	addAcceptanceCriteria?: Array<AcceptanceCriterionInput | string>;
	removeAcceptanceCriteria?: number[];
	checkAcceptanceCriteria?: number[];
	uncheckAcceptanceCriteria?: number[];
	rawContent?: string;
}

export interface TaskListFilter {
	status?: string;
	assignee?: string;
	priority?: "high" | "medium" | "low";
	parentTaskId?: string;
	labels?: string[];
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

export interface Milestone {
	id: string;
	title: string;
	description: string;
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

export type SearchResultType = "task" | "document" | "decision";

export type SearchPriorityFilter = "high" | "medium" | "low";

export interface SearchMatch {
	key?: string;
	indices: Array<[number, number]>;
	value?: unknown;
}

export interface SearchFilters {
	status?: string | string[];
	priority?: SearchPriorityFilter | SearchPriorityFilter[];
	assignee?: string | string[];
	labels?: string | string[];
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

export type SearchResult = TaskSearchResult | DocumentSearchResult | DecisionSearchResult;

export interface Sequence {
	/** 1-based sequence index */
	index: number;
	/** Tasks that can be executed in parallel within this sequence */
	tasks: Task[];
}

/**
 * Configuration for ID prefixes used in task and draft files.
 * Allows customization of prefixes (e.g., "JIRA-", "issue-", "bug-").
 */
export interface PrefixConfig {
	/** Prefix for task IDs (default: "task") - produces IDs like task-1, task-2 */
	task: string;
	/** Prefix for draft IDs (default: "draft") - produces IDs like draft-1, draft-2 */
	draft: string;
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
	/** Global callback command to run on any task status change. Supports $TASK_ID, $OLD_STATUS, $NEW_STATUS, $TASK_TITLE variables. */
	onStatusChange?: string;
	/** ID prefix configuration for tasks and drafts. Defaults to { task: "task", draft: "draft" } */
	prefixes?: PrefixConfig;
	mcp?: {
		http?: {
			host?: string;
			port?: number;
			auth?: {
				type?: "bearer" | "basic" | "none";
				token?: string;
				username?: string;
				password?: string;
			};
			cors?: {
				origin?: string | string[];
				credentials?: boolean;
			};
			enableDnsRebindingProtection?: boolean;
			allowedHosts?: string[];
			allowedOrigins?: string[];
		};
	};
}

export interface ParsedMarkdown {
	frontmatter: Record<string, unknown>;
	content: string;
}
