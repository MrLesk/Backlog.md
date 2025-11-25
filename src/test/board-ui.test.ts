import { describe, expect, it } from "bun:test";
import type { ColumnData } from "../ui/board.ts";
import { shouldRebuildColumns } from "../ui/board.ts";

// Mock Task type since we don't want to import the full type definition
type MockTask = {
	id: string;
	title: string;
	status: string;
	[key: string]: unknown;
};

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
			const task1 = { id: "1", title: "t1", status: "ToDo" } as MockTask;
			const current: ColumnData[] = [{ status: "ToDo", tasks: [task1] }];
			const next: ColumnData[] = [{ status: "ToDo", tasks: [] }];
			expect(shouldRebuildColumns(current, next)).toBe(true);
		});

		it("should return true if task IDs differ (order change)", () => {
			const task1 = { id: "1", title: "t1", status: "ToDo" } as MockTask;
			const task2 = { id: "2", title: "t2", status: "ToDo" } as MockTask;

			const current: ColumnData[] = [{ status: "ToDo", tasks: [task1, task2] }];
			const next: ColumnData[] = [{ status: "ToDo", tasks: [task2, task1] }];
			expect(shouldRebuildColumns(current, next)).toBe(true);
		});

		it("should return false if columns and tasks are identical", () => {
			const task1 = { id: "1", title: "t1", status: "ToDo" } as MockTask;
			const task2 = { id: "2", title: "t2", status: "ToDo" } as MockTask;

			const current: ColumnData[] = [{ status: "ToDo", tasks: [task1, task2] }];
			const next: ColumnData[] = [{ status: "ToDo", tasks: [task1, task2] }];
			expect(shouldRebuildColumns(current, next)).toBe(false);
		});
	});
});
