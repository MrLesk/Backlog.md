#!/usr/bin/env node

import { basename, join } from "node:path";
import { stdin as input, stdout as output } from "node:process";
import { createInterface } from "node:readline/promises";
import { $, spawn } from "bun";
import { Command } from "commander";
import prompts from "prompts";
import { runAdvancedConfigWizard } from "./commands/advanced-config-wizard.ts";
import { type CompletionInstallResult, installCompletion, registerCompletionCommand } from "./commands/completion.ts";
import { configureAdvancedSettings } from "./commands/configure-advanced-settings.ts";
import { registerMcpCommand } from "./commands/mcp.ts";
import { DEFAULT_DIRECTORIES } from "./constants/index.ts";
import { initializeProject } from "./core/init.ts";
import { computeSequences } from "./core/sequences.ts";
import { formatTaskPlainText } from "./formatters/task-plain-text.ts";
import {
	type AgentInstructionFile,
	addAgentInstructions,
	Core,
	type EnsureMcpGuidelinesResult,
	ensureMcpGuidelines,
	exportKanbanBoardToFile,
	initializeGitRepository,
	installClaudeAgent,
	isGitRepository,
	updateReadmeWithBoard,
} from "./index.ts";
import {
	type BacklogConfig,
	type Decision,
	type DecisionSearchResult,
	type Document as DocType,
	type DocumentSearchResult,
	isLocalEditableTask,
	type SearchPriorityFilter,
	type SearchResult,
	type SearchResultType,
	type Task,
	type TaskListFilter,
	type TaskSearchResult,
} from "./types/index.ts";
import type { TaskEditArgs } from "./types/task-edit-args.ts";
import { genericSelectList } from "./ui/components/generic-list.ts";
import { createLoadingScreen } from "./ui/loading.ts";
import { viewTaskEnhanced } from "./ui/task-viewer-with-search.ts";
import { promptText, scrollableViewer } from "./ui/tui.ts";
import { type AgentSelectionValue, PLACEHOLDER_AGENT_VALUE, processAgentSelection } from "./utils/agent-selection.ts";
import { findBacklogRoot } from "./utils/find-backlog-root.ts";
import { formatValidStatuses, getCanonicalStatus, getValidStatuses } from "./utils/status.ts";
import { parsePositiveIndexList, processAcceptanceCriteriaOptions, toStringArray } from "./utils/task-builders.ts";
import { buildTaskUpdateInput } from "./utils/task-edit-builder.ts";
import { normalizeTaskId, taskIdsEqual } from "./utils/task-path.ts";
import { sortTasks } from "./utils/task-sorting.ts";
import { getVersion } from "./utils/version.ts";

type IntegrationMode = "mcp" | "cli" | "none";

function normalizeIntegrationOption(value: string): IntegrationMode | null {
	const normalized = value.trim().toLowerCase();
	if (
		normalized === "mcp" ||
		normalized === "connector" ||
		normalized === "model-context-protocol" ||
		normalized === "model_context_protocol"
	) {
		return "mcp";
	}
	if (
		normalized === "cli" ||
		normalized === "legacy" ||
		normalized === "commands" ||
		normalized === "command" ||
		normalized === "instructions" ||
		normalized === "instruction" ||
		normalized === "agent" ||
		normalized === "agents"
	) {
		return "cli";
	}
	if (
		normalized === "none" ||
		normalized === "skip" ||
		normalized === "manual" ||
		normalized === "later" ||
		normalized === "no" ||
		normalized === "off"
	) {
		return "none";
	}
	return null;
}

// Always use "backlog" as the global MCP server name so fallback mode works when the project isn't initialized.
const MCP_SERVER_NAME = "backlog";

const MCP_CLIENT_INSTRUCTION_MAP: Record<string, AgentInstructionFile> = {
	claude: "CLAUDE.md",
	codex: "AGENTS.md",
	gemini: "GEMINI.md",
	guide: "AGENTS.md",
};

async function openUrlInBrowser(url: string): Promise<void> {
	let cmd: string[];
	if (process.platform === "darwin") {
		cmd = ["open", url];
	} else if (process.platform === "win32") {
		cmd = ["cmd", "/c", "start", "", url];
	} else {
		cmd = ["xdg-open", url];
	}
	try {
		await $`${cmd}`.quiet();
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		console.warn(`  ⚠️  Unable to open browser automatically (${message}). Please visit ${url}`);
	}
}

async function runMcpClientCommand(label: string, command: string, args: string[]): Promise<string> {
	console.log(`    Configuring ${label}...`);
	try {
		const child = spawn({
			cmd: [command, ...args],
			stdout: "inherit",
			stderr: "inherit",
		});
		await child.exited;
		console.log(`    ✓ Added Backlog MCP server to ${label}`);
		return label;
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		console.warn(`    ⚠️ Unable to configure ${label} automatically (${message}).`);
		console.warn(`       Run manually: ${command} ${args.join(" ")}`);
		return `${label} (manual setup required)`;
	}
}

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
function getDefaultAdvancedConfig(existingConfig?: BacklogConfig | null): Partial<BacklogConfig> {
	return {
		checkActiveBranches: existingConfig?.checkActiveBranches ?? true,
		remoteOperations: existingConfig?.remoteOperations ?? true,
		activeBranchDays: existingConfig?.activeBranchDays ?? 30,
		bypassGitHooks: existingConfig?.bypassGitHooks ?? false,
		autoCommit: existingConfig?.autoCommit ?? false,
		zeroPaddedIds: existingConfig?.zeroPaddedIds,
		defaultEditor: existingConfig?.defaultEditor,
		defaultPort: existingConfig?.defaultPort ?? 6420,
		autoOpenBrowser: existingConfig?.autoOpenBrowser ?? true,
	};
}

/**
 * Resolves the Backlog.md project root from the current working directory.
 * Walks up the directory tree to find backlog/ or backlog.json, with git root fallback.
 * Exits with error message if no Backlog.md project is found.
 */
