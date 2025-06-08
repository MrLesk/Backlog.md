import { join } from "node:path";
import { stdin as input, stdout as output } from "node:process";
import { createInterface } from "node:readline/promises";

import { Command } from "commander";
import { Core, initializeGitRepository, isGitRepository } from "./index.ts";
import type { Task } from "./types/index.ts";

const program = new Command();
program.name("backlog").description("Backlog project management CLI");

program
	.command("init <projectName>")
	.description("initialize backlog project in the current repository")
	.action(async (projectName: string) => {
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
					return;
				}
			}

			const core = new Core(cwd);
			await core.initializeProject(projectName);
			console.log(`Initialized backlog project: ${projectName}`);
		} catch (err) {
			console.error("Failed to initialize project", err);
			process.exitCode = 1;
		}
	});

async function generateNextId(core: Core, parent?: string): Promise<string> {
	const tasks = await core.filesystem.listTasks();
	const drafts = await core.filesystem.listDrafts();
	const all = [...tasks, ...drafts];

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
	return `task-${max + 1}`;
}

function buildTaskFromOptions(id: string, title: string, options: Record<string, unknown>): Task {
	return {
		id,
		title,
		status: options.status || "",
		assignee: options.assignee,
		createdDate: new Date().toISOString().split("T")[0],
		labels: options.labels
			? String(options.labels)
					.split(",")
					.map((l: string) => l.trim())
					.filter(Boolean)
			: [],
		dependencies: [],
		description: options.description || "",
		...(options.parent && { parentTaskId: options.parent }),
	};
}

const taskCmd = program.command("task").aliases(["tasks"]);

taskCmd
	.command("create <title>")
	.option("-d, --description <text>")
	.option("-a, --assignee <assignee>")
	.option("-s, --status <status>")
	.option("-l, --labels <labels>")
	.option("--parent <taskId>")
	.action(async (title: string, options) => {
		const cwd = process.cwd();
		const core = new Core(cwd);
		const id = await generateNextId(core, options.parent);
		const task = buildTaskFromOptions(id, title, options);
		await core.createTask(task, true);
		console.log(`Created task ${id}`);
	});

taskCmd
	.command("list")
	.description("list tasks grouped by status")
	.action(async () => {
		const cwd = process.cwd();
		const core = new Core(cwd);
		const tasks = await core.filesystem.listTasks();
		const config = await core.filesystem.loadConfig();

		if (tasks.length === 0) {
			console.log("No tasks found.");
			return;
		}

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
			task.assignee = String(options.assignee);
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

async function outputTask(taskId: string): Promise<void> {
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
	console.log(content);
}

taskCmd
	.command("view <taskId>")
	.description("display task details")
	.action(async (taskId: string) => {
		await outputTask(taskId);
	});

taskCmd.argument("[taskId]").action(async (taskId: string | undefined) => {
	if (!taskId) {
		taskCmd.help();
		return;
	}
	await outputTask(taskId);
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

program.parseAsync(process.argv);
