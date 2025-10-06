import type { McpServer } from "../server.ts";
import type { CallToolResult, McpToolHandler } from "../types.ts";
import { createSimpleValidatedTool } from "../validation/tool-wrapper.ts";
import type { JsonSchema } from "../validation/validators.ts";

/**
 * Helper function to format config_set operation results as markdown
 */
function formatConfigSetMarkdown(key: string, value: unknown): string {
	const lines = ["# Configuration Update", ""];

	lines.push(`✅ Successfully updated **${key}**`);
	lines.push("");

	// Format the value based on its type
	let formattedValue: string;
	if (typeof value === "object" && value !== null) {
		formattedValue = `\`\`\`json\n${JSON.stringify(value, null, 2)}\n\`\`\``;
		lines.push(`**New value:**\n${formattedValue}`);
	} else {
		formattedValue = String(value);
		lines.push(`**New value:** ${formattedValue}`);
	}

	lines.push("");
	lines.push("Configuration saved successfully.");

	return lines.join("\n");
}

/**
 * Helper function to format config_get results as markdown
 */
function formatConfigGetMarkdown(config: unknown, key?: string): string {
	const lines = ["# Configuration", ""];

	if (key) {
		// Single config value
		lines.push(`**${key}:**`);
		if (typeof config === "object" && config !== null) {
			lines.push("```json");
			lines.push(JSON.stringify(config, null, 2));
			lines.push("```");
		} else {
			lines.push(`\`${String(config)}\``);
		}
	} else {
		// Full config object
		if (typeof config === "object" && config !== null) {
			const configObj = config as Record<string, unknown>;

			lines.push("| Setting | Value |");
			lines.push("|---------|-------|");

			for (const [configKey, configValue] of Object.entries(configObj)) {
				let displayValue: string;
				if (Array.isArray(configValue)) {
					displayValue = `[${configValue.join(", ")}]`;
				} else if (typeof configValue === "object" && configValue !== null) {
					displayValue = JSON.stringify(configValue);
				} else {
					displayValue = String(configValue);
				}

				// Escape pipes in values for markdown table
				displayValue = displayValue.replace(/\|/g, "\\|");
				lines.push(`| ${configKey} | \`${displayValue}\` |`);
			}
		} else {
			lines.push("```json");
			lines.push(JSON.stringify(config, null, 2));
			lines.push("```");
		}
	}

	return lines.join("\n");
}

export class ConfigToolHandlers {
	constructor(private server: McpServer) {}

	async getConfig(args: { key?: string }): Promise<CallToolResult> {
		try {
			const config = await this.server.filesystem.loadConfig();

			if (!config) {
				return {
					content: [
						{
							type: "text" as const,
							text: "No backlog project found. Initialize one first with 'backlog init'",
						},
					],
				};
			}

			// If no key specified, return full config
			if (!args.key) {
				return {
					content: [
						{
							type: "text" as const,
							text: formatConfigGetMarkdown(config),
						},
					],
				};
			}

			// Handle specific config keys
			const key = args.key;
			let value: unknown;

			switch (key) {
				case "defaultEditor":
					value = config.defaultEditor || null;
					break;
				case "projectName":
					value = config.projectName;
					break;
				case "defaultStatus":
					value = config.defaultStatus || null;
					break;
				case "statuses":
					value = config.statuses;
					break;
				case "labels":
					value = config.labels;
					break;
				case "milestones":
					value = config.milestones;
					break;
				case "dateFormat":
					value = config.dateFormat;
					break;
				case "maxColumnWidth":
					value = config.maxColumnWidth || null;
					break;
				case "defaultPort":
					value = config.defaultPort || null;
					break;
				case "autoOpenBrowser":
					value = config.autoOpenBrowser ?? null;
					break;
				case "remoteOperations":
					value = config.remoteOperations ?? null;
					break;
				case "autoCommit":
					value = config.autoCommit ?? null;
					break;
				case "bypassGitHooks":
					value = config.bypassGitHooks ?? null;
					break;
				case "zeroPaddedIds":
					value = config.zeroPaddedIds || null;
					break;
				case "checkActiveBranches":
					value = config.checkActiveBranches ?? true;
					break;
				case "activeBranchDays":
					value = config.activeBranchDays ?? 30;
					break;
				case "timezonePreference":
					value = config.timezonePreference || null;
					break;
				case "includeDateTimeInDates":
					value = config.includeDateTimeInDates ?? null;
					break;
				default:
					return {
						content: [
							{
								type: "text" as const,
								text: `Unknown config key: ${key}. Available keys: defaultEditor, projectName, defaultStatus, statuses, labels, milestones, dateFormat, maxColumnWidth, defaultPort, autoOpenBrowser, remoteOperations, autoCommit, bypassGitHooks, zeroPaddedIds, checkActiveBranches, activeBranchDays, timezonePreference, includeDateTimeInDates`,
							},
						],
					};
			}

			return {
				content: [
					{
						type: "text" as const,
						text: formatConfigGetMarkdown(value, key),
					},
				],
			};
		} catch (error) {
			return {
				content: [
					{
						type: "text" as const,
						text: `Error retrieving config: ${error instanceof Error ? error.message : "Unknown error occurred"}`,
					},
				],
			};
		}
	}

