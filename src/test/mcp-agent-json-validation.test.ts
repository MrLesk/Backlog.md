import { describe, expect, it } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

describe("MCP Agent JSON Validation", () => {
	const agentsDir = join(process.cwd(), "src", "mcp", "agents");
	const jsonFiles = readdirSync(agentsDir).filter((f) => f.endsWith(".json"));

	it("should have at least 3 agent JSON files", () => {
		expect(jsonFiles.length).toBeGreaterThanOrEqual(3);
	});

	for (const file of jsonFiles) {
		describe(`Agent: ${file}`, () => {
			// biome-ignore lint/suspicious/noExplicitAny: test file parsing JSON schemas
			let agent: any;

			it("should be valid JSON", () => {
				const content = readFileSync(join(agentsDir, file), "utf8");
				expect(() => {
					agent = JSON.parse(content);
				}).not.toThrow();
			});

			it("should have required fields", () => {
				const content = readFileSync(join(agentsDir, file), "utf8");
				agent = JSON.parse(content);

				expect(agent.name).toBeTruthy();
				expect(agent.slug).toBeTruthy();
				expect(agent.type).toBeOneOf(["cli", "manual"]);
				expect(agent.setup).toBeDefined();
				expect(agent.testing).toBeArray();
			});

			it("should have valid setup configuration", () => {
				const content = readFileSync(join(agentsDir, file), "utf8");
				agent = JSON.parse(content);

				expect(agent.setup.install_url).toBeTruthy();
				expect(agent.setup.install_url).toContain("http");
				expect(agent.setup.verify_command).toBeTruthy();
				expect(agent.setup.documentation).toBeTruthy();
				expect(agent.setup.documentation).toContain("http");
			});

			it("should have type-specific fields", () => {
				const content = readFileSync(join(agentsDir, file), "utf8");
				agent = JSON.parse(content);

				if (agent.type === "cli") {
					expect(agent.command).toBeDefined();
					expect(agent.command.template).toBeTruthy();
					expect(agent.command.example).toBeTruthy();
					expect(agent.command.example).toContain("backlog mcp start");
				} else if (agent.type === "manual") {
					expect(agent.config).toBeDefined();
					expect(agent.config.location).toBeTruthy();
					expect(agent.config.format).toBeOneOf(["json", "toml", "yaml"]);
					expect(agent.config.example).toBeTruthy();
				}
			});

			it("should have testing instructions", () => {
				const content = readFileSync(join(agentsDir, file), "utf8");
				agent = JSON.parse(content);

				expect(agent.testing).toBeArray();
				expect(agent.testing.length).toBeGreaterThan(0);
			});

			it("should use correct slug format", () => {
				const content = readFileSync(join(agentsDir, file), "utf8");
				agent = JSON.parse(content);

				// Slug should be lowercase, hyphen-separated
				expect(agent.slug).toMatch(/^[a-z0-9-]+$/);

				// Filename should match slug pattern
				expect(file).toMatch(new RegExp(`${agent.slug}\\.json$`, "i"));
			});
		});
	}
});
