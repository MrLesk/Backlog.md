import { describe, expect, it } from "bun:test";
import { getAgent, loadAgents } from "../mcp/agents/loader.ts";

describe("MCP Agent Loader", () => {
	it("should load all agent JSON files from directory", () => {
		const agents = loadAgents();

		expect(agents).toBeArray();
		expect(agents.length).toBeGreaterThanOrEqual(3); // Claude, Codex, Gemini
	});

	it("should parse CLI agent configuration correctly", () => {
		const claude = getAgent("claude-code");

		expect(claude).toBeDefined();
		expect(claude?.name).toBe("Claude Code");
		expect(claude?.type).toBe("cli");
		expect(claude?.command).toBeDefined();
		expect(claude?.command?.example).toContain("claude mcp add");
		expect(claude?.setup.documentation).toContain("https://");
	});

	it("should parse manual config agent correctly", () => {
		const codex = getAgent("codex");

		expect(codex).toBeDefined();
		expect(codex?.name).toBe("OpenAI Codex CLI");
		expect(codex?.type).toBe("manual");
		expect(codex?.config).toBeDefined();
		expect(codex?.config?.location).toContain("~/.codex/");
		expect(codex?.config?.format).toBe("toml");
		expect(codex?.config?.example).toContain("[mcp_servers.backlog]");
	});

	it("should return undefined for non-existent agent", () => {
		const nonExistent = getAgent("non-existent-agent");
		expect(nonExistent).toBeUndefined();
	});

	it("should sort agents alphabetically by name", () => {
		const agents = loadAgents();
		const names = agents.map((a) => a.name);
		const sorted = [...names].sort();

		expect(names).toEqual(sorted);
	});

	it("should have required fields for all agents", () => {
		const agents = loadAgents();

		for (const agent of agents) {
			expect(agent.name).toBeTruthy();
			expect(agent.slug).toBeTruthy();
			expect(agent.type).toBeOneOf(["cli", "manual"]);
			expect(agent.setup).toBeDefined();
			expect(agent.setup.documentation).toContain("https://");
			expect(agent.testing).toBeArray();
			expect(agent.testing.length).toBeGreaterThan(0);
		}
	});

	it("should have command for CLI agents", () => {
		const agents = loadAgents().filter((a) => a.type === "cli");

		for (const agent of agents) {
			expect(agent.command).toBeDefined();
			expect(agent.command?.template).toBeTruthy();
			expect(agent.command?.example).toBeTruthy();
		}
	});

	it("should have config for manual agents", () => {
		const agents = loadAgents().filter((a) => a.type === "manual");

		for (const agent of agents) {
			expect(agent.config).toBeDefined();
			expect(agent.config?.location).toBeTruthy();
			expect(agent.config?.format).toBeOneOf(["json", "toml", "yaml"]);
			expect(agent.config?.example).toBeTruthy();
		}
	});
});
