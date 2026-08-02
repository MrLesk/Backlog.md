import { afterEach, beforeEach, describe, expect, it, spyOn } from "bun:test";
import { chmod, mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { BacklogServer } from "../server/index.ts";
import { resolveBrowserLaunchCommand } from "../utils/browser-launch.ts";
import { createUniqueTestDir, safeCleanup } from "./test-utils.ts";

let TEST_DIR: string;

type BrowserLauncher = {
	openBrowser(url: string): Promise<void>;
};

describe("BacklogServer browser launch", () => {
	beforeEach(async () => {
		TEST_DIR = createUniqueTestDir("server-browser-open");
		await mkdir(TEST_DIR, { recursive: true });
	});

	afterEach(async () => {
		await safeCleanup(TEST_DIR);
	});

	it.skipIf(process.platform === "win32")("uses a non-empty BROWSER command before xdg-open on Linux", async () => {
		const browserHelper = join(TEST_DIR, "browser helper");
		const capturePath = join(TEST_DIR, "opened-url.txt");
		await writeFile(browserHelper, '#!/bin/sh\nprintf "%s" "$1" > "$BACKLOG_BROWSER_CAPTURE"\n');
		await chmod(browserHelper, 0o755);

		const originalPlatform = process.platform;
		const originalBrowser = process.env.BROWSER;
		const originalCapture = process.env.BACKLOG_BROWSER_CAPTURE;
		Object.defineProperty(process, "platform", { value: "linux" });
		process.env.BROWSER = browserHelper;
		process.env.BACKLOG_BROWSER_CAPTURE = capturePath;

		try {
			const server = new BacklogServer(TEST_DIR) as unknown as BrowserLauncher;
			const url = "http://localhost:6420/?filter=To%20Do&label=a;b";
			await server.openBrowser(url);

			expect(await readFile(capturePath, "utf8")).toBe(url);
		} finally {
			Object.defineProperty(process, "platform", { value: originalPlatform });
			if (originalBrowser === undefined) {
				delete process.env.BROWSER;
			} else {
				process.env.BROWSER = originalBrowser;
			}
			if (originalCapture === undefined) {
				delete process.env.BACKLOG_BROWSER_CAPTURE;
			} else {
				process.env.BACKLOG_BROWSER_CAPTURE = originalCapture;
			}
		}
	});

	it("falls back to the platform opener when BROWSER is unset or whitespace-only", () => {
		const url = "http://localhost:6420";

		expect(resolveBrowserLaunchCommand(url, {}, "linux")).toEqual(["xdg-open", url]);
		expect(resolveBrowserLaunchCommand(url, { BROWSER: " \t\n " }, "linux")).toEqual(["xdg-open", url]);
		expect(resolveBrowserLaunchCommand(url, { BROWSER: '""' }, "linux")).toEqual(["xdg-open", url]);
		expect(resolveBrowserLaunchCommand(url, {}, "darwin")).toEqual(["open", url]);
		expect(resolveBrowserLaunchCommand(url, {}, "win32")).toEqual(["cmd", "/c", "start", "", url]);
	});

	it("treats BROWSER as one executable instead of parsing or evaluating arguments", () => {
		const url = "http://localhost:6420";

		expect(resolveBrowserLaunchCommand(url, { BROWSER: "  browser --new-window  " }, "linux")).toEqual([
			"browser --new-window",
			url,
		]);
	});

	it("accepts a BROWSER executable path wrapped in matching quotes", () => {
		const url = "http://localhost:6420";

		expect(resolveBrowserLaunchCommand(url, { BROWSER: '"/opt/Browser App/browser"' }, "linux")).toEqual([
			"/opt/Browser App/browser",
			url,
		]);
	});

	it("reports a BROWSER launch failure without throwing", async () => {
		const originalBrowser = process.env.BROWSER;
		process.env.BROWSER = join(TEST_DIR, "missing-browser");
		const warn = spyOn(console, "warn").mockImplementation(() => {});
		const log = spyOn(console, "log").mockImplementation(() => {});

		try {
			const server = new BacklogServer(TEST_DIR) as unknown as BrowserLauncher;
			await expect(server.openBrowser("http://localhost:6420")).resolves.toBeUndefined();

			expect(warn).toHaveBeenCalledTimes(1);
			expect(warn.mock.calls[0]?.[0]).toBe("⚠️  Failed to open browser automatically:");
			expect(log).toHaveBeenCalledWith("💡 Please open your browser manually and navigate to the URL above");
		} finally {
			warn.mockRestore();
			log.mockRestore();
			if (originalBrowser === undefined) {
				delete process.env.BROWSER;
			} else {
				process.env.BROWSER = originalBrowser;
			}
		}
	});
});
