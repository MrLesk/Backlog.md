import { describe, expect, it } from "bun:test";
import { $ } from "bun";

describe("TUI screenshot comparison script", () => {
	it("shows usage without requiring Ghostty", async () => {
		const result = await $`bash tools/tui-screenshot-compare.sh`
			.env({ ...process.env, GHOSTTY_BIN: "/definitely/not/ghostty" })
			.quiet()
			.nothrow();

		expect(result.exitCode).toBe(0);
		expect(result.stdout.toString()).toContain("Usage:");
	});
});
