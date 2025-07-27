import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import type { Sequence, Task } from "../types/index.ts";
import { viewSequencesColumnsTUI } from "./sequences-columns-tui.ts";

// Helper to create test tasks
function createTask(id: string, dependencies: string[] = []): Task {
	return {
		id,
		title: `Task ${id}`,
		status: "To Do",
		assignee: [],
		createdDate: "2025-01-01",
		labels: [],
		dependencies,
		body: "",
		acceptanceCriteria: [],
	};
}

// Helper to create test sequences
function createSequences(): Sequence[] {
	return [
		{
			number: 1,
			tasks: [createTask("task-1"), createTask("task-2"), createTask("task-3")],
		},
		{
			number: 2,
			tasks: [createTask("task-4", ["task-1"]), createTask("task-5", ["task-2"])],
		},
		{
			number: 3,
			tasks: [createTask("task-6", ["task-4", "task-5"])],
		},
	];
}

describe("sequences-columns-tui", () => {
	let originalIsTTY: boolean;
	let consoleLogSpy: Array<string> = [];
	let originalConsoleLog: typeof console.log;

	beforeEach(() => {
		// Save original values
		originalIsTTY = process.stdout.isTTY;
		originalConsoleLog = console.log;

		// Mock console.log to capture output
		consoleLogSpy = [];
		console.log = (...args: any[]) => {
			consoleLogSpy.push(args.join(" "));
		};
	});

	afterEach(() => {
		// Restore original values
		process.stdout.isTTY = originalIsTTY;
		console.log = originalConsoleLog;
	});

	it("should display plain text output when not in TTY", async () => {
		// Mock TTY to false
		process.stdout.isTTY = false;

		const sequences = createSequences();
		await viewSequencesColumnsTUI(sequences);

		// Verify plain text output
		expect(consoleLogSpy).toContain("Task Sequences:");
		expect(consoleLogSpy.some((line) => line.includes("Sequence 1:"))).toBe(true);
		expect(consoleLogSpy).toContain("  task-1 - Task task-1");
		expect(consoleLogSpy).toContain("  task-2 - Task task-2");
		expect(consoleLogSpy).toContain("  task-3 - Task task-3");
		expect(consoleLogSpy.some((line) => line.includes("Sequence 2:"))).toBe(true);
		expect(consoleLogSpy).toContain("  task-4 - Task task-4");
		expect(consoleLogSpy).toContain("  task-5 - Task task-5");
		expect(consoleLogSpy.some((line) => line.includes("Sequence 3:"))).toBe(true);
		expect(consoleLogSpy).toContain("  task-6 - Task task-6");
	});

	it("should handle empty sequences gracefully", async () => {
		process.stdout.isTTY = false;

		await viewSequencesColumnsTUI([]);

		expect(consoleLogSpy).toContain("Task Sequences:");
		// Should not crash and output should be minimal
		expect(consoleLogSpy.length).toBeGreaterThan(0);
	});

	it("should handle sequences with no tasks", async () => {
		process.stdout.isTTY = false;

		const emptySequences: Sequence[] = [
			{ number: 1, tasks: [] },
			{ number: 2, tasks: [createTask("task-1")] },
		];

		await viewSequencesColumnsTUI(emptySequences);

		expect(consoleLogSpy).toContain("Task Sequences:");
		expect(consoleLogSpy.some((line) => line.includes("Sequence 1:"))).toBe(true);
		// Empty sequence should have no task output
		expect(consoleLogSpy.some((line) => line.includes("Sequence 2:"))).toBe(true);
		expect(consoleLogSpy).toContain("  task-1 - Task task-1");
	});

	it("should handle large number of sequences", async () => {
		process.stdout.isTTY = false;

		// Create 10 sequences
		const manySequences: Sequence[] = [];
		for (let i = 1; i <= 10; i++) {
			manySequences.push({
				number: i,
				tasks: [createTask(`task-${i}`)],
			});
		}

		await viewSequencesColumnsTUI(manySequences);

		// Should display all sequences in plain text mode
		for (let i = 1; i <= 10; i++) {
			expect(consoleLogSpy.some((line) => line.includes(`Sequence ${i}:`))).toBe(true);
			expect(consoleLogSpy).toContain(`  task-${i} - Task task-${i}`);
		}
	});

	it("should handle tasks with priority and status", async () => {
		process.stdout.isTTY = false;

		const taskWithMetadata: Task = {
			...createTask("task-1"),
			priority: "high",
			status: "In Progress",
		};

		const sequences: Sequence[] = [{ number: 1, tasks: [taskWithMetadata] }];

		await viewSequencesColumnsTUI(sequences);

		expect(consoleLogSpy).toContain("Task Sequences:");
		expect(consoleLogSpy.some((line) => line.includes("Sequence 1:"))).toBe(true);
		expect(consoleLogSpy).toContain("  task-1 - Task task-1");
	});

	// Note: Full TUI interaction tests would require mocking blessed library
	// which is complex. The above tests verify the plain text fallback behavior
	// and edge cases that would also apply to the TUI mode.
});
