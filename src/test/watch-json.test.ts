import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { chmod, mkdir, rm, symlink, utimes, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { Writable } from "node:stream";
import { filesSignature, watchJson } from "../commands/watch-json.ts";
import { createUniqueTestDir, safeCleanup, waitUntil } from "./test-utils.ts";

let directory: string;
let output: Writable;
let watching: Promise<void> | undefined;

beforeEach(async () => {
	directory = createUniqueTestDir("watch-json");
	await mkdir(directory, { recursive: true });
});
afterEach(async () => {
	output?.destroy();
	await watching;
	watching = undefined;
	await safeCleanup(directory);
});

function collect(writes: string[]) {
	return new Writable({
		write(chunk, _encoding, callback) {
			writes.push(chunk.toString());
			callback();
		},
	});
}

describe("JSON watch lifecycle", () => {
	it("reconciles changes made during the initial read", async () => {
		const writes: string[] = [];
		output = collect(writes);
		let state = "initial";
		let calls = 0;
		let release: (() => void) | undefined;
		watching = watchJson(
			[directory],
			async () => {
				const captured = state;
				if (++calls === 1)
					await new Promise<void>((resolve) => {
						release = resolve;
					});
				return captured;
			},
			output,
		);
		await waitUntil(() => release !== undefined, "read/write started");
		state = "updated";
		await writeFile(join(directory, "task.md"), state);
		release?.();
		await waitUntil(() => writes.at(-1) === "updated", "updated output");
		expect(writes).toEqual(["initial", "updated"]);
	});

	it("does not repeat the read while nothing changes", async () => {
		const writes: string[] = [];
		output = collect(writes);
		let reads = 0;
		watching = watchJson(
			[directory],
			async () => {
				reads++;
				return "snapshot";
			},
			output,
		);
		await waitUntil(() => writes.length === 1, "initial output");
		const settled = reads;
		// Spans more than two reconciliation passes.
		await Bun.sleep(2500);
		expect(reads).toBe(settled);
		expect(writes).toEqual(["snapshot"]);
	});

	it("reconciles with a stat signature that changes only with the watched files", async () => {
		const scopes = [{ directory, recursive: true }];
		const tasks = join(directory, "tasks");
		const task = join(tasks, "task.md");
		const kept = new Date(2000, 0, 1);
		await mkdir(tasks);
		await writeFile(task, "one");
		await utimes(task, kept, kept);
		const initial = filesSignature(scopes);
		expect(filesSignature(scopes)).toBe(initial);

		// A same-size replacement that keeps the modification time is revealed by the change time.
		// The pause outlasts coarse filesystem clocks.
		await Bun.sleep(50);
		await writeFile(task, "two");
		await utimes(task, kept, kept);
		const edited = filesSignature(scopes);
		expect(edited).not.toBe(initial);

		await writeFile(join(tasks, "other.md"), "new");
		expect(filesSignature(scopes)).not.toBe(edited);
		// Removal restores the signature even though the directory's own time moved.
		await rm(join(tasks, "other.md"));
		expect(filesSignature(scopes)).toBe(edited);
		// Like its notifications, a non-recursive scope ignores nested files.
		expect(filesSignature([{ directory, recursive: false }])).not.toContain("task.md");
	});

	it("follows linked directories and enters each directory once", async () => {
		const backlog = join(directory, "backlog");
		const outside = join(directory, "outside");
		await mkdir(backlog);
		await mkdir(outside);
		await writeFile(join(outside, "task.md"), "one");
		// Junctions link directories on Windows without extra privileges; elsewhere they are symlinks.
		await symlink(outside, join(backlog, "tasks"), "junction");
		// Two cycles made recursive scans walk every path of links up to the system limit.
		await symlink(backlog, join(backlog, "a"), "junction");
		await symlink(backlog, join(backlog, "b"), "junction");
		const scopes = [{ directory: backlog, recursive: true }];
		const initial = filesSignature(scopes);
		expect(initial).toContain("tasks/task.md");
		// Entries start their lines; the first line is the scope's own path.
		expect(initial).not.toContain("\na/");
		// An edit inside the link target, where notifications on the backlog do not reach.
		await writeFile(join(outside, "task.md"), "changed");
		expect(filesSignature(scopes)).not.toBe(initial);
	});

	// Creating file symlinks on Windows needs extra privileges.
	it.skipIf(process.platform === "win32")("counts linked files and skips entries it cannot read", async () => {
		const outside = join(directory, "outside.txt");
		const task = join(directory, "task.md");
		const locked = join(directory, "locked");
		await writeFile(outside, "one");
		await writeFile(task, "one");
		await symlink(outside, join(directory, "linked.md"));
		await symlink("self", join(directory, "self"));
		await symlink("q", join(directory, "p"));
		await symlink("p", join(directory, "q"));
		await mkdir(locked);
		await chmod(locked, 0o000);
		try {
			const scopes = [{ directory, recursive: true }];
			const initial = filesSignature(scopes);
			// Looping links count by name, and the pass never falls back to a constant error.
			expect(initial.startsWith(directory)).toBe(true);
			expect(initial.split("\n")).toEqual(expect.arrayContaining(["self", "p", "q"]));
			// Size changes keep these edits visible under coarse filesystem clocks.
			await writeFile(outside, "changed");
			const linked = filesSignature(scopes);
			expect(linked).not.toBe(initial);
			await writeFile(task, "changed");
			expect(filesSignature(scopes)).not.toBe(linked);
		} finally {
			await chmod(locked, 0o755);
		}
	});

	it("does not queue snapshots behind a slow writer and catches up to the latest state", async () => {
		const writes: string[] = [];
		let release: (() => void) | undefined;
		output = new Writable({
			write(chunk, _encoding, callback) {
				writes.push(chunk.toString());
				if (writes.length === 1) release = callback;
				else callback();
			},
		});
		let state = "initial";
		let reads = 0;
		watching = watchJson(
			[directory],
			async () => {
				reads++;
				return state;
			},
			output,
		);
		await waitUntil(() => release !== undefined, "read/write started");
		for (let i = 0; i < 10; i++) {
			state = `change ${i}`;
			await writeFile(join(directory, "task.md"), state);
		}
		await Bun.sleep(1200);
		expect(reads).toBe(1);
		expect(writes).toEqual(["initial"]);
		release?.();
		await waitUntil(() => writes.at(-1) === state, "latest output");
		expect(writes).toEqual(["initial", "change 9"]);
	});

	it("releases a blocked write when the consumer closes and removes listeners", async () => {
		let started = false;
		output = new Writable({
			write() {
				started = true;
			},
		});
		const before = process.listenerCount("SIGTERM");
		watching = watchJson([directory], async () => "snapshot", output);
		await waitUntil(() => started, "blocked write");
		output.destroy();
		await watching;
		expect(process.listenerCount("SIGTERM")).toBe(before);
		expect(output.listenerCount("error")).toBe(0);
	});

	it("ends a broken pipe quietly and reports other output failures", async () => {
		for (const code of ["EPIPE", "EIO"]) {
			output = new Writable({
				write(_chunk, _encoding, callback) {
					callback(Object.assign(new Error(code), { code }));
				},
			});
			const promise = watchJson([directory], async () => "snapshot", output);
			if (code === "EPIPE") await promise;
			else await expect(promise).rejects.toThrow("EIO");
		}
	});

	it("propagates read failures without a replacement snapshot", async () => {
		const writes: string[] = [];
		output = collect(writes);
		await expect(
			watchJson(
				[directory],
				async () => {
					throw new Error("read failed");
				},
				output,
			),
		).rejects.toThrow("read failed");
		expect(writes).toEqual([]);
	});
});
