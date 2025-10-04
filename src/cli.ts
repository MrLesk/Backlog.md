#!/usr/bin/env node

import { join } from "node:path";
import { stdin as input, stdout as output } from "node:process";
import { createInterface } from "node:readline/promises";
import { Command } from "commander";
import prompts from "prompts";
import { registerMcpCommand } from "./commands/mcp.ts";
import { DEFAULT_DIRECTORIES } from "./constants/index.ts";
import { computeSequences } from "./core/sequences.ts";
import {
	type AgentInstructionFile,
	addAgentInstructions,
	Core,
	exportKanbanBoardToFile,
	initializeGitRepository,
	installClaudeAgent,
	isGitRepository,
	updateReadmeWithBoard,
} from "./index.ts";
import type {
	Decision,
	DecisionSearchResult,
	Document as DocType,
	DocumentSearchResult,
	SearchPriorityFilter,
	SearchResult,
	SearchResultType,
	Task,
	TaskListFilter,
	TaskSearchResult,
} from "./types/index.ts";
import { genericSelectList } from "./ui/components/generic-list.ts";
import { createLoadingScreen } from "./ui/loading.ts";
import { formatTaskPlainText, viewTaskEnhanced } from "./ui/task-viewer-with-search.ts";
import { promptText, scrollableViewer } from "./ui/tui.ts";
import { type AgentSelectionValue, PLACEHOLDER_AGENT_VALUE, processAgentSelection } from "./utils/agent-selection.ts";
import { formatValidStatuses, getCanonicalStatus, getValidStatuses } from "./utils/status.ts";
import { getTaskFilename, getTaskPath } from "./utils/task-path.ts";
import { sortTasks } from "./utils/task-sorting.ts";
import { getVersion } from "./utils/version.ts";

// Helper function for accumulating multiple CLI option values
function createMultiValueAccumulator() {
	return (value: string, previous: string | string[]) => {
		const soFar = Array.isArray(previous) ? previous : previous ? [previous] : [];
		return [...soFar, value];
	};
}

// Helper function to process multiple AC operations
/**
 * Processes --ac and --acceptance-criteria options to extract acceptance criteria
 * Handles both single values and arrays from multi-value accumulators
 */
function processAcceptanceCriteriaOptions(options: {
	ac?: string | string[];
	acceptanceCriteria?: string | string[];
}): string[] {
	const criteria: string[] = [];

	// Process --ac options
	if (options.ac) {
		const acCriteria = Array.isArray(options.ac) ? options.ac : [options.ac];
		criteria.push(...acCriteria.map((c) => String(c).trim()).filter(Boolean));
	}

	// Process --acceptance-criteria options
	if (options.acceptanceCriteria) {
		const accCriteria = Array.isArray(options.acceptanceCriteria)
			? options.acceptanceCriteria
			: [options.acceptanceCriteria];
		criteria.push(...accCriteria.map((c) => String(c).trim()).filter(Boolean));
	}

	return criteria;
}

// Windows color fix
if (process.platform === "win32") {
	const term = process.env.TERM;
	if (!term || /^(xterm|dumb|ansi|vt100)$/i.test(term)) {
		process.env.TERM = "xterm-256color";
	}
}

// Temporarily isolate BUN_OPTIONS during CLI parsing to prevent conflicts
// Save the original value so it's available for subsequent commands
const originalBunOptions = process.env.BUN_OPTIONS;
if (process.env.BUN_OPTIONS) {
	delete process.env.BUN_OPTIONS;
}

// Get version from package.json
const version = await getVersion();

// Bare-run splash screen handling (before Commander parses commands)
// Show a welcome splash when invoked without subcommands, unless help/version requested
try {
	let rawArgs = process.argv.slice(2);
	// Some package managers (e.g., Bun global shims) may inject the resolved
	// binary path as the first non-node argument. Strip it if detected.
	if (rawArgs.length > 0) {
		const first = rawArgs[0];
		if (
			typeof first === "string" &&
			/node_modules[\\/]+backlog\.md-(darwin|linux|windows)-[^\\/]+[\\/]+backlog(\.exe)?$/.test(first)
		) {
			rawArgs = rawArgs.slice(1);
		}
	}
	const wantsHelp = rawArgs.includes("-h") || rawArgs.includes("--help");
	const wantsVersion = rawArgs.includes("-v") || rawArgs.includes("--version");
	// Treat only --plain as allowed flag for splash; any other args means use normal CLI parsing
	const onlyPlain = rawArgs.length === 1 && rawArgs[0] === "--plain";
	const isBare = rawArgs.length === 0 || onlyPlain;
	if (isBare && !wantsHelp && !wantsVersion) {
		const isTTY = !!process.stdout.isTTY;
		const forcePlain = rawArgs.includes("--plain");
		const noColor = !!process.env.NO_COLOR || !isTTY;

		let initialized = false;
		try {
			const core = new Core(process.cwd());
			const cfg = await core.filesystem.loadConfig();
			initialized = !!cfg;
		} catch {
			initialized = false;
		}

		const { printSplash } = await import("./ui/splash.ts");
		// Auto-fallback to plain when non-TTY, or explicit --plain, or if terminal very narrow
		const termWidth = Math.max(0, Number(process.stdout.columns || 0));
		const autoPlain = !isTTY || (termWidth > 0 && termWidth < 60);
		await printSplash({
			version,
			initialized,
			plain: forcePlain || autoPlain,
			color: !noColor,
		});
		// Ensure we don't enter Commander command parsing
		process.exit(0);
	}
} catch {
	// Fall through to normal CLI parsing on any splash error
}

// Global config migration - run before any command processing
// Only run if we're in a backlog project (skip for init, help, version)
const shouldRunMigration =
	!process.argv.includes("init") &&
	!process.argv.includes("--help") &&
	!process.argv.includes("-h") &&
	!process.argv.includes("--version") &&
	!process.argv.includes("-v") &&
	process.argv.length > 2; // Ensure we have actual commands

if (shouldRunMigration) {
	try {
		const cwd = process.cwd();
		const core = new Core(cwd);

		// Only migrate if config already exists (project is already initialized)
		const config = await core.filesystem.loadConfig();
		if (config) {
			await core.ensureConfigMigrated();
		}
	} catch (_error) {
		// Silently ignore migration errors - project might not be initialized yet
	}
}

const program = new Command();
program
	.name("backlog")
	.description("Backlog.md - Project management CLI")
	.version(version, "-v, --version", "display version number");

