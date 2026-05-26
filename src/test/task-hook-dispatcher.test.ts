import { describe, expect, it } from "bun:test";
import { createTaskHookDispatcher } from "../core/task-hook-dispatcher.ts";
import type { BacklogConfig, Task } from "../types/index.ts";
import type { StatusCallbackOptions, StatusCallbackResult } from "../utils/status-callback.ts";

const makeTask = (overrides: Partial<Task> = {}): Task => ({
	id: "BACK-1",
	title: "A task",
	status: "To Do",
	assignee: [],
	labels: [],
	dependencies: [],
	createdDate: "2026-01-01",
	...overrides,
});

interface Harness {
	dispatcher: ReturnType<typeof createTaskHookDispatcher>;
	execCalls: StatusCallbackOptions[];
	errors: Array<{ taskId: string; message: string; output?: string }>;
	setConfig(config: BacklogConfig | null): void;
}

const baseConfig: BacklogConfig = {
	projectName: "Test",
	statuses: ["To Do", "In Progress", "Done"],
	labels: [],
	dateFormat: "yyyy-mm-dd",
};

const makeHarness = (
	initial: { config?: BacklogConfig | null; execResult?: StatusCallbackResult; execThrows?: Error } = {},
): Harness => {
	const execCalls: StatusCallbackOptions[] = [];
	const errors: Array<{ taskId: string; message: string; output?: string }> = [];
	let config: BacklogConfig | null =
		"config" in initial ? (initial.config ?? null) : { ...baseConfig, onStatusChange: "noop" };
	const exec = async (opts: StatusCallbackOptions): Promise<StatusCallbackResult> => {
		execCalls.push(opts);
		if (initial.execThrows) throw initial.execThrows;
		return initial.execResult ?? { success: true };
	};
	const dispatcher = createTaskHookDispatcher({
		cwd: () => "/tmp/project",
		loadConfig: async () => config,
		exec,
		onError: (taskId, message, output) => errors.push({ taskId, message, output }),
	});
	return {
		dispatcher,
		execCalls,
		errors,
		setConfig(next) {
			config = next;
		},
	};
};

