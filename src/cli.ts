import { mkdir } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { stdin as input, stdout as output } from "node:process";
import { createInterface } from "node:readline/promises";
// Interactive TUI helpers (bblessed based)
import { multiSelect, promptText, scrollableViewer, selectList } from "./ui/tui.ts";

// Kanban TUI renderer
import { renderBoardTui } from "./ui/board.ts";

import { Command } from "commander";
import { DEFAULT_STATUSES, FALLBACK_STATUS } from "./constants/index.ts";
import {
	type AgentInstructionFile,
	Core,
	addAgentInstructions,
	exportKanbanBoardToFile,
	initializeGitRepository,
	isGitRepository,
	parseTask,
} from "./index.ts";
import type { DecisionLog, Document as DocType, Task } from "./types/index.ts";

const program = new Command();
program.name("backlog").description("Backlog project management CLI");

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

			const reporter = (await promptText("Default reporter name (leave blank to skip):")) || "";
			let storeGlobal = false;
			if (reporter) {
				const store = (await promptText("Store reporter name globally? [y/N]", "N")).toLowerCase();
				storeGlobal = store.startsWith("y");
			}

			const options = [".cursorrules", "CLAUDE.md", "AGENTS.md", "readme.md"] as const;
			const selected = await multiSelect("Select agent instruction files to update", options as unknown as string[]);
			const files: AgentInstructionFile[] = (selected ?? []) as AgentInstructionFile[];

			const core = new Core(cwd);
			await core.initializeProject(name);
			console.log(`Initialized backlog project: ${name}`);

			if (files.length > 0) {
				await addAgentInstructions(cwd, core.gitOps, files);
			}

			if (reporter) {
				if (storeGlobal) {
					const globalPath = join(homedir(), ".backlog", "user");
					await mkdir(dirname(globalPath), { recursive: true });
					await Bun.write(globalPath, `default_reporter: "${reporter}"\n`);
				} else {
					const userPath = join(cwd, ".user");
					await Bun.write(userPath, `default_reporter: "${reporter}"\n`);
					const gitignorePath = join(cwd, ".gitignore");
					let gitignore = "";
					try {
						gitignore = await Bun.file(gitignorePath).text();
					} catch {}
					if (!gitignore.split(/\r?\n/).includes(".user")) {
						gitignore += `${gitignore.endsWith("\n") ? "" : "\n"}.user\n`;
						await Bun.write(gitignorePath, gitignore);
					}
				}
			}
		} catch (err) {
			console.error("Failed to initialize project", err);
			process.exitCode = 1;
		}
	});

async function generateNextId(core: Core, parent?: string): Promise<string> {
	const tasks = await core.filesystem.listTasks();
	const drafts = await core.filesystem.listDrafts();
	const all = [...tasks, ...drafts];

	const remoteIds: string[] = [];
	try {
		await core.gitOps.fetch();
		const branches = await core.gitOps.listRemoteBranches();
		for (const branch of branches) {
			const files = await core.gitOps.listFilesInRemoteBranch(branch, ".backlog/tasks");
			for (const file of files) {
				const match = file.match(/task-([\d.]+)/);
				if (match) remoteIds.push(`task-${match[1]}`);
			}
		}
	} catch {}

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
		for (const id of remoteIds) {
			if (id.startsWith(`${prefix}.`)) {
				const rest = id.slice(prefix.length + 1);
				const num = Number.parseInt(rest.split(".")[0] || "0", 10);
				if (num > max) max = num;
			}
		}
		return `${prefix}.${max + 1}`;
	}

	let max = -1;
	for (const t of all) {
		const match = t.id.match(/^task-(\d+)/);
		if (match) {
			const num = Number.parseInt(match[1], 10);
			if (num > max) max = num;
		}
	}
	for (const id of remoteIds) {
		const match = id.match(/^task-(\d+)/);
		if (match) {
			const num = Number.parseInt(match[1], 10);
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
			const num = Number.parseInt(match[1], 10);
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
			const num = Number.parseInt(match[1], 10);
			if (num > max) max = num;
		}
	}
	return `doc-${max + 1}`;
}

