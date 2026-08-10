import { createHash } from "node:crypto";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";
import { Core } from "../src/core/backlog.ts";
import { initializeProject } from "../src/core/init.ts";
import { serializeTask } from "../src/markdown/serializer.ts";
import { McpServer } from "../src/mcp/server.ts";
import { TaskHandlers } from "../src/mcp/tools/tasks/handlers.ts";
import { BacklogServer } from "../src/server/index.ts";
import type { Task } from "../src/types/index.ts";

const DEFAULTS = {
	iterations: 3,
	localTasks: 80,
	completedTasks: 20,
	branches: 6,
	tasksPerBranch: 12,
} as const;

const SEMANTIC_OPERATIONS = [
	"configLoads",
	"localTaskScans",
	"completedTaskScans",
	"repositoryChecks",
	"remoteFetches",
	"branchTipSnapshots",
	"remoteBranchEnumerations",
	"localBranchEnumerations",
	"treeIndexes",
	"historyScans",
	"refResolutions",
	"taskHydrations",
] as const;

type SemanticOperation = (typeof SEMANTIC_OPERATIONS)[number];
type CounterMap = Record<SemanticOperation, number>;
type OutputFormat = "table" | "json";
type SurfaceName = "core.loadTasks" | "mcp.taskSearch" | "web.taskList";

interface Options {
	iterations: number;
	localTasks: number;
	completedTasks: number;
	branches: number;
	tasksPerBranch: number;
	output: OutputFormat;
}

interface Corpus {
	root: string;
	projectRoot: string;
	expectedResults: Record<SurfaceName, ExpectedResult>;
}

interface OperationResult {
	count: number;
	digest: string;
	taskIds: string[];
}

interface ExpectedResult {
	taskIds: string[];
	requiredTaskIds: string[];
	forbiddenTaskIds: string[];
}

interface Instrumentation {
	reset(): void;
	snapshot(): CounterMap;
	restore(): void;
}

interface BenchmarkSurface {
	operation(): Promise<OperationResult>;
	instrumentation: Instrumentation;
	dispose(): Promise<void>;
}

interface Sample {
	elapsedMs: number;
	gitProcesses: number;
	operations: CounterMap;
	result: OperationResult;
}

interface NumberStats {
	min: number;
	median: number;
	p95: number;
	max: number;
	total: number;
}

interface BenchmarkResult {
	surface: SurfaceName;
	mode: "cold" | "warm";
	samples: number;
	elapsedMs: NumberStats;
	gitProcesses: NumberStats;
	semanticOperations: Record<SemanticOperation, NumberStats>;
	resultCount: NumberStats;
	resultDigest: string;
	stableResult: boolean;
	expectedResultCount: number;
	requiredTaskIds: string[];
	forbiddenTaskIds: string[];
	correctResult: true;
}

interface SurfaceDefinition {
	name: SurfaceName;
	create(projectRoot: string): Promise<BenchmarkSurface>;
}

type CallableRecord = Record<string, (...args: unknown[]) => unknown>;

function usage(): string {
	return `Task-loading benchmark (informational; no wall-clock gates)

Usage:
  bun run benchmark:task-loading [options]

Options:
  --json                  Emit machine-readable JSON instead of a table
  --iterations <count>    Samples per cold/warm case (default: ${DEFAULTS.iterations})
  --local-tasks <count>   Active tasks in the working copy (default: ${DEFAULTS.localTasks})
  --completed-tasks <n>   Completed tasks in the working copy (default: ${DEFAULTS.completedTasks})
  --branches <count>      Local branches mirrored to a local bare remote (default: ${DEFAULTS.branches})
  --tasks-per-branch <n>  Changed or branch-only tasks per branch (default: ${DEFAULTS.tasksPerBranch})
  -h, --help              Show this help`;
}

function parsePositiveInteger(flag: string, value: string | undefined): number {
	if (!value) throw new Error(`${flag} requires a positive integer.`);
	const parsed = Number(value);
	if (!Number.isSafeInteger(parsed) || parsed < 1) {
		throw new Error(`${flag} requires a positive integer.`);
	}
	return parsed;
}

