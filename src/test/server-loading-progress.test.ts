import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { FileSystem } from "../file-system/operations.ts";
import { BacklogServer } from "../server/index.ts";
import type { Task } from "../types/index.ts";
import { createUniqueTestDir, retry, safeCleanup, withTimeout } from "./test-utils.ts";

let testDir: string;
let server: BacklogServer | null = null;
const sockets: WebSocket[] = [];

type ServerInternals = {
	core: {
		getContentStore: () => Promise<{ refreshTasks: () => Promise<void> }>;
		loadTasks: (
			progressCallback?: (message: string) => void,
			abortSignal?: AbortSignal,
			options?: { includeCompleted?: boolean },
		) => Promise<Task[]>;
	};
};

type LoadingState =
	| { type: "loading"; message: string | null }
	| { type: "loaded" }
	| { type: "error"; message: string };

const internals = (instance: BacklogServer): ServerInternals => instance as unknown as ServerInternals;

const openSocket = async (port: number): Promise<{ socket: WebSocket; states: LoadingState[] }> => {
	const states: LoadingState[] = [];
	const socket = new WebSocket(`ws://127.0.0.1:${port}`);
	sockets.push(socket);
	socket.onmessage = (event) => {
		try {
			states.push(JSON.parse(String(event.data)) as LoadingState);
		} catch {}
	};
	await withTimeout(
		new Promise<void>((resolve, reject) => {
			socket.onopen = () => resolve();
			socket.onerror = () => reject(new Error("WebSocket failed to open"));
		}),
		"loading progress WebSocket",
		2000,
	);
	return { socket, states };
};

const waitForState = async (states: LoadingState[], expected: LoadingState): Promise<void> => {
	await retry(async () => {
		if (!states.some((state) => JSON.stringify(state) === JSON.stringify(expected))) {
			throw new Error(`Missing ${JSON.stringify(expected)} in ${JSON.stringify(states)}`);
		}
	});
};

beforeEach(async () => {
	testDir = createUniqueTestDir("server-loading-progress");
	const filesystem = new FileSystem(testDir);
	await filesystem.ensureBacklogStructure();
	await filesystem.saveConfig({
		projectName: "Server loading progress",
		statuses: ["To Do", "In Progress", "Done"],
		labels: [],
		milestones: [],
		dateFormat: "YYYY-MM-DD",
		remoteOperations: false,
		checkActiveBranches: false,
	});
});

afterEach(async () => {
	for (const socket of sockets.splice(0)) socket.close();
	await server?.stop();
	server = null;
	await safeCleanup(testDir);
});

describe("browser corpus loading progress", () => {
	it("forwards Core progress verbatim to current and late sockets without duplicating the shared load", async () => {
		let loadCalls = 0;
		let reportPhase: () => void = () => {};
		let releaseLoad: () => void = () => {};
		const phaseReady = new Promise<void>((resolve) => {
			reportPhase = resolve;
		});
		const heldLoad = new Promise<void>((resolve) => {
			releaseLoad = resolve;
		});
		const phase = "Loading tasks from 7 local branches...";

		server = new BacklogServer(testDir);
		internals(server).core.loadTasks = async (progressCallback) => {
			loadCalls += 1;
			await phaseReady;
			progressCallback?.(phase);
			await heldLoad;
			return [];
		};
		await server.start(0, false);
		const port = server.getPort() ?? 0;

		const searchResponse = fetch(`http://127.0.0.1:${port}/api/search`);
		const first = await openSocket(port);
		await waitForState(first.states, { type: "loading", message: null });
		expect(first.states.filter((state) => state.type === "loading" && state.message !== null)).toEqual([]);

		reportPhase();
		await waitForState(first.states, { type: "loading", message: phase });

		const late = await openSocket(port);
		await waitForState(late.states, { type: "loading", message: phase });
		expect(loadCalls).toBe(1);

		releaseLoad();
		expect((await searchResponse).status).toBe(200);
		await waitForState(first.states, { type: "loaded" });
		await waitForState(late.states, { type: "loaded" });
		expect(loadCalls).toBe(1);

		await (await internals(server).core.getContentStore()).refreshTasks();
		expect(first.states.filter((state) => state.type === "loading" && state.message === phase)).toHaveLength(1);
		expect(loadCalls).toBe(2);
	});

	it("publishes a distinct failure and retries the same shared initialization", async () => {
		let loadCalls = 0;
		let failFirstLoad = true;
		let signalFirstLoadStarted: () => void = () => {};
		let releaseFirstFailure: () => void = () => {};
		const firstLoadStarted = new Promise<void>((resolve) => {
			signalFirstLoadStarted = resolve;
		});
		const heldFailure = new Promise<void>((resolve) => {
			releaseFirstFailure = resolve;
		});
		server = new BacklogServer(testDir);
		internals(server).core.loadTasks = async (progressCallback) => {
			loadCalls += 1;
			if (failFirstLoad) {
				failFirstLoad = false;
				signalFirstLoadStarted();
				await heldFailure;
				progressCallback?.("Checking active branches...");
				throw new Error("corpus failed");
			}
			progressCallback?.("Loading local tasks...");
			return [];
		};
		await server.start(0, false);
		const port = server.getPort() ?? 0;

		// With no socket connected yet, this fetch is the only trigger of the shared
		// initialization, so awaiting firstLoadStarted proves the response is bound to
		// the failing attempt before anything else can start a retry.
		const firstResponsePromise = fetch(`http://127.0.0.1:${port}/api/search`);
		await firstLoadStarted;
		const client = await openSocket(port);
		// The initial state message proves the server registered the socket, so it will
		// receive the failure states published once the held failure is released.
		await waitForState(client.states, { type: "loading", message: null });
		releaseFirstFailure();
		const firstResponse = await firstResponsePromise;
		expect(firstResponse.status).toBe(500);
		await waitForState(client.states, { type: "loading", message: "Checking active branches..." });
		await waitForState(client.states, { type: "error", message: "corpus failed" });

		const [retry, concurrentRetry] = await Promise.all([
			fetch(`http://127.0.0.1:${port}/api/search`),
			fetch(`http://127.0.0.1:${port}/api/search?type=document`),
		]);
		expect(retry.status).toBe(200);
		expect(concurrentRetry.status).toBe(200);
		await waitForState(client.states, { type: "loading", message: "Loading local tasks..." });
		await waitForState(client.states, { type: "loaded" });
		expect(loadCalls).toBe(2);
	});
});