	async setConfig(args: { key: string; value: unknown }): Promise<CallToolResult> {
		try {
			const config = await this.server.filesystem.loadConfig();

			if (!config) {
				return {
					content: [
						{
							type: "text" as const,
							text: "No backlog project found. Initialize one first with 'backlog init'",
						},
					],
				};
			}

			const { key, value } = args;
			const updatedConfig = { ...config };

			// Validate and set specific config keys
			switch (key) {
				case "defaultEditor": {
					if (typeof value !== "string") {
						return {
							content: [
								{
									type: "text" as const,
									text: "defaultEditor must be a string",
								},
							],
						};
					}
					updatedConfig.defaultEditor = value;
					break;
				}
				case "projectName": {
					if (typeof value !== "string" || value.trim() === "") {
						return {
							content: [
								{
									type: "text" as const,
									text: "projectName must be a non-empty string",
								},
							],
						};
					}
					updatedConfig.projectName = value.trim();
					break;
				}
				case "defaultStatus": {
					if (typeof value !== "string") {
						return {
							content: [
								{
									type: "text" as const,
									text: "defaultStatus must be a string",
								},
							],
						};
					}
					// Validate that the status exists in configured statuses
					const statusExists = config.statuses.some((s) => s.toLowerCase() === value.toLowerCase());
					if (value.trim() && !statusExists) {
						return {
							content: [
								{
									type: "text" as const,
									text: `Status '${value}' not found in configured statuses: [${config.statuses.join(", ")}]`,
								},
							],
						};
					}
					updatedConfig.defaultStatus = value.trim() || undefined;
					break;
				}
				case "statuses": {
					if (!Array.isArray(value) || !value.every((v) => typeof v === "string")) {
						return {
							content: [
								{
									type: "text" as const,
									text: "statuses must be an array of strings",
								},
							],
						};
					}
					const validStatuses = value.filter((s) => s.trim());
					if (validStatuses.length === 0) {
						return {
							content: [
								{
									type: "text" as const,
									text: "At least one status must be provided",
								},
							],
						};
					}
					updatedConfig.statuses = validStatuses.map((s) => s.trim());
					break;
				}
				case "labels": {
					if (!Array.isArray(value) || !value.every((v) => typeof v === "string")) {
						return {
							content: [
								{
									type: "text" as const,
									text: "labels must be an array of strings",
								},
							],
						};
					}
					updatedConfig.labels = value.map((l) => l.trim()).filter((l) => l);
					break;
				}
				case "milestones": {
					if (!Array.isArray(value) || !value.every((v) => typeof v === "string")) {
						return {
							content: [
								{
									type: "text" as const,
									text: "milestones must be an array of strings",
								},
							],
						};
					}
					updatedConfig.milestones = value.map((m) => m.trim()).filter((m) => m);
					break;
				}
				case "dateFormat": {
					if (typeof value !== "string" || value.trim() === "") {
						return {
							content: [
								{
									type: "text" as const,
									text: "dateFormat must be a non-empty string",
								},
							],
						};
					}
					updatedConfig.dateFormat = value.trim();
					break;
				}
				case "maxColumnWidth": {
					const num = Number(value);
					if (!Number.isInteger(num) || num <= 0) {
						return {
							content: [
								{
									type: "text" as const,
									text: "maxColumnWidth must be a positive integer",
								},
							],
						};
					}
					updatedConfig.maxColumnWidth = num;
					break;
				}
				case "defaultPort": {
					const num = Number(value);
					if (!Number.isInteger(num) || num < 1 || num > 65535) {
						return {
							content: [
								{
									type: "text" as const,
									text: "defaultPort must be an integer between 1 and 65535",
								},
							],
						};
					}
					updatedConfig.defaultPort = num;
					break;
				}
				case "autoOpenBrowser":
				case "remoteOperations":
				case "autoCommit":
				case "bypassGitHooks":
				case "checkActiveBranches":
				case "includeDateTimeInDates": {
					if (typeof value !== "boolean") {
						return {
							content: [
								{
									type: "text" as const,
									text: `${key} must be a boolean value`,
								},
							],
						};
					}
					(updatedConfig as Record<string, unknown>)[key] = value;
					break;
				}
				case "zeroPaddedIds": {
					const num = Number(value);
					if (!Number.isInteger(num) || num < 0) {
						return {
							content: [
								{
									type: "text" as const,
									text: "zeroPaddedIds must be a non-negative integer (0 to disable)",
								},
							],
						};
					}
					updatedConfig.zeroPaddedIds = num === 0 ? undefined : num;
					break;
				}
				case "activeBranchDays": {
					const num = Number(value);
					if (!Number.isInteger(num) || num < 1) {
						return {
							content: [
								{
									type: "text" as const,
									text: "activeBranchDays must be a positive integer",
								},
							],
						};
					}
					updatedConfig.activeBranchDays = num;
					break;
				}
				case "timezonePreference": {
					if (typeof value !== "string") {
						return {
							content: [
								{
									type: "text" as const,
									text: "timezonePreference must be a string",
								},
							],
						};
					}
					updatedConfig.timezonePreference = value.trim() || undefined;
					break;
				}
				default:
					return {
						content: [
							{
								type: "text" as const,
								text: `Unknown config key: ${key}. Available keys: defaultEditor, projectName, defaultStatus, statuses, labels, milestones, dateFormat, maxColumnWidth, defaultPort, autoOpenBrowser, remoteOperations, autoCommit, bypassGitHooks, zeroPaddedIds, checkActiveBranches, activeBranchDays, timezonePreference, includeDateTimeInDates`,
							},
						],
					};
			}

			// Save the updated config
			await this.server.filesystem.saveConfig(updatedConfig);

			return {
				content: [
					{
						type: "text" as const,
						text: formatConfigSetMarkdown(key, (updatedConfig as Record<string, unknown>)[key]),
					},
				],
			};
		} catch (error) {
			return {
				content: [
					{
						type: "text" as const,
						text: `Error updating config: ${error instanceof Error ? error.message : "Unknown error occurred"}`,
					},
				],
			};
		}
	}
}

