import type { Core } from "../core/backlog.ts";
import type { Task } from "../types/index.ts";

/**
 * Shared utilities for building tasks and validating dependencies
 * Used by both CLI and MCP to ensure consistent behavior
 */

/**
 * Normalize dependencies to proper task-X format
 * Handles both array and comma-separated string inputs
 */
export function normalizeDependencies(dependencies: unknown): string[] {
	if (!dependencies) return [];
	// Handle multiple flags: --dep task-1 --dep task-2
	if (Array.isArray(dependencies)) {
		return dependencies
			.flatMap((dep) =>
				String(dep)
					.split(",")
					.map((d) => d.trim()),
			)
			.filter(Boolean)
			.map((dep) => (dep.startsWith("task-") ? dep : `task-${dep}`));
	}
	// Handle comma-separated: --dep task-1,task-2,task-3
	return String(dependencies)
		.split(",")
		.map((dep) => dep.trim())
		.filter(Boolean)
		.map((dep) => (dep.startsWith("task-") ? dep : `task-${dep}`));
}

/**
 * Validate that all dependencies exist in the current project
 * Returns arrays of valid and invalid dependency IDs
 */
export async function validateDependencies(
	dependencies: string[],
	core: Core,
): Promise<{ valid: string[]; invalid: string[] }> {
	const valid: string[] = [];
	const invalid: string[] = [];
	if (dependencies.length === 0) {
		return { valid, invalid };
	}
	// Load both tasks and drafts to validate dependencies
	const [tasks, drafts] = await Promise.all([core.filesystem.listTasks(), core.filesystem.listDrafts()]);
	const allTaskIds = new Set([...tasks.map((t) => t.id), ...drafts.map((d) => d.id)]);
	for (const dep of dependencies) {
		if (allTaskIds.has(dep)) {
			valid.push(dep);
		} else {
			invalid.push(dep);
		}
	}
	return { valid, invalid };
}

/**
 * Process acceptance criteria options from CLI/MCP arguments
 * Handles both --ac and --acceptance-criteria options
 */
export function processAcceptanceCriteriaOptions(options: {
	ac?: string | string[];
	acceptanceCriteria?: string | string[];
}): string[] {
	const criteria: string[] = [];
	// Process --ac options
	if (options.ac) {
		const acCriteria = Array.isArray(options.ac) ? options.ac : [options.ac];
		criteria.push(...acCriteria.map((c) => String(c).trim()).filter(Boolean));
	}
	// Process --acceptance-criteria options
	if (options.acceptanceCriteria) {
		const accCriteria = Array.isArray(options.acceptanceCriteria)
			? options.acceptanceCriteria
			: [options.acceptanceCriteria];
		criteria.push(...accCriteria.map((c) => String(c).trim()).filter(Boolean));
	}
	return criteria;
}

/**
 * Build a Task object from CLI/MCP options
 * This is the core task building logic shared between CLI and MCP
 */
export function buildTaskFromOptions(id: string, title: string, options: Record<string, unknown>): Task {
	const parentInput = options.parent ? String(options.parent) : undefined;
	const normalizedParent = parentInput
		? parentInput.startsWith("task-")
			? parentInput
			: `task-${parentInput}`
		: undefined;
	const createdDate = new Date().toISOString().slice(0, 16).replace("T", " ");
	// Handle dependencies - they will be validated separately
	const dependencies = normalizeDependencies(options.dependsOn || options.dep);
	// Validate priority option
	const priority = options.priority ? String(options.priority).toLowerCase() : undefined;
	const validPriorities = ["high", "medium", "low"];
	const validatedPriority =
		priority && validPriorities.includes(priority) ? (priority as "high" | "medium" | "low") : undefined;
	return {
		id,
		title,
		status: options.status ? String(options.status) : "",
		assignee: options.assignee ? [String(options.assignee)] : [],
		createdDate,
		labels: options.labels
			? String(options.labels)
					.split(",")
					.map((l: string) => l.trim())
					.filter(Boolean)
			: [],
		dependencies,
		rawContent: "",
		...(options.description || options.desc ? { description: String(options.description || options.desc) } : {}),
		...(normalizedParent && { parentTaskId: normalizedParent }),
		...(validatedPriority && { priority: validatedPriority }),
	};
}

/**
 * Interface for MCP-compatible options
 * Simplified version that matches MCP tool argument patterns
 */
export interface McpTaskOptions {
	title: string;
	description?: string;
	labels?: string[];
	assignee?: string[];
	priority?: "high" | "medium" | "low";
	status?: string;
	parentTaskId?: string;
	acceptanceCriteria?: string[];
	dependencies?: string[];
}

/**
 * Build a Task object from MCP-style options
 * Converts MCP arguments to the format expected by buildTaskFromOptions
 */
export function buildTaskFromMcpOptions(id: string, mcpOptions: McpTaskOptions): Task {
	// Convert MCP options to CLI-style options format
	const cliOptions: Record<string, unknown> = {
		description: mcpOptions.description,
		assignee: mcpOptions.assignee?.[0], // CLI takes single assignee string
		status: mcpOptions.status,
		labels: mcpOptions.labels?.join(","), // CLI expects comma-separated string
		priority: mcpOptions.priority,
		parent: mcpOptions.parentTaskId,
		dep: mcpOptions.dependencies, // Will be normalized by buildTaskFromOptions
	};

	const task = buildTaskFromOptions(id, mcpOptions.title, cliOptions);

	// Handle MCP-specific fields that CLI doesn't support directly
	if (mcpOptions.acceptanceCriteria && mcpOptions.acceptanceCriteria.length > 0) {
		task.acceptanceCriteriaItems = mcpOptions.acceptanceCriteria.map((text, index) => ({
			index: index + 1,
			text,
			checked: false,
		}));
	}

	// MCP can have multiple assignees, CLI only supports one
	if (mcpOptions.assignee && mcpOptions.assignee.length > 1) {
		task.assignee = mcpOptions.assignee;
	}

	return task;
}
