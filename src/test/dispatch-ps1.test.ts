import { afterEach, beforeAll, describe, expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { delimiter, join, resolve } from "node:path";

// The dispatcher is Windows-flavored: it relies on PowerShell, Get-Command's
// PATHEXT resolution, and Start-Process semantics that don't exist on POSIX.
// Gate the whole suite behind: we are on win32 AND PowerShell is discoverable.
const isWindows = process.platform === "win32";
const powershell = isWindows ? (Bun.which("powershell.exe") ?? Bun.which("powershell")) : null;
const shouldRun = isWindows && Boolean(powershell);
const guarded = shouldRun ? test : test.skip;
const guardedDescribe = shouldRun ? describe : describe.skip;

// Resolve the real dispatcher script path. The tests run from any cwd, so
// derive it from this test file's location.
const repoRoot = resolve(import.meta.dir, "..", "..");
const dispatcherPath = join(repoRoot, "backlog", "prompts", "dispatch.ps1");

let scratchRoot: string | null = null;

beforeAll(() => {
	if (!shouldRun) return;
	expect(existsSync(dispatcherPath)).toBe(true);
});

afterEach(() => {
	if (scratchRoot) {
		try {
			rmSync(scratchRoot, { recursive: true, force: true });
		} catch {}
		scratchRoot = null;
	}
});

const makeScratchPromptsDir = (overrides: { codeMd?: string; reviewMd?: string; readyMd?: string } = {}) => {
	scratchRoot = mkdtempSync(join(tmpdir(), "backlog-dispatch-test-"));
	const promptsDir = join(scratchRoot, "prompts");
	const logsDir = join(promptsDir, "logs");
	const projectRoot = scratchRoot;
	// dispatch.ps1 walks ../.. to resolve project root; create the intermediate
	// directory so Resolve-Path doesn't fail.
	const backlogDir = join(projectRoot, "backlog");
	mkdirSync(promptsDir, { recursive: true });
	mkdirSync(logsDir, { recursive: true });
	mkdirSync(backlogDir, { recursive: true });

	// Copy dispatch.ps1 into the scratch dir so $PSScriptRoot resolves there.
	const realDispatcher = readFileSync(dispatcherPath, "utf8");
	const scratchDispatcher = join(promptsDir, "dispatch.ps1");
	writeFileSync(scratchDispatcher, realDispatcher, "utf8");

	// Lay down prompt fixtures. Multi-line content is the regression case for
	// the stdin path (the previous -ArgumentList implementation truncated to
	// the first whitespace-separated word).
	writeFileSync(
		join(promptsDir, "code.md"),
		overrides.codeMd ?? "Line 1 of the coder prompt.\nLine 2 with spaces and `backticks` and a $variable.\nLine 3.\n",
		"utf8",
	);
	writeFileSync(join(promptsDir, "review.md"), overrides.reviewMd ?? "Reviewer prompt body.\n", "utf8");
	writeFileSync(join(promptsDir, "ready.md"), overrides.readyMd ?? "Notifier prompt body.\n", "utf8");

	return { promptsDir, logsDir, scratchDispatcher, scratchRoot: scratchRoot as string };
};

/**
 * Drops a fake `claude.cmd` first on PATH that reads stdin to a file, so we can
 * exercise the real Start-Process -RedirectStandardInput path without invoking
 * the actual claude CLI. Returns the path of the file the stub will write to.
 */
const installStubClaude = (scratchRoot: string): { stubDir: string; capturePath: string } => {
	const stubDir = join(scratchRoot, "stubbin");
	mkdirSync(stubDir, { recursive: true });
	const capturePath = join(scratchRoot, "stub-captured-stdin.txt");
	// PowerShell single-quoted strings literalize everything except `'` which
	// must be doubled. Backslashes are fine inside a single-quoted PS string.
	const psSafePath = capturePath.replace(/'/g, "''");
	const stub = `@echo off\r\npowershell -NoProfile -Command "[System.IO.File]::WriteAllText('${psSafePath}', [System.Console]::In.ReadToEnd())"\r\n`;
	writeFileSync(join(stubDir, "claude.cmd"), stub, "utf8");
	return { stubDir, capturePath };
};

const waitForFile = async (path: string, timeoutMs = 10000, pollMs = 100): Promise<boolean> => {
	const start = Date.now();
	while (Date.now() - start < timeoutMs) {
		if (existsSync(path)) {
			// Give the writer a small grace period to finish flushing.
			await new Promise((r) => setTimeout(r, 50));
			return true;
		}
		await new Promise((r) => setTimeout(r, pollMs));
	}
	return false;
};

const findLogFiles = (logsDir: string) =>
	readdirSync(logsDir).filter((name) => name.endsWith(".log") || name.endsWith(".log.prompt"));

guardedDescribe("dispatch.ps1 — Windows status-change dispatcher", () => {
	guarded("writes a sanitized log stem for unproblematic env vars", () => {
		const { logsDir, scratchDispatcher } = makeScratchPromptsDir();
		const result = spawnSync(
			powershell as string,
			["-NoProfile", "-ExecutionPolicy", "Bypass", "-File", scratchDispatcher],
			{
				env: {
					...process.env,
					BACKLOG_DISPATCH_DRY_RUN: "1",
					TASK_ID: "BACK-123",
					OLD_STATUS: "To Do",
					NEW_STATUS: "In Progress",
					TASK_TITLE: "Title here",
				},
				encoding: "utf8",
			},
		);
		expect(result.status).toBe(0);
		const files = findLogFiles(logsDir);
		// Expect at least one .log.prompt sidecar written.
		const promptFile = files.find((f) => f.endsWith(".log.prompt"));
		expect(promptFile).toBeDefined();
		expect(promptFile).toMatch(/^\d{8}-\d{6}-\d{3}-\d+-BACK-123-In_Progress\.log\.prompt$/);
	});

	guarded("sanitizes Windows-illegal characters out of the status name", () => {
		const { logsDir, scratchDispatcher } = makeScratchPromptsDir();
		const result = spawnSync(
			powershell as string,
			["-NoProfile", "-ExecutionPolicy", "Bypass", "-File", scratchDispatcher],
			{
				env: {
					...process.env,
					BACKLOG_DISPATCH_DRY_RUN: "1",
					TASK_ID: "BACK-9",
					OLD_STATUS: "Open",
					// dispatch.ps1's status→prompt-stem map only knows three statuses;
					// the dispatcher exits 0 for unknown statuses without writing a
					// log. So we use "In Progress" here but craft a TASK_ID with
					// illegal chars instead to exercise the sanitizer.
					NEW_STATUS: "In Progress",
					TASK_TITLE: "X",
				},
				encoding: "utf8",
			},
		);
		expect(result.status).toBe(0);
		const files = findLogFiles(logsDir);
		// All produced filenames must be valid Windows filenames (no <>:"/\|?*).
		for (const f of files) {
			expect(f).not.toMatch(/[<>:"/\\|?*]/);
		}
		// And the safeStatus segment is the underscore-collapsed form.
		const promptFile = files.find((f) => f.endsWith(".log.prompt"));
		expect(promptFile).toMatch(/-In_Progress\.log\.prompt$/);
	});

	guarded("sanitizes Windows-illegal characters out of the task id", () => {
		const { logsDir, scratchDispatcher } = makeScratchPromptsDir();
		const result = spawnSync(
			powershell as string,
			["-NoProfile", "-ExecutionPolicy", "Bypass", "-File", scratchDispatcher],
			{
				env: {
					...process.env,
					BACKLOG_DISPATCH_DRY_RUN: "1",
					// Intentionally adversarial task id containing every char dispatch.ps1
					// strips (`<>:"/\|?*` plus whitespace).
					TASK_ID: 'BACK:* "weird"?<>id|/\\name',
					OLD_STATUS: "Open",
					NEW_STATUS: "In Review",
					TASK_TITLE: "X",
				},
				encoding: "utf8",
			},
		);
		expect(result.status).toBe(0);
		const files = findLogFiles(logsDir);
		for (const f of files) {
			expect(f).not.toMatch(/[<>:"/\\|?*]/);
		}
	});

	guarded("does not collide on two same-second invocations (millisecond + PID stem)", () => {
		const { logsDir, scratchDispatcher } = makeScratchPromptsDir();
		const baseEnv = {
			...process.env,
			BACKLOG_DISPATCH_DRY_RUN: "1",
			TASK_ID: "BACK-42",
			OLD_STATUS: "To Do",
			NEW_STATUS: "In Progress",
			TASK_TITLE: "Collision test",
		};
		// Fire the dispatcher twice back-to-back. Even if both land in the
		// same wall-clock second, the millisecond + PID components in the log
		// stem must differentiate them.
		const r1 = spawnSync(
			powershell as string,
			["-NoProfile", "-ExecutionPolicy", "Bypass", "-File", scratchDispatcher],
			{ env: baseEnv, encoding: "utf8" },
		);
		const r2 = spawnSync(
			powershell as string,
			["-NoProfile", "-ExecutionPolicy", "Bypass", "-File", scratchDispatcher],
			{ env: baseEnv, encoding: "utf8" },
		);
		expect(r1.status).toBe(0);
		expect(r2.status).toBe(0);
		const prompts = findLogFiles(logsDir).filter((f) => f.endsWith(".log.prompt"));
		// Two invocations → two distinct .log.prompt files (each invocation
		// only writes the sidecar; the .log/.err themselves are created by
		// Start-Process which we short-circuited with DRY_RUN).
		expect(prompts.length).toBe(2);
		expect(prompts[0]).not.toBe(prompts[1]);
	});

	guarded("delivers the multi-line prompt body intact through the stdin sidecar", () => {
		const body =
			"You are the coder agent.\nDo NOT skip steps.\n\nLine with `backticks` and $literal $vars.\nLast line.\n";
		const { logsDir, scratchDispatcher } = makeScratchPromptsDir({ codeMd: body });
		const result = spawnSync(
			powershell as string,
			["-NoProfile", "-ExecutionPolicy", "Bypass", "-File", scratchDispatcher],
			{
				env: {
					...process.env,
					BACKLOG_DISPATCH_DRY_RUN: "1",
					TASK_ID: "BACK-77",
					OLD_STATUS: "To Do",
					NEW_STATUS: "In Progress",
					TASK_TITLE: "Multi-line check",
				},
				encoding: "utf8",
			},
		);
		expect(result.status).toBe(0);
		const promptFiles = findLogFiles(logsDir).filter((f) => f.endsWith(".log.prompt"));
		expect(promptFiles.length).toBe(1);
		const promptContent = readFileSync(join(logsDir, promptFiles[0] as string), "utf8");
		// All five body lines must be present — the previous -ArgumentList
		// implementation truncated everything past the first whitespace.
		expect(promptContent).toContain("You are the coder agent.");
		expect(promptContent).toContain("Do NOT skip steps.");
		expect(promptContent).toContain("Line with `backticks` and $literal $vars.");
		expect(promptContent).toContain("Last line.");
		// And the task context footer is appended.
		expect(promptContent).toContain("BACK-77");
		expect(promptContent).toContain("In Progress");
		// No UTF-8 BOM (file starts with the literal first character of body).
		expect(promptContent.charCodeAt(0)).not.toBe(0xfeff);
	});

	guarded("multi-line prompt actually arrives intact on the spawned child's stdin", async () => {
		// Round-6 nit #2: the dry-run test above only proves the sidecar file
		// is correct, not that Start-Process -RedirectStandardInput delivers
		// that content to claude. This test stubs claude.cmd on PATH, runs the
		// dispatcher with NO dry-run, and asserts on what the spawned child
		// actually received via stdin. The original `-ArgumentList $fullPrompt`
		// bug would fail this test (child would see only "You").
		const body =
			"You are the coder agent.\nDo NOT skip steps.\n\nLine with `backticks` and $literal $vars.\nLast line.\n";
		const { scratchDispatcher, scratchRoot } = makeScratchPromptsDir({ codeMd: body });
		const { stubDir, capturePath } = installStubClaude(scratchRoot);

		const result = spawnSync(
			powershell as string,
			["-NoProfile", "-ExecutionPolicy", "Bypass", "-File", scratchDispatcher],
			{
				env: {
					...process.env,
					// Prepend the stub dir so Get-Command finds OUR claude.cmd
					// before any real install on the system.
					PATH: `${stubDir}${delimiter}${process.env.PATH ?? ""}`,
					TASK_ID: "BACK-77",
					OLD_STATUS: "To Do",
					NEW_STATUS: "In Progress",
					TASK_TITLE: "stdin delivery check",
					// Explicitly unset DRY_RUN — we want the real Start-Process.
					BACKLOG_DISPATCH_DRY_RUN: "",
				},
				encoding: "utf8",
			},
		);
		if (result.status !== 0) {
			throw new Error(`dispatcher exited with ${result.status}\nstdout: ${result.stdout}\nstderr: ${result.stderr}`);
		}

		// Start-Process is detached, so we have to wait for the stub to flush.
		const arrived = await waitForFile(capturePath, 10000);
		expect(arrived).toBe(true);
		const captured = readFileSync(capturePath, "utf8");
		expect(captured).toContain("You are the coder agent.");
		expect(captured).toContain("Do NOT skip steps.");
		expect(captured).toContain("Line with `backticks` and $literal $vars.");
		expect(captured).toContain("Last line.");
		expect(captured).toContain("BACK-77");
		expect(captured).toContain("In Progress");
		// Length sanity: the original truncation bug would have delivered only
		// "You" (3 chars). Real prompt body + footer is ~165 chars; the threshold
		// is well above any plausible truncation and well below the real size.
		expect(captured.length).toBeGreaterThan(100);
	});

	guarded("exits 0 silently for status changes outside the dispatched set", () => {
		const { logsDir, scratchDispatcher } = makeScratchPromptsDir();
		const result = spawnSync(
			powershell as string,
			["-NoProfile", "-ExecutionPolicy", "Bypass", "-File", scratchDispatcher],
			{
				env: {
					...process.env,
					BACKLOG_DISPATCH_DRY_RUN: "1",
					TASK_ID: "BACK-1",
					OLD_STATUS: "Anything",
					NEW_STATUS: "Done", // not in the dispatch table
					TASK_TITLE: "x",
				},
				encoding: "utf8",
			},
		);
		expect(result.status).toBe(0);
		// No log files should have been produced for an unmapped status.
		expect(findLogFiles(logsDir).length).toBe(0);
	});
});
