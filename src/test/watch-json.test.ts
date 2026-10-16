import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { mkdir, rm, symlink, utimes, writeFile } from "node:fs/promises";
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

	it("compares the read's files and directory entries one level deep", async () => {
		const tasks = join(directory, "tasks");
		const task = join(tasks, "task.md");
		const config = join(directory, "config.yml");
		const docs = join(directory, "docs");
		const kept = new Date(2000, 0, 1);
		await mkdir(tasks);
		await mkdir(docs);
		await writeFile(task, "one");
		await writeFile(config, "one");
		await utimes(task, kept, kept);
		// Not an input: a link cycle or a large linked tree under docs is never scanned.
		await symlink(directory, join(docs, "loop"), "junction");
		const inputs = [tasks, join(directory, "completed"), config];
		const initial = filesSignature(inputs);
		expect(filesSignature(inputs)).toBe(initial);
		await writeFile(join(docs, "doc.md"), "changed");
		expect(filesSignature(inputs)).toBe(initial);

		// A same-size replacement that keeps the modification time is revealed by the change time.
		// The pause outlasts coarse filesystem clocks.
		await Bun.sleep(50);
		await writeFile(task, "two");
		await utimes(task, kept, kept);
		const edited = filesSignature(inputs);
		expect(edited).not.toBe(initial);

		await writeFile(join(tasks, "other.md"), "new");
		expect(filesSignature(inputs)).not.toBe(edited);
		await rm(join(tasks, "other.md"));
		expect(filesSignature(inputs)).toBe(edited);
		// A directory that did not exist yet, and a file input.
		await mkdir(join(directory, "completed"));
		await writeFile(join(directory, "completed", "done.md"), "done");
		const created = filesSignature(inputs);
		expect(created).not.toBe(edited);
		await writeFile(config, "changed");
		expect(filesSignature(inputs)).not.toBe(created);
	});

	it("follows a linked task directory", async () => {
		const outside = join(directory, "outside");
		const tasks = join(directory, "tasks");
		await mkdir(outside);
		await writeFile(join(outside, "task.md"), "one");
		// Junctions link directories on Windows without extra privileges; elsewhere they are symlinks.
		await symlink(outside, tasks, "junction");
		const initial = filesSignature([tasks]);
		expect(initial).toContain("task.md\0");
		// An edit inside the link target, where notifications on the backlog do not reach.
		await writeFile(join(outside, "task.md"), "changed");
		expect(filesSignature([tasks])).not.toBe(initial);
	});

	// Creating file symlinks on Windows needs extra privileges.
	it.skipIf(process.platform === "win32")("follows linked task files and counts broken links by name", async () => {
		const outside = join(directory, "outside.txt");
		await writeFile(outside, "one");
		await mkdir(join(directory, "tasks"));
		const tasks = join(directory, "tasks");
		await symlink(outside, join(tasks, "linked.md"));
		await symlink("self", join(tasks, "self"));
		await symlink("missing", join(tasks, "dangling"));
		const initial = filesSignature([tasks]);
		expect(initial.split("\n")).toEqual([tasks, "dangling", expect.stringContaining("linked.md\0"), "self"]);
		// A size change keeps this edit visible under coarse filesystem clocks.
		await writeFile(outside, "changed");
		expect(filesSignature([tasks])).not.toBe(initial);
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
		watching = watchJson([directory], [directory], async () => "snapshot", output);
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
			const promise = watchJson([directory], [directory], async () => "snapshot", output);
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
