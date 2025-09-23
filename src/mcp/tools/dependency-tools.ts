import { computeSequences } from "../../core/sequences.ts";
import type { Task } from "../../types/index.ts";
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
				throw new Error(`Task not found: ${id}`);
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

			await this.server.updateTask(updatedTask, false);

			return {
				content: [
					{
						type: "text" as const,
						text:
							addedDeps.length > 0
								? `Successfully added ${addedDeps.length} dependencies to task ${id}: ${addedDeps.join(", ")}`
								: `No new dependencies added to task ${id} (all were already present)`,
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
				throw new Error(`Task not found: ${id}`);
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

			await this.server.updateTask(updatedTask, false);

			return {
				content: [
					{
						type: "text" as const,
						text:
							removedDeps.length > 0
								? `Successfully removed ${removedDeps.length} dependencies from task ${id}: ${removedDeps.join(", ")}`
								: `No dependencies removed from task ${id} (none were found)`,
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
				throw new Error(`Task not found: ${id}`);
			}

			const dependencies = task.dependencies || [];

			if (dependencies.length === 0) {
				return {
					content: [
						{
							type: "text" as const,
							text: `Task ${id} has no dependencies`,
						},
					],
				};
			}

			let result = `Task ${id} has ${dependencies.length} dependencies:\n`;

			if (includeStatus) {
				// Load dependency tasks to get their status
				const allTasks = await this.server.fs.listTasks();
				const taskMap = new Map(allTasks.map((t) => [t.id, t]));

				for (const dep of dependencies) {
					const depTask = taskMap.get(dep);
					const status = depTask?.status || "Unknown";
					result += `  - ${dep} (${status})\n`;
				}
			} else {
				result += dependencies.map((dep) => `  - ${dep}`).join("\n");
			}

			return {
				content: [
					{
						type: "text" as const,
						text: result,
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
				throw new Error(`Task not found: ${id}`);
			}

			const depsToCheck = proposedDependencies
				? this.normalizeDependencies(proposedDependencies)
				: task.dependencies || [];

			let result = `Dependency validation for task ${id}:\n\n`;

			// Check if dependencies exist
			const { valid, invalid } = await this.validateDependencies(depsToCheck);

			if (invalid.length > 0) {
				result += `❌ Invalid dependencies (do not exist): ${invalid.join(", ")}\n`;
			} else {
				result += "✅ All dependencies exist\n";
			}

			// Provide dependency chain analysis
			if (valid.length > 0) {
				result += "\nDependency analysis:\n";
				result += `- Direct dependencies: ${valid.length}\n`;

				// Count total dependencies in chain using sequence computation
				const allTasks = await this.server.fs.listTasks();
				const { sequences } = computeSequences(allTasks);

				for (const seq of sequences) {
					const taskInSeq = seq.tasks.find((t) => t.id === id);
					if (taskInSeq) {
						result += `- Sequence position: ${seq.index}\n`;
						break;
					}
				}
			}

			const isValid = invalid.length === 0;
			result += `\n${isValid ? "✅" : "❌"} Overall validation: ${isValid ? "PASSED" : "FAILED"}`;

			return {
				content: [
					{
						type: "text" as const,
						text: result,
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
