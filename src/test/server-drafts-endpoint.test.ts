import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { join } from "node:path";
import { Core } from "../core/backlog.ts";
import { FileSystem } from "../file-system/operations.ts";
import { serializeTask } from "../markdown/serializer.ts";
import { BacklogServer } from "../server/index.ts";
import type { Task } from "../types/index.ts";
import { createUniqueTestDir, retry, safeCleanup } from "./test-utils.ts";

let TEST_DIR: string;
let core: Core;
let server: BacklogServer | null = null;
let serverPort = 0;

async function request(path: string, init?: RequestInit): Promise<Response> {
	return await fetch(`http://127.0.0.1:${serverPort}${path}`, init);
}

async function put(path: string, body: unknown): Promise<Response> {
	return await request(path, {
		method: "PUT",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify(body),
	});
}

describe("BacklogServer draft task endpoints", () => {
	beforeEach(async () => {
		TEST_DIR = createUniqueTestDir("server-drafts");
		const filesystem = new FileSystem(TEST_DIR);
		await filesystem.ensureBacklogStructure();
		await filesystem.saveConfig({
			projectName: "Server Drafts",
			statuses: ["To Do", "In Progress", "Done"],
			labels: [],
			milestones: [],
			dateFormat: "YYYY-MM-DD",
			remoteOperations: false,
			autoCommit: false,
		});

		core = new Core(TEST_DIR);

		server = new BacklogServer(TEST_DIR);
		await server.start(0, false);
		const port = server.getPort();
		expect(port).not.toBeNull();
		serverPort = port ?? 0;

		await retry(async () => {
			const response = await request("/api/drafts");
			expect(response.status).toBe(200);
		});
	});

	afterEach(async () => {
		if (server) {
			await server.stop();
			server = null;
		}
		await safeCleanup(TEST_DIR);
	});

	// Reporter flow from issue #915: create a draft, then edit it from the web Drafts page.
	it("saves an edit to the second draft instead of reporting it as a missing task", async () => {
		await core.createTaskFromInput({ title: "First draft", status: "Draft" });
		await core.createTaskFromInput({ title: "Second draft", status: "Draft" });

		const read = await request("/api/tasks/DRAFT-2");
		expect(read.status).toBe(200);
		expect(((await read.json()) as Task).title).toBe("Second draft");

		const saved = await put("/api/tasks/DRAFT-2", {
			title: "Second draft edited",
			description: "Edited from the drafts page",
			status: "Draft",
			acceptanceCriteriaItems: [{ text: "Draft edits persist", checked: false }],
		});
		expect(saved.status).toBe(200);
		const updated = (await saved.json()) as Task;
		expect(updated.id).toBe("DRAFT-2");
		expect(updated.title).toBe("Second draft edited");
		expect(updated.status).toBe("Draft");

		const stored = await core.filesystem.loadDraft("DRAFT-2");
		expect(stored?.title).toBe("Second draft edited");
		expect(stored?.description).toContain("Edited from the drafts page");
		expect(stored?.acceptanceCriteriaItems?.[0]?.text).toBe("Draft edits persist");

		// The edit must not move the draft into the task folder.
		expect(await core.filesystem.loadTask("DRAFT-2")).toBeNull();
		const drafts = (await (await request("/api/drafts")).json()) as Task[];
		expect(drafts.map((draft) => draft.title)).toEqual(["First draft", "Second draft edited"]);
	});

	it("promotes a draft when the request sets a configured status", async () => {
		await core.createTaskFromInput({ title: "Promote me", status: "Draft" });

		const response = await put("/api/tasks/DRAFT-1", { title: "Promote me", status: "To Do" });
		expect(response.status).toBe(200);
		const promoted = (await response.json()) as Task;
		expect(promoted.id).toBe("TASK-1");
		expect(promoted.status).toBe("To Do");

		expect(await core.filesystem.loadDraft("DRAFT-1")).toBeNull();
		expect((await request("/api/tasks/TASK-1")).status).toBe(200);
	});

	it("keeps a prefix-less id pointing at the task with that number", async () => {
		await core.createTaskFromInput({ title: "Real task one", status: "To Do" });
		await core.createTaskFromInput({ title: "Only draft", status: "Draft" });

		const read = await request("/api/tasks/1");
		expect(read.status).toBe(200);
		expect(((await read.json()) as Task).id).toBe("TASK-1");

		const response = await put("/api/tasks/1", { title: "Real task one edited" });
		expect(response.status).toBe(200);
		expect(((await response.json()) as Task).id).toBe("TASK-1");
		expect((await core.filesystem.loadDraft("DRAFT-1"))?.title).toBe("Only draft");
	});

	it("fails closed on duplicate numeric draft identities instead of mutating an arbitrary match", async () => {
		await core.createTaskFromInput({ title: "Alpha one", status: "Draft" });
		const draftsDir = await core.filesystem.getDraftsDir();
		const twinPath = join(draftsDir, "draft-001 - Alpha two.md");
		await Bun.write(
			twinPath,
			serializeTask({
				id: "DRAFT-001",
				title: "Alpha two",
				status: "Draft",
				assignee: [],
				createdDate: "2026-08-24 10:00",
				labels: [],
				dependencies: [],
			}),
		);

		const edit = await put("/api/tasks/DRAFT-1", { title: "Hijacked" });
		expect(edit.status).toBe(409);
		expect(((await edit.json()) as { error: string }).error).toContain("is ambiguous");

		expect((await core.filesystem.loadDraft("DRAFT-1"))?.title).toBe("Alpha one");
		expect(await Bun.file(twinPath).text()).toContain("Alpha two");

		// The promote endpoint surfaces the same conflict instead of moving either file.
		const promote = await request("/api/drafts/DRAFT-001/promote", { method: "POST" });
		expect(promote.status).toBe(409);
		expect(((await promote.json()) as { error: string }).error).toContain("is ambiguous");
		expect(await Bun.file(join(draftsDir, "draft-1 - Alpha-one.md")).exists()).toBe(true);
		expect(await Bun.file(twinPath).exists()).toBe(true);
	});

	it("reports an unknown draft id as missing", async () => {
		const read = await request("/api/tasks/DRAFT-9");
		expect(read.status).toBe(404);

		const write = await put("/api/tasks/DRAFT-9", { title: "Nope" });
		expect(write.status).toBe(400);
	});
});
