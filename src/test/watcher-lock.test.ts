import { afterEach, describe, expect, it } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
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

const scratchBacklogDir = (): string => {
	const root = mkdtempSync(join(tmpdir(), "backlog-watcher-lock-test-"));
	scratchRoots.push(root);
	return root;
};

describe("acquireWatcherLock", () => {
	it("returns a holder when the lock is free", async () => {
		const dir = scratchBacklogDir();
		const holder = await acquireWatcherLock(dir);
		expect(holder).not.toBeNull();
		await holder?.release();
	});

	it("returns null when another holder already owns the lock", async () => {
		const dir = scratchBacklogDir();
		const first = await acquireWatcherLock(dir);
		expect(first).not.toBeNull();

		const second = await acquireWatcherLock(dir);
		expect(second).toBeNull();

		await first?.release();
	});

	it("re-acquires after the previous holder releases", async () => {
		const dir = scratchBacklogDir();
		const first = await acquireWatcherLock(dir);
		await first?.release();

		const second = await acquireWatcherLock(dir);
		expect(second).not.toBeNull();
		await second?.release();
	});

	it("isolates locks per project — two projects can both hold their own", async () => {
		const a = scratchBacklogDir();
		const b = scratchBacklogDir();
		const holderA = await acquireWatcherLock(a);
		const holderB = await acquireWatcherLock(b);
		expect(holderA).not.toBeNull();
		expect(holderB).not.toBeNull();
		await holderA?.release();
		await holderB?.release();
	});

	it("release is safe to call twice", async () => {
		const dir = scratchBacklogDir();
		const holder = await acquireWatcherLock(dir);
		await holder?.release();
		// Second release must not throw — best-effort contract.
		await expect(holder?.release()).resolves.toBeUndefined();
	});

	it("creates the .locks subdirectory if missing", async () => {
		const dir = scratchBacklogDir();
		// Sanity: the test setup uses a fresh tempdir with no .locks yet, so
		// this exercises the mkdir { recursive: true } path.
		const holder = await acquireWatcherLock(dir);
		expect(holder).not.toBeNull();
		await holder?.release();
	});

	it("fresh holder reports isCompromised() === false", async () => {
		const dir = scratchBacklogDir();
		const holder = await acquireWatcherLock(dir);
		expect(holder?.isCompromised()).toBe(false);
		await holder?.release();
	});

	it("degrades gracefully when lock is removed under the holder (no crash, isCompromised flips)", async () => {
		// Regression for the ECOMPROMISED crash: proper-lockfile's default
		// onCompromised re-throws from inside the heartbeat timer, which became
		// an uncaught exception that crashed the process. The new handler must
		// swallow the error and flip the compromised flag instead.
		const dir = scratchBacklogDir();
		// Use tight timings so the heartbeat notices quickly.
		// proper-lockfile enforces a 2s minimum stale window.
		const holder = await acquireWatcherLock(dir, { staleMs: 2_000, updateMs: 1_000 });
		expect(holder).not.toBeNull();
		expect(holder?.isCompromised()).toBe(false);

		// Delete the on-disk lock so the next heartbeat update fails.
		rmSync(join(dir, ".locks", "watcher"), { recursive: true, force: true });

		// Poll until the heartbeat detects the compromise (max ~10s).
		let observed = false;
		for (let i = 0; i < 40; i++) {
			if (holder?.isCompromised()) { observed = true; break; }
			await new Promise((r) => setTimeout(r, 250));
		}
		expect(observed).toBe(true);

		// Release must not throw on a compromised holder.
		await expect(holder?.release()).resolves.toBeUndefined();
	}, 15_000);
});
