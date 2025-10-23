import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { Command } from "commander";
import { getCompletions } from "../completions/helper.ts";

const __dirname = dirname(fileURLToPath(import.meta.url));

type Shell = "bash" | "zsh" | "fish";

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

	return null;
}

/**
 * Get the completion script content for a shell
 */
async function getCompletionScript(shell: Shell): Promise<string> {
	// Try to read from file system first (for development)
	const scriptFiles: Record<Shell, string> = {
		bash: "backlog.bash",
		zsh: "_backlog",
		fish: "backlog.fish",
	};

	const scriptPath = join(__dirname, "..", "..", "completions", scriptFiles[shell]);

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
	};

	return scripts[shell];
}

/**
 * Get installation paths for a shell
 */
function getInstallPaths(shell: Shell): { system: string; user: string } {
	const home = homedir();

	const paths: Record<Shell, { system: string; user: string }> = {
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
	};

	return instructions[shell];
}

/**
 * Install completion script
 */
async function installCompletion(shell?: string): Promise<void> {
	// Detect shell if not provided
	const targetShell = shell as Shell | undefined;
	const detectedShell = targetShell || detectShell();

	if (!detectedShell) {
		console.error("❌ Could not detect your shell.");
		console.error("   Please specify it manually:");
		console.error("   backlog completion install --shell bash");
		console.error("   backlog completion install --shell zsh");
		console.error("   backlog completion install --shell fish");
		process.exit(1);
	}

	if (!["bash", "zsh", "fish"].includes(detectedShell)) {
		console.error(`❌ Unsupported shell: ${detectedShell}`);
		console.error("   Supported shells: bash, zsh, fish");
		process.exit(1);
	}

	console.log(`📦 Installing ${detectedShell} completion for backlog CLI...`);

	// Get completion script content
	let scriptContent: string;
	try {
		scriptContent = await getCompletionScript(detectedShell);
	} catch (error) {
		console.error(`❌ ${error}`);
		process.exit(1);
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

		console.log(`✅ Completion script installed to ${installPath}`);
		console.log(getEnableInstructions(detectedShell, installPath));
	} catch (error) {
		console.error(`❌ Failed to install completion script: ${error}`);
		console.error("\nYou can try manual installation:");
		console.error("\n1. System-wide installation (requires sudo):");
		console.error(
			`   sudo cp completions/${detectedShell === "zsh" ? "_backlog" : `backlog.${detectedShell}`} ${paths.system}`,
		);
		console.error("\n2. User installation:");
		console.error(`   mkdir -p ${installDir}`);
		console.error(
			`   cp completions/${detectedShell === "zsh" ? "_backlog" : `backlog.${detectedShell}`} ${installPath}`,
		);
		process.exit(1);
	}
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
			} catch (error) {
				// Silent failure - completion should never break the shell
				process.exit(1);
			}
		});

	// Installation command
	completionCmd
		.command("install")
		.description("install shell completion script")
		.option("--shell <shell>", "shell type (bash, zsh, fish)")
		.action(async (options: { shell?: string }) => {
			await installCompletion(options.shell);
		});
}
