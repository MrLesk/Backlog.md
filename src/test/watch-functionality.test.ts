import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { $ } from "bun";
import { Core } from "../core/backlog.ts";
import type { Task } from "../types/index.ts";
import { watchTasks } from "../utils/task-watcher.ts";
import { createUniqueTestDir, safeCleanup } from "./test-utils.ts";

let TEST_DIR: string;

describe("Watch Functionality", () => {
	let core: Core;

	beforeEach(async () => {
		TEST_DIR = createUniqueTestDir("test-watch-functionality");
		await rm(TEST_DIR, { recursive: true, force: true }).catch(() => {});
		await mkdir(TEST_DIR, { recursive: true });

		// Configure git for tests
		await $`git init`.cwd(TEST_DIR).quiet();
		await $`git config user.email test@example.com`.cwd(TEST_DIR).quiet();
		await $`git config user.name "Test User"`.cwd(TEST_DIR).quiet();

		core = new Core(TEST_DIR);
		await core.initializeProject("Test Watch Project");

		// Create initial test task
		const tasksDir = core.filesystem.tasksDir;
		await writeFile(
			join(tasksDir, "task-1 - Initial Task.md"),
			`---
id: task-1
title: Initial Task
status: To Do
assignee: []
created_date: '2025-07-05'
labels: []
dependencies: []
---

## Description

Initial test task.`,
		);
	});

	afterEach(async () => {
		try {
			await safeCleanup(TEST_DIR);
		} catch {
			// Ignore cleanup errors
		}
	});

	it("should watch for new task files and trigger onTaskAdded", async () => {
		let addedTask: Task | null = null;
		let addedTaskCallCount = 0;

		const watcher = watchTasks(core, {
			onTaskAdded: (task) => {
				addedTask = task;
				addedTaskCallCount++;
			},
		});

		try {
			// Create a new task file
			const tasksDir = core.filesystem.tasksDir;
			await writeFile(
				join(tasksDir, "task-2 - New Task.md"),
				`---
id: task-2
title: New Task
status: In Progress
assignee: []
created_date: '2025-07-05'
labels: []
dependencies: []
---

## Description

Newly added task.`,
			);

			// Wait a bit for the watcher to detect the change
			await new Promise((resolve) => setTimeout(resolve, 100));

			expect(addedTaskCallCount).toBeGreaterThan(0);
			expect(addedTask).not.toBeNull();
			expect(addedTask.id).toBe("task-2");
			expect(addedTask.title).toBe("New Task");
		} finally {
			watcher.stop();
		}
	});

	it("should watch for task file changes and trigger onTaskChanged", async () => {
		let changedTask: Task | null = null;
		let changedTaskCallCount = 0;

		const watcher = watchTasks(core, {
			onTaskChanged: (task) => {
				changedTask = task;
				changedTaskCallCount++;
			},
		});

		try {
			// Modify the existing task file
			const tasksDir = core.filesystem.tasksDir;
			await writeFile(
				join(tasksDir, "task-1 - Initial Task.md"),
				`---
id: task-1
title: Initial Task Updated
status: In Progress
assignee: []
created_date: '2025-07-05'
labels: []
dependencies: []
---

## Description

Updated test task.`,
			);

			// Wait a bit for the watcher to detect the change
			await new Promise((resolve) => setTimeout(resolve, 100));

			expect(changedTaskCallCount).toBeGreaterThan(0);
			expect(changedTask).not.toBeNull();
			expect(changedTask.id).toBe("task-1");
			expect(changedTask.title).toBe("Initial Task Updated");
			expect(changedTask.status).toBe("In Progress");
		} finally {
			watcher.stop();
		}
	});

	it("should watch for task file removal and trigger onTaskRemoved", async () => {
		let removedTaskId: string | null = null;
		let removedTaskCallCount = 0;

		const watcher = watchTasks(core, {
			onTaskRemoved: (taskId) => {
				removedTaskId = taskId;
				removedTaskCallCount++;
			},
		});

		try {
			// Remove the existing task file
			const tasksDir = core.filesystem.tasksDir;
			await rm(join(tasksDir, "task-1 - Initial Task.md"));

			// Wait a bit for the watcher to detect the change
			await new Promise((resolve) => setTimeout(resolve, 100));

			expect(removedTaskCallCount).toBeGreaterThan(0);
			expect(removedTaskId).toBe("task-1");
		} finally {
			watcher.stop();
		}
	});

	it("should handle incremental updates without full reload", async () => {
		const callbacks = {
			onTaskAdded: [] as Task[],
			onTaskChanged: [] as Task[],
			onTaskRemoved: [] as string[],
		};

		const watcher = watchTasks(core, {
			onTaskAdded: (task) => callbacks.onTaskAdded.push(task),
			onTaskChanged: (task) => callbacks.onTaskChanged.push(task),
			onTaskRemoved: (taskId) => callbacks.onTaskRemoved.push(taskId),
		});

		try {
			const tasksDir = core.filesystem.tasksDir;

			// Add a task
			await writeFile(
				join(tasksDir, "task-2 - Added Task.md"),
				`---
id: task-2
title: Added Task
status: To Do
assignee: []
created_date: '2025-07-05'
labels: []
dependencies: []
---

## Description

Added task.`,
			);

			// Wait and verify
			await new Promise((resolve) => setTimeout(resolve, 100));
			expect(callbacks.onTaskAdded).toHaveLength(1);

			// Modify a task
			await writeFile(
				join(tasksDir, "task-2 - Added Task.md"),
				`---
id: task-2
title: Modified Task
status: In Progress
assignee: []
created_date: '2025-07-05'
labels: []
dependencies: []
---

## Description

Modified task.`,
			);

			// Wait and verify
			await new Promise((resolve) => setTimeout(resolve, 100));
			expect(callbacks.onTaskChanged.length).toBeGreaterThan(0);
			expect(callbacks.onTaskChanged[0]?.title).toBe("Modified Task");

			// Remove a task
			await rm(join(tasksDir, "task-2 - Added Task.md"));

			// Wait and verify
			await new Promise((resolve) => setTimeout(resolve, 100));
			expect(callbacks.onTaskRemoved).toContain("task-2");
		} finally {
			watcher.stop();
		}
	});

	it("should gracefully handle watch initialization failure", () => {
		// Create a core with an invalid directory
		const invalidCore = new Core("/this/does/not/exist");

		expect(() => {
			const watcher = watchTasks(invalidCore, {});
			watcher.stop();
		}).not.toThrow();
	});

	it("should stop watching when requested", async () => {
		let addedTaskCount = 0;

		const watcher = watchTasks(core, {
			onTaskAdded: () => addedTaskCount++,
		});

		// Stop the watcher
		watcher.stop();

		try {
			// Create a new task file
			const tasksDir = core.filesystem.tasksDir;
			await writeFile(
				join(tasksDir, "task-3 - Should Not Trigger.md"),
				`---
id: task-3
title: Should Not Trigger
status: To Do
assignee: []
created_date: '2025-07-05'
labels: []
dependencies: []
---

## Description

This should not trigger the watcher.`,
			);

			// Wait longer than usual
			await new Promise((resolve) => setTimeout(resolve, 200));

			// Should not have triggered since watcher is stopped
			expect(addedTaskCount).toBe(0);
		} finally {
			// Just to be safe
			watcher.stop();
		}
	});
});
