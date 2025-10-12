import { readFileSync, writeFileSync } from "node:fs";
import { logger } from "./logger.ts";

export interface JiraMetadata {
	jiraKey?: string;
	jiraLastSync?: string;
	jiraSyncState?: string;
	jiraUrl?: string;
}

/**
 * Extract frontmatter from a markdown file
 * Returns the frontmatter object and the content without frontmatter
 */
export function parseFrontmatter(content: string): {
	frontmatter: Record<string, unknown>;
	body: string;
} {
	const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);

	if (!frontmatterMatch) {
		return { frontmatter: {}, body: content };
	}

	const frontmatterYaml = frontmatterMatch[1];
	const body = frontmatterMatch[2];

	// Parse YAML frontmatter (simple key: value format)
	const frontmatter: Record<string, unknown> = {};
	const lines = frontmatterYaml.split("\n");

	for (const line of lines) {
		const match = line.match(/^([^:]+):\s*(.*)$/);
		if (match) {
			const key = match[1].trim();
			let value: unknown = match[2].trim();

			// Handle arrays: [item1, item2]
			if (value && typeof value === "string") {
				const arrayMatch = value.match(/^\[(.*)\]$/);
				if (arrayMatch) {
					value = arrayMatch[1]
						.split(",")
						.map((v) => v.trim())
						.filter((v) => v);
				}
			}

			frontmatter[key] = value;
		}
	}

	return { frontmatter, body };
}

/**
 * Serialize frontmatter object to YAML format
 */
function serializeFrontmatter(frontmatter: Record<string, unknown>): string {
	const lines: string[] = [];

	for (const [key, value] of Object.entries(frontmatter)) {
		if (Array.isArray(value)) {
			lines.push(`${key}: [${value.join(", ")}]`);
		} else if (value !== undefined && value !== null) {
			lines.push(`${key}: ${value}`);
		}
	}

	return lines.join("\n");
}

/**
 * Add or update Jira metadata in a task file's frontmatter
 */
export function updateJiraMetadata(filePath: string, metadata: JiraMetadata): void {
	try {
		const content = readFileSync(filePath, "utf-8");
		const { frontmatter, body } = parseFrontmatter(content);

		// Update Jira fields
		if (metadata.jiraKey !== undefined) {
			frontmatter.jira_key = metadata.jiraKey;
		}
		if (metadata.jiraLastSync !== undefined) {
			frontmatter.jira_last_sync = metadata.jiraLastSync;
		}
		if (metadata.jiraSyncState !== undefined) {
			frontmatter.jira_sync_state = metadata.jiraSyncState;
		}
		if (metadata.jiraUrl !== undefined) {
			frontmatter.jira_url = metadata.jiraUrl;
		}

		// Reconstruct file
		const newFrontmatter = serializeFrontmatter(frontmatter);
		const newContent = `---\n${newFrontmatter}\n---\n${body}`;

		writeFileSync(filePath, newContent, "utf-8");
		logger.debug({ filePath, metadata }, "Updated Jira metadata in frontmatter");
	} catch (error) {
		logger.error({ error, filePath }, "Failed to update Jira metadata");
		throw error;
	}
}

/**
 * Get Jira metadata from a task file
 */
export function getJiraMetadata(filePath: string): JiraMetadata {
	try {
		const content = readFileSync(filePath, "utf-8");
		const { frontmatter } = parseFrontmatter(content);

		return {
			jiraKey: frontmatter.jira_key as string | undefined,
			jiraLastSync: frontmatter.jira_last_sync as string | undefined,
			jiraSyncState: frontmatter.jira_sync_state as string | undefined,
			jiraUrl: frontmatter.jira_url as string | undefined,
		};
	} catch (error) {
		logger.error({ error, filePath }, "Failed to get Jira metadata");
		throw error;
	}
}

/**
 * Find the file path for a given task ID
 * Looks in backlog/tasks/ directory
 */
export function getTaskFilePath(taskId: string): string {
	// Task files are named like: task-123 - Title.md
	// We need to find the file that starts with the task ID

	const { readdirSync } = require("node:fs");
	const { join } = require("node:path");

	const tasksDir = join(process.cwd(), "backlog", "tasks");
	const files = readdirSync(tasksDir);

	const prefix = `${taskId} - `;
	const file = files.find((f: string) => f.startsWith(prefix) && f.endsWith(".md"));

	if (!file) {
		throw new Error(`Task file not found for ${taskId}`);
	}

	return join(tasksDir, file);
}
