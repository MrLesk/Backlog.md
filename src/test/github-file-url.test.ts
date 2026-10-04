import { describe, expect, it } from "bun:test";
import { buildGitHubFileUrl } from "../utils/github-file-url.ts";

describe("GitHub file URLs", () => {
	it.each([
		"git@github.com:MrLesk/Backlog.md.git",
		"https://github.com/MrLesk/Backlog.md.git",
	])("builds a branch URL for %s remotes and encodes path segments", (remote) => {
		expect(
			buildGitHubFileUrl(
				remote,
				"tasks/back-707-add-tui-yank-menu",
				"backlog/tasks/back-208 - Add-paste-as-markdown-support-in-Web-UI.md",
			),
		).toBe(
			"https://github.com/MrLesk/Backlog.md/blob/tasks/back-707-add-tui-yank-menu/backlog/tasks/back-208%20-%20Add-paste-as-markdown-support-in-Web-UI.md",
		);
	});

	it("omits links when the remote, branch, or repository-relative path is unavailable", () => {
		expect(buildGitHubFileUrl("git@gitlab.com:owner/repo.git", "main", "backlog/task.md")).toBeNull();
		expect(buildGitHubFileUrl("git@github.com:owner/repo.git", "", "backlog/task.md")).toBeNull();
		expect(buildGitHubFileUrl("git@github.com:owner/repo.git", "main", "../outside/task.md")).toBeNull();
	});
});
