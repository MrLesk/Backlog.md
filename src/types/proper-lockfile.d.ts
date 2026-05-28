declare module "proper-lockfile" {
	interface RetryOptions {
		retries?: number;
		factor?: number;
		minTimeout?: number;
		maxTimeout?: number;
		randomize?: boolean;
	}

	interface LockOptions {
		stale?: number;
		update?: number | null;
		realpath?: boolean;
		retries?: number | RetryOptions;
		lockfilePath?: string;
		/**
		 * Called when the lock is compromised (e.g. the heartbeat fails to
		 * refresh the mtime within the stale threshold). proper-lockfile's
		 * DEFAULT implementation re-throws the error from inside a timer,
		 * which becomes an uncaught exception and crashes the process —
		 * always provide a non-throwing handler.
		 */
		onCompromised?: (err: Error) => void;
	}

	type ReleaseFn = () => Promise<void>;

	interface LockfileModule {
		(file: string, options?: LockOptions): Promise<ReleaseFn>;
		lock(file: string, options?: LockOptions): Promise<ReleaseFn>;
	}

	const lockfile: LockfileModule;
	export = lockfile;
}