const configGetSchema: JsonSchema = {
	type: "object",
	properties: {
		key: {
			type: "string",
			maxLength: 100,
		},
	},
	required: [],
};

const configSetSchema: JsonSchema = {
	type: "object",
	properties: {
		key: {
			type: "string",
			minLength: 1,
			maxLength: 100,
		},
		value: {}, // Can be any type - will be validated by the handler
	},
	required: ["key", "value"],
};

const createConfigGetTool = (handlers: ConfigToolHandlers): McpToolHandler =>
	createSimpleValidatedTool(
		{
			name: "config_get",
			description: "Retrieve configuration values (returns all config if no key specified)",
			inputSchema: configGetSchema,
		},
		configGetSchema,
		async (input, _context) => {
			return handlers.getConfig({
				key: input.key as string,
			});
		},
	);

const createConfigSetTool = (handlers: ConfigToolHandlers): McpToolHandler =>
	createSimpleValidatedTool(
		{
			name: "config_set",
			description: "Update configuration values with validation",
			inputSchema: configSetSchema,
		},
		configSetSchema,
		async (input, _context) => {
			return handlers.setConfig({
				key: input.key as string,
				value: input.value,
			});
		},
	);

export function registerConfigTools(server: McpServer): void {
	const handlers = new ConfigToolHandlers(server);
	server.addTool(createConfigGetTool(handlers));
	server.addTool(createConfigSetTool(handlers));
}

export { createConfigGetTool, createConfigSetTool, configGetSchema, configSetSchema };
