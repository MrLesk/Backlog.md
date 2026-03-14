import { describe, expect, it } from "bun:test";
import { join } from "node:path";
import { resolveUserBacklogConfigPath } from "../utils/backlog-directory.ts";

describe("resolveUserBacklogConfigPath", () => {
	it("uses XDG-style config path on non-Windows platforms", () => {
		const homeDir = "/tmp/backlog-home";
		const path = resolveUserBacklogConfigPath("darwin", {}, homeDir);
		expect(path).toBe(join(homeDir, ".config", "backlog.md", "config.yaml"));
	});

	it("uses APPDATA on Windows when available", () => {
		const homeDir = "C:/Users/alex";
		const appData = "C:/Users/alex/AppData/Roaming";
		const path = resolveUserBacklogConfigPath("win32", { APPDATA: appData }, homeDir);
		expect(path).toBe(join(appData, "backlog.md", "config.yaml"));
	});

	it("falls back to AppData/Roaming under the home directory on Windows", () => {
		const homeDir = "C:/Users/alex";
		const path = resolveUserBacklogConfigPath("win32", {}, homeDir);
		expect(path).toBe(join(homeDir, "AppData", "Roaming", "backlog.md", "config.yaml"));
	});
});
