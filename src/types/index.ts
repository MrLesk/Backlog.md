export type TaskStatus = string;

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
	body: string; // Raw markdown content without frontmatter
	acceptanceCriteria?: string[];
	parentTaskId?: string;
	subtasks?: string[];
	priority?: "high" | "medium" | "low";
	branch?: string;
	ordinal?: number;
	// Metadata fields (previously in TaskWithMetadata)
	lastModified?: Date;
	source?: "local" | "remote" | "completed";
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
	body?: string; // Raw markdown content without frontmatter
}

export interface Document {
	id: string;
	title: string;
	type: "readme" | "guide" | "specification" | "other";
	createdDate: string;
	updatedDate?: string;
	body: string; // Raw markdown content without frontmatter
	tags?: string[];
	// Web UI specific fields
	name?: string;
	path?: string;
	lastModified?: string;
}

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
