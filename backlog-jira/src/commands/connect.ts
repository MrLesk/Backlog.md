import { BacklogClient } from "../integrations/backlog.ts";

import { JiraClient } from "../integrations/jira.ts";
import { logger } from "../utils/logger.ts";

export async function connectCommand(): Promise<void> {
	logger.info("Verifying connections...\n");

	const backlogClient = new BacklogClient();
	const jiraClient = new JiraClient();

	let allGood = true;

	// Test Backlog CLI
	try {
		const backlogOk = await backlogClient.test();
		if (backlogOk) {
			logger.info("  ✓ Backlog CLI connection successful");
		} else {
			logger.error("  ✗ Backlog CLI connection failed");
			allGood = false;
		}
	} catch (error) {
		logger.error({ error }, "  ✗ Backlog CLI connection failed");
		allGood = false;
	}

	// Test MCP Jira tools
	try {
		const jiraOk = await jiraClient.test();
		if (jiraOk) {
			logger.info("  ✓ MCP Atlassian connection successful");
		} else {
			logger.error("  ✗ MCP Atlassian connection failed");
			allGood = false;
		}
	} catch (error) {
		logger.error({ error }, "  ✗ MCP Atlassian connection failed");
		allGood = false;
	}

	if (allGood) {
		logger.info("\n✓ Connection verification complete - all systems operational");
		process.exit(0);
	} else {
		logger.error("\n✗ Connection verification failed - please check your configuration");
		process.exit(1);
	}
}
