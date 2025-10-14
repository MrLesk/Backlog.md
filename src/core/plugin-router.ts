import { execFile, spawn } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

/**
 * Plugin router that discovers and executes backlog plugins following the git plugin pattern.
 * Plugins are discovered as executables named `backlog-<plugin-name>` in PATH or node_modules/.bin.
 */
export class PluginRouter {
	/**
	 * Check if a plugin executable exists
	 * @param pluginName - The plugin name (e.g., "jira" for "backlog-jira")
	 * @returns The full path to the plugin executable, or null if not found
	 */
	async findPlugin(pluginName: string): Promise<string | null> {
		const executableName = `backlog-${pluginName}`;

		try {
			// Try to find in PATH using 'which' command (works on Unix-like systems)
			const { stdout } = await execFileAsync("which", [executableName]);
			return stdout.trim();
		} catch {
			// Try Windows 'where' command
			try {
				const { stdout } = await execFileAsync("where", [executableName]);
				// 'where' returns all matches, take the first one
				return stdout.split("\n")[0]?.trim() || null;
			} catch {
				// Plugin not found
				return null;
			}
		}
	}

	/**
	 * Execute a plugin command
	 * @param pluginName - The plugin name (e.g., "jira")
	 * @param args - Arguments to pass to the plugin
	 * @returns Promise that resolves with the exit code
	 */
	async executePlugin(pluginName: string, args: string[]): Promise<number> {
		const executablePath = await this.findPlugin(pluginName);

		if (!executablePath) {
			return this.handlePluginNotFound(pluginName);
		}

		// Execute the plugin, forwarding stdio
		return new Promise((resolve) => {
			const child = spawn(executablePath, args, {
				stdio: "inherit", // Forward stdin, stdout, stderr
				env: process.env,
			});

			child.on("error", (error) => {
				console.error(`Failed to execute plugin: ${error.message}`);
				resolve(1);
			});

			child.on("close", (code) => {
				resolve(code ?? 1);
			});
		});
	}

	/**
	 * Handle case where plugin is not found
	 * @param pluginName - The plugin name that was not found
	 * @returns Exit code (always 1 for not found)
	 */
	private handlePluginNotFound(pluginName: string): number {
		console.error(`Error: Plugin 'backlog-${pluginName}' not found.`);
		console.error("");
		console.error("To use this command, install the plugin:");
		console.error(`  npm install -g backlog-${pluginName}`);
		console.error("  # or");
		console.error(`  bun add -d backlog-${pluginName}`);
		console.error("");
		console.error("Available plugins:");
		console.error("  backlog-jira    - Jira integration");
		console.error("  backlog-github  - GitHub integration");
		return 1;
	}

	/**
	 * Check if a command should be routed to a plugin
	 * @param args - Command line arguments
	 * @returns Object with shouldRoute flag and plugin info
	 */
	shouldRouteToPlugin(args: string[]): {
		shouldRoute: boolean;
		pluginName?: string;
		pluginArgs?: string[];
	} {
		// Skip if no arguments
		if (args.length === 0) {
			return { shouldRoute: false };
		}

		const firstArg = args[0];

		// Skip if it's a known core command or flag
		const coreCommands = [
			"init",
			"task",
			"tasks",
			"draft",
			"board",
			"doc",
			"decision",
			"search",
			"config",
			"agents",
			"cleanup",
			"browser",
			"overview",
			"sequence",
			"mcp",
			"--help",
			"-h",
			"--version",
			"-v",
			"help",
		];

		if (firstArg && coreCommands.includes(firstArg)) {
			return { shouldRoute: false };
		}

		// Check if first arg looks like a flag
		if (firstArg && firstArg.startsWith("-")) {
			return { shouldRoute: false };
		}

		// Route to plugin
		return {
			shouldRoute: true,
			pluginName: firstArg,
			pluginArgs: args.slice(1),
		};
	}
}
