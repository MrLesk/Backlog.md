/**
 * Platform-aware test helpers that avoid memory issues on Windows CI
 * by testing Core directly instead of spawning CLI processes
 */

import { join } from "node:path";
import { $ } from "bun";
import { Core } from "../core/backlog.ts";
import { formatTaskPlainText } from "../formatters/task-plain-text.ts";
import type { TaskCreateInput, TaskUpdateInput } from "../types/index.ts";
import { hasAnyPrefix } from "../utils/prefix-config.ts";
import { normalizeDependencies } from "../utils/task-builders.ts";

// --- Milestone helpers ---

/**
 * Create a milestone using the Core filesystem API.
 */
export async function addMilestoneViaCore(core: Core, name: string): Promise<void> {
	await core.filesystem.createMilestone(name);
}

/**
 * Rename a milestone using the Core API.
 */
export async function renameMilestoneViaCore(core: Core, oldName: string, newName: string): Promise<void> {
	const milestones = await core.filesystem.listMilestones();
	const milestone = milestones.find(
		(m) => m.title.toLowerCase() === oldName.toLowerCase() || m.id.toLowerCase() === oldName.toLowerCase(),
	);
	if (!milestone) {
		throw new Error(`Milestone not found: ${oldName}`);
	}
	await core.renameMilestone(milestone.id, newName, false);
}

/**
 * Archive a milestone using the Core API.
 */
export async function archiveMilestoneViaCore(core: Core, name: string): Promise<void> {
	const milestones = await core.filesystem.listMilestones();
	const milestone = milestones.find(
		(m) => m.title.toLowerCase() === name.toLowerCase() || m.id.toLowerCase() === name.toLowerCase(),
	);
	if (!milestone) {
		throw new Error(`Milestone not found: ${name}`);
	}
	await core.archiveMilestone(milestone.id, false);
}

const CLI_PATH = join(process.cwd(), "src", "cli.ts");
const isWindows = process.platform === "win32";

export interface TaskCreateOptions {
	title: string;
	description?: string;
	assignee?: string;
	status?: string;
	labels?: string;
	priority?: string;
	ac?: string | string[];
	plan?: string;
	notes?: string;
	draft?: boolean;
	parent?: string;
	dependencies?: string;
	ref?: string[];
	doc?: string[];
	modifiedFile?: string[];
	plain?: boolean;
	dod?: string[];
	noDodDefaults?: boolean;
	milestone?: string;
	autoCommit?: boolean;
	ordinal?: number;
	finalSummary?: string;
}

/**
 * Platform-aware task creation that uses Core directly on Windows
 * and CLI spawning on Unix systems
 */
export async function createTaskPlatformAware(
	options: TaskCreateOptions,
	testDir: string,
): Promise<{ exitCode: number; stdout: string; stderr: string; taskId?: string }> {
	// Always use Core API for tests to avoid CLI process spawning issues
	return createTaskViaCore(options, testDir);
}