function buildTaskFromOptions(id: string, title: string, options: Record<string, unknown>): Task {
	const parentInput = options.parent ? String(options.parent) : undefined;
	const normalizedParent = parentInput
		? parentInput.startsWith("task-")
			? parentInput
			: `task-${parentInput}`
		: undefined;

	return {
		id,
		title,
		status: options.status || "",
		assignee: options.assignee ? [String(options.assignee)] : [],
		createdDate: new Date().toISOString().split("T")[0],
		labels: options.labels
			? String(options.labels)
					.split(",")
					.map((l: string) => l.trim())
					.filter(Boolean)
			: [],
		dependencies: [],
		description: options.description || "",
		...(normalizedParent && { parentTaskId: normalizedParent }),
	};
}

const taskCmd = program.command("task").aliases(["tasks"]);

taskCmd
	.command("create <title>")
	.option("-d, --description <text>")
	.option("-a, --assignee <assignee>")
	.option("-s, --status <status>")
	.option("-l, --labels <labels>")
	.option("--draft")
	.option("--parent <taskId>")
	.action(async (title: string, options) => {
		const cwd = process.cwd();
		const core = new Core(cwd);
		const id = await generateNextId(core, options.parent);
		const task = buildTaskFromOptions(id, title, options);
		if (options.draft) {
			await core.createDraft(task, true);
			console.log(`Created draft ${id}`);
		} else {
			await core.createTask(task, true);
			console.log(`Created task ${id}`);
		}
	});

