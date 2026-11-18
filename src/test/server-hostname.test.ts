import { afterEach, beforeEach, describe, expect, it, spyOn } from "bun:test";
import { request as httpRequest } from "node:http";
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

async function requestWithHost(
	port: number,
	path: string,
	host: string,
	method = "GET",
	body?: unknown,
): Promise<number> {
	const content = body === undefined ? undefined : JSON.stringify(body);
	return await new Promise((resolve, reject) => {
		const request = httpRequest(
			{
				hostname: "127.0.0.1",
				port,
				path,
				method,
				headers: {
					Host: host,
					Origin: `http://${host}`,
					...(content === undefined ? {} : { "Content-Type": "application/json" }),
				},
			},
			(response) => {
				response.resume();
				resolve(response.statusCode ?? 0);
			},
		);
		request.on("error", reject);
		request.end(content);
	});
}

async function websocketStatus(port: number, host: string, origin: string): Promise<number> {
	return await new Promise((resolve, reject) => {
		const request = httpRequest(
			{
				hostname: "127.0.0.1",
				port,
				headers: {
					Host: host,
					Origin: origin,
					Connection: "Upgrade",
					Upgrade: "websocket",
					"Sec-WebSocket-Version": "13",
					"Sec-WebSocket-Key": "dGhlIHNhbXBsZSBub25jZQ==",
				},
			},
			(response) => {
				response.resume();
				resolve(response.statusCode ?? 0);
			},
		);
		request.on("upgrade", (response, socket) => {
			socket.destroy();
			resolve(response.statusCode ?? 0);
		});
		request.on("error", reject);
		request.end();
	});
}

describe("BacklogServer loopback binding", () => {
	it("rejects an unexpected Host on native routes and WebSocket upgrades", async () => {
		server = new BacklogServer(TEST_DIR);
		const port = await unusedLoopbackPort();
		await server.start(port, false);
		expect(await requestWithHost(port, "/api/config", `attacker.example:${port}`)).toBe(403);
		expect(
			await requestWithHost(port, "/api/config", `attacker.example:${port}`, "PUT", { projectName: "Changed" }),
		).toBe(403);
		expect(await requestWithHost(port, "/assets/test.txt", `attacker.example:${port}`)).toBe(403);
		expect(await requestWithHost(port, "/api/config", `127.0.0.1:${port}`)).toBe(200);
		// A forwarded port reaches the server under a local name with another port.
		expect(await requestWithHost(port, "/api/config", "localhost:8080")).toBe(200);
		expect(await websocketStatus(port, `attacker.example:${port}`, `http://attacker.example:${port}`)).toBe(403);
		expect(await websocketStatus(port, `127.0.0.1:${port}`, "http://attacker.example")).toBe(403);
	});

	it("rejects a cross-origin write even with the expected Host", async () => {
		server = new BacklogServer(TEST_DIR);
		const port = await unusedLoopbackPort();
		await server.start(port, false);
		const response = await fetch(`http://127.0.0.1:${port}/api/config`, {
			method: "PUT",
			headers: { Origin: "http://attacker.example", "Content-Type": "application/json" },
			body: JSON.stringify({ projectName: "Changed" }),
		});
		expect(response.status).toBe(403);
	});
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
		await filesystem.saveConfig({ ...config, browserHostname: "0.0.0.0" });
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
			expect(await requestWithHost(port, "/api/config", `localhost:${port}`)).toBe(200);
			expect(await requestWithHost(port, "/api/config", `attacker.example:${port}`)).toBe(403);
		} finally {
			serveSpy.mockRestore();
			warnSpy.mockRestore();
		}
	});

	it("overrides a saved remote host for one run without saving or warning", async () => {
		const filesystem = new FileSystem(TEST_DIR);
		const config = await filesystem.loadConfig();
		if (!config) throw new Error("Missing fixture config");
		await filesystem.saveConfig({ ...config, browserHostname: "0.0.0.0" });
		const warnSpy = spyOn(console, "warn").mockImplementation(() => {});
		try {
			server = new BacklogServer(TEST_DIR);
			await server.start(await unusedLoopbackPort(), false, "127.0.0.1");
			expect(internals(server).server?.hostname).toBe("127.0.0.1");
			expect(warnSpy).not.toHaveBeenCalled();
			expect((await filesystem.loadConfig())?.browserHostname).toBe("0.0.0.0");
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

	it("only saves fields available in browser settings", async () => {
		const filesystem = new FileSystem(TEST_DIR);
		const original = await filesystem.loadConfig();
		if (!original) throw new Error("Missing fixture config");
		await filesystem.saveConfig({
			...original,
			browserHostname: "127.0.0.1",
			defaultEditor: "vim",
			onStatusChange: "echo safe",
			definitionOfDone: ["old item"],
		});
		server = new BacklogServer(TEST_DIR);
		const port = await unusedLoopbackPort();
		await server.start(port, false);
		const url = `http://127.0.0.1:${port}/api/config`;
		const config = await (await fetch(url)).json();
		await new FileSystem(TEST_DIR).saveConfig({ ...config, onStatusChange: "echo newer safe" });
		const save = await fetch(url, {
			method: "PUT",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				...config,
				projectName: "Updated project",
				defaultPort: 6430,
				autoOpenBrowser: false,
				hideEmptyColumns: true,
				// Wider than the Settings input suggests. The CLI accepts it, so the browser does too.
				maxColumnWidth: 250,
				zeroPaddedIds: 4,
				definitionOfDone: [],
				browserHostname: "::",
				defaultEditor: "sh",
				onStatusChange: "echo unsafe",
				statuses: [],
			}),
		});
		expect(save.status).toBe(200);
		const stored = await new FileSystem(TEST_DIR).loadConfig();
		expect(stored?.projectName).toBe("Updated project");
		expect(stored?.defaultPort).toBe(6430);
		expect(stored?.autoOpenBrowser).toBe(false);
		expect(stored?.hideEmptyColumns).toBe(true);
		expect(stored?.maxColumnWidth).toBe(250);
		expect(stored?.zeroPaddedIds).toBe(4);
		expect(stored?.definitionOfDone).toEqual([]);
		expect(stored?.browserHostname).toBe("127.0.0.1");
		expect(stored?.defaultEditor).toBe("vim");
		expect(stored?.onStatusChange).toBe("echo newer safe");
		expect(stored?.statuses).toEqual(original.statuses);
		expect(internals(server).server?.hostname).toBe("127.0.0.1");
		const invalid = await fetch(url, {
			method: "PUT",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ projectName: " " }),
		});
		expect(invalid.status).toBe(400);
		expect((await new FileSystem(TEST_DIR).loadConfig())?.projectName).toBe("Updated project");
	});

	it("rejects settings values that could add another config field", async () => {
		server = new BacklogServer(TEST_DIR);
		const port = await unusedLoopbackPort();
		await server.start(port, false);
		const url = `http://127.0.0.1:${port}/api/config`;
		for (const input of [
			{ projectName: 'Valid name"\non_status_change: "echo unsafe' },
			{ dateFormat: "YYYY-MM-DD\non_status_change: echo unsafe" },
			{ defaultPort: "6420\non_status_change: echo unsafe" },
		]) {
			const response = await fetch(url, {
				method: "PUT",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(input),
			});
			expect(response.status).toBe(400);
		}
		const stored = await new FileSystem(TEST_DIR).loadConfig();
		expect(stored?.onStatusChange).toBeUndefined();
		expect(stored?.projectName).toBe("Server Hostname");
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