program
	.command("init [projectName]")
	.description("initialize backlog project in the current repository")
	.option(
		"--agent-instructions <instructions>",
		"comma-separated agent instructions to create. Valid: claude, agents, gemini, copilot, cursor (alias of agents), none. Use 'none' to skip; when combined with others, 'none' is ignored.",
	)
	.option("--check-branches <boolean>", "check task states across active branches (default: true)")
	.option("--include-remote <boolean>", "include remote branches when checking (default: true)")
	.option("--branch-days <number>", "days to consider branch active (default: 30)")
	.option("--bypass-git-hooks <boolean>", "bypass git hooks when committing (default: false)")
	.option("--zero-padded-ids <number>", "number of digits for zero-padding IDs (0 to disable)")
	.option("--default-editor <editor>", "default editor command")
	.option("--web-port <number>", "default web UI port (default: 6420)")
	.option("--auto-open-browser <boolean>", "auto-open browser for web UI (default: true)")
	.option("--install-claude-agent <boolean>", "install Claude Code agent (default: false)")
	.option("--defaults", "use default values for all prompts")
	.action(
		async (
			projectName: string | undefined,
			options: {
				agentInstructions?: string;
				checkBranches?: string;
				includeRemote?: string;
				branchDays?: string;
				bypassGitHooks?: string;
				zeroPaddedIds?: string;
				defaultEditor?: string;
				webPort?: string;
				autoOpenBrowser?: string;
				installClaudeAgent?: string;
				defaults?: boolean;
			},
		) => {
			try {
				const cwd = process.cwd();
				const isRepo = await isGitRepository(cwd);

				if (!isRepo) {
					const rl = createInterface({ input, output });
					const answer = (await rl.question("No git repository found. Initialize one here? [y/N] "))
						.trim()
						.toLowerCase();
					rl.close();

					if (answer.startsWith("y")) {
						await initializeGitRepository(cwd);
					} else {
						console.log("Aborting initialization.");
						process.exit(1);
					}
				}

				const core = new Core(cwd);

				// Check if project is already initialized and load existing config
				const existingConfig = await core.filesystem.loadConfig();
				const isReInitialization = !!existingConfig;

				if (isReInitialization) {
					console.log(
						"Existing backlog project detected. Current configuration will be preserved where not specified.",
					);
				}

				// Helper function to parse boolean strings
				const parseBoolean = (value: string | undefined, defaultValue: boolean): boolean => {
					if (value === undefined) return defaultValue;
					return value.toLowerCase() === "true" || value === "1";
				};

				// Helper function to parse number strings
				const parseNumber = (value: string | undefined, defaultValue: number): number => {
					if (value === undefined) return defaultValue;
					const parsed = Number.parseInt(value, 10);
					return Number.isNaN(parsed) ? defaultValue : parsed;
				};

				// Non-interactive mode when any flag is provided or --defaults is used
				const isNonInteractive = !!(
					options.agentInstructions ||
					options.defaults ||
					options.checkBranches ||
					options.includeRemote ||
					options.branchDays ||
					options.bypassGitHooks ||
					options.zeroPaddedIds ||
					options.defaultEditor ||
					options.webPort ||
					options.autoOpenBrowser ||
					options.installClaudeAgent
				);

				// Get project name
				let name = projectName;
				if (!name) {
					const defaultName = existingConfig?.projectName || "";
					const promptMessage = isReInitialization && defaultName ? `Project name (${defaultName}):` : "Project name:";
					name = await promptText(promptMessage);
					// Use existing name if nothing entered during re-init
					if (!name && isReInitialization && defaultName) {
						name = defaultName;
					}
					if (!name) {
						console.log("Aborting initialization.");
						process.exit(1);
					}
				}

				// 1. Cross-branch checking configuration
				let crossBranchPrompt: { checkActiveBranches: boolean };

				// Skip prompts if in non-interactive mode
				if (isNonInteractive) {
					crossBranchPrompt = {
						checkActiveBranches: parseBoolean(options.checkBranches, existingConfig?.checkActiveBranches ?? true),
					};
				} else {
					crossBranchPrompt = await prompts(
						{
							type: "confirm",
							name: "checkActiveBranches",
							message: "Check task states across active branches?",
							hint: "Ensures accurate task tracking across branches (may impact performance on large repos)",
							initial: existingConfig?.checkActiveBranches ?? true,
						},
						{
							onCancel: () => {
								console.log("Aborting initialization.");
								process.exit(1);
							},
						},
					);
				}

				let remoteOperations = false;
				let activeBranchDays = 30;

				if (crossBranchPrompt.checkActiveBranches) {
					if (isNonInteractive) {
						// Use flag values or defaults in non-interactive mode
						remoteOperations = parseBoolean(options.includeRemote, existingConfig?.remoteOperations ?? true);
						activeBranchDays = parseNumber(options.branchDays, existingConfig?.activeBranchDays || 30);
					} else {
						// 1.1 Remote branches checking
						const remotePrompt = await prompts(
							{
								type: "confirm",
								name: "remoteOperations",
								message: "Check task states in remote branches?",
								hint: "Required for accessing tasks from feature branches on remote repos",
								initial: existingConfig?.remoteOperations ?? true,
							},
							{
								onCancel: () => {
									console.log("Aborting initialization.");
									process.exit(1);
								},
							},
						);
						remoteOperations = remotePrompt.remoteOperations ?? false;

						// 1.2 Active branch days
						const daysPrompt = await prompts(
							{
								type: "number",
								name: "activeBranchDays",
								message: "How many days should a branch be considered active?",
								hint: "Lower values improve performance (default: 30 days)",
								initial: existingConfig?.activeBranchDays || 30,
								min: 1,
								max: 365,
							},
							{
								onCancel: () => {
									console.log("Aborting initialization.");
									process.exit(1);
								},
							},
						);
						activeBranchDays = daysPrompt.activeBranchDays || 30;
					}
				}

				// 2. Git hooks bypass prompt
				let bypassGitHooks: boolean;
				if (isNonInteractive) {
					bypassGitHooks = parseBoolean(options.bypassGitHooks, existingConfig?.bypassGitHooks ?? false);
				} else {
					const gitHooksPrompt = await prompts(
						{
							type: "confirm",
							name: "bypassGitHooks",
							message: "Bypass git hooks when committing?",
							hint: "Use --no-verify flag to skip pre-commit hooks",
							initial: existingConfig?.bypassGitHooks ?? false,
						},
						{
							onCancel: () => {
								console.log("Aborting initialization.");
								process.exit(1);
							},
						},
					);
					bypassGitHooks = gitHooksPrompt.bypassGitHooks ?? false;
				}

				// 3. Zero-padding configuration
				let zeroPaddedIds: number | undefined;
				if (isNonInteractive) {
					const paddingValue = parseNumber(options.zeroPaddedIds, existingConfig?.zeroPaddedIds || 0);
					zeroPaddedIds = paddingValue === 0 ? 0 : paddingValue;
				} else {
					const zeroPaddingPrompt = await prompts(
						{
							type: "confirm",
							name: "enableZeroPadding",
							message: "Enable zero-padded IDs for consistent formatting?",
							hint: "Example: task-001, doc-001 instead of task-1, doc-1",
							initial: (existingConfig?.zeroPaddedIds ?? 0) > 0,
						},
						{
							onCancel: () => {
								console.log("Aborting initialization.");
								process.exit(1);
							},
						},
					);

					if (zeroPaddingPrompt.enableZeroPadding) {
						// 3.1 Number of digits for zero-padding
						const paddingPrompt = await prompts(
							{
								type: "number",
								name: "paddingWidth",
								message: "Number of digits for zero-padding:",
								hint: "e.g., 3 creates task-001, task-002; 4 creates task-0001, task-0002",
								initial: existingConfig?.zeroPaddedIds || 3,
								min: 1,
								max: 10,
							},
							{
								onCancel: () => {
									console.log("Aborting initialization.");
									process.exit(1);
								},
							},
						);

						if (paddingPrompt?.paddingWidth) {
							zeroPaddedIds = paddingPrompt.paddingWidth;
						}
					} else {
						// User chose not to enable padding
						zeroPaddedIds = 0;
					}
				}

				// 4. Default editor configuration
				let defaultEditor: string | undefined;
				if (isNonInteractive) {
					defaultEditor =
						options.defaultEditor ||
						existingConfig?.defaultEditor ||
						process.env.EDITOR ||
						process.env.VISUAL ||
						undefined;
				} else {
					const editorPrompt = await prompts(
						{
							type: "text",
							name: "editor",
							message: "Default editor command (optional):",
							hint: "e.g., 'code --wait', 'vim', 'nano'",
							initial: existingConfig?.defaultEditor || process.env.EDITOR || process.env.VISUAL || "",
						},
						{
							onCancel: () => {
								console.log("Aborting initialization.");
								process.exit(1);
							},
						},
					);

					if (editorPrompt?.editor) {
						const { isEditorAvailable } = await import("./utils/editor.ts");
						const isAvailable = await isEditorAvailable(editorPrompt.editor);
						if (isAvailable) {
							defaultEditor = editorPrompt.editor;
						} else {
							console.warn(`Warning: Editor command '${editorPrompt.editor}' not found in PATH`);
							// Still allow them to set it even if not found
							const confirmAnyway = await prompts(
								{
									type: "confirm",
									name: "confirm",
									message: "Editor not found in PATH. Set it anyway?",
									initial: false,
								},
								{
									onCancel: () => {
										console.log("Aborting initialization.");
										process.exit(1);
									},
								},
							);
							if (confirmAnyway?.confirm) {
								defaultEditor = editorPrompt.editor;
							}
						}
					}
				}

				// 5. Web UI configuration
				let webUIConfig: { defaultPort?: number; autoOpenBrowser?: boolean } = {};
				if (isNonInteractive) {
					// Use flag values or defaults for web UI in non-interactive mode
					webUIConfig = {
						defaultPort: parseNumber(options.webPort, existingConfig?.defaultPort ?? 6420),
						autoOpenBrowser: parseBoolean(options.autoOpenBrowser, existingConfig?.autoOpenBrowser ?? true),
					};
				} else {
					const webUIPrompt = await prompts(
						{
							type: "confirm",
							name: "configureWebUI",
							message: "Override default web UI settings?",
							hint: "Optional: Set custom port and browser behavior",
							initial: false,
						},
						{
							onCancel: () => {
								console.log("Aborting initialization.");
								process.exit(1);
							},
						},
					);

					// Web UI configuration (conditional) - ask immediately after enable question
					if (webUIPrompt.configureWebUI) {
						const webUIPrompts = await prompts(
							[
								{
									type: "number",
									name: "defaultPort",
									message: "Default web UI port:",
									hint: "Port number for the web interface (1-65535)",
									initial: existingConfig?.defaultPort ?? 6420,
									min: 1,
									max: 65535,
								},
								{
									type: "confirm",
									name: "autoOpenBrowser",
									message: "Automatically open browser when starting web UI?",
									hint: "When enabled, 'backlog web' automatically opens your browser",
									initial: existingConfig?.autoOpenBrowser ?? true,
								},
							],
							{
								onCancel: () => {
									console.log("Aborting initialization.");
									process.exit(1);
								},
							},
						);

						if (webUIPrompts !== undefined) {
							webUIConfig = webUIPrompts;
						}
					}
				}

				// 6. Agent instruction files selection
				type AgentSelection = AgentSelectionValue;
				let agentFiles: AgentInstructionFile[] = [];
				let agentInstructionsSkipped = false;

				// Use --agent-instructions if provided, otherwise prompt
				if (options.agentInstructions) {
					// Map friendly names to actual file names
					const nameMap: Record<string, AgentSelection> = {
						cursor: "AGENTS.md",
						claude: "CLAUDE.md",
						agents: "AGENTS.md",
						gemini: "GEMINI.md",
						copilot: ".github/copilot-instructions.md",
						none: "none",
						"CLAUDE.md": "CLAUDE.md",
						"AGENTS.md": "AGENTS.md",
						"GEMINI.md": "GEMINI.md",
						".github/copilot-instructions.md": ".github/copilot-instructions.md",
					};

					const requestedInstructions = options.agentInstructions.split(",").map((f) => f.trim().toLowerCase());
					const mappedFiles: AgentSelection[] = [];

					for (const instruction of requestedInstructions) {
						const mappedFile = nameMap[instruction];
						if (!mappedFile) {
							console.error(`Invalid agent instruction: ${instruction}`);
							console.error("Valid options are: cursor, claude, agents, gemini, copilot, none");
							process.exit(1);
						}
						mappedFiles.push(mappedFile);
					}

					const { files, needsRetry, skipped } = processAgentSelection({ selected: mappedFiles });
					if (needsRetry) {
						agentFiles = [];
						agentInstructionsSkipped = false;
					} else {
						agentFiles = files;
						agentInstructionsSkipped = skipped;
					}
				} else if (isNonInteractive) {
					agentFiles = [];
				} else {
					const defaultHint = "Enter selects highlighted agent (after moving); space toggles selections\n";
					while (true) {
						let highlighted: AgentSelection | undefined;
						let initialCursor: number | undefined;
						let cursorMoved = false;
						const response = await prompts(
							{
								type: "multiselect",
								name: "files",
								message: "Select one or more agent instruction files to update",
								choices: [
									{
										title: "↓ Select an agent instruction from the list below",
										value: PLACEHOLDER_AGENT_VALUE,
										disabled: true,
									},
									{ title: "CLAUDE.md (Claude Code)", value: "CLAUDE.md" },
									{
										title: "AGENTS.md (Codex, Jules, Amp, Cursor, Zed, Warp, Aider, GitHub, RooCode)",
										value: "AGENTS.md",
									},
									{ title: "GEMINI.md (Google CLI)", value: "GEMINI.md" },
									{ title: "Copilot (GitHub Copilot)", value: ".github/copilot-instructions.md" },
									{
										title: "Do not add instructions (danger, this will make backlog not usable with ai agents)",
										value: "none",
									},
								],
								hint: defaultHint,
								instructions: false,
								onRender: function () {
									try {
										const promptInstance = this as unknown as {
											cursor: number;
											value: Array<{ value: AgentSelection }>;
											hint: string;
										};
										if (initialCursor === undefined) {
											initialCursor = promptInstance.cursor;
										}
										if (initialCursor !== undefined && promptInstance.cursor !== initialCursor) {
											cursorMoved = true;
										}
										const focus = promptInstance.value?.[promptInstance.cursor];
										highlighted = focus?.value;
										promptInstance.hint = defaultHint;
									} catch {}
									return undefined;
								},
							},
							{
								onCancel: () => {
									console.log("Aborting initialization.");
									process.exit(1);
								},
							},
						);

						const selected = (response?.files ?? []) as AgentSelection[];
						const { files, needsRetry, skipped } = processAgentSelection({
							selected,
							highlighted,
							useHighlightFallback: cursorMoved,
						});
						if (needsRetry) {
							console.log("Please select at least one agent instruction file before continuing.");
							continue;
						}
						agentFiles = files;
						agentInstructionsSkipped = skipped;
						break;
					}
				}

				// 7. Claude agent installation prompt
				let claudeAgentPrompt: { installClaudeAgent: boolean };
				if (isNonInteractive) {
					// Use flag value or default in non-interactive mode
					claudeAgentPrompt = { installClaudeAgent: parseBoolean(options.installClaudeAgent, false) };
				} else {
					claudeAgentPrompt = await prompts(
						{
							type: "confirm",
							name: "installClaudeAgent",
							message: "Install Claude Code Backlog.md agent? (y/N)",
							hint: "Adds to .claude/agents/ (opt-in)",
							initial: false,
						},
						{
							onCancel: () => {
								console.log("Aborting initialization.");
								process.exit(1);
							},
						},
					);
				}

				// Prepare configuration object preserving existing values
				const config = {
					projectName: name,
					statuses: existingConfig?.statuses || ["To Do", "In Progress", "Done"],
					labels: existingConfig?.labels || [],
					milestones: existingConfig?.milestones || [],
					defaultStatus: existingConfig?.defaultStatus || "To Do",
					dateFormat: existingConfig?.dateFormat || "yyyy-mm-dd",
					maxColumnWidth: existingConfig?.maxColumnWidth || 20,
					autoCommit: existingConfig?.autoCommit ?? false, // Keep autoCommit as hidden/advanced setting
					remoteOperations,
					bypassGitHooks,
					checkActiveBranches: crossBranchPrompt.checkActiveBranches ?? true,
					activeBranchDays,
					...(defaultEditor && { defaultEditor }),
					// Web UI config: use new values, preserve existing, or set defaults
					defaultPort:
						webUIConfig.defaultPort !== undefined
							? webUIConfig.defaultPort
							: existingConfig?.defaultPort !== undefined
								? existingConfig.defaultPort
								: 6420,
					autoOpenBrowser:
						webUIConfig.autoOpenBrowser !== undefined
							? webUIConfig.autoOpenBrowser
							: existingConfig?.autoOpenBrowser !== undefined
								? existingConfig.autoOpenBrowser
								: true,
					// Zero-padding config: only include if enabled (> 0)
					...(zeroPaddedIds && zeroPaddedIds > 0 && { zeroPaddedIds }),
				};

				// Show configuration summary
				console.log("\nConfiguration Summary:");
				console.log(`  Project Name: ${config.projectName}`);
				console.log(`  Auto Commit: ${config.autoCommit}`);
				console.log(`  Remote Operations: ${config.remoteOperations}`);
				if (config.bypassGitHooks) console.log(`  Bypass Git Hooks: ${config.bypassGitHooks}`);
				if (config.defaultEditor) console.log(`  Default Editor: ${config.defaultEditor}`);
				if (config.defaultPort) console.log(`  Web UI Port: ${config.defaultPort}`);
				if (config.autoOpenBrowser !== undefined) console.log(`  Auto Open Browser: ${config.autoOpenBrowser}`);
				if (config.zeroPaddedIds) {
					console.log(`  Zero-Padded IDs: ${config.zeroPaddedIds} digits`);
				} else {
					console.log("  Zero-Padded IDs: disabled");
				}
				console.log(`  Statuses: [${config.statuses.join(", ")}]`);
				console.log("");

				// Initialize or update project
				if (isReInitialization) {
					await core.filesystem.saveConfig(config);
					console.log(`Updated backlog project configuration: ${name}`);
				} else {
					await core.filesystem.ensureBacklogStructure();
					await core.filesystem.saveConfig(config);
					await core.ensureConfigLoaded();
					console.log(`Initialized backlog project: ${name}`);
				}

				// Add agent instruction files if selected
				if (agentFiles.length > 0) {
					await addAgentInstructions(cwd, core.gitOps, agentFiles, config.autoCommit);
					console.log(`✓ Created agent instruction files: ${agentFiles.join(", ")}`);
				} else if (agentInstructionsSkipped) {
					console.log("Skipping agent instruction files per selection.");
				}

				// Install Claude agent if selected
				if (claudeAgentPrompt.installClaudeAgent) {
					await installClaudeAgent(cwd);
					console.log("✓ Claude Code Backlog.md agent installed to .claude/agents/");
				}

				// Final warning if remote operations were enabled but no git remotes are configured
				try {
					if (config.remoteOperations) {
						// Ensure git ops are ready (config not strictly required for this check)
						const hasRemotes = await core.gitOps.hasAnyRemote();
						if (!hasRemotes) {
							console.warn(
								[
									"Warning: remoteOperations is enabled but no git remotes are configured.",
									"Remote features will be skipped until a remote is added (e.g., 'git remote add origin <url>')",
									"or disable remoteOperations via 'backlog config set remoteOperations false'.",
								].join(" "),
							);
						}
					}
				} catch {
					// Ignore failures in final advisory warning
				}
			} catch (err) {
				console.error("Failed to initialize project", err);
				process.exitCode = 1;
			}
		},
	);

