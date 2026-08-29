import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { existsSync } from "node:fs";
import { mkdtemp, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { updateReadmeWithBoard } from "../readme.ts";
import type { Task } from "../types/index.ts";

const BOARD_START = "<!-- BOARD_START -->";
const BOARD_END = "<!-- BOARD_END -->";

function makeTask(id: string, title: string, status: string): Task {
	return {
		id,
		title,
		status,
		assignee: [],
		createdDate: "2026-01-01",
		labels: [],
		dependencies: [],
	};
}

describe("updateReadmeWithBoard", () => {
	let testDir: string;
	let originalCwd: string;
	let readmePath: string;

	const tasks = [makeTask("task-1", "First", "To Do"), makeTask("task-2", "Second", "Done")];
	const statuses = ["To Do", "Done"];

	beforeEach(async () => {
		testDir = await mkdtemp(join(tmpdir(), "readme-board-"));
		originalCwd = process.cwd();
		process.chdir(testDir);
		readmePath = join(testDir, "README.md");
	});

	afterEach(async () => {
		process.chdir(originalCwd);
		await rm(testDir, { recursive: true, force: true });
	});

	it("writes the board between the markers and leaves no temporary file behind", async () => {
		await Bun.write(readmePath, `# Project\n\n${BOARD_START}\n\n${BOARD_END}\n\n## License\n\nMIT\n`);

		await updateReadmeWithBoard(tasks, statuses, "TestProject");

		const content = await Bun.file(readmePath).text();
		const boardSection = content.slice(content.indexOf(BOARD_START) + BOARD_START.length, content.indexOf(BOARD_END));
		expect(boardSection).toContain("## 📊 TestProject Project Status");
		expect(boardSection).toContain("| To Do | Done |");
		expect(boardSection).toContain("TASK-1");
		expect(boardSection).toContain("TASK-2");
		// The export metadata header stays out of the README; only the table is embedded.
		expect(content).not.toContain("# Kanban Board Export");
		expect(content).toContain("## License");

		expect(existsSync(join(testDir, ".temp-board.md"))).toBe(false);
		expect(await readdir(testDir)).toEqual(["README.md"]);
	});

	it("does not touch an unrelated .temp-board.md in the working directory", async () => {
		const strayPath = join(testDir, ".temp-board.md");
		await Bun.write(strayPath, "user content\n");

		await updateReadmeWithBoard(tasks, statuses, "TestProject");

		expect(await Bun.file(strayPath).text()).toBe("user content\n");
	});

	it("replaces the previous board instead of appending on a second run", async () => {
		await Bun.write(readmePath, `# Project\n\n${BOARD_START}\n\n${BOARD_END}\n`);

		await updateReadmeWithBoard(tasks, statuses, "TestProject");
		await updateReadmeWithBoard(tasks, statuses, "TestProject");

		const content = await Bun.file(readmePath).text();
		expect(content.split("## 📊 TestProject Project Status").length - 1).toBe(1);
		expect(content.split("TASK-1").length - 1).toBe(1);
	});

	it("appends a marked board section when the README has no markers", async () => {
		await Bun.write(readmePath, "# Project\n\nSome intro.\n");

		await updateReadmeWithBoard(tasks, statuses, "TestProject", "v1.2.3");

		const content = await Bun.file(readmePath).text();
		expect(content).toStartWith("# Project\n\nSome intro.\n");
		expect(content).toContain(BOARD_START);
		expect(content).toContain(BOARD_END);
		expect(content).toContain("## 📊 TestProject Project Status (v1.2.3)");
	});

	it("creates the README when it does not exist yet", async () => {
		await updateReadmeWithBoard(tasks, statuses, "TestProject");

		const content = await Bun.file(readmePath).text();
		expect(content).toContain(BOARD_START);
		expect(content).toContain("## 📊 TestProject Project Status");
		expect(await readdir(testDir)).toEqual(["README.md"]);
	});
});