function parseOptions(argv: string[]): Options | null {
	const options: Options = { ...DEFAULTS, output: "table" };
	for (let index = 0; index < argv.length; index += 1) {
		const argument = argv[index];
		switch (argument) {
			case "--json":
				options.output = "json";
				break;
			case "--iterations":
				options.iterations = parsePositiveInteger(argument, argv[++index]);
				break;
			case "--local-tasks":
				options.localTasks = parsePositiveInteger(argument, argv[++index]);
				break;
			case "--completed-tasks":
				options.completedTasks = parsePositiveInteger(argument, argv[++index]);
				break;
			case "--branches":
				options.branches = parsePositiveInteger(argument, argv[++index]);
				break;
			case "--tasks-per-branch":
				options.tasksPerBranch = parsePositiveInteger(argument, argv[++index]);
				break;
			case "-h":
			case "--help":
				console.log(usage());
				return null;
			default:
				throw new Error(`Unknown option: ${argument}`);
		}
	}
	return options;
}

async function runProcess(command: string[], cwd: string): Promise<string> {
	const child = Bun.spawn(command, {
		cwd,
		stdout: "pipe",
		stderr: "pipe",
		env: {
			...process.env,
			GIT_AUTHOR_NAME: "Backlog Benchmark",
			GIT_AUTHOR_EMAIL: "benchmark@backlog.local",
			GIT_AUTHOR_DATE: "2026-03-01T00:00:00Z",
			GIT_COMMITTER_NAME: "Backlog Benchmark",
			GIT_COMMITTER_EMAIL: "benchmark@backlog.local",
			GIT_COMMITTER_DATE: "2026-03-01T00:00:00Z",
			GIT_CONFIG_NOSYSTEM: "1",
		},
	});
	const [exitCode, stdout, stderr] = await Promise.all([
		child.exited,
		new Response(child.stdout).text(),
		new Response(child.stderr).text(),
	]);
	if (exitCode !== 0) {
		throw new Error(`${command.join(" ")} failed (${exitCode}): ${stderr.trim()}`);
	}
	return stdout.trim();
}

function benchmarkTask(id: number, title: string, status = "To Do"): Task {
	return {
		id: `TASK-${id}`,
		title,
		status,
		assignee: [],
		createdDate: "2026-01-01",
		updatedDate: "2026-01-02",
		labels: ["benchmark"],
		dependencies: [],
		description: `benchmark-task-loading token for TASK-${id}`,
		ordinal: id * 1000,
	};
}

function taskFilename(task: Task): string {
	return `${task.id.toLowerCase()} - ${task.title.replaceAll(" ", "-")}.md`;
}

async function writeTask(directory: string, task: Task): Promise<string> {
	const path = join(directory, taskFilename(task));
	await writeFile(path, serializeTask(task));
	return path;
}

async function createCorpus(options: Options): Promise<Corpus> {
	const root = await mkdtemp(join(tmpdir(), "backlog-task-loading-benchmark-"));
	try {
		return await populateCorpus(root, options);
	} catch (error) {
		await rm(root, { recursive: true, force: true });
		throw error;
	}
}

