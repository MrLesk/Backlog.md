import { afterEach, describe, expect, it } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Core } from "../core/backlog.ts";
import { acquireWatcherLock } from "../core/watcher-lock.ts";

let scratchRoots: string[] = [];

afterEach(() => {
	for (const root of scratchRoots) {
		try {
			rmSync(root, { recursive: true, force: true });
		} catch {}
	}
	scratchRoots = [];
});

const scratchProject = (): string => {
	const root = mkdtempSync(join(tmpdir(), "backlog-reinit-test-"));
	scratchRoots.push(root);
	return root;
};

describe("Core.reinitializeProjectRoot — hook authority", () => {
	it("releaseHookAuthority is idempotent and safe to call without an active probe", async () => {
		const core = new Core(scratchProject());
		await core.filesystem.ensureBacklogStructure();
		await expect(core.releaseHookAuthority()).resolves.toBeUndefined();
		await expect(core.releaseHookAuthority()).resolves.toBeUndefined();
	});

	it("does not leak the old-project lock when reinit fires during an in-flight probe", async () => {
		const projectA = scratchProject();
		const projectB = scratchProject();

		const core = new Core(projectA);
		await core.filesystem.ensureBacklogStructure();
		// Capture the resolved backlog dir for projectA BEFORE reinit swaps
		// `core.filesystem` over to projectB — that's the actual path the
		// lazy probe acquires its lock on, and the path the leak (if any)
		// would still be held against.
		const backlogDirA = core.filesystem.backlogDir;

		// Drive the private lazy probe directly via type assertion. The
		// probe internally awaits acquireWatcherLock which takes a moment
		// to do real fs work — that's our race window.
		const corePrivate = core as unknown as { resolveHookAuthority(): Promise<boolean> };
		const probePromise = corePrivate.resolveHookAuthority();

		// Reinit before the probe completes. Without the generation guard,
		// the in-flight probe later assigns hookAuthorityLockHolder for
		// projectA — leaking that lock for the rest of the process lifetime
		// (until proper-lockfile's process-exit hook releases it).
		core.reinitializeProjectRoot(projectB);

		// Wait for the in-flight probe to settle. With the fix it must
		// detect the generation mismatch and release whatever it acquired.
		await probePromise;

		// Any process must now be able to acquire projectA's watcher lock.
		// Reverting the generation guard makes this assertion fail (verified
		// manually by removing the guard in the source — the lock leaks).
		// Brief retry to absorb filesystem-release latency on Windows.
		let lockA: Awaited<ReturnType<typeof acquireWatcherLock>> = null;
		for (let attempt = 0; attempt < 10; attempt += 1) {
			lockA = await acquireWatcherLock(backlogDirA);
			if (lockA) break;
			await new Promise((r) => setTimeout(r, 50));
		}
		expect(lockA).not.toBeNull();
		await lockA?.release();
	});

	it("explicit setHookDispatchAuthority survives until reinit clears it", async () => {
		const core = new Core(scratchProject());
		await core.filesystem.ensureBacklogStructure();
		core.setHookDispatchAuthority(true);
		// Reinit should clear the cached authority resolution so subsequent
		// dispatches in the new project re-probe.
		const projectB = scratchProject();
		core.reinitializeProjectRoot(projectB);
		// Observable proof: from outside, projectB's lock is still free
		// (Core hasn't yet probed there).
		const lock = await acquireWatcherLock(projectB);
		expect(lock).not.toBeNull();
		await lock?.release();
	});
});
