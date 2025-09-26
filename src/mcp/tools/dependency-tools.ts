import { computeSequences } from "../../core/sequences.ts";
import type { Task } from "../../types/index.ts";
import { McpError } from "../errors/mcp-errors.ts";
import type { McpServer } from "../server.ts";
import type { CallToolResult, McpToolHandler } from "../types.ts";
import { createSimpleValidatedTool } from "../validation/tool-wrapper.ts";
import type { JsonSchema } from "../validation/validators.ts";

/**
 * Dependency add tool schema
 */
const dependencyAddSchema: JsonSchema = {
	type: "object",
	properties: {
		id: {
			type: "string",
			minLength: 1,
			maxLength: 50,
		},
		dependencies: {
			type: "array",
			items: { type: "string", maxLength: 50 },
		},
	},
	required: ["id", "dependencies"],
};

/**
 * Dependency remove tool schema
 */
const dependencyRemoveSchema: JsonSchema = {
	type: "object",
	properties: {
		id: {
			type: "string",
			minLength: 1,
			maxLength: 50,
		},
		dependencies: {
			type: "array",
			items: { type: "string", maxLength: 50 },
		},
	},
	required: ["id", "dependencies"],
};

/**
 * Dependency list tool schema
 */
const dependencyListSchema: JsonSchema = {
	type: "object",
	properties: {
		id: {
			type: "string",
			minLength: 1,
			maxLength: 50,
		},
		includeStatus: {
			type: "boolean",
		},
	},
	required: ["id"],
};

/**
 * Dependency validate tool schema
 */
const dependencyValidateSchema: JsonSchema = {
	type: "object",
	properties: {
		id: {
			type: "string",
			minLength: 1,
			maxLength: 50,
		},
		proposedDependencies: {
			type: "array",
			items: { type: "string", maxLength: 50 },
		},
	},
	required: ["id"],
};

/**
 * Helper function to format dependency relationships as markdown
 */
function formatDependencyListMarkdown(
	taskId: string,
	dependencies: string[],
	title: string,
	includeStatus?: boolean,
	taskMap?: Map<string, Task>,
): string {
	const lines = [`# ${title}`, ""];

	if (dependencies.length === 0) {
		lines.push(`Task **${taskId}** has no dependencies.`);
		return lines.join("\n");
	}

	lines.push(`Task **${taskId}** has ${dependencies.length} dependencies:`);
	lines.push("");

	for (const dep of dependencies) {
		if (includeStatus && taskMap) {
			const depTask = taskMap.get(dep);
			const status = depTask?.status || "Unknown";
			lines.push(`- **${dep}** (Status: ${status})`);
		} else {
			lines.push(`- **${dep}**`);
		}
	}

	return lines.join("\n");
}

/**
 * Helper function to format dependency operation results as markdown
 */
function formatDependencyOperationMarkdown(
	operation: "added" | "removed",
	taskId: string,
	dependencies: string[],
	success: boolean,
): string {
	const lines = [`# Dependency ${operation === "added" ? "Addition" : "Removal"} Result`, ""];

	if (success && dependencies.length > 0) {
		lines.push(
			`✅ Successfully ${operation} ${dependencies.length} dependencies ${operation === "added" ? "to" : "from"} task **${taskId}**:`,
		);
		lines.push("");
		for (const dep of dependencies) {
			lines.push(`- **${dep}**`);
		}
	} else if (dependencies.length === 0) {
		const action = operation === "added" ? "added" : "removed";
		const reason = operation === "added" ? "(all were already present)" : "(none were found)";
		lines.push(`ℹ️ No new dependencies ${action} ${operation === "added" ? "to" : "from"} task **${taskId}** ${reason}`);
	}

	return lines.join("\n");
}

/**
 * Helper function to format dependency validation results as markdown
 */
function formatDependencyValidationMarkdown(
	taskId: string,
	validDeps: string[],
	invalidDeps: string[],
	sequenceInfo?: { index: number },
): string {
	const lines = [`# Dependency Validation for ${taskId}`, ""];

	// Validation status
	if (invalidDeps.length > 0) {
		lines.push("## ❌ Validation Status: FAILED");
		lines.push("");
		lines.push("### Invalid Dependencies");
		lines.push("The following dependencies do not exist:");
		lines.push("");
		for (const dep of invalidDeps) {
			lines.push(`- **${dep}**`);
		}
		lines.push("");
	} else {
		lines.push("## ✅ Validation Status: PASSED");
		lines.push("");
		lines.push("All dependencies exist and are valid.");
		lines.push("");
	}

	// Dependency analysis
	if (validDeps.length > 0) {
		lines.push("## Dependency Analysis");
		lines.push("");
		lines.push(`- **Direct dependencies:** ${validDeps.length}`);

		if (sequenceInfo) {
			lines.push(`- **Sequence position:** ${sequenceInfo.index}`);
		}

		lines.push("");
		lines.push("### Valid Dependencies");
		for (const dep of validDeps) {
			lines.push(`- **${dep}**`);
		}
	}

	return lines.join("\n");
}