export async function generateNextDocId(core: Core): Promise<string> {
	const config = await core.filesystem.loadConfig();
	// Load local documents
	const docs = await core.filesystem.listDocuments();
	const allIds: string[] = [];

	try {
		const backlogDir = DEFAULT_DIRECTORIES.BACKLOG;

		// Skip remote operations if disabled
		if (config?.remoteOperations === false) {
			if (process.env.DEBUG) {
				console.log("Remote operations disabled - generating ID from local documents only");
			}
		} else {
			await core.gitOps.fetch();
		}

		const branches = await core.gitOps.listAllBranches();

		// Load files from all branches in parallel
		const branchFilePromises = branches.map(async (branch) => {
			const files = await core.gitOps.listFilesInTree(branch, `${backlogDir}/docs`);
			return files
				.map((file) => {
					const match = file.match(/doc-(\d+)/);
					return match ? `doc-${match[1]}` : null;
				})
				.filter((id): id is string => id !== null);
		});

		const branchResults = await Promise.all(branchFilePromises);
		for (const branchIds of branchResults) {
			allIds.push(...branchIds);
		}
	} catch (error) {
		// Suppress errors for offline mode or other git issues
		if (process.env.DEBUG) {
			console.error("Could not fetch remote document IDs:", error);
		}
	}

	// Add local document IDs
	for (const doc of docs) {
		allIds.push(doc.id);
	}

	// Find the highest numeric ID
	let max = 0;
	for (const id of allIds) {
		const match = id.match(/^doc-(\d+)$/);
		if (match) {
			const num = Number.parseInt(match[1] || "0", 10);
			if (num > max) max = num;
		}
	}

	const nextIdNumber = max + 1;
	const padding = config?.zeroPaddedIds;

	if (padding && typeof padding === "number" && padding > 0) {
		const paddedId = String(nextIdNumber).padStart(padding, "0");
		return `doc-${paddedId}`;
	}

	return `doc-${nextIdNumber}`;
}

export async function generateNextDecisionId(core: Core): Promise<string> {
	const config = await core.filesystem.loadConfig();
	// Load local decisions
	const decisions = await core.filesystem.listDecisions();
	const allIds: string[] = [];

	try {
		const backlogDir = DEFAULT_DIRECTORIES.BACKLOG;

		// Skip remote operations if disabled
		if (config?.remoteOperations === false) {
			if (process.env.DEBUG) {
				console.log("Remote operations disabled - generating ID from local decisions only");
			}
		} else {
			await core.gitOps.fetch();
		}

		const branches = await core.gitOps.listAllBranches();

		// Load files from all branches in parallel
		const branchFilePromises = branches.map(async (branch) => {
			const files = await core.gitOps.listFilesInTree(branch, `${backlogDir}/decisions`);
			return files
				.map((file) => {
					const match = file.match(/decision-(\d+)/);
					return match ? `decision-${match[1]}` : null;
				})
				.filter((id): id is string => id !== null);
		});

		const branchResults = await Promise.all(branchFilePromises);
		for (const branchIds of branchResults) {
			allIds.push(...branchIds);
		}
	} catch (error) {
		// Suppress errors for offline mode or other git issues
		if (process.env.DEBUG) {
			console.error("Could not fetch remote decision IDs:", error);
		}
	}

	// Add local decision IDs
	for (const decision of decisions) {
		allIds.push(decision.id);
	}

	// Find the highest numeric ID
	let max = 0;
	for (const id of allIds) {
		const match = id.match(/^decision-(\d+)$/);
		if (match) {
			const num = Number.parseInt(match[1] || "0", 10);
			if (num > max) max = num;
		}
	}

	const nextIdNumber = max + 1;
	const padding = config?.zeroPaddedIds;

	if (padding && typeof padding === "number" && padding > 0) {
		const paddedId = String(nextIdNumber).padStart(padding, "0");
		return `decision-${paddedId}`;
	}

	return `decision-${nextIdNumber}`;
}

function normalizeDependencies(dependencies: unknown): string[] {
	if (!dependencies) return [];

	// Handle multiple flags: --dep task-1 --dep task-2
	if (Array.isArray(dependencies)) {
		return dependencies
			.flatMap((dep) =>
				String(dep)
					.split(",")
					.map((d) => d.trim()),
			)
			.filter(Boolean)
			.map((dep) => (dep.startsWith("task-") ? dep : `task-${dep}`));
	}

	// Handle comma-separated: --dep task-1,task-2,task-3
	return String(dependencies)
		.split(",")
		.map((dep) => dep.trim())
		.filter(Boolean)
		.map((dep) => (dep.startsWith("task-") ? dep : `task-${dep}`));
}

async function validateDependencies(
	dependencies: string[],
	core: Core,
): Promise<{ valid: string[]; invalid: string[] }> {
	const valid: string[] = [];
	const invalid: string[] = [];

	if (dependencies.length === 0) {
		return { valid, invalid };
	}

	// Load both tasks and drafts to validate dependencies
	const [tasks, drafts] = await Promise.all([core.filesystem.listTasks(), core.filesystem.listDrafts()]);

	const allTaskIds = new Set([...tasks.map((t) => t.id), ...drafts.map((d) => d.id)]);

	for (const dep of dependencies) {
		if (allTaskIds.has(dep)) {
			valid.push(dep);
		} else {
			invalid.push(dep);
		}
	}

	return { valid, invalid };
}

function buildTaskFromOptions(id: string, title: string, options: Record<string, unknown>): Task {
	const parentInput = options.parent ? String(options.parent) : undefined;
	const normalizedParent = parentInput
		? parentInput.startsWith("task-")
			? parentInput
			: `task-${parentInput}`
		: undefined;

	const createdDate = new Date().toISOString().slice(0, 16).replace("T", " ");

	// Handle dependencies - they will be validated separately
	const dependencies = normalizeDependencies(options.dependsOn || options.dep);

	// Validate priority option
	const priority = options.priority ? String(options.priority).toLowerCase() : undefined;
	const validPriorities = ["high", "medium", "low"];
	const validatedPriority =
		priority && validPriorities.includes(priority) ? (priority as "high" | "medium" | "low") : undefined;

	return {
		id,
		title,
		status: options.status ? String(options.status) : "",
		assignee: options.assignee ? [String(options.assignee)] : [],
		createdDate,
		labels: options.labels
			? String(options.labels)
					.split(",")
					.map((l: string) => l.trim())
					.filter(Boolean)
			: [],
		dependencies,
		rawContent: "",
		...(options.description || options.desc ? { description: String(options.description || options.desc) } : {}),
		...(normalizedParent && { parentTaskId: normalizedParent }),
		...(validatedPriority && { priority: validatedPriority }),
	};
}

const taskCmd = program.command("task").aliases(["tasks"]);

