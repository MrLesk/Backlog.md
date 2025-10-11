#!/usr/bin/env bun
import { Command } from "commander";
import { connectCommand } from "./commands/connect.ts";
import { doctorCommand } from "./commands/doctor.ts";
import { initCommand } from "./commands/init.ts";

const program = new Command();

program.name("backlog-jira").description("Bidirectional sync plugin between Backlog.md and Jira").version("0.1.0");

program
	.command("init")
	.description("Initialize .backlog-jira/ configuration directory")
	.action(async () => {
		try {
			await initCommand();
		} catch (error) {
			console.error("Error:", error instanceof Error ? error.message : String(error));
			process.exit(1);
		}
	});

program
	.command("connect")
	.description("Verify connectivity to Backlog CLI and MCP Atlassian server")
	.action(async () => {
		try {
			await connectCommand();
		} catch (error) {
			console.error("Error:", error instanceof Error ? error.message : String(error));
			process.exit(1);
		}
	});

program
	.command("doctor")
	.description("Run environment health checks")
	.action(async () => {
		try {
			await doctorCommand();
		} catch (error) {
			console.error("Error:", error instanceof Error ? error.message : String(error));
			process.exit(1);
		}
	});

// Placeholder commands for future phases
program
	.command("map")
	.description("Map Backlog tasks to Jira issues (Phase 3)")
	.option("--auto", "Automatically map by title similarity")
	.option("--interactive", "Interactive mapping UI")
	.action(() => {
		console.log("Coming in Phase 3: Mapping and Status Commands");
	});

program
	.command("status")
	.description("Show sync status for mapped tasks (Phase 3)")
	.option("--json", "Output as JSON")
	.option("--grep <pattern>", "Filter by pattern")
	.action(() => {
		console.log("Coming in Phase 3: Mapping and Status Commands");
	});

program
	.command("push [taskId]")
	.description("Push Backlog changes to Jira (Phase 4)")
	.option("--all", "Push all mapped tasks")
	.action(() => {
		console.log("Coming in Phase 4: Push, Pull & Sync Commands");
	});

program
	.command("pull [taskId]")
	.description("Pull Jira changes to Backlog (Phase 4)")
	.option("--all", "Pull all mapped tasks")
	.action(() => {
		console.log("Coming in Phase 4: Push, Pull & Sync Commands");
	});

program
	.command("sync [taskId]")
	.description("Bidirectional sync with conflict resolution (Phase 4)")
	.option("--all", "Sync all mapped tasks")
	.option("--strategy <strategy>", "Conflict resolution strategy: prompt|prefer-backlog|prefer-jira")
	.action(() => {
		console.log("Coming in Phase 4: Push, Pull & Sync Commands");
	});

program
	.command("watch")
	.description("Watch for changes and auto-sync (Phase 5)")
	.option("--interval <interval>", "Polling interval (e.g., 60s, 5m)")
	.action(() => {
		console.log("Coming in Phase 5: Watch Mode & Advanced Features");
	});

program.parse();
