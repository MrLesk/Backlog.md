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

const files = profile === "platform" ? PLATFORM_CONTRACT_FILES : [];
const child = Bun.spawn([process.execPath, "test", ...files, ...forwardedArguments], {
	stdin: "inherit",
	stdout: "inherit",
	stderr: "inherit",
	env: process.env,
});

process.exit(await child.exited);
