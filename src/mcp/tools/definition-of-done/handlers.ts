import { McpError } from "../../errors/mcp-errors.ts";
import type { McpServer } from "../../server.ts";
import type { CallToolResult } from "../../types.ts";

export type DefinitionOfDoneDefaultsUpsertArgs = {
	items: string[];
};

function normalizeDefinitionOfDoneDefaults(items: string[]): string[] {
	return items.map((item) => item.trim()).filter((item) => item.length > 0);
}

function formatDefinitionOfDoneDefaults(items: string[]): string {
	if (items.length === 0) {
		return "Project Definition of Done defaults (0):\n  (none)";
	}

	return `Project Definition of Done defaults (${items.length}):\n${items
		.map((item, index) => `  ${index + 1}. ${item}`)
		.join("\n")}`;
}

export class DefinitionOfDoneHandlers {
	constructor(private readonly core: McpServer) {}

	private async loadConfigOrThrow() {
		const config = await this.core.filesystem.loadConfig();
		if (!config) {
			throw new McpError("Backlog config not found. Initialize Backlog.md first.", "NOT_FOUND");
		}
		return config;
	}

	async getDefaults(): Promise<CallToolResult> {
		const config = await this.loadConfigOrThrow();
		const defaults = Array.isArray(config.definitionOfDone)
			? normalizeDefinitionOfDoneDefaults(config.definitionOfDone)
			: [];

		return {
			content: [
				{
					type: "text",
					text: formatDefinitionOfDoneDefaults(defaults),
				},
			],
		};
	}

	async upsertDefaults(args: DefinitionOfDoneDefaultsUpsertArgs): Promise<CallToolResult> {
		const config = await this.loadConfigOrThrow();
		const nextDefaults = normalizeDefinitionOfDoneDefaults(args.items);

		await this.core.filesystem.saveConfig({
			...config,
			definitionOfDone: nextDefaults,
		});

		return {
			content: [
				{
					type: "text",
					text: `Updated project Definition of Done defaults.\n\n${formatDefinitionOfDoneDefaults(nextDefaults)}`,
				},
			],
		};
	}
}
