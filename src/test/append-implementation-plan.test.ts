import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { $ } from "bun";
import { Core } from "../core/backlog.ts";
import { extractStructuredSection } from "../markdown/structured-sections.ts";
import { createUniqueTestDir, initializeTestProject, safeCleanup } from "./test-utils.ts";

let TEST_DIR: string;
const CLI_PATH = join(process.cwd(), "src", "cli.ts");
const SCRIPT_PATH = Bun.which("script");
const itPty = process.platform === "win32" || !SCRIPT_PATH ? it.skip : it;

function shellQuote(value: string): string {
	return `'${value.replaceAll("'", `'\\''`)}'`;
}

async function runCliInPty(args: string[]): Promise<{ exitCode: number; output: string; timedOut: boolean }> {
	if (!SCRIPT_PATH) {
		throw new Error("script is required for PTY tests");
	}

	const bunPath = Bun.which("bun") ?? "bun";
	const command = [bunPath, CLI_PATH, ...args];
	const scriptArgs =
		process.platform === "darwin"
			? [SCRIPT_PATH, "-q", "/dev/null", ...command]
			: [SCRIPT_PATH, "-q", "-e", "-c", command.map(shellQuote).join(" "), "/dev/null"];
	const child = Bun.spawn(scriptArgs, {
		cwd: TEST_DIR,
		stdin: "ignore",
		stdout: "pipe",
		stderr: "pipe",
	});
	let timedOut = false;
	const timeout = setTimeout(() => {
		timedOut = true;
		child.kill();
	}, 5_000);
	const [exitCode, stdout, stderr] = await Promise.all([
		child.exited,
		child.stdout ? new Response(child.stdout).text() : Promise.resolve(""),
		child.stderr ? new Response(child.stderr).text() : Promise.resolve(""),
	]);
	clearTimeout(timeout);
	return { exitCode, output: `${stdout}${stderr}`, timedOut };
}

describe("Append Implementation Plan via task edit --append-plan", () => {
	beforeEach(async () => {
		TEST_DIR = createUniqueTestDir("test-append-plan");
		await mkdir(TEST_DIR, { recursive: true });

		await $`git init -b main`.cwd(TEST_DIR).quiet();
		await $`git config user.name "Test User"`.cwd(TEST_DIR).quiet();
		await $`git config user.email "test@example.com"`.cwd(TEST_DIR).quiet();

		const core = new Core(TEST_DIR);
		await initializeTestProject(core, "Append Plan Test Project");
	});

	afterEach(async () => {
		await safeCleanup(TEST_DIR);
	});

	it("appends to existing Implementation Plan with single blank line separation", async () => {
		const core = new Core(TEST_DIR);
		await core.createTask(
			{
				id: "task-1",
				title: "Existing plan",
				status: "To Do",
				assignee: [],
				createdDate: "2025-09-10 00:00",
				labels: [],
				dependencies: [],
				description: "Test description",
				implementationPlan: "Original plan",
			},
			false,
		);

		let res = await $`bun ${CLI_PATH} task edit 1 --append-plan "First addition" --append-plan "Second addition"`
			.cwd(TEST_DIR)
			.quiet()
			.nothrow();
		expect(res.exitCode).toBe(0);

		res = await $`bun ${CLI_PATH} task edit 1 --append-plan "Third addition"`.cwd(TEST_DIR).quiet().nothrow();
		expect(res.exitCode).toBe(0);

		const updatedBody = await core.getTaskContent("task-1");
		expect(updatedBody).not.toBeNull();

		const body = extractStructuredSection(updatedBody ?? "", "implementationPlan") || "";
		expect(body).toBe("Original plan\n\nFirst addition\n\nSecond addition\n\nThird addition");
	});

	it("creates Implementation Plan when missing", async () => {
		const core = new Core(TEST_DIR);
		await core.createTask(
			{
				id: "task-2",
				title: "No plan yet",
				status: "To Do",
				assignee: [],
				createdDate: "2025-09-10 00:00",
				labels: [],
				dependencies: [],
				description: "Desc here",
			},
			false,
		);

		const res = await $`bun ${CLI_PATH} task edit 2 --append-plan "Plan from scratch"`.cwd(TEST_DIR).quiet().nothrow();
		expect(res.exitCode).toBe(0);

		const content = (await core.getTaskContent("task-2")) ?? "";
		expect(extractStructuredSection(content, "implementationPlan") || "").toBe("Plan from scratch");
	});

	it("supports multi-line appended content and preserves literal newlines", async () => {
		const core = new Core(TEST_DIR);
		await core.createTask(
			{
				id: "task-3",
				title: "Multiline append",
				status: "To Do",
				assignee: [],
				createdDate: "2025-09-10 00:00",
				labels: [],
				dependencies: [],
				description: "Simple description",
			},
			false,
		);

		const multiline = "Step1\nStep2\n\nPhase2";
		const res = await $`bun ${[CLI_PATH, "task", "edit", "3", "--append-plan", multiline]}`
			.cwd(TEST_DIR)
			.quiet()
			.nothrow();
		expect(res.exitCode).toBe(0);

		const updatedBody = await core.getTaskContent("task-3");
		expect(extractStructuredSection(updatedBody ?? "", "implementationPlan") || "").toContain("Step1\nStep2\n\nPhase2");
	});

	it("ignores whitespace-only values while preserving append order", async () => {
		const core = new Core(TEST_DIR);
		await core.createTask(
			{
				id: "task-6",
				title: "Whitespace append",
				status: "To Do",
				assignee: [],
				createdDate: "2025-09-10 00:00",
				labels: [],
				dependencies: [],
				description: "Description",
				implementationPlan: "Original",
			},
			false,
		);

		const res = await $`bun ${[
			CLI_PATH,
			"task",
			"edit",
			"6",
			"--append-plan",
			"  ",
			"--append-plan",
			"First\nline",
			"--append-plan",
			"Second",
		]}`
			.cwd(TEST_DIR)
			.quiet()
			.nothrow();
		expect(res.exitCode).toBe(0);
		expect(extractStructuredSection((await core.getTaskContent("task-6")) ?? "", "implementationPlan")).toBe(
			"Original\n\nFirst\nline\n\nSecond",
		);
	});

	it("allows combining --plan (replace) with --append-plan (append)", async () => {
		const core = new Core(TEST_DIR);
		await core.createTask(
			{
				id: "task-4",
				title: "Mix flags",
				status: "To Do",
				assignee: [],
				createdDate: "2025-09-10 00:00",
				labels: [],
				dependencies: [],
				description: "Description only",
			},
			false,
		);

		const res = await $`bun ${CLI_PATH} task edit 4 --plan "Replace" --append-plan "Append"`
			.cwd(TEST_DIR)
			.quiet()
			.nothrow();

		expect(res.exitCode).toBe(0);
		const updatedBody = await core.getTaskContent("task-4");
		expect(extractStructuredSection(updatedBody ?? "", "implementationPlan") || "").toBe("Replace\n\nAppend");
	});

	it("--append-plan alone counts as an edit (does not fall through to the editor)", async () => {
		const core = new Core(TEST_DIR);
		await core.createTask(
			{
				id: "task-5",
				title: "Only append",
				status: "To Do",
				assignee: [],
				createdDate: "2025-09-10 00:00",
				labels: [],
				dependencies: [],
				description: "Desc",
			},
			false,
		);

		const res = await $`bun ${CLI_PATH} task edit 5 --append-plan "Sole edit"`.cwd(TEST_DIR).quiet().nothrow();
		expect(res.exitCode).toBe(0);
		expect(extractStructuredSection((await core.getTaskContent("task-5")) ?? "", "implementationPlan") || "").toBe(
			"Sole edit",
		);
	});

	itPty("--append-plan bypasses the interactive edit wizard in a real PTY", async () => {
		const core = new Core(TEST_DIR);
		await core.createTask(
			{
				id: "task-7",
				title: "PTY append",
				status: "To Do",
				assignee: [],
				createdDate: "2025-09-10 00:00",
				labels: [],
				dependencies: [],
				description: "Description",
			},
			false,
		);

		const result = await runCliInPty(["task", "edit", "7", "--append-plan", "PTY addition"]);
		expect(result.timedOut).toBe(false);
		expect(result.exitCode, result.output).toBe(0);
		expect(extractStructuredSection((await core.getTaskContent("task-7")) ?? "", "implementationPlan")).toBe(
			"PTY addition",
		);
	});

	it("documents repeatability and replacement ordering in task edit help", async () => {
		const output = await $`bun ${CLI_PATH} task edit --help`.cwd(TEST_DIR).text();
		const normalizedOutput = output.replace(/\s+/g, " ");
		expect(output).toContain("--append-plan <text>");
		expect(normalizedOutput).toContain("append after --plan replacement (can be used multiple times)");
		expect(output).toContain("append-plan: Markdown - Append after --plan replacement; repeatable");
	});
});
