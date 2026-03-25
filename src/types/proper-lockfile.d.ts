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
	}

	type ReleaseFn = () => Promise<void>;

	interface LockfileModule {
		(file: string, options?: LockOptions): Promise<ReleaseFn>;
		lock(file: string, options?: LockOptions): Promise<ReleaseFn>;
	}

	const lockfile: LockfileModule;
	export = lockfile;
}
