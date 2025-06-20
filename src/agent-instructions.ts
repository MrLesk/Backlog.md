import { existsSync, readFileSync } from "node:fs";
import { dirname, isAbsolute, join } from "node:path";
import { fileURLToPath } from "node:url";
import { AGENT_GUIDELINES, CLAUDE_GUIDELINES, CURSOR_GUIDELINES, README_GUIDELINES } from "./constants/index.ts";
import type { GitOperations } from "./git/operations.ts";

export type AgentInstructionFile = "AGENTS.md" | "CLAUDE.md" | ".cursorrules" | "README.md";

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

/**
 * Gets the appropriate markers for a given file type
 */
function getMarkers(fileName: string): { start: string; end: string } {
	if (fileName === ".cursorrules") {
		// .cursorrules doesn't support HTML comments, use markdown-style comments
		return {
			start: "# === BACKLOG.MD GUIDELINES START ===",
			end: "# === BACKLOG.MD GUIDELINES END ===",
		};
	}
	// All markdown files support HTML comments
	return {
		start: "<!-- BACKLOG.MD GUIDELINES START -->",
		end: "<!-- BACKLOG.MD GUIDELINES END -->",
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
function wrapWithMarkers(content: string, fileName: string): string {
	const { start, end } = getMarkers(fileName);
	return `\n${start}\n${content}\n${end}\n`;
}

export async function addAgentInstructions(
	projectRoot: string,
	git?: GitOperations,
	files: AgentInstructionFile[] = ["AGENTS.md", "CLAUDE.md", ".cursorrules"],
): Promise<void> {
	const mapping: Record<AgentInstructionFile, string> = {
		"AGENTS.md": AGENT_GUIDELINES,
		"CLAUDE.md": CLAUDE_GUIDELINES,
		".cursorrules": CURSOR_GUIDELINES,
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

		await Bun.write(filePath, finalContent);
		paths.push(filePath);
	}

	if (git && paths.length > 0) {
		await git.addFiles(paths);
		await git.commitChanges("Add AI agent instructions");
	}
}

export { loadContent as _loadAgentGuideline };