describe("createTaskHookDispatcher", () => {
	it("fires on a status transition for a hand edit (no in-process write)", async () => {
		const h = makeHarness();
		h.dispatcher.seedSnapshot([makeTask({ status: "To Do" })]);
		await h.dispatcher.onTaskWrite(makeTask({ status: "In Progress" }));
		expect(h.execCalls.length).toBe(1);
		expect(h.execCalls[0]?.oldStatus).toBe("To Do");
		expect(h.execCalls[0]?.newStatus).toBe("In Progress");
	});

	it("does not fire on initial appearance (task was not in snapshot)", async () => {
		const h = makeHarness();
		await h.dispatcher.onTaskWrite(makeTask({ status: "To Do" }));
		expect(h.execCalls.length).toBe(0);
	});

	it("does not fire when status is unchanged but other fields change", async () => {
		const h = makeHarness();
		h.dispatcher.seedSnapshot([makeTask({ status: "To Do", title: "Old" })]);
		await h.dispatcher.onTaskWrite(makeTask({ status: "To Do", title: "New" }));
		expect(h.execCalls.length).toBe(0);
	});

	it("suppresses the watcher fire when the caller passes suppress: true", async () => {
		const h = makeHarness();
		h.dispatcher.seedSnapshot([makeTask({ status: "To Do" })]);
		// Simulate Core.updateTaskFromInput: dispatch directly, then the
		// watcher arrives but the content-hash matched so the watcher passes
		// suppress: true.
		await h.dispatcher.dispatchInProcess({ task: makeTask({ status: "In Progress" }), oldStatus: "To Do" });
		await h.dispatcher.onTaskWrite(makeTask({ status: "In Progress" }), { suppress: true });
		expect(h.execCalls.length).toBe(1);
	});

	it("suppressed watcher events still advance the snapshot for future hand edits", async () => {
		const h = makeHarness();
		// A new task created in-process. Snapshot is initially empty. The
		// saveTask wrapper records the content hash; the watcher reads the
		// same bytes, the hash matches, and the dispatcher is called with
		// suppress: true. The snapshot must still update or the first hand
		// edit after creation would be treated as a brand-new task.
		await h.dispatcher.onTaskWrite(makeTask({ status: "To Do" }), { suppress: true });
		expect(h.execCalls.length).toBe(0);
		// Now a hand edit comes in — non-suppressed, real transition.
		await h.dispatcher.onTaskWrite(makeTask({ status: "Done" }));
		expect(h.execCalls.length).toBe(1);
		expect(h.execCalls[0]?.oldStatus).toBe("To Do");
		expect(h.execCalls[0]?.newStatus).toBe("Done");
	});

	it("falls back to the per-task onStatusChange before the global config command", async () => {
		const h = makeHarness({ config: { ...baseConfig, onStatusChange: "global-cmd" } });
		h.dispatcher.seedSnapshot([makeTask({ status: "To Do" })]);
		await h.dispatcher.onTaskWrite(makeTask({ status: "Done", onStatusChange: "task-cmd" }));
		expect(h.execCalls.length).toBe(1);
		expect(h.execCalls[0]?.command).toBe("task-cmd");
	});

	it("does nothing when there is no callback configured", async () => {
		const h = makeHarness({ config: baseConfig });
		h.dispatcher.seedSnapshot([makeTask({ status: "To Do" })]);
		await h.dispatcher.onTaskWrite(makeTask({ status: "Done" }));
		expect(h.execCalls.length).toBe(0);
		expect(h.errors.length).toBe(0);
	});

	it("logs but does not throw when the callback fails", async () => {
		const h = makeHarness({ execResult: { success: false, error: "boom" } });
		h.dispatcher.seedSnapshot([makeTask({ status: "To Do" })]);
		await h.dispatcher.onTaskWrite(makeTask({ status: "Done" }));
		expect(h.errors.length).toBe(1);
		expect(h.errors[0]?.message).toBe("boom");
	});

	it("logs but does not throw when exec itself rejects", async () => {
		const h = makeHarness({ execThrows: new Error("spawn failed") });
		h.dispatcher.seedSnapshot([makeTask({ status: "To Do" })]);
		await h.dispatcher.onTaskWrite(makeTask({ status: "Done" }));
		expect(h.errors.length).toBe(1);
		expect(h.errors[0]?.message).toBe("spawn failed");
	});

	it("treats forgetTask + re-appearance as a new task (no transition fired)", async () => {
		const h = makeHarness();
		h.dispatcher.seedSnapshot([makeTask({ status: "Done" })]);
		h.dispatcher.forgetTask("BACK-1");
		await h.dispatcher.onTaskWrite(makeTask({ status: "To Do" }));
		expect(h.execCalls.length).toBe(0);
	});

	it("dispatchInProcess updates the snapshot so subsequent watcher events are no-ops", async () => {
		const h = makeHarness();
		h.dispatcher.seedSnapshot([makeTask({ status: "To Do" })]);
		await h.dispatcher.dispatchInProcess({ task: makeTask({ status: "In Progress" }), oldStatus: "To Do" });
		// No coordinator handle here — we want to confirm the snapshot moved
		// forward so the watcher won't see In Progress as a fresh transition.
		await h.dispatcher.onTaskWrite(makeTask({ status: "In Progress" }));
		expect(h.execCalls.length).toBe(1); // only the dispatchInProcess call
	});

	it("dispatchInProcess respects suppress: true (snapshot still updated, no fire)", async () => {
		const h = makeHarness();
		h.dispatcher.seedSnapshot([makeTask({ status: "To Do" })]);
		// Models a non-authority process: dispatch is asked to update local
		// snapshot but not fire. The lock-holder process will fire via its
		// own watcher.
		await h.dispatcher.dispatchInProcess(
			{ task: makeTask({ status: "In Progress" }), oldStatus: "To Do" },
			{ suppress: true },
		);
		expect(h.execCalls.length).toBe(0);
		// Subsequent non-suppressed observation that matches the new status
		// must not fire either (snapshot moved to In Progress above).
		await h.dispatcher.onTaskWrite(makeTask({ status: "In Progress" }));
		expect(h.execCalls.length).toBe(0);
	});

	it("reset() clears the snapshot so the next observation is treated as a new task", async () => {
		const h = makeHarness();
		h.dispatcher.seedSnapshot([makeTask({ status: "Done" })]);
		h.dispatcher.reset();
		// After reset the dispatcher should not consider this a transition
		// from Done → To Do — the snapshot is empty, so it's a fresh task.
		await h.dispatcher.onTaskWrite(makeTask({ status: "To Do" }));
		expect(h.execCalls.length).toBe(0);
	});

	it("resolves cwd lazily from the thunk on every fire (supports project-root swaps)", async () => {
		const execCalls: StatusCallbackOptions[] = [];
		const errors: Array<{ taskId: string; message: string; output?: string }> = [];
		let currentCwd = "/initial/project";
		const dispatcher = createTaskHookDispatcher({
			cwd: () => currentCwd,
			loadConfig: async () => ({ ...baseConfig, onStatusChange: "noop" }),
			exec: async (opts) => {
				execCalls.push(opts);
				return { success: true };
			},
			onError: (taskId, message, output) => errors.push({ taskId, message, output }),
		});
		dispatcher.seedSnapshot([makeTask({ status: "To Do" })]);
		await dispatcher.onTaskWrite(makeTask({ status: "Done" }));
		expect(execCalls[0]?.cwd).toBe("/initial/project");
		// Simulate a reinitializeProjectRoot swap.
		currentCwd = "/swapped/project";
		dispatcher.reset();
		dispatcher.seedSnapshot([makeTask({ status: "To Do" })]);
		await dispatcher.onTaskWrite(makeTask({ status: "Done" }));
		expect(execCalls[1]?.cwd).toBe("/swapped/project");
	});
});
