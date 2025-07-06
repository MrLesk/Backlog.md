import type { BacklogConfig } from "../types/index.ts";

/**
 * Migrates config to ensure all required fields exist with default values
 */
export function migrateConfig(config: Partial<BacklogConfig>): BacklogConfig {
	const defaultConfig: BacklogConfig = {
		projectName: "Untitled Project",
		defaultEditor: "",
		defaultStatus: "",
		statuses: ["To Do", "In Progress", "Done"],
		labels: [],
		milestones: [],
		dateFormat: "YYYY-MM-DD",
		maxColumnWidth: 80,
		backlogDirectory: "backlog",
		autoOpenBrowser: true,
		defaultPort: 6420,
	};

	// Merge provided config with defaults, ensuring all fields exist
	const migratedConfig: BacklogConfig = {
		...defaultConfig,
		...config,
	};

	// Ensure arrays are not undefined
	migratedConfig.statuses = config.statuses || defaultConfig.statuses;
	migratedConfig.labels = config.labels || defaultConfig.labels;
	migratedConfig.milestones = config.milestones || defaultConfig.milestones;

	return migratedConfig;
}

/**
 * Checks if config needs migration (missing any expected fields)
 */
export function needsMigration(config: Partial<BacklogConfig>): boolean {
	// Check for all expected fields including new ones
	const expectedFields = ["projectName", "statuses", "backlogDirectory", "defaultPort", "autoOpenBrowser"];

	return expectedFields.some((field) => !(field in config));
}
