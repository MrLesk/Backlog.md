import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { copyFile, mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { Core } from "../index.ts";
import type { Task } from "../types/index.ts";
import { getTestCliPath } from "./test-cli.ts";
import {
	createUniqueTestDir,
	getPlatformTimeout,
	initializeFilesystemTestProject,
	isWindows,
	safeCleanup,
	waitUntil,
	withTimeout,
} from "./test-utils.ts";

const { getCandidatePackageNames } = require("../../scripts/resolveBinary.cjs");

const CLI = getTestCliPath();
const WATCH = ["task", "list", "--json", "--watch"];
let directory: string;
let core: Core;
const processes: ReturnType<typeof startWatch>[] = [];

function startWatch(args: string[] = []) {
	return follow(
		Bun.spawn(["bun", CLI, ...WATCH, ...args], {
			cwd: directory,
			stdin: "ignore",
			stdout: "pipe",
			stderr: "pipe",
		}),
	);
}

/** Start the watch from a throwaway process that hands it stdout and stderr, as a script or agent harness would. */
function startWatchFrom(command: string[]) {
	const starter = `Bun.spawn(${JSON.stringify(command)}, { stdio: ["ignore", "inherit", "inherit"] })`;
	return follow(
		Bun.spawn(["bun", "-e", starter], {
			cwd: directory,
			stdin: "ignore",
			stdout: "pipe",
			stderr: "pipe",
			// A POSIX process group lets cleanup stop anything the starter left behind.
			detached: !isWindows(),
		}),
	);
}

/** An npm launcher install whose platform binary is this Bun, so the launched binary runs the CLI path it is given. */
async function createLauncher(): Promise<string> {
	const launcher = join(directory, "launcher");
	const packageDir = join(launcher, "node_modules", getCandidatePackageNames()[0]);
	await mkdir(packageDir, { recursive: true });
	await copyFile(process.execPath, join(packageDir, isWindows() ? "backlog.exe" : "backlog"));
	for (const file of ["cli.cjs", "resolveBinary.cjs"]) {
		await copyFile(join(import.meta.dir, "..", "..", "scripts", file), join(launcher, file));
	}
	return join(launcher, "cli.cjs");
}

function follow(process: Bun.Subprocess<"ignore", "pipe", "pipe">): {
	process: Bun.Subprocess<"ignore", "pipe", "pipe">;
	snapshots: string[];
	stderr: Promise<string>;
	reading: Promise<void>;
} {
	const snapshots: string[] = [];
	const stderr = new Response(process.stderr).text();
	const reading = (async () => {
		const decoder = new TextDecoder();
		let buffer = "";
		for await (const chunk of process.stdout) {
			buffer += decoder.decode(chunk, { stream: true });
			// The existing pretty-printed envelope ends with an unindented closing brace.
			let end = buffer.indexOf("\n}\n");
			while (end !== -1) {
				snapshots.push(buffer.slice(0, end + 3));
				buffer = buffer.slice(end + 3);
				end = buffer.indexOf("\n}\n");
			}
		}
	})();
	const result = { process, snapshots, stderr, reading };
	processes.push(result);
	return result;
}

async function once(args: string[] = []) {
	const child = Bun.spawn(["bun", CLI, "task", "list", "--json", ...args], {
		cwd: directory,
		stdin: "ignore",
		stdout: "pipe",
		stderr: "pipe",
	});
	const [stdout, stderr, code] = await Promise.all([
		new Response(child.stdout).text(),
		new Response(child.stderr).text(),
		child.exited,
	]);
	expect(stderr).toBe("");
	expect(code).toBe(0);
	return stdout;
}

async function create(id: string, overrides: Partial<Task> = {}) {
	await core.createTask(
		{
			id,
			title: `Task ${id}`,
			status: "To Do",
			assignee: [],
			labels: [],
			dependencies: [],
			createdDate: "2026-09-12",
			rawContent: "",
			...overrides,
		},
		false,
	);
}

async function expectCurrent(watch: ReturnType<typeof startWatch>, args: string[] = []) {
	const expected = await once(args);
	await waitUntil(() => watch.snapshots.at(-1) === expected, "watch matching one-shot JSON", 5000);
	expect(watch.snapshots.at(-1)).toBe(expected);
}

describe("CLI JSON watch", () => {
	beforeEach(async () => {
		directory = createUniqueTestDir("json-watch");
		await mkdir(directory, { recursive: true });
		core = new Core(directory);
		await initializeFilesystemTestProject(core, "JSON watch");
	});

	afterEach(async () => {
		for (const watch of processes.splice(0)) {
			watch.process.kill();
			await watch.process.exited;
			await watch.reading;
		}
		core.disposeContentStore();
		core.disposeSearchService();
		await safeCleanup(directory);
	});

	it("preserves exact initial bytes, follows create/atomic edit/removal, and suppresses unchanged results", async () => {
		const watch = startWatch();
		await expectCurrent(watch);
		expect(JSON.parse(watch.snapshots[0] ?? "").tasks).toEqual([]);
		expect(watch.process.exitCode).toBeNull();

		await create("TASK-1", { title: 'Quoted "title" with } and a newline\ninside', labels: ["cli"] });
		await expectCurrent(watch);
		const task = await core.loadTaskById("TASK-1");
		const path = task?.filePath;
		if (!path) throw new Error("Missing task path");
		const markdown = await readFile(path, "utf8");
		await writeFile(`${path}.tmp`, markdown.replace("labels:", "priority: high\nlabels:"));
		await rename(`${path}.tmp`, path);
		await expectCurrent(watch);
		expect(JSON.parse(watch.snapshots.at(-1) ?? "").tasks[0].priority).toBe("high");

		const count = watch.snapshots.length;
		await writeFile(path, await readFile(path, "utf8"));
		await Bun.sleep(1300);
		expect(watch.snapshots).toHaveLength(count);
		await rm(path);
		await expectCurrent(watch);
		expect(JSON.parse(watch.snapshots.at(-1) ?? "").tasks).toEqual([]);
		expect(await once()).toBe(watch.snapshots.at(-1) ?? "");
		watch.process.kill("SIGTERM");
		await watch.process.exited;
		expect(await watch.stderr).toBe("");
	});

	it("reapplies filters, sorting and limits as tasks enter and leave the result", async () => {
		await create("TASK-1", { priority: "low", labels: ["cli"] });
		await create("TASK-2", { priority: "high", status: "Done", labels: ["cli"] });
		const args = ["--status", "To Do", "--labels", "cli", "--sort", "priority", "--limit", "1"];
		const watch = startWatch(args);
		await expectCurrent(watch, args);
		expect(JSON.parse(watch.snapshots.at(-1) ?? "").tasks[0].id).toBe("TASK-1");
		await core.editTask("TASK-2", { status: "To Do" });
		await expectCurrent(watch, args);
		expect(JSON.parse(watch.snapshots.at(-1) ?? "").tasks[0].id).toBe("TASK-2");
		await core.archiveTask("TASK-2");
		await expectCurrent(watch, args);
		expect(JSON.parse(watch.snapshots.at(-1) ?? "").tasks[0].id).toBe("TASK-1");
	});

	it("refreshes readiness from completed dependencies and configuration", async () => {
		await create("TASK-1", { dependencies: ["TASK-2"] });
		await create("TASK-2", { status: "Done" });
		await core.completeTask("TASK-2");
		const args = ["--parent", "TASK-9"];
		// Readiness must see completed dependencies even when only one local task remains.
		const watch = startWatch();
		await expectCurrent(watch);
		expect(JSON.parse(watch.snapshots.at(-1) ?? "").tasks[0].isReady).toBe(true);
		const completed = (await core.filesystem.listCompletedTasks())[0];
		if (!completed?.filePath) throw new Error("Missing completed task path");
		await rm(completed.filePath);
		await expectCurrent(watch);
		expect(JSON.parse(watch.snapshots.at(-1) ?? "").tasks[0].isReady).toBe(false);
		await create("TASK-2", { status: "Done" });
		await expectCurrent(watch);
		const config = await core.filesystem.loadConfig();
		if (!config) throw new Error("Missing config");
		await core.filesystem.saveConfig({ ...config, statuses: ["To Do", "Done", "Finished"] });
		await expectCurrent(watch);
		expect(JSON.parse(watch.snapshots.at(-1) ?? "").tasks.find((task: Task) => task.id === "TASK-1").isReady).toBe(
			false,
		);
		// A failed initial lookup produces no JSON, exactly as in one-shot mode.
		const invalid = startWatch(args);
		expect(await invalid.process.exited).toBe(1);
		expect(invalid.snapshots).toEqual([]);
	});

	it("fails closed if a duplicate identity appears after the initial response", async () => {
		await create("TASK-1");
		const watch = startWatch();
		await expectCurrent(watch);
		const task = await core.loadTaskById("TASK-1");
		if (!task?.filePath) throw new Error("Missing task path");
		await writeFile(join(core.filesystem.tasksDir, "task-1 - Duplicate.md"), await readFile(task.filePath, "utf8"));
		expect(await watch.process.exited).toBe(1);
		expect(watch.snapshots).toHaveLength(1);
		expect(await watch.stderr).toContain("TASK-1");
	});

	it("terminates even when a subscriber stops reading a large response", async () => {
		await create("TASK-1", { references: [`https://example.com/${"x".repeat(2_000_000)}`] });
		const child = Bun.spawn(["bun", CLI, "task", "list", "--json", "--watch"], {
			cwd: directory,
			stdout: "pipe",
			stderr: "pipe",
		});
		let exited = false;
		const exit = child.exited.then((code) => {
			exited = true;
			return code;
		});
		try {
			const reader = child.stdout.getReader();
			await reader.read();
			reader.releaseLock();
			child.kill("SIGTERM");
			await waitUntil(() => exited, "watch termination with unread output", 5000);
			const exitCode = await exit;
			// Windows terminates the process directly rather than delivering a POSIX signal.
			if (process.platform !== "win32") expect(exitCode).toBe(143);
			expect(await new Response(child.stderr).text()).toBe("");
		} finally {
			if (!exited) child.kill("SIGKILL");
			await exit;
		}
	});

	async function expectWatchToEndWithItsStarter(command: string[]) {
		const watch = startWatchFrom(command);
		const tasks = () => JSON.parse(watch.snapshots.at(-1) ?? "{}").tasks?.length;
		try {
			await waitUntil(() => tasks() === 0, "initial watch response", 5000);
			// Outlive at least one liveness check, then keep following changes.
			await Bun.sleep(1100);
			await create("TASK-1");
			await waitUntil(() => tasks() === 1, "watch response after a task change", 5000);
			watch.process.kill("SIGKILL");
			await watch.process.exited;
			// End of output means no starter, launcher or watch process holds it any longer.
			await withTimeout(watch.reading, "watch exit after its starter was killed", getPlatformTimeout(5000));
			expect(await watch.stderr).toBe("");
		} finally {
			if (!isWindows()) {
				try {
					process.kill(-watch.process.pid, "SIGKILL");
				} catch {
					// Nothing was left behind.
				}
			}
		}
	}

	it("ends when the process that started it is killed", async () => {
		await expectWatchToEndWithItsStarter(["bun", CLI, ...WATCH]);
	});

	it("ends with the launcher when the process that started the npm launcher is killed", async () => {
		await expectWatchToEndWithItsStarter(["node", await createLauncher(), CLI, ...WATCH]);
	});

	it("requires JSON and rejects invalid options without writing a snapshot", async () => {
		const child = Bun.spawn(["bun", CLI, "task", "list", "--watch"], {
			cwd: directory,
			stdout: "pipe",
			stderr: "pipe",
		});
		expect(await new Response(child.stdout).text()).toBe("");
		expect(await new Response(child.stderr).text()).toContain("--watch requires --json");
		expect(await child.exited).toBe(1);
		for (const args of [["--plain"], ["--limit", "0"], ["--sort", "unknown"]]) {
			const watch = startWatch(args);
			expect(await watch.process.exited).toBe(1);
			expect(watch.snapshots).toEqual([]);
			expect(await watch.stderr).not.toBe("");
		}
	});
});