taskCmd
	.command("list")
	.description("list tasks grouped by status")
	.option("--plain", "use plain text output instead of interactive UI")
	.action(async (options) => {
		const cwd = process.cwd();
		const core = new Core(cwd);
		const tasks = await core.filesystem.listTasks();
		const config = await core.filesystem.loadConfig();

		if (tasks.length === 0) {
			console.log("No tasks found.");
			return;
		}

		// Plain text output
		if (options.plain) {
			const groups = new Map<string, Task[]>();
			for (const task of tasks) {
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

		// Interactive UI
		const selected = await selectList("Select a task", tasks, (task) => task.status || "No Status");
		if (selected) {
			// Show task details
			const files = await Array.fromAsync(new Bun.Glob("*.md").scan({ cwd: core.filesystem.tasksDir }));
			const taskFile = files.find((f) => f.startsWith(`${selected.id} -`));
			if (taskFile) {
				const filePath = join(core.filesystem.tasksDir, taskFile);
				const content = await Bun.file(filePath).text();
				await scrollableViewer(content);
			}
		}
	});

taskCmd
	.command("edit <taskId>")
	.description("edit an existing task")
	.option("-t, --title <title>")
	.option("-d, --description <text>")
	.option("-a, --assignee <assignee>")
	.option("-s, --status <status>")
	.option("-l, --label <labels>")
	.option("--add-label <label>")
	.option("--remove-label <label>")
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
		if (options.description) {
			task.description = String(options.description);
		}
		if (typeof options.assignee !== "undefined") {
			task.assignee = [String(options.assignee)];
		}
		if (options.status) {
			task.status = String(options.status);
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
		task.updatedDate = new Date().toISOString().split("T")[0];

		await core.updateTask(task, true);
		console.log(`Updated task ${task.id}`);
	});

taskCmd
	.command("view <taskId>")
	.description("display task details")
	.action(async (taskId: string) => {
		const cwd = process.cwd();
		const core = new Core(cwd);
		const files = await Array.fromAsync(new Bun.Glob("*.md").scan({ cwd: core.filesystem.tasksDir }));
		const normalizedId = taskId.startsWith("task-") ? taskId : `task-${taskId}`;
		const taskFile = files.find((f) => f.startsWith(`${normalizedId} -`));

		if (!taskFile) {
			console.error(`Task ${taskId} not found.`);
			return;
		}

		const filePath = join(core.filesystem.tasksDir, taskFile);
		const content = await Bun.file(filePath).text();

		// Use scrollableViewer which falls back to console.log if blessed is not available
		await scrollableViewer(content);
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

taskCmd.argument("[taskId]").action(async (taskId: string | undefined) => {
	if (!taskId) {
		taskCmd.help();
		return;
	}
	// Use the view command directly
	const cwd = process.cwd();
	const core = new Core(cwd);
	const files = await Array.fromAsync(new Bun.Glob("*.md").scan({ cwd: core.filesystem.tasksDir }));
	const normalizedId = taskId.startsWith("task-") ? taskId : `task-${taskId}`;
	const taskFile = files.find((f) => f.startsWith(`${normalizedId} -`));

	if (!taskFile) {
		console.error(`Task ${taskId} not found.`);
		return;
	}

	const filePath = join(core.filesystem.tasksDir, taskFile);
	const content = await Bun.file(filePath).text();
	await scrollableViewer(content);
});

const draftCmd = program.command("draft");

draftCmd
	.command("create <title>")
	.option("-d, --description <text>")
	.option("-a, --assignee <assignee>")
	.option("-s, --status <status>")
	.option("-l, --labels <labels>")
	.action(async (title: string, options) => {
		const cwd = process.cwd();
		const core = new Core(cwd);
		const id = await generateNextId(core);
		const task = buildTaskFromOptions(id, title, options);
		await core.createDraft(task, true);
		console.log(`Created draft ${id}`);
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

async function handleBoardView(options: { layout?: string; vertical?: boolean }) {
	const cwd = process.cwd();
	const core = new Core(cwd);
	const config = await core.filesystem.loadConfig();
	const statuses = config?.statuses || [];

	const localTasks = await core.filesystem.listTasks();
	const tasksById = new Map(localTasks.map((t) => [t.id, t]));

	try {
		await core.gitOps.fetch();
		const branches = await core.gitOps.listRemoteBranches();

		for (const branch of branches) {
			const ref = `origin/${branch}`;
			const files = await core.gitOps.listFilesInTree(ref, ".backlog/tasks");
			for (const file of files) {
				const content = await core.gitOps.showFile(ref, file);
				const task = parseTask(content);
				const existing = tasksById.get(task.id);
				if (!existing) {
					tasksById.set(task.id, task);
					continue;
				}

				const currentIdx = statuses.indexOf(existing.status);
				const newIdx = statuses.indexOf(task.status);
				if (newIdx > currentIdx || currentIdx === -1 || newIdx === currentIdx) {
					tasksById.set(task.id, task);
				}
			}
		}
	} catch {
		// Ignore remote errors
	}

	const allTasks = Array.from(tasksById.values());

	if (allTasks.length === 0) {
		console.log("No tasks found.");
		return;
	}

	const layout = options.vertical ? "vertical" : (options.layout as "horizontal" | "vertical") || "horizontal";
	const maxColumnWidth = config?.maxColumnWidth || 20; // Default for terminal display
	// Always use renderBoardTui which falls back to plain text if blessed is not available
	await renderBoardTui(allTasks, statuses, layout, maxColumnWidth);
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

		const localTasks = await core.filesystem.listTasks();
		const tasksById = new Map(localTasks.map((t) => [t.id, t]));

		try {
			await core.gitOps.fetch();
			const branches = await core.gitOps.listRemoteBranches();

			for (const branch of branches) {
				const ref = `origin/${branch}`;
				const files = await core.gitOps.listFilesInTree(ref, ".backlog/tasks");
				for (const file of files) {
					const content = await core.gitOps.showFile(ref, file);
					const task = parseTask(content);
					const existing = tasksById.get(task.id);
					if (!existing) {
						tasksById.set(task.id, task);
						continue;
					}

					const currentIdx = statuses.indexOf(existing.status);
					const newIdx = statuses.indexOf(task.status);
					if (newIdx > currentIdx || currentIdx === -1 || newIdx === currentIdx) {
						tasksById.set(task.id, task);
					}
				}
			}
		} catch {
			// Ignore remote errors
		}

		const allTasks = Array.from(tasksById.values());
		// Priority: filename argument > --output option > default readme.md
		const outputFile = filename || options.output || "readme.md";
		const outputPath = join(cwd, outputFile as string);
		const maxColumnWidth = config?.maxColumnWidth || 30; // Default for export
		const addTitle = !filename && !options.output; // Add title only for default readme export
		await exportKanbanBoardToFile(allTasks, statuses, outputPath, maxColumnWidth, addTitle);
		console.log(`Exported board to ${outputPath}`);
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
			title,
			type: (options.type || "other") as DocType["type"],
			createdDate: new Date().toISOString().split("T")[0],
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
		if (options.plain) {
			for (const d of docs) {
				console.log(`${d.id} - ${d.title}`);
			}
			return;
		}

		// Interactive UI
		const selected = await selectList("Select a document", docs);
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
			title,
			date: new Date().toISOString().split("T")[0],
			status: (options.status || "proposed") as DecisionLog["status"],
			context: "",
			decision: "",
			consequences: "",
		};
		await core.createDecisionLog(decision, true);
		console.log(`Created decision ${id}`);
	});

decisionCmd
	.command("list")
	.option("--plain", "use plain text output instead of interactive UI")
	.action(async (options) => {
		const cwd = process.cwd();
		const core = new Core(cwd);
		const decisions = await core.filesystem.listDecisionLogs();
		if (decisions.length === 0) {
			console.log("No decisions found.");
			return;
		}

		// Plain text output
		if (options.plain) {
			for (const d of decisions) {
				console.log(`${d.id} - ${d.title}`);
			}
			return;
		}

		// Interactive UI
		const selected = await selectList("Select a decision", decisions);
		if (selected) {
			// Show decision details
			const files = await Array.fromAsync(new Bun.Glob("*.md").scan({ cwd: core.filesystem.decisionsDir }));
			const decisionFile = files.find((f) => f.startsWith(`${selected.id} -`) || f === `${selected.id}.md`);
			if (decisionFile) {
				const filePath = join(core.filesystem.decisionsDir, decisionFile);
				const content = await Bun.file(filePath).text();
				await scrollableViewer(content);
			}
		}
	});

const configCmd = program.command("config");

configCmd
	.command("get <key>")
	.description("get configuration value")
	.action(async (key: string) => {
		const cwd = process.cwd();
		const core = new Core(cwd);
		const localCfg = await core.filesystem.loadConfig();
		const localVal = localCfg ? (localCfg as unknown as Record<string, unknown>)[key] : undefined;
		if (localVal !== undefined) {
			console.log(localVal);
			return;
		}
		const globalVal = await core.filesystem.getUserSetting(key, true);
		if (globalVal !== undefined) {
			console.log(globalVal);
			return;
		}
		const defaults: Record<string, unknown> = {
			statuses: DEFAULT_STATUSES,
			defaultStatus: FALLBACK_STATUS,
		};
		if (key in defaults) {
			console.log(defaults[key]);
		}
	});

configCmd
	.command("set <key> <value>")
	.description("set configuration value")
	.option("--global", "save to global user config")
	.option("--local", "save to local project config")
	.action(async (key: string, value: string, options) => {
		const cwd = process.cwd();
		const core = new Core(cwd);
		if (options.global) {
			await core.filesystem.setUserSetting(key, value, true);
			console.log(`Set ${key} in global config`);
		} else {
			const cfg = (await core.filesystem.loadConfig()) || {
				projectName: "",
				statuses: [...DEFAULT_STATUSES],
				labels: [],
				milestones: [],
				defaultStatus: FALLBACK_STATUS,
				dateFormat: "YYYY-MM-DD",
			};
			(cfg as unknown as Record<string, unknown>)[key] = value;
			await core.filesystem.saveConfig(cfg);
			console.log(`Set ${key} in local config`);
		}
	});

program.parseAsync(process.argv);
