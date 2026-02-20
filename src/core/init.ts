import { spawn } from "bun";
import {
	type AgentInstructionFile,
	addAgentInstructions,
	ensureMcpGuidelines,
	installClaudeAgent,
} from "../agent-instructions.ts";
import { DEFAULT_INIT_CONFIG } from "../constants/index.ts";
import type { BacklogConfig } from "../types/index.ts";
import type { Core } from "./backlog.ts";

export const MCP_SERVER_NAME = "backlog";
export const MCP_GUIDE_URL = "https://github.com/MrLesk/Backlog.md#-mcp-integration-model-context-protocol";

export type IntegrationMode = "mcp" | "cli" | "none";
export type McpClient = "claude" | "codex" | "gemini" | "kiro" | "guide";

export interface InitializeProjectOptions {
	projectName: string;
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

	// Create structure and save config
	if (isReInitialization) {
		await core.filesystem.saveConfig(config);
	} else {
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
