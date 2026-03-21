import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { spawn } from "bun";
import {
	type AgentInstructionFile,
	addAgentInstructions,
	ensureMcpGuidelines,
	installClaudeAgent,
} from "../agent-instructions.ts";
import { DEFAULT_INIT_CONFIG } from "../constants/index.ts";
import type { BacklogConfig } from "../types/index.ts";
import { normalizeProjectBacklogDirectory } from "../utils/backlog-directory.ts";
import type { Core } from "./backlog.ts";

export const MCP_SERVER_NAME = "backlog";
export const MCP_GUIDE_URL = "https://github.com/MrLesk/Backlog.md#-mcp-integration-model-context-protocol";

export type IntegrationMode = "mcp" | "cli" | "none";
export type McpClient = "claude" | "codex" | "gemini" | "kiro" | "cursor" | "guide";

export interface InitializeProjectOptions {
	projectName: string;
	backlogDirectory?: string;
	backlogDirectorySource?: "backlog" | ".backlog" | "custom";
	configLocation?: "folder" | "root";
	integrationMode: IntegrationMode;
	mcpClients?: McpClient[];
	agentInstructions?: AgentInstructionFile[];
	installClaudeAgent?: boolean;
	advancedConfig?: {
		checkActiveBranches?: boolean;
		remoteOperations?: boolean;
		activeBranchDays?: number;
		bypassGitHooks?: boolean;
		autoCommit?: boolean;
		zeroPaddedIds?: number;
		defaultEditor?: string;
		definitionOfDone?: string[];
		defaultPort?: number;
		autoOpenBrowser?: boolean;
		/** Custom task prefix (e.g., "JIRA"). Only set during first init, read-only after. */
		taskPrefix?: string;
	};
	/** Existing config for re-initialization */
	existingConfig?: BacklogConfig | null;
}

export interface InitializeProjectResult {
	success: boolean;
	projectName: string;
	isReInitialization: boolean;
	config: BacklogConfig;
	mcpResults?: Record<string, string>;
}

async function runMcpClientCommand(label: string, command: string, args: string[]): Promise<string> {
	try {
		const child = spawn({
			cmd: [command, ...args],
			stdout: "pipe",
			stderr: "pipe",
		});
		const exitCode = await child.exited;
		if (exitCode !== 0) {
			throw new Error(`Command exited with code ${exitCode}`);
		}
		return `Added Backlog MCP server to ${label}`;
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		throw new Error(
			`Unable to configure ${label} automatically (${message}). Run manually: ${command} ${args.join(" ")}`,
		);
	}
}

/**
 * Merge parsed Cursor `mcp.json` root with the canonical Backlog MCP server entry.
 * Used by `configureCursorProjectMcp` and unit-tested without filesystem I/O.
 */
export function mergeCursorMcpProjectJson(base: Record<string, unknown>): Record<string, unknown> {
	const existingServers = base.mcpServers;
	let mcpServers: Record<string, unknown>;
	if (existingServers === undefined) {
		mcpServers = {};
	} else if (existingServers !== null && typeof existingServers === "object" && !Array.isArray(existingServers)) {
		mcpServers = { ...(existingServers as Record<string, unknown>) };
	} else {
		throw new Error(`Cursor MCP config has an invalid mcpServers value. Manual setup: ${MCP_GUIDE_URL}`);
	}

	mcpServers[MCP_SERVER_NAME] = {
		type: "stdio",
		command: "backlog",
		args: ["mcp", "start"],
	};

	return { ...base, mcpServers };
}

function cursorMcpConfigDir(projectRoot: string): string {
	/** Test-only: write under a non-`.cursor` folder when sandbox blocks `.cursor` mkdir (see tests). */
	const rel = process.env.BACKLOG_TEST_CURSOR_MCP_RELATIVE_DIR ?? ".cursor";
	return join(projectRoot, rel);
}

/**
 * Merge or create Cursor project MCP config at `.cursor/mcp.json` (see Cursor docs).
 * Preserves other `mcpServers` entries and other top-level keys when valid.
 */
export async function configureCursorProjectMcp(projectRoot: string): Promise<string> {
	const cursorDir = cursorMcpConfigDir(projectRoot);
	const mcpPath = join(cursorDir, "mcp.json");
	const displayPath = ".cursor/mcp.json";
	await mkdir(cursorDir, { recursive: true });

	let base: Record<string, unknown> = {};
	if (existsSync(mcpPath)) {
		const raw = await readFile(mcpPath, "utf-8");
		let parsed: unknown;
		try {
			parsed = JSON.parse(raw);
		} catch {
			throw new Error(
				`Existing Cursor MCP config is not valid JSON (${displayPath}). Fix or remove the file, then retry. Manual setup: ${MCP_GUIDE_URL}`,
			);
		}
		if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
			throw new Error(
				`Existing Cursor MCP config must be a JSON object (${displayPath}). Manual setup: ${MCP_GUIDE_URL}`,
			);
		}
		base = { ...(parsed as Record<string, unknown>) };
	}

	const out = mergeCursorMcpProjectJson(base);
	await writeFile(mcpPath, `${JSON.stringify(out, null, "\t")}\n`, "utf-8");
	return `Added Backlog MCP server to Cursor (${displayPath})`;
}

