import { dirname, isAbsolute, join } from "node:path";
import { fileURLToPath } from "node:url";
import { AGENT_GUIDELINES, CLAUDE_GUIDELINES, CURSOR_GUIDELINES, README_GUIDELINES } from "./constants/index.ts";
import type { GitOperations } from "./git/operations.ts";

export type AgentInstructionFile = "AGENTS.md" | "CLAUDE.md" | ".cursorrules" | "readme.md";

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
		"readme.md": README_GUIDELINES,
	};

	const paths: string[] = [];
	for (const name of files) {
		const content = await loadContent(mapping[name]);
		const filePath = join(projectRoot, name);
		let existing = "";
		try {
			existing = await Bun.file(filePath).text();
			if (!existing.endsWith("\n")) existing += "\n";
			existing += content;
		} catch {
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
