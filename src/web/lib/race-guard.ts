/**
 * Monotonic generation gate used to discard out-of-order async results.
 *
 * Each call to {@link next} bumps the internal counter and returns a token
 * for the caller to capture. After the async work resolves, {@link isCurrent}
 * tells the caller whether their token still represents the latest invocation;
 * if not, the result is stale and should be discarded rather than applied to
 * shared state.
 *
 * This is the mechanism that prevents an older `tasks-updated` refresh from
 * overwriting a fresher one when WebSocket broadcasts arrive back-to-back and
 * the HTTP fetches resolve out of order.
 */
export interface GenerationGate {
	next(): number;
	isCurrent(token: number): boolean;
}

export function createGenerationGate(): GenerationGate {
	let current = 0;
	return {
		next() {
			current += 1;
			return current;
		},
		isCurrent(token) {
			return token === current;
		},
	};
}

/**
 * Tracks an "is the spinner currently shown by *this* caller" flag so that the
 * caller's finally clause can release the spinner without depending on the
 * race-discard gate. The bug this defends against: a foreground refresh (with
 * `show: true`) that turns the spinner on, then gets superseded by a faster
 * background refresh before its fetches return; if the foreground caller
 * skipped its `setLoading(false)` because it was no longer the latest
 * generation, and the background caller skipped it because `show` was false,
 * the spinner would stay on forever.
 *
 * The helper makes the cleanup unconditional on caller-side staleness while
 * still respecting the caller's `show` decision.
 */
export interface SpinnerTracker {
	/** Call from `finally`. Idempotent. */
	release(): void;
}

export function trackSpinner(opts: { show: boolean; setLoading: (loading: boolean) => void }): SpinnerTracker {
	let enabled = false;
	if (opts.show) {
		enabled = true;
		opts.setLoading(true);
	}
	return {
		release() {
			if (enabled) {
				enabled = false;
				opts.setLoading(false);
			}
		},
	};
}
