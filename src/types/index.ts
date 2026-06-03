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
	references?: string[];
	documentation?: string[];
	modifiedFiles?: string[];
	readonly rawContent?: string; // Raw markdown content without frontmatter (read-only: do not modify directly)
	description?: string;
	implementationPlan?: string;
	implementationNotes?: string;
	finalSummary?: string;
	/** Structured acceptance criteria parsed from body (checked state + text + index) */
	acceptanceCriteriaItems?: AcceptanceCriterion[];
	/** Structured Definition of Done checklist parsed from body (checked state + text + index) */
	definitionOfDoneItems?: AcceptanceCriterion[];
	parentTaskId?: string;
	parentTaskTitle?: string;
	subtasks?: string[];
	subtaskSummaries?: Array<{ id: string; title: string }>;
	priority?: "high" | "medium" | "low";
	branch?: string;
	ordinal?: number;
	filePath?: string;
	// Metadata fields
	lastModified?: Date;
	source?: "local" | "remote" | "completed" | "local-branch";
	/** Optional per-task callback command to run on status change (overrides global config) */
	onStatusChange?: string;
	/** Agent CLI to use when this task moves to "In Progress" (e.g. "claude", "codex", "opencode"). Falls back to global dispatch default when absent. */
	agent?: string;
	/** Agent CLI to use when this task moves to "In Review". Falls back to `agent` when absent, then to global dispatch default. */
	reviewAgent?: string;
}

export interface MilestoneBucket {
	key: string;
	label: string;
	milestone?: string;
	isNoMilestone: boolean;
	isCompleted: boolean;
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
	ordinal?: number;
	milestone?: string;
	labels?: string[];
	assignee?: string[];
	dependencies?: string[];
	references?: string[];
	documentation?: string[];
	modifiedFiles?: string[];
	parentTaskId?: string;
	implementationPlan?: string;
	implementationNotes?: string;
	finalSummary?: string;
	acceptanceCriteria?: AcceptanceCriterionInput[];
	definitionOfDoneAdd?: string[];
	disableDefinitionOfDoneDefaults?: boolean;
	rawContent?: string;
	/** Per-task status-change hook command. See BacklogConfig.onStatusChange for global default. */
	onStatusChange?: string;
	/** Agent CLI to invoke as the coder (e.g. "claude", "codex", "opencode"). */
	agent?: string;
	/** Agent CLI to invoke as the reviewer. Defaults to `agent` when absent. */
	reviewAgent?: string;
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
	references?: string[];
	addReferences?: string[];
	removeReferences?: string[];
	documentation?: string[];
	addDocumentation?: string[];
	removeDocumentation?: string[];
	modifiedFiles?: string[];
	implementationPlan?: string;
	appendImplementationPlan?: string[];
	clearImplementationPlan?: boolean;
	implementationNotes?: string;
	appendImplementationNotes?: string[];
	clearImplementationNotes?: boolean;
	finalSummary?: string;
	appendFinalSummary?: string[];
	clearFinalSummary?: boolean;
	acceptanceCriteria?: AcceptanceCriterionInput[];
	addAcceptanceCriteria?: Array<AcceptanceCriterionInput | string>;
	removeAcceptanceCriteria?: number[];
	checkAcceptanceCriteria?: number[];
	uncheckAcceptanceCriteria?: number[];
	addDefinitionOfDone?: Array<AcceptanceCriterionInput | string>;
	removeDefinitionOfDone?: number[];
	checkDefinitionOfDone?: number[];
	uncheckDefinitionOfDone?: number[];
	rawContent?: string;
	/** Per-task status-change hook command. Pass `null` or an empty string to clear the override and fall back to the global setting. */
	onStatusChange?: string | null;
	/** Agent CLI to invoke as the coder. Pass `null` or empty to clear. */
	agent?: string | null;
	/** Agent CLI to invoke as the reviewer. Pass `null` or empty to clear. */
	reviewAgent?: string | null;
}

