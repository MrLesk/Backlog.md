import { join } from "node:path";
import { AGENT_GUIDELINES, CLAUDE_GUIDELINES, CURSOR_GUIDELINES } from "./constants/index.ts";
import type { GitOperations } from "./git/operations.ts";

export async function addAgentInstructions(projectRoot: string, git?: GitOperations): Promise<void> {
	const files = [
		{ name: "AGENTS.md", content: AGENT_GUIDELINES },
		{ name: "CLAUDE.md", content: CLAUDE_GUIDELINES },
		{ name: ".cursorrules", content: CURSOR_GUIDELINES },
	];

	const paths: string[] = [];
	for (const { name, content } of files) {
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

	if (git) {
		await git.addFiles(paths);
		await git.commitChanges("Add AI agent instructions");
	}
}