taskCmd
	.command("create <title>")
	.option(
		"-d, --description <text>",
		"task description (multi-line: bash $'Line1\\nLine2', POSIX printf, PowerShell \"Line1`nLine2\")",
	)
	.option("--desc <text>", "alias for --description")
	.option("-a, --assignee <assignee>")
	.option("-s, --status <status>")
	.option("-l, --labels <labels>")
	.option("--priority <priority>", "set task priority (high, medium, low)")
	.option("--plain", "use plain text output after creating")
	.option("--ac <criteria>", "add acceptance criteria (can be used multiple times)", createMultiValueAccumulator())
	.option(
		"--acceptance-criteria <criteria>",
		"add acceptance criteria (can be used multiple times)",
		createMultiValueAccumulator(),
	)
	.option("--plan <text>", "add implementation plan")
	.option("--notes <text>", "add implementation notes")
	.option("--draft")
	.option("-p, --parent <taskId>", "specify parent task ID")
	.option(
		"--depends-on <taskIds>",
		"specify task dependencies (comma-separated or use multiple times)",
		(value, previous) => {
			const soFar = Array.isArray(previous) ? previous : previous ? [previous] : [];
			return [...soFar, value];
		},
	)
	.option("--dep <taskIds>", "specify task dependencies (shortcut for --depends-on)", (value, previous) => {
		const soFar = Array.isArray(previous) ? previous : previous ? [previous] : [];
		return [...soFar, value];
	})
	.action(async (title: string, options) => {
		const cwd = process.cwd();
		const core = new Core(cwd);
		await core.ensureConfigLoaded();
		const id = await core.generateNextId(options.parent);
		const task = buildTaskFromOptions(id, title, options);

		// Normalize and validate status if provided (case-insensitive)
		if (options.status) {
			const canonical = await getCanonicalStatus(String(options.status), core);
			if (!canonical) {
				const configuredStatuses = await getValidStatuses(core);
				console.error(
					`Invalid status: ${options.status}. Valid statuses are: ${formatValidStatuses(configuredStatuses)}`,
				);
				process.exitCode = 1;
				return;
			}
			task.status = canonical;
		}

		// Validate dependencies if provided
		if (task.dependencies.length > 0) {
			const { valid, invalid } = await validateDependencies(task.dependencies, core);
			if (invalid.length > 0) {
				console.error(`Error: The following dependencies do not exist: ${invalid.join(", ")}`);
				console.error("Please create these tasks first or check the task IDs.");
				process.exitCode = 1;
				return;
			}
			task.dependencies = valid;
		}

		// Handle acceptance criteria for create command (structured only)
		const criteria = processAcceptanceCriteriaOptions(options);
		if (criteria.length > 0) {
			let idx = 1;
			task.acceptanceCriteriaItems = criteria.map((text) => ({ index: idx++, text, checked: false }));
		}

		// Handle implementation plan
		if (options.plan) {
			task.implementationPlan = String(options.plan);
		}

		// Handle implementation notes
		if (options.notes) {
			task.implementationNotes = String(options.notes);
		}

		// Workaround for bun compile issue with commander options
		const isPlainFlag = options.plain || process.argv.includes("--plain");

		if (options.draft) {
			const filepath = await core.createDraft(task);
			if (isPlainFlag) {
				const content = await Bun.file(filepath).text();
				console.log(formatTaskPlainText(task, content, filepath));
				return;
			}
			console.log(`Created draft ${id}`);
			console.log(`File: ${filepath}`);
		} else {
			const filepath = await core.createTask(task);
			if (isPlainFlag) {
				const content = await Bun.file(filepath).text();
				console.log(formatTaskPlainText(task, content, filepath));
				return;
			}
			console.log(`Created task ${id}`);
			console.log(`File: ${filepath}`);
		}
	});

program
	.command("search [query]")
	.description("search tasks, documents, and decisions using the shared index")
	.option("--type <type>", "limit results to type (task, document, decision)", createMultiValueAccumulator())
	.option("--status <status>", "filter task results by status")
	.option("--priority <priority>", "filter task results by priority (high, medium, low)")
	.option("--limit <number>", "limit total results returned")
	.option("--plain", "print plain text output instead of interactive UI")
	.action(async (query: string | undefined, options) => {
		const cwd = process.cwd();
		const core = new Core(cwd);
		const searchService = await core.getSearchService();
		const contentStore = await core.getContentStore();
		const cleanup = () => {
			searchService.dispose();
			contentStore.dispose();
		};

		const rawTypes = options.type ? (Array.isArray(options.type) ? options.type : [options.type]) : undefined;
		const allowedTypes: SearchResultType[] = ["task", "document", "decision"];
		const types = rawTypes
			? rawTypes
					.map((value: string) => value.toLowerCase())
					.filter((value: string): value is SearchResultType => {
						if (!allowedTypes.includes(value as SearchResultType)) {
							console.warn(`Ignoring unsupported type '${value}'. Supported: task, document, decision`);
							return false;
						}
						return true;
					})
			: allowedTypes;

		const filters: { status?: string; priority?: SearchPriorityFilter } = {};
		if (options.status) {
			filters.status = options.status;
		}
		if (options.priority) {
			const priorityLower = String(options.priority).toLowerCase();
			const validPriorities: SearchPriorityFilter[] = ["high", "medium", "low"];
			if (!validPriorities.includes(priorityLower as SearchPriorityFilter)) {
				console.error("Invalid priority. Valid values: high, medium, low");
				cleanup();
				process.exitCode = 1;
				return;
			}
			filters.priority = priorityLower as SearchPriorityFilter;
		}

		let limit: number | undefined;
		if (options.limit !== undefined) {
			const parsed = Number.parseInt(String(options.limit), 10);
			if (Number.isNaN(parsed) || parsed <= 0) {
				console.error("--limit must be a positive integer");
				cleanup();
				process.exitCode = 1;
				return;
			}
			limit = parsed;
		}

		const searchResults = searchService.search({
			query: query ?? "",
			limit,
			types,
			filters,
		});

		const isPlainFlag = options.plain || process.argv.includes("--plain") || !process.stdout.isTTY;
		if (isPlainFlag) {
			printSearchResults(searchResults);
			cleanup();
			return;
		}

		const taskResults = searchResults.filter(isTaskSearchResult);
		const searchResultTasks = taskResults.map((result) => result.task);

		// Get ALL tasks for the viewer, not just search results
		// This allows clearing the search to show all tasks
		const allTasksRaw = await core.filesystem.listTasks();
		const allTasks = allTasksRaw.filter((t: Task) => t.id && t.id.trim() !== "" && t.id.startsWith("task-"));

		// If no tasks exist at all, show plain text results
		if (allTasks.length === 0) {
			printSearchResults(searchResults);
			cleanup();
			return;
		}

		// Use the first search result as the selected task, or first available task if no results
		const firstTask = searchResultTasks[0] || allTasks[0];
		const priorityFilter = filters.priority ? filters.priority : undefined;
		const statusFilter = filters.status;
		const { runUnifiedView } = await import("./ui/unified-view.ts");

		await runUnifiedView({
			core,
			initialView: "task-list",
			selectedTask: firstTask,
			tasks: allTasks, // Pass ALL tasks, not just search results
			filter: {
				title: query ? `Search: ${query}` : "Search",
				filterDescription: buildSearchFilterDescription({
					status: statusFilter,
					priority: priorityFilter,
					query: query ?? "",
				}),
				status: statusFilter,
				priority: priorityFilter,
				searchQuery: query ?? "", // Pre-populate search with the query
			},
		});
		cleanup();
	});

function buildSearchFilterDescription(filters: {
	status?: string;
	priority?: SearchPriorityFilter;
	query?: string;
}): string {
	const parts: string[] = [];
	if (filters.query) {
		parts.push(`Query: ${filters.query}`);
	}
	if (filters.status) {
		parts.push(`Status: ${filters.status}`);
	}
	if (filters.priority) {
		parts.push(`Priority: ${filters.priority}`);
	}
	return parts.join(" • ");
}

function printSearchResults(results: SearchResult[]): void {
	if (results.length === 0) {
		console.log("No results found.");
		return;
	}

	const tasks: TaskSearchResult[] = [];
	const documents: DocumentSearchResult[] = [];
	const decisions: DecisionSearchResult[] = [];

	for (const result of results) {
		if (result.type === "task") {
			tasks.push(result);
			continue;
		}
		if (result.type === "document") {
			documents.push(result);
			continue;
		}
		decisions.push(result);
	}

	if (tasks.length > 0) {
		console.log("Tasks:");
		for (const taskResult of tasks) {
			const { task } = taskResult;
			const scoreText = formatScore(taskResult.score);
			const statusText = task.status ? ` (${task.status})` : "";
			const priorityText = task.priority ? ` [${task.priority.toUpperCase()}]` : "";
			console.log(`  ${task.id} - ${task.title}${statusText}${priorityText}${scoreText}`);
		}
	}

	if (documents.length > 0) {
		if (tasks.length > 0) {
			console.log("");
		}
		console.log("Documents:");
		for (const documentResult of documents) {
			const { document } = documentResult;
			const scoreText = formatScore(documentResult.score);
			console.log(`  ${document.id} - ${document.title}${scoreText}`);
		}
	}

	if (decisions.length > 0) {
		if (tasks.length > 0 || documents.length > 0) {
			console.log("");
		}
		console.log("Decisions:");
		for (const decisionResult of decisions) {
			const { decision } = decisionResult;
			const scoreText = formatScore(decisionResult.score);
			console.log(`  ${decision.id} - ${decision.title}${scoreText}`);
		}
	}
}

function formatScore(score: number | null): string {
	if (score === null || score === undefined) {
		return "";
	}
	// Invert score so higher is better (Fuse.js uses 0=perfect match, 1=no match)
	const invertedScore = 1 - score;
	return ` [score ${invertedScore.toFixed(3)}]`;
}

function isTaskSearchResult(result: SearchResult): result is TaskSearchResult {
	return result.type === "task";
}

taskCmd
	.command("list")
	.description("list tasks grouped by status")
	.option("-s, --status <status>", "filter tasks by status (case-insensitive)")
	.option("-a, --assignee <assignee>", "filter tasks by assignee")
	.option("-p, --parent <taskId>", "filter tasks by parent task ID")
	.option("--priority <priority>", "filter tasks by priority (high, medium, low)")
	.option("--sort <field>", "sort tasks by field (priority, id)")
	.option("--plain", "use plain text output instead of interactive UI")
	.action(async (options) => {
		const cwd = process.cwd();
		const core = new Core(cwd);
		const contentStore = await core.getContentStore();
		const baseFilters: TaskListFilter = {};
		if (options.status) {
			baseFilters.status = options.status;
		}
		if (options.assignee) {
			baseFilters.assignee = options.assignee;
		}
		if (options.priority) {
			const priorityLower = options.priority.toLowerCase();
			const validPriorities = ["high", "medium", "low"] as const;
			if (!validPriorities.includes(priorityLower as (typeof validPriorities)[number])) {
				console.error(`Invalid priority: ${options.priority}. Valid values are: high, medium, low`);
				contentStore.dispose();
				process.exitCode = 1;
				return;
			}
			baseFilters.priority = priorityLower as (typeof validPriorities)[number];
		}

		let parentId: string | undefined;
		if (options.parent) {
			parentId = options.parent.startsWith("task-") ? options.parent : `task-${options.parent}`;
			baseFilters.parentTaskId = parentId;
		}

		const tasks = contentStore.getTasks(baseFilters);
		const config = await core.filesystem.loadConfig();

		if (parentId) {
			const parentExists = contentStore.getTasks().some((task) => task.id === parentId);
			if (!parentExists) {
				console.error(`Parent task ${parentId} not found.`);
				contentStore.dispose();
				process.exitCode = 1;
				return;
			}
		}

		// Apply sorting - default to priority sorting
		let sortedTasks = tasks;
		if (options.sort) {
			const validSortFields = ["priority", "id"];
			const sortField = options.sort.toLowerCase();
			if (!validSortFields.includes(sortField)) {
				console.error(`Invalid sort field: ${options.sort}. Valid values are: priority, id`);
				contentStore.dispose();
				process.exitCode = 1;
				return;
			}
			sortedTasks = sortTasks(tasks, sortField);
		} else {
			// Default to priority sorting
			sortedTasks = sortTasks(tasks, "priority");
		}
		let filtered = sortedTasks;
		if (parentId) {
			filtered = filtered.filter((task) => task.parentTaskId === parentId);
		}

		if (filtered.length === 0) {
			if (options.parent) {
				const parentId = options.parent.startsWith("task-") ? options.parent : `task-${options.parent}`;
				console.log(`No child tasks found for parent task ${parentId}.`);
			} else {
				console.log("No tasks found.");
			}
			contentStore.dispose();
			return;
		}

		// Plain text output
		// Workaround for bun compile issue with commander options
		const isPlainFlag = options.plain || process.argv.includes("--plain");
		if (isPlainFlag) {
			// If sorting by priority, do global sorting instead of status-grouped sorting
			if (options.sort && options.sort.toLowerCase() === "priority") {
				const sortedTasks = sortTasks(filtered, "priority");
				console.log("Tasks (sorted by priority):");
				for (const t of sortedTasks) {
					const priorityIndicator = t.priority ? `[${t.priority.toUpperCase()}] ` : "";
					const statusIndicator = t.status ? ` (${t.status})` : "";
					console.log(`  ${priorityIndicator}${t.id} - ${t.title}${statusIndicator}`);
				}
				contentStore.dispose();
				return;
			}

			// Group by status case-insensitively, preserving configured casing
			const canonicalByLower = new Map<string, string>();
			const statuses = config?.statuses || [];
			for (const s of statuses) canonicalByLower.set(s.toLowerCase(), s);

			const groups = new Map<string, Task[]>();
			for (const task of filtered) {
				const raw = (task.status || "").trim();
				const canonical = canonicalByLower.get(raw.toLowerCase()) || raw;
				const list = groups.get(canonical) || [];
				list.push(task);
				groups.set(canonical, list);
			}

			const ordered = [
				...statuses.filter((s) => groups.has(s)),
				...Array.from(groups.keys()).filter((s) => !statuses.includes(s)),
			];

			for (const status of ordered) {
				const list = groups.get(status);
				if (!list) continue;

				// Sort tasks within each status group if a sort field was specified
				let sortedList = list;
				if (options.sort) {
					sortedList = sortTasks(list, options.sort.toLowerCase());
				}

				console.log(`${status || "No Status"}:`);
				for (const t of sortedList) {
					const priorityIndicator = t.priority ? `[${t.priority.toUpperCase()}] ` : "";
					console.log(`  ${priorityIndicator}${t.id} - ${t.title}`);
				}
				console.log();
			}
			contentStore.dispose();
			return;
		}

		// Interactive UI - use unified view for Tab switching support
		if (filtered.length > 0) {
			// Use the first task as the initial selection
			const firstTask = filtered[0];
			if (!firstTask) {
				console.log("No tasks found.");
				contentStore.dispose();
				return;
			}

			// Build filter description for the footer and title
			let filterDescription = "";
			let title = "Tasks";

			const filters = [];
			if (options.status) filters.push(`Status: ${options.status}`);
			if (options.assignee) filters.push(`Assignee: ${options.assignee}`);
			if (options.parent) {
				const parentId = options.parent.startsWith("task-") ? options.parent : `task-${options.parent}`;
				filters.push(`Parent: ${parentId}`);
			}
			if (options.priority) filters.push(`Priority: ${options.priority}`);
			if (options.sort) filters.push(`Sort: ${options.sort}`);

			if (filters.length > 0) {
				filterDescription = filters.join(", ");
				title = `Tasks (${filters.join(" • ")})`;
			}

			// Use unified view with Tab switching support
			const { runUnifiedView } = await import("./ui/unified-view.ts");
			await runUnifiedView({
				core,
				initialView: "task-list",
				selectedTask: firstTask,
				tasks: filtered,
				filter: {
					status: options.status,
					assignee: options.assignee,
					priority: options.priority,
					sort: options.sort,
					title,
					filterDescription,
					parentTaskId: parentId,
				},
			});
		}
	});