export interface TaskListFilter {
	status?: string;
	assignee?: string;
	priority?: "high" | "medium" | "low";
	milestone?: string;
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

export const DOCUMENT_TYPE_VALUES = ["readme", "guide", "specification", "other"] as const;
export type DocumentType = (typeof DOCUMENT_TYPE_VALUES)[number];

export interface Document {
	id: string;
	title: string;
	type: DocumentType;
	createdDate: string;
	updatedDate?: string;
	rawContent: string; // Raw markdown content without frontmatter
	tags?: string[];
	// Web UI specific fields
	name?: string;
	path?: string;
	lastModified?: string;
}

export interface DocumentCreateInput {
	title: string;
	content?: string;
	type?: Document["type"];
	path?: string;
	tags?: string[];
}

export interface DocumentUpdateInput {
	id: string;
	content: string;
	title?: string;
	type?: Document["type"];
	path?: string | null;
	tags?: string[];
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
	modifiedFiles?: string | string[];
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
 * Configuration for ID prefixes used in task files.
 * Allows customization of task prefix (e.g., "JIRA-", "issue-", "bug-").
 * Note: Draft prefix is always "draft" and not configurable.
 */
export interface PrefixConfig {
	/** Prefix for task IDs (default: "task") - produces IDs like TASK-1, TASK-2 */
	task: string;
}

/**
 * A named agent entry in the project config. `alias` is the friendly name
 * shown in the UI and stored in task frontmatter; `binary` is the CLI
 * command the dispatcher launches (claude, codex, opencode, or a path).
 */
export interface AgentConfig {
	/** Friendly name shown in the UI (e.g. "Claudio", "Godex", "Chato"). */
	alias: string;
	/** CLI binary to launch (claude | codex | opencode | absolute path). */
	binary: string;
	/** Optional model alias passed to the agent (claude only, e.g. "sonnet", "opus"). Falls back to the agent's default when absent. */
	model?: string;
	/** Optional effort level passed to the agent (claude only, e.g. "low", "medium", "high"). Falls back to the agent's default when absent. */
	effort?: string;
}

export interface BoardColumnConfig {
	/** Status name (must match an entry in BacklogConfig.statuses). */
	status: string;
	/** Optional CSS color string (hex, rgb, or named) for the column heading accent. */
	color?: string;
}

/**
 * Configurable data fields that can appear on a kanban task card. The set
 * is intentionally closed — adding a new option later is a code change,
 * not user config. The order here is documentation only; the actual
 * render order is pinned inside TaskCard.tsx (header-left → header-right
 * → body-milestone → body-labels → footer-left → footer-right) and the
 * UI exposes visibility toggles, not reordering.
 *
 * Always-on card chrome (title, cross-branch banner/tooltip, priority
 * border accent, drag-state visuals) is rendered unconditionally and is
 * NOT part of this enum — those elements aren't user-configurable.
 */
export const CONFIGURABLE_CARD_FIELDS = ["id", "priority", "milestone", "labels", "createdDate", "assignee", "agent", "reviewAgent"] as const;
export type ConfigurableCardField = (typeof CONFIGURABLE_CARD_FIELDS)[number];

export interface CardConfig {
	/**
	 * Fields to hide from every task card. An empty array (or undefined
	 * `card`) means "show all fields"; "milestone" renders only for tasks
	 * that actually have a milestone value. Entries not in the
	 * {@link CONFIGURABLE_CARD_FIELDS} set are ignored on load.
	 */
	hide?: ConfigurableCardField[];
}

export interface BoardConfig {
	/**
	 * Ordered list of columns to render on the kanban board.
	 *
	 * Three distinct states:
	 *  - `columns` absent (or `BoardConfig` itself absent): no override,
	 *    every entry in `BacklogConfig.statuses` renders as a column.
	 *  - `columns: []`: explicit "hide every column" — the kanban renders
	 *    zero columns. Tasks remain reachable from list views.
	 *  - `columns: [...]`: the listed statuses render as columns in the
	 *    given order, with their colors. Statuses present in
	 *    `BacklogConfig.statuses` but absent from this list are hidden
	 *    from the board (but remain editable and visible elsewhere).
	 */
	columns?: BoardColumnConfig[];
	/** Optional per-card field visibility config. See {@link CardConfig}. */
	card?: CardConfig;
}

export interface BacklogConfig {
	projectName: string;
	defaultAssignee?: string;
	defaultReporter?: string;
	statuses: string[];
	labels: string[];
	/** @deprecated Milestones are sourced from milestone files, not config. */
	milestones?: string[];
	definitionOfDone?: string[];
	defaultStatus?: string;
	dateFormat: string;
	maxColumnWidth?: number;
	taskResolutionStrategy?: "most_recent" | "most_progressed";
	defaultEditor?: string;
	autoOpenBrowser?: boolean;
	defaultPort?: number;
	remoteOperations?: boolean;
	autoCommit?: boolean;
	/** Disable all Git integration for filesystem-only projects. */
	filesystemOnly?: boolean;
	zeroPaddedIds?: number;
	includeDateTimeInDates?: boolean; // Whether to include time in new dates
	bypassGitHooks?: boolean;
	checkActiveBranches?: boolean; // Check task states across active branches (default: true)
	activeBranchDays?: number; // How many days a branch is considered active (default: 30)
	/** Project-relative backlog folder when config is stored at project root in backlog.config.yml. */
	backlogDirectory?: string;
	/** Global callback command to run on any task status change. Supports $TASK_ID, $OLD_STATUS, $NEW_STATUS, $TASK_TITLE variables. */
	onStatusChange?: string;
	/**
	 * Shell used to execute onStatusChange. Accepted values: "auto" (default — sh on POSIX, sh.exe→cmd.exe fallback on Windows),
	 * "sh", "bash", "cmd", "pwsh", "powershell", or an absolute path to an interpreter (treated as POSIX-style `-c`).
	 */
	shell?: string;
	/** ID prefix configuration for tasks and drafts. Defaults to { task: "task", draft: "draft" } */
	prefixes?: PrefixConfig;
	/**
	 * Optional kanban board customization. When omitted, every entry in
	 * {@link BacklogConfig.statuses} renders as a column with the default
	 * color and the rendered output matches Backlog.md's historical
	 * behavior byte-for-byte.
	 */
	board?: BoardConfig;
	/**
	 * Named agents available in this project. When configured, the UI shows
	 * a dropdown instead of a free-text input for the `agent` and
	 * `reviewAgent` task fields. The dispatcher resolves each alias to its
	 * `binary` before launching. Tasks without a configured alias fall back
	 * to treating the stored value as a raw binary name.
	 */
	agents?: AgentConfig[];
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

/**
 * Server-reported capability surface for status-change callbacks.
 * Sourced from the same resolver the runtime uses, so the browser stays
 * consistent with actual runtime behavior (including the Windows sh.exe→cmd.exe fallback).
 */
export interface StatusCallbackCapabilities {
	platform: NodeJS.Platform;
	resolvedShell: string[];
	willFallbackToCmd: boolean;
	/** Map of named shell → whether it was found on the server's PATH. Lets the UI disable unavailable dropdown options. */
	shellAvailability: Record<string, boolean>;
}
