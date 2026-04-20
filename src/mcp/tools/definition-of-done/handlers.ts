import type { Core } from "../../../core/backlog.ts";
import { BacklogToolError } from "../../errors/mcp-errors.ts";
import type { McpServer } from "../../server.ts";
import type { CallToolResult } from "../../types.ts";

export type DefinitionOfDoneDefaultsUpsertArgs = {
	project?: string;
	items: string[];
};

function normalizeDefinitionOfDoneDefaults(items: string[]): string[] {
	return items.map((item) => item.trim()).filter((item) => item.length > 0);
}

function findDelimiterSensitiveItem(items: string[]): string | undefined {
	return items.find((item) => item.includes(","));
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

	private async resolveCore(project?: string): Promise<Core> {
		return await this.core.getCoreForToolCall(project);
	}

	private async loadConfigOrThrow(core: Core) {
		const config = await core.filesystem.loadConfig();
		if (!config) {
			throw new BacklogToolError("Backlog config not found. Initialize Backlog.md first.", "NOT_FOUND");
		}
		return config;
	}

	async getDefaults(args: { project?: string } = {}): Promise<CallToolResult> {
		const core = await this.resolveCore(args.project);
		const config = await this.loadConfigOrThrow(core);
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
		const core = await this.resolveCore(args.project);
		const config = await this.loadConfigOrThrow(core);
		const nextDefaults = normalizeDefinitionOfDoneDefaults(args.items);
		const commaSensitiveItem = findDelimiterSensitiveItem(nextDefaults);
		if (commaSensitiveItem) {
			throw new BacklogToolError(
				`Definition of Done defaults cannot contain commas (invalid item: "${commaSensitiveItem}").`,
				"VALIDATION_ERROR",
			);
		}

		await core.filesystem.saveConfig({
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