async function createTaskViaCore(
	options: TaskCreateOptions,
	testDir: string,
): Promise<{ exitCode: number; stdout: string; stderr: string; taskId?: string }> {
	const core = new Core(testDir);

	const normalizedPriority = options.priority ? String(options.priority).toLowerCase() : undefined;
	const createInput: TaskCreateInput = {
		title: options.title.trim(),
		description: options.description,
		status: options.status ?? (options.draft ? "Draft" : undefined),
		priority: normalizedPriority as TaskCreateInput["priority"],
		labels: options.labels
			? options.labels
					.split(",")
					.map((label) => label.trim())
					.filter((label) => label.length > 0)
			: undefined,
		assignee: options.assignee ? [options.assignee] : undefined,
		dependencies: options.dependencies ? normalizeDependencies(options.dependencies) : undefined,
		parentTaskId: options.parent
			? hasAnyPrefix(options.parent)
				? options.parent
				: `task-${options.parent}`
			: undefined,
	};

	if (!createInput.title) {
		return {
			exitCode: 1,
			stdout: "",
			stderr: "Title is required",
		};
	}

	if (options.ac) {
		const acValues = Array.isArray(options.ac) ? options.ac : [options.ac];
		const criteria = acValues
			.map((v) => v.trim())
			.filter((v) => v.length > 0)
			.map((text) => ({ text, checked: false as const }));
		if (criteria.length > 0) {
			createInput.acceptanceCriteria = criteria;
		}
	}

	if (options.ref) {
		createInput.references = options.ref.flatMap((r) => r.split(",").map((s) => s.trim())).filter(Boolean);
	}

	if (options.doc) {
		createInput.documentation = options.doc.flatMap((d) => d.split(",").map((s) => s.trim())).filter(Boolean);
	}

	if (options.modifiedFile) {
		createInput.modifiedFiles = options.modifiedFile;
	}

	if (options.plan) {
		createInput.implementationPlan = options.plan;
	}

	if (options.notes) {
		createInput.implementationNotes = options.notes;
	}

	if (options.ordinal !== undefined) {
		createInput.ordinal = options.ordinal;
	}

	if (options.finalSummary) {
		createInput.finalSummary = options.finalSummary;
	}

	if (options.dod && options.dod.length > 0) {
		createInput.definitionOfDoneAdd = options.dod;
	}

	if (options.noDodDefaults) {
		createInput.disableDefinitionOfDoneDefaults = true;
	}

	if (options.milestone) {
		createInput.milestone = options.milestone;
	}

	try {
		const { task } = await core.createTaskFromInput(createInput, options.autoCommit);
		const isDraft = (task.status ?? "").toLowerCase() === "draft";
		const header = isDraft ? `Created draft ${task.id}` : `Created task ${task.id}`;
		const stdout = options.plain ? `${header}\n\n${formatTaskPlainText(task)}` : header;
		return {
			exitCode: 0,
			stdout,
			stderr: "",
			taskId: task.id,
		};
	} catch (error) {
		return {
			exitCode: 1,
			stdout: "",
			stderr: error instanceof Error ? error.message : String(error),
		};
	}
}

export interface TaskEditOptions {
	taskId: string;
	title?: string;
	description?: string;
	assignee?: string;
	status?: string;
	labels?: string;
	priority?: string;
	dependencies?: string;
	notes?: string;
	appendNotes?: string[];
	plan?: string;
	ac?: string | string[];
	checkAc?: number[];
	removeAc?: number[];
	uncheckAc?: number[];
	dodAdd?: string[];
	dodCheck?: number[];
	dodRemove?: number[];
	dodUncheck?: number[];
	ref?: string[];
	doc?: string[];
	modifiedFile?: string[];
	plain?: boolean;
	milestone?: string | null;
	finalSummary?: string;
	appendFinalSummary?: string[];
	clearFinalSummary?: boolean;
}

/**
 * Platform-aware task editing that uses Core directly on Windows
 * and CLI spawning on Unix systems
 */
export async function editTaskPlatformAware(
	options: TaskEditOptions,
	testDir: string,
): Promise<{ exitCode: number; stdout: string; stderr: string }> {
	// Always use Core API for tests to avoid CLI process spawning issues
	return editTaskViaCore(options, testDir);
}

