import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { lstat, mkdtemp, readdir, readFile, rm, symlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Core } from "../core/backlog.ts";
import { initializeTestProject, isWindows } from "./test-utils.ts";

describe("decision write preflight", () => {
	let directory: string;
	let external: string;
	let core: Core;
	beforeEach(async () => {
		directory = await mkdtemp(join(tmpdir(), "decision-preflight-"));
		external = await mkdtemp(join(tmpdir(), "decision-external-"));
		core = new Core(directory);
		await initializeTestProject(core, "Preflight");
		await core.createDecisionFromInput({ title: "Example" });
	});
	afterEach(async () => {
		await rm(directory, { recursive: true, force: true });
		await rm(external, { recursive: true, force: true });
	});

	it.each(["create", "update"])("refuses %s before writing when config is invalid", async (operation) => {
		const path = join(core.fs.decisionsDir, "decision-1 - Example.md");
		const original = await readFile(path, "utf8");
		const configPath = join(core.fs.backlogDir, "config.yml");
		await Bun.write(configPath, 'project_name: "Preflight"\nstatuses: ["To Do]\n');
		core.fs.invalidateConfigCache();
		const result =
			operation === "create"
				? core.createDecisionFromInput({ title: "New" })
				: core.updateDecisionFromInput("decision-1", { context: "New context" });
		await expect(result).rejects.toThrow("invalid value");
		expect(await readdir(core.fs.decisionsDir)).toEqual(["decision-1 - Example.md"]);
		expect(await readFile(path, "utf8")).toBe(original);
	});

	it.skipIf(isWindows())(
		"refuses an external file before editing with auto-commit and allows it when disabled",
		async () => {
			const path = join(core.fs.decisionsDir, "decision-1 - Example.md");
			const original = await readFile(path, "utf8");
			const target = join(external, "shared.md");
			await Bun.write(target, original);
			await rm(path);
			await symlink(target, path);
			await expect(core.updateDecisionFromInput("decision-1", { context: "Changed" }, true)).rejects.toThrow(
				"backlog config set autoCommit false",
			);
			expect(await readFile(target, "utf8")).toBe(original);
			expect((await lstat(path)).isSymbolicLink()).toBe(true);
			await core.updateDecisionFromInput("decision-1", { context: "Changed" }, false);
			expect((await core.getDecision("decision-1"))?.context).toBe("Changed");
			expect((await lstat(path)).isSymbolicLink()).toBe(true);
		},
	);
});
