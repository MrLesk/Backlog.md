import { describe, expect, it } from "bun:test";
import { join } from "node:path";

describe("BacklogServer SPA cache handling", () => {
	it("ships an index shell refresh guard that checks the current HTML without cache", async () => {
		const html = await Bun.file(join(process.cwd(), "src/web/index.html")).text();

		expect(html).toContain("data-backlog-shell-refresh");
		expect(html).toContain('cache: "no-store"');
		expect(html).toContain("assetSignatureFromDocument");
		expect(html).toContain('link[rel="stylesheet"][href],script[src]');
		expect(html).toContain("__backlog_reload");
		expect(html).toContain("window.location.replace");
	});
});
