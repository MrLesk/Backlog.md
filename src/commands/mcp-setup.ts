import chalk from "chalk";
import type { AgentConfig } from "../mcp/agents/loader.ts";
import { loadAgents } from "../mcp/agents/loader.ts";

export async function setupMCP(): Promise<void> {
	const agents = loadAgents();

	console.log(`
${chalk.bold.cyan("Backlog.md MCP Setup")}
${chalk.dim("🔒 Local development only - see 'backlog mcp security' for details")}

${chalk.green("✓")} Step 1: backlog.md is installed

${chalk.bold("Step 2: Configure your AI agent")}
`);

	for (const agent of agents) {
		displayAgentInstructions(agent);
	}

	console.log(`
${chalk.dim("─".repeat(60))}

${chalk.bold("Step 3:")} Restart your AI agent

${chalk.bold("Step 4:")} Test
  ${chalk.italic('"Show me all tasks in this project"')}

${chalk.dim("Documentation: https://backlog.md/docs/mcp")}
  `);
}

function displayAgentInstructions(agent: AgentConfig): void {
	console.log(`${chalk.bold.yellow(`${agent.name}:`)}`);

	if (agent.type === "cli" && agent.command) {
		console.log(`  ${chalk.cyan(agent.command.example)}`);
	} else if (agent.type === "manual" && agent.config) {
		console.log(`  ${chalk.yellow(`Edit ${agent.config.location}:`)}`);
		const lines = agent.config.example.split("\\n").filter((l) => l.trim());
		for (const line of lines) {
			console.log(`  ${chalk.dim(line)}`);
		}
	}

	// Always show documentation link
	if (agent.setup.documentation) {
		console.log(`  ${chalk.dim(agent.setup.documentation)}`);
	}

	console.log();
}