async function populateCorpus(root: string, options: Options): Promise<Corpus> {
	const projectRoot = join(root, "project");
	const originRoot = join(root, "origin.git");
	await mkdir(projectRoot);

	await runProcess(["git", "init", "--bare", originRoot], root);
	await runProcess(["git", "init", "-b", "main"], projectRoot);
	await runProcess(["git", "remote", "add", "origin", originRoot], projectRoot);

	const setupCore = new Core(projectRoot);
	await initializeProject(setupCore, {
		projectName: "Task loading benchmark",
		integrationMode: "none",
		advancedConfig: {
			autoCommit: false,
			bypassGitHooks: true,
			checkActiveBranches: true,
			remoteOperations: true,
			activeBranchDays: 36500,
		},
	});

	const activePaths: string[] = [];
	for (let index = 1; index <= options.localTasks; index += 1) {
		activePaths.push(
			await writeTask(setupCore.filesystem.tasksDir, benchmarkTask(index, `Benchmark local task ${index}`)),
		);
	}
	for (let index = 1; index <= options.completedTasks; index += 1) {
		const id = options.localTasks + index;
		await writeTask(setupCore.filesystem.completedDir, benchmarkTask(id, `Benchmark completed task ${index}`, "Done"));
	}

	await runProcess(["git", "add", "."], projectRoot);
	await runProcess(
		["git", "-c", "commit.gpgsign=false", "commit", "--no-verify", "-m", "Benchmark main corpus"],
		projectRoot,
	);
	await runProcess(["git", "push", "-u", "origin", "main"], projectRoot);

	const variantCount = Math.min(Math.floor(options.tasksPerBranch / 2), options.localTasks);
	const branchOnlyCount = options.tasksPerBranch - variantCount;
	for (let branchIndex = 1; branchIndex <= options.branches; branchIndex += 1) {
		const branch = `benchmark/branch-${String(branchIndex).padStart(2, "0")}`;
		await runProcess(["git", "switch", "-c", branch, "main"], projectRoot);

		for (let taskIndex = 0; taskIndex < variantCount; taskIndex += 1) {
			const localIndex = ((branchIndex - 1) * variantCount + taskIndex) % options.localTasks;
			const id = localIndex + 1;
			const variant = benchmarkTask(id, `Benchmark local task ${id}`, "In Progress");
			variant.updatedDate = "2026-02-01";
			await writeFile(activePaths[localIndex] as string, serializeTask(variant));
		}

		for (let taskIndex = 1; taskIndex <= branchOnlyCount; taskIndex += 1) {
			const id = options.localTasks + options.completedTasks + (branchIndex - 1) * branchOnlyCount + taskIndex;
			await writeTask(
				setupCore.filesystem.tasksDir,
				benchmarkTask(id, `Benchmark branch ${branchIndex} task ${taskIndex}`, "In Progress"),
			);
		}

		await runProcess(["git", "add", "."], projectRoot);
		await runProcess(
			["git", "-c", "commit.gpgsign=false", "commit", "--no-verify", "-m", `Benchmark branch ${branchIndex}`],
			projectRoot,
		);
		await runProcess(["git", "push", "-u", "origin", branch], projectRoot);
		await runProcess(["git", "switch", "main"], projectRoot);
	}

	setupCore.disposeSearchService();
	setupCore.disposeContentStore();

	const activeTaskIds = Array.from({ length: options.localTasks }, (_, index) => `TASK-${index + 1}`);
	const completedTaskIds = Array.from(
		{ length: options.completedTasks },
		(_, index) => `TASK-${options.localTasks + index + 1}`,
	);
	const branchOnlyTaskIds = Array.from(
		{ length: options.branches * branchOnlyCount },
		(_, index) => `TASK-${options.localTasks + options.completedTasks + index + 1}`,
	);
	const localSentinel = activeTaskIds[0] as string;
	const completedSentinel = completedTaskIds.at(-1) as string;
	const branchSentinel = branchOnlyTaskIds[0] as string;
	return {
		root,
		projectRoot,
		expectedResults: {
			"core.loadTasks": {
				taskIds: [...activeTaskIds, ...completedTaskIds, ...branchOnlyTaskIds],
				requiredTaskIds: [localSentinel, completedSentinel, branchSentinel],
				forbiddenTaskIds: [],
			},
			"mcp.taskSearch": {
				taskIds: [...activeTaskIds, ...completedTaskIds],
				requiredTaskIds: [localSentinel, completedSentinel],
				forbiddenTaskIds: [branchSentinel],
			},
			"web.taskList": {
				taskIds: [...activeTaskIds, ...branchOnlyTaskIds],
				requiredTaskIds: [localSentinel, branchSentinel],
				forbiddenTaskIds: [completedSentinel],
			},
		},
	};
}

