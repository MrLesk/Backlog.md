#!/usr/bin/env node

import { join } from "node:path";
import { stdin as input, stdout as output } from "node:process";
import { createInterface } from "node:readline/promises";
import { Command } from "commander";
import prompts from "prompts";
import { filterTasksByLatestState, getLatestTaskStatesForIds } from "./core/cross-branch-tasks.ts";
import { loadRemoteTasks, resolveTaskConflict } from "./core/remote-tasks.ts";
import {
	type AgentInstructionFile,
	addAgentInstructions,
	Core,
	exportKanbanBoardToFile,
	initializeGitRepository,
	isGitRepository,
} from "./index.ts";
import type { DecisionLog, Document as DocType, Task } from "./types/index.ts";
import { genericSelectList } from "./ui/components/generic-list.ts";
import { createLoadingScreen } from "./ui/loading.ts";
import { formatTaskPlainText, viewTaskEnhanced } from "./ui/task-viewer.ts";
import { promptText, scrollableViewer } from "./ui/tui.ts";
import { getTaskPath } from "./utils/task-path.ts";
import { getVersion } from "./utils/version.ts";

// Windows color fix
if (process.platform === "win32") {
	const term = process.env.TERM;
	if (!term || /^(xterm|dumb|ansi|vt100)$/i.test(term)) {
		process.env.TERM = "xterm-256color";
	}
}

// Get version from package.json
const version = await getVersion();

// Global config migration - run before any command processing
// Only run if we're in a backlog project (skip for init, help, version)
const shouldRunMigration =
	!process.argv.includes("init") &&
	!process.argv.includes("--help") &&
	!process.argv.includes("-h") &&
	!process.argv.includes("--version") &&
	!process.argv.includes("-v") &&
	process.argv.length > 2; // Ensure we have actual commands

if (shouldRunMigration) {
	try {
		const cwd = process.cwd();
		const core = new Core(cwd);

		// Only migrate if config already exists (project is already initialized)
		const config = await core.filesystem.loadConfig();
		if (config) {
			await core.ensureConfigMigrated();
		}
	} catch (_error) {
		// Silently ignore migration errors - project might not be initialized yet
	}
}

const program = new Command();
program
	.name("backlog")
	.description("Backlog.md - Project management CLI")
	.version(version, "-v, --version", "display version number");

program
	.command("init [projectName]")
	.description("initialize backlog project in the current repository")
	.action(async (projectName?: string) => {
		try {
			const cwd = process.cwd();
			const isRepo = await isGitRepository(cwd);

			if (!isRepo) {
				const rl = createInterface({ input, output });
				const answer = (await rl.question("No git repository found. Initialize one here? [y/N] ")).trim().toLowerCase();
				rl.close();

				if (answer.startsWith("y")) {
					await initializeGitRepository(cwd);
				} else {
					console.log("Aborting initialization.");
					process.exit(1);
				}
			}

			let name = projectName;
			if (!name) {
				name = await promptText("Project name:");
				if (!name) {
					console.log("Aborting initialization.");
					process.exit(1);
				}
			}

			// const reporter = (await promptText("Default reporter name (leave blank to skip):")) || "";
			// let storeGlobal = false;
			// if (reporter) {
			// 	const store = (await promptText("Store reporter name globally? [y/N]", "N")).toLowerCase();
			// 	storeGlobal = store.startsWith("y");
			// }

			const agentOptions = [
				".cursorrules",
				"CLAUDE.md",
				"AGENTS.md",
				"GEMINI.md",
				".github/copilot-instructions.md",
			] as const;
			const { files: selected } = await prompts({
				type: "multiselect",
				name: "files",
				message: "Select agent instruction files to update",
				choices: agentOptions.map((name) => ({
					title: name === ".github/copilot-instructions.md" ? "Copilot" : name,
					value: name,
				})),
				hint: "Space to select, Enter to confirm",
				instructions: false,
			});
			const files: AgentInstructionFile[] = (selected ?? []) as AgentInstructionFile[];

			const core = new Core(cwd);
			await core.initializeProject(name);
			console.log(`Initialized backlog project: ${name}`);

			if (files.length > 0) {
				await addAgentInstructions(cwd, core.gitOps, files);
			}

			// if (reporter) {
			// 	if (storeGlobal) {
			// 		const globalPath = join(homedir(), ".backlog", "user");
			// 		await mkdir(dirname(globalPath), { recursive: true });
			// 		await Bun.write(globalPath, `default_reporter: "${reporter}"\n`);
			// 	} else {
			// 		const userPath = join(cwd, ".user");
			// 		await Bun.write(userPath, `default_reporter: "${reporter}"\n`);
			// 		const gitignorePath = join(cwd, ".gitignore");
			// 		let gitignore = "";
			// 		try {
			// 			gitignore = await Bun.file(gitignorePath).text();
			// 		} catch {}
			// 		if (!gitignore.split(/\r?\n/).includes(".user")) {
			// 			gitignore += `${gitignore.endsWith("\n") ? "" : "\n"}.user\n`;
			// 			await Bun.write(gitignorePath, gitignore);
			// 		}
			// 	}
			// }
		} catch (err) {
			console.error("Failed to initialize project", err);
			process.exitCode = 1;
		}
	});

