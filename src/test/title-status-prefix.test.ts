import { describe, expect, it } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Core } from "../core/backlog.ts";
import { withStatusPrefix } from "../web/utils/title-status-prefix.ts";
import { initializeTestProject } from "./test-utils.ts";

const statuses = ["To Do", "In Progress", "Done"];

describe("withStatusPrefix", () => {
	it("leaves the title untouched when the option is off", () => {
		expect(withStatusPrefix("Fix chart flash", "Done", statuses, false)).toBe("Fix chart flash");
	});

	it("prepends the new status when enabled", () => {
		expect(withStatusPrefix("Fix chart flash", "In Progress", statuses, true)).toBe("[In Progress] Fix chart flash");
	});

	it("replaces an existing status prefix", () => {
		expect(withStatusPrefix("[To Do] Fix chart flash", "Done", statuses, true)).toBe("[Done] Fix chart flash");
	});

	it("matches an existing status prefix case-insensitively", () => {
		expect(withStatusPrefix("[done] Fix chart flash", "To Do", statuses, true)).toBe("[To Do] Fix chart flash");
	});

	it("keeps a user's own bracket prefix that is not a status", () => {
		expect(withStatusPrefix("[feature] Fix chart flash", "Done", statuses, true)).toBe(
			"[Done] [feature] Fix chart flash",
		);
	});
});

describe("title_status_prefix config", () => {
	it("round-trips through config storage and defaults to off", async () => {
		const testDir = await mkdtemp(join(tmpdir(), "backlog-title-status-prefix-"));
		const core = new Core(testDir);
		try {
			await initializeTestProject(core, "Title Prefix");
			const original = await core.fs.loadConfig();
			expect(original?.titleStatusPrefix).toBeUndefined();
			await core.fs.saveConfig({ ...original!, titleStatusPrefix: true });
			const persisted = await new Core(testDir).fs.loadConfig();
			expect(persisted?.titleStatusPrefix).toBe(true);
		} finally {
			await rm(testDir, { force: true, recursive: true });
		}
	});
});
