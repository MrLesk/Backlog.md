import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { JiraClient, JiraTransition } from "../integrations/jira.ts";
import { logger } from "./logger.ts";

export interface StatusMappingConfig {
	// Maps Backlog statuses to arrays of equivalent Jira statuses
	backlogToJira: Record<string, string[]>;

	// Maps Jira statuses to Backlog statuses
	jiraToBacklog: Record<string, string>;

	// Project-specific overrides (optional)
	projectOverrides?: Record<
		string,
		{
			backlogToJira: Record<string, string[]>;
			jiraToBacklog: Record<string, string>;
		}
	>;
}

export interface StatusTransitionResult {
	success: boolean;
	transitionId?: string;
	transitionName?: string;
	error?: string;
}

/**
 * Load status mapping configuration from .backlog-jira/config.json
 */
export function loadStatusMapping(): StatusMappingConfig {
	try {
		const configPath = join(process.cwd(), ".backlog-jira", "config.json");
		const content = readFileSync(configPath, "utf-8");
		const config = JSON.parse(content);

		// Extract status mapping from config
		const backlogToJira =
			config.backlog?.statusMapping || getDefaultBacklogToJiraMapping();

		// Build reverse mapping (Jira → Backlog)
		const jiraToBacklog: Record<string, string> = {};
		for (const [backlogStatus, jiraStatuses] of Object.entries(backlogToJira)) {
			for (const jiraStatus of jiraStatuses as string[]) {
				jiraToBacklog[jiraStatus] = backlogStatus;
			}
		}

		return {
			backlogToJira,
			jiraToBacklog,
			projectOverrides: config.backlog?.projectOverrides,
		};
	} catch (error) {
		logger.warn(
			{ error },
			"Failed to load status mapping config, using defaults",
		);
		return {
			backlogToJira: getDefaultBacklogToJiraMapping(),
			jiraToBacklog: getDefaultJiraToBacklogMapping(),
		};
	}
}

/**
 * Default Backlog → Jira status mapping
 */
function getDefaultBacklogToJiraMapping(): Record<string, string[]> {
	return {
		"To Do": ["To Do", "Open", "Backlog", "Todo"],
		"In Progress": ["In Progress", "In Development", "In Review"],
		Done: ["Done", "Closed", "Resolved", "Complete"],
	};
}

/**
 * Default Jira → Backlog status mapping
 */
function getDefaultJiraToBacklogMapping(): Record<string, string> {
	return {
		"To Do": "To Do",
		Open: "To Do",
		Backlog: "To Do",
		Todo: "To Do",
		"In Progress": "In Progress",
		"In Development": "In Progress",
		"In Review": "In Progress",
		Done: "Done",
		Closed: "Done",
		Resolved: "Done",
		Complete: "Done",
	};
}

/**
 * Map a Jira status to a Backlog status
 */
export function mapJiraStatusToBacklog(
	jiraStatus: string,
	projectKey?: string,
): string {
	const mapping = loadStatusMapping();

	// Check project-specific override first
	if (projectKey && mapping.projectOverrides?.[projectKey]) {
		const projectMapping =
			mapping.projectOverrides[projectKey].jiraToBacklog[jiraStatus];
		if (projectMapping) {
			return projectMapping;
		}
	}

	// Use global mapping
	return mapping.jiraToBacklog[jiraStatus] || jiraStatus;
}

/**
 * Find the appropriate Jira transition ID for a target Backlog status
 *
 * This queries the available transitions for the issue and finds one that matches
 * the desired status based on the configuration mapping.
 *
 * @param jiraClient - Jira client instance
 * @param issueKey - Jira issue key
 * @param targetBacklogStatus - Target status in Backlog format
 * @param projectKey - Optional project key for project-specific mappings
 * @returns Transition result with ID if found
 */
export async function findTransitionForStatus(
	jiraClient: JiraClient,
	issueKey: string,
	targetBacklogStatus: string,
	projectKey?: string,
): Promise<StatusTransitionResult> {
	try {
		// Get available transitions for this issue
		const transitions = await jiraClient.getTransitions(issueKey);

		if (transitions.length === 0) {
			return {
				success: false,
				error: `No transitions available for issue ${issueKey}`,
			};
		}

		// Load status mapping
		const mapping = loadStatusMapping();

		// Get the list of acceptable Jira statuses for this Backlog status
		let acceptableJiraStatuses: string[];

		if (projectKey && mapping.projectOverrides?.[projectKey]) {
			acceptableJiraStatuses =
				mapping.projectOverrides[projectKey].backlogToJira[targetBacklogStatus] ||
				mapping.backlogToJira[targetBacklogStatus] ||
				[];
		} else {
			acceptableJiraStatuses = mapping.backlogToJira[targetBacklogStatus] || [];
		}

		if (acceptableJiraStatuses.length === 0) {
			return {
				success: false,
				error: `No Jira status mapping configured for Backlog status "${targetBacklogStatus}"`,
			};
		}

		// Find a transition that leads to one of the acceptable statuses
		const matchingTransition = findBestTransitionMatch(
			transitions,
			acceptableJiraStatuses,
		);

		if (!matchingTransition) {
			const availableTransitions = transitions
				.map((t) => `"${t.name}" → "${t.to.name}"`)
				.join(", ");
			return {
				success: false,
				error: `No transition found from current status to "${targetBacklogStatus}". Available: ${availableTransitions}`,
			};
		}

		logger.debug(
			{
				issueKey,
				targetBacklogStatus,
				transitionId: matchingTransition.id,
				transitionName: matchingTransition.name,
				targetJiraStatus: matchingTransition.to.name,
			},
			"Found matching transition",
		);

		return {
			success: true,
			transitionId: matchingTransition.id,
			transitionName: matchingTransition.name,
		};
	} catch (error) {
		const errorMsg = error instanceof Error ? error.message : String(error);
		logger.error(
			{ error, issueKey, targetBacklogStatus },
			"Failed to find transition",
		);

		return {
			success: false,
			error: `Failed to query transitions: ${errorMsg}`,
		};
	}
}

/**
 * Find the best matching transition from available options
 *
 * Prioritizes exact matches, then case-insensitive matches
 */
function findBestTransitionMatch(
	transitions: JiraTransition[],
	acceptableStatuses: string[],
): JiraTransition | null {
	// First pass: exact match
	for (const acceptable of acceptableStatuses) {
		const exact = transitions.find((t) => t.to.name === acceptable);
		if (exact) {
			return exact;
		}
	}

	// Second pass: case-insensitive match
	for (const acceptable of acceptableStatuses) {
		const caseInsensitive = transitions.find(
			(t) => t.to.name.toLowerCase() === acceptable.toLowerCase(),
		);
		if (caseInsensitive) {
			return caseInsensitive;
		}
	}

	return null;
}

/**
 * Get a human-readable description of available status mappings
 */
export function getStatusMappingDescription(projectKey?: string): string {
	const mapping = loadStatusMapping();

	const lines: string[] = [
		"Status Mapping Configuration:",
		"",
		"Backlog → Jira:",
	];

	const backlogToJira =
		projectKey && mapping.projectOverrides?.[projectKey]
			? mapping.projectOverrides[projectKey].backlogToJira
			: mapping.backlogToJira;

	for (const [backlogStatus, jiraStatuses] of Object.entries(backlogToJira)) {
		lines.push(
			`  "${backlogStatus}" → ${jiraStatuses.map((s) => `"${s}"`).join(", ")}`,
		);
	}

	return lines.join("\n");
}
