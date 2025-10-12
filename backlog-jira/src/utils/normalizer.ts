import crypto from "node:crypto";
import type { BacklogTask } from "../integrations/backlog.ts";
import type { JiraIssue } from "../integrations/jira.ts";

/**
 * Normalized payload for comparison between Backlog and Jira
 * Contains only the fields that should be synced
 */
export interface NormalizedPayload {
	title: string;
	description: string;
	status: string;
	priority?: string;
	labels: string[];
	assignee?: string;
	// AC is Backlog-specific but we normalize it for comparison
	acceptanceCriteria: Array<{ text: string; checked: boolean }>;
}

/**
 * Normalize a Backlog task to a comparable payload
 */
export function normalizeBacklogTask(task: BacklogTask): NormalizedPayload {
	return {
		title: task.title.trim(),
		description: (task.description || "").trim(),
		status: normalizeStatus(task.status, "backlog"),
		priority: task.priority?.toLowerCase(),
		labels: (task.labels || []).map((l) => l.toLowerCase()).sort(),
		assignee: task.assignee?.trim().toLowerCase(),
		acceptanceCriteria: (task.acceptanceCriteria || []).map((ac) => ({
			text: ac.text.trim(),
			checked: ac.checked,
		})),
	};
}

/**
 * Normalize a Jira issue to a comparable payload
 */
export function normalizeJiraIssue(issue: JiraIssue): NormalizedPayload {
	return {
		title: issue.summary.trim(),
		description: (issue.description || "").trim(),
		status: normalizeStatus(issue.status, "jira"),
		priority: issue.priority?.toLowerCase(),
		labels: (issue.labels || []).map((l) => l.toLowerCase()).sort(),
		assignee: issue.assignee?.trim().toLowerCase(),
		// Jira doesn't have AC, so we extract from description if formatted
		acceptanceCriteria: extractAcceptanceCriteria(issue.description || ""),
	};
}

/**
 * Normalize status values between Backlog and Jira
 * Maps common status names to canonical values
 */
function normalizeStatus(status: string, side: "backlog" | "jira"): string {
	const normalized = status.toLowerCase().trim();

	// Backlog statuses: To Do, In Progress, Done, Blocked
	// Jira statuses vary by workflow, but common ones: To Do, In Progress, Done, Closed

	const statusMap: Record<string, string> = {
		"to do": "todo",
		todo: "todo",
		backlog: "todo",
		"in progress": "in_progress",
		inprogress: "in_progress",
		"in-progress": "in_progress",
		doing: "in_progress",
		done: "done",
		completed: "done",
		closed: "done",
		resolved: "done",
		blocked: "blocked",
		"on hold": "blocked",
	};

	return statusMap[normalized] || normalized;
}

/**
 * Extract acceptance criteria from Jira description
 * Looks for patterns like "Acceptance Criteria:" followed by bullet points
 */
function extractAcceptanceCriteria(description: string): Array<{ text: string; checked: boolean }> {
	const criteria: Array<{ text: string; checked: boolean }> = [];

	// Look for AC section
	const acMatch = description.match(/acceptance criteria:?\s*([\s\S]*?)(?=\n\n|$)/i);
	if (!acMatch) return criteria;

	const acSection = acMatch[1];
	const lines = acSection.split("\n");

	for (const line of lines) {
		// Match checked or unchecked bullet points
		const checkedMatch = line.match(/^[\s-]*\[x\]\s*(.+)/i);
		const uncheckedMatch = line.match(/^[\s-]*\[ \]\s*(.+)/i);
		const bulletMatch = line.match(/^[\s-]*[*•-]\s*(.+)/);

		if (checkedMatch) {
			criteria.push({ text: checkedMatch[1].trim(), checked: true });
		} else if (uncheckedMatch) {
			criteria.push({ text: uncheckedMatch[1].trim(), checked: false });
		} else if (bulletMatch) {
			criteria.push({ text: bulletMatch[1].trim(), checked: false });
		}
	}

	return criteria;
}

/**
 * Compute a hash of a normalized payload for change detection
 * Uses stable JSON serialization and SHA-256
 */
export function computeHash(payload: NormalizedPayload): string {
	// Sort object keys for stable hashing
	const stable = {
		acceptanceCriteria: payload.acceptanceCriteria,
		assignee: payload.assignee || "",
		description: payload.description,
		labels: payload.labels,
		priority: payload.priority || "",
		status: payload.status,
		title: payload.title,
	};

	const json = JSON.stringify(stable);
	return crypto.createHash("sha256").update(json).digest("hex");
}

/**
 * Compare two normalized payloads field by field
 * Returns a list of changed fields
 */
export function comparePayloads(a: NormalizedPayload, b: NormalizedPayload): string[] {
	const changes: string[] = [];

	if (a.title !== b.title) changes.push("title");
	if (a.description !== b.description) changes.push("description");
	if (a.status !== b.status) changes.push("status");
	if (a.priority !== b.priority) changes.push("priority");
	if (a.assignee !== b.assignee) changes.push("assignee");

	// Compare arrays
	if (JSON.stringify(a.labels) !== JSON.stringify(b.labels)) {
		changes.push("labels");
	}
	if (JSON.stringify(a.acceptanceCriteria) !== JSON.stringify(b.acceptanceCriteria)) {
		changes.push("acceptanceCriteria");
	}

	return changes;
}
