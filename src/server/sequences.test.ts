import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { Task } from "../types/index.ts";
import { BacklogServer } from "./index.ts";

const TEST_DIR = join(import.meta.dir, "../../.test-sequences-api");
const BACKLOG_DIR = join(TEST_DIR, "backlog");
const TASKS_DIR = join(BACKLOG_DIR, "tasks");

async function createTestTask(id: string, data: Partial<Task> = {}): Promise<void> {
	const task: Task = {
		id,
		title: `Test Task ${id}`,
		status: "To Do",
		assignee: [],
		createdDate: "2025-01-01",
		labels: [],
		dependencies: [],
		body: "",
		acceptanceCriteria: [],
		...data,
	};

	const frontMatter: any = {
		id: task.id,
		title: task.title,
		status: task.status,
		assignee: task.assignee,
		created_date: task.createdDate,
		labels: task.labels,
		dependencies: task.dependencies,
	};

	// Only add priority if it exists
	if (task.priority) {
		frontMatter.priority = task.priority;
	}

	const content = `---
id: ${frontMatter.id}
title: ${frontMatter.title}
status: ${frontMatter.status}
assignee: ${JSON.stringify(frontMatter.assignee)}
created_date: ${frontMatter.created_date}
labels: ${JSON.stringify(frontMatter.labels)}
dependencies: ${JSON.stringify(frontMatter.dependencies)}${frontMatter.priority ? `\npriority: ${frontMatter.priority}` : ""}
---

${task.body}`;

	// Use the standard task file naming format: "task-ID - Title.md"
	const filename = `${id} - ${task.title.replace(/[^a-zA-Z0-9 ]/g, "")}.md`;
	await writeFile(join(TASKS_DIR, filename), content);
}