async function generateNextId(core: Core, parent?: string): Promise<string> {
	// Load local tasks and drafts in parallel
	const [tasks, drafts] = await Promise.all([core.filesystem.listTasks(), core.filesystem.listDrafts()]);
	const all = [...tasks, ...drafts];
	const allIds: string[] = [];

	try {
		await core.gitOps.fetch();
		const branches = await core.gitOps.listAllBranches();
		const config = await core.filesystem.loadConfig();
		const backlogDir = config?.backlogDirectory || "backlog";

		// Load files from all branches in parallel
		const branchFilePromises = branches.map(async (branch) => {
			const files = await core.gitOps.listFilesInTree(branch, `${backlogDir}/tasks`);
			return files
				.map((file) => {
					const match = file.match(/task-([\d.]+)/);
					return match ? `task-${match[1]}` : null;
				})
				.filter((id): id is string => id !== null);
		});

		const branchResults = await Promise.all(branchFilePromises);
		for (const branchIds of branchResults) {
			allIds.push(...branchIds);
		}
	} catch (error) {
		// Suppress errors for offline mode or other git issues
		if (process.env.DEBUG) {
			console.error("Could not fetch remote task IDs:", error);
		}
	}

	if (parent) {
		const prefix = parent.startsWith("task-") ? parent : `task-${parent}`;
		let max = 0;
		for (const t of tasks) {
			if (t.id.startsWith(`${prefix}.`)) {
				const rest = t.id.slice(prefix.length + 1);
				const num = Number.parseInt(rest.split(".")[0] || "0", 10);
				if (num > max) max = num;
			}
		}
		for (const id of allIds) {
			if (id.startsWith(`${prefix}.`)) {
				const rest = id.slice(prefix.length + 1);
				const num = Number.parseInt(rest.split(".")[0] || "0", 10);
				if (num > max) max = num;
			}
		}
		return `${prefix}.${max + 1}`;
	}

	let max = 0;
	for (const t of all) {
		const match = t.id.match(/^task-(\d+)/);
		if (match) {
			const num = Number.parseInt(match[1] || "0", 10);
			if (num > max) max = num;
		}
	}
	for (const id of allIds) {
		const match = id.match(/^task-(\d+)/);
		if (match) {
			const num = Number.parseInt(match[1] || "0", 10);
			if (num > max) max = num;
		}
	}
	return `task-${max + 1}`;
}

async function generateNextDecisionId(core: Core): Promise<string> {
	const files = await Array.fromAsync(new Bun.Glob("decision-*.md").scan({ cwd: core.filesystem.decisionsDir }));
	let max = 0;
	for (const file of files) {
		const match = file.match(/^decision-(\d+)/);
		if (match) {
			const num = Number.parseInt(match[1] || "0", 10);
			if (num > max) max = num;
		}
	}
	return `decision-${max + 1}`;
}

async function generateNextDocId(core: Core): Promise<string> {
	const files = await Array.fromAsync(new Bun.Glob("*.md").scan({ cwd: core.filesystem.docsDir }));
	let max = 0;
	for (const file of files) {
		const match = file.match(/^doc-(\d+)/);
		if (match) {
			const num = Number.parseInt(match[1] || "0", 10);
			if (num > max) max = num;
		}
	}
	return `doc-${max + 1}`;
}

