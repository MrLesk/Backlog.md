import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import { join } from "node:path";

/**
 * Project-scoped watcher lock using a PID file instead of proper-lockfile's
 * mtime-based heartbeat. The heartbeat approach is unreliable on Windows:
 * the event loop is idle while an agent runs (minutes), the heartbeat timer
 * drifts, and proper-lockfile marks the lock as compromised.
 *
 * PID-based approach: write our PID to a file; any other acquirer checks
 * whether that PID is still alive. No heartbeat, no mtime, no drift.
 *
 * Lock file: <backlogDir>/.locks/watcher.pid
 */

export interface WatcherLockHolder {
	release(): Promise<void>;
	/** Always false for the PID-based lock (no heartbeat to compromise). */
	isCompromised(): boolean;
}

export interface AcquireWatcherLockOptions {
	/**
	 * Timeout (ms) to consider a PID file stale even when the PID appears
	 * alive but might be from a previous run that reused the PID. Defaults
	 * to 0 (disabled — trust the live-PID check fully). Only set this if
	 * you observe PID reuse causing false contention.
	 */
	staleMs?: number;
}

const isPidAlive = (pid: number): boolean => {
	try {
		// signal 0 = check existence without sending a signal.
		// Throws ESRCH if the process doesn't exist; throws EPERM if it does
		// but we don't have permission (process IS alive). Returns true
		// otherwise.
		process.kill(pid, 0);
		return true;
	} catch (err) {
		const code = (err as { code?: string }).code;
		if (code === "ESRCH") return false;
		// EPERM means the process exists but we can't signal it — still alive.
		if (code === "EPERM") return true;
		return false;
	}
};

export async function acquireWatcherLock(
	backlogDir: string,
	_options: AcquireWatcherLockOptions = {},
): Promise<WatcherLockHolder | null> {
	const locksDir = join(backlogDir, ".locks");
	const pidFile = join(locksDir, "watcher.pid");

	await mkdir(locksDir, { recursive: true });

	// Check for an existing holder.
	try {
		const content = await readFile(pidFile, "utf8");
		const existingPid = Number.parseInt(content.trim(), 10);
		if (!Number.isNaN(existingPid) && isPidAlive(existingPid)) {
			// Another live process holds the lock.
			return null;
		}
		// PID is dead — stale file, we can take over.
	} catch {
		// File doesn't exist yet — no holder.
	}

	// Write our PID atomically (best-effort on Windows; good enough for a
	// single-machine process lock).
	try {
		await writeFile(pidFile, String(process.pid), "utf8");
	} catch {
		return null;
	}

	// Verify we actually wrote our PID (guard against concurrent acquisition).
	try {
		const written = await readFile(pidFile, "utf8");
		if (Number.parseInt(written.trim(), 10) !== process.pid) {
			// Lost the race to another process.
			return null;
		}
	} catch {
		return null;
	}

	return {
		isCompromised() {
			return false;
		},
		async release() {
			try {
				// Only delete if we still own it.
				const content = await readFile(pidFile, "utf8");
				if (Number.parseInt(content.trim(), 10) === process.pid) {
					await unlink(pidFile);
				}
			} catch {
				// Already deleted or never existed — fine.
			}
		},
	};
}