function emptyCounters(): CounterMap {
	return Object.fromEntries(SEMANTIC_OPERATIONS.map((name) => [name, 0])) as CounterMap;
}

function instrumentCore(core: Core): Instrumentation {
	let counters = emptyCounters();
	const restores: Array<() => void> = [];
	const wrap = (target: object, method: string, counter: SemanticOperation) => {
		const methods = target as CallableRecord;
		const original = methods[method];
		if (typeof original !== "function") return;
		methods[method] = function (this: unknown, ...args: unknown[]) {
			counters[counter] += 1;
			return original.apply(this, args);
		};
		restores.push(() => {
			methods[method] = original;
		});
	};
	wrap(core.filesystem, "loadConfig", "configLoads");
	wrap(core.filesystem, "listTasks", "localTaskScans");
	wrap(core.filesystem, "listCompletedTasks", "completedTaskScans");
	wrap(core.gitOps, "fetch", "remoteFetches");
	wrap(core.gitOps, "listRecentBranchTips", "branchTipSnapshots");
	wrap(core.gitOps, "listRecentRemoteBranches", "remoteBranchEnumerations");
	wrap(core.gitOps, "listRecentBranches", "localBranchEnumerations");
	wrap(core.gitOps, "listFilesInTree", "treeIndexes");
	wrap(core.gitOps, "getBranchLastModifiedMap", "historyScans");
	wrap(core.gitOps, "resolveCommit", "refResolutions");
	wrap(core.gitOps, "showFile", "taskHydrations");

	return {
		reset() {
			counters = emptyCounters();
		},
		snapshot() {
			return { ...counters };
		},
		restore() {
			for (const restore of restores.reverse()) restore();
		},
	};
}

function taskProjection(task: Task): Record<string, unknown> {
	return {
		id: task.id,
		title: task.title,
		status: task.status,
		description: task.description ?? null,
		labels: [...(task.labels ?? [])].sort(),
		ordinal: task.ordinal ?? null,
		updatedDate: task.updatedDate ?? null,
		source: task.source ?? "local",
		branch: task.branch ?? null,
		parentTaskId: task.parentTaskId ?? null,
		dependencies: [...(task.dependencies ?? [])].sort(),
	};
}

function taskOperationResult(tasks: Task[]): OperationResult {
	const projection = tasks
		.map(taskProjection)
		.sort((left, right) => JSON.stringify(left).localeCompare(JSON.stringify(right)));
	return {
		count: projection.length,
		digest: createHash("sha256").update(JSON.stringify(projection)).digest("hex").slice(0, 16),
		taskIds: tasks.map((task) => task.id).sort((left, right) => left.localeCompare(right)),
	};
}

function textOperationResult(text: string): OperationResult {
	const normalized = text.replaceAll("\r\n", "\n").trim();
	const taskIds = normalized
		.split("\n")
		.flatMap((line) => line.match(/^\s+(TASK-\d+)\b/)?.[1] ?? [])
		.sort((left, right) => left.localeCompare(right));
	return {
		count: taskIds.length,
		digest: createHash("sha256").update(normalized).digest("hex").slice(0, 16),
		taskIds,
	};
}