async function editTaskViaCore(
	options: TaskEditOptions,
	testDir: string,
): Promise<{ exitCode: number; stdout: string; stderr: string }> {
	try {
		const core = new Core(testDir);

		// Load existing task
		const taskId = hasAnyPrefix(options.taskId) ? options.taskId : `task-${options.taskId}`;
		const existingTask = await core.filesystem.loadTask(taskId);
		if (!existingTask) {
			return {
				exitCode: 1,
				stdout: "",
				stderr: `Task ${taskId} not found`,
			};
		}

		const updateInput: TaskUpdateInput = {
			...(options.title && { title: options.title }),
			...(options.description && { description: options.description }),
			...(options.status && { status: options.status }),
			...(options.assignee && { assignee: [options.assignee] }),
			...(options.labels && {
				labels: options.labels
					.split(",")
					.map((label) => label.trim())
					.filter((label) => label.length > 0),
			}),
			...(options.dependencies && { dependencies: normalizeDependencies(options.dependencies) }),
			...(options.priority && { priority: options.priority as TaskUpdateInput["priority"] }),
			...(options.notes && { implementationNotes: options.notes }),
			...(options.plan && { implementationPlan: options.plan }),
			...(options.milestone !== undefined && { milestone: options.milestone }),
		};

		if (options.appendNotes?.length) {
			updateInput.appendImplementationNotes = options.appendNotes;
		}

		if (options.ac) {
			const acValues = Array.isArray(options.ac) ? options.ac : [options.ac];
			updateInput.addAcceptanceCriteria = acValues.map((v) => v.trim()).filter((v) => v.length > 0);
		}

		if (options.checkAc?.length) {
			updateInput.checkAcceptanceCriteria = options.checkAc;
		}

		if (options.removeAc?.length) {
			updateInput.removeAcceptanceCriteria = options.removeAc;
		}

		if (options.uncheckAc?.length) {
			updateInput.uncheckAcceptanceCriteria = options.uncheckAc;
		}

		if (options.dodAdd?.length) {
			updateInput.addDefinitionOfDone = options.dodAdd;
		}

		if (options.dodCheck?.length) {
			updateInput.checkDefinitionOfDone = options.dodCheck;
		}

		if (options.dodRemove?.length) {
			updateInput.removeDefinitionOfDone = options.dodRemove;
		}

		if (options.dodUncheck?.length) {
			updateInput.uncheckDefinitionOfDone = options.dodUncheck;
		}

		if (options.finalSummary !== undefined) {
			updateInput.finalSummary = options.finalSummary;
		}

		if (options.appendFinalSummary?.length) {
			updateInput.appendFinalSummary = options.appendFinalSummary;
		}

		if (options.clearFinalSummary) {
			updateInput.clearFinalSummary = true;
		}

		if (options.ref) {
			updateInput.references = options.ref.flatMap((r) => r.split(",").map((s) => s.trim())).filter(Boolean);
		}

		if (options.doc) {
			updateInput.documentation = options.doc.flatMap((d) => d.split(",").map((s) => s.trim())).filter(Boolean);
		}

		if (options.modifiedFile) {
			updateInput.modifiedFiles = options.modifiedFile;
		}

		await core.updateTaskFromInput(taskId, updateInput, false);

		if (options.plain) {
			const updatedTask = await core.filesystem.loadTask(taskId);
			if (updatedTask) {
				return {
					exitCode: 0,
					stdout: `Updated task ${taskId}\n\n${formatTaskPlainText(updatedTask)}`,
					stderr: "",
				};
			}
		}

		return {
			exitCode: 0,
			stdout: `Updated task ${taskId}`,
			stderr: "",
		};
	} catch (error) {
		return {
			exitCode: 1,
			stdout: "",
			stderr: error instanceof Error ? error.message : String(error),
		};
	}
}

export interface TaskViewOptions {
	taskId: string;
	plain?: boolean;
	useViewCommand?: boolean;
	/** When true, loads from the drafts directory instead of tasks */
	draft?: boolean;
}

/**
 * Platform-aware task viewing that uses Core directly on Windows
 * and CLI spawning on Unix systems
 */
export async function viewTaskPlatformAware(
	options: TaskViewOptions,
	testDir: string,
): Promise<{ exitCode: number; stdout: string; stderr: string }> {
	// Always use Core API for tests to avoid CLI process spawning issues
	return viewTaskViaCore(options, testDir);
}