async function requireProjectRoot(): Promise<string> {
	const root = await findBacklogRoot(process.cwd());
	if (!root) {
		console.error("No Backlog.md project found. Run `backlog init` to initialize.");
		process.exit(1);
	}
	return root;
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
			const projectRoot = await findBacklogRoot(process.cwd());
			if (projectRoot) {
				const core = new Core(projectRoot);
				const cfg = await core.filesystem.loadConfig();
				initialized = !!cfg;
			}
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
		const projectRoot = await findBacklogRoot(process.cwd());
		if (projectRoot) {
			const core = new Core(projectRoot);

			// Only migrate if config already exists (project is already initialized)
			const config = await core.filesystem.loadConfig();
			if (config) {
				await core.ensureConfigMigrated();
			}
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
	.option("--integration-mode <mode>", "choose how AI tools connect to Backlog.md (mcp, cli, or none)")
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
				integrationMode?: string;
				defaults?: boolean;
			},
		) => {
			try {
				// init command uses process.cwd() directly - it initializes in the current directory
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
					options.installClaudeAgent ||
					options.integrationMode
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

				const defaultAdvancedConfig = getDefaultAdvancedConfig(existingConfig);
				const applyAdvancedOptionOverrides = () => {
					const result: Partial<BacklogConfig> = { ...defaultAdvancedConfig };
					result.checkActiveBranches = parseBoolean(options.checkBranches, result.checkActiveBranches ?? true);
					if (result.checkActiveBranches) {
						result.remoteOperations = parseBoolean(options.includeRemote, result.remoteOperations ?? true);
						result.activeBranchDays = parseNumber(options.branchDays, result.activeBranchDays ?? 30);
					} else {
						result.remoteOperations = false;
					}
					result.bypassGitHooks = parseBoolean(options.bypassGitHooks, result.bypassGitHooks ?? false);
					const paddingValue = parseNumber(options.zeroPaddedIds, result.zeroPaddedIds ?? 0);
					result.zeroPaddedIds = paddingValue > 0 ? paddingValue : undefined;
					result.defaultEditor =
						options.defaultEditor ||
						existingConfig?.defaultEditor ||
						process.env.EDITOR ||
						process.env.VISUAL ||
						undefined;
					result.defaultPort = parseNumber(options.webPort, result.defaultPort ?? 6420);
					result.autoOpenBrowser = parseBoolean(options.autoOpenBrowser, result.autoOpenBrowser ?? true);
					return result;
				};

				const integrationOption = options.integrationMode
					? normalizeIntegrationOption(options.integrationMode)
					: undefined;
				if (options.integrationMode && !integrationOption) {
					console.error(`Invalid integration mode: ${options.integrationMode}. Valid options are: mcp, cli, none`);
					process.exit(1);
				}

				let integrationMode: IntegrationMode | null = integrationOption ?? (isNonInteractive ? "mcp" : null);
				const mcpServerName = MCP_SERVER_NAME;
				type AgentSelection = AgentSelectionValue;
				let agentFiles: AgentInstructionFile[] = [];
				let agentInstructionsSkipped = false;
				let mcpClientSetupSummary: string | undefined;
				const mcpGuideUrl = "https://github.com/MrLesk/Backlog.md#-mcp-integration-model-context-protocol";

				if (
					!integrationOption &&
					integrationMode === "mcp" &&
					(options.agentInstructions || options.installClaudeAgent)
				) {
					integrationMode = "cli";
				}

				if (integrationMode === "mcp" && (options.agentInstructions || options.installClaudeAgent)) {
					console.error(
						"The MCP connector option cannot be combined with --agent-instructions or --install-claude-agent.",
					);
					process.exit(1);
				}

				if (integrationMode === "none" && (options.agentInstructions || options.installClaudeAgent)) {
					console.error(
						"Skipping AI integration cannot be combined with --agent-instructions or --install-claude-agent.",
					);
					process.exit(1);
				}

				mainSelection: while (true) {
					if (integrationMode === null) {
						let cancelled = false;
						const integrationPrompt = await prompts(
							{
								type: "select",
								name: "mode",
								message: "How would you like your AI tools to connect to Backlog.md?",
								hint: "Pick MCP when your editor supports the Model Context Protocol.",
								initial: 0,
								choices: [
									{
										title: "via MCP connector (recommended for Claude Code, Codex, Gemini, Cursor, etc.)",
										description: "Agents learn the Backlog.md workflow through MCP tools, resources, and prompts.",
										value: "mcp",
									},
									{
										title: "via CLI commands (broader compatibility)",
										description: "Agents will use Backlog.md by invoking CLI commands directly",
										value: "cli",
									},
									{
										title: "Skip for now (I am not using Backlog.md with AI tools)",
										description: "Continue without setting up MCP or instruction files.",
										value: "none",
									},
								],
							},
							{
								onCancel: () => {
									cancelled = true;
								},
							},
						);

						if (cancelled) {
							console.log("Initialization cancelled.");
							return;
						}

						const selectedMode = integrationPrompt?.mode
							? normalizeIntegrationOption(String(integrationPrompt.mode))
							: null;
						integrationMode = selectedMode ?? "mcp";
						console.log("");
					}

					if (integrationMode === "cli") {
						if (options.agentInstructions) {
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
								console.error("Please select at least one agent instruction file before continuing.");
								process.exit(1);
							}
							agentFiles = files;
							agentInstructionsSkipped = skipped;
						} else if (isNonInteractive) {
							agentFiles = [];
						} else {
							const defaultHint = "Enter selects highlighted agent (after moving); space toggles selections\n";
							while (true) {
								let highlighted: AgentSelection | undefined;
								let initialCursor: number | undefined;
								let cursorMoved = false;
								let selectionCancelled = false;
								const response = await prompts(
									{
										type: "multiselect",
										name: "files",
										message: "Select instruction files for CLI-based AI tools",
										choices: [
											{
												title: "↓ Use space to toggle instruction files (enter accepts)",
												value: PLACEHOLDER_AGENT_VALUE,
												disabled: true,
											},
											{ title: "CLAUDE.md — Claude Code", value: "CLAUDE.md" },
											{
												title: "AGENTS.md — Codex, Cursor, Zed, Warp, Aider, RooCode, etc.",
												value: "AGENTS.md",
											},
											{ title: "GEMINI.md — Google Gemini Code Assist CLI", value: "GEMINI.md" },
											{ title: "Copilot instructions — GitHub Copilot", value: ".github/copilot-instructions.md" },
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
											selectionCancelled = true;
										},
									},
								);

								if (selectionCancelled) {
									integrationMode = null;
									console.log("");
									continue mainSelection;
								}

								const rawSelection = (response?.files ?? []) as AgentSelection[];
								const selected =
									rawSelection.length === 0 &&
									highlighted &&
									highlighted !== PLACEHOLDER_AGENT_VALUE &&
									highlighted !== "none"
										? [highlighted]
										: rawSelection;
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

						break;
					}

					if (integrationMode === "mcp") {
						if (isNonInteractive) {
							mcpClientSetupSummary = "skipped (non-interactive)";
							break;
						}

						console.log(`  MCP server name: ${mcpServerName}`);
						while (true) {
							let clientSelectionCancelled = false;
							let highlightedClient: string | undefined;
							const clientResponse = await prompts(
								{
									type: "multiselect",
									name: "clients",
									message: "Which AI tools should we configure right now?",
									hint: "Space toggles items • Enter confirms (leave empty to skip)",
									instructions: false,
									choices: [
										{ title: "Claude Code", value: "claude" },
										{ title: "OpenAI Codex", value: "codex" },
										{ title: "Gemini CLI", value: "gemini" },
										{ title: "Other (open setup guide)", value: "guide" },
									],
									onRender: function () {
										try {
											const promptInstance = this as unknown as {
												cursor: number;
												value: Array<{ value: string }>;
											};
											highlightedClient = promptInstance.value?.[promptInstance.cursor]?.value;
										} catch {}
										return undefined;
									},
								},
								{
									onCancel: () => {
										clientSelectionCancelled = true;
									},
								},
							);

							if (clientSelectionCancelled) {
								integrationMode = null;
								console.log("");
								continue mainSelection;
							}

							const rawClients = (clientResponse?.clients ?? []) as string[];
							const selectedClients = rawClients.length === 0 && highlightedClient ? [highlightedClient] : rawClients;
							highlightedClient = undefined;
							if (selectedClients.length === 0) {
								console.log("  MCP client setup skipped (configure later if needed).");
								mcpClientSetupSummary = "skipped";
								break;
							}

							const results: string[] = [];
							const mcpGuidelineUpdates: EnsureMcpGuidelinesResult[] = [];
							const recordGuidelinesForClient = async (clientKey: string) => {
								const instructionFile = MCP_CLIENT_INSTRUCTION_MAP[clientKey];
								if (!instructionFile) {
									return;
								}
								const nudgeResult = await ensureMcpGuidelines(cwd, instructionFile);
								if (nudgeResult.changed) {
									mcpGuidelineUpdates.push(nudgeResult);
								}
							};
							const uniq = (values: string[]) => [...new Set(values)];

							for (const client of selectedClients) {
								if (client === "claude") {
									const result = await runMcpClientCommand("Claude Code", "claude", [
										"mcp",
										"add",
										"-s",
										"user",
										mcpServerName,
										"--",
										"backlog",
										"mcp",
										"start",
									]);
									results.push(result);
									await recordGuidelinesForClient(client);
									continue;
								}
								if (client === "codex") {
									const result = await runMcpClientCommand("OpenAI Codex", "codex", [
										"mcp",
										"add",
										mcpServerName,
										"backlog",
										"mcp",
										"start",
									]);
									results.push(result);
									await recordGuidelinesForClient(client);
									continue;
								}
								if (client === "gemini") {
									const result = await runMcpClientCommand("Gemini CLI", "gemini", [
										"mcp",
										"add",
										"-s",
										"user",
										mcpServerName,
										"backlog",
										"mcp",
										"start",
									]);
									results.push(result);
									await recordGuidelinesForClient(client);
									continue;
								}
								if (client === "guide") {
									console.log("    Opening MCP setup guide in your browser...");
									await openUrlInBrowser(mcpGuideUrl);
									results.push("Setup guide opened");
									await recordGuidelinesForClient(client);
								}
							}

							if (mcpGuidelineUpdates.length > 0) {
								const createdFiles = uniq(
									mcpGuidelineUpdates.filter((entry) => entry.created).map((entry) => entry.fileName),
								);
								const updatedFiles = uniq(
									mcpGuidelineUpdates.filter((entry) => !entry.created).map((entry) => entry.fileName),
								);
								if (createdFiles.length > 0) {
									console.log(`    Created MCP reminder file(s): ${createdFiles.join(", ")}`);
								}
								if (updatedFiles.length > 0) {
									console.log(`    Added MCP reminder to ${updatedFiles.join(", ")}`);
								}
							}

							mcpClientSetupSummary = results.join(", ");
							break;
						}

						break;
					}

					if (integrationMode === "none") {
						agentFiles = [];
						agentInstructionsSkipped = false;
						break;
					}
				}

				let advancedConfig: Partial<BacklogConfig> = { ...defaultAdvancedConfig };
				let advancedConfigured = false;
				let installClaudeAgentSelection = false;
				let installShellCompletionsSelection = false;
				let completionInstallResult: CompletionInstallResult | null = null;
				let completionInstallError: string | null = null;

				if (isNonInteractive) {
					advancedConfig = applyAdvancedOptionOverrides();
					installClaudeAgentSelection =
						integrationMode === "cli" ? parseBoolean(options.installClaudeAgent, false) : false;
				} else {
					const advancedPrompt = await prompts(
						{
							type: "confirm",
							name: "configureAdvanced",
							message: "Configure advanced settings now?",
							hint: "Runs the advanced backlog config wizard",
							initial: false,
						},
						{
							onCancel: () => {
								console.log("Aborting initialization.");
								process.exit(1);
							},
						},
					);

					if (advancedPrompt.configureAdvanced) {
						const wizardResult = await runAdvancedConfigWizard({
							existingConfig,
							cancelMessage: "Aborting initialization.",
							includeClaudePrompt: integrationMode === "cli",
						});
						advancedConfig = { ...defaultAdvancedConfig, ...wizardResult.config };
						installClaudeAgentSelection = integrationMode === "cli" ? wizardResult.installClaudeAgent : false;
						installShellCompletionsSelection = wizardResult.installShellCompletions;
						if (wizardResult.installShellCompletions) {
							try {
								completionInstallResult = await installCompletion();
							} catch (error) {
								completionInstallError = error instanceof Error ? error.message : String(error);
							}
						}
						advancedConfigured = true;
					}
				}
				// Call shared core init function
				const initResult = await initializeProject(core, {
					projectName: name,
					integrationMode: integrationMode || "none",
					mcpClients: [], // MCP clients are handled separately in CLI with interactive prompts
					agentInstructions: agentFiles,
					installClaudeAgent: installClaudeAgentSelection,
					advancedConfig: {
						checkActiveBranches: advancedConfig.checkActiveBranches,
						remoteOperations: advancedConfig.remoteOperations,
						activeBranchDays: advancedConfig.activeBranchDays,
						bypassGitHooks: advancedConfig.bypassGitHooks,
						autoCommit: advancedConfig.autoCommit,
						zeroPaddedIds: advancedConfig.zeroPaddedIds,
						defaultEditor: advancedConfig.defaultEditor,
						defaultPort: advancedConfig.defaultPort,
						autoOpenBrowser: advancedConfig.autoOpenBrowser,
					},
					existingConfig,
				});

				const config = initResult.config;

				// Show configuration summary
				console.log("\nInitialization Summary:");
				console.log(`  Project Name: ${config.projectName}`);
				if (integrationMode === "cli") {
					console.log("  AI Integration: CLI commands (legacy)");
					if (agentFiles.length > 0) {
						console.log(`  Agent instructions: ${agentFiles.join(", ")}`);
					} else if (agentInstructionsSkipped) {
						console.log("  Agent instructions: skipped");
					} else {
						console.log("  Agent instructions: none");
					}
				} else if (integrationMode === "mcp") {
					console.log("  AI Integration: MCP connector");
					console.log("  Agent instruction files: guidance is provided through the MCP connector.");
					console.log(`  MCP server name: ${mcpServerName}`);
					console.log(`  MCP client setup: ${mcpClientSetupSummary ?? "skipped"}`);
				} else {
					console.log(
						"  AI integration skipped. Configure later via `backlog init` or by registering the MCP server manually.",
					);
				}
				let completionSummary: string;
				if (completionInstallResult) {
					completionSummary = `installed to ${completionInstallResult.installPath}`;
				} else if (installShellCompletionsSelection) {
					completionSummary = "installation failed (see warning below)";
				} else if (advancedConfigured) {
					completionSummary = "skipped";
				} else {
					completionSummary = "not configured";
				}
				console.log(`  Shell completions: ${completionSummary}`);
				if (advancedConfigured) {
					console.log("  Advanced settings:");
					console.log(`    Check active branches: ${config.checkActiveBranches}`);
					console.log(`    Remote operations: ${config.remoteOperations}`);
					console.log(`    Active branch days: ${config.activeBranchDays}`);
					console.log(`    Bypass git hooks: ${config.bypassGitHooks}`);
					console.log(`    Auto commit: ${config.autoCommit}`);
					console.log(`    Zero-padded IDs: ${config.zeroPaddedIds ? `${config.zeroPaddedIds} digits` : "disabled"}`);
					console.log(`    Web UI port: ${config.defaultPort}`);
					console.log(`    Auto open browser: ${config.autoOpenBrowser}`);
					if (config.defaultEditor) {
						console.log(`    Default editor: ${config.defaultEditor}`);
					}
				} else {
					console.log("  Advanced settings: unchanged (run `backlog config` to customize).");
				}
				console.log("");

				if (completionInstallResult) {
					const instructions = completionInstallResult.instructions.trim();
					console.log(
						[
							`Shell completion script installed for ${completionInstallResult.shell}.`,
							`  Path: ${completionInstallResult.installPath}`,
							instructions,
							"",
						].join("\n"),
					);
				} else if (completionInstallError) {
					const indentedError = completionInstallError
						.split("\n")
						.map((line) => `  ${line}`)
						.join("\n");
					console.warn(
						`⚠️  Shell completion installation failed:\n${indentedError}\n  Run \`backlog completion install\` later to retry.\n`,
					);
				}

				// Log init result
				if (initResult.isReInitialization) {
					console.log(`Updated backlog project configuration: ${name}`);
				} else {
					console.log(`Initialized backlog project: ${name}`);
				}

				// Log agent files result from shared init
				if (integrationMode === "cli") {
					if (initResult.mcpResults?.agentFiles) {
						console.log(`✓ ${initResult.mcpResults.agentFiles}`);
					} else if (agentInstructionsSkipped) {
						console.log("Skipping agent instruction files per selection.");
					}
				}

				// Log Claude agent result from shared init
				if (integrationMode === "cli" && initResult.mcpResults?.claudeAgent) {
					console.log(`✓ Claude Code Backlog.md agent ${initResult.mcpResults.claudeAgent}`);
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

	const normalizeList = (values: string[]): string[] =>
		values
			.map((value) => value.trim())
			.filter((value): value is string => value.length > 0)
			.map((value) => normalizeTaskId(value));

	if (Array.isArray(dependencies)) {
		return normalizeList(
			dependencies.flatMap((dep) =>
				String(dep)
					.split(",")
					.map((d) => d.trim()),
			),
		);
	}

	return normalizeList(String(dependencies).split(","));
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
	const [tasks, drafts] = await Promise.all([core.queryTasks(), core.fs.listDrafts()]);

	const knownIds = [...tasks.map((task) => task.id), ...drafts.map((draft) => draft.id)];
	for (const dep of dependencies) {
		const match = knownIds.find((id) => taskIdsEqual(dep, id));
		if (match) {
			valid.push(match);
		} else {
			invalid.push(dep);
		}
	}

	return { valid, invalid };
}

function buildTaskFromOptions(id: string, title: string, options: Record<string, unknown>): Task {
	const parentInput = options.parent ? String(options.parent) : undefined;
	const normalizedParent = parentInput ? normalizeTaskId(parentInput) : undefined;

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
		const cwd = await requireProjectRoot();
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
				console.log(formatTaskPlainText(task, { filePathOverride: filepath }));
				return;
			}
			console.log(`Created draft ${id}`);
			console.log(`File: ${filepath}`);
		} else {
			const filepath = await core.createTask(task);
			if (isPlainFlag) {
				console.log(formatTaskPlainText(task, { filePathOverride: filepath }));
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
		const cwd = await requireProjectRoot();
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

		const allTasks = (await core.queryTasks()).filter(
			(task) => task.id && task.id.trim() !== "" && task.id.startsWith("task-"),
		);

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

	const localTasks = tasks.filter((t) => isLocalEditableTask(t.task));

	let printed = false;

	if (localTasks.length > 0) {
		console.log("Tasks:");
		for (const taskResult of localTasks) {
			const { task } = taskResult;
			const scoreText = formatScore(taskResult.score);
			const statusText = task.status ? ` (${task.status})` : "";
			const priorityText = task.priority ? ` [${task.priority.toUpperCase()}]` : "";
			console.log(`  ${task.id} - ${task.title}${statusText}${priorityText}${scoreText}`);
		}
		printed = true;
	}

	if (documents.length > 0) {
		if (printed) {
			console.log("");
		}
		console.log("Documents:");
		for (const documentResult of documents) {
			const { document } = documentResult;
			const scoreText = formatScore(documentResult.score);
			console.log(`  ${document.id} - ${document.title}${scoreText}`);
		}
		printed = true;
	}

	if (decisions.length > 0) {
		if (printed) {
			console.log("");
		}
		console.log("Decisions:");
		for (const decisionResult of decisions) {
			const { decision } = decisionResult;
			const scoreText = formatScore(decisionResult.score);
			console.log(`  ${decision.id} - ${decision.title}${scoreText}`);
		}
		printed = true;
	}

	if (!printed) {
		console.log("No results found.");
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
		const cwd = await requireProjectRoot();
		const core = new Core(cwd);
		const cleanup = () => {
			core.disposeSearchService();
			core.disposeContentStore();
		};
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
				process.exitCode = 1;
				cleanup();
				return;
			}
			baseFilters.priority = priorityLower as (typeof validPriorities)[number];
		}

		let parentId: string | undefined;
		if (options.parent) {
			const parentInput = String(options.parent);
			parentId = normalizeTaskId(parentInput);
			baseFilters.parentTaskId = parentInput;
		}

		if (options.sort) {
			const validSortFields = ["priority", "id"];
			const sortField = options.sort.toLowerCase();
			if (!validSortFields.includes(sortField)) {
				console.error(`Invalid sort field: ${options.sort}. Valid values are: priority, id`);
				process.exitCode = 1;
				cleanup();
				return;
			}
		}

		const isPlainFlag = options.plain || process.argv.includes("--plain");
		if (isPlainFlag) {
			const tasks = await core.queryTasks({ filters: baseFilters, includeCrossBranch: false });
			const config = await core.filesystem.loadConfig();

			if (parentId) {
				const parentExists = (await core.queryTasks({ includeCrossBranch: false })).some((task) =>
					taskIdsEqual(parentId, task.id),
				);
				if (!parentExists) {
					console.error(`Parent task ${parentId} not found.`);
					process.exitCode = 1;
					cleanup();
					return;
				}
			}

			let sortedTasks = tasks;
			if (options.sort) {
				const validSortFields = ["priority", "id"];
				const sortField = options.sort.toLowerCase();
				if (!validSortFields.includes(sortField)) {
					console.error(`Invalid sort field: ${options.sort}. Valid values are: priority, id`);
					process.exitCode = 1;
					cleanup();
					return;
				}
				sortedTasks = sortTasks(tasks, sortField);
			} else {
				sortedTasks = sortTasks(tasks, "priority");
			}

			let filtered = sortedTasks;
			if (parentId) {
				filtered = filtered.filter((task) => task.parentTaskId && taskIdsEqual(parentId, task.parentTaskId));
			}

			if (filtered.length === 0) {
				if (options.parent) {
					const canonicalParent = normalizeTaskId(String(options.parent));
					console.log(`No child tasks found for parent task ${canonicalParent}.`);
				} else {
					console.log("No tasks found.");
				}
				cleanup();
				return;
			}

			if (options.sort && options.sort.toLowerCase() === "priority") {
				const sortedByPriority = sortTasks(filtered, "priority");
				console.log("Tasks (sorted by priority):");
				for (const t of sortedByPriority) {
					const priorityIndicator = t.priority ? `[${t.priority.toUpperCase()}] ` : "";
					const statusIndicator = t.status ? ` (${t.status})` : "";
					console.log(`  ${priorityIndicator}${t.id} - ${t.title}${statusIndicator}`);
				}
				cleanup();
				return;
			}

			const canonicalByLower = new Map<string, string>();
			const statuses = config?.statuses || [];
			for (const status of statuses) {
				canonicalByLower.set(status.toLowerCase(), status);
			}

			const groups = new Map<string, Task[]>();
			for (const task of filtered) {
				const rawStatus = (task.status || "").trim();
				const canonicalStatus = canonicalByLower.get(rawStatus.toLowerCase()) || rawStatus;
				const list = groups.get(canonicalStatus) || [];
				list.push(task);
				groups.set(canonicalStatus, list);
			}

			const orderedStatuses = [
				...statuses.filter((status) => groups.has(status)),
				...Array.from(groups.keys()).filter((status) => !statuses.includes(status)),
			];

			for (const status of orderedStatuses) {
				const list = groups.get(status);
				if (!list) continue;
				let sortedList = list;
				if (options.sort) {
					sortedList = sortTasks(list, options.sort.toLowerCase());
				}
				console.log(`${status || "No Status"}:`);
				sortedList.forEach((task) => {
					const priorityIndicator = task.priority ? `[${task.priority.toUpperCase()}] ` : "";
					console.log(`  ${priorityIndicator}${task.id} - ${task.title}`);
				});
				console.log();
			}
			cleanup();
			return;
		}

		let filterDescription = "";
		let title = "Tasks";
		const activeFilters: string[] = [];
		if (options.status) activeFilters.push(`Status: ${options.status}`);
		if (options.assignee) activeFilters.push(`Assignee: ${options.assignee}`);
		if (options.parent) {
			activeFilters.push(`Parent: ${normalizeTaskId(String(options.parent))}`);
		}
		if (options.priority) activeFilters.push(`Priority: ${options.priority}`);
		if (options.sort) activeFilters.push(`Sort: ${options.sort}`);

		if (activeFilters.length > 0) {
			filterDescription = activeFilters.join(", ");
			title = `Tasks (${activeFilters.join(" • ")})`;
		}

		const { runUnifiedView } = await import("./ui/unified-view.ts");
		await runUnifiedView({
			core,
			initialView: "task-list",
			tasksLoader: async (updateProgress) => {
				updateProgress("Loading configuration...");
				const config = await core.filesystem.loadConfig();

				// Use loadTasks with progress callback for consistent loading experience
				// This populates the ContentStore, so subsequent queryTasks calls are fast
				await core.loadTasks((msg) => {
					updateProgress(msg);
				});

				// Now query with filters - this will use the already-populated ContentStore
				updateProgress("Applying filters...");
				const [tasks, allTasksForParentCheck] = await Promise.all([
					core.queryTasks({ filters: baseFilters }),
					parentId ? core.queryTasks() : Promise.resolve(undefined),
				]);

				if (parentId && allTasksForParentCheck) {
					const parentExists = allTasksForParentCheck.some((task) => taskIdsEqual(parentId, task.id));
					if (!parentExists) {
						throw new Error(`Parent task ${parentId} not found.`);
					}
				}

				let sortedTasks = tasks;
				if (options.sort) {
					const validSortFields = ["priority", "id"];
					const sortField = options.sort.toLowerCase();
					if (!validSortFields.includes(sortField)) {
						throw new Error(`Invalid sort field: ${options.sort}. Valid values are: priority, id`);
					}
					sortedTasks = sortTasks(tasks, sortField);
				} else {
					sortedTasks = sortTasks(tasks, "priority");
				}

				let filtered = sortedTasks;
				if (parentId) {
					filtered = filtered.filter((task) => task.parentTaskId && taskIdsEqual(parentId, task.parentTaskId));
				}

				return {
					tasks: filtered,
					statuses: config?.statuses || [],
				};
			},
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
		cleanup();
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
	.option("--planned-start <date>", "set planned start date (YYYY-MM-DD)")
	.option("--planned-end <date>", "set planned end date (YYYY-MM-DD)")
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
		const cwd = await requireProjectRoot();
		const core = new Core(cwd);
		const canonicalId = normalizeTaskId(taskId);
		const existingTask = await core.loadTaskById(canonicalId);

		if (!existingTask) {
			console.error(`Task ${taskId} not found.`);
			process.exitCode = 1;
			return;
		}

		const parseCommaSeparated = (value: unknown): string[] => {
			return toStringArray(value)
				.flatMap((entry) => String(entry).split(","))
				.map((entry) => entry.trim())
				.filter((entry) => entry.length > 0);
		};

		let canonicalStatus: string | undefined;
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
			canonicalStatus = canonical;
		}

		let normalizedPriority: "high" | "medium" | "low" | undefined;
		if (options.priority) {
			const priority = String(options.priority).toLowerCase();
			const validPriorities = ["high", "medium", "low"] as const;
			if (!validPriorities.includes(priority as (typeof validPriorities)[number])) {
				console.error(`Invalid priority: ${priority}. Valid values are: high, medium, low`);
				process.exitCode = 1;
				return;
			}
			normalizedPriority = priority as "high" | "medium" | "low";
		}

		let ordinalValue: number | undefined;
		if (options.ordinal !== undefined) {
			const parsed = Number(options.ordinal);
			if (Number.isNaN(parsed) || parsed < 0) {
				console.error(`Invalid ordinal: ${options.ordinal}. Must be a non-negative number.`);
				process.exitCode = 1;
				return;
			}
			ordinalValue = parsed;
		}

		let removeCriteria: number[] | undefined;
		let checkCriteria: number[] | undefined;
		let uncheckCriteria: number[] | undefined;

		try {
			const removes = parsePositiveIndexList(options.removeAc);
			if (removes.length > 0) {
				removeCriteria = removes;
			}
			const checks = parsePositiveIndexList(options.checkAc);
			if (checks.length > 0) {
				checkCriteria = checks;
			}
			const unchecks = parsePositiveIndexList(options.uncheckAc);
			if (unchecks.length > 0) {
				uncheckCriteria = unchecks;
			}
		} catch (error) {
			console.error(error instanceof Error ? error.message : String(error));
			process.exitCode = 1;
			return;
		}

		const labelValues = parseCommaSeparated(options.label);
		const addLabelValues = parseCommaSeparated(options.addLabel);
		const removeLabelValues = parseCommaSeparated(options.removeLabel);
		const assigneeValues = parseCommaSeparated(options.assignee);
		const acceptanceAdditions = processAcceptanceCriteriaOptions(options);

		const combinedDependencies = [...toStringArray(options.dependsOn), ...toStringArray(options.dep)];
		const dependencyValues = combinedDependencies.length > 0 ? normalizeDependencies(combinedDependencies) : undefined;

		const notesAppendValues = toStringArray(options.appendNotes);

		const editArgs: TaskEditArgs = {};
		if (options.title) {
			editArgs.title = String(options.title);
		}
		const descriptionOption = options.description ?? options.desc;
		if (descriptionOption !== undefined) {
			editArgs.description = String(descriptionOption);
		}
		if (canonicalStatus) {
			editArgs.status = canonicalStatus;
		}
		if (normalizedPriority) {
			editArgs.priority = normalizedPriority;
		}
		if (typeof options.plannedStart === "string") {
			editArgs.plannedStart = String(options.plannedStart);
		}
		if (typeof options.plannedEnd === "string") {
			editArgs.plannedEnd = String(options.plannedEnd);
		}
		if (ordinalValue !== undefined) {
			editArgs.ordinal = ordinalValue;
		}
		if (labelValues.length > 0) {
			editArgs.labels = labelValues;
		}
		if (addLabelValues.length > 0) {
			editArgs.addLabels = addLabelValues;
		}
		if (removeLabelValues.length > 0) {
			editArgs.removeLabels = removeLabelValues;
		}
		if (assigneeValues.length > 0) {
			editArgs.assignee = assigneeValues;
		}
		if (dependencyValues && dependencyValues.length > 0) {
			editArgs.dependencies = dependencyValues;
		}
		if (typeof options.plan === "string") {
			editArgs.planSet = String(options.plan);
		}
		if (typeof options.notes === "string") {
			editArgs.notesSet = String(options.notes);
		}
		if (notesAppendValues.length > 0) {
			editArgs.notesAppend = notesAppendValues;
		}
		if (acceptanceAdditions.length > 0) {
			editArgs.acceptanceCriteriaAdd = acceptanceAdditions;
		}
		if (removeCriteria) {
			editArgs.acceptanceCriteriaRemove = removeCriteria;
		}
		if (checkCriteria) {
			editArgs.acceptanceCriteriaCheck = checkCriteria;
		}
		if (uncheckCriteria) {
			editArgs.acceptanceCriteriaUncheck = uncheckCriteria;
		}

		let updatedTask: Task;
		try {
			const updateInput = buildTaskUpdateInput(editArgs);
			updatedTask = await core.editTask(canonicalId, updateInput);
		} catch (error) {
			console.error(error instanceof Error ? error.message : String(error));
			process.exitCode = 1;
			return;
		}

		const isPlainFlag = options.plain || process.argv.includes("--plain");
		if (isPlainFlag) {
			console.log(formatTaskPlainText(updatedTask));
			return;
		}

		console.log(`Updated task ${updatedTask.id}`);
	});

// Note: Implementation notes appending is handled via `task edit --append-notes` only.

taskCmd
	.command("view <taskId>")
	.description("display task details")
	.option("--plain", "use plain text output instead of interactive UI")
	.action(async (taskId: string, options) => {
		const cwd = await requireProjectRoot();
		const core = new Core(cwd);
		const task = await core.loadTaskById(taskId);
		if (!task) {
			console.error(`Task ${taskId} not found.`);
			return;
		}

		// Plain text output for AI agents
		if (options && (("plain" in options && options.plain) || process.argv.includes("--plain"))) {
			console.log(formatTaskPlainText(task));
			return;
		}

		// Use enhanced task viewer with detail focus
		await viewTaskEnhanced(task, { startWithDetailFocus: true, core });
	});

taskCmd
	.command("archive <taskId>")
	.description("archive a task")
	.action(async (taskId: string) => {
		const cwd = await requireProjectRoot();
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
		const cwd = await requireProjectRoot();
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
		const cwd = await requireProjectRoot();
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

		const task = await core.loadTaskById(taskId);
		if (!task) {
			console.error(`Task ${taskId} not found.`);
			return;
		}

		// Plain text output for AI agents
		if (options && (options.plain || process.argv.includes("--plain"))) {
			console.log(formatTaskPlainText(task));
			return;
		}

		// Use unified view with detail focus and Tab switching support
		const allTasks = await core.queryTasks();
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
		const cwd = await requireProjectRoot();
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
		const cwd = await requireProjectRoot();
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
		const cwd = await requireProjectRoot();
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
		const cwd = await requireProjectRoot();
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
		const cwd = await requireProjectRoot();
		const core = new Core(cwd);
		const { getDraftPath } = await import("./utils/task-path.ts");
		const filePath = await getDraftPath(taskId, core);

		if (!filePath) {
			console.error(`Draft ${taskId} not found.`);
			return;
		}
		const draft = await core.filesystem.loadDraft(taskId);

		if (!draft) {
			console.error(`Draft ${taskId} not found.`);
			return;
		}

		// Plain text output for AI agents
		if (options && (("plain" in options && options.plain) || process.argv.includes("--plain"))) {
			console.log(formatTaskPlainText(draft));
			return;
		}

		// Use enhanced task viewer with detail focus
		await viewTaskEnhanced(draft, { startWithDetailFocus: true, core });
	});

draftCmd
	.argument("[taskId]")
	.option("--plain", "use plain text output")
	.action(async (taskId: string | undefined, options: { plain?: boolean }) => {
		if (!taskId) {
			draftCmd.help();
			return;
		}

		const cwd = await requireProjectRoot();
		const core = new Core(cwd);
		const { getDraftPath } = await import("./utils/task-path.ts");
		const filePath = await getDraftPath(taskId, core);

		if (!filePath) {
			console.error(`Draft ${taskId} not found.`);
			return;
		}
		const draft = await core.filesystem.loadDraft(taskId);

		if (!draft) {
			console.error(`Draft ${taskId} not found.`);
			return;
		}

		// Plain text output for AI agents
		if (options && (options.plain || process.argv.includes("--plain"))) {
			console.log(formatTaskPlainText(draft, { filePathOverride: filePath }));
			return;
		}

		// Use enhanced task viewer with detail focus
		await viewTaskEnhanced(draft, { startWithDetailFocus: true, core });
	});

const boardCmd = program.command("board");

function addBoardOptions(cmd: Command) {
	return cmd
		.option("-l, --layout <layout>", "board layout (horizontal|vertical)", "horizontal")
		.option("--vertical", "use vertical layout (shortcut for --layout vertical)");
}

async function handleBoardView(options: { layout?: string; vertical?: boolean }) {
	const cwd = await requireProjectRoot();
	const core = new Core(cwd);
	const config = await core.filesystem.loadConfig();

	const _layout = options.vertical ? "vertical" : (options.layout as "horizontal" | "vertical") || "horizontal";
	const _maxColumnWidth = config?.maxColumnWidth || 20; // Default for terminal display
	const statuses = config?.statuses || [];

	// Use unified view for Tab switching support
	const { runUnifiedView } = await import("./ui/unified-view.ts");
	await runUnifiedView({
		core,
		initialView: "kanban",
		tasksLoader: async (updateProgress) => {
			const tasks = await core.loadTasks((msg) => {
				updateProgress(msg);
			});
			return {
				tasks: tasks.map((t) => ({ ...t, status: t.status || "" })),
				statuses,
			};
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
		const cwd = await requireProjectRoot();
		const core = new Core(cwd);
		const config = await core.filesystem.loadConfig();
		const statuses = config?.statuses || [];

		// Load tasks with progress tracking
		const loadingScreen = await createLoadingScreen("Loading tasks for export");

		let finalTasks: Task[];
		try {
			// Use the shared Core method for loading board tasks
			finalTasks = await core.loadTasks((msg) => {
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
		const cwd = await requireProjectRoot();
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
		const cwd = await requireProjectRoot();
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
		const cwd = await requireProjectRoot();
		const core = new Core(cwd);
		try {
			const content = await core.getDocumentContent(docId);
			if (content === null) {
				console.error(`Document ${docId} not found.`);
				return;
			}
			await scrollableViewer(content);
		} catch {
			console.error(`Document ${docId} not found.`);
		}
	});

const decisionCmd = program.command("decision");

decisionCmd
	.command("create <title>")
	.option("-s, --status <status>")
	.action(async (title: string, options) => {
		const cwd = await requireProjectRoot();
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
			const cwd = await requireProjectRoot();
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
const configCmd = program
	.command("config")
	.description("manage backlog configuration")
	.action(async () => {
		try {
			const cwd = await requireProjectRoot();
			const core = new Core(cwd);
			const existingConfig = await core.filesystem.loadConfig();

			if (!existingConfig) {
				console.error("No backlog project found. Initialize one first with: backlog init");
				process.exit(1);
			}

			const {
				mergedConfig,
				installClaudeAgent: shouldInstallClaude,
				installShellCompletions: shouldInstallCompletions,
			} = await configureAdvancedSettings(core);

			let completionResult: CompletionInstallResult | null = null;
			let completionError: string | null = null;
			if (shouldInstallCompletions) {
				try {
					completionResult = await installCompletion();
				} catch (error) {
					completionError = error instanceof Error ? error.message : String(error);
				}
			}

			console.log("\nAdvanced configuration updated.");
			console.log(`  Check active branches: ${mergedConfig.checkActiveBranches ?? true}`);
			console.log(`  Remote operations: ${mergedConfig.remoteOperations ?? true}`);
			console.log(
				`  Zero-padded IDs: ${
					typeof mergedConfig.zeroPaddedIds === "number" ? `${mergedConfig.zeroPaddedIds} digits` : "disabled"
				}`,
			);
			console.log(`  Web UI port: ${mergedConfig.defaultPort ?? 6420}`);
			console.log(`  Auto open browser: ${mergedConfig.autoOpenBrowser ?? true}`);
			console.log(`  Bypass git hooks: ${mergedConfig.bypassGitHooks ?? false}`);
			console.log(`  Auto commit: ${mergedConfig.autoCommit ?? false}`);
			if (completionResult) {
				console.log(`  Shell completions: installed to ${completionResult.installPath}`);
			} else if (completionError) {
				console.log("  Shell completions: installation failed (see warning below)");
			} else {
				console.log("  Shell completions: skipped");
			}
			if (mergedConfig.defaultEditor) {
				console.log(`  Default editor: ${mergedConfig.defaultEditor}`);
			}
			if (shouldInstallClaude) {
				await installClaudeAgent(cwd);
				console.log("✓ Claude Code Backlog.md agent installed to .claude/agents/");
			}
			if (completionResult) {
				const instructions = completionResult.instructions.trim();
				console.log(
					[
						"",
						`Shell completion script installed for ${completionResult.shell}.`,
						`  Path: ${completionResult.installPath}`,
						instructions,
						"",
					].join("\n"),
				);
			} else if (completionError) {
				const indentedError = completionError
					.split("\n")
					.map((line) => `  ${line}`)
					.join("\n");
				console.warn(
					`⚠️  Shell completion installation failed:\n${indentedError}\n  Run \`backlog completion install\` later to retry.\n`,
				);
			}
			console.log("\nUse `backlog config list` to review all configuration values.");
		} catch (err) {
			console.error("Failed to update configuration", err);
			process.exitCode = 1;
		}
	});

// Sequences command group
const sequenceCmd = program.command("sequence");

sequenceCmd
	.description("list and inspect execution sequences computed from task dependencies")
	.command("list")
	.description("list sequences (interactive by default; use --plain for text output)")
	.option("--plain", "use plain text output instead of interactive UI")
	.action(async (options) => {
		const cwd = await requireProjectRoot();
		const core = new Core(cwd);
		const tasks = await core.queryTasks();
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
			const cwd = await requireProjectRoot();
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
			const cwd = await requireProjectRoot();
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
			const cwd = await requireProjectRoot();
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
			const cwd = await requireProjectRoot();
			const core = new Core(cwd);

			// Check if backlog project is initialized
			const config = await core.filesystem.loadConfig();
			if (!config) {
				console.error("No backlog project found. Initialize one first with: backlog init");
				process.exit(1);
			}

			// Get all Done tasks
			const tasks = await core.queryTasks();
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
				const fromPath = task.filePath ?? (await core.getTask(task.id))?.filePath ?? null;

				if (!fromPath) {
					console.error(`Failed to locate file for task ${task.id}`);
					continue;
				}

				const taskFilename = basename(fromPath);
				const toPath = join(core.filesystem.completedDir, taskFilename);

				const success = await core.completeTask(task.id);
				if (success) {
					successCount++;
					movedTasks.push({ fromPath, toPath, taskId: task.id });
				} else {
					console.error(`Failed to move task ${task.id}`);
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
			const cwd = await requireProjectRoot();
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
			const cwd = await requireProjectRoot();
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

// Completion command group
registerCompletionCommand(program);

// MCP command group
registerMcpCommand(program);

program.parseAsync(process.argv).finally(() => {
	// Restore BUN_OPTIONS after CLI parsing completes so it's available for subsequent commands
	if (originalBunOptions) {
		process.env.BUN_OPTIONS = originalBunOptions;
	}
});