function validateOperationResult(surface: SurfaceName, result: OperationResult, expected: ExpectedResult): void {
	const actualIds = new Set(result.taskIds);
	const expectedIds = new Set(expected.taskIds);
	const problems: string[] = [];
	if (result.count !== expected.taskIds.length) {
		problems.push(`expected ${expected.taskIds.length} tasks, received ${result.count}`);
	}
	if (actualIds.size !== result.taskIds.length) {
		problems.push(`received ${result.taskIds.length - actualIds.size} duplicate task IDs`);
	}
	const missingTaskIds = expected.taskIds.filter((id) => !actualIds.has(id));
	if (missingTaskIds.length > 0) {
		problems.push(`missing expected IDs: ${missingTaskIds.join(", ")}`);
	}
	const unexpectedTaskIds = result.taskIds.filter((id) => !expectedIds.has(id));
	if (unexpectedTaskIds.length > 0) {
		problems.push(`unexpected IDs: ${unexpectedTaskIds.join(", ")}`);
	}
	const missingSentinels = expected.requiredTaskIds.filter((id) => !actualIds.has(id));
	if (missingSentinels.length > 0) {
		problems.push(`missing required sentinels: ${missingSentinels.join(", ")}`);
	}
	const forbiddenSentinels = expected.forbiddenTaskIds.filter((id) => actualIds.has(id));
	if (forbiddenSentinels.length > 0) {
		problems.push(`included forbidden sentinels: ${forbiddenSentinels.join(", ")}`);
	}
	if (problems.length > 0) {
		throw new Error(`${surface} result validation failed: ${problems.join("; ")}.`);
	}
}

function coreSurface(projectRoot: string): BenchmarkSurface {
	const core = new Core(projectRoot, { enableWatchers: true });
	const instrumentation = instrumentCore(core);
	return {
		async operation() {
			return taskOperationResult(await core.loadTasks(undefined, undefined, { includeCompleted: true }));
		},
		instrumentation,
		async dispose() {
			core.disposeSearchService();
			core.disposeContentStore();
			instrumentation.restore();
		},
	};
}

function mcpSurface(projectRoot: string): BenchmarkSurface {
	const server = new McpServer(projectRoot, "Task loading benchmark");
	const handlers = new TaskHandlers(server);
	const instrumentation = instrumentCore(server);
	return {
		async operation() {
			const result = await handlers.searchTasks({ query: "benchmark-task-loading" });
			const text = result.content
				.filter((item): item is Extract<(typeof result.content)[number], { type: "text" }> => item.type === "text")
				.map((item) => item.text)
				.join("\n");
			return textOperationResult(text);
		},
		instrumentation,
		async dispose() {
			server.disposeSearchService();
			server.disposeContentStore();
			instrumentation.restore();
		},
	};
}

type WebServerInternals = {
	core: Core;
	handleListTasks(request: Request): Promise<Response>;
};

function webSurface(projectRoot: string): BenchmarkSurface {
	const server = new BacklogServer(projectRoot);
	const internals = server as unknown as WebServerInternals;
	const instrumentation = instrumentCore(internals.core);
	return {
		async operation() {
			const response = await internals.handleListTasks(
				new Request("http://benchmark.local/api/tasks?crossBranch=true"),
			);
			if (!response.ok) throw new Error(`Web task list returned HTTP ${response.status}.`);
			const payload: unknown = await response.json();
			if (!Array.isArray(payload)) throw new Error("Web task list did not return an array.");
			return taskOperationResult(payload as Task[]);
		},
		instrumentation,
		async dispose() {
			await server.stop();
			instrumentation.restore();
		},
	};
}

function instrumentGitProcesses(): {
	snapshot(): { gitProcesses: number; repositoryChecks: number };
	restore(): void;
} {
	const runtime = Bun as unknown as CallableRecord;
	const originalSpawn = runtime.spawn;
	if (typeof originalSpawn !== "function") throw new Error("Unable to instrument Bun.spawn.");
	let gitProcesses = 0;
	let repositoryChecks = 0;
	runtime.spawn = function (this: unknown, ...args: unknown[]) {
		const input = args[0];
		const command = Array.isArray(input)
			? input
			: input && typeof input === "object" && "cmd" in input
				? (input as { cmd?: unknown }).cmd
				: undefined;
		if (Array.isArray(command) && typeof command[0] === "string") {
			const executable = basename(command[0]).replace(/\.exe$/i, "");
			if (executable === "git") {
				gitProcesses += 1;
				if (command[1] === "rev-parse" && command.includes("--git-dir")) repositoryChecks += 1;
			}
		}
		return originalSpawn.apply(this, args);
	};
	return {
		snapshot: () => ({ gitProcesses, repositoryChecks }),
		restore() {
			runtime.spawn = originalSpawn;
		},
	};
}

