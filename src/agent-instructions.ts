import { join } from "node:path";
import { AGENT_GUIDELINES, CLAUDE_GUIDELINES, CURSOR_GUIDELINES, README_GUIDELINES } from "./constants/index.ts";
import type { GitOperations } from "./git/operations.ts";

export type AgentInstructionFile = "AGENTS.md" | "CLAUDE.md" | ".cursorrules" | "readme.md";

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
		const content = mapping[name];
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
