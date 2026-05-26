import { afterEach, describe, expect, it } from "bun:test";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { FileSystem } from "../file-system/operations.ts";
import type { Task } from "../types/index.ts";

let scratchRoots: string[] = [];

afterEach(() => {
	for (const root of scratchRoots) {
		try {
			rmSync(root, { recursive: true, force: true });
		} catch {}
	}
	scratchRoots = [];
});

const scratchProject = (): string => {
	const root = mkdtempSync(join(tmpdir(), "backlog-save-task-test-"));
	scratchRoots.push(root);
	return root;
};

const makeTask = (overrides: Partial<Task> = {}): Task => ({
	id: "task-1",
	title: "Hash race regression",
	status: "To Do",
	assignee: [],
	labels: [],
	dependencies: [],
	createdDate: "2026-01-01",
	...overrides,
});

describe("FileSystem.saveTask onSerialized", () => {
	it("fires the callback BEFORE the file hits disk", async () => {
		const fs = new FileSystem(scratchProject());
		await fs.ensureBacklogStructure();
		// Object wrappers so TS sees the closure assignments through type
		// narrowing at the assertion site.
		const observed: { fileExistsAtCallback: boolean | null; content: string | null; filePath: string | null } = {
			fileExistsAtCallback: null,
			content: null,
			filePath: null,
		};

		const finalPath = await fs.saveTask(makeTask(), {
			onSerialized: ({ filePath, content }) => {
				observed.filePath = filePath;
				observed.content = content;
				// At this point Bun.write has NOT been called yet. The file
				// must not exist on disk (the previous post-write
				// implementation left a window here where fs.watch could
				// already fire).
				observed.fileExistsAtCallback = existsSync(filePath);
			},
		});

		expect(observed.fileExistsAtCallback).toBe(false);
		expect(observed.filePath).toBe(finalPath);
		expect(typeof observed.content).toBe("string");
		expect((observed.content ?? "").length).toBeGreaterThan(0);
		// After saveTask returns, the file is on disk and its content
		// matches what onSerialized was shown — proving the wrapper hashes
		// the same bytes the watcher will read.
		expect(existsSync(finalPath)).toBe(true);
		const onDisk = await Bun.file(finalPath).text();
		expect(onDisk).toBe(observed.content ?? "");
	});

	it("supports async onSerialized callbacks; the write waits for them", async () => {
		const fs = new FileSystem(scratchProject());
		await fs.ensureBacklogStructure();
		let callbackResolved = false;

		const finalPath = await fs.saveTask(makeTask(), {
			onSerialized: async ({ filePath }) => {
				// Sleep briefly to simulate an async hashing/recording step.
				await new Promise((r) => setTimeout(r, 20));
				// File still must not exist while we're sleeping in the callback.
				expect(existsSync(filePath)).toBe(false);
				callbackResolved = true;
			},
		});

		expect(callbackResolved).toBe(true);
		expect(existsSync(finalPath)).toBe(true);
	});

	it("works without an onSerialized callback (back-compat)", async () => {
		const fs = new FileSystem(scratchProject());
		await fs.ensureBacklogStructure();
		const finalPath = await fs.saveTask(makeTask());
		expect(existsSync(finalPath)).toBe(true);
	});
});
