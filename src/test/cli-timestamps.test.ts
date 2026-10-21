import { afterEach, beforeEach, describe, expect, it, setSystemTime } from "bun:test";
import { join } from "node:path";
import { Core } from "../core/backlog.ts";
import { parseFrontmatter } from "../markdown/frontmatter.ts";
import { parseTask } from "../markdown/parser.ts";
import { formatUtcDateForDisplay } from "../utils/utc-date-display.ts";
import { formatStoredDateForDisplay } from "../web/utils/date-display.ts";
import { getTestCliPath } from "./test-cli.ts";
import { createTestDirOutsideRepository, safeCleanup } from "./test-utils.ts";

const CLI_PATH = getTestCliPath();
const UTC_TIMESTAMP = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:00Z$/;

describe("stored UTC timestamps", () => {
	let testDir: string;
	let core: Core;

	async function cli(...args: string[]): Promise<string> {
		const child = Bun.spawn([process.execPath, CLI_PATH, ...args], {
			cwd: testDir,
			env: { ...process.env, TZ: "Asia/Taipei" },
			stdout: "pipe",
			stderr: "pipe",
		});
		const [stdout, stderr, code] = await Promise.all([
			new Response(child.stdout).text(),
			new Response(child.stderr).text(),
			child.exited,
		]);
		if (code !== 0) throw new Error(`${args.join(" ")}: ${stderr}`);
		return stdout;
	}

	beforeEach(async () => {
		testDir = await createTestDirOutsideRepository("cli-timestamps");
		await cli("init", "UTC timestamps", "--defaults", "--no-git", "--integration-mode", "none");
		core = new Core(testDir);
	});

	afterEach(async () => {
		setSystemTime();
		await safeCleanup(testDir);
	});

	it("writes explicit UTC through CLI create, edit and comments on a non-UTC host", async () => {
		await cli("task", "create", "Ship release", "--due-date", "2026-10-20", "--plain");
		await cli("task", "edit", "1", "--comment", "Ready for review", "--plain");
		const task = await core.filesystem.loadTask("task-1");
		if (!task?.filePath) throw new Error("Expected created task file");
		const raw = await Bun.file(task.filePath).text();
		expect(task.createdDate).toMatch(UTC_TIMESTAMP);
		expect(task.updatedDate).toMatch(UTC_TIMESTAMP);
		expect(task.comments?.[0]?.createdDate).toMatch(UTC_TIMESTAMP);
		expect(raw).toContain(`created_date: '${task.createdDate}'`);
		expect(raw).toContain(`updated_date: '${task.updatedDate}'`);
		expect(raw).toContain(`created: ${task.comments?.[0]?.createdDate}`);
		expect(raw).toContain("due_date: '2026-10-20'");
		const { task: json } = JSON.parse(await cli("task", "view", "1", "--json"));
		expect(json.createdAt).toBe(task.createdDate);
		expect(json.updatedAt).toBe(task.updatedDate);
		expect(json.comments[0].createdAt).toBe(task.comments?.[0]?.createdDate);
		expect(json.dueDate).toBe("2026-10-20");
		const plain = await cli("task", "view", "1", "--plain");
		expect(plain).toContain(`Created: ${formatUtcDateForDisplay(task.createdDate)} (UTC)`);
		expect(formatStoredDateForDisplay(task.createdDate, { timeZone: "Asia/Taipei" }).title).toBe(
			`${formatUtcDateForDisplay(task.createdDate)} (UTC)`,
		);
	});

	it("preserves historical creation values on read and edit, including midnight and date-only values", async () => {
		const values = [
			["2026-10-18 00:00", "2026-10-18T00:00:00Z"],
			["2026-10-18T00:00", "2026-10-18T00:00:00Z"],
			["2026-10-18T00:00:00Z", "2026-10-18T00:00:00Z"],
			["2026-10-18t00:00:00", "2026-10-18T00:00:00Z"],
			["2026-10-18  08:00:00 +08:00", "2026-10-18T00:00:00Z"],
			["2026-10-18", "2026-10-18"],
		] as const;
		for (const [index, [created, publicDate]] of values.entries()) {
			const id = index + 1;
			const path = join(testDir, "backlog", "tasks", `task-${id} - Legacy.md`);
			const original = `---\nid: TASK-${id}\ntitle: Legacy\nstatus: To Do\ncreated_date: ${created}\ndue_date: '2026-10-20'\n---\n`;
			await Bun.write(path, original);
			const { task } = JSON.parse(await cli("task", "view", String(id), "--json"));
			expect(task.createdAt).toBe(publicDate);
			expect(task.dueDate).toBe("2026-10-20");
			if (publicDate.includes("T")) {
				const utcDisplay = publicDate.slice(0, 16).replace("T", " ");
				expect(await cli("task", "view", String(id), "--plain")).toContain(`Created: ${utcDisplay} (UTC)`);
				expect(formatStoredDateForDisplay(created, { timeZone: "Asia/Taipei" }).title).toBe(`${utcDisplay} (UTC)`);
			}
			expect(await Bun.file(path).text()).toBe(original);
			await cli("task", "edit", String(id), "--notes", "Reviewed");
			const raw = await Bun.file(path).text();
			expect(parseTask(raw).createdDate).toBe(created);
			expect(parseFrontmatter(raw).data.created_date).toBe(created);
			expect(parseTask(raw).updatedDate).toMatch(UTC_TIMESTAMP);
			expect(parseTask(raw).dueDate).toBe("2026-10-20");
		}
	});

	it("writes draft, document and decision timestamps and preserves opaque document metadata", async () => {
		await cli("task", "create", "Draft", "--draft");
		expect((await core.filesystem.loadDraft("draft-1"))?.createdDate).toMatch(UTC_TIMESTAMP);
		await cli("doc", "create", "Guide", "--plain");
		const doc = await core.getDocument("doc-1");
		if (!doc?.path) throw new Error("Expected created document");
		expect(doc.createdDate).toMatch(UTC_TIMESTAMP);
		const path = join(core.filesystem.docsDir, doc.path);
		const opaque = "custom_timestamp: &stamp 2026-10-18T00:00:00-08:00\ncustom_alias: *stamp\n";
		const original = (await Bun.file(path).text())
			.replace(/created_date:.*\n/, "created_date: 2026-10-18T00:00:00Z\n")
			.replace(/\n---\n/, `\n${opaque}---\n`);
		await Bun.write(path, original);
		await cli("doc", "update", "doc-1", "--content", "Updated guide");
		const updatedRaw = await Bun.file(path).text();
		expect(updatedRaw).toContain(opaque);
		expect(parseFrontmatter(updatedRaw).data.custom_timestamp).toBeInstanceOf(Date);
		const updated = await core.getDocument("doc-1");
		expect(updated?.createdDate).toBe("2026-10-18T00:00:00Z");
		expect(updated?.updatedDate).toMatch(UTC_TIMESTAMP);
		await cli("decision", "create", "Use UTC", "--plain");
		expect((await core.getDecision("decision-1"))?.date).toMatch(UTC_TIMESTAMP);
	});

	it("keeps a comment before an unquoted timestamp outside the stored date value", async () => {
		for (const [index, created] of ["2026-10-19T00:00:00Z", "2026-10-19T01:23:00Z"].entries()) {
			const id = String(index + 1);
			const path = join(testDir, "backlog", "tasks", `task-${id} - Commented.md`);
			const original = `---\nid: TASK-${id}\ntitle: Commented\nstatus: To Do\ncreated_date: # created at\n  ${created}\n---\n`;
			await Bun.write(path, original);
			expect(JSON.parse(await cli("task", "view", id, "--json")).task.createdAt).toBe(created);
			expect(await Bun.file(path).text()).toBe(original);
			await cli("task", "edit", id, "--notes", "Reviewed");
			expect(parseTask(await Bun.file(path).text()).createdDate).toBe(created);
		}
	});

	it("keeps newly generated UTC midnight as a timestamp with minute precision", async () => {
		setSystemTime(new Date("2026-10-19T00:00:49.123Z"));
		const { task } = await core.createTaskFromInput({ title: "Midnight" });
		expect(task.createdDate).toBe("2026-10-19T00:00:00Z");
		expect((await core.filesystem.loadTask(task.id))?.createdDate).toBe("2026-10-19T00:00:00Z");
		const doc = await core.createDocumentFromInput({ title: "Midnight guide" });
		expect(doc.createdDate).toBe("2026-10-19T00:00:00Z");
		expect((await core.createDecisionWithTitle("Midnight choice")).date).toBe("2026-10-19T00:00:00Z");
	});
});
