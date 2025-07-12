import { describe, expect, it } from "bun:test";
import { parseTask } from "../markdown/parser.ts";
import { serializeTask } from "../markdown/serializer.ts";
import type { Task } from "../types/index.ts";

describe("Priority functionality", () => {
	describe("parseTask", () => {
		it("should parse task with priority field", () => {
			const content = `---
id: task-1
title: "High priority task"
status: "To Do"
priority: high
assignee: []
created_date: "2025-06-20"
labels: []
dependencies: []
---

## Description

This is a high priority task.`;

			const task = parseTask(content);

			expect(task.id).toBe("task-1");
			expect(task.title).toBe("High priority task");
			expect(task.priority).toBe("high");
		});

		it("should handle all priority levels", () => {
			const priorities = ["high", "medium", "low"];

			for (const priority of priorities) {
				const content = `---
id: task-${priority}
title: "${priority} priority task"
status: "To Do"
priority: ${priority}
assignee: []
created_date: "2025-06-20"
labels: []
dependencies: []
---

## Description

This is a ${priority} priority task.`;

				const task = parseTask(content);
				expect(task.priority).toBe(priority);
			}
		});

		it("should handle invalid priority values gracefully", () => {
			const content = `---
id: task-1
title: "Invalid priority task"
status: "To Do"
priority: invalid
assignee: []
created_date: "2025-06-20"
labels: []
dependencies: []
---

## Description

This task has an invalid priority.`;

			const task = parseTask(content);

			expect(task.priority).toBeUndefined();
		});

		it("should handle task without priority field", () => {
			const content = `---
id: task-1
title: "No priority task"
status: "To Do"
assignee: []
created_date: "2025-06-20"
labels: []
dependencies: []
---

## Description

This task has no priority.`;

			const task = parseTask(content);

			expect(task.priority).toBeUndefined();
		});

		it("should handle case-insensitive priority values", () => {
			const content = `---
id: task-1
title: "Mixed case priority"
status: "To Do"
priority: HIGH
assignee: []
created_date: "2025-06-20"
labels: []
dependencies: []
---

## Description

This task has mixed case priority.`;

			const task = parseTask(content);

			expect(task.priority).toBe("high");
		});
	});

	describe("serializeTask", () => {
		it("should serialize task with priority", () => {
			const task: Task = {
				id: "task-1",
				title: "High priority task",
				status: "To Do",
				assignee: [],
				createdDate: "2025-06-20",
				labels: [],
				dependencies: [],
				body: "## Description\n\nThis is a high priority task.",
				priority: "high",
			};

			const serialized = serializeTask(task);

			expect(serialized).toContain("priority: high");
		});

		it("should not include priority field when undefined", () => {
			const task: Task = {
				id: "task-1",
				title: "No priority task",
				status: "To Do",
				assignee: [],
				createdDate: "2025-06-20",
				labels: [],
				dependencies: [],
				body: "## Description\n\nThis task has no priority.",
			};

			const serialized = serializeTask(task);

			expect(serialized).not.toContain("priority:");
		});

		it("should round-trip priority values correctly", () => {
			const priorities: Array<"high" | "medium" | "low"> = ["high", "medium", "low"];

			for (const priority of priorities) {
				const originalTask: Task = {
					id: "task-1",
					title: `${priority} priority task`,
					status: "To Do",
					assignee: [],
					createdDate: "2025-06-20",
					labels: [],
					dependencies: [],
					body: `## Description\n\nThis is a ${priority} priority task.`,
					priority,
				};

				const serialized = serializeTask(originalTask);
				const parsed = parseTask(serialized);

				expect(parsed.priority).toBe(priority);
			}
		});
	});
});
