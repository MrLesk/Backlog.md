import { existsSync, readFileSync } from "node:fs";
import { mkdir } from "node:fs/promises";
import { dirname, isAbsolute, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
	AGENT_GUIDELINES,
	CLAUDE_AGENT_CONTENT,
	CLAUDE_GUIDELINES,
	COPILOT_GUIDELINES,
	GEMINI_GUIDELINES,
	MCP_AGENT_NUDGE,
	README_GUIDELINES,
} from "./constants/index.ts";
import type { GitOperations } from "./git/operations.ts";

export type AgentInstructionFile =
	| "AGENTS.md"
	| "CLAUDE.md"
	| "GEMINI.md"
	| ".github/copilot-instructions.md"
	| "README.md";

const __dirname = dirname(fileURLToPath(import.meta.url));

async function loadContent(textOrPath: string): Promise<string> {
	if (textOrPath.includes("\n")) return textOrPath;
	try {
		const path = isAbsolute(textOrPath) ? textOrPath : join(__dirname, textOrPath);
		return await Bun.file(path).text();
	} catch {
		return textOrPath;
	}
}

type GuidelineMarkerKind = "default" | "mcp";

/**
 * Gets the appropriate markers for a given file type
 */
function getMarkers(fileName: string, kind: GuidelineMarkerKind = "default"): { start: string; end: string } {
	const label = kind === "mcp" ? "BACKLOG.MD MCP GUIDELINES" : "BACKLOG.MD GUIDELINES";
	if (fileName === ".cursorrules") {
		// .cursorrules doesn't support HTML comments, use markdown-style comments
		return {
			start: `# === ${label} START ===`,
			end: `# === ${label} END ===`,
		};
	}
	// All markdown files support HTML comments
	return {
		start: `<!-- ${label} START -->`,
		end: `<!-- ${label} END -->`,
	};
}

/**
 * Checks if the Backlog.md guidelines are already present in the content
 */
function hasBacklogGuidelines(content: string, fileName: string): boolean {
	const { start } = getMarkers(fileName);
	return content.includes(start);
}

/**
 * Wraps the Backlog.md guidelines with appropriate markers
 */
function wrapWithMarkers(content: string, fileName: string, kind: GuidelineMarkerKind = "default"): string {
	const { start, end } = getMarkers(fileName, kind);
	return `\n${start}\n${content}\n${end}\n`;
}

function stripGuidelineSection(
	content: string,
	fileName: string,
	kind: GuidelineMarkerKind,
): { content: string; removed: boolean } {
	const { start, end } = getMarkers(fileName, kind);
	let removed = false;
	let result = content;

	while (true) {
		const startIndex = result.indexOf(start);
		if (startIndex === -1) {
			break;
		}

		const endIndex = result.indexOf(end, startIndex);
		if (endIndex === -1) {
			break;
		}

		let removalStart = startIndex;
		while (removalStart > 0 && (result[removalStart - 1] === " " || result[removalStart - 1] === "\t")) {
			removalStart -= 1;
		}
		if (removalStart > 0 && result[removalStart - 1] === "\n") {
			removalStart -= 1;
			if (removalStart > 0 && result[removalStart - 1] === "\r") {
				removalStart -= 1;
			}
		} else if (removalStart > 0 && result[removalStart - 1] === "\r") {
			removalStart -= 1;
		}

		let removalEnd = endIndex + end.length;
		if (removalEnd < result.length && result[removalEnd] === "\r") {
			removalEnd += 1;
		}
		if (removalEnd < result.length && result[removalEnd] === "\n") {
			removalEnd += 1;
		}

		result = result.slice(0, removalStart) + result.slice(removalEnd);
		removed = true;
	}

	return { content: result, removed };
}