describe("Sequences API", () => {
	let server: BacklogServer;
	let baseUrl: string;

	beforeEach(async () => {
		// Create test directory structure
		await mkdir(TASKS_DIR, { recursive: true });

		// Start server on a specific test port
		const testPort = 9999 + Math.floor(Math.random() * 1000); // Random port between 9999-10999
		server = new BacklogServer(TEST_DIR);
		await server.start(testPort, false); // Specific port, don't open browser
		baseUrl = `http://localhost:${testPort}`;
	});

	afterEach(async () => {
		// Stop server
		server?.stop();

		// Clean up test directory
		await rm(TEST_DIR, { recursive: true, force: true });
	});

	describe("GET /api/sequences", () => {
		it("should return empty sequences for no tasks", async () => {
			const response = await fetch(`${baseUrl}/api/sequences`);
			expect(response.status).toBe(200);

			const data = await response.json();
			expect(data).toHaveProperty("sequences");
			expect(data.sequences).toEqual([]);
		});

		it("should return single sequence for tasks with no dependencies", async () => {
			await createTestTask("task-1");
			await createTestTask("task-2");
			await createTestTask("task-3");

			const response = await fetch(`${baseUrl}/api/sequences`);
			expect(response.status).toBe(200);

			const data = await response.json();
			expect(data.sequences).toHaveLength(1);
			expect(data.sequences[0].number).toBe(1);
			expect(data.sequences[0].tasks).toHaveLength(3);

			const taskIds = data.sequences[0].tasks.map((t: any) => t.id).sort();
			expect(taskIds).toEqual(["task-1", "task-2", "task-3"]);
		});

		it("should return multiple sequences for dependent tasks", async () => {
			await createTestTask("task-1");
			await createTestTask("task-2", { dependencies: ["task-1"] });
			await createTestTask("task-3", { dependencies: ["task-1"] });
			await createTestTask("task-4", { dependencies: ["task-2", "task-3"] });

			const response = await fetch(`${baseUrl}/api/sequences`);
			expect(response.status).toBe(200);

			const data = await response.json();
			expect(data.sequences).toHaveLength(3);

			// Sequence 1: task-1
			expect(data.sequences[0].number).toBe(1);
			expect(data.sequences[0].tasks).toHaveLength(1);
			expect(data.sequences[0].tasks[0].id).toBe("task-1");

			// Sequence 2: task-2, task-3
			expect(data.sequences[1].number).toBe(2);
			expect(data.sequences[1].tasks).toHaveLength(2);
			const seq2Ids = data.sequences[1].tasks.map((t: any) => t.id).sort();
			expect(seq2Ids).toEqual(["task-2", "task-3"]);

			// Sequence 3: task-4
			expect(data.sequences[2].number).toBe(3);
			expect(data.sequences[2].tasks).toHaveLength(1);
			expect(data.sequences[2].tasks[0].id).toBe("task-4");
		});

		it("should include full task data in response", async () => {
			await createTestTask("task-1", {
				title: "Important Task",
				status: "In Progress",
				assignee: ["alice"],
				priority: "high",
				labels: ["urgent", "backend"],
			});

			const response = await fetch(`${baseUrl}/api/sequences`);
			expect(response.status).toBe(200);

			const data = await response.json();
			const task = data.sequences[0].tasks[0];

			expect(task.id).toBe("task-1");
			expect(task.title).toBe("Important Task");
			expect(task.status).toBe("In Progress");
			expect(task.assignee).toEqual(["alice"]);
			expect(task.priority).toBe("high");
			expect(task.labels).toEqual(["urgent", "backend"]);
			expect(task.dependencies).toEqual([]);
		});
	});

	describe("POST /api/sequences/move", () => {
		it("should return 400 for missing taskId", async () => {
			const response = await fetch(`${baseUrl}/api/sequences/move`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ targetSequence: 1 }),
			});

			expect(response.status).toBe(400);
			const data = await response.json();
			expect(data.error).toContain("Missing required fields");
		});

		it("should return 400 for missing targetSequence", async () => {
			const response = await fetch(`${baseUrl}/api/sequences/move`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ taskId: "task-1" }),
			});

			expect(response.status).toBe(400);
			const data = await response.json();
			expect(data.error).toContain("Missing required fields");
		});

		it("should return 404 for non-existent task", async () => {
			const response = await fetch(`${baseUrl}/api/sequences/move`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ taskId: "non-existent", targetSequence: 1 }),
			});

			expect(response.status).toBe(404);
			const data = await response.json();
			expect(data.error).toBe("Task not found");
		});

		it("should return 400 for invalid target sequence", async () => {
			await createTestTask("task-1");

			const response = await fetch(`${baseUrl}/api/sequences/move`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ taskId: "task-1", targetSequence: 5 }),
			});

			expect(response.status).toBe(400);
			const data = await response.json();
			expect(data.error).toContain("Invalid target sequence");
		});

		it("should move task to sequence 1 by removing dependencies", async () => {
			await createTestTask("task-1");
			await createTestTask("task-2", { dependencies: ["task-1"] });

			const response = await fetch(`${baseUrl}/api/sequences/move`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ taskId: "task-2", targetSequence: 1 }),
			});

			expect(response.status).toBe(200);
			const data = await response.json();

			expect(data.success).toBe(true);
			expect(data.task.dependencies).toEqual([]);

			// Check sequences are updated
			expect(data.sequences).toHaveLength(1);
			expect(data.sequences[0].tasks).toHaveLength(2);
		});

		it("should move task to higher sequence by adding dependencies", async () => {
			await createTestTask("task-1");
			await createTestTask("task-2");
			await createTestTask("task-3", { dependencies: ["task-1", "task-2"] });

			const response = await fetch(`${baseUrl}/api/sequences/move`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ taskId: "task-1", targetSequence: 2 }),
			});

			expect(response.status).toBe(200);
			const data = await response.json();

			expect(data.success).toBe(true);
			// task-1 should now depend on task-2 (the only task remaining in sequence 1)
			expect(data.task.dependencies).toEqual(["task-2"]);
		});

		it("should handle moving task that is already in target sequence", async () => {
			await createTestTask("task-1");

			const response = await fetch(`${baseUrl}/api/sequences/move`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ taskId: "task-1", targetSequence: 1 }),
			});

			expect(response.status).toBe(200);
			const data = await response.json();

			expect(data.success).toBe(true);
			expect(data.message).toContain("already in the target sequence");
		});

		it("should prevent circular dependencies", async () => {
			await createTestTask("task-1");
			await createTestTask("task-2", { dependencies: ["task-1"] });
			await createTestTask("task-3", { dependencies: ["task-2"] });

			// Try to move task-1 to depend on task-3 (would create cycle)
			const response = await fetch(`${baseUrl}/api/sequences/move`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ taskId: "task-1", targetSequence: 3 }),
			});

			expect(response.status).toBe(400);
			const data = await response.json();
			expect(data.error).toContain("circular dependencies");
		});

		it("should update task file with new dependencies", async () => {
			await createTestTask("task-1");
			await createTestTask("task-2");

			const response = await fetch(`${baseUrl}/api/sequences/move`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ taskId: "task-2", targetSequence: 2 }),
			});

			expect(response.status).toBe(200);

			// Verify the response shows the task was updated with dependencies
			const data = await response.json();
			expect(data.success).toBe(true);
			expect(data.task.dependencies).toEqual(["task-1"]);
		});
	});
});
