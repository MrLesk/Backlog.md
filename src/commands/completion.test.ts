import { afterEach, describe, expect, test } from "bun:test";
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
