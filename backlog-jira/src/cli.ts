#!/usr/bin/env bun
import { Command } from "commander";
import { connectCommand } from "./commands/connect.ts";
import { doctorCommand } from "./commands/doctor.ts";
import { initCommand } from "./commands/init.ts";
import { registerMapCommand } from "./commands/map.ts";
import { pull } from "./commands/pull.ts";
import { push } from "./commands/push.ts";
import { registerStatusCommand } from "./commands/status.ts";
import { sync } from "./commands/sync.ts";
import { watch } from "./commands/watch.ts";

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

// Phase 3: Mapping and Status Commands
registerMapCommand(program);
registerStatusCommand(program);

program
	.command("push [taskIds...]")
	.description("Push Backlog changes to Jira")
	.option("--all", "Push all mapped tasks")
	.option("--force", "Force push even if conflicts detected")
	.option("--dry-run", "Show what would be pushed without making changes")
	.action(async (taskIds, options) => {
		try {
			const result = await push({
				taskIds: taskIds && taskIds.length > 0 ? taskIds : undefined,
				all: options.all,
				force: options.force,
				dryRun: options.dryRun,
			});
			console.log("\nPush Results:");
			console.log(`  Pushed: ${result.pushed.length}`);
			console.log(`  Failed: ${result.failed.length}`);
			console.log(`  Skipped: ${result.skipped.length}`);
			if (result.failed.length > 0) {
				console.log("\nFailures:");
				for (const fail of result.failed) {
					console.log(`  ${fail.taskId}: ${fail.error}`);
				}
				process.exit(1);
			}
		} catch (error) {
			console.error("Error:", error instanceof Error ? error.message : String(error));
			process.exit(1);
		}
	});

program
	.command("pull [taskIds...]")
	.description("Pull Jira changes to Backlog")
	.option("--all", "Pull all mapped tasks")
	.option("--force", "Force pull even if conflicts detected")
	.option("--dry-run", "Show what would be pulled without making changes")
	.action(async (taskIds, options) => {
		try {
			const result = await pull({
				taskIds: taskIds && taskIds.length > 0 ? taskIds : undefined,
				all: options.all,
				force: options.force,
				dryRun: options.dryRun,
			});
			console.log("\nPull Results:");
			console.log(`  Pulled: ${result.pulled.length}`);
			console.log(`  Failed: ${result.failed.length}`);
			console.log(`  Skipped: ${result.skipped.length}`);
			if (result.failed.length > 0) {
				console.log("\nFailures:");
				for (const fail of result.failed) {
					console.log(`  ${fail.taskId}: ${fail.error}`);
				}
				process.exit(1);
			}
		} catch (error) {
			console.error("Error:", error instanceof Error ? error.message : String(error));
			process.exit(1);
		}
	});

program
	.command("sync [taskIds...]")
	.description("Bidirectional sync with conflict resolution")
	.option("--all", "Sync all mapped tasks")
	.option("--strategy <strategy>", "Conflict resolution strategy: prefer-backlog|prefer-jira|prompt|manual")
	.option("--dry-run", "Show what would be synced without making changes")
	.action(async (taskIds, options) => {
		try {
			const result = await sync({
				taskIds: taskIds && taskIds.length > 0 ? taskIds : undefined,
				all: options.all,
				strategy: options.strategy,
				dryRun: options.dryRun,
			});
			console.log("\nSync Results:");
			console.log(`  Synced: ${result.synced.length}`);
			console.log(`  Conflicts: ${result.conflicts.length}`);
			console.log(`  Failed: ${result.failed.length}`);
			console.log(`  Skipped: ${result.skipped.length}`);
			if (result.conflicts.length > 0) {
				console.log("\nConflicts:");
				for (const conflict of result.conflicts) {
					console.log(`  ${conflict.taskId}: ${conflict.resolution}`);
				}
			}
			if (result.failed.length > 0) {
				console.log("\nFailures:");
				for (const fail of result.failed) {
					console.log(`  ${fail.taskId}: ${fail.error}`);
				}
				process.exit(1);
			}
		} catch (error) {
			console.error("Error:", error instanceof Error ? error.message : String(error));
			process.exit(1);
		}
	});

program
	.command("watch")
	.description("Watch for changes and auto-sync")
	.option("--interval <interval>", "Polling interval (e.g., 60s, 5m)", "60s")
	.option("--strategy <strategy>", "Conflict resolution strategy: prefer-backlog|prefer-jira|prompt|manual", "prefer-backlog")
	.option("--stop-on-error", "Stop watch mode if an error occurs")
	.action(async (options) => {
		try {
			await watch({
				interval: options.interval,
				strategy: options.strategy,
				stopOnError: options.stopOnError,
			});
		} catch (error) {
			console.error("Error:", error instanceof Error ? error.message : String(error));
			process.exit(1);
		}
	});

program.parse();
