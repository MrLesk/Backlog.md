import { describe, expect, it } from "bun:test";
import type { Task } from "../types/index.ts";
import type { ColumnData } from "../ui/board.ts";
import { shouldRebuildColumns } from "../ui/board.ts";

// Helper to create a minimal valid Task for testing
const createTestTask = (id: string, title: string, status: string): Task => ({
	id,
	title,
	status,
	assignee: [],
	createdDate: "2025-01-01",
	labels: [],
	dependencies: [],
});

describe("Board TUI Logic", () => {
	describe("shouldRebuildColumns", () => {
		it("should return true if column counts differ", () => {
			const current: ColumnData[] = [{ status: "ToDo", tasks: [] }];
			const next: ColumnData[] = [
				{ status: "ToDo", tasks: [] },
				{ status: "Done", tasks: [] },
			];
			expect(shouldRebuildColumns(current, next)).toBe(true);
		});

		it("should return true if statuses differ", () => {
			const current: ColumnData[] = [{ status: "ToDo", tasks: [] }];
			const next: ColumnData[] = [{ status: "Done", tasks: [] }];
			expect(shouldRebuildColumns(current, next)).toBe(true);
		});

		it("should return true if task counts differ", () => {
			const task1 = createTestTask("1", "t1", "ToDo");
			const current: ColumnData[] = [{ status: "ToDo", tasks: [task1] }];
			const next: ColumnData[] = [{ status: "ToDo", tasks: [] }];
			expect(shouldRebuildColumns(current, next)).toBe(true);
		});

		it("should return true if task IDs differ (order change)", () => {
			const task1 = createTestTask("1", "t1", "ToDo");
			const task2 = createTestTask("2", "t2", "ToDo");

			const current: ColumnData[] = [{ status: "ToDo", tasks: [task1, task2] }];
			const next: ColumnData[] = [{ status: "ToDo", tasks: [task2, task1] }];
			expect(shouldRebuildColumns(current, next)).toBe(true);
		});

		it("should return false if columns and tasks are identical", () => {
			const task1 = createTestTask("1", "t1", "ToDo");
			const task2 = createTestTask("2", "t2", "ToDo");

			const current: ColumnData[] = [{ status: "ToDo", tasks: [task1, task2] }];
			const next: ColumnData[] = [{ status: "ToDo", tasks: [task1, task2] }];
			expect(shouldRebuildColumns(current, next)).toBe(false);
		});
	});
});
