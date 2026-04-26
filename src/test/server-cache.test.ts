import { describe, expect, it } from "bun:test";
import { join } from "node:path";
import { markHtmlBundleNoStore } from "../server/index.ts";

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

	it("marks compiled HTML bundle entry files as no-store without changing asset entries", () => {
		const bundle: Bun.HTMLBundle = {
			index: "index.html",
			files: [
				{
					path: "index.html",
					loader: "html",
					isEntry: true,
					headers: {
						etag: "html-etag",
						"content-type": "text/html;charset=utf-8",
					},
				},
				{
					path: "index-abc123.js",
					loader: "js",
					isEntry: true,
					headers: {
						etag: "js-etag",
						"content-type": "text/javascript;charset=utf-8",
					},
				},
			],
		};

		markHtmlBundleNoStore(bundle);

		expect(bundle.files?.[0]?.headers["Cache-Control"]).toBe("no-store, max-age=0, must-revalidate");
		expect(bundle.files?.[0]?.headers.Pragma).toBe("no-cache");
		expect(bundle.files?.[0]?.headers.Expires).toBe("0");
		expect(bundle.files?.[0]?.headers.etag).toBe("html-etag");
		expect(bundle.files?.[1]?.headers["Cache-Control"]).toBeUndefined();
	});
});
