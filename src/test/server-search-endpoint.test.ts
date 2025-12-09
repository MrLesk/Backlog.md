import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { FileSystem } from "../file-system/operations.ts";
import { BacklogServer } from "../server/index.ts";
import type { Decision, Document, Task } from "../types/index.ts";
import { createUniqueTestDir, retry, safeCleanup } from "./test-utils.ts";

let TEST_DIR: string;
let server: BacklogServer | null = null;
let filesystem: FileSystem;
let serverPort = 0;

const baseTask: Task = {
	id: "task-0007",
	title: "Server search task",
	status: "In Progress",
	assignee: ["@codex"],
	reporter: "@codex",
	createdDate: "2025-09-20 10:00",
	updatedDate: "2025-09-20 10:00",
	plannedStart: "2025-09-21",
	plannedEnd: "2025-09-22 15:00",
	labels: ["search"],
	dependencies: [],
	description: "Alpha token appears here",
	priority: "high",
};

const baseDoc: Document = {
	id: "doc-9001",
	title: "Search Handbook",
	type: "guide",
	createdDate: "2025-09-20",
	updatedDate: "2025-09-20",
	rawContent: "# Guide\nAlpha document guidance",
};

const baseDecision: Decision = {
	id: "decision-9001",
	title: "Centralize search",
	date: "2025-09-19",
	status: "accepted",
	context: "Need consistent Alpha search coverage",
	decision: "Adopt shared Fuse service",
	consequences: "Shared index",
	rawContent: "## Context\nAlpha adoption",
};

const dependentTask: Task = {
	id: "task-0008",
	title: "Follow-up integration",
	status: "In Progress",
	assignee: ["@codex"],
	reporter: "@codex",
	createdDate: "2025-09-20 10:30",
	updatedDate: "2025-09-20 10:30",
	labels: ["search"],
	dependencies: [baseTask.id],
	description: "Depends on task-0007 for completion",
	priority: "medium",
};

describe("BacklogServer search endpoint", () => {
	beforeEach(async () => {
		TEST_DIR = createUniqueTestDir("server-search");
		filesystem = new FileSystem(TEST_DIR);
		await filesystem.ensureBacklogStructure();
		await filesystem.saveConfig({
			projectName: "Server Search",
			statuses: ["To Do", "In Progress", "Done"],
			labels: [],
			milestones: [],
			dateFormat: "YYYY-MM-DD",
			remoteOperations: false,
		});

		await filesystem.saveTask(baseTask);
		await filesystem.saveTask(dependentTask);
		await filesystem.saveDocument(baseDoc);
		await filesystem.saveDecision(baseDecision);

		server = new BacklogServer(TEST_DIR);
		await server.start(0, false);
		const port = server.getPort();
		expect(port).not.toBeNull();
		serverPort = port ?? 0;
		expect(serverPort).toBeGreaterThan(0);

		await retry(
			async () => {
				const tasks = await fetchJson<Task[]>("/api/tasks");
				expect(tasks.length).toBeGreaterThan(0);
				return tasks;
			},
			10,
			100,
		);
	});

	afterEach(async () => {
		if (server) {
			await server.stop();
			server = null;
		}
		await safeCleanup(TEST_DIR);
	});

	it("returns tasks, documents, and decisions from the shared search service", async () => {
		const results = await retry(
			async () => {
				const data = await fetchJson<Array<{ type?: string }>>("/api/search?query=alpha");
				const typeSet = new Set(data.map((item) => item.type));
				if (!typeSet.has("task") || !typeSet.has("document") || !typeSet.has("decision")) {
					throw new Error("Search results not yet indexed for all types");
				}
				return data;
			},
			20,
			100,
		);
		const finalTypes = new Set(results.map((item) => item.type));
		expect(finalTypes.has("task")).toBe(true);
		expect(finalTypes.has("document")).toBe(true);
		expect(finalTypes.has("decision")).toBe(true);
	});

	it("filters search results by priority and status", async () => {
		const url = "/api/search?type=task&status=In%20Progress&priority=high&query=search";
		const results = await fetchJson<Array<{ type: string; task?: Task }>>(url);
		expect(results).toHaveLength(1);
		expect(results[0]?.type).toBe("task");
		expect(results[0]?.task?.id).toBe(baseTask.id);
	});

	it("filters task listings by priority via the content store", async () => {
		const tasks = await fetchJson<Task[]>("/api/tasks?priority=high");
		expect(tasks).toHaveLength(1);
		expect(tasks[0]?.id).toBe(baseTask.id);
	});

	it("rejects unsupported priority filters with 400", async () => {
		await expect(fetchJson<Task[]>("/api/tasks?priority=urgent")).rejects.toThrow();
	});

	it("supports zero-padded ids and dependency-aware search", async () => {
		const viaLooseId = await fetchJson<Task>("/api/task/7");
		expect(viaLooseId.id).toBe(baseTask.id);

		const paddedViaSearch = await fetchJson<Array<{ type: string; task?: Task }>>("/api/search?type=task&query=task-7");
		const paddedIds = paddedViaSearch.filter((result) => result.type === "task").map((result) => result.task?.id);
		expect(paddedIds).toContain(baseTask.id);

		const shortQueryResults = await fetchJson<Array<{ type: string; task?: Task }>>("/api/search?type=task&query=7");
		const shortIds = shortQueryResults.filter((result) => result.type === "task").map((result) => result.task?.id);
		expect(shortIds).toContain(baseTask.id);

		const dependencyMatches = await fetchJson<Array<{ type: string; task?: Task }>>(
			"/api/search?type=task&query=task-0007",
		);
		const dependencyIds = dependencyMatches
			.filter((result) => result.type === "task")
			.map((result) => result.task?.id)
			.filter((id): id is string => Boolean(id));
		expect(dependencyIds).toEqual(expect.arrayContaining([baseTask.id, dependentTask.id]));
	});

	it("returns newly created tasks immediately after POST", async () => {
		const createResponse = await fetch(`http://127.0.0.1:${serverPort}/api/tasks`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				title: "Immediate fetch",
				status: "In Progress",
				description: "Immediate availability",
				plannedStart: "2025-10-01",
				plannedEnd: "2025-10-05",
			}),
		});
		expect(createResponse.ok).toBe(true);
		const created = (await createResponse.json()) as Task;
		expect(created.title).toBe("Immediate fetch");
		expect(created.plannedStart).toBe("2025-10-01");
		expect(created.plannedEnd).toBe("2025-10-05");
		const shortId = created.id.replace(/^task-/, "");
		const fetched = await fetchJson<Task>(`/api/task/${shortId}`);
		expect(fetched.id).toBe(created.id);
		expect(fetched.title).toBe("Immediate fetch");
		expect(fetched.plannedStart).toBe("2025-10-01");
		expect(fetched.plannedEnd).toBe("2025-10-05");
	});

	it("rebuilds the Fuse index when markdown content changes", async () => {
		await filesystem.saveDocument({
			...baseDoc,
			rawContent: "# Guide\nReindexed beta token",
		});

		await retry(
			async () => {
				const updated = await fetchJson<Array<{ type?: string }>>("/api/search?query=beta");
				if (!updated.some((item) => item.type === "document")) {
					throw new Error("Document not yet reindexed");
				}
				return updated;
			},
			40,
			125,
		);
	});
});

async function fetchJson<T>(path: string): Promise<T> {
	const response = await fetch(`http://127.0.0.1:${serverPort}${path}`);
	if (!response.ok) {
		throw new Error(`Request failed: ${response.status}`);
	}
	return response.json();
}
