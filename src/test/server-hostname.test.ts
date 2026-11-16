import { afterEach, beforeEach, describe, expect, it, spyOn } from "bun:test";
import { FileSystem } from "../file-system/operations.ts";
import { BacklogServer } from "../server/index.ts";
import { closeServer, createUniqueTestDir, listenOnEphemeralPort, safeCleanup } from "./test-utils.ts";

let TEST_DIR: string;
let server: BacklogServer | null = null;

type ServerInternals = {
	server: { hostname?: string } | null;
	openBrowser: (url: string) => Promise<void>;
	core: {
		getContentStore: () => Promise<unknown>;
	};
};

function internals(instance: BacklogServer): ServerInternals {
	return instance as unknown as ServerInternals;
}

async function unusedLoopbackPort(): Promise<number> {
	const { server: portProbe, port } = await listenOnEphemeralPort();
	await closeServer(portProbe);
	return port;
}

describe("BacklogServer loopback binding", () => {
	beforeEach(async () => {
		TEST_DIR = createUniqueTestDir("server-hostname");
		const filesystem = new FileSystem(TEST_DIR);
		await filesystem.ensureBacklogStructure();
		await filesystem.saveConfig({
			projectName: "Server Hostname",
			statuses: ["To Do", "In Progress", "Done"],
			labels: [],
			milestones: [],
			dateFormat: "YYYY-MM-DD",
			remoteOperations: false,
			checkActiveBranches: false,
		});
	});

	afterEach(async () => {
		if (server) {
			await server.stop();
			server = null;
		}
		await safeCleanup(TEST_DIR);
	});

	it("binds, displays, and automatically opens the same 127.0.0.1 URL", async () => {
		const port = await unusedLoopbackPort();
		const logs: string[] = [];
		let openedUrl: string | undefined;
		const logSpy = spyOn(console, "log").mockImplementation((...args: unknown[]) => {
			logs.push(args.join(" "));
		});

		try {
			server = new BacklogServer(TEST_DIR);
			internals(server).openBrowser = async (url) => {
				openedUrl = url;
			};
			await server.start(port, true);

			expect(internals(server).server?.hostname).toBe("127.0.0.1");
			expect(logs).toContain(`🚀 Backlog.md browser interface running at http://127.0.0.1:${port}`);
			expect(openedUrl).toBe(`http://127.0.0.1:${port}`);
		} finally {
			logSpy.mockRestore();
		}
	});

	it("keeps --no-open behavior while displaying the 127.0.0.1 URL", async () => {
		const port = await unusedLoopbackPort();
		const logs: string[] = [];
		let opened = false;
		const logSpy = spyOn(console, "log").mockImplementation((...args: unknown[]) => {
			logs.push(args.join(" "));
		});

		try {
			server = new BacklogServer(TEST_DIR);
			internals(server).openBrowser = async () => {
				opened = true;
			};
			await server.start(port, false);

			expect(opened).toBe(false);
			expect(logs).toContain(`🚀 Backlog.md browser interface running at http://127.0.0.1:${port}`);
			expect(logs).toContain("💡 Open your browser and navigate to the URL above");
			expect(logs).not.toContain("🌐 Opening browser...");
		} finally {
			logSpy.mockRestore();
		}
	});

	it("warns before binding a saved remote host", async () => {
		const filesystem = new FileSystem(TEST_DIR);
		const config = await filesystem.loadConfig();
		if (!config) throw new Error("Missing fixture config");
		await filesystem.saveConfig({ ...config, defaultHostname: "0.0.0.0" });
		const warnings: string[] = [];
		const warnSpy = spyOn(console, "warn").mockImplementation((message) => warnings.push(String(message)));
		const originalServe = Bun.serve;
		let warningBeforeListen = false;
		const serveSpy = spyOn(Bun, "serve").mockImplementation((options) => {
			warningBeforeListen = warnings.some((warning) => warning.includes("INSECURE REMOTE ACCESS"));
			return originalServe(options);
		});
		try {
			server = new BacklogServer(TEST_DIR);
			const port = await unusedLoopbackPort();
			await server.start(port, false);
			expect(warningBeforeListen).toBe(true);
			expect(internals(server).server?.hostname).toBe("0.0.0.0");
			expect(warnings.join("\n")).toContain("authentication");
			expect(warnings.join("\n")).toContain("commands");
			expect((await fetch(`http://127.0.0.1:${port}/api/status`)).status).toBe(200);
		} finally {
			serveSpy.mockRestore();
			warnSpy.mockRestore();
		}
	});

	it("overrides a saved remote host for one run without saving or warning", async () => {
		const filesystem = new FileSystem(TEST_DIR);
		const config = await filesystem.loadConfig();
		if (!config) throw new Error("Missing fixture config");
		await filesystem.saveConfig({ ...config, defaultHostname: "0.0.0.0" });
		const warnSpy = spyOn(console, "warn").mockImplementation(() => {});
		try {
			server = new BacklogServer(TEST_DIR);
			await server.start(await unusedLoopbackPort(), false, "127.0.0.1");
			expect(internals(server).server?.hostname).toBe("127.0.0.1");
			expect(warnSpy).not.toHaveBeenCalled();
			expect((await filesystem.loadConfig())?.defaultHostname).toBe("0.0.0.0");
		} finally {
			warnSpy.mockRestore();
		}
	});

	it("serves IPv6 loopback and opens a correctly bracketed URL without a remote warning", async () => {
		const probe = Bun.serve({ hostname: "::1", port: 0, fetch: () => new Response("ok") });
		const port = probe.port;
		if (port === undefined) throw new Error("Missing port");
		await probe.stop(true);
		let opened: string | undefined;
		const warnSpy = spyOn(console, "warn").mockImplementation(() => {});
		try {
			server = new BacklogServer(TEST_DIR);
			internals(server).openBrowser = async (url) => {
				opened = url;
			};
			await server.start(port, true, "::1");
			expect(opened).toBe(`http://[::1]:${port}`);
			expect((await fetch(`http://[::1]:${port}/api/status`)).status).toBe(200);
			expect(warnSpy).not.toHaveBeenCalled();
		} finally {
			warnSpy.mockRestore();
		}
	});

	it("saves hostname settings for the next start and rejects invalid values", async () => {
		server = new BacklogServer(TEST_DIR);
		const port = await unusedLoopbackPort();
		await server.start(port, false);
		const url = `http://127.0.0.1:${port}/api/config`;
		const config = await (await fetch(url)).json();
		const save = await fetch(url, {
			method: "PUT",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ ...config, defaultHostname: "::" }),
		});
		expect(save.status).toBe(200);
		expect((await (await fetch(url)).json()).defaultHostname).toBe("::");
		expect(internals(server).server?.hostname).toBe("127.0.0.1");
		const invalid = await fetch(url, {
			method: "PUT",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ ...config, defaultHostname: "http://example.com" }),
		});
		expect(invalid.status).toBe(400);
		expect((await (await fetch(url)).json()).defaultHostname).toBe("::");
	});

	it("serves lightweight browser bootstrap before the shared content corpus finishes loading", async () => {
		const port = await unusedLoopbackPort();
		let releaseLoad: () => void = () => {};
		let markLoadStarted: () => void = () => {};
		const heldLoad = new Promise<void>((resolve) => {
			releaseLoad = resolve;
		});
		const loadStarted = new Promise<void>((resolve) => {
			markLoadStarted = resolve;
		});

		server = new BacklogServer(TEST_DIR);
		const originalGetContentStore = internals(server).core.getContentStore.bind(internals(server).core);
		internals(server).core.getContentStore = async () => {
			markLoadStarted();
			await heldLoad;
			return await originalGetContentStore();
		};

		await server.start(port, false);
		const searchResponse = fetch(`http://127.0.0.1:${port}/api/search`);
		await loadStarted;
		let statisticsResolved = false;
		const statisticsResponse = fetch(`http://127.0.0.1:${port}/api/statistics`).then((result) => {
			statisticsResolved = true;
			return result;
		});
		const response = await fetch(`http://127.0.0.1:${port}/api/status`);
		expect(response.status).toBe(200);
		await Bun.sleep(20);
		expect(statisticsResolved).toBe(false);

		releaseLoad();
		await searchResponse;
		expect((await statisticsResponse).status).toBe(200);
	});
});
