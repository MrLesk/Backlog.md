import { afterEach, describe, expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { installCompletion } from "./completion.ts";

const originalShell = process.env.SHELL;
const originalPsModulePath = process.env.PSModulePath;
const tempDirs: string[] = [];

async function makeTempDir(): Promise<string> {
	const dir = await mkdtemp(join(tmpdir(), "backlog-completion-"));
	tempDirs.push(dir);
	return dir;
}

afterEach(async () => {
	if (originalShell === undefined) {
		delete process.env.SHELL;
	} else {
		process.env.SHELL = originalShell;
	}
	if (originalPsModulePath === undefined) {
		delete process.env.PSModulePath;
	} else {
		process.env.PSModulePath = originalPsModulePath;
	}

	await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

describe("installCompletion", () => {
	test("preserves multi-word Bash completion candidates", async () => {
		if (!existsSync("/bin/bash")) {
			return;
		}

		const tempDir = await makeTempDir();
		const result = await installCompletion("bash", { homeDir: tempDir });
		const shellScript = [
			'backlog() { printf "%s\\n" "very high" "very low"; }',
			'source "$1"',
			'COMP_WORDS=(backlog task create --priority "")',
			"COMP_CWORD=4",
			'COMP_LINE="backlog task create --priority "',
			"COMP_POINT=31",
			"_backlog",
			"declare -p COMPREPLY",
		].join("\n");

		const execution = spawnSync("/bin/bash", ["--noprofile", "--norc", "-c", shellScript, "bash", result.installPath], {
			encoding: "utf-8",
		});

		expect(execution.status).toBe(0);
		expect(execution.stderr).toBe("");
		expect(execution.stdout).toContain('[0]="very high"');
		expect(execution.stdout).toContain('[1]="very low"');
		expect(execution.stdout).not.toContain("[2]=");
	});

	test("installs PowerShell completions relative to CurrentUserAllHosts profile", async () => {
		const tempDir = await makeTempDir();
		const profilePath = join(tempDir, "PowerShell", "profile.ps1");

		const result = await installCompletion("pwsh", {
			resolvePowerShellProfilePath: () => profilePath,
		});

		const expectedInstallPath = join(tempDir, "PowerShell", "Completions", "backlog-completion.ps1");
		expect(result.shell).toBe("pwsh");
		expect(result.installPath).toBe(expectedInstallPath);
		expect(result.instructions).toContain("$PROFILE.CurrentUserAllHosts");

		const script = await Bun.file(expectedInstallPath).text();
		expect(script).toContain("Register-ArgumentCompleter");
		expect(script).toContain("backlog completion __complete");
	});

	test("prefers explicit SHELL value over inherited PSModulePath", async () => {
		const tempDir = await makeTempDir();
		process.env.SHELL = "/bin/zsh";
		process.env.PSModulePath = join(tempDir, "powershell", "7", "Modules");

		const result = await installCompletion(undefined, {
			homeDir: tempDir,
			resolvePowerShellProfilePath: () => join(tempDir, "PowerShell", "profile.ps1"),
		});

		expect(result.shell).toBe("zsh");
		expect(result.installPath).toBe(join(tempDir, ".zsh", "completions", "_backlog"));

		const script = await Bun.file(result.installPath).text();
		expect(script).toContain("#compdef backlog");
	});

	test("does not infer PowerShell solely from PSModulePath", async () => {
		const tempDir = await makeTempDir();
		delete process.env.SHELL;
		process.env.PSModulePath = join(tempDir, "powershell", "7", "Modules");

		await expect(
			installCompletion(undefined, {
				homeDir: tempDir,
				resolvePowerShellProfilePath: () => join(tempDir, "PowerShell", "profile.ps1"),
			}),
		).rejects.toThrow("Could not detect your shell");
	});

	test("rejects legacy powershell shell option", async () => {
		await expect(
			installCompletion("powershell", {
				resolvePowerShellProfilePath: () => join(tmpdir(), "profile.ps1"),
			}),
		).rejects.toThrow("Unsupported shell: powershell");
	});
});
