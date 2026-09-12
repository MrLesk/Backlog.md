import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { Writable } from "node:stream";
import { watchJson } from "../commands/watch-json.ts";
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

	it("reconciles without a filesystem notification and suppresses unchanged results", async () => {
		const writes: string[] = [];
		output = collect(writes);
		let state = "initial";
		watching = watchJson([directory], async () => state, output);
		await waitUntil(() => writes.length === 1, "initial output");
		state = "changed without notification";
		await waitUntil(() => writes.length === 2, "reconciled output", 3000);
		await Bun.sleep(1200);
		expect(writes).toEqual(["initial", state]);
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