taskCmd
	.command("edit <taskId>")
	.description("edit an existing task")
	.option("-t, --title <title>")
	.option(
		"-d, --description <text>",
		"task description (multi-line: bash $'Line1\\nLine2', POSIX printf, PowerShell \"Line1`nLine2\")",
	)
	.option("--desc <text>", "alias for --description")
	.option("-a, --assignee <assignee>")
	.option("-s, --status <status>")
	.option("-l, --label <labels>")
	.option("--priority <priority>", "set task priority (high, medium, low)")
	.option("--ordinal <number>", "set task ordinal for custom ordering")
	.option("--plain", "use plain text output after editing")
	.option("--add-label <label>")
	.option("--remove-label <label>")
	.option("--ac <criteria>", "add acceptance criteria (can be used multiple times)", createMultiValueAccumulator())
	.option(
		"--remove-ac <index>",
		"remove acceptance criterion by index (1-based, can be used multiple times)",
		createMultiValueAccumulator(),
	)
	.option(
		"--check-ac <index>",
		"check acceptance criterion by index (1-based, can be used multiple times)",
		createMultiValueAccumulator(),
	)
	.option(
		"--uncheck-ac <index>",
		"uncheck acceptance criterion by index (1-based, can be used multiple times)",
		createMultiValueAccumulator(),
	)
	.option("--acceptance-criteria <criteria>", "set acceptance criteria (comma-separated or use multiple times)")
	.option("--plan <text>", "set implementation plan")
	.option("--notes <text>", "set implementation notes (replaces existing)")
	.option(
		"--append-notes <text>",
		"append to implementation notes (can be used multiple times)",
		createMultiValueAccumulator(),
	)
	.option(
		"--depends-on <taskIds>",
		"set task dependencies (comma-separated or use multiple times)",
		(value, previous) => {
			const soFar = Array.isArray(previous) ? previous : previous ? [previous] : [];
			return [...soFar, value];
		},
	)
	.option("--dep <taskIds>", "set task dependencies (shortcut for --depends-on)", (value, previous) => {
		const soFar = Array.isArray(previous) ? previous : previous ? [previous] : [];
		return [...soFar, value];
	})
	.action(async (taskId: string, options) => {
		const cwd = process.cwd();
		const core = new Core(cwd);
		const task = await core.filesystem.loadTask(taskId);

		if (!task) {
			console.error(`Task ${taskId} not found.`);
			return;
		}

		if (options.title) {
			task.title = String(options.title);
		}
		if (options.description || options.desc) {
			task.description = String(options.description || options.desc);
		}
		if (typeof options.assignee !== "undefined") {
			task.assignee = [String(options.assignee)];
		}
		if (options.status) {
			const canonical = await getCanonicalStatus(String(options.status), core);
			if (!canonical) {
				const configuredStatuses = await getValidStatuses(core);
				console.error(
					`Invalid status: ${options.status}. Valid statuses are: ${formatValidStatuses(configuredStatuses)}`,
				);
				process.exitCode = 1;
				return;
			}
			task.status = canonical;
		}

		if (options.priority) {
			const priority = String(options.priority).toLowerCase();
			const validPriorities = ["high", "medium", "low"];
			if (validPriorities.includes(priority)) {
				task.priority = priority as "high" | "medium" | "low";
			} else {
				console.error(`Invalid priority: ${priority}. Valid values are: high, medium, low`);
				return;
			}
		}

		if (options.ordinal !== undefined) {
			const ordinal = Number(options.ordinal);
			if (Number.isNaN(ordinal) || ordinal < 0) {
				console.error(`Invalid ordinal: ${options.ordinal}. Must be a non-negative number.`);
				return;
			}
			task.ordinal = ordinal;
		}

		const labels = [...task.labels];
		if (options.label) {
			const newLabels = String(options.label)
				.split(",")
				.map((l: string) => l.trim())
				.filter(Boolean);
			labels.splice(0, labels.length, ...newLabels);
		}
		if (options.addLabel) {
			const adds = Array.isArray(options.addLabel) ? options.addLabel : [options.addLabel];
			for (const l of adds) {
				const trimmed = String(l).trim();
				if (trimmed && !labels.includes(trimmed)) labels.push(trimmed);
			}
		}
		if (options.removeLabel) {
			const removes = Array.isArray(options.removeLabel) ? options.removeLabel : [options.removeLabel];
			for (const l of removes) {
				const trimmed = String(l).trim();
				const idx = labels.indexOf(trimmed);
				if (idx !== -1) labels.splice(idx, 1);
			}
		}
		task.labels = labels;

		// Handle dependencies
		if (options.dependsOn || options.dep) {
			const dependencies = normalizeDependencies(options.dependsOn || options.dep);
			const { valid, invalid } = await validateDependencies(dependencies, core);
			if (invalid.length > 0) {
				console.error(`Error: The following dependencies do not exist: ${invalid.join(", ")}`);
				console.error("Please create these tasks first or check the task IDs.");
				process.exitCode = 1;
				return;
			}
			task.dependencies = valid;
		}

		// Handle adding new acceptance criteria (unified handling for both --ac and --acceptance-criteria)
		const criteria = processAcceptanceCriteriaOptions(options);
		if (criteria.length > 0) {
			const current = Array.isArray(task.acceptanceCriteriaItems) ? [...task.acceptanceCriteriaItems] : [];
			let nextIndex = current.length > 0 ? Math.max(...current.map((c) => c.index)) + 1 : 1;
			const merged = [...current, ...criteria.map((text) => ({ index: nextIndex++, text, checked: false }))];
			task.acceptanceCriteriaItems = merged;
		}

		// Handle AC operations (remove, check, uncheck) with support for multiple values
		if (options.removeAc || options.checkAc || options.uncheckAc) {
			try {
				let list = Array.isArray(task.acceptanceCriteriaItems) ? [...task.acceptanceCriteriaItems] : [];
				const toNums = (v: unknown): number[] => {
					const arr = Array.isArray(v) ? v : v ? [v] : [];
					return arr.map((x) => {
						const n = Number.parseInt(String(x), 10);
						if (!Number.isFinite(n) || Number.isNaN(n) || n < 1) {
							throw new Error(`Invalid index: ${String(x)}. Index must be a positive number (1-based).`);
						}
						return n;
					});
				};
				const removes = toNums(options.removeAc).sort((a: number, b: number) => b - a);
				for (const idx of removes) {
					const before = list.length;
					list = list.filter((c) => c.index !== idx).map((c, i) => ({ ...c, index: i + 1 }));
					if (list.length === before) throw new Error(`Acceptance criterion #${idx} not found`);
				}
				for (const idx of toNums(options.checkAc)) {
					if (!list.some((c) => c.index === idx))
						throw new Error(`Failed to check AC #${idx}: Acceptance criterion #${idx} not found`);
					list = list.map((c) => (c.index === idx ? { ...c, checked: true } : c));
				}
				for (const idx of toNums(options.uncheckAc)) {
					if (!list.some((c) => c.index === idx))
						throw new Error(`Failed to uncheck AC #${idx}: Acceptance criterion #${idx} not found`);
					list = list.map((c) => (c.index === idx ? { ...c, checked: false } : c));
				}
				task.acceptanceCriteriaItems = list;
			} catch (error) {
				console.error(error instanceof Error ? error.message : String(error));
				process.exitCode = 1;
				return;
			}
		}

		// Handle implementation plan
		if (options.plan) {
			task.implementationPlan = String(options.plan);
		}

		// Handle implementation notes - replace or append
		if (options.appendNotes && options.notes) {
			console.error("Cannot use --notes (replace) together with --append-notes (append). Choose one.");
			process.exitCode = 1;
			return;
		}

		if (options.notes) {
			// Replace semantics
			task.implementationNotes = String(options.notes);
		}

		if (options.appendNotes) {
			const appends = Array.isArray(options.appendNotes) ? options.appendNotes : [options.appendNotes];
			const combined = appends
				.map((v: string) => String(v))
				.filter(Boolean)
				.join("\n\n");
			// Merge into existing implementation notes (normalize spacing at the join)
			const existing = (task.implementationNotes || "").replace(/\s+$/, "").trim();
			const addition = String(combined).replace(/^\s+|\s+$/g, "");
			const merged = existing ? `${existing}\n\n${addition}` : addition;
			(task as { implementationNotes?: string }).implementationNotes = merged;
		}

		await core.updateTask(task);

		// Workaround for bun compile issue with commander options
		const isPlainFlag = options.plain || process.argv.includes("--plain");
		if (isPlainFlag) {
			const filePath = await getTaskPath(task.id, core);
			if (filePath) {
				const content = await Bun.file(filePath).text();
				console.log(formatTaskPlainText(task, content, filePath));
				return;
			}
		}

		console.log(`Updated task ${task.id}`);
	});

// Note: Implementation notes appending is handled via `task edit --append-notes` only.

