import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { JSDOM } from "jsdom";
import { summarizeAutoCommitNotices } from "../core/auto-commit.ts";
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
