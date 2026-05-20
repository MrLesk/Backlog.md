import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { which } from "bun";
import { Core } from "../core/backlog.ts";
import { executeStatusCallback, resolveShellInvocation } from "../utils/status-callback.ts";

// Several tests below execute shell commands with POSIX syntax (`$VAR`, `>`, `>&2`).
// Skip them when no POSIX shell is available. Mirror the resolver's lookup exactly:
// on Windows we accept either `sh` or `sh.exe`; on POSIX `sh` alone is sufficient.
const HAS_POSIX_SH =
	process.platform === "win32" ? which("sh") !== null || which("sh.exe") !== null : which("sh") !== null;
const testSh = HAS_POSIX_SH ? test : test.skip;

describe("Status Change Callbacks", () => {
	describe("resolveShellInvocation", () => {
		const noShell = () => null;

		test("defaults to sh -c on POSIX", () => {
			const { cmd, warning } = resolveShellInvocation(undefined, { platform: "linux", which: noShell });
			expect(cmd).toEqual(["sh", "-c"]);
			expect(warning).toBeUndefined();
		});

		test("uses sh.exe on Windows when available", () => {
			const { cmd, warning } = resolveShellInvocation(undefined, {
				platform: "win32",
				which: (bin) => (bin === "sh" || bin === "sh.exe" ? "C:/Git/usr/bin/sh.exe" : null),
			});
			expect(cmd).toEqual(["C:/Git/usr/bin/sh.exe", "-c"]);
			expect(warning).toBeUndefined();
		});

		test("falls back to cmd /c on Windows with warning when sh is missing", () => {
			const { cmd, warning } = resolveShellInvocation(undefined, { platform: "win32", which: noShell });
			expect(cmd).toEqual(["cmd", "/c"]);
			expect(warning).toBeDefined();
			expect(warning).toContain("sh.exe not found");
		});

		test("'auto' is treated the same as undefined", () => {
			const { cmd } = resolveShellInvocation("auto", { platform: "linux", which: noShell });
			expect(cmd).toEqual(["sh", "-c"]);
		});

		test("'AUTO' (uppercase) is treated the same as undefined", () => {
			const winEnv = {
				platform: "win32" as NodeJS.Platform,
				which: (bin: string) => (bin === "sh" || bin === "sh.exe" ? "C:/Git/usr/bin/sh.exe" : null),
			};
			expect(resolveShellInvocation("AUTO", winEnv).cmd).toEqual(["C:/Git/usr/bin/sh.exe", "-c"]);
			expect(resolveShellInvocation("Auto", { platform: "linux", which: noShell }).cmd).toEqual(["sh", "-c"]);
		});

		test("unknown shell name falls through to POSIX-style `-c` invocation", () => {
			const env = { platform: "linux" as NodeJS.Platform, which: noShell };
			expect(resolveShellInvocation("fish", env).cmd).toEqual(["fish", "-c"]);
			expect(resolveShellInvocation("zsh", env).cmd).toEqual(["zsh", "-c"]);
		});

		test("named shells map to their canonical invocation", () => {
			const env = { platform: "linux" as NodeJS.Platform, which: noShell };
			expect(resolveShellInvocation("sh", env).cmd).toEqual(["sh", "-c"]);
			expect(resolveShellInvocation("bash", env).cmd).toEqual(["bash", "-c"]);
			expect(resolveShellInvocation("cmd", env).cmd).toEqual(["cmd", "/c"]);
			expect(resolveShellInvocation("pwsh", env).cmd).toEqual(["pwsh", "-NoProfile", "-Command"]);
			expect(resolveShellInvocation("powershell", env).cmd).toEqual(["powershell", "-NoProfile", "-Command"]);
		});

		test("named-shell matching is case-insensitive", () => {
			const env = { platform: "linux" as NodeJS.Platform, which: noShell };
			expect(resolveShellInvocation("PWSH", env).cmd).toEqual(["pwsh", "-NoProfile", "-Command"]);
			expect(resolveShellInvocation("Cmd", env).cmd).toEqual(["cmd", "/c"]);
		});

		test("absolute path is treated as POSIX-style interpreter", () => {
			const env = { platform: "win32" as NodeJS.Platform, which: noShell };
			const { cmd } = resolveShellInvocation("C:/Program Files/Git/bin/bash.exe", env);
			expect(cmd).toEqual(["C:/Program Files/Git/bin/bash.exe", "-c"]);
		});
	});

	describe("executeStatusCallback", () => {
		const testCwd = process.cwd();

		testSh("executes command with environment variables", async () => {
			const result = await executeStatusCallback({
				command: 'echo "Task: $TASK_ID, Old: $OLD_STATUS, New: $NEW_STATUS, Title: $TASK_TITLE"',
				taskId: "task-123",
				oldStatus: "To Do",
				newStatus: "In Progress",
				taskTitle: "Test Task",
				cwd: testCwd,
			});

			expect(result.success).toBe(true);
			expect(result.output).toContain("Task: task-123");
			expect(result.output).toContain("Old: To Do");
			expect(result.output).toContain("New: In Progress");
			expect(result.output).toContain("Title: Test Task");
		});

		test("returns success false for failing command", async () => {
			const result = await executeStatusCallback({
				command: "exit 1",
				taskId: "task-123",
				oldStatus: "To Do",
				newStatus: "Done",
				taskTitle: "Test Task",
				cwd: testCwd,
			});

			expect(result.success).toBe(false);
			expect(result.exitCode).toBe(1);
		});

		test("returns error for empty command", async () => {
			const result = await executeStatusCallback({
				command: "",
				taskId: "task-123",
				oldStatus: "To Do",
				newStatus: "Done",
				taskTitle: "Test Task",
				cwd: testCwd,
			});

			expect(result.success).toBe(false);
			expect(result.error).toBe("Empty command");
		});

		testSh("captures stderr on failure", async () => {
			const result = await executeStatusCallback({
				command: 'echo "error message" >&2 && exit 1',
				taskId: "task-123",
				oldStatus: "To Do",
				newStatus: "Done",
				taskTitle: "Test Task",
				cwd: testCwd,
			});

			expect(result.success).toBe(false);
			expect(result.error).toContain("error message");
		});

		testSh("handles special characters in variables", async () => {
			const result = await executeStatusCallback({
				command: 'echo "$TASK_TITLE"',
				taskId: "task-123",
				oldStatus: "To Do",
				newStatus: "Done",
				taskTitle: 'Task with "quotes" and $pecial chars',
				cwd: testCwd,
			});

			expect(result.success).toBe(true);
			expect(result.output).toContain('Task with "quotes" and $pecial chars');
		});
	});

	describe("Core.updateTaskFromInput with callbacks", () => {
		let testDir: string;
		let core: Core;
		let callbackOutputFile: string;
		let callbackOutputPath: string;

		beforeEach(async () => {
			testDir = join(tmpdir(), `backlog-callback-test-${Date.now()}`);
			await mkdir(testDir, { recursive: true });
			await mkdir(join(testDir, "backlog", "tasks"), { recursive: true });

			callbackOutputFile = join(testDir, "callback-output.txt");
			callbackOutputPath = callbackOutputFile.replace(/\\/g, "/");

			core = new Core(testDir);
		});

		afterEach(async () => {
			try {
				await rm(testDir, { recursive: true, force: true });
			} catch {
				// Ignore cleanup errors
			}
		});

		testSh("triggers global callback on status change", async () => {
			// Create config with onStatusChange
			const configContent = `projectName: Test
statuses:
  - To Do
  - In Progress
  - Done
labels: []
milestones: []
dateFormat: yyyy-mm-dd
checkActiveBranches: false
onStatusChange: 'echo "$TASK_ID:$OLD_STATUS->$NEW_STATUS" > "${callbackOutputPath}"'
`;
			await writeFile(join(testDir, "backlog", "config.yml"), configContent);

			// Verify config was written correctly
			const writtenConfig = await Bun.file(join(testDir, "backlog", "config.yml")).text();
			expect(writtenConfig).toContain("onStatusChange");

			// Create a task
			const { task } = await core.createTaskFromInput({
				title: "Test Callback Task",
				status: "To Do",
			});

			// Invalidate config cache to ensure fresh read
			core.fs.invalidateConfigCache();

			// Update status
			await core.updateTaskFromInput(task.id, { status: "In Progress" });

			// Wait a bit for async callback
			await new Promise((resolve) => setTimeout(resolve, 200));

			// Check callback was executed
			const output = await Bun.file(callbackOutputFile).text();
			expect(output.trim()).toBe(`${task.id}:To Do->In Progress`);
		});

		testSh("per-task callback overrides global callback", async () => {
			// Create config with global onStatusChange
			const configContent = `projectName: Test
statuses:
  - To Do
  - In Progress
  - Done
labels: []
milestones: []
dateFormat: yyyy-mm-dd
checkActiveBranches: false
onStatusChange: 'echo "global" > "${callbackOutputPath}"'
`;
			await writeFile(join(testDir, "backlog", "config.yml"), configContent);

			// Create a task with per-task callback
			const taskContent = `---
id: task-1
title: Task with custom callback
status: To Do
assignee: []
created_date: 2025-01-01
labels: []
dependencies: []
onStatusChange: 'echo "per-task:$NEW_STATUS" > "${callbackOutputPath}"'
---
`;
			await writeFile(join(testDir, "backlog", "tasks", "task-1 - Task with custom callback.md"), taskContent);

			// Update status
			await core.updateTaskFromInput("task-1", { status: "Done" });

			// Wait a bit for async callback
			await new Promise((resolve) => setTimeout(resolve, 100));

			// Check per-task callback was executed (not global)
			const output = await Bun.file(callbackOutputFile).text();
			expect(output.trim()).toBe("per-task:Done");
		});

		test("no callback when status unchanged", async () => {
			// Create config with onStatusChange
			const configContent = `projectName: Test
statuses:
  - To Do
  - In Progress
  - Done
labels: []
milestones: []
dateFormat: yyyy-mm-dd
checkActiveBranches: false
onStatusChange: 'echo "callback-ran" > "${callbackOutputPath}"'
`;
			await writeFile(join(testDir, "backlog", "config.yml"), configContent);

			// Create a task
			const { task } = await core.createTaskFromInput({
				title: "Test No Callback Task",
				status: "To Do",
			});

			// Update something other than status
			await core.updateTaskFromInput(task.id, { title: "Updated Title" });

			// Wait a bit
			await new Promise((resolve) => setTimeout(resolve, 100));

			// Check callback was NOT executed
			const exists = await Bun.file(callbackOutputFile).exists();
			expect(exists).toBe(false);
		});

		test("no callback when no callback configured", async () => {
			// Create config without onStatusChange
			const configContent = `projectName: Test
statuses:
  - To Do
  - In Progress
  - Done
labels: []
milestones: []
dateFormat: yyyy-mm-dd
checkActiveBranches: false
`;
			await writeFile(join(testDir, "backlog", "config.yml"), configContent);

			// Create a task
			const { task } = await core.createTaskFromInput({
				title: "Test No Config Task",
				status: "To Do",
			});

			// Update status - should not fail even without callback
			const result = await core.updateTaskFromInput(task.id, { status: "In Progress" });
			expect(result.status).toBe("In Progress");
		});

		test("callback failure does not block status change", async () => {
			// Create config with failing callback
			const configContent = `projectName: Test
statuses:
  - To Do
  - In Progress
  - Done
labels: []
milestones: []
dateFormat: yyyy-mm-dd
checkActiveBranches: false
onStatusChange: 'exit 1'
`;
			await writeFile(join(testDir, "backlog", "config.yml"), configContent);

			// Create a task
			const { task } = await core.createTaskFromInput({
				title: "Test Failing Callback Task",
				status: "To Do",
			});

			// Update status - should succeed even if callback fails
			const result = await core.updateTaskFromInput(task.id, { status: "Done" });
			expect(result.status).toBe("Done");
		});

		testSh("triggers callback when reorderTask changes status", async () => {
			// Create config with onStatusChange
			const configContent = `projectName: Test
statuses:
  - To Do
  - In Progress
  - Done
labels: []
milestones: []
dateFormat: yyyy-mm-dd
checkActiveBranches: false
onStatusChange: 'echo "$TASK_ID:$OLD_STATUS->$NEW_STATUS" >> "${callbackOutputPath}"'
`;
			await writeFile(join(testDir, "backlog", "config.yml"), configContent);

			// Create a task in "To Do"
			const { task } = await core.createTaskFromInput({
				title: "Reorder Callback Test",
				status: "To Do",
			});

			// Invalidate config cache
			core.fs.invalidateConfigCache();

			// Reorder task to "In Progress" column (simulating board drag)
			await core.reorderTask({
				taskId: task.id,
				targetStatus: "In Progress",
				orderedTaskIds: [task.id],
			});

			// Wait for callback
			await new Promise((resolve) => setTimeout(resolve, 200));

			// Check callback was executed
			const output = await Bun.file(callbackOutputFile).text();
			expect(output.trim()).toBe(`${task.id}:To Do->In Progress`);
		});
	});
});