taskCmd
	.command("view <taskId>")
	.description("display task details")
	.option("--plain", "use plain text output instead of interactive UI")
	.action(async (taskId: string, options) => {
		const cwd = process.cwd();
		const core = new Core(cwd);
		const filePath = await getTaskPath(taskId, core);

		if (!filePath) {
			console.error(`Task ${taskId} not found.`);
			return;
		}
		const content = await Bun.file(filePath).text();
		const task = await core.filesystem.loadTask(taskId);

		if (!task) {
			console.error(`Task ${taskId} not found.`);
			return;
		}

		// Plain text output for AI agents
		if (options && (("plain" in options && options.plain) || process.argv.includes("--plain"))) {
			console.log(formatTaskPlainText(task, content, filePath));
			return;
		}

		// Use enhanced task viewer with detail focus
		await viewTaskEnhanced(task, content, { startWithDetailFocus: true });
	});

taskCmd
	.command("archive <taskId>")
	.description("archive a task")
	.action(async (taskId: string) => {
		const cwd = process.cwd();
		const core = new Core(cwd);
		const success = await core.archiveTask(taskId);
		if (success) {
			console.log(`Archived task ${taskId}`);
		} else {
			console.error(`Task ${taskId} not found.`);
		}
	});

taskCmd
	.command("demote <taskId>")
	.description("move task back to drafts")
	.action(async (taskId: string) => {
		const cwd = process.cwd();
		const core = new Core(cwd);
		const success = await core.demoteTask(taskId);
		if (success) {
			console.log(`Demoted task ${taskId}`);
		} else {
			console.error(`Task ${taskId} not found.`);
		}
	});

taskCmd
	.argument("[taskId]")
	.option("--plain", "use plain text output")
	.action(async (taskId: string | undefined, options: { plain?: boolean }) => {
		const cwd = process.cwd();
		const core = new Core(cwd);

		// Don't handle commands that should be handled by specific command handlers
		const reservedCommands = ["create", "list", "edit", "view", "archive", "demote"];
		if (taskId && reservedCommands.includes(taskId)) {
			console.error(`Unknown command: ${taskId}`);
			taskCmd.help();
			return;
		}

		// Handle single task view only
		if (!taskId) {
			taskCmd.help();
			return;
		}

		const filePath = await getTaskPath(taskId, core);
		if (!filePath) {
			console.error(`Task ${taskId} not found.`);
			return;
		}
		const content = await Bun.file(filePath).text();
		const task = await core.filesystem.loadTask(taskId);

		if (!task) {
			console.error(`Task ${taskId} not found.`);
			return;
		}

		// Plain text output for AI agents
		if (options && (options.plain || process.argv.includes("--plain"))) {
			console.log(formatTaskPlainText(task, content, filePath));
			return;
		}

		// Use unified view with detail focus and Tab switching support
		const allTasks = await core.filesystem.listTasks();
		const { runUnifiedView } = await import("./ui/unified-view.ts");
		await runUnifiedView({
			core,
			initialView: "task-detail",
			selectedTask: task,
			tasks: allTasks,
		});
	});

const draftCmd = program.command("draft");

draftCmd
	.command("list")
	.description("list all drafts")
	.option("--sort <field>", "sort drafts by field (priority, id)")
	.option("--plain", "use plain text output")
	.action(async (options: { plain?: boolean; sort?: string }) => {
		const cwd = process.cwd();
		const core = new Core(cwd);
		await core.ensureConfigLoaded();
		const drafts = await core.filesystem.listDrafts();

		if (!drafts || drafts.length === 0) {
			console.log("No drafts found.");
			return;
		}

		// Apply sorting - default to priority sorting like the web UI
		const { sortTasks } = await import("./utils/task-sorting.ts");
		let sortedDrafts = drafts;

		if (options.sort) {
			const validSortFields = ["priority", "id"];
			const sortField = options.sort.toLowerCase();
			if (!validSortFields.includes(sortField)) {
				console.error(`Invalid sort field: ${options.sort}. Valid values are: priority, id`);
				process.exitCode = 1;
				return;
			}
			sortedDrafts = sortTasks(drafts, sortField);
		} else {
			// Default to priority sorting to match web UI behavior
			sortedDrafts = sortTasks(drafts, "priority");
		}

		if (options.plain || process.argv.includes("--plain")) {
			// Plain text output for AI agents
			console.log("Drafts:");
			for (const draft of sortedDrafts) {
				const priorityIndicator = draft.priority ? `[${draft.priority.toUpperCase()}] ` : "";
				console.log(`  ${priorityIndicator}${draft.id} - ${draft.title}`);
			}
		} else {
			// Interactive UI - use unified view with draft support
			const firstDraft = sortedDrafts[0];
			if (!firstDraft) return;

			const { runUnifiedView } = await import("./ui/unified-view.ts");
			await runUnifiedView({
				core,
				initialView: "task-list",
				selectedTask: firstDraft,
				tasks: sortedDrafts,
				filter: {
					filterDescription: "All Drafts",
				},
				title: "Drafts",
			});
		}
	});

draftCmd
	.command("create <title>")
	.option(
		"-d, --description <text>",
		"task description (multi-line: bash $'Line1\\nLine2', POSIX printf, PowerShell \"Line1`nLine2\")",
	)
	.option("--desc <text>", "alias for --description")
	.option("-a, --assignee <assignee>")
	.option("-s, --status <status>")
	.option("-l, --labels <labels>")
	.action(async (title: string, options) => {
		const cwd = process.cwd();
		const core = new Core(cwd);
		await core.ensureConfigLoaded();
		const id = await core.generateNextId();
		const task = buildTaskFromOptions(id, title, options);
		const filepath = await core.createDraft(task);
		console.log(`Created draft ${id}`);
		console.log(`File: ${filepath}`);
	});

draftCmd
	.command("archive <taskId>")
	.description("archive a draft")
	.action(async (taskId: string) => {
		const cwd = process.cwd();
		const core = new Core(cwd);
		const success = await core.archiveDraft(taskId);
		if (success) {
			console.log(`Archived draft ${taskId}`);
		} else {
			console.error(`Draft ${taskId} not found.`);
		}
	});

draftCmd
	.command("promote <taskId>")
	.description("promote draft to task")
	.action(async (taskId: string) => {
		const cwd = process.cwd();
		const core = new Core(cwd);
		const success = await core.promoteDraft(taskId);
		if (success) {
			console.log(`Promoted draft ${taskId}`);
		} else {
			console.error(`Draft ${taskId} not found.`);
		}
	});

draftCmd
	.command("view <taskId>")
	.description("display draft details")
	.option("--plain", "use plain text output instead of interactive UI")
	.action(async (taskId: string, options) => {
		const cwd = process.cwd();
		const core = new Core(cwd);
		const { getDraftPath } = await import("./utils/task-path.ts");
		const filePath = await getDraftPath(taskId, core);

		if (!filePath) {
			console.error(`Draft ${taskId} not found.`);
			return;
		}
		const content = await Bun.file(filePath).text();
		const draft = await core.filesystem.loadDraft(taskId);

		if (!draft) {
			console.error(`Draft ${taskId} not found.`);
			return;
		}

		// Plain text output for AI agents
		if (options && (("plain" in options && options.plain) || process.argv.includes("--plain"))) {
			console.log(formatTaskPlainText(draft, content, filePath));
			return;
		}

		// Use enhanced task viewer with detail focus
		await viewTaskEnhanced(draft, content, { startWithDetailFocus: true });
	});

draftCmd
	.argument("[taskId]")
	.option("--plain", "use plain text output")
	.action(async (taskId: string | undefined, options: { plain?: boolean }) => {
		if (!taskId) {
			draftCmd.help();
			return;
		}

		const cwd = process.cwd();
		const core = new Core(cwd);
		const { getDraftPath } = await import("./utils/task-path.ts");
		const filePath = await getDraftPath(taskId, core);

		if (!filePath) {
			console.error(`Draft ${taskId} not found.`);
			return;
		}
		const content = await Bun.file(filePath).text();
		const draft = await core.filesystem.loadDraft(taskId);

		if (!draft) {
			console.error(`Draft ${taskId} not found.`);
			return;
		}

		// Plain text output for AI agents
		if (options && (options.plain || process.argv.includes("--plain"))) {
			console.log(formatTaskPlainText(draft, content, filePath));
			return;
		}

		// Use enhanced task viewer with detail focus
		await viewTaskEnhanced(draft, content, { startWithDetailFocus: true });
	});

const boardCmd = program.command("board");

function addBoardOptions(cmd: Command) {
	return cmd
		.option("-l, --layout <layout>", "board layout (horizontal|vertical)", "horizontal")
		.option("--vertical", "use vertical layout (shortcut for --layout vertical)");
}

// TaskWithMetadata and resolveTaskConflict are now imported from remote-tasks.ts

async function handleBoardView(options: { layout?: string; vertical?: boolean }) {
	const cwd = process.cwd();
	const core = new Core(cwd);
	const config = await core.filesystem.loadConfig();

	// Load tasks with loading screen for better user experience
	const allTasks = await (async () => {
		const loadingScreen = await createLoadingScreen("Loading board");

		try {
			const tasks = await core.loadBoardTasks((msg) => {
				loadingScreen?.update(msg);
			});

			loadingScreen?.close();
			return tasks;
		} catch (error) {
			loadingScreen?.close();
			throw error;
		}
	})();

	if (allTasks.length === 0) {
		console.log("No tasks found.");
		return;
	}

	const _layout = options.vertical ? "vertical" : (options.layout as "horizontal" | "vertical") || "horizontal";
	const _maxColumnWidth = config?.maxColumnWidth || 20; // Default for terminal display
	const statuses = config?.statuses || [];

	// Use unified view for Tab switching support
	const { runUnifiedView } = await import("./ui/unified-view.ts");
	await runUnifiedView({
		core,
		initialView: "kanban",
		tasks: allTasks.map((t) => ({ ...t, status: t.status || "" })), // Ensure tasks have status
		// Pass the already-loaded kanban data to avoid duplicate loading
		preloadedKanbanData: {
			tasks: allTasks,
			statuses,
		},
	});
}

addBoardOptions(boardCmd).description("display tasks in a Kanban board").action(handleBoardView);

addBoardOptions(boardCmd.command("view").description("display tasks in a Kanban board")).action(handleBoardView);

boardCmd
	.command("export [filename]")
	.description("export kanban board to markdown file")
	.option("--force", "overwrite existing file without confirmation")
	.option("--readme", "export to README.md with markers")
	.option("--export-version <version>", "version to include in the export")
	.action(async (filename, options) => {
		const cwd = process.cwd();
		const core = new Core(cwd);
		const config = await core.filesystem.loadConfig();
		const statuses = config?.statuses || [];

		// Load tasks with progress tracking
		const loadingScreen = await createLoadingScreen("Loading tasks for export");

		let finalTasks: Task[];
		try {
			// Use the shared Core method for loading board tasks
			finalTasks = await core.loadBoardTasks((msg) => {
				loadingScreen?.update(msg);
			});

			loadingScreen?.update(`Total tasks: ${finalTasks.length}`);

			// Close loading screen before export
			loadingScreen?.close();

			// Get project name from config or use directory name
			const { basename } = await import("node:path");
			const projectName = config?.projectName || basename(cwd);

			if (options.readme) {
				// Use version from option if provided, otherwise use the CLI version
				const exportVersion = options.exportVersion || version;
				await updateReadmeWithBoard(finalTasks, statuses, projectName, exportVersion);
				console.log("Updated README.md with Kanban board.");
			} else {
				// Use filename argument or default to Backlog.md
				const outputFile = filename || "Backlog.md";
				const outputPath = join(cwd, outputFile as string);

				// Check if file exists and handle overwrite confirmation
				const fileExists = await Bun.file(outputPath).exists();
				if (fileExists && !options.force) {
					const rl = createInterface({ input });
					try {
						const answer = await rl.question(`File "${outputPath}" already exists. Overwrite? (y/N): `);
						if (!answer.toLowerCase().startsWith("y")) {
							console.log("Export cancelled.");
							return;
						}
					} finally {
						rl.close();
					}
				}

				await exportKanbanBoardToFile(finalTasks, statuses, outputPath, projectName, options.force || !fileExists);
				console.log(`Exported board to ${outputPath}`);
			}
		} catch (error) {
			loadingScreen?.close();
			throw error;
		}
	});

