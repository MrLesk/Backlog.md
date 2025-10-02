import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

export interface AgentConfig {
	name: string;
	slug: string;
	type: "cli" | "manual";
	command?: {
		template: string;
		example: string;
	};
	config?: {
		location?: string;
		format?: "json" | "toml" | "yaml";
		supports_project_scope?: boolean;
		template?: string;
		example: string;
	};
	setup: {
		install_url: string;
		verify_command: string;
		documentation: string;
	};
	testing: string[];
	notes?: string[];
}

export function loadAgents(): AgentConfig[] {
	const agentsDir = __dirname;
	const files = readdirSync(agentsDir).filter((f) => f.endsWith(".json"));

	return files
		.map((file) => {
			const content = readFileSync(join(agentsDir, file), "utf8");
			return JSON.parse(content) as AgentConfig;
		})
		.sort((a, b) => a.name.localeCompare(b.name));
}

export function getAgent(slug: string): AgentConfig | undefined {
	const agents = loadAgents();
	return agents.find((a) => a.slug === slug);
}
