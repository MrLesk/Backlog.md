import agentGuidelinesContent from "./agent-guidelines.md" with { type: "text" };
import claudeAgentContent from "./project-manager-backlog.md" with { type: "text" };

export const AGENT_GUIDELINES = agentGuidelinesContent;
export const CLAUDE_GUIDELINES = agentGuidelinesContent;
export const CURSOR_GUIDELINES = agentGuidelinesContent;
export const GEMINI_GUIDELINES = agentGuidelinesContent;
export const COPILOT_GUIDELINES = agentGuidelinesContent;
export const README_GUIDELINES = `## AI Agent Guidelines\n\n${agentGuidelinesContent.replace(/^#.*\n/, "")}`;
export const CLAUDE_AGENT_CONTENT = claudeAgentContent;