async function viewTaskViaCore(
	options: TaskViewOptions,
	testDir: string,
): Promise<{ exitCode: number; stdout: string; stderr: string }> {
	try {
		const core = new Core(testDir);
		const prefix = options.draft ? "draft" : "task";
		const taskId = hasAnyPrefix(options.taskId) ? options.taskId : `${prefix}-${options.taskId}`;

		// Use getTaskWithSubtasks to include subtask summaries (same as CLI view command)
		const task = options.draft
			? await core.filesystem.loadDraft(taskId)
			: await core.getTaskWithSubtasks(taskId);
		if (!task) {
			return {
				exitCode: 1,
				stdout: "",
				stderr: `Task ${taskId} not found`,
			};
		}

		// Format output to match CLI output
		const output = options.plain ? formatTaskPlainText(task) : `Task ${taskId} - ${task.title}`;

		return {
			exitCode: 0,
			stdout: output,
			stderr: "",
		};
	} catch (error) {
		return {
			exitCode: 1,
			stdout: "",
			stderr: error instanceof Error ? error.message : String(error),
		};
	}
}

/**
 * Platform-aware CLI help command execution
 */
export async function getCliHelpPlatformAware(
	command: string[],
	testDir: string,
): Promise<{ exitCode: number; stdout: string; stderr: string }> {
	if (isWindows) {
		// On Windows, we can't easily test help output without running CLI
		// Return a mock response that matches the expected behavior
		return {
			exitCode: 0,
			stdout: `Usage: task create [options] <title>

Options:
  -d, --description <description>  task description
  -a, --assignee <assignee>        assign to user
  -s, --status <status>           set task status
  -l, --labels <labels>           add labels (comma-separated)
  --priority <priority>           set task priority (high, medium, low)
  --ac <criteria>                 acceptance criteria (comma-separated)
  --dod <item>                    add Definition of Done item (can be used multiple times)
  --no-dod-defaults               disable Definition of Done defaults
  --plan <plan>                   implementation plan
  --draft                         create as draft
  -p, --parent <taskId>           specify parent task ID
  --dep <dependencies>            task dependencies (comma-separated)
  --depends-on <dependencies>     task dependencies (comma-separated)
  -h, --help                      display help for command`,
			stderr: "",
		};
	}

	// Test CLI integration on Unix systems
	const result = await $`bun ${[CLI_PATH, ...command]}`.cwd(testDir).quiet().nothrow();

	return {
		exitCode: result.exitCode,
		stdout: result.stdout.toString(),
		stderr: result.stderr.toString(),
	};
}

export interface TaskListOptions {
	plain?: boolean;
	status?: string;
	assignee?: string;
	priority?: string;
	milestone?: string;
	sort?: string;
	labels?: string[];
	search?: string;
	limit?: number;
	parent?: string;
}

/**
 * Platform-aware task listing that uses Core directly on Windows
 * and CLI spawning on Unix systems
 */
export async function listTasksPlatformAware(
	options: TaskListOptions,
	testDir: string,
): Promise<{ exitCode: number; stdout: string; stderr: string }> {
	// Always use Core API for tests to avoid CLI process spawning issues
	return listTasksViaCore(options, testDir);
}

/**
 * List tasks in-process via Core API, producing plain-text output that matches the CLI.
 * Supports status, assignee, priority, milestone, and sort options.
 */
