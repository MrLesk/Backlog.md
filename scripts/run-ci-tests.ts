const PLATFORM_CONTRACT_FILES = [
	// Filesystem, paths, locking, identity allocation, and real Git behavior.
	"src/test/atomic-task-create.test.ts",
	"src/test/auto-commit.test.ts",
	"src/test/backlog-directory.test.ts",
	"src/test/code-path.test.ts",
	"src/test/description-newlines.test.ts",
	"src/test/docs-recursive.test.ts",
	"src/test/duplicate-task-repair.test.ts",
	"src/test/filesystem.test.ts",
	"src/test/find-backlog-root.test.ts",
	"src/test/git.test.ts",
	"src/test/id-generation.test.ts",
	"src/test/markdown.test.ts",
	"src/test/task-id-resolution.test.ts",
	"src/test/task-identity-index.test.ts",
	"src/test/test-utils.test.ts",
	"src/test/unicode-rendering.test.ts",
	"src/test/worktree-refresh.test.ts",
	"src/test/worktree-task-id-allocation.test.ts",

	// Shipped CLI, executable resolution, and child-process boundaries.
	"src/test/agent-instructions.test.ts",
	"src/test/cli-browser-port.test.ts",
	"src/test/cli-doctor.test.ts",
	"src/test/cli-init-create.test.ts",
	"src/test/cli-launcher.test.ts",
	"src/test/config-commands.test.ts",
	"src/test/editor.test.ts",
	"src/test/offline-mode.test.ts",
	"src/test/packaging-bin.test.ts",
	"src/test/resolveBinary.test.ts",
	"src/test/runtime-cwd.test.ts",
	"src/test/status-callback.test.ts",
	"src/test/terminal-status.test.ts",

	// Network and stdio lifecycle boundaries.
	"src/test/mcp-server.test.ts",
	"src/test/mcp-stdio-exit.test.ts",
	"src/test/server-browser-open.test.ts",
	"src/test/server-hostname.test.ts",
	"src/test/server-init.test.ts",
	"src/test/server-port.test.ts",
] as const;

const profileArgument = process.argv.find((argument) => argument.startsWith("--profile="));
const profile = profileArgument?.slice("--profile=".length) ?? "full";
const forwardedArguments = process.argv.slice(2).filter((argument) => argument !== profileArgument);

if (profile !== "full" && profile !== "platform") {
	console.error(`Unknown CI test profile: ${profile}`);
	process.exit(2);
}

async function runBunTest(
	files: readonly string[],
	args: readonly string[],
	options: { skipDomPreload: boolean },
): Promise<number> {
	const child = Bun.spawn([process.execPath, "test", ...files, ...args], {
		stdin: "inherit",
		stdout: "inherit",
		stderr: "inherit",
		env: options.skipDomPreload ? { ...process.env, BACKLOG_TEST_SKIP_DOM_PRELOAD: "1" } : process.env,
	});
	return await child.exited;
}

if (profile === "platform") {
	process.exit(await runBunTest(PLATFORM_CONTRACT_FILES, forwardedArguments, { skipDomPreload: true }));
}

const allTestFiles = [...new Bun.Glob("src/**/*.test.{ts,tsx}").scanSync()]
	.map((file) => file.replaceAll("\\", "/"))
	.sort();

// Test files whose realms need the jsdom/react-dom preload must not run inside
// `bun test --parallel` worker processes on Linux: the jsdom -> undici ->
// node:assert import chain lazily constructs process.stderr per isolated
// realm, and in a worker (whose stdio is a Bun socketpair) that construction
// intermittently dies with an uncatchable "EEXIST: file already exists,
// epoll_ctl", failing whole unrelated test files with "Cannot call describe()
// after the test run has completed" (BACK-585). A plain single-process
// `bun test --isolate` run has never shown the failure, so the full profile
// runs these files in a separate non-parallel pass with the DOM preload, and
// every other pass skips the preload via BACKLOG_TEST_SKIP_DOM_PRELOAD.
// Files are detected by content: anything referencing jsdom, plus
// react-dom-preload.test.ts, which loads jsdom through react-dom-preload.ts.
const domTestFiles = new Set<string>(["src/test/react-dom-preload.test.ts"]);
const jsdomReference = /["']jsdom["']/;
for (const file of allTestFiles) {
	if (jsdomReference.test(await Bun.file(file).text())) domTestFiles.add(file);
}
const parallelFiles = allTestFiles.filter((file) => !domTestFiles.has(file));
const domFiles = allTestFiles.filter((file) => domTestFiles.has(file));

// The DOM pass drops --parallel* (single process) and writes its own JUnit file.
const domArguments = forwardedArguments
	.filter((argument) => !argument.startsWith("--parallel"))
	.map((argument) => (argument.startsWith("--reporter-outfile=") ? argument.replace(/\.xml$/, "-dom.xml") : argument));

const parallelExit = await runBunTest(parallelFiles, forwardedArguments, { skipDomPreload: true });
const domExit = await runBunTest(domFiles, domArguments, { skipDomPreload: false });
process.exit(parallelExit !== 0 ? parallelExit : domExit);
