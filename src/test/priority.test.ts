import { describe, expect, it } from "bun:test";
import { FileSystem } from "../file-system/operations.ts";
import { parseTask } from "../markdown/parser.ts";
import { serializeTask } from "../markdown/serializer.ts";
import type { Task } from "../types/index.ts";
import { getPriorityOptions, getPriorityRank, resolvePriorityValue } from "../utils/priority-config.ts";
import { createUniqueTestDir, safeCleanup } from "./test-utils.ts";

describe("Priority functionality", () => {
	describe("priority configuration", () => {
		it("normalizes configured priorities while preserving labels", () => {
			const config = { priorities: ["Very High", "High", "Medium", "Low", "Very Low"] };

			expect(getPriorityOptions(config)).toEqual([
				{ label: "Very High", value: "very high" },
				{ label: "High", value: "high" },
				{ label: "Medium", value: "medium" },
				{ label: "Low", value: "low" },
				{ label: "Very Low", value: "very low" },
			]);
			expect(resolvePriorityValue("VERY HIGH", config)).toBe("very high");
			expect(getPriorityRank("very high", config)).toBe(5);
			expect(getPriorityRank("very low", config)).toBe(1);
		});

		it("round-trips configured priorities through config.yml", async () => {
			const testDir = createUniqueTestDir("priority-config");
			const filesystem = new FileSystem(testDir);
			try {
				await filesystem.ensureBacklogStructure();
				await filesystem.saveConfig({
					projectName: "Priority Config",
					statuses: ["To Do", "Done"],
					labels: [],
					priorities: ["Very High", "High", "Medium", "Low", "Very Low"],
					dateFormat: "yyyy-mm-dd",
				});

				const reloaded = await new FileSystem(testDir).loadConfig();
				expect(reloaded?.priorities).toEqual(["Very High", "High", "Medium", "Low", "Very Low"]);
			} finally {
				await safeCleanup(testDir);
			}
		});
	});

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
			const priorities = ["high", "medium", "low"] as const;

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

		it("should preserve non-default priority values", () => {
			const content = `---
id: task-1
title: "Custom priority task"
status: "To Do"
priority: Very High
assignee: []
created_date: "2025-06-20"
labels: []
dependencies: []
---

## Description

This task has a custom priority.`;

			const task = parseTask(content);

			expect(task.priority).toBe("very high");
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
				rawContent: "## Description\n\nThis is a high priority task.",
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
				rawContent: "## Description\n\nThis task has no priority.",
			};

			const serialized = serializeTask(task);

			expect(serialized).not.toContain("priority:");
		});

		it("should round-trip priority values correctly", () => {
			const priorities = ["very high", "high", "medium", "low", "very low"];

			for (const priority of priorities) {
				const originalTask: Task = {
					id: "task-1",
					title: `${priority} priority task`,
					status: "To Do",
					assignee: [],
					createdDate: "2025-06-20",
					labels: [],
					dependencies: [],
					rawContent: `## Description\n\nThis is a ${priority} priority task.`,
					priority,
				};

				const serialized = serializeTask(originalTask);
				const parsed = parseTask(serialized);

				expect(parsed.priority).toBe(priority);
			}
		});
	});
});
