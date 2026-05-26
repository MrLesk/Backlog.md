import { describe, expect, it } from "bun:test";
import { createTaskWriteCoordinator, hashTaskContent } from "../core/task-write-coordinator.ts";

describe("createTaskWriteCoordinator", () => {
	it("consumes a recorded write when the hash matches", () => {
		const c = createTaskWriteCoordinator();
		c.recordWrite("BACK-1", "abc");
		expect(c.consumeMatchingWrite("BACK-1", "abc")).toBe(true);
	});

	it("returns false when the hash does not match", () => {
		const c = createTaskWriteCoordinator();
		c.recordWrite("BACK-1", "abc");
		expect(c.consumeMatchingWrite("BACK-1", "different")).toBe(false);
	});

	it("returns false when nothing was recorded for the task id", () => {
		const c = createTaskWriteCoordinator();
		expect(c.consumeMatchingWrite("BACK-999", "abc")).toBe(false);
	});

	it("a consumed write cannot be consumed again", () => {
		const c = createTaskWriteCoordinator();
		c.recordWrite("BACK-1", "abc");
		expect(c.consumeMatchingWrite("BACK-1", "abc")).toBe(true);
		expect(c.consumeMatchingWrite("BACK-1", "abc")).toBe(false);
	});

	it("multiple distinct writes are independently consumable", () => {
		const c = createTaskWriteCoordinator();
		c.recordWrite("BACK-1", "first");
		c.recordWrite("BACK-1", "second");
		expect(c.consumeMatchingWrite("BACK-1", "second")).toBe(true);
		expect(c.consumeMatchingWrite("BACK-1", "first")).toBe(true);
	});

	it("isolates per task — recording on one task does not match another", () => {
		const c = createTaskWriteCoordinator();
		c.recordWrite("BACK-1", "abc");
		expect(c.consumeMatchingWrite("BACK-2", "abc")).toBe(false);
		expect(c.consumeMatchingWrite("BACK-1", "abc")).toBe(true);
	});

	it("evicts the oldest entry when the per-task bound is exceeded", () => {
		const c = createTaskWriteCoordinator({ maxPendingPerTask: 2 });
		c.recordWrite("BACK-1", "a");
		c.recordWrite("BACK-1", "b");
		c.recordWrite("BACK-1", "c"); // evicts "a"
		expect(c.consumeMatchingWrite("BACK-1", "a")).toBe(false);
		expect(c.consumeMatchingWrite("BACK-1", "b")).toBe(true);
		expect(c.consumeMatchingWrite("BACK-1", "c")).toBe(true);
	});

	it("re-recording an existing hash refreshes it as the newest entry", () => {
		const c = createTaskWriteCoordinator({ maxPendingPerTask: 2 });
		c.recordWrite("BACK-1", "a");
		c.recordWrite("BACK-1", "b");
		c.recordWrite("BACK-1", "a"); // moves "a" to the tail; "b" is now oldest
		c.recordWrite("BACK-1", "c"); // evicts "b"
		expect(c.consumeMatchingWrite("BACK-1", "b")).toBe(false);
		expect(c.consumeMatchingWrite("BACK-1", "a")).toBe(true);
		expect(c.consumeMatchingWrite("BACK-1", "c")).toBe(true);
	});

	it("reset() drops all recorded writes", () => {
		const c = createTaskWriteCoordinator();
		c.recordWrite("BACK-1", "a");
		c.recordWrite("BACK-2", "b");
		c.reset();
		expect(c.consumeMatchingWrite("BACK-1", "a")).toBe(false);
		expect(c.consumeMatchingWrite("BACK-2", "b")).toBe(false);
	});

	it("supports the watcher-then-fire ordering — record before suppressing the next watcher event", async () => {
		const c = createTaskWriteCoordinator();
		const content = "the on-disk bytes we just wrote\n";
		const hash = await hashTaskContent(content);
		c.recordWrite("BACK-1", hash);
		// Simulate the watcher reading the same bytes and hashing them.
		const watcherSeesHash = await hashTaskContent(content);
		expect(c.consumeMatchingWrite("BACK-1", watcherSeesHash)).toBe(true);
	});

	it("does not suppress a watcher event for a different on-disk byte sequence", async () => {
		const c = createTaskWriteCoordinator();
		const wrote = "version A\n";
		const wroteHash = await hashTaskContent(wrote);
		c.recordWrite("BACK-1", wroteHash);
		// Hand edit happens — watcher reads a different sequence.
		const handEdit = "version B (hand edit)\n";
		const handEditHash = await hashTaskContent(handEdit);
		expect(c.consumeMatchingWrite("BACK-1", handEditHash)).toBe(false);
		// Our original record is still there until the matching event comes
		// in (or another bound-eviction).
		expect(c.consumeMatchingWrite("BACK-1", wroteHash)).toBe(true);
	});
});

describe("hashTaskContent", () => {
	it("returns the same 64-char hex digest for the same input", async () => {
		const a = await hashTaskContent("hello world");
		const b = await hashTaskContent("hello world");
		expect(a).toBe(b);
		expect(a.length).toBe(64);
		expect(/^[0-9a-f]+$/.test(a)).toBe(true);
	});

	it("returns distinct digests for distinct inputs", async () => {
		const a = await hashTaskContent("a");
		const b = await hashTaskContent("b");
		expect(a).not.toBe(b);
	});
});
