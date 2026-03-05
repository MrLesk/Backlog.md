import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { Command } from "commander";
import { getCompletions } from "../completions/helper.ts";

const __dirname = dirname(fileURLToPath(import.meta.url));

export type Shell = "bash" | "zsh" | "fish" | "pwsh";

interface InstallPaths {
	system?: string;
	user: string;
}

function getScriptFilename(shell: Shell): string {
	const scriptFiles: Record<Shell, string> = {
		bash: "backlog.bash",
		zsh: "_backlog",
		fish: "backlog.fish",
		pwsh: "backlog.ps1",
	};

	return scriptFiles[shell];
}

function resolvePowerShellProfilePath(): string {
	const executables = ["pwsh"];
	const windowsExecutablePaths = process.platform === "win32" ? getWindowsPowerShellExecutables() : [];
	const candidates = [...executables, ...windowsExecutablePaths];
	const errors: string[] = [];

	for (const executable of candidates) {
		const result = spawnSync(executable, ["-NoProfile", "-Command", "$PROFILE.CurrentUserAllHosts"], {
			encoding: "utf-8",
			windowsHide: true,
		});

		if (result.error) {
			errors.push(`${executable}: ${result.error.message}`);
			continue;
		}

		if (result.status !== 0) {
			const failure = result.stderr.trim() || result.stdout.trim() || `exit code ${result.status}`;
			errors.push(`${executable}: ${failure}`);
			continue;
		}

		const profilePath = result.stdout.trim();
		if (!profilePath) {
			errors.push(`${executable}: returned empty profile path`);
			continue;
		}

		return profilePath;
	}

	const details = errors.map((error) => `  - ${error}`);
	throw new Error(
		[
			"Could not resolve your PowerShell profile path automatically.",
			"Ensure PowerShell 7+ (pwsh) is installed (PATH lookup and common Windows install paths were checked).",
			"Resolution attempts:",
			...details,
		].join("\n"),
	);
}

function getWindowsPowerShellExecutables(): string[] {
	const candidates = [
		process.env.ProgramFiles ? join(process.env.ProgramFiles, "PowerShell", "7", "pwsh.exe") : null,
		process.env["ProgramFiles(x86)"] ? join(process.env["ProgramFiles(x86)"], "PowerShell", "7", "pwsh.exe") : null,
	].filter((path): path is string => Boolean(path));

	return candidates.filter((path) => existsSync(path));
}

export interface CompletionInstallResult {
	shell: Shell;
	installPath: string;
	instructions: string;
}

/**
 * Detect the user's current shell
 */
function detectShell(): Shell | null {
	const shell = process.env.SHELL || "";

	if (shell.includes("bash")) {
		return "bash";
	}
	if (shell.includes("zsh")) {
		return "zsh";
	}
	if (shell.includes("fish")) {
		return "fish";
	}
	if (shell.includes("pwsh")) {
		return "pwsh";
	}
	if (process.platform === "win32" && /PowerShell[\\/]+7/i.test(process.env.PSModulePath || "")) {
		return "pwsh";
	}

	return null;
}

/**
 * Get the completion script content for a shell
 */
async function getCompletionScript(shell: Shell): Promise<string> {
	// Try to read from file system first (for development)
	const scriptPath = join(__dirname, "..", "..", "completions", getScriptFilename(shell));

	try {
		if (existsSync(scriptPath)) {
			return await readFile(scriptPath, "utf-8");
		}
	} catch {
		// Fall through to embedded scripts
	}

	// Fallback to embedded scripts (for compiled binary)
	return getEmbeddedCompletionScript(shell);
}

/**
 * Get embedded completion script (used when files aren't available)
 */
