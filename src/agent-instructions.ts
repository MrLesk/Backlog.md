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
		let existing = "";

		// Check if file exists first to avoid Windows hanging issue
		if (existsSync(filePath)) {
			try {
				// On Windows, use synchronous read to avoid hanging
				if (process.platform === "win32") {
					existing = readFileSync(filePath, "utf-8");
				} else {
					existing = await Bun.file(filePath).text();
				}
				if (!existing.endsWith("\n")) existing += "\n";
				existing += content;
			} catch (error) {
				console.error(`Error reading existing file ${filePath}:`, error);
				// If we can't read it, just use the new content
				existing = content;
			}
		} else {
			// File doesn't exist, use content as is
			existing = content;
		}

		await Bun.write(filePath, existing);
		paths.push(filePath);
	}

	if (git && paths.length > 0) {
		await git.addFiles(paths);
		await git.commitChanges("Add AI agent instructions");
	}
}

export { loadContent as _loadAgentGuideline };
