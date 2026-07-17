// Agent-loop templates bundled into the binary.
//
// This is the multi-agent fork of Backlog.md: `backlog init` provisions the
// full coder -> reviewer -> human-review dispatch loop out of the box (the
// upstream tool ships a plain 3-status board — use it if you want that).
//
// The prompt/dispatch/MCP files are inlined at build time via Bun text imports
// (`with { type: "text" }`) so they travel inside the compiled standalone
// binary — there is no `backlog/prompts` directory next to the executable to
// read from at runtime. init writes them into the target project instead.

import dispatchPs1 from "../../backlog/prompts/dispatch.ps1" with { type: "text" };
import dispatchSh from "../../backlog/prompts/dispatch.sh" with { type: "text" };
import promptsReadme from "../../backlog/prompts/README.md" with { type: "text" };
import codeMd from "../../backlog/prompts/code.md" with { type: "text" };
import reviewMd from "../../backlog/prompts/review.md" with { type: "text" };
import readyMd from "../../backlog/prompts/ready.md" with { type: "text" };
import codeTestMd from "../../backlog/prompts/code.test.md" with { type: "text" };
import reviewTestMd from "../../backlog/prompts/review.test.md" with { type: "text" };
import readyTestMd from "../../backlog/prompts/ready.test.md" with { type: "text" };
import tokenReportPs1 from "../../backlog/prompts/token-report.ps1" with { type: "text" };
import createMrPs1 from "../../backlog/prompts/create-mr.ps1" with { type: "text" };
// The MCP configs resolve as parsed JSON (tsc's built-in JSON module typing);
// re-serialize them when scaffolding. The ${GITLAB_TOKEN} placeholder is a plain
// string value and round-trips through JSON faithfully.
import mcpCoderJson from "../../.claude/mcp-coder.json";
import mcpReviewerJson from "../../.claude/mcp-reviewer.json";

/** The five-stage pipeline the dispatch loop drives. */
export const AGENT_LOOP_STATUSES = ["To Do", "In Progress", "In Review", "Human Review", "Done"] as const;

/**
 * Shell used to run the onStatusChange hook. PowerShell on Windows (the
 * dispatch scripts are PowerShell there); "auto" (sh) everywhere else.
 */
export function agentLoopShell(platform: NodeJS.Platform = process.platform): string {
	return platform === "win32" ? "powershell" : "auto";
}

/**
 * The onStatusChange command that fires the dispatcher. Windows runs the
 * PowerShell script; POSIX runs the shell script. `backlogDir` is the project's
 * backlog directory name so a custom `--backlog-dir` still resolves correctly.
 */
export function agentLoopOnStatusChange(backlogDir: string, platform: NodeJS.Platform = process.platform): string {
	if (platform === "win32") {
		return `powershell -NoProfile -ExecutionPolicy Bypass -File "$PWD\\${backlogDir}\\prompts\\dispatch.ps1"`;
	}
	return `sh "$PWD/${backlogDir}/prompts/dispatch.sh"`;
}

export interface ScaffoldFile {
	/** Path relative to the project root. */
	path: string;
	content: string;
	/** POSIX-executable scripts get +x where the filesystem supports it. */
	executable?: boolean;
}

/**
 * The files init writes into a freshly-initialized project. Prompt/dispatch
 * files live under the chosen backlog directory; the role-scoped MCP configs
 * live under `.claude/`. All are written only when absent so re-init never
 * clobbers a project's customized prompts.
 */
export function buildAgentLoopFiles(backlogDir: string): ScaffoldFile[] {
	const p = `${backlogDir}/prompts`;
	return [
		{ path: `${p}/dispatch.ps1`, content: dispatchPs1 },
		{ path: `${p}/dispatch.sh`, content: dispatchSh, executable: true },
		{ path: `${p}/README.md`, content: promptsReadme },
		{ path: `${p}/code.md`, content: codeMd },
		{ path: `${p}/review.md`, content: reviewMd },
		{ path: `${p}/ready.md`, content: readyMd },
		{ path: `${p}/code.test.md`, content: codeTestMd },
		{ path: `${p}/review.test.md`, content: reviewTestMd },
		{ path: `${p}/ready.test.md`, content: readyTestMd },
		{ path: `${p}/token-report.ps1`, content: tokenReportPs1 },
		{ path: `${p}/create-mr.ps1`, content: createMrPs1 },
		{ path: ".claude/mcp-coder.json", content: `${JSON.stringify(mcpCoderJson, null, 2)}\n` },
		{ path: ".claude/mcp-reviewer.json", content: `${JSON.stringify(mcpReviewerJson, null, 2)}\n` },
	];
}