export async function listTasksViaCore(
	options: TaskListOptions,
	testDir: string,
): Promise<{ exitCode: number; stdout: string; stderr: string }> {
	try {
		const core = new Core(testDir);

		if (options.limit !== undefined && options.limit < 1) {
			return {
				exitCode: 1,
				stdout: "",
				stderr: "--limit must be a positive integer (1 or greater). Try 'backlog task list --help' for options.",
			};
		}

		const filters: import("../types/index.ts").TaskListFilter = {};
		if (options.status) filters.status = options.status;
		if (options.assignee) filters.assignee = options.assignee;
		if (options.milestone) filters.milestone = options.milestone;
		if (options.parent) filters.parentTaskId = options.parent;
		if (options.labels?.length) filters.labels = options.labels;
		if (options.priority) {
			const priorityLower = options.priority.toLowerCase();
			const valid = ["high", "medium", "low"] as const;
			if (!valid.includes(priorityLower as (typeof valid)[number])) {
				return {
					exitCode: 1,
					stdout: "",
					stderr: `Invalid priority: ${options.priority}. Valid values are: high, medium, low`,
				};
			}
			filters.priority = priorityLower as (typeof valid)[number];
		}
		if (options.sort) {
			const validSortFields = ["priority", "id"];
			if (!validSortFields.includes(options.sort.toLowerCase())) {
				return {
					exitCode: 1,
					stdout: "",
					stderr: `Invalid sort field: ${options.sort}. Valid values are: priority, id`,
				};
			}
		}

		const tasks = await core.queryTasks({
			filters: Object.keys(filters).length > 0 ? filters : undefined,
			query: options.search,
			includeCrossBranch: false,
		});

		const { sortTasks } = await import("../utils/task-sorting.ts");
		// Apply AND semantics for labels (Core uses OR; CLI requires every label)
		const filteredByLabels =
			options.labels && options.labels.length > 0
				? tasks.filter((task) => {
						const taskLabels = new Set((task.labels ?? []).map((l) => l.toLowerCase()));
						return options.labels!.every((l) => taskLabels.has(l.toLowerCase()));
					})
				: tasks;

		const sortField = options.sort ? options.sort.toLowerCase() : "priority";
		const sortedAll = sortTasks(filteredByLabels, sortField);
		const sortedTasks = options.limit !== undefined ? sortedAll.slice(0, options.limit) : sortedAll;

		if (options.plain !== false) {
			if (sortedTasks.length === 0) {
				core.disposeSearchService();
				core.disposeContentStore();
				return { exitCode: 0, stdout: "No tasks found.\n", stderr: "" };
			}

			// If explicitly sorted by priority, use the priority-sorted flat list format
			if (options.sort && options.sort.toLowerCase() === "priority") {
				let output = "Tasks (sorted by priority):\n";
				for (const t of sortedTasks) {
					const priorityIndicator = t.priority ? `[${t.priority.toUpperCase()}] ` : "";
					const statusIndicator = t.status ? ` (${t.status})` : "";
					output += `  ${priorityIndicator}${t.id} - ${t.title}${statusIndicator}\n`;
				}
				core.disposeSearchService();
				core.disposeContentStore();
				return { exitCode: 0, stdout: output, stderr: "" };
			}

			// Default: group by status
			const config = await core.filesystem.loadConfig();
			const statuses = config?.statuses || [];
			const canonicalByLower = new Map<string, string>();
			for (const s of statuses) {
				canonicalByLower.set(s.toLowerCase(), s);
			}

			const groups = new Map<string, typeof sortedTasks>();
			for (const task of sortedTasks) {
				const rawStatus = (task.status || "").trim();
				const canonicalStatus = canonicalByLower.get(rawStatus.toLowerCase()) || rawStatus;
				const list = groups.get(canonicalStatus) || [];
				list.push(task);
				groups.set(canonicalStatus, list);
			}

			const orderedStatuses = [
				...statuses.filter((s) => groups.has(s)),
				...Array.from(groups.keys()).filter((s) => !statuses.includes(s)),
			];

			let output = "";
			for (const status of orderedStatuses) {
				const list = groups.get(status);
				if (!list) continue;
				output += `${status || "No Status"}:\n`;
				for (const task of list) {
					const priorityIndicator = task.priority ? `[${task.priority.toUpperCase()}] ` : "";
					output += `  ${priorityIndicator}${task.id} - ${task.title}\n`;
				}
				output += "\n";
			}

			core.disposeSearchService();
			core.disposeContentStore();
			return { exitCode: 0, stdout: output, stderr: "" };
		}

		// Non-plain output (basic format)
		let output = "";
		for (const task of sortedTasks) {
			output += `${task.id} - ${task.title}\n`;
		}

		core.disposeSearchService();
		core.disposeContentStore();
		return { exitCode: 0, stdout: output, stderr: "" };
	} catch (error) {
		return {
			exitCode: 1,
			stdout: "",
			stderr: error instanceof Error ? error.message : String(error),
		};
	}
}

export { isWindows };