function getEmbeddedCompletionScript(shell: Shell): string {
	const scripts: Record<Shell, string> = {
		bash: `#!/usr/bin/env bash
# Bash completion script for backlog CLI
#
# Installation:
#   - Copy to /etc/bash_completion.d/backlog
#   - Or source directly in ~/.bashrc: source /path/to/backlog.bash
#
# Requirements:
#   - Bash 4.x or 5.x
#   - bash-completion package (optional but recommended)

# Main completion function for backlog CLI
_backlog() {
	# Initialize completion variables using bash-completion helper if available
	# Falls back to manual initialization if bash-completion is not installed
	local cur prev words cword
	if declare -F _init_completion >/dev/null 2>&1; then
		_init_completion || return
	else
		# Manual initialization fallback
		COMPREPLY=()
		cur="\${COMP_WORDS[COMP_CWORD]}"
		prev="\${COMP_WORDS[COMP_CWORD-1]}"
		words=("\${COMP_WORDS[@]}")
		cword=$COMP_CWORD
	fi

	# Get the full command line and cursor position
	local line="\${COMP_LINE}"
	local point="\${COMP_POINT}"

	# Call the CLI's internal completion command
	# This delegates all completion logic to the TypeScript implementation
	# Output format: one completion per line
	local completions
	completions=$(backlog completion __complete "$line" "$point" 2>/dev/null)

	# Check if the completion command failed
	if [[ $? -ne 0 ]]; then
		# Silent failure - completion should never break the shell
		return 0
	fi

	# Generate completion replies using compgen
	# -W: wordlist - splits completions by whitespace
	# --: end of options
	# "$cur": current word being completed
	COMPREPLY=( $(compgen -W "$completions" -- "$cur") )

	# Return success
	return 0
}

# Register the completion function for the 'backlog' command
# -F: use function for completion
# _backlog: name of the completion function
# backlog: command to complete
complete -F _backlog backlog
`,
		zsh: `#compdef backlog

# Zsh completion script for backlog CLI
#
# Installation:
#   1. Copy this file to a directory in your $fpath
#   2. Run: compinit
#
# Or use: backlog completion install --shell zsh

_backlog() {
	# Get the current command line buffer and cursor position
	local line=$BUFFER
	local point=$CURSOR

	# Call the backlog completion command to get dynamic completions
	# The __complete command returns one completion per line
	local -a completions
	completions=(\${(f)"$(backlog completion __complete "$line" "$point" 2>/dev/null)"})

	# Check if we got any completions
	if (( \${#completions[@]} == 0 )); then
		# No completions available
		return 1
	fi

	# Present the completions to the user
	# _describe shows completions with optional descriptions
	# The first argument is the tag name shown in completion groups
	_describe 'backlog commands' completions
}

# Register the completion function for the backlog command
compdef _backlog backlog
`,
		fish: `#!/usr/bin/env fish
# Fish completion script for backlog CLI
#
# Installation:
#   - Copy to ~/.config/fish/completions/backlog.fish
#   - Or use: backlog completion install --shell fish
#
# Requirements:
#   - Fish 3.x or later

# Helper function to get completions from the CLI
# This delegates all completion logic to the TypeScript implementation
function __backlog_complete
	# Get the current command line and cursor position
	# -cp: get the command line with cursor position preserved
	set -l line (commandline -cp)

	# Calculate the cursor position (length of the line up to cursor)
	# Fish tracks cursor position differently than bash/zsh
	set -l point (string length "$line")

	# Call the CLI's internal completion command
	# Output format: one completion per line
	# Redirect stderr to /dev/null to suppress error messages
	backlog completion __complete "$line" "$point" 2>/dev/null

	# Fish will automatically handle the exit status
	# If the command fails, no completions will be shown
end

# Register completion for the 'backlog' command
# -c: specify the command to complete
# -f: disable file completion (we handle all completions dynamically)
# -a: add completion candidates from the function output
complete -c backlog -f -a '(__backlog_complete)'
`,
		pwsh: `# PowerShell completion script for backlog CLI
#
# Installation:
#   - Recommended: backlog completion install --shell pwsh
#   - Manual: Save this file and source it from your $PROFILE.CurrentUserAllHosts
#
# Requirements:
#   - PowerShell 7+ recommended

$__backlogCompletionScriptBlock = {
	param($wordToComplete, $commandAst, $cursorPosition)

	$line = $commandAst.ToString()
	# Preserve trailing whitespace context because CommandAst text omits it.
	if ($cursorPosition -gt $line.Length) {
		$line = $line.PadRight($cursorPosition)
	}

	# Cursor position is already an endpoint offset for completion APIs.
	$point = [Math]::Min([Math]::Max($cursorPosition, 0), $line.Length)

	try {
		$completions = @(backlog completion __complete "$line" "$point" 2>$null)
		foreach ($completion in $completions) {
			if ($completion) {
				$completionText = "$completion "
				[System.Management.Automation.CompletionResult]::new(
					$completionText,
					$completion,
					[System.Management.Automation.CompletionResultType]::ParameterValue,
					$completion
				)
			}
		}
	} catch {
		return
	}
}

Register-ArgumentCompleter -Native -CommandName @("backlog", "backlog.exe") -ScriptBlock $__backlogCompletionScriptBlock
`,
	};

	return scripts[shell];
}

/**
 * Get installation paths for a shell
 */
function getInstallPaths(shell: Shell): InstallPaths {
	const home = homedir();

	if (shell === "pwsh") {
		const profilePath = resolvePowerShellProfilePath();
		const profileDir = dirname(profilePath);

		return {
			user: join(profileDir, "Completions", "backlog-completion.ps1"),
		};
	}

	const paths: Record<Exclude<Shell, "pwsh">, InstallPaths> = {
		bash: {
			system: "/etc/bash_completion.d/backlog",
			user: join(home, ".local/share/bash-completion/completions/backlog"),
		},
		zsh: {
			system: "/usr/local/share/zsh/site-functions/_backlog",
			user: join(home, ".zsh/completions/_backlog"),
		},
		fish: {
			system: "/usr/share/fish/vendor_completions.d/backlog.fish",
			user: join(home, ".config/fish/completions/backlog.fish"),
		},
	};

	return paths[shell];
}

/**
 * Get instructions for enabling completions after installation
 */