export async function addAgentInstructions(
	projectRoot: string,
	git?: GitOperations,
	files: AgentInstructionFile[] = ["AGENTS.md", "CLAUDE.md", "GEMINI.md", ".github/copilot-instructions.md"],
	autoCommit = false,
): Promise<void> {
	const mapping: Record<AgentInstructionFile, string> = {
		"AGENTS.md": AGENT_GUIDELINES,
		"CLAUDE.md": CLAUDE_GUIDELINES,
		"GEMINI.md": GEMINI_GUIDELINES,
		".github/copilot-instructions.md": COPILOT_GUIDELINES,
		"README.md": README_GUIDELINES,
	};

	const paths: string[] = [];
	for (const name of files) {
		const content = await loadContent(mapping[name]);
		const filePath = join(projectRoot, name);
		let finalContent = "";

		// Check if file exists first to avoid Windows hanging issue
		if (existsSync(filePath)) {
			try {
				// On Windows, use synchronous read to avoid hanging
				let existing: string;
				if (process.platform === "win32") {
					existing = readFileSync(filePath, "utf-8");
				} else {
					existing = await Bun.file(filePath).text();
				}

				const mcpStripped = stripGuidelineSection(existing, name, "mcp");
				if (mcpStripped.removed) {
					existing = mcpStripped.content;
				}

				// Check if Backlog.md guidelines are already present
				if (hasBacklogGuidelines(existing, name)) {
					// Guidelines already exist, skip this file
					continue;
				}

				// Append Backlog.md guidelines with markers
				if (!existing.endsWith("\n")) existing += "\n";
				finalContent = existing + wrapWithMarkers(content, name);
			} catch (error) {
				console.error(`Error reading existing file ${filePath}:`, error);
				// If we can't read it, just use the new content with markers
				finalContent = wrapWithMarkers(content, name);
			}
		} else {
			// File doesn't exist, create with markers
			finalContent = wrapWithMarkers(content, name);
		}

		await mkdir(dirname(filePath), { recursive: true });
		await Bun.write(filePath, finalContent);
		paths.push(filePath);
	}

	if (git && paths.length > 0 && autoCommit) {
		await git.addFiles(paths);
		await git.commitChanges("Add AI agent instructions");
	}
}

export { loadContent as _loadAgentGuideline };

function hasMcpGuidelines(content: string, fileName: string): boolean {
	const { start } = getMarkers(fileName, "mcp");
	return content.includes(start);
}

async function readExistingFile(filePath: string): Promise<string> {
	if (process.platform === "win32") {
		return readFileSync(filePath, "utf-8");
	}
	return await Bun.file(filePath).text();
}

export interface EnsureMcpGuidelinesResult {
	changed: boolean;
	created: boolean;
	fileName: AgentInstructionFile;
	filePath: string;
}

export async function ensureMcpGuidelines(
	projectRoot: string,
	fileName: AgentInstructionFile,
): Promise<EnsureMcpGuidelinesResult> {
	const filePath = join(projectRoot, fileName);
	const fileExists = existsSync(filePath);
	let existing = "";

	if (fileExists) {
		try {
			existing = await readExistingFile(filePath);
			const cliStripped = stripGuidelineSection(existing, fileName, "default");
			const removedCli = cliStripped.removed;
			existing = cliStripped.content;

			if (!removedCli && hasMcpGuidelines(existing, fileName)) {
				return { changed: false, created: false, fileName, filePath };
			}

			const mcpStripped = stripGuidelineSection(existing, fileName, "mcp");
			if (mcpStripped.removed) {
				existing = mcpStripped.content;
			}
		} catch (error) {
			console.error(`Error reading existing file ${filePath}:`, error);
			existing = "";
		}
	}

	let nextContent = existing;
	if (nextContent && !nextContent.endsWith("\n")) {
		nextContent += "\n";
	}
	nextContent += wrapWithMarkers(MCP_AGENT_NUDGE, fileName, "mcp");

	await mkdir(dirname(filePath), { recursive: true });
	await Bun.write(filePath, nextContent);

	return { changed: true, created: !fileExists, fileName, filePath };
}

/**
 * Installs the Claude Code backlog agent to the project's .claude/agents directory
 */
export async function installClaudeAgent(projectRoot: string): Promise<void> {
	const agentDir = join(projectRoot, ".claude", "agents");
	const agentPath = join(agentDir, "project-manager-backlog.md");

	// Create the directory if it doesn't exist
	await mkdir(agentDir, { recursive: true });

	// Write the agent content
	await Bun.write(agentPath, CLAUDE_AGENT_CONTENT);
}