const docCmd = program.command("doc");

docCmd
	.command("create <title>")
	.option("-p, --path <path>")
	.option("-t, --type <type>")
	.action(async (title: string, options) => {
		const cwd = process.cwd();
		const core = new Core(cwd);
		const id = await generateNextDocId(core);
		const document: DocType = {
			id,
			title: title as string,
			type: (options.type || "other") as DocType["type"],
			createdDate: new Date().toISOString().slice(0, 16).replace("T", " "),
			rawContent: "",
		};
		await core.createDocument(document, undefined, options.path || "");
		console.log(`Created document ${id}`);
	});

docCmd
	.command("list")
	.option("--plain", "use plain text output instead of interactive UI")
	.action(async (options) => {
		const cwd = process.cwd();
		const core = new Core(cwd);
		const docs = await core.filesystem.listDocuments();
		if (docs.length === 0) {
			console.log("No docs found.");
			return;
		}

		// Plain text output
		const isPlainFlag = options.plain || process.argv.includes("--plain");
		if (isPlainFlag) {
			for (const d of docs) {
				console.log(`${d.id} - ${d.title}`);
			}
			return;
		}

		// Interactive UI
		const selected = await genericSelectList("Select a document", docs);
		if (selected) {
			// Show document details (recursive search)
			const files = await Array.fromAsync(new Bun.Glob("**/*.md").scan({ cwd: core.filesystem.docsDir }));
			const docFile = files.find(
				(f) => f.startsWith(`${selected.id} -`) || f.endsWith(`/${selected.id}.md`) || f === `${selected.id}.md`,
			);
			if (docFile) {
				const filePath = join(core.filesystem.docsDir, docFile);
				const content = await Bun.file(filePath).text();
				await scrollableViewer(content);
			}
		}
	});

// Document view command
docCmd
	.command("view <docId>")
	.description("view a document")
	.action(async (docId: string) => {
		const cwd = process.cwd();
		const core = new Core(cwd);
		const files = await Array.fromAsync(new Bun.Glob("**/*.md").scan({ cwd: core.filesystem.docsDir }));
		const normalizedId = docId.startsWith("doc-") ? docId : `doc-${docId}`;
		const docFile = files.find(
			(f) => f.startsWith(`${normalizedId} -`) || f.endsWith(`/${normalizedId}.md`) || f === `${normalizedId}.md`,
		);

		if (!docFile) {
			console.error(`Document ${docId} not found.`);
			return;
		}

		const filePath = join(core.filesystem.docsDir, docFile);
		const content = await Bun.file(filePath).text();

		await scrollableViewer(content);
	});

const decisionCmd = program.command("decision");

decisionCmd
	.command("create <title>")
	.option("-s, --status <status>")
	.action(async (title: string, options) => {
		const cwd = process.cwd();
		const core = new Core(cwd);
		const id = await generateNextDecisionId(core);
		const decision: Decision = {
			id,
			title: title as string,
			date: new Date().toISOString().slice(0, 16).replace("T", " "),
			status: (options.status || "proposed") as Decision["status"],
			context: "",
			decision: "",
			consequences: "",
			rawContent: "",
		};
		await core.createDecision(decision);
		console.log(`Created decision ${id}`);
	});

// Agents command group
const agentsCmd = program.command("agents");

agentsCmd
	.description("manage agent instruction files")
	.option(
		"--update-instructions",
		"update agent instruction files (CLAUDE.md, AGENTS.md, GEMINI.md, .github/copilot-instructions.md)",
	)
	.action(async (options) => {
		if (!options.updateInstructions) {
			agentsCmd.help();
			return;
		}
		try {
			const cwd = process.cwd();
			const core = new Core(cwd);

			// Check if backlog project is initialized
			const config = await core.filesystem.loadConfig();
			if (!config) {
				console.error("No backlog project found. Initialize one first with: backlog init");
				process.exit(1);
			}

			const _agentOptions = ["CLAUDE.md", "AGENTS.md", "GEMINI.md", ".github/copilot-instructions.md"] as const;

			const { files: selected } = await prompts({
				type: "multiselect",
				name: "files",
				message: "Select agent instruction files to update",
				choices: [
					{ title: "CLAUDE.md (Claude Code)", value: "CLAUDE.md" },
					{ title: "AGENTS.md (Codex, Jules, Amp, Cursor, Zed, Warp, Aider, GitHub, RooCode)", value: "AGENTS.md" },
					{ title: "GEMINI.md (Google CLI)", value: "GEMINI.md" },
					{ title: "Copilot (GitHub Copilot)", value: ".github/copilot-instructions.md" },
				],
				hint: "Space to select, Enter to confirm\n",
				instructions: false,
			});

			const files: AgentInstructionFile[] = (selected ?? []) as AgentInstructionFile[];

			if (files.length > 0) {
				// Get autoCommit setting from config
				const config = await core.filesystem.loadConfig();
				const shouldAutoCommit = config?.autoCommit ?? false;
				await addAgentInstructions(cwd, core.gitOps, files, shouldAutoCommit);
				console.log(`Updated ${files.length} agent instruction file(s): ${files.join(", ")}`);
			} else {
				console.log("No files selected for update.");
			}
		} catch (err) {
			console.error("Failed to update agent instructions", err);
			process.exitCode = 1;
		}
	});

// Config command group
const configCmd = program.command("config");

// Sequences command group
const sequenceCmd = program.command("sequence");

sequenceCmd
	.description("list and inspect execution sequences computed from task dependencies")
	.command("list")
	.description("list sequences (interactive by default; use --plain for text output)")
	.option("--plain", "use plain text output instead of interactive UI")
	.action(async (options) => {
		const cwd = process.cwd();
		const core = new Core(cwd);
		const tasks = await core.filesystem.listTasks();
		// Exclude tasks marked as Done from sequences (case-insensitive)
		const activeTasks = tasks.filter((t) => (t.status || "").toLowerCase() !== "done");
		const { unsequenced, sequences } = computeSequences(activeTasks);

		// Workaround for bun compile issue with commander options
		const isPlainFlag = options.plain || process.argv.includes("--plain");
		if (isPlainFlag) {
			if (unsequenced.length > 0) {
				console.log("Unsequenced:");
				for (const t of unsequenced) {
					console.log(`  ${t.id} - ${t.title}`);
				}
				console.log("");
			}
			for (const seq of sequences) {
				console.log(`Sequence ${seq.index}:`);
				for (const t of seq.tasks) {
					console.log(`  ${t.id} - ${t.title}`);
				}
				console.log("");
			}
			return;
		}

		// Interactive default: TUI view (215.01 + 215.02 navigation/detail)
		const { runSequencesView } = await import("./ui/sequences.ts");
		await runSequencesView({ unsequenced, sequences }, core);
	});

configCmd
	.command("get <key>")
	.description("get a configuration value")
	.action(async (key: string) => {
		try {
			const cwd = process.cwd();
			const core = new Core(cwd);
			const config = await core.filesystem.loadConfig();

			if (!config) {
				console.error("No backlog project found. Initialize one first with: backlog init");
				process.exit(1);
			}

			// Handle specific config keys
			switch (key) {
				case "defaultEditor":
					if (config.defaultEditor) {
						console.log(config.defaultEditor);
					} else {
						console.log("defaultEditor is not set");
						process.exit(1);
					}
					break;
				case "projectName":
					console.log(config.projectName);
					break;
				case "defaultStatus":
					console.log(config.defaultStatus || "");
					break;
				case "statuses":
					console.log(config.statuses.join(", "));
					break;
				case "labels":
					console.log(config.labels.join(", "));
					break;
				case "milestones":
					console.log(config.milestones.join(", "));
					break;
				case "dateFormat":
					console.log(config.dateFormat);
					break;
				case "maxColumnWidth":
					console.log(config.maxColumnWidth?.toString() || "");
					break;
				case "defaultPort":
					console.log(config.defaultPort?.toString() || "");
					break;
				case "autoOpenBrowser":
					console.log(config.autoOpenBrowser?.toString() || "");
					break;
				case "remoteOperations":
					console.log(config.remoteOperations?.toString() || "");
					break;
				case "autoCommit":
					console.log(config.autoCommit?.toString() || "");
					break;
				case "bypassGitHooks":
					console.log(config.bypassGitHooks?.toString() || "");
					break;
				case "zeroPaddedIds":
					console.log(config.zeroPaddedIds?.toString() || "(disabled)");
					break;
				case "checkActiveBranches":
					console.log(config.checkActiveBranches?.toString() || "true");
					break;
				case "activeBranchDays":
					console.log(config.activeBranchDays?.toString() || "30");
					break;
				default:
					console.error(`Unknown config key: ${key}`);
					console.error(
						"Available keys: defaultEditor, projectName, defaultStatus, statuses, labels, milestones, dateFormat, maxColumnWidth, defaultPort, autoOpenBrowser, remoteOperations, autoCommit, bypassGitHooks, zeroPaddedIds, checkActiveBranches, activeBranchDays",
					);
					process.exit(1);
			}
		} catch (err) {
			console.error("Failed to get config value", err);
			process.exitCode = 1;
		}
	});

