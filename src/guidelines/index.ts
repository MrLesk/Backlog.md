import CURSOR_GUIDELINES from "./.cursorrules.md";
import AGENT_GUIDELINES from "./AGENTS.md";
import CLAUDE_GUIDELINES from "./CLAUDE.md";

const README_GUIDELINES = `## AI Agent Guidelines\n\n${AGENT_GUIDELINES.replace(/^#.*\n/, "")}`;

export { AGENT_GUIDELINES, CLAUDE_GUIDELINES, CURSOR_GUIDELINES, README_GUIDELINES };
