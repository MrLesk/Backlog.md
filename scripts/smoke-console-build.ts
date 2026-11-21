import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const binary = resolve(process.argv[2] ?? "");
if (!process.argv[2]) throw new Error("Usage: bun scripts/smoke-console-build.ts <binary>");
const root = await mkdtemp(join(tmpdir(), "backlog-native-console-"));
const session = `backlog-native-${process.pid}-${Date.now()}`;

async function command(args: string[], cwd = root): Promise<string> {
	const child = Bun.spawn(args, { cwd, stdout: "pipe", stderr: "pipe" });
	const [code, stdout, stderr] = await Promise.all([
		child.exited,
		new Response(child.stdout).text(),
		new Response(child.stderr).text(),
	]);
	assert.equal(code, 0, `${args.join(" ")}: ${stderr}\n${stdout}`);
	return stdout;
}

const terminal = (args: string[]) => command(["tui-test", "--session", session, ...args]);
async function expectExit() {
	await terminal(["wait", "exit", "--timeout", "10000"]);
	const status = JSON.parse(await terminal(["--json", "daemon", "status"]));
	assert.equal(status.data.exited, 0, "The console process did not exit zero");
}

try {
	await command([binary, "init", "Native console", "--defaults", "--no-git", "--integration-mode", "none"]);
	await command([binary, "task", "create", "First console task", "--description", "First detail anchor"]);
	await command([binary, "task", "create", "Second console task", "--description", "Second detail anchor"]);
	const tasks = JSON.parse(await command([binary, "task", "list", "--json"])).tasks;
	const description = tasks[1].title === "First console task" ? "First detail anchor" : "Second detail anchor";
	await terminal(["run", "--cols", "120", "--rows", "36", "--cwd", root, binary, "board"]);
	await terminal(["expect", "text", "First console task", "--timeout", "10000"]);
	await terminal(["expect", "text", "Second console task", "--timeout", "10000"]);
	await terminal(["screenshot", `${binary}.tui-board.svg`]);
	await terminal(["key", "press", "Down"]);
	await terminal(["wait", "idle", "--timeout", "10000"]);
	await terminal(["key", "press", "Enter"]);
	await terminal(["expect", "text", description, "--timeout", "10000"]);
	await terminal(["screenshot", `${binary}.tui-details.svg`]);
	await terminal(["key", "press", "Escape"]);
	await terminal(["expect", "text", "First console task", "--timeout", "10000"]);
	await terminal(["key", "press", "q"]);
	await expectExit();
	await terminal(["run", "--restart", "--cols", "120", "--rows", "36", "--cwd", root, binary, "board"]);
	await terminal(["expect", "text", "First console task", "--timeout", "10000"]);
	await terminal(["key", "press", "Ctrl+C"]);
	await expectExit();
	console.log(`Native board selection, details, q and Ctrl+C passed: ${process.platform}-${process.arch}`);
} finally {
	await terminal(["screenshot", `${binary}.tui-final.svg`]).catch((error) => console.error(error));
	await terminal(["close"]).catch((error) => console.error(error));
	await rm(root, { recursive: true, force: true });
}
