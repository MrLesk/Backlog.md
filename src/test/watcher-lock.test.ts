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
});
