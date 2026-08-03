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

	it("serves the browser shell before the shared content corpus finishes loading", async () => {
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
		const response = await fetch(`http://127.0.0.1:${port}/`);
		expect(response.status).toBe(200);

		releaseLoad();
		expect((await searchResponse).status).toBe(200);
	});
});
