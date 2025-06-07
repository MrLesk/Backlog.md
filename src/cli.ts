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

const taskCmd = program.command("task");

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