/**
 * Core initialization logic shared between CLI and browser.
 * Both CLI and browser validate input before calling this function.
 */
export async function initializeProject(
	core: Core,
	options: InitializeProjectOptions,
): Promise<InitializeProjectResult> {
	const {
		projectName,
		integrationMode,
		mcpClients = [],
		agentInstructions = [],
		installClaudeAgent: installClaudeAgentFlag = false,
		advancedConfig = {},
		existingConfig,
	} = options;

	const isReInitialization = !!existingConfig;
	const projectRoot = core.filesystem.rootDir;
	const hasDefaultEditorOverride = Object.hasOwn(advancedConfig, "defaultEditor");
	const hasZeroPaddedIdsOverride = Object.hasOwn(advancedConfig, "zeroPaddedIds");
	const hasDefinitionOfDoneOverride = Object.hasOwn(advancedConfig, "definitionOfDone");

	// Build config, preserving existing values for re-initialization.
	// Re-init should be idempotent for fields that init does not explicitly manage.
	const d = DEFAULT_INIT_CONFIG;
	const baseConfig: BacklogConfig = {
		projectName,
		statuses: ["To Do", "In Progress", "Done"],
		labels: [],
		defaultStatus: "To Do",
		dateFormat: "yyyy-mm-dd",
		maxColumnWidth: 20,
		autoCommit: advancedConfig.autoCommit ?? existingConfig?.autoCommit ?? d.autoCommit,
		remoteOperations: advancedConfig.remoteOperations ?? existingConfig?.remoteOperations ?? d.remoteOperations,
		bypassGitHooks: advancedConfig.bypassGitHooks ?? existingConfig?.bypassGitHooks ?? d.bypassGitHooks,
		checkActiveBranches:
			advancedConfig.checkActiveBranches ?? existingConfig?.checkActiveBranches ?? d.checkActiveBranches,
		activeBranchDays: advancedConfig.activeBranchDays ?? existingConfig?.activeBranchDays ?? d.activeBranchDays,
		defaultPort: advancedConfig.defaultPort ?? existingConfig?.defaultPort ?? d.defaultPort,
		autoOpenBrowser: advancedConfig.autoOpenBrowser ?? existingConfig?.autoOpenBrowser ?? d.autoOpenBrowser,
		taskResolutionStrategy: existingConfig?.taskResolutionStrategy || "most_recent",
		// Preserve existing prefixes on re-init, or use custom prefix if provided during first init
		prefixes: existingConfig?.prefixes || {
			task: advancedConfig.taskPrefix || "task",
		},
	};
	const config: BacklogConfig = {
		...baseConfig,
		...(existingConfig ?? {}),
		projectName,
		autoCommit: advancedConfig.autoCommit ?? existingConfig?.autoCommit ?? d.autoCommit,
		remoteOperations: advancedConfig.remoteOperations ?? existingConfig?.remoteOperations ?? d.remoteOperations,
		bypassGitHooks: advancedConfig.bypassGitHooks ?? existingConfig?.bypassGitHooks ?? d.bypassGitHooks,
		checkActiveBranches:
			advancedConfig.checkActiveBranches ?? existingConfig?.checkActiveBranches ?? d.checkActiveBranches,
		activeBranchDays: advancedConfig.activeBranchDays ?? existingConfig?.activeBranchDays ?? d.activeBranchDays,
		defaultPort: advancedConfig.defaultPort ?? existingConfig?.defaultPort ?? d.defaultPort,
		autoOpenBrowser: advancedConfig.autoOpenBrowser ?? existingConfig?.autoOpenBrowser ?? d.autoOpenBrowser,
		prefixes: existingConfig?.prefixes || {
			task: advancedConfig.taskPrefix || "task",
		},
		...(hasDefaultEditorOverride && advancedConfig.defaultEditor
			? { defaultEditor: advancedConfig.defaultEditor }
			: {}),
		...(hasZeroPaddedIdsOverride && typeof advancedConfig.zeroPaddedIds === "number" && advancedConfig.zeroPaddedIds > 0
			? { zeroPaddedIds: advancedConfig.zeroPaddedIds }
			: {}),
		...(hasDefinitionOfDoneOverride && Array.isArray(advancedConfig.definitionOfDone)
			? { definitionOfDone: [...advancedConfig.definitionOfDone] }
			: {}),
	};
	// Preserve all non-init-managed fields, but allow init-managed optional fields to be explicitly cleared.
	if (hasDefaultEditorOverride && !advancedConfig.defaultEditor) {
		delete config.defaultEditor;
	}
	if (
		hasZeroPaddedIdsOverride &&
		!(typeof advancedConfig.zeroPaddedIds === "number" && advancedConfig.zeroPaddedIds > 0)
	) {
		delete config.zeroPaddedIds;
	}
	if (hasDefinitionOfDoneOverride && !Array.isArray(advancedConfig.definitionOfDone)) {
		delete config.definitionOfDone;
	}

	// Create structure and save config
	if (isReInitialization) {
		await core.filesystem.saveConfig(config);
	} else {
		const normalizedBacklogDirectory = normalizeProjectBacklogDirectory(options.backlogDirectory);
		const inferredBacklogDirectorySource = normalizedBacklogDirectory
			? normalizedBacklogDirectory === ".backlog"
				? ".backlog"
				: normalizedBacklogDirectory === "backlog"
					? "backlog"
					: "custom"
			: undefined;
		if (
			options.backlogDirectorySource &&
			inferredBacklogDirectorySource &&
			options.backlogDirectorySource !== inferredBacklogDirectorySource
		) {
			throw new Error("Backlog directory source and backlog directory value must agree.");
		}
		const effectiveBacklogDirectorySource = options.backlogDirectorySource ?? inferredBacklogDirectorySource;
		if (effectiveBacklogDirectorySource === "custom" && !normalizedBacklogDirectory) {
			throw new Error("Backlog directory must be a valid project-relative path.");
		}
		const effectiveConfigLocation =
			options.configLocation ?? (effectiveBacklogDirectorySource === "custom" ? "root" : "folder");
		if (effectiveBacklogDirectorySource === "custom" && effectiveConfigLocation !== "root") {
			throw new Error("Custom backlog directories require root config discovery.");
		}
		const selectedBacklogDirectory =
			normalizedBacklogDirectory ??
			(effectiveBacklogDirectorySource === ".backlog"
				? ".backlog"
				: effectiveBacklogDirectorySource === "backlog"
					? "backlog"
					: "backlog");
		core.filesystem.setBacklogDirectory(selectedBacklogDirectory);
		core.filesystem.setConfigLocation(effectiveConfigLocation);
		await core.filesystem.ensureBacklogStructure();
		await core.filesystem.saveConfig(config);
		await core.ensureConfigLoaded();
	}

	const mcpResults: Record<string, string> = {};

	// Handle MCP integration
	if (integrationMode === "mcp" && mcpClients.length > 0) {
		for (const client of mcpClients) {
			try {
				if (client === "claude") {
					const result = await runMcpClientCommand("Claude Code", "claude", [
						"mcp",
						"add",
						"-s",
						"user",
						MCP_SERVER_NAME,
						"--",
						"backlog",
						"mcp",
						"start",
					]);
					mcpResults.claude = result;
					await ensureMcpGuidelines(projectRoot, "CLAUDE.md");
				} else if (client === "codex") {
					const result = await runMcpClientCommand("OpenAI Codex", "codex", [
						"mcp",
						"add",
						MCP_SERVER_NAME,
						"backlog",
						"mcp",
						"start",
					]);
					mcpResults.codex = result;
					await ensureMcpGuidelines(projectRoot, "AGENTS.md");
				} else if (client === "gemini") {
					const result = await runMcpClientCommand("Gemini CLI", "gemini", [
						"mcp",
						"add",
						"-s",
						"user",
						MCP_SERVER_NAME,
						"backlog",
						"mcp",
						"start",
					]);
					mcpResults.gemini = result;
					await ensureMcpGuidelines(projectRoot, "GEMINI.md");
				} else if (client === "kiro") {
					const result = await runMcpClientCommand("Kiro", "kiro-cli", [
						"mcp",
						"add",
						"--scope",
						"global",
						"--name",
						MCP_SERVER_NAME,
						"--command",
						"backlog",
						"--args",
						"mcp,start",
					]);
					mcpResults.kiro = result;
					await ensureMcpGuidelines(projectRoot, "AGENTS.md");
				} else if (client === "cursor") {
					const result = await configureCursorProjectMcp(projectRoot);
					mcpResults.cursor = result;
					await ensureMcpGuidelines(projectRoot, "AGENTS.md");
				} else if (client === "guide") {
					mcpResults.guide = `Setup guide: ${MCP_GUIDE_URL}`;
				}
			} catch (error) {
				const message = error instanceof Error ? error.message : String(error);
				mcpResults[client] = `Failed: ${message}`;
			}
		}
	}

	// Handle CLI integration - agent instruction files
	if (integrationMode === "cli" && agentInstructions.length > 0) {
		try {
			await addAgentInstructions(projectRoot, core.gitOps, agentInstructions, config.autoCommit);
			mcpResults.agentFiles = `Created: ${agentInstructions.join(", ")}`;
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			mcpResults.agentFiles = `Failed: ${message}`;
		}
	}

	// Handle Claude agent installation
	if (integrationMode === "cli" && installClaudeAgentFlag) {
		try {
			await installClaudeAgent(projectRoot);
			mcpResults.claudeAgent = "Installed to .claude/agents/";
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			mcpResults.claudeAgent = `Failed: ${message}`;
		}
	}

	return {
		success: true,
		projectName,
		isReInitialization,
		config,
		mcpResults: Object.keys(mcpResults).length > 0 ? mcpResults : undefined,
	};
}
