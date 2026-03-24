/**
 * Ensures DB is initialized. Called at the top of each API route.
 * Uses a module-level promise so it only runs once per process.
 */
import { runMigrations } from "./migrate";

let initPromise: Promise<void> | null = null;

export function ensureDbInit(): Promise<void> {
	if (!initPromise) {
		initPromise = runMigrations().catch((err) => {
			console.error("DB init failed:", err);
			initPromise = null; // Allow retry on next request
			throw err;
		});
	}
	return initPromise;
}
