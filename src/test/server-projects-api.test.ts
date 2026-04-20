import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { FileSystem } from "../file-system/operations.ts";
import { BacklogServer } from "../server/index.ts";
import type { Task } from "../types/index.ts";
import { writeProjectRegistry } from "../utils/project-registry.ts";
import { createUniqueTestDir, retry, safeCleanup } from "./test-utils.ts";

interface ProjectsResponse {
	defaultProject?: string;
	projects: Array<{
		key: string;
		path?: string;
		projectName?: string;
	}>;
}

const createTask = (id: string, title: string, status = "To Do"): Task => ({
	id,
	title,
	status,
	assignee: [],
	labels: [],
	dependencies: [],
	createdDate: "2026-04-20",
	description: title,
});

let testDir: string;
let server: BacklogServer | null = null;
let serverPort = 0;

async function createProjectBacklog(
	projectKey: string,
	projectName: string,
	statuses: string[],
	task: Task,
): Promise<void> {
	const backlogRoot = join(testDir, "backlog", projectKey);
	await mkdir(backlogRoot, { recursive: true });

	const filesystem = new FileSystem(testDir, { backlogRoot });
	await filesystem.ensureBacklogStructure();
	await filesystem.saveConfig({
		projectName,
		statuses,
		labels: [],
		milestones: [],
		dateFormat: "YYYY-MM-DD",
		remoteOperations: false,
	});
	await filesystem.saveTask(task);
}

async function fetchJson<T>(path: string, init?: RequestInit): Promise<T> {
	const response = await fetch(`http://127.0.0.1:${serverPort}${path}`, init);
	if (!response.ok) {
		throw new Error(`Request failed: ${response.status}`);
	}
	return response.json();
}

describe("BacklogServer project-aware APIs", () => {
	beforeEach(async () => {
		testDir = createUniqueTestDir("server-projects-api");
		await mkdir(join(testDir, "backlog"), { recursive: true });

		await writeProjectRegistry(testDir, {
			version: 1,
			defaultProject: "web",
			projects: [
				{ key: "web", path: "apps/web" },
				{ key: "ops", path: "apps/ops" },
			],
		});

		await createProjectBacklog(
			"web",
			"Web Project",
			["To Do", "In Progress", "Done"],
			createTask("task-1", "Ship web tabs", "In Progress"),
		);
		await createProjectBacklog(
			"ops",
			"Ops Project",
			["Queued", "Doing", "Done"],
			createTask("task-2", "Prepare ops rollout", "Queued"),
		);

		server = new BacklogServer(testDir, {
			backlogRoot: join(testDir, "backlog", "web"),
		});
		await server.start(0, false);
		serverPort = server.getPort() ?? 0;
		expect(serverPort).toBeGreaterThan(0);

		await retry(async () => {
			const config = await fetchJson<{ projectName: string }>("/api/config");
			expect(config.projectName).toBe("Web Project");
			return config;
		});
	});

	afterEach(async () => {
		if (server) {
			await server.stop();
			server = null;
		}
		await safeCleanup(testDir);
	});

	it("lists projects and resolves GET requests against the requested project", async () => {
		const projects = await fetchJson<ProjectsResponse>("/api/projects");
		expect(projects.defaultProject).toBe("web");
		expect(projects.projects).toEqual([
			{ key: "web", path: "apps/web", projectName: "Web Project" },
			{ key: "ops", path: "apps/ops", projectName: "Ops Project" },
		]);

		const defaultConfig = await fetchJson<{ projectName: string }>("/api/config");
		expect(defaultConfig.projectName).toBe("Web Project");

		const opsConfig = await fetchJson<{ projectName: string }>("/api/config?project=ops");
		expect(opsConfig.projectName).toBe("Ops Project");

		const opsStatuses = await fetchJson<string[]>("/api/statuses?project=ops");
		expect(opsStatuses).toEqual(["Queued", "Doing", "Done"]);

		const opsTasks = await fetchJson<Task[]>("/api/tasks?project=ops");
		expect(opsTasks).toHaveLength(1);
		expect(opsTasks[0]?.title).toBe("Prepare ops rollout");

		const searchResults = await retry(async () => {
			const results = await fetchJson<Array<{ type: string; task?: Task }>>("/api/search?project=ops&query=rollout");
			expect(results.some((result) => result.type === "task" && result.task?.title === "Prepare ops rollout")).toBe(
				true,
			);
			return results;
		});
		expect(searchResults.length).toBeGreaterThan(0);
	});

	it("routes create requests using body.project without leaking into the initial project", async () => {
		const created = await fetchJson<Task>("/api/tasks", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				project: "ops",
				title: "Body routed task",
				status: "Queued",
			}),
		});
		expect(created.title).toBe("Body routed task");

		const opsTasks = await fetchJson<Task[]>("/api/tasks?project=ops");
		expect(opsTasks.map((task) => task.title)).toContain("Body routed task");

		const webTasks = await fetchJson<Task[]>("/api/tasks?project=web");
		expect(webTasks.map((task) => task.title)).not.toContain("Body routed task");
	});
});
