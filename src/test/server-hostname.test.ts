import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { FileSystem } from "../file-system/operations.ts";
import { BacklogServer } from "../server/index.ts";
import { createUniqueTestDir, safeCleanup } from "./test-utils.ts";

let TEST_DIR: string;
let server: BacklogServer | null = null;

// BacklogServer keeps the Bun `Server` handle in a private field. Bun's own
// `Server.hostname` getter reports back the address it actually bound to
// (it echoes explicit values verbatim, e.g. "127.0.0.1" or "0.0.0.0"), so
// reading it through the instance is the most direct, non-flaky way to
// observe the real bind address without opening sockets or probing the
// network ourselves.
type ServerWithBunHandle = { server: { hostname?: string } | null };

function boundHostname(instance: BacklogServer): string | undefined {
	return (instance as unknown as ServerWithBunHandle).server?.hostname;
}

describe("BacklogServer hostname binding", () => {
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
		});
	});

	afterEach(async () => {
		if (server) {
			await server.stop();
			server = null;
		}
		await safeCleanup(TEST_DIR);
	});

	it("binds to the loopback interface (127.0.0.1) by default when no host is given", async () => {
		server = new BacklogServer(TEST_DIR);
		await server.start(0, false);

		expect(boundHostname(server)).toBe("127.0.0.1");
	});

	it("binds to a caller-specified hostname when one is passed to start()", async () => {
		server = new BacklogServer(TEST_DIR);
		await server.start(0, false, "0.0.0.0");

		expect(boundHostname(server)).toBe("0.0.0.0");
	});
});
