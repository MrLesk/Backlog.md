/**
 * Platform-aware test helpers that avoid memory issues on Windows CI
 * by testing Core directly instead of spawning CLI processes
 */

import { join } from "node:path";
import { Core } from "../core/backlog.ts";

const CLI_PATH = join(process.cwd(), "src", "cli.ts");
const isWindows = process.platform === "win32";

export interface TaskCreateOptions {
	title: string;
	description?: string;
	assignee?: string;
	status?: string;
	labels?: string;
	priority?: string;
	ac?: string;
	plan?: string;
	draft?: boolean;
	parent?: string;
	dependencies?: string;
}

/**
 * Platform-aware task creation that uses Core directly on Windows
 * and CLI spawning on Unix systems
 */
export async function createTaskPlatformAware(
	options: TaskCreateOptions,
	testDir: string,
): Promise<{ exitCode: number; stdout: string; stderr: string; taskId?: string }> {
	if (isWindows) {
		// Test Core directly on Windows to avoid memory issues
		return createTaskViaCore(options, testDir);
	}
	// Test CLI integration on Unix systems
	return createTaskViaCLI(options, testDir);
}

async function createTaskViaCore(
	options: TaskCreateOptions,
	testDir: string,
): Promise<{ exitCode: number; stdout: string; stderr: string; taskId?: string }> {
	try {
		const core = new Core(testDir);

		// Generate next ID (mimicking CLI behavior)
		const tasks = await core.filesystem.listTasks();
		const drafts = await core.filesystem.listDrafts();
		const maxId = Math.max(
			...tasks.map((t) => Number.parseInt(t.id.replace("task-", "") || "0")),
			...drafts.map((d) => Number.parseInt(d.id.replace("task-", "") || "0")),
			0,
		);
		const taskId = `task-${maxId + 1}`;

		// Build task object (mimicking CLI buildTaskFromOptions)
		const task = {
			id: taskId,
			title: options.title,
			status: options.status || "",
			assignee: options.assignee ? [options.assignee] : [],
			createdDate: new Date().toISOString().split("T")[0] || new Date().toISOString().slice(0, 10),
			labels: options.labels
				? options.labels
						.split(",")
						.map((l) => l.trim())
						.filter(Boolean)
				: [],
			dependencies: options.dependencies
				? options.dependencies
						.split(",")
						.map((dep) => (dep.trim().startsWith("task-") ? dep.trim() : `task-${dep.trim()}`))
				: [],
			description: options.description || "",
			...(options.parent && {
				parentTaskId: options.parent.startsWith("task-") ? options.parent : `task-${options.parent}`,
			}),
			...(options.priority && { priority: options.priority as "high" | "medium" | "low" }),
		};

		// Handle acceptance criteria
		if (options.ac) {
			const { updateTaskAcceptanceCriteria } = await import("../markdown/serializer.ts");
			const criteria = options.ac
				.split(",")
				.map((item) => item.trim())
				.filter(Boolean);
			task.description = updateTaskAcceptanceCriteria(task.description, criteria);
		}

		// Handle implementation plan
		if (options.plan) {
			const { updateTaskImplementationPlan } = await import("../markdown/serializer.ts");
			task.description = updateTaskImplementationPlan(task.description, options.plan);
		}

		// Create task or draft
		if (options.draft) {
			await core.createDraft(task, false);
			return {
				exitCode: 0,
				stdout: `Created draft ${taskId}`,
				stderr: "",
				taskId,
			};
		}
		await core.createTask(task, false);
		return {
			exitCode: 0,
			stdout: `Created task ${taskId}`,
			stderr: "",
			taskId,
		};
	} catch (error) {
		return {
			exitCode: 1,
			stdout: "",
			stderr: error instanceof Error ? error.message : String(error),
		};
	}
}

function createTaskViaCLI(
	options: TaskCreateOptions,
	testDir: string,
): { exitCode: number; stdout: string; stderr: string; taskId?: string } {
	// Build CLI arguments
	const args = ["bun", CLI_PATH, "task", "create", options.title];

	if (options.description) args.push("--description", options.description);
	if (options.assignee) args.push("--assignee", options.assignee);
	if (options.status) args.push("--status", options.status);
	if (options.labels) args.push("--labels", options.labels);
	if (options.priority) args.push("--priority", options.priority);
	if (options.ac) args.push("--ac", options.ac);
	if (options.plan) args.push("--plan", options.plan);
	if (options.draft) args.push("--draft");
	if (options.parent) args.push("--parent", options.parent);
	if (options.dependencies) args.push("--dep", options.dependencies);

	const result = Bun.spawnSync(args, { cwd: testDir });

	// Extract task ID from stdout
	const match = result.stdout.toString().match(/Created (?:task|draft) (task-\d+)/);
	const taskId = match ? match[1] : undefined;

	return {
		exitCode: result.exitCode,
		stdout: result.stdout.toString(),
		stderr: result.stderr.toString(),
		taskId,
	};
}

export { isWindows };