async function measureSample(
	surfaceName: SurfaceName,
	surface: BenchmarkSurface,
	expected: ExpectedResult,
): Promise<Sample> {
	surface.instrumentation.reset();
	const processInstrumentation = instrumentGitProcesses();
	const startedAt = performance.now();
	let result: OperationResult;
	try {
		result = await surface.operation();
		validateOperationResult(surfaceName, result, expected);
	} finally {
		processInstrumentation.restore();
	}
	const elapsedMs = performance.now() - startedAt;
	const operations = surface.instrumentation.snapshot();
	const processes = processInstrumentation.snapshot();
	operations.repositoryChecks = processes.repositoryChecks;
	return {
		elapsedMs,
		gitProcesses: processes.gitProcesses,
		operations,
		result,
	};
}

function numberStats(values: number[]): NumberStats {
	const sorted = [...values].sort((left, right) => left - right);
	const middle = Math.floor(sorted.length / 2);
	const median =
		sorted.length % 2 === 0
			? ((sorted[middle - 1] as number) + (sorted[middle] as number)) / 2
			: (sorted[middle] as number);
	const p95Index = Math.max(0, Math.ceil(sorted.length * 0.95) - 1);
	return {
		min: sorted[0] as number,
		median,
		p95: sorted[p95Index] as number,
		max: sorted[sorted.length - 1] as number,
		total: values.reduce((sum, value) => sum + value, 0),
	};
}

function summarize(
	surface: SurfaceName,
	mode: "cold" | "warm",
	samples: Sample[],
	expected: ExpectedResult,
): BenchmarkResult {
	const digests = new Set(samples.map((sample) => sample.result.digest));
	return {
		surface,
		mode,
		samples: samples.length,
		elapsedMs: numberStats(samples.map((sample) => sample.elapsedMs)),
		gitProcesses: numberStats(samples.map((sample) => sample.gitProcesses)),
		semanticOperations: Object.fromEntries(
			SEMANTIC_OPERATIONS.map((operation) => [
				operation,
				numberStats(samples.map((sample) => sample.operations[operation])),
			]),
		) as Record<SemanticOperation, NumberStats>,
		resultCount: numberStats(samples.map((sample) => sample.result.count)),
		resultDigest: [...digests].sort().join(","),
		stableResult: digests.size === 1,
		expectedResultCount: expected.taskIds.length,
		requiredTaskIds: expected.requiredTaskIds,
		forbiddenTaskIds: expected.forbiddenTaskIds,
		correctResult: true,
	};
}

async function benchmarkSurface(
	definition: SurfaceDefinition,
	corpus: Corpus,
	iterations: number,
): Promise<BenchmarkResult[]> {
	const expected = corpus.expectedResults[definition.name];
	const coldSamples: Sample[] = [];
	for (let iteration = 0; iteration < iterations; iteration += 1) {
		const surface = await definition.create(corpus.projectRoot);
		try {
			coldSamples.push(await measureSample(definition.name, surface, expected));
		} finally {
			await surface.dispose();
		}
	}

	const warmSamples: Sample[] = [];
	const warmSurface = await definition.create(corpus.projectRoot);
	try {
		validateOperationResult(definition.name, await warmSurface.operation(), expected);
		for (let iteration = 0; iteration < iterations; iteration += 1) {
			warmSamples.push(await measureSample(definition.name, warmSurface, expected));
		}
	} finally {
		await warmSurface.dispose();
	}

	return [
		summarize(definition.name, "cold", coldSamples, expected),
		summarize(definition.name, "warm", warmSamples, expected),
	];
}

function formatNumber(value: number, decimals = 1): string {
	return value.toFixed(decimals);
}