configCmd
	.command("set <key> <value>")
	.description("set a configuration value")
	.action(async (key: string, value: string) => {
		try {
			const cwd = process.cwd();
			const core = new Core(cwd);
			const config = await core.filesystem.loadConfig();

			if (!config) {
				console.error("No backlog project found. Initialize one first with: backlog init");
				process.exit(1);
			}

			// Handle specific config keys
			switch (key) {
				case "defaultEditor": {
					// Validate that the editor command exists
					const { isEditorAvailable } = await import("./utils/editor.ts");
					const isAvailable = await isEditorAvailable(value);
					if (!isAvailable) {
						console.error(`Editor command not found: ${value}`);
						console.error("Please ensure the editor is installed and available in your PATH");
						process.exit(1);
					}
					config.defaultEditor = value;
					break;
				}
				case "projectName":
					config.projectName = value;
					break;
				case "defaultStatus":
					config.defaultStatus = value;
					break;
				case "dateFormat":
					config.dateFormat = value;
					break;
				case "maxColumnWidth": {
					const width = Number.parseInt(value, 10);
					if (Number.isNaN(width) || width <= 0) {
						console.error("maxColumnWidth must be a positive number");
						process.exit(1);
					}
					config.maxColumnWidth = width;
					break;
				}
				case "autoOpenBrowser": {
					const boolValue = value.toLowerCase();
					if (boolValue === "true" || boolValue === "1" || boolValue === "yes") {
						config.autoOpenBrowser = true;
					} else if (boolValue === "false" || boolValue === "0" || boolValue === "no") {
						config.autoOpenBrowser = false;
					} else {
						console.error("autoOpenBrowser must be true or false");
						process.exit(1);
					}
					break;
				}
				case "defaultPort": {
					const port = Number.parseInt(value, 10);
					if (Number.isNaN(port) || port < 1 || port > 65535) {
						console.error("defaultPort must be a valid port number (1-65535)");
						process.exit(1);
					}
					config.defaultPort = port;
					break;
				}
				case "remoteOperations": {
					const boolValue = value.toLowerCase();
					if (boolValue === "true" || boolValue === "1" || boolValue === "yes") {
						config.remoteOperations = true;
					} else if (boolValue === "false" || boolValue === "0" || boolValue === "no") {
						config.remoteOperations = false;
					} else {
						console.error("remoteOperations must be true or false");
						process.exit(1);
					}
					break;
				}
				case "autoCommit": {
					const boolValue = value.toLowerCase();
					if (boolValue === "true" || boolValue === "1" || boolValue === "yes") {
						config.autoCommit = true;
					} else if (boolValue === "false" || boolValue === "0" || boolValue === "no") {
						config.autoCommit = false;
					} else {
						console.error("autoCommit must be true or false");
						process.exit(1);
					}
					break;
				}
				case "bypassGitHooks": {
					const boolValue = value.toLowerCase();
					if (boolValue === "true" || boolValue === "1" || boolValue === "yes") {
						config.bypassGitHooks = true;
					} else if (boolValue === "false" || boolValue === "0" || boolValue === "no") {
						config.bypassGitHooks = false;
					} else {
						console.error("bypassGitHooks must be true or false");
						process.exit(1);
					}
					break;
				}
				case "zeroPaddedIds": {
					const padding = Number.parseInt(value, 10);
					if (Number.isNaN(padding) || padding < 0) {
						console.error("zeroPaddedIds must be a non-negative number.");
						process.exit(1);
					}
					// Set to undefined if 0 to remove it from config
					config.zeroPaddedIds = padding > 0 ? padding : undefined;
					break;
				}
				case "checkActiveBranches": {
					const boolValue = value.toLowerCase();
					if (boolValue === "true" || boolValue === "1" || boolValue === "yes") {
						config.checkActiveBranches = true;
					} else if (boolValue === "false" || boolValue === "0" || boolValue === "no") {
						config.checkActiveBranches = false;
					} else {
						console.error("checkActiveBranches must be true or false");
						process.exit(1);
					}
					break;
				}
				case "activeBranchDays": {
					const days = Number.parseInt(value, 10);
					if (Number.isNaN(days) || days < 0) {
						console.error("activeBranchDays must be a non-negative number.");
						process.exit(1);
					}
					config.activeBranchDays = days;
					break;
				}
				case "statuses":
				case "labels":
				case "milestones":
					console.error(`${key} cannot be set directly. Use 'backlog config list-${key}' to view current values.`);
					console.error("Array values should be edited in the config file directly.");
					process.exit(1);
					break;
				default:
					console.error(`Unknown config key: ${key}`);
					console.error(
						"Available keys: defaultEditor, projectName, defaultStatus, dateFormat, maxColumnWidth, autoOpenBrowser, defaultPort, remoteOperations, autoCommit, bypassGitHooks, zeroPaddedIds, checkActiveBranches, activeBranchDays",
					);
					process.exit(1);
			}

			await core.filesystem.saveConfig(config);
			console.log(`Set ${key} = ${value}`);
		} catch (err) {
			console.error("Failed to set config value", err);
			process.exitCode = 1;
		}
	});

configCmd
	.command("list")
	.description("list all configuration values")
	.action(async () => {
		try {
			const cwd = process.cwd();
			const core = new Core(cwd);
			const config = await core.filesystem.loadConfig();

			if (!config) {
				console.error("No backlog project found. Initialize one first with: backlog init");
				process.exit(1);
			}

			console.log("Configuration:");
			console.log(`  projectName: ${config.projectName}`);
			console.log(`  defaultEditor: ${config.defaultEditor || "(not set)"}`);
			console.log(`  defaultStatus: ${config.defaultStatus || "(not set)"}`);
			console.log(`  statuses: [${config.statuses.join(", ")}]`);
			console.log(`  labels: [${config.labels.join(", ")}]`);
			console.log(`  milestones: [${config.milestones.join(", ")}]`);
			console.log(`  dateFormat: ${config.dateFormat}`);
			console.log(`  maxColumnWidth: ${config.maxColumnWidth || "(not set)"}`);
			console.log(`  autoOpenBrowser: ${config.autoOpenBrowser ?? "(not set)"}`);
			console.log(`  defaultPort: ${config.defaultPort ?? "(not set)"}`);
			console.log(`  remoteOperations: ${config.remoteOperations ?? "(not set)"}`);
			console.log(`  autoCommit: ${config.autoCommit ?? "(not set)"}`);
			console.log(`  bypassGitHooks: ${config.bypassGitHooks ?? "(not set)"}`);
			console.log(`  zeroPaddedIds: ${config.zeroPaddedIds ?? "(disabled)"}`);
			console.log(`  checkActiveBranches: ${config.checkActiveBranches ?? "true"}`);
			console.log(`  activeBranchDays: ${config.activeBranchDays ?? "30"}`);
		} catch (err) {
			console.error("Failed to list config values", err);
			process.exitCode = 1;
		}
	});

// Cleanup command for managing completed tasks
program
	.command("cleanup")
	.description("move completed tasks to completed folder based on age")
	.action(async () => {
		try {
			const cwd = process.cwd();
			const core = new Core(cwd);

			// Check if backlog project is initialized
			const config = await core.filesystem.loadConfig();
			if (!config) {
				console.error("No backlog project found. Initialize one first with: backlog init");
				process.exit(1);
			}

			// Get all Done tasks
			const tasks = await core.filesystem.listTasks();
			const doneTasks = tasks.filter((task) => task.status === "Done");

			if (doneTasks.length === 0) {
				console.log("No completed tasks found to clean up.");
				return;
			}

			console.log(`Found ${doneTasks.length} tasks marked as Done.`);

			const ageOptions = [
				{ title: "1 day", value: 1 },
				{ title: "1 week", value: 7 },
				{ title: "2 weeks", value: 14 },
				{ title: "3 weeks", value: 21 },
				{ title: "1 month", value: 30 },
				{ title: "3 months", value: 90 },
				{ title: "1 year", value: 365 },
			];

			const { selectedAge } = await prompts({
				type: "select",
				name: "selectedAge",
				message: "Move tasks to completed folder if they are older than:",
				choices: ageOptions,
				hint: "Tasks in completed folder are still accessible but won't clutter the main board",
			});

			if (selectedAge === undefined) {
				console.log("Cleanup cancelled.");
				return;
			}

			// Get tasks older than selected period
			const tasksToMove = await core.getDoneTasksByAge(selectedAge);

			if (tasksToMove.length === 0) {
				console.log(`No tasks found that are older than ${ageOptions.find((o) => o.value === selectedAge)?.title}.`);
				return;
			}

			console.log(
				`\nFound ${tasksToMove.length} tasks older than ${ageOptions.find((o) => o.value === selectedAge)?.title}:`,
			);
			for (const task of tasksToMove.slice(0, 5)) {
				const date = task.updatedDate || task.createdDate;
				console.log(`  - ${task.id}: ${task.title} (${date})`);
			}
			if (tasksToMove.length > 5) {
				console.log(`  ... and ${tasksToMove.length - 5} more`);
			}

			const { confirmed } = await prompts({
				type: "confirm",
				name: "confirmed",
				message: `Move ${tasksToMove.length} tasks to completed folder?`,
				initial: false,
			});

			if (!confirmed) {
				console.log("Cleanup cancelled.");
				return;
			}

			// Move tasks to completed folder
			let successCount = 0;
			const shouldAutoCommit = config.autoCommit ?? false;

			console.log("Moving tasks...");
			const movedTasks: Array<{ fromPath: string; toPath: string; taskId: string }> = [];

			for (const task of tasksToMove) {
				// Get paths before moving
				const taskPath = await getTaskPath(task.id, core);
				const taskFilename = await getTaskFilename(task.id, core);

				if (taskPath && taskFilename) {
					const fromPath = taskPath;
					const toPath = join(core.filesystem.completedDir, taskFilename);

					const success = await core.completeTask(task.id);
					if (success) {
						successCount++;
						movedTasks.push({ fromPath, toPath, taskId: task.id });
					} else {
						console.error(`Failed to move task ${task.id}`);
					}
				} else {
					console.error(`Failed to get paths for task ${task.id}`);
				}
			}

			// If autoCommit is disabled, stage the moves so Git recognizes them
			if (successCount > 0 && !shouldAutoCommit) {
				console.log("Staging file moves for Git...");
				for (const { fromPath, toPath } of movedTasks) {
					try {
						await core.gitOps.stageFileMove(fromPath, toPath);
					} catch (error) {
						console.warn(`Warning: Could not stage move for Git: ${error}`);
					}
				}
			}

			console.log(`Successfully moved ${successCount} of ${tasksToMove.length} tasks to completed folder.`);
			if (successCount > 0 && !shouldAutoCommit) {
				console.log("Files have been staged. To commit: git commit -m 'cleanup: Move completed tasks'");
			}
		} catch (err) {
			console.error("Failed to run cleanup", err);
			process.exitCode = 1;
		}
	});

// Browser command for web UI
program
	.command("browser")
	.description("open browser interface for task management (press Ctrl+C or Cmd+C to stop)")
	.option("-p, --port <port>", "port to run server on")
	.option("--no-open", "don't automatically open browser")
	.action(async (options) => {
		try {
			const cwd = process.cwd();
			const { BacklogServer } = await import("./server/index.ts");
			const server = new BacklogServer(cwd);

			// Load config to get default port
			const core = new Core(cwd);
			const config = await core.filesystem.loadConfig();
			const defaultPort = config?.defaultPort ?? 6420;

			const port = Number.parseInt(options.port || defaultPort.toString(), 10);
			if (Number.isNaN(port) || port < 1 || port > 65535) {
				console.error("Invalid port number. Must be between 1 and 65535.");
				process.exit(1);
			}

			await server.start(port, options.open !== false);

			// Graceful shutdown on common termination signals (register once)
			let shuttingDown = false;
			const shutdown = async (signal: string) => {
				if (shuttingDown) return;
				shuttingDown = true;
				console.log(`\nReceived ${signal}. Shutting down server...`);
				try {
					const stopPromise = server.stop();
					const timeout = new Promise<void>((resolve) => setTimeout(resolve, 1500));
					await Promise.race([stopPromise, timeout]);
				} finally {
					process.exit(0);
				}
			};

			process.once("SIGINT", () => void shutdown("SIGINT"));
			process.once("SIGTERM", () => void shutdown("SIGTERM"));
			process.once("SIGQUIT", () => void shutdown("SIGQUIT"));
		} catch (err) {
			console.error("Failed to start browser interface", err);
			process.exitCode = 1;
		}
	});

// Overview command for statistics
program
	.command("overview")
	.description("display project statistics and metrics")
	.action(async () => {
		try {
			const cwd = process.cwd();
			const core = new Core(cwd);
			const config = await core.filesystem.loadConfig();

			if (!config) {
				console.error("No backlog project found. Initialize one first with: backlog init");
				process.exit(1);
			}

			// Import and run the overview command
			const { runOverviewCommand } = await import("./commands/overview.ts");
			await runOverviewCommand(core);
		} catch (err) {
			console.error("Failed to display project overview", err);
			process.exitCode = 1;
		}
	});

// MCP command group
registerMcpCommand(program);

program.parseAsync(process.argv).finally(() => {
	// Restore BUN_OPTIONS after CLI parsing completes so it's available for subsequent commands
	if (originalBunOptions) {
		process.env.BUN_OPTIONS = originalBunOptions;
	}
});
