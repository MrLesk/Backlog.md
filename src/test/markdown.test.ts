import { describe, expect, it } from "bun:test";
import { parseDecisionLog, parseMarkdown, parseTask } from "../markdown/parser.ts";
import {
	serializeDecisionLog,
	serializeDocument,
	serializeTask,
	updateTaskAcceptanceCriteria,
} from "../markdown/serializer.ts";
import type { DecisionLog, Document, Task } from "../types/index.ts";

describe("Markdown Parser", () => {
	describe("parseMarkdown", () => {
		it("should parse frontmatter and content", () => {
			const content = `---
title: "Test Task"
status: "To Do"
labels: ["bug", "urgent"]
---

This is the task description.

## Acceptance Criteria

- [ ] First criterion
- [ ] Second criterion`;

			const result = parseMarkdown(content);

			expect(result.frontmatter.title).toBe("Test Task");
			expect(result.frontmatter.status).toBe("To Do");
			expect(result.frontmatter.labels).toEqual(["bug", "urgent"]);
			expect(result.content).toContain("This is the task description");
		});

		it("should handle content without frontmatter", () => {
			const content = "Just some markdown content";
			const result = parseMarkdown(content);

			expect(result.frontmatter).toEqual({});
			expect(result.content).toBe("Just some markdown content");
		});

		it("should handle empty content", () => {
			const content = "";
			const result = parseMarkdown(content);

			expect(result.frontmatter).toEqual({});
			expect(result.content).toBe("");
		});
	});

	describe("parseTask", () => {
		it("should parse a complete task", () => {
			const content = `---
id: task-1
title: "Fix login bug"
status: "In Progress"
assignee: "@developer"
reporter: "@manager"
created_date: "2025-06-03"
labels: ["bug", "frontend"]
milestone: "v1.0"
dependencies: ["task-0"]
parent_task_id: "task-parent"
subtasks: ["task-1.1", "task-1.2"]
---

## Description

Fix the login bug that prevents users from signing in.

## Acceptance Criteria

- [ ] Login form validates correctly
- [ ] Error messages are displayed properly`;

			const task = parseTask(content);

			expect(task.id).toBe("task-1");
			expect(task.title).toBe("Fix login bug");
			expect(task.status).toBe("In Progress");
			expect(task.assignee).toEqual(["@developer"]);
			expect(task.reporter).toBe("@manager");
			expect(task.createdDate).toBe("2025-06-03");
			expect(task.labels).toEqual(["bug", "frontend"]);
			expect(task.milestone).toBe("v1.0");
			expect(task.dependencies).toEqual(["task-0"]);
			expect(task.parentTaskId).toBe("task-parent");
			expect(task.subtasks).toEqual(["task-1.1", "task-1.2"]);
			expect(task.acceptanceCriteria).toEqual([
				"Login form validates correctly",
				"Error messages are displayed properly",
			]);
		});

		it("should parse a task with minimal fields", () => {
			const content = `---
id: task-2
title: "Simple task"
---

Just a basic task.`;

			const task = parseTask(content);

			expect(task.id).toBe("task-2");
			expect(task.title).toBe("Simple task");
			expect(task.status).toBe("");
			expect(task.assignee).toEqual([]);
			expect(task.reporter).toBeUndefined();
			expect(task.labels).toEqual([]);
			expect(task.dependencies).toEqual([]);
			expect(task.acceptanceCriteria).toEqual([]);
			expect(task.parentTaskId).toBeUndefined();
			expect(task.subtasks).toBeUndefined();
		});

		it("should handle task with empty status", () => {
			const content = `---
id: task-3
title: "No status task"
created_date: "2025-06-07"
---

Task without status.`;

			const task = parseTask(content);

			expect(task.status).toBe("");
			expect(task.createdDate).toBe("2025-06-07");
		});

		it("should parse unquoted created_date", () => {
			const content = `---
id: task-5
title: "Unquoted"
created_date: 2025-06-08
---`;

			const task = parseTask(content);

			expect(task.createdDate).toBe("2025-06-08");
		});

		it("should parse created_date in short format", () => {
			const content = `---
id: task-6
title: "Short"
created_date: 08-06-25
---`;

			const task = parseTask(content);

			expect(task.createdDate).toBe("2025-06-08");
		});

		it("should extract acceptance criteria with checked items", () => {
			const content = `---
id: task-4
title: "Test with mixed criteria"
---

## Acceptance Criteria

- [ ] Todo item
- [x] Done item
- [ ] Another todo`;

			const task = parseTask(content);

			expect(task.acceptanceCriteria).toEqual(["Todo item", "Done item", "Another todo"]);
		});
	});

	describe("parseDecisionLog", () => {
		it("should parse a decision log", () => {
			const content = `---
id: decision-1
title: "Use TypeScript for backend"
date: "2025-06-03"
status: "accepted"
---

## Context

We need to choose a language for the backend.

## Decision

We will use TypeScript for better type safety.

## Consequences

Better development experience but steeper learning curve.`;

			const decision = parseDecisionLog(content);

			expect(decision.id).toBe("decision-1");
			expect(decision.title).toBe("Use TypeScript for backend");
			expect(decision.status).toBe("accepted");
			expect(decision.context).toBe("We need to choose a language for the backend.");
			expect(decision.decision).toBe("We will use TypeScript for better type safety.");
			expect(decision.consequences).toBe("Better development experience but steeper learning curve.");
		});

		it("should parse decision log with alternatives", () => {
			const content = `---
id: decision-2
title: "Choose database"
date: "2025-06-03"
status: "proposed"
---

## Context

Need a database solution.

## Decision

Use PostgreSQL.

## Consequences

Good performance and reliability.

## Alternatives

Considered MongoDB and MySQL.`;

			const decision = parseDecisionLog(content);

			expect(decision.alternatives).toBe("Considered MongoDB and MySQL.");
		});

		it("should handle missing sections", () => {
			const content = `---
id: decision-3
title: "Minimal decision"
date: "2025-06-03"
status: "proposed"
---

## Context

Some context.`;

			const decision = parseDecisionLog(content);

			expect(decision.context).toBe("Some context.");
			expect(decision.decision).toBe("");
			expect(decision.consequences).toBe("");
			expect(decision.alternatives).toBeUndefined();
		});
	});
});