/**
 * DependencyToolHandlers class containing all dependency management business logic
 */
export class DependencyToolHandlers {
	constructor(private server: McpServer) {}

	/**
	 * Normalize dependencies to proper task-X format
	 */
	private normalizeDependencies(dependencies: string[]): string[] {
		if (!dependencies || dependencies.length === 0) return [];

		return dependencies
			.flatMap((dep) =>
				String(dep)
					.split(",")
					.map((d) => d.trim()),
			)
			.filter(Boolean)
			.map((dep) => (dep.startsWith("task-") ? dep : `task-${dep}`));
	}

	/**
	 * Validate that all dependencies exist
	 */
	private async validateDependencies(dependencies: string[]): Promise<{ valid: string[]; invalid: string[] }> {
		const valid: string[] = [];
		const invalid: string[] = [];

		if (dependencies.length === 0) {
			return { valid, invalid };
		}

		// Load both tasks and drafts to validate dependencies
		const [tasks, drafts] = await Promise.all([this.server.fs.listTasks(), this.server.fs.listDrafts()]);

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
	 * Add dependencies to a task
	 */
	async addDependencies(args: { id: string; dependencies: string[] }): Promise<CallToolResult> {
		const { id, dependencies } = args;

		try {
			const task = await this.server.fs.loadTask(id);
			if (!task) {
				throw new McpError(`Task not found: ${id}`, "TASK_NOT_FOUND");
			}

			// Normalize dependencies
			const normalizedDependencies = this.normalizeDependencies(dependencies);

			// Validate dependencies exist
			const { valid, invalid } = await this.validateDependencies(normalizedDependencies);
			if (invalid.length > 0) {
				throw new Error(`The following dependencies do not exist: ${invalid.join(", ")}`);
			}

			// Merge with existing dependencies (avoid duplicates)
			const existingDeps = new Set(task.dependencies || []);
			const newDeps = [...existingDeps];
			const addedDeps: string[] = [];

			for (const dep of valid) {
				if (!existingDeps.has(dep)) {
					newDeps.push(dep);
					addedDeps.push(dep);
				}
			}

			// Update task
			const updatedTask: Task = {
				...task,
				dependencies: newDeps,
				updatedDate: new Date().toISOString(),
			};

			await this.server.updateTask(updatedTask);

			const markdownText = formatDependencyOperationMarkdown("added", id, addedDeps, addedDeps.length > 0);

			return {
				content: [
					{
						type: "text" as const,
						text: markdownText,
					},
				],
			};
		} catch (error) {
			throw new Error(`Failed to add dependencies: ${error instanceof Error ? error.message : String(error)}`);
		}
	}

	/**
	 * Remove dependencies from a task
	 */
	async removeDependencies(args: { id: string; dependencies: string[] }): Promise<CallToolResult> {
		const { id, dependencies } = args;

		try {
			const task = await this.server.fs.loadTask(id);
			if (!task) {
				throw new McpError(`Task not found: ${id}`, "TASK_NOT_FOUND");
			}

			// Normalize dependencies
			const normalizedDependencies = this.normalizeDependencies(dependencies);
			const toRemove = new Set(normalizedDependencies);

			const existingDeps = task.dependencies || [];
			const newDeps = existingDeps.filter((dep) => !toRemove.has(dep));
			const removedDeps = existingDeps.filter((dep) => toRemove.has(dep));

			// Update task
			const updatedTask: Task = {
				...task,
				dependencies: newDeps,
				updatedDate: new Date().toISOString(),
			};

			await this.server.updateTask(updatedTask);

			const markdownText = formatDependencyOperationMarkdown("removed", id, removedDeps, removedDeps.length > 0);

			return {
				content: [
					{
						type: "text" as const,
						text: markdownText,
					},
				],
			};
		} catch (error) {
			throw new Error(`Failed to remove dependencies: ${error instanceof Error ? error.message : String(error)}`);
		}
	}

	/**
	 * List dependencies of a task
	 */
	async listDependencies(args: { id: string; includeStatus?: boolean }): Promise<CallToolResult> {
		const { id, includeStatus = false } = args;

		try {
			const task = await this.server.fs.loadTask(id);
			if (!task) {
				throw new McpError(`Task not found: ${id}`, "TASK_NOT_FOUND");
			}

			const dependencies = task.dependencies || [];
			let taskMap: Map<string, Task> | undefined;

			if (includeStatus) {
				// Load dependency tasks to get their status
				const allTasks = await this.server.fs.listTasks();
				taskMap = new Map(allTasks.map((t) => [t.id, t]));
			}

			const markdownText = formatDependencyListMarkdown(id, dependencies, "Task Dependencies", includeStatus, taskMap);

			return {
				content: [
					{
						type: "text" as const,
						text: markdownText,
					},
				],
			};
		} catch (error) {
			throw new Error(`Failed to list dependencies: ${error instanceof Error ? error.message : String(error)}`);
		}
	}

	/**
	 * Validate dependencies and check for potential issues
	 */
	async validateDependencyGraph(args: { id: string; proposedDependencies?: string[] }): Promise<CallToolResult> {
		const { id, proposedDependencies } = args;

		try {
			const task = await this.server.fs.loadTask(id);
			if (!task) {
				throw new McpError(`Task not found: ${id}`, "TASK_NOT_FOUND");
			}

			const depsToCheck = proposedDependencies
				? this.normalizeDependencies(proposedDependencies)
				: task.dependencies || [];

			// Check if dependencies exist
			const { valid, invalid } = await this.validateDependencies(depsToCheck);

			// Get sequence information for analysis
			let sequenceInfo: { index: number } | undefined;
			if (valid.length > 0) {
				const allTasks = await this.server.fs.listTasks();
				const { sequences } = computeSequences(allTasks);

				for (const seq of sequences) {
					const taskInSeq = seq.tasks.find((t) => t.id === id);
					if (taskInSeq) {
						sequenceInfo = { index: seq.index };
						break;
					}
				}
			}

			const markdownText = formatDependencyValidationMarkdown(id, valid, invalid, sequenceInfo);

			return {
				content: [
					{
						type: "text" as const,
						text: markdownText,
					},
				],
			};
		} catch (error) {
			throw new Error(`Failed to validate dependencies: ${error instanceof Error ? error.message : String(error)}`);
		}
	}
}

/**
 * Create dependency add tool handler
 */
const createDependencyAddTool = (handlers: DependencyToolHandlers): McpToolHandler =>
	createSimpleValidatedTool(
		{
			name: "dependency_add",
			description: "Add dependencies to a task",
			inputSchema: dependencyAddSchema,
		},
		dependencyAddSchema,
		async (input, _context) => {
			const { id, dependencies } = input as { id: string; dependencies: string[] };
			return handlers.addDependencies({ id, dependencies });
		},
	);

/**
 * Create dependency remove tool handler
 */
const createDependencyRemoveTool = (handlers: DependencyToolHandlers): McpToolHandler =>
	createSimpleValidatedTool(
		{
			name: "dependency_remove",
			description: "Remove dependencies from a task",
			inputSchema: dependencyRemoveSchema,
		},
		dependencyRemoveSchema,
		async (input, _context) => {
			const { id, dependencies } = input as { id: string; dependencies: string[] };
			return handlers.removeDependencies({ id, dependencies });
		},
	);

/**
 * Create dependency list tool handler
 */
const createDependencyListTool = (handlers: DependencyToolHandlers): McpToolHandler =>
	createSimpleValidatedTool(
		{
			name: "dependency_list",
			description: "List dependencies of a task with optional status information",
			inputSchema: dependencyListSchema,
		},
		dependencyListSchema,
		async (input, _context) => {
			const { id, includeStatus } = input as { id: string; includeStatus?: boolean };
			return handlers.listDependencies({ id, includeStatus });
		},
	);

/**
 * Create dependency validate tool handler
 */
const createDependencyValidateTool = (handlers: DependencyToolHandlers): McpToolHandler =>
	createSimpleValidatedTool(
		{
			name: "dependency_validate",
			description: "Validate dependencies and analyze dependency graph for issues",
			inputSchema: dependencyValidateSchema,
		},
		dependencyValidateSchema,
		async (input, _context) => {
			const { id, proposedDependencies } = input as { id: string; proposedDependencies?: string[] };
			return handlers.validateDependencyGraph({ id, proposedDependencies });
		},
	);

/**
 * Register dependency management tools with the MCP server
 */
export function registerDependencyTools(server: McpServer): void {
	const handlers = new DependencyToolHandlers(server);
	server.addTool(createDependencyAddTool(handlers));
	server.addTool(createDependencyRemoveTool(handlers));
	server.addTool(createDependencyListTool(handlers));
	server.addTool(createDependencyValidateTool(handlers));
}
