/**
 * Coordinates in-process task-file writes with the file watcher so the
 * status-change hook does not double-fire.
 *
 * Mechanism: every in-process write records the SHA-256 of the bytes it just
 * put on disk via {@link TaskWriteCoordinator.recordWrite}. When the file
 * watcher observes a change, it hashes the bytes it just read and asks
 * {@link TaskWriteCoordinator.consumeMatchingWrite}. A match means "the
 * watcher is seeing one of our own writes — suppress the hook"; no match
 * means "the on-disk content differs from anything we wrote — this is a
 * hand edit and the hook should fire". Once consumed, the recorded hash is
 * removed, so a subsequent independent edit with the same content (rare but
 * possible) is correctly treated as a hand edit on its second observation.
 *
 * The design is deterministic: there is no time-window heuristic. A hand
 * edit one millisecond after an in-process write with different content is
 * correctly detected, and a delayed `fs.watch` event arriving seconds later
 * still suppresses correctly as long as the on-disk bytes still match what
 * we wrote.
 *
 * Per-task LRU bound (default 8 entries) prevents unbounded growth if the
 * watcher misses events (e.g. fs.watch dropped them under load) or the
 * process exits without consuming.
 */

export interface TaskWriteCoordinator {
	/**
	 * Record the content hash of bytes we just wrote in-process. Subsequent
	 * watcher observations matching this hash will be suppressed.
	 */
	recordWrite(taskId: string, contentHash: string): void;
	/**
	 * If a pending in-process write with this exact hash exists, consume it
	 * and return true (caller should suppress its hook fire). Otherwise
	 * return false (caller should treat the event as an external edit).
	 */
	consumeMatchingWrite(taskId: string, contentHash: string): boolean;
	/** Clear all tracked writes. Used on project root swaps. */
	reset(): void;
}

export interface CoordinatorOptions {
	/**
	 * Maximum number of pending hashes to retain per task. When the cap is
	 * reached, the oldest entry is evicted on the next `recordWrite`. The
	 * default is large enough to cover any realistic in-flight burst from
	 * Backlog.md's UIs without growing unbounded if `fs.watch` drops events.
	 */
	maxPendingPerTask?: number;
}

const DEFAULT_MAX_PENDING_PER_TASK = 8;

export function createTaskWriteCoordinator(options: CoordinatorOptions = {}): TaskWriteCoordinator {
	const maxPending = Math.max(1, options.maxPendingPerTask ?? DEFAULT_MAX_PENDING_PER_TASK);

	// Per-task FIFO of pending content hashes. Insertion order is preserved
	// by Set iteration semantics, which is what we want for LRU eviction.
	const pending = new Map<string, Set<string>>();

	const ensure = (taskId: string): Set<string> => {
		let bucket = pending.get(taskId);
		if (!bucket) {
			bucket = new Set();
			pending.set(taskId, bucket);
		}
		return bucket;
	};

	return {
		recordWrite(taskId: string, contentHash: string): void {
			const bucket = ensure(taskId);
			// Re-recording the same hash should keep it as the freshest entry,
			// so delete-and-re-add to move it to the tail of the insertion
			// order.
			bucket.delete(contentHash);
			bucket.add(contentHash);
			while (bucket.size > maxPending) {
				const oldest = bucket.values().next().value;
				if (oldest === undefined) break;
				bucket.delete(oldest);
			}
		},

		consumeMatchingWrite(taskId: string, contentHash: string): boolean {
			const bucket = pending.get(taskId);
			if (!bucket) return false;
			if (!bucket.delete(contentHash)) return false;
			if (bucket.size === 0) pending.delete(taskId);
			return true;
		},

		reset(): void {
			pending.clear();
		},
	};
}

/**
 * Hash arbitrary string content for use with the coordinator. Uses Bun's
 * built-in SHA-256 via the WebCrypto API so call-sites don't pull in a
 * dedicated crypto dep.
 */
export async function hashTaskContent(content: string): Promise<string> {
	const bytes = new TextEncoder().encode(content);
	const digest = await crypto.subtle.digest("SHA-256", bytes);
	const view = new Uint8Array(digest);
	let out = "";
	for (let i = 0; i < view.length; i++) {
		out += (view[i] as number).toString(16).padStart(2, "0");
	}
	return out;
}
