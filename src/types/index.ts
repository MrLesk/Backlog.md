export interface Task {
	id: string;
	title: string;
	status: string;
	assignee: string[];
	reporter?: string;
	createdDate: string;
	updatedDate?: string;
	labels: string[];
	milestone?: string;
	dependencies: string[];
	description: string;
	acceptanceCriteria?: string[];
	parentTaskId?: string;
	subtasks?: string[];
	priority?: "high" | "medium" | "low";
	branch?: string;
	// Metadata fields (previously in TaskWithMetadata)
	lastModified?: Date;
	source?: "local" | "remote";
}

export interface DecisionLog {
	id: string;
	title: string;
	date: string;
	status: "proposed" | "accepted" | "rejected" | "superseded";
	context: string;
	decision: string;
	consequences: string;
	alternatives?: string;
}

export interface Document {
	id: string;
	title: string;
	type: "readme" | "guide" | "specification" | "other";
	createdDate: string;
	updatedDate?: string;
	content: string;
	tags?: string[];
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
	backlogDirectory?: string;
	defaultEditor?: string;
	autoOpenBrowser?: boolean;
	defaultPort?: number;
}

export interface ParsedMarkdown {
	frontmatter: Record<string, unknown>;
	content: string;
}
