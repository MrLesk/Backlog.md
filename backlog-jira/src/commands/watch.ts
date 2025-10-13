import { sync } from "./sync.ts";
import { logger } from "../utils/logger.ts";

/**
 * Parse interval string like "60s", "5m", "1h" into milliseconds
 */
function parseInterval(interval: string): number {
	const match = interval.match(/^(\d+)([smh])$/);
	if (!match) {
		throw new Error(`Invalid interval format: ${interval}. Use format like 60s, 5m, 1h`);
	}

	const value = Number.parseInt(match[1], 10);
	const unit = match[2];

	const multipliers = {
		s: 1000,
		m: 60 * 1000,
		h: 60 * 60 * 1000,
	};

	return value * multipliers[unit as keyof typeof multipliers];
}

interface WatchOptions {
	interval?: string;
	strategy?: "prefer-backlog" | "prefer-jira" | "prompt" | "manual";
	stopOnError?: boolean;
}

interface WatchStats {
	cycles: number;
	lastSync: Date | null;
	totalSynced: number;
	totalConflicts: number;
	totalErrors: number;
	consecutiveErrors: number;
}

/**
 * Exponential backoff calculator
 */
function calculateBackoff(attemptNumber: number, baseDelay: number): number {
	const maxDelay = 5 * 60 * 1000; // 5 minutes max
	const delay = Math.min(baseDelay * Math.pow(2, attemptNumber), maxDelay);
	return delay;
}

/**
 * Watch mode: continuously poll and sync changes
 */
export async function watch(options: WatchOptions = {}): Promise<void> {
	const intervalMs = parseInterval(options.interval || "60s");
	const strategy = options.strategy || "prefer-backlog";
	const stopOnError = options.stopOnError ?? false;

	logger.info(`Starting watch mode (interval: ${options.interval || "60s"}, strategy: ${strategy})`);
	logger.info("Press Ctrl+C to stop\n");

	const stats: WatchStats = {
		cycles: 0,
		lastSync: null,
		totalSynced: 0,
		totalConflicts: 0,
		totalErrors: 0,
		consecutiveErrors: 0,
	};

	let running = true;
	let backoffAttempt = 0;

	// Handle graceful shutdown
	process.on("SIGINT", () => {
		logger.info("\n\nShutting down watch mode...");
		logger.info(
			`Stats: ${stats.cycles} cycles, ${stats.totalSynced} synced, ${stats.totalConflicts} conflicts, ${stats.totalErrors} errors`,
		);
		running = false;
		process.exit(0);
	});

	while (running) {
		stats.cycles++;
		const cycleStart = Date.now();

		try {
			logger.info(`[Cycle ${stats.cycles}] Checking for changes...`);

			// Run sync with --all flag
			const result = await sync({
				all: true,
				strategy,
				dryRun: false,
			});

			// Update stats
			stats.lastSync = new Date();
			stats.totalSynced += result.synced.length;
			stats.totalConflicts += result.conflicts.length;
			
			if (result.failed.length > 0) {
				stats.totalErrors += result.failed.length;
				stats.consecutiveErrors++;
				
				logger.warn(`Sync completed with ${result.failed.length} errors`);
				for (const fail of result.failed) {
					logger.error(`  ${fail.taskId}: ${fail.error}`);
				}

				// If we've had too many consecutive errors, apply backoff
				if (stats.consecutiveErrors >= 3) {
					const backoffDelay = calculateBackoff(backoffAttempt, 5000);
					logger.warn(`Multiple consecutive errors. Applying backoff: ${backoffDelay}ms`);
					await new Promise(resolve => setTimeout(resolve, backoffDelay));
					backoffAttempt++;
				}

				if (stopOnError) {
					logger.error("Stopping watch mode due to errors (--stop-on-error flag)");
					process.exit(1);
				}
			} else {
				// Reset consecutive error counter and backoff on success
				stats.consecutiveErrors = 0;
				backoffAttempt = 0;

				if (result.synced.length > 0 || result.conflicts.length > 0) {
					logger.info(`  Synced: ${result.synced.length}, Conflicts: ${result.conflicts.length}`);
				} else {
					logger.info("  No changes detected");
				}
			}

			if (result.conflicts.length > 0) {
				logger.warn("Conflicts detected:");
				for (const conflict of result.conflicts) {
					logger.warn(`  ${conflict.taskId}: ${conflict.resolution}`);
				}
			}

		} catch (error) {
			stats.totalErrors++;
			stats.consecutiveErrors++;
			
			const errorMsg = error instanceof Error ? error.message : String(error);
			logger.error(`Sync error: ${errorMsg}`);

			// Check if it's a rate limit error
			if (errorMsg.includes("rate limit") || errorMsg.includes("429") || errorMsg.includes("Too Many Requests")) {
				const backoffDelay = calculateBackoff(backoffAttempt, 30000); // Start with 30s for rate limits
				logger.warn(`Rate limit detected. Backing off for ${backoffDelay}ms`);
				await new Promise(resolve => setTimeout(resolve, backoffDelay));
				backoffAttempt++;
				continue; // Skip the regular interval wait
			}

			if (stopOnError) {
				logger.error("Stopping watch mode due to error");
				process.exit(1);
			}

			// Apply backoff for consecutive errors
			if (stats.consecutiveErrors >= 3) {
				const backoffDelay = calculateBackoff(backoffAttempt, 5000);
				logger.warn(`Multiple consecutive errors. Applying backoff: ${backoffDelay}ms`);
				await new Promise(resolve => setTimeout(resolve, backoffDelay));
				backoffAttempt++;
			}
		}

		// Wait for the specified interval before next cycle
		const cycleEnd = Date.now();
		const cycleDuration = cycleEnd - cycleStart;
		const waitTime = Math.max(0, intervalMs - cycleDuration);

		if (waitTime > 0) {
			await new Promise(resolve => setTimeout(resolve, waitTime));
		}
	}
}