function normalizeDependencies(dependencies: unknown): string[] {
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

async function validateDependencies(
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

function buildTaskFromOptions(id: string, title: string, options: Record<string, unknown>): Task {
	const parentInput = options.parent ? String(options.parent) : undefined;
	const normalizedParent = parentInput
		? parentInput.startsWith("task-")
			? parentInput
			: `task-${parentInput}`
		: undefined;

	const createdDate = new Date().toISOString().split("T")[0] || new Date().toISOString().slice(0, 10);

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
		description: options.description || options.desc ? String(options.description || options.desc) : "",
		...(normalizedParent && { parentTaskId: normalizedParent }),
		...(validatedPriority && { priority: validatedPriority }),
	};
}

const taskCmd = program.command("task").aliases(["tasks"]);

taskCmd
	.command("create <title>")
	.option("-d, --description <text>")
	.option("--desc <text>", "alias for --description")
	.option("-a, --assignee <assignee>")
	.option("-s, --status <status>")
	.option("-l, --labels <labels>")
	.option("--priority <priority>", "set task priority (high, medium, low)")
	.option("--ac <criteria>", "add acceptance criteria (comma-separated or use multiple times)")
	.option("--acceptance-criteria <criteria>", "add acceptance criteria (comma-separated or use multiple times)")
	.option("--plan <text>", "add implementation plan")
	.option("--draft")
	.option("-p, --parent <taskId>", "specify parent task ID")
	.option(
		"--depends-on <taskIds>",
		"specify task dependencies (comma-separated or use multiple times)",
		(value, previous) => {
			const soFar = Array.isArray(previous) ? previous : previous ? [previous] : [];
			return [...soFar, value];
		},
	)
	.option("--dep <taskIds>", "specify task dependencies (shortcut for --depends-on)", (value, previous) => {
		const soFar = Array.isArray(previous) ? previous : previous ? [previous] : [];
		return [...soFar, value];
	})
	.action(async (title: string, options) => {
		const cwd = process.cwd();
		const core = new Core(cwd);
		const id = await generateNextId(core, options.parent);
		const task = buildTaskFromOptions(id, title, options);

		// Validate dependencies if provided
		if (task.dependencies.length > 0) {
			const { valid, invalid } = await validateDependencies(task.dependencies, core);
			if (invalid.length > 0) {
				console.error(`Error: The following dependencies do not exist: ${invalid.join(", ")}`);
				console.error("Please create these tasks first or check the task IDs.");
				process.exitCode = 1;
				return;
			}
			task.dependencies = valid;
		}

		// Handle acceptance criteria (support both --ac and --acceptance-criteria)
		const acceptanceCriteria = options.ac || options.acceptanceCriteria;
		if (acceptanceCriteria) {
			const { updateTaskAcceptanceCriteria } = await import("./markdown/serializer.ts");
			const criteria = Array.isArray(acceptanceCriteria)
				? acceptanceCriteria.flatMap((c: string) => c.split(",").map((item: string) => item.trim()))
				: String(acceptanceCriteria)
						.split(",")
						.map((item: string) => item.trim());
			task.description = updateTaskAcceptanceCriteria(task.description, criteria.filter(Boolean));
		}

		// Handle implementation plan
		if (options.plan) {
			const { updateTaskImplementationPlan } = await import("./markdown/serializer.ts");
			task.description = updateTaskImplementationPlan(task.description, String(options.plan));
		}

		if (options.draft) {
			const filepath = await core.createDraft(task, true);
			console.log(`Created draft ${id}`);
			console.log(`File: ${filepath}`);
		} else {
			const filepath = await core.createTask(task, true);
			console.log(`Created task ${id}`);
			console.log(`File: ${filepath}`);
		}
	});

taskCmd
	.command("list")
	.description("list tasks grouped by status")
	.option("-s, --status <status>", "filter tasks by status (case-insensitive)")
	.option("-a, --assignee <assignee>", "filter tasks by assignee")
	.option("--plain", "use plain text output instead of interactive UI")
	.action(async (options) => {
		const cwd = process.cwd();
		const core = new Core(cwd);
		const tasks = await core.filesystem.listTasks();
		const config = await core.filesystem.loadConfig();

		let filtered = tasks;
		if (options.status) {
			const statusLower = options.status.toLowerCase();
			filtered = filtered.filter((t) => t.status.toLowerCase() === statusLower);
		}
		if (options.assignee) {
			filtered = filtered.filter((t) => t.assignee.includes(options.assignee));
		}

		if (filtered.length === 0) {
			console.log("No tasks found.");
			return;
		}

		// Plain text output
		// Workaround for bun compile issue with commander options
		const isPlainFlag = options.plain || process.argv.includes("--plain");
		if (isPlainFlag) {
			const groups = new Map<string, Task[]>();
			for (const task of filtered) {
				const status = task.status || "";
				const list = groups.get(status) || [];
				list.push(task);
				groups.set(status, list);
			}

			const statuses = config?.statuses || [];
			const ordered = [
				...statuses.filter((s) => groups.has(s)),
				...Array.from(groups.keys()).filter((s) => !statuses.includes(s)),
			];

			for (const status of ordered) {
				const list = groups.get(status);
				if (!list) continue;
				console.log(`${status || "No Status"}:`);
				for (const t of list) {
					console.log(`  ${t.id} - ${t.title}`);
				}
				console.log();
			}
			return;
		}

		// Interactive UI - use unified view for Tab switching support
		if (filtered.length > 0) {
			// Use the first task as the initial selection
			const firstTask = filtered[0];
			if (!firstTask) {
				console.log("No tasks found.");
				return;
			}

			// Build filter description for the footer and title
			let filterDescription = "";
			let title = "Tasks";

			if (options.status && options.assignee) {
				filterDescription = `Status: ${options.status}, Assignee: ${options.assignee}`;
				title = `Tasks (${options.status} • ${options.assignee})`;
			} else if (options.status) {
				filterDescription = `Status: ${options.status}`;
				title = `Tasks (${options.status})`;
			} else if (options.assignee) {
				filterDescription = `Assignee: ${options.assignee}`;
				title = `Tasks (${options.assignee})`;
			}

			// Use unified view with Tab switching support
			const { runUnifiedView } = await import("./ui/unified-view.ts");
			await runUnifiedView({
				core,
				initialView: "task-list",
				selectedTask: firstTask,
				tasks: filtered,
				filter: {
					status: options.status,
					assignee: options.assignee,
					title,
					filterDescription,
				},
			});
		}
	});

taskCmd
	.command("edit <taskId>")
	.description("edit an existing task")
	.option("-t, --title <title>")
	.option("-d, --description <text>")
	.option("--desc <text>", "alias for --description")
	.option("-a, --assignee <assignee>")
	.option("-s, --status <status>")
	.option("-l, --label <labels>")
	.option("--priority <priority>", "set task priority (high, medium, low)")
	.option("--add-label <label>")
	.option("--remove-label <label>")
	.option("--ac <criteria>", "set acceptance criteria (comma-separated or use multiple times)")
	.option("--acceptance-criteria <criteria>", "set acceptance criteria (comma-separated or use multiple times)")
	.option("--plan <text>", "set implementation plan")
	.option("--notes <text>", "add implementation notes")
	.option(
		"--depends-on <taskIds>",
		"set task dependencies (comma-separated or use multiple times)",
		(value, previous) => {
			const soFar = Array.isArray(previous) ? previous : previous ? [previous] : [];
			return [...soFar, value];
		},
	)
	.option("--dep <taskIds>", "set task dependencies (shortcut for --depends-on)", (value, previous) => {
		const soFar = Array.isArray(previous) ? previous : previous ? [previous] : [];
		return [...soFar, value];
	})
	.action(async (taskId: string, options) => {
		const cwd = process.cwd();
		const core = new Core(cwd);
		const task = await core.filesystem.loadTask(taskId);

		if (!task) {
			console.error(`Task ${taskId} not found.`);
			return;
		}

		if (options.title) {
			task.title = String(options.title);
		}
		if (options.description || options.desc) {
			const { updateTaskDescription } = await import("./markdown/serializer.ts");
			task.description = updateTaskDescription(task.description, String(options.description || options.desc));
		}
		if (typeof options.assignee !== "undefined") {
			task.assignee = [String(options.assignee)];
		}
		if (options.status) {
			task.status = String(options.status);
		}

		if (options.priority) {
			const priority = String(options.priority).toLowerCase();
			const validPriorities = ["high", "medium", "low"];
			if (validPriorities.includes(priority)) {
				task.priority = priority as "high" | "medium" | "low";
			} else {
				console.error(`Invalid priority: ${priority}. Valid values are: high, medium, low`);
				return;
			}
		}

		const labels = [...task.labels];
		if (options.label) {
			const newLabels = String(options.label)
				.split(",")
				.map((l: string) => l.trim())
				.filter(Boolean);
			labels.splice(0, labels.length, ...newLabels);
		}
		if (options.addLabel) {
			const adds = Array.isArray(options.addLabel) ? options.addLabel : [options.addLabel];
			for (const l of adds) {
				const trimmed = String(l).trim();
				if (trimmed && !labels.includes(trimmed)) labels.push(trimmed);
			}
		}
		if (options.removeLabel) {
			const removes = Array.isArray(options.removeLabel) ? options.removeLabel : [options.removeLabel];
			for (const l of removes) {
				const trimmed = String(l).trim();
				const idx = labels.indexOf(trimmed);
				if (idx !== -1) labels.splice(idx, 1);
			}
		}
		task.labels = labels;

		// Handle dependencies
		if (options.dependsOn || options.dep) {
			const dependencies = normalizeDependencies(options.dependsOn || options.dep);
			const { valid, invalid } = await validateDependencies(dependencies, core);
			if (invalid.length > 0) {
				console.error(`Error: The following dependencies do not exist: ${invalid.join(", ")}`);
				console.error("Please create these tasks first or check the task IDs.");
				process.exitCode = 1;
				return;
			}
			task.dependencies = valid;
		}

		// Handle acceptance criteria (support both --ac and --acceptance-criteria)
		const acceptanceCriteria = options.ac || options.acceptanceCriteria;
		if (acceptanceCriteria) {
			const { updateTaskAcceptanceCriteria } = await import("./markdown/serializer.ts");
			const criteria = Array.isArray(acceptanceCriteria)
				? acceptanceCriteria.flatMap((c: string) => c.split(",").map((item: string) => item.trim()))
				: String(acceptanceCriteria)
						.split(",")
						.map((item: string) => item.trim());
			task.description = updateTaskAcceptanceCriteria(task.description, criteria.filter(Boolean));
		}

		// Handle implementation plan
		if (options.plan) {
			const { updateTaskImplementationPlan } = await import("./markdown/serializer.ts");
			task.description = updateTaskImplementationPlan(task.description, String(options.plan));
		}

		// Handle implementation notes
		if (options.notes) {
			const { updateTaskImplementationNotes } = await import("./markdown/serializer.ts");
			task.description = updateTaskImplementationNotes(task.description, String(options.notes));
		}

		await core.updateTask(task, true);
		console.log(`Updated task ${task.id}`);
	});

taskCmd
	.command("view <taskId>")
	.description("display task details")
	.option("--plain", "use plain text output instead of interactive UI")
	.action(async (taskId: string, options) => {
		const cwd = process.cwd();
		const core = new Core(cwd);
		const filePath = await getTaskPath(taskId, core);

		if (!filePath) {
			console.error(`Task ${taskId} not found.`);
			return;
		}
		const content = await Bun.file(filePath).text();
		const task = await core.filesystem.loadTask(taskId);

		if (!task) {
			console.error(`Task ${taskId} not found.`);
			return;
		}

		// Plain text output for AI agents
		if (options && (("plain" in options && options.plain) || process.argv.includes("--plain"))) {
			console.log(formatTaskPlainText(task, content));
			return;
		}

		// Use enhanced task viewer with detail focus
		await viewTaskEnhanced(task, content, { startWithDetailFocus: true });
	});

taskCmd
	.command("archive <taskId>")
	.description("archive a task")
	.action(async (taskId: string) => {
		const cwd = process.cwd();
		const core = new Core(cwd);
		const success = await core.archiveTask(taskId, true);
		if (success) {
			console.log(`Archived task ${taskId}`);
		} else {
			console.error(`Task ${taskId} not found.`);
		}
	});

taskCmd
	.command("demote <taskId>")
	.description("move task back to drafts")
	.action(async (taskId: string) => {
		const cwd = process.cwd();
		const core = new Core(cwd);
		const success = await core.demoteTask(taskId, true);
		if (success) {
			console.log(`Demoted task ${taskId}`);
		} else {
			console.error(`Task ${taskId} not found.`);
		}
	});

taskCmd
	.argument("[taskId]")
	.option("--plain", "use plain text output")
	.action(async (taskId: string | undefined, options: { plain?: boolean }) => {
		if (!taskId) {
			taskCmd.help();
			return;
		}

		const cwd = process.cwd();
		const core = new Core(cwd);
		const filePath = await getTaskPath(taskId, core);

		if (!filePath) {
			console.error(`Task ${taskId} not found.`);
			return;
		}
		const content = await Bun.file(filePath).text();
		const task = await core.filesystem.loadTask(taskId);

		if (!task) {
			console.error(`Task ${taskId} not found.`);
			return;
		}

		// Plain text output for AI agents
		if (options && (options.plain || process.argv.includes("--plain"))) {
			console.log(formatTaskPlainText(task, content));
			return;
		}

		// Use unified view with detail focus and Tab switching support
		const allTasks = await core.filesystem.listTasks();
		const { runUnifiedView } = await import("./ui/unified-view.ts");
		await runUnifiedView({
			core,
			initialView: "task-detail",
			selectedTask: task,
			tasks: allTasks,
		});
	});

const draftCmd = program.command("draft");

draftCmd
	.command("create <title>")
	.option("-d, --description <text>")
	.option("--desc <text>", "alias for --description")
	.option("-a, --assignee <assignee>")
	.option("-s, --status <status>")
	.option("-l, --labels <labels>")
	.action(async (title: string, options) => {
		const cwd = process.cwd();
		const core = new Core(cwd);
		const id = await generateNextId(core);
		const task = buildTaskFromOptions(id, title, options);
		const filepath = await core.createDraft(task, true);
		console.log(`Created draft ${id}`);
		console.log(`File: ${filepath}`);
	});

draftCmd
	.command("archive <taskId>")
	.description("archive a draft")
	.action(async (taskId: string) => {
		const cwd = process.cwd();
		const core = new Core(cwd);
		const success = await core.archiveDraft(taskId, true);
		if (success) {
			console.log(`Archived draft ${taskId}`);
		} else {
			console.error(`Draft ${taskId} not found.`);
		}
	});

draftCmd
	.command("promote <taskId>")
	.description("promote draft to task")
	.action(async (taskId: string) => {
		const cwd = process.cwd();
		const core = new Core(cwd);
		const success = await core.promoteDraft(taskId, true);
		if (success) {
			console.log(`Promoted draft ${taskId}`);
		} else {
			console.error(`Draft ${taskId} not found.`);
		}
	});

const boardCmd = program.command("board");

function addBoardOptions(cmd: Command) {
	return cmd
		.option("-l, --layout <layout>", "board layout (horizontal|vertical)", "horizontal")
		.option("--vertical", "use vertical layout (shortcut for --layout vertical)");
}

// TaskWithMetadata and resolveTaskConflict are now imported from remote-tasks.ts

async function handleBoardView(options: { layout?: string; vertical?: boolean }) {
	const cwd = process.cwd();
	const core = new Core(cwd);
	const config = await core.filesystem.loadConfig();
	const statuses = config?.statuses || [];
	const resolutionStrategy = config?.taskResolutionStrategy || "most_progressed";

	// Load tasks with loading screen for better user experience
	const allTasks = await (async () => {
		const loadingScreen = await createLoadingScreen("Loading board");

		try {
			// Load local and remote tasks in parallel
			loadingScreen?.update("Loading tasks from local and remote branches...");
			const [localTasks, remoteTasks] = await Promise.all([
				core.listTasksWithMetadata(),
				loadRemoteTasks(core.gitOps, core.filesystem),
			]);

			// Create map with local tasks
			const tasksById = new Map<string, Task>(localTasks.map((t) => [t.id, { ...t, source: "local" }]));

			// Merge remote tasks with local tasks
			for (const remoteTask of remoteTasks) {
				const existing = tasksById.get(remoteTask.id);
				if (!existing) {
					tasksById.set(remoteTask.id, remoteTask);
				} else {
					const resolved = resolveTaskConflict(existing, remoteTask, statuses, resolutionStrategy);
					tasksById.set(remoteTask.id, resolved);
				}
			}

			// Get the latest directory location of each task across all branches
			// Use optimized version that only checks the tasks we have
			loadingScreen?.update("Resolving task states across branches...");
			const tasks = Array.from(tasksById.values());
			const taskIds = tasks.map((t) => t.id);
			const latestTaskDirectories = await getLatestTaskStatesForIds(core.gitOps, core.filesystem, taskIds, (msg) => {
				loadingScreen?.update(msg);
			});

			// Filter tasks based on their latest directory location
			// Only show tasks whose latest directory type is "task" (not draft or archived)
			loadingScreen?.update("Filtering active tasks...");
			const filteredTasks = filterTasksByLatestState(tasks, latestTaskDirectories);

			loadingScreen?.close();
			return filteredTasks;
		} catch (error) {
			loadingScreen?.close();
			throw error;
		}
	})();

	if (allTasks.length === 0) {
		console.log("No tasks found.");
		return;
	}

	const _layout = options.vertical ? "vertical" : (options.layout as "horizontal" | "vertical") || "horizontal";
	const _maxColumnWidth = config?.maxColumnWidth || 20; // Default for terminal display

	// Use unified view for Tab switching support
	const { runUnifiedView } = await import("./ui/unified-view.ts");
	await runUnifiedView({
		core,
		initialView: "kanban",
		tasks: allTasks.map((t) => ({ ...t, status: t.status || "" })), // Ensure tasks have status
		// Pass the already-loaded kanban data to avoid duplicate loading
		preloadedKanbanData: {
			tasks: allTasks,
			statuses,
		},
	});
}

addBoardOptions(boardCmd).description("display tasks in a Kanban board").action(handleBoardView);

addBoardOptions(boardCmd.command("view").description("display tasks in a Kanban board")).action(handleBoardView);

boardCmd
	.command("export [filename]")
	.description("append kanban board to readme or output file")
	.option("-o, --output <path>", "output file (deprecated, use filename argument instead)")
	.action(async (filename, options) => {
		const cwd = process.cwd();
		const core = new Core(cwd);
		const config = await core.filesystem.loadConfig();
		const statuses = config?.statuses || [];
		const resolutionStrategy = config?.taskResolutionStrategy || "most_progressed";

		// Load tasks with progress tracking
		const loadingScreen = await createLoadingScreen("Loading tasks for export");

		try {
			// Load local tasks
			loadingScreen?.update("Loading local tasks...");
			const localTasks = await core.listTasksWithMetadata();
			const tasksById = new Map<string, TaskWithMetadata>(
				localTasks.map((t) => [t.id, { ...t, source: "local" } as TaskWithMetadata]),
			);
			loadingScreen?.update(`Found ${localTasks.length} local tasks`);

			// Load remote tasks in parallel
			loadingScreen?.update("Loading remote tasks...");
			const remoteTasks = await loadRemoteTasks(core.gitOps, core.filesystem, (msg) => loadingScreen?.update(msg));

			// Merge remote tasks with local tasks
			loadingScreen?.update("Merging tasks...");
			for (const remoteTask of remoteTasks) {
				const existing = tasksById.get(remoteTask.id);
				if (!existing) {
					tasksById.set(remoteTask.id, remoteTask);
				} else {
					const resolved = resolveTaskConflict(existing, remoteTask, statuses, resolutionStrategy);
					tasksById.set(remoteTask.id, resolved);
				}
			}

			// Get the latest state of each task across all branches
			loadingScreen?.update("Checking task states across branches...");
			const tasks = Array.from(tasksById.values());
			const taskIds = tasks.map((t) => t.id);
			const latestTaskDirectories = await getLatestTaskStatesForIds(core.gitOps, core.filesystem, taskIds, (msg) =>
				loadingScreen?.update(msg),
			);

			// Filter tasks based on their latest directory location
			// Only show tasks whose latest directory type is "task" (not draft or archived)
			const finalTasks = filterTasksByLatestState(tasks, latestTaskDirectories);

			loadingScreen?.update(`Total tasks: ${finalTasks.length}`);

			// Close loading screen before export
			loadingScreen?.close();

			// Priority: filename argument > --output option > default README.md
			const outputFile = filename || options.output || "README.md";
			const outputPath = join(cwd, outputFile as string);
			const maxColumnWidth = config?.maxColumnWidth || 30; // Default for export
			const addTitle = !filename && !options.output; // Add title only for default readme export
			await exportKanbanBoardToFile(finalTasks, statuses, outputPath, maxColumnWidth, addTitle);
			console.log(`Exported board to ${outputPath}`);
		} catch (error) {
			loadingScreen?.close();
			throw error;
		}
	});

const docCmd = program.command("doc");

docCmd
	.command("create <title>")
	.option("-p, --path <path>")
	.option("-t, --type <type>")
	.action(async (title: string, options) => {
		const cwd = process.cwd();
		const core = new Core(cwd);
		const id = await generateNextDocId(core);
		const document: DocType = {
			id,
			title: title as string,
			type: (options.type || "other") as DocType["type"],
			createdDate: new Date().toISOString().split("T")[0] || new Date().toISOString().slice(0, 10),
			content: "",
		};
		await core.createDocument(document, true, options.path || "");
		console.log(`Created document ${id}`);
	});

docCmd
	.command("list")
	.option("--plain", "use plain text output instead of interactive UI")
	.action(async (options) => {
		const cwd = process.cwd();
		const core = new Core(cwd);
		const docs = await core.filesystem.listDocuments();
		if (docs.length === 0) {
			console.log("No docs found.");
			return;
		}

		// Plain text output
		// Workaround for bun compile issue with commander options
		const isPlainFlag = options.plain || process.argv.includes("--plain");
		if (isPlainFlag) {
			for (const d of docs) {
				console.log(`${d.id} - ${d.title}`);
			}
			return;
		}

		// Interactive UI
		const selected = await genericSelectList("Select a document", docs);
		if (selected) {
			// Show document details
			const files = await Array.fromAsync(new Bun.Glob("*.md").scan({ cwd: core.filesystem.docsDir }));
			const docFile = files.find((f) => f.startsWith(`${selected.id} -`) || f === `${selected.id}.md`);
			if (docFile) {
				const filePath = join(core.filesystem.docsDir, docFile);
				const content = await Bun.file(filePath).text();
				await scrollableViewer(content);
			}
		}
	});

// Document view command
docCmd
	.command("view <docId>")
	.description("view a document")
	.action(async (docId: string) => {
		const cwd = process.cwd();
		const core = new Core(cwd);
		const files = await Array.fromAsync(new Bun.Glob("*.md").scan({ cwd: core.filesystem.docsDir }));
		const normalizedId = docId.startsWith("doc-") ? docId : `doc-${docId}`;
		const docFile = files.find((f) => f.startsWith(`${normalizedId} -`) || f === `${normalizedId}.md`);

		if (!docFile) {
			console.error(`Document ${docId} not found.`);
			return;
		}

		const filePath = join(core.filesystem.docsDir, docFile);
		const content = await Bun.file(filePath).text();

		// Use scrollableViewer which falls back to console.log if blessed is not available
		await scrollableViewer(content);
	});

const decisionCmd = program.command("decision");

decisionCmd
	.command("create <title>")
	.option("-s, --status <status>")
	.action(async (title: string, options) => {
		const cwd = process.cwd();
		const core = new Core(cwd);
		const id = await generateNextDecisionId(core);
		const decision: DecisionLog = {
			id,
			title: title as string,
			date: new Date().toISOString().split("T")[0] || new Date().toISOString().slice(0, 10),
			status: (options.status || "proposed") as DecisionLog["status"],
			context: "",
			decision: "",
			consequences: "",
		};
		await core.createDecisionLog(decision, true);
		console.log(`Created decision ${id}`);
	});

// Agents command group
const agentsCmd = program.command("agents");

agentsCmd
	.description("manage agent instruction files")
	.option(
		"--update-instructions",
		"update agent instruction files (.cursorrules, CLAUDE.md, AGENTS.md, GEMINI.md, .github/copilot-instructions.md)",
	)
	.action(async (options) => {
		if (!options.updateInstructions) {
			agentsCmd.help();
			return;
		}
		try {
			const cwd = process.cwd();
			const core = new Core(cwd);

			// Check if backlog project is initialized
			const config = await core.filesystem.loadConfig();
			if (!config) {
				console.error("No backlog project found. Initialize one first with: backlog init");
				process.exit(1);
			}

			const agentOptions = [
				".cursorrules",
				"CLAUDE.md",
				"AGENTS.md",
				"GEMINI.md",
				".github/copilot-instructions.md",
			] as const;

			const { files: selected } = await prompts({
				type: "multiselect",
				name: "files",
				message: "Select agent instruction files to update",
				choices: agentOptions.map((name) => ({
					title: name === ".github/copilot-instructions.md" ? "Copilot" : name,
					value: name,
				})),
				hint: "Space to select, Enter to confirm",
				instructions: false,
			});

			const files: AgentInstructionFile[] = (selected ?? []) as AgentInstructionFile[];

			if (files.length > 0) {
				await addAgentInstructions(cwd, core.gitOps, files);
				console.log(`Updated ${files.length} agent instruction file(s): ${files.join(", ")}`);
			} else {
				console.log("No files selected for update.");
			}
		} catch (err) {
			console.error("Failed to update agent instructions", err);
			process.exitCode = 1;
		}
	});

// Config command group
const configCmd = program.command("config");

configCmd
	.command("get <key>")
	.description("get a configuration value")
	.action(async (key: string) => {
		try {
			const cwd = process.cwd();
			const core = new Core(cwd);
			const config = await core.filesystem.loadConfig();

			if (!config) {
				console.error("No backlog project found. Initialize one first with: backlog init");
				process.exit(1);
			}

			// Handle specific config keys
			switch (key) {
				case "defaultEditor":
					if (config.defaultEditor) {
						console.log(config.defaultEditor);
					} else {
						console.log("defaultEditor is not set");
						process.exit(1);
					}
					break;
				case "projectName":
					console.log(config.projectName);
					break;
				case "defaultStatus":
					console.log(config.defaultStatus || "");
					break;
				case "statuses":
					console.log(config.statuses.join(", "));
					break;
				case "labels":
					console.log(config.labels.join(", "));
					break;
				case "milestones":
					console.log(config.milestones.join(", "));
					break;
				case "dateFormat":
					console.log(config.dateFormat);
					break;
				case "maxColumnWidth":
					console.log(config.maxColumnWidth?.toString() || "");
					break;
				case "backlogDirectory":
					console.log(config.backlogDirectory || "");
					break;
				case "defaultPort":
					console.log(config.defaultPort?.toString() || "");
					break;
				case "autoOpenBrowser":
					console.log(config.autoOpenBrowser?.toString() || "");
					break;
				default:
					console.error(`Unknown config key: ${key}`);
					console.error(
						"Available keys: defaultEditor, projectName, defaultStatus, statuses, labels, milestones, dateFormat, maxColumnWidth, backlogDirectory, defaultPort, autoOpenBrowser",
					);
					process.exit(1);
			}
		} catch (err) {
			console.error("Failed to get config value", err);
			process.exitCode = 1;
		}
	});

configCmd
	.command("set <key> <value>")
	.description("set a configuration value")
	.action(async (key: string, value: string) => {
		try {
			const cwd = process.cwd();
			const core = new Core(cwd);
			const config = await core.filesystem.loadConfig();

			if (!config) {
				console.error("No backlog project found. Initialize one first with: backlog init");
				process.exit(1);
			}

			// Handle specific config keys
			switch (key) {
				case "defaultEditor": {
					// Validate that the editor command exists
					const { isEditorAvailable } = await import("./utils/editor.ts");
					const isAvailable = await isEditorAvailable(value);
					if (!isAvailable) {
						console.error(`Editor command not found: ${value}`);
						console.error("Please ensure the editor is installed and available in your PATH");
						process.exit(1);
					}
					config.defaultEditor = value;
					break;
				}
				case "projectName":
					config.projectName = value;
					break;
				case "defaultStatus":
					config.defaultStatus = value;
					break;
				case "dateFormat":
					config.dateFormat = value;
					break;
				case "maxColumnWidth": {
					const width = Number.parseInt(value, 10);
					if (Number.isNaN(width) || width <= 0) {
						console.error("maxColumnWidth must be a positive number");
						process.exit(1);
					}
					config.maxColumnWidth = width;
					break;
				}
				case "backlogDirectory":
					config.backlogDirectory = value;
					break;
				case "autoOpenBrowser": {
					const boolValue = value.toLowerCase();
					if (boolValue === "true" || boolValue === "1" || boolValue === "yes") {
						config.autoOpenBrowser = true;
					} else if (boolValue === "false" || boolValue === "0" || boolValue === "no") {
						config.autoOpenBrowser = false;
					} else {
						console.error("autoOpenBrowser must be true or false");
						process.exit(1);
					}
					break;
				}
				case "defaultPort": {
					const port = Number.parseInt(value, 10);
					if (Number.isNaN(port) || port < 1 || port > 65535) {
						console.error("defaultPort must be a valid port number (1-65535)");
						process.exit(1);
					}
					config.defaultPort = port;
					break;
				}
				case "statuses":
				case "labels":
				case "milestones":
					console.error(`${key} cannot be set directly. Use 'backlog config list-${key}' to view current values.`);
					console.error("Array values should be edited in the config file directly.");
					process.exit(1);
					break;
				default:
					console.error(`Unknown config key: ${key}`);
					console.error(
						"Available keys: defaultEditor, projectName, defaultStatus, dateFormat, maxColumnWidth, backlogDirectory, autoOpenBrowser, defaultPort",
					);
					process.exit(1);
			}

			await core.filesystem.saveConfig(config);
			console.log(`Set ${key} = ${value}`);
		} catch (err) {
			console.error("Failed to set config value", err);
			process.exitCode = 1;
		}
	});

configCmd
	.command("list")
	.description("list all configuration values")
	.action(async () => {
		try {
			const cwd = process.cwd();
			const core = new Core(cwd);
			const config = await core.filesystem.loadConfig();

			if (!config) {
				console.error("No backlog project found. Initialize one first with: backlog init");
				process.exit(1);
			}

			console.log("Configuration:");
			console.log(`  projectName: ${config.projectName}`);
			console.log(`  defaultEditor: ${config.defaultEditor || "(not set)"}`);
			console.log(`  defaultStatus: ${config.defaultStatus || "(not set)"}`);
			console.log(`  statuses: [${config.statuses.join(", ")}]`);
			console.log(`  labels: [${config.labels.join(", ")}]`);
			console.log(`  milestones: [${config.milestones.join(", ")}]`);
			console.log(`  dateFormat: ${config.dateFormat}`);
			console.log(`  maxColumnWidth: ${config.maxColumnWidth || "(not set)"}`);
			console.log(`  backlogDirectory: ${config.backlogDirectory || "(not set)"}`);
			console.log(`  autoOpenBrowser: ${config.autoOpenBrowser ?? "(not set)"}`);
			console.log(`  defaultPort: ${config.defaultPort ?? "(not set)"}`);
		} catch (err) {
			console.error("Failed to list config values", err);
			process.exitCode = 1;
		}
	});

// Browser command for web UI
program
	.command("browser")
	.description("open browser interface for task management (press Ctrl+C or Cmd+C to stop)")
	.option("-p, --port <port>", "port to run server on")
	.option("--no-open", "don't automatically open browser")
	.action(async (options) => {
		try {
			const cwd = process.cwd();
			const { BacklogServer } = await import("./server/index.ts");
			const server = new BacklogServer(cwd);

			// Load config to get default port
			const core = new Core(cwd);
			const config = await core.filesystem.loadConfig();
			const defaultPort = config?.defaultPort ?? 6420;

			const port = Number.parseInt(options.port || defaultPort.toString(), 10);
			if (Number.isNaN(port) || port < 1 || port > 65535) {
				console.error("Invalid port number. Must be between 1 and 65535.");
				process.exit(1);
			}

			await server.start(port, options.open !== false);

			// Keep the process running
			process.on("SIGINT", async () => {
				console.log("\nShutting down server...");
				await server.stop();
				process.exit(0);
			});
		} catch (err) {
			console.error("Failed to start browser interface", err);
			process.exitCode = 1;
		}
	});

program.parseAsync(process.argv);