function getEnableInstructions(shell: Shell, installPath: string): string {
	const instructions: Record<Shell, string> = {
		bash: `
To enable completions, add this to your ~/.bashrc:
source ${installPath}

Then restart your shell or run:
source ~/.bashrc
`,
		zsh: `
To enable completions, ensure the directory is in your fpath.
Add this to your ~/.zshrc:
fpath=(${dirname(installPath)} $fpath)
autoload -Uz compinit && compinit

Then restart your shell or run:
source ~/.zshrc
`,
		fish: `
Completions should be automatically loaded by fish.
Restart your shell or run:
exec fish
`,
		pwsh: `
To enable completions, add this to your PowerShell profile ($PROFILE.CurrentUserAllHosts):
$completionScript = Join-Path (Split-Path -Parent $PROFILE.CurrentUserAllHosts) "Completions/backlog-completion.ps1"
if (Test-Path $completionScript) { . $completionScript }

Then restart PowerShell or run:
. $PROFILE.CurrentUserAllHosts
`,
	};

	return instructions[shell];
}

/**
 * Install completion script
 */
export async function installCompletion(shell?: string): Promise<CompletionInstallResult> {
	// Detect shell if not provided
	const targetShell = shell as Shell | undefined;
	const detectedShell = targetShell || detectShell();

	if (!detectedShell) {
		const message = [
			"Could not detect your shell.",
			"Please specify it manually:",
			"  backlog completion install --shell bash",
			"  backlog completion install --shell zsh",
			"  backlog completion install --shell fish",
			"  backlog completion install --shell pwsh",
		].join("\n");
		throw new Error(message);
	}

	if (!["bash", "zsh", "fish", "pwsh"].includes(detectedShell)) {
		throw new Error(`Unsupported shell: ${detectedShell}\nSupported shells: bash, zsh, fish, pwsh`);
	}

	// Get completion script content
	let scriptContent: string;
	try {
		scriptContent = await getCompletionScript(detectedShell);
	} catch (error) {
		throw new Error(error instanceof Error ? error.message : String(error));
	}

	// Get installation paths
	const paths = getInstallPaths(detectedShell);

	// Try user installation first (no sudo required)
	const installPath = paths.user;
	const installDir = dirname(installPath);

	try {
		// Create directory if it doesn't exist
		if (!existsSync(installDir)) {
			await mkdir(installDir, { recursive: true });
		}

		// Write the completion script
		await writeFile(installPath, scriptContent, "utf-8");
	} catch (error) {
		const scriptFilename = getScriptFilename(detectedShell);
		const manualInstructions =
			detectedShell === "pwsh"
				? [
						"Failed to install PowerShell completion script automatically.",
						"",
						`Target path: ${installPath}`,
						"",
						"Ensure the profile directory is writable and run again:",
						"  backlog completion install --shell pwsh",
						"",
						"Then add this to your PowerShell profile ($PROFILE.CurrentUserAllHosts):",
						'$completionScript = Join-Path (Split-Path -Parent $PROFILE.CurrentUserAllHosts) "Completions/backlog-completion.ps1"',
						"if (Test-Path $completionScript) { . $completionScript }",
					].join("\n")
				: [
						"Failed to install completion script automatically.",
						"",
						"Manual installation options:",
						"1. System-wide installation (requires sudo):",
						`   sudo cp completions/${scriptFilename} ${paths.system}`,
						"",
						"2. User installation:",
						`   mkdir -p ${installDir}`,
						`   cp completions/${scriptFilename} ${installPath}`,
					].join("\n");
		const errorMessage = error instanceof Error ? error.message : String(error);
		throw new Error(`${errorMessage}\n\n${manualInstructions}`);
	}

	return {
		shell: detectedShell,
		installPath,
		instructions: getEnableInstructions(detectedShell, installPath),
	};
}

/**
 * Register the completion command and subcommands
 */
export function registerCompletionCommand(program: Command): void {
	const completionCmd = program.command("completion").description("manage shell completion scripts");

	// Hidden command used by shell completion scripts
	completionCmd
		.command("__complete <line> <point>")
		.description("internal command for shell completion (do not call directly)")
		.action(async (line: string, point: string) => {
			try {
				const pointNum = Number.parseInt(point, 10);
				if (Number.isNaN(pointNum)) {
					process.exit(1);
				}

				const completions = await getCompletions(program, line, pointNum);
				for (const completion of completions) {
					console.log(completion);
				}
				process.exit(0);
			} catch (_error) {
				// Silent failure - completion should never break the shell
				process.exit(1);
			}
		});

	// Installation command
	completionCmd
		.command("install")
		.description("install shell completion script")
		.option("--shell <shell>", "shell type (bash, zsh, fish, pwsh)")
		.action(async (options: { shell?: string }) => {
			try {
				const result = await installCompletion(options.shell);
				console.log(`📦 Installed ${result.shell} completion for backlog CLI.`);
				console.log(`✅ Completion script written to ${result.installPath}`);
				console.log(result.instructions.trimEnd());
			} catch (error) {
				const message = error instanceof Error ? error.message : String(error);
				console.error(`❌ ${message}`);
				process.exit(1);
			}
		});
}