describe("Markdown Serializer", () => {
	describe("serializeTask", () => {
		it("should serialize a task correctly", () => {
			const task: Task = {
				id: "task-1",
				title: "Test Task",
				status: "To Do",
				assignee: ["@developer"],
				reporter: "@manager",
				createdDate: "2025-06-03",
				labels: ["bug", "frontend"],
				milestone: "v1.0",
				dependencies: ["task-0"],
				description: "This is a test task description.",
			};

			const result = serializeTask(task);

			expect(result).toContain("id: task-1");
			expect(result).toContain("title: Test Task");
			expect(result).toContain("status: To Do");
			expect(result).toContain("created_date: '2025-06-03'");
			expect(result).toContain("labels:");
			expect(result).toContain("- bug");
			expect(result).toContain("- frontend");
			expect(result).toContain("This is a test task description.");
		});

		it("should serialize task with subtasks", () => {
			const task: Task = {
				id: "task-parent",
				title: "Parent Task",
				status: "In Progress",
				assignee: [],
				createdDate: "2025-06-03",
				labels: [],
				dependencies: [],
				description: "A parent task with subtasks.",
				subtasks: ["task-parent.1", "task-parent.2"],
			};

			const result = serializeTask(task);

			expect(result).toContain("subtasks:");
			expect(result).toContain("- task-parent.1");
			expect(result).toContain("- task-parent.2");
		});

		it("should serialize task with parent", () => {
			const task: Task = {
				id: "task-1.1",
				title: "Subtask",
				status: "To Do",
				assignee: [],
				createdDate: "2025-06-03",
				labels: [],
				dependencies: [],
				description: "A subtask.",
				parentTaskId: "task-1",
			};

			const result = serializeTask(task);

			expect(result).toContain("parent_task_id: task-1");
		});

		it("should serialize minimal task", () => {
			const task: Task = {
				id: "task-minimal",
				title: "Minimal Task",
				status: "Draft",
				assignee: [],
				createdDate: "2025-06-03",
				labels: [],
				dependencies: [],
				description: "Minimal task.",
			};

			const result = serializeTask(task);

			expect(result).toContain("id: task-minimal");
			expect(result).toContain("title: Minimal Task");
			expect(result).toContain("assignee: []");
			expect(result).not.toContain("reporter:");
			expect(result).not.toContain("updated_date:");
		});
	});

	describe("serializeDecisionLog", () => {
		it("should serialize a decision log correctly", () => {
			const decision: DecisionLog = {
				id: "decision-1",
				title: "Use TypeScript",
				date: "2025-06-03",
				status: "accepted",
				context: "We need type safety",
				decision: "Use TypeScript",
				consequences: "Better DX",
			};

			const result = serializeDecisionLog(decision);

			expect(result).toContain("id: decision-1");
			expect(result).toContain("## Context");
			expect(result).toContain("We need type safety");
			expect(result).toContain("## Decision");
			expect(result).toContain("Use TypeScript");
		});

		it("should serialize decision log with alternatives", () => {
			const decision: DecisionLog = {
				id: "decision-2",
				title: "Database Choice",
				date: "2025-06-03",
				status: "accepted",
				context: "Need database",
				decision: "PostgreSQL",
				consequences: "Good performance",
				alternatives: "Considered MongoDB",
			};

			const result = serializeDecisionLog(decision);

			expect(result).toContain("## Alternatives");
			expect(result).toContain("Considered MongoDB");
		});
	});

	describe("serializeDocument", () => {
		it("should serialize a document correctly", () => {
			const document: Document = {
				id: "doc-1",
				title: "API Documentation",
				type: "specification",
				createdDate: "2025-06-07",
				updatedDate: "2025-06-08",
				content: "This document describes the API endpoints.",
				tags: ["api", "docs"],
			};

			const result = serializeDocument(document);

			expect(result).toContain("id: doc-1");
			expect(result).toContain("title: API Documentation");
			expect(result).toContain("type: specification");
			expect(result).toContain("created_date: '2025-06-07'");
			expect(result).toContain("updated_date: '2025-06-08'");
			expect(result).toContain("tags:");
			expect(result).toContain("- api");
			expect(result).toContain("- docs");
			expect(result).toContain("This document describes the API endpoints.");
		});

		it("should serialize document without optional fields", () => {
			const document: Document = {
				id: "doc-2",
				title: "Simple Doc",
				type: "guide",
				createdDate: "2025-06-07",
				content: "Simple content.",
			};

			const result = serializeDocument(document);

			expect(result).toContain("id: doc-2");
			expect(result).not.toContain("updated_date:");
			expect(result).not.toContain("tags:");
		});
	});

	describe("updateTaskAcceptanceCriteria", () => {
		it("should add acceptance criteria to content without existing section", () => {
			const content = "# Task Description\n\nThis is a simple task.";
			const criteria = ["Login works correctly", "Error handling is proper"];

			const result = updateTaskAcceptanceCriteria(content, criteria);

			expect(result).toContain("## Acceptance Criteria");
			expect(result).toContain("- [ ] Login works correctly");
			expect(result).toContain("- [ ] Error handling is proper");
		});

		it("should replace existing acceptance criteria section", () => {
			const content = `# Task Description

This is a task with existing criteria.

## Acceptance Criteria

- [ ] Old criterion 1
- [ ] Old criterion 2

## Notes

Some additional notes.`;

			const criteria = ["New criterion 1", "New criterion 2"];

			const result = updateTaskAcceptanceCriteria(content, criteria);

			expect(result).toContain("- [ ] New criterion 1");
			expect(result).toContain("- [ ] New criterion 2");
			expect(result).not.toContain("Old criterion 1");
			expect(result).toContain("## Notes");
		});

		it("should handle empty criteria array", () => {
			const content = "# Task Description\n\nSimple task.";
			const criteria: string[] = [];

			const result = updateTaskAcceptanceCriteria(content, criteria);

			expect(result).toContain("## Acceptance Criteria");
			expect(result).not.toContain("- [ ]");
		});
	});
});
