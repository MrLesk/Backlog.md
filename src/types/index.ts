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
}

export interface ParsedMarkdown {
	frontmatter: Record<string, unknown>;
	content: string;
}
