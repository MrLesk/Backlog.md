import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import lockfile from "proper-lockfile";

/**
 * Acquires a project-scoped lock that grants the holder permission to run the
 * file watcher. The contract: at most one process per project owns this lock
 * at any time, regardless of entry point (`backlog browser`, `backlog watch`,
 * future watcher consumers).
 *
 * Lockfile location is `<backlogDir>/.locks/watcher`, mirroring the existing
 * `<backlogDir>/.locks/create` convention so projects using `backlog/`,
 * `.backlog/`, or a custom `backlogDirectory` setting all resolve consistently.
 *
 * Stale-lock recovery is delegated to `proper-lockfile`'s built-in heartbeat:
 * the holder maintains the lock by touching the directory's mtime every
 * `update` ms, and any acquirer treating a lock as stale after `stale` ms
 * without an update can take it over. This handles ungraceful exits (Ctrl-C
 * with cleanup bypassed, process crash, hard kill) without leaving a project
 * unable to watch ever again.
 */
export interface WatcherLockHolder {
	release(): Promise<void>;
}

export interface AcquireWatcherLockOptions {
	/**
	 * Maximum age (ms) of a lock without a heartbeat update before it is
	 * considered stale and may be taken over. Default 10 s.
	 */
	staleMs?: number;
	/**
	 * Heartbeat update interval (ms). Must be less than `staleMs`. Default
	 * 2.5 s, matching `proper-lockfile`'s recommended ratio.
	 */
	updateMs?: number;
}

const DEFAULT_STALE_MS = 10_000;
const DEFAULT_UPDATE_MS = 2_500;

/**
 * Attempts to acquire the watcher lock for the given backlog directory.
 *
 * @returns A {@link WatcherLockHolder} with a `release` function on success,
 * or `null` when another process currently holds the lock. Throws only for
 * unexpected filesystem errors (mkdir failure, etc.).
 */
export async function acquireWatcherLock(
	backlogDir: string,
	options: AcquireWatcherLockOptions = {},
): Promise<WatcherLockHolder | null> {
	const staleMs = options.staleMs ?? DEFAULT_STALE_MS;
	const updateMs = options.updateMs ?? DEFAULT_UPDATE_MS;

	const locksDir = join(backlogDir, ".locks");
	const lockDir = join(locksDir, "watcher");
	await mkdir(locksDir, { recursive: true });

	let release: (() => Promise<void>) | undefined;
	try {
		release = await lockfile.lock(backlogDir, {
			lockfilePath: lockDir,
			realpath: true,
			stale: staleMs,
			update: updateMs,
			// retries: 0 — we want immediate "yes or no". If another process
			// holds it, the caller will pass enableWatchers: false to Core
			// and rely on the lockholder to drive the watcher.
			retries: 0,
		});
	} catch (error) {
		if (isLockHeldByAnotherProcess(error)) {
			return null;
		}
		throw error;
	}

	return {
		async release() {
			try {
				await release?.();
			} catch {
				// Release is best-effort on shutdown — a stale lock will be
				// recovered automatically by the next acquirer via the
				// heartbeat-based staleness check.
			}
		},
	};
}

function isLockHeldByAnotherProcess(error: unknown): boolean {
	// proper-lockfile throws errors with `code` ELOCKED when contention is
	// detected. The error from `Error.code` is the documented contract.
	if (typeof error !== "object" || error === null) return false;
	const code = (error as { code?: unknown }).code;
	return code === "ELOCKED";
}
