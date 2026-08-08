import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Core } from "../core/backlog.ts";
import type { Task, TaskCreateInput } from "../types/index.ts";
import { renderBoardTui } from "../ui/board.ts";
import { createScreen } from "../ui/tui.ts";
import { BACKLOG_CWD_ENV } from "../utils/runtime-cwd.ts";
import { initializeTestProject, withTimeout } from "./test-utils.ts";

type EmittingScreen = ReturnType<typeof createScreen> & { emit(event: string): void; destroy(): void };

/**
 * Drives the board's "new task" handler and returns the project directory the task landed in.
 * The stubbed composer calls the handler's own `persist`, which is where the board resolves Core.
 */
async function createTaskFromBoardKeypress(options?: { core?: Core }): Promise<Task | null> {
	const ttyDescriptor = Object.getOwnPropertyDescriptor(process.stdout, "isTTY");
	Object.defineProperty(process.stdout, "isTTY", { configurable: true, value: true });
	const screen = createScreen({ smartCSR: false }) as EmittingScreen;
	let created: Task | null = null;
	try {
		const boardPromise = renderBoardTui([], ["To Do", "Done"], "horizontal", 20, {
			screen,
			core: options?.core,
			taskComposer: async ({ persist }) => {
				const input: TaskCreateInput = { title: "Runtime cwd task", status: "To Do" };
				created = await persist(input);
				return created;
			},
		});
		screen.emit("key n");
		for (let attempt = 0; attempt < 200 && created === null; attempt += 1) {
			await Bun.sleep(10);
		}
		screen.emit("key q");
		await withTimeout(boardPromise, "board close after task creation", 2000);
	} finally {
		screen.destroy();
		if (ttyDescriptor) Object.defineProperty(process.stdout, "isTTY", ttyDescriptor);
		else Reflect.deleteProperty(process.stdout, "isTTY");
	}
	return created;
}

describe("board TUI runtime working directory", () => {
	let overrideDir: string;
	let instanceDir: string;
	let unrelatedDir: string;
	let originalCwd: string;
	let originalBacklogCwd: string | undefined;

	beforeEach(async () => {
		overrideDir = await mkdtemp(join(tmpdir(), "backlog-tui-cwd-override-"));
		instanceDir = await mkdtemp(join(tmpdir(), "backlog-tui-cwd-instance-"));
		unrelatedDir = await mkdtemp(join(tmpdir(), "backlog-tui-cwd-unrelated-"));
		await initializeTestProject(new Core(overrideDir), "Override Project");
		await initializeTestProject(new Core(instanceDir), "Instance Project");
		originalCwd = process.cwd();
		originalBacklogCwd = process.env[BACKLOG_CWD_ENV];
		delete process.env[BACKLOG_CWD_ENV];
		// The board must never fall back to the shell's directory.
		process.chdir(unrelatedDir);
	});

	afterEach(async () => {
		process.chdir(originalCwd);
		if (originalBacklogCwd === undefined) delete process.env[BACKLOG_CWD_ENV];
		else process.env[BACKLOG_CWD_ENV] = originalBacklogCwd;
		await rm(overrideDir, { recursive: true, force: true });
		await rm(instanceDir, { recursive: true, force: true });
		await rm(unrelatedDir, { recursive: true, force: true });
	});

	it("writes into BACKLOG_CWD when no Core instance is supplied", async () => {
		process.env[BACKLOG_CWD_ENV] = overrideDir;

		const created = await createTaskFromBoardKeypress();

		expect(created?.title).toBe("Runtime cwd task");
		expect(await new Core(overrideDir).filesystem.listTasks()).toHaveLength(1);
		expect(await new Core(unrelatedDir).filesystem.listTasks()).toHaveLength(0);
	});

	it("reuses the supplied Core instance instead of resolving again", async () => {
		process.env[BACKLOG_CWD_ENV] = overrideDir;

		const created = await createTaskFromBoardKeypress({ core: new Core(instanceDir) });

		expect(created?.title).toBe("Runtime cwd task");
		expect(await new Core(instanceDir).filesystem.listTasks()).toHaveLength(1);
		expect(await new Core(overrideDir).filesystem.listTasks()).toHaveLength(0);
	});
});