function printTable(options: Options, results: BenchmarkResult[]): void {
	const rows = results.map((result) => ({
		Surface: result.surface,
		Mode: result.mode,
		Samples: String(result.samples),
		"Median ms": formatNumber(result.elapsedMs.median),
		"p95 ms": formatNumber(result.elapsedMs.p95),
		"Git procs": formatNumber(result.gitProcesses.median, 0),
		Repo: formatNumber(result.semanticOperations.repositoryChecks.median, 0),
		Fetch: formatNumber(result.semanticOperations.remoteFetches.median, 0),
		Tips: formatNumber(result.semanticOperations.branchTipSnapshots.median, 0),
		Trees: formatNumber(result.semanticOperations.treeIndexes.median, 0),
		Hydrate: formatNumber(result.semanticOperations.taskHydrations.median, 0),
		Count: formatNumber(result.resultCount.median, 0),
		Expected: String(result.expectedResultCount),
		Digest: result.resultDigest,
		Correct: result.correctResult ? "yes" : "NO",
		Stable: result.stableResult ? "yes" : "NO",
	}));
	const headers = Object.keys(rows[0] as Record<string, string>);
	const widths = Object.fromEntries(
		headers.map((header) => [
			header,
			Math.max(header.length, ...rows.map((row) => String(row[header as keyof typeof row]).length)),
		]),
	) as Record<string, number>;
	const render = (row: Record<string, string>) =>
		headers.map((header) => row[header]?.padEnd(widths[header] as number)).join("  ");

	console.log(
		`Corpus: ${options.localTasks} active + ${options.completedTasks} completed, ${options.branches} branches x ${options.tasksPerBranch} variants`,
	);
	console.log("Cold = fresh in-process surface; warm = repeated read after one unmeasured initialization.");
	console.log(render(Object.fromEntries(headers.map((header) => [header, header]))));
	console.log(render(Object.fromEntries(headers.map((header) => [header, "-".repeat(widths[header] as number)]))));
	for (const row of rows) console.log(render(row));
	console.log("Task counts, exact ID sets, and sentinels are validated; elapsed times never gate pass/fail.");
}

async function main(): Promise<void> {
	const options = parseOptions(process.argv.slice(2));
	if (!options) return;

	let corpus: Corpus | undefined;
	try {
		corpus = await createCorpus(options);
		const definitions: SurfaceDefinition[] = [
			{ name: "core.loadTasks", create: async (projectRoot) => coreSurface(projectRoot) },
			{ name: "mcp.taskSearch", create: async (projectRoot) => mcpSurface(projectRoot) },
			{ name: "web.taskList", create: async (projectRoot) => webSurface(projectRoot) },
		];
		const results: BenchmarkResult[] = [];
		for (const definition of definitions) {
			results.push(...(await benchmarkSurface(definition, corpus, options.iterations)));
		}

		const report = {
			schemaVersion: 2,
			generatedAt: new Date().toISOString(),
			environment: {
				bun: Bun.version,
				platform: process.platform,
				architecture: process.arch,
				git: await runProcess(["git", "--version"], corpus.projectRoot),
			},
			corpus: {
				activeTasks: options.localTasks,
				completedTasks: options.completedTasks,
				branches: options.branches,
				tasksPerBranch: options.tasksPerBranch,
			},
			methodology: {
				cold: "fresh in-process surface instance; operating-system caches may already be warm",
				warm: "repeated read on one long-lived surface after one unmeasured initialization",
				surfaces: "Core loader, MCP task handler, and Web task handler; transport and rendering excluded",
				gitProcesses: "top-level Git commands launched through Bun.spawn, including repository detection",
				correctness:
					"every invocation must match the fixture's exact task count and ID set plus required/forbidden sentinels",
				gating: "correctness only; elapsed times have no pass/fail thresholds",
			},
			results,
			coldWarmSemanticParity: Object.fromEntries(
				definitions.map(({ name }) => {
					const surfaceResults = results.filter((result) => result.surface === name);
					return [name, new Set(surfaceResults.map((result) => result.resultDigest)).size === 1];
				}),
			),
		};

		if (options.output === "json") console.log(JSON.stringify(report, null, 2));
		else printTable(options, results);
	} finally {
		if (corpus) await rm(corpus.root, { recursive: true, force: true });
	}
}

await main();
