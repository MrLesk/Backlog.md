import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { SyncStore } from "../state/store.ts";
import { logger } from "../utils/logger.ts";

export interface JiraConfig {
	jira: {
		baseUrl: string;
		projectKey: string;
		issueType: string;
		jqlFilter: string;
	};
	backlog: {
		statusMapping: Record<string, string[]>;
	};
	sync: {
		conflictStrategy: "prompt" | "prefer-backlog" | "prefer-jira";
		enableAnnotations: boolean;
		watchInterval: number;
	};
}

export async function initCommand(): Promise<void> {
	const configDir = join(process.cwd(), ".backlog-jira");

	// Check if already initialized
	if (existsSync(configDir)) {
		logger.warn(".backlog-jira/ already exists. Use 'backlog-jira config' to modify settings.");
		return;
	}

	// Bootstrap directory structure
	mkdirSync(join(configDir, "logs"), { recursive: true });

	// Create default configuration
	const config: JiraConfig = {
		jira: {
			baseUrl: "",
			projectKey: "",
			issueType: "Task",
			jqlFilter: "",
		},
		backlog: {
			statusMapping: {
				"To Do": ["To Do", "Open", "Backlog"],
				"In Progress": ["In Progress"],
				Done: ["Done", "Closed", "Resolved"],
			},
		},
		sync: {
			conflictStrategy: "prompt",
			enableAnnotations: false,
			watchInterval: 60,
		},
	};

	const configPath = join(configDir, "config.json");
	writeFileSync(configPath, JSON.stringify(config, null, 2));

	// Initialize SQLite database
	const store = new SyncStore();
	store.close();

	// Create .gitignore
	const gitignorePath = join(configDir, ".gitignore");
	writeFileSync(
		gitignorePath,
		`# Ignore all files in .backlog-jira/
*
!.gitignore
`,
	);

	logger.info("✓ Initialized .backlog-jira/ configuration");
	logger.info(`  - Config: ${configPath}`);
	logger.info(`  - Database: ${join(configDir, "jira-sync.db")}`);
	logger.info(`  - Logs: ${join(configDir, "logs/")}`);
	logger.info("");
	logger.info("Next steps:");
	logger.info("  1. Edit .backlog-jira/config.json with your Jira project settings");
	logger.info("  2. Run 'backlog-jira connect' to verify connections");
	logger.info("  3. Run 'backlog-jira doctor' to check environment setup");
}
