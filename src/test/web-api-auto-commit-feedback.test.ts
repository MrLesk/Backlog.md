import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { JSDOM } from "jsdom";
import {
	clearAutoCommitResults,
	createAutoCommitOptions,
	formatAutoCommitNotices,
	MAX_AUTO_COMMIT_RESULTS,
	recordAutoCommitResult,
	summarizeAutoCommitNotices,
} from "../core/auto-commit.ts";
import { BacklogServer } from "../server/index.ts";
import { ApiClient } from "../web/lib/api.ts";

const originalFetch = globalThis.fetch;
const originalWindow = globalThis.window;
const originalCustomEvent = globalThis.CustomEvent;
const originalDocument = globalThis.document;

describe("Web API automatic commit feedback", () => {
	beforeEach(() => {
		const dom = new JSDOM("<!doctype html><html><body></body></html>", { url: "http://localhost" });
		globalThis.window = dom.window as unknown as Window & typeof globalThis;
		globalThis.document = dom.window.document as unknown as Document;
		globalThis.CustomEvent = dom.window.CustomEvent as typeof CustomEvent;
	});

	afterEach(() => {
		globalThis.fetch = originalFetch;
		globalThis.window = originalWindow;
		globalThis.CustomEvent = originalCustomEvent;
		globalThis.document = originalDocument;
	});

	it("bounds multi-operation replacement feedback", () => {
		const notices = Array.from({ length: 100 }, (_, index) => `Amended commit ${index} as ${index + 1}.`);
		const summary = summarizeAutoCommitNotices(notices, 120);

		expect(summary?.length).toBeLessThanOrEqual(120);
		expect(summary).toContain("100 Backlog automatic commit replacements");
	});

	it("bounds stored bulk replacement results while retaining aggregate and latest feedback", () => {
		const input = createAutoCommitOptions();
		let callbackCount = 0;
		input.onResult = () => callbackCount++;
		for (let index = 0; index < 1_000; index += 1) {
			recordAutoCommitResult(input, {
				commitId: `${index.toString(16).padStart(12, "0")}${"0".repeat(28)}`,
				previousCommitId: `${(index + 1).toString(16).padStart(12, "0")}${"0".repeat(28)}`,
				amended: true,
				ownershipRecorded: true,
			});
		}

		expect(input.results).toHaveLength(MAX_AUTO_COMMIT_RESULTS);
		expect(callbackCount).toBe(1_000);
		const notices = formatAutoCommitNotices(input);
		expect(notices).toHaveLength(MAX_AUTO_COMMIT_RESULTS + 1);
		expect(notices[0]).toBe("900 earlier Backlog automatic commit replacements omitted.");
		expect(notices.at(-1)).toContain("0000000003e8 as 0000000003e7");
		clearAutoCommitResults(input);
		expect(input.results).toEqual([]);
		expect(formatAutoCommitNotices(input)).toEqual([]);
	});

	it("reports the total replacement count in the bounded server feedback header", async () => {
		const input = createAutoCommitOptions();
		for (let index = 0; index < 1_000; index += 1) {
			recordAutoCommitResult(input, {
				commitId: `${index.toString(16).padStart(40, "0")}`,
				previousCommitId: `${(index + 1).toString(16).padStart(40, "0")}`,
				amended: true,
				ownershipRecorded: true,
			});
		}
		const notices = formatAutoCommitNotices(input);
		type FeedbackHarness = {
			core: {
				withAutoCommitFeedback<T>(action: () => Promise<T>): Promise<{ value: T; notices: string[] }>;
			};
			withAutoCommitFeedback(action: () => Promise<Response>): Promise<Response>;
			stop(): Promise<void>;
		};
		const server = new BacklogServer(process.cwd()) as unknown as FeedbackHarness;
		server.core.withAutoCommitFeedback = async <T>(action: () => Promise<T>) => ({ value: await action(), notices });

		try {
			const response = await server.withAutoCommitFeedback(async () => new Response(null, { status: 204 }));
			expect(response.headers.get("X-Backlog-Auto-Commit")).toMatch(
				/^1,000 Backlog automatic commit replacements\. Last: Amended Backlog commit /,
			);
		} finally {
			await server.stop();
		}
	});

	it("dispatches replacement notices for every draft, document, decision, and milestone mutation", async () => {
		const notices: string[] = [];
		window.addEventListener("backlog-auto-commit", (event) => {
			notices.push((event as CustomEvent<string>).detail);
		});
		let request = 0;
		globalThis.fetch = (async () => {
			request += 1;
			return new Response(JSON.stringify({ success: true }), {
				status: 200,
				headers: { "X-Backlog-Auto-Commit": `entity-replacement-${request}` },
			});
		}) as unknown as typeof fetch;

		const client = new ApiClient({ retries: 0 });
		await client.promoteDraft("draft-1");
		await client.createDoc("Guide", "Body");
		await client.updateDoc("Guide", "Updated body");
		await client.createDecision("Choose");
		await client.updateDecision("decision-1", "Updated decision");
		await client.createMilestone("Release");
		await client.updateMilestone("m-1", "Renamed release");
		await client.removeMilestone("m-1");
		await client.archiveMilestone("m-2");

		expect(notices).toEqual(Array.from({ length: 9 }, (_, index) => `entity-replacement-${index + 1}`));
	});

	it("does not replay a non-idempotent mutation after its successful response is lost", async () => {
		const persistedDocuments: string[] = [];
		let requestCount = 0;
		globalThis.fetch = (async () => {
			requestCount += 1;
			persistedDocuments.push(`doc-${requestCount}`);
			throw new TypeError("Response stream was lost after the server write");
		}) as unknown as typeof fetch;

		const client = new ApiClient({ retries: 3 });
		await expect(client.createDoc("Guide", "Body")).rejects.toThrow("Request failed after 1 attempts");

		expect(requestCount).toBe(1);
		expect(persistedDocuments).toEqual(["doc-1"]);
	});

	it("dispatches replacement notices for JSON and no-content mutation responses", async () => {
		const notices: string[] = [];
		window.addEventListener("backlog-auto-commit", (event) => {
			notices.push((event as CustomEvent<string>).detail);
		});
		let request = 0;
		globalThis.fetch = (async () => {
			request += 1;
			const headers = { "X-Backlog-Auto-Commit": `replacement-${request}` };
			return request === 1
				? new Response(JSON.stringify({ success: true, task: {} }), { status: 200, headers })
				: new Response(null, { status: 204, headers });
		}) as unknown as typeof fetch;

		const client = new ApiClient({ retries: 0 });
		await client.reorderTask({ taskId: "TASK-1", targetStatus: "Done", orderedTaskIds: ["TASK-1"] });
		await client.archiveTask("TASK-1");
		await client.completeTask("TASK-2");

		expect(notices).toEqual(["replacement-1", "replacement-2", "replacement-3"]);
	});
});
