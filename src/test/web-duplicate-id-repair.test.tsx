import { afterEach, describe, expect, it } from "bun:test";
import { JSDOM } from "jsdom";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import type { DuplicateRepairPlan } from "../core/duplicate-task-repair.ts";
import type { Task } from "../types/index.ts";
import { DuplicateIdWarning } from "../web/components/DuplicateIdWarning.tsx";

let activeRoot: Root | null = null;
const originalFetch = globalThis.fetch;

function makeTask(id: string, title: string, filePath: string): Task {
	return {
		id,
		title,
		status: "To Do",
		assignee: [],
		createdDate: "2026-01-01",
		labels: [],
		dependencies: [],
		filePath,
	};
}

function makePlan(overrides: Partial<DuplicateRepairPlan> = {}): DuplicateRepairPlan {
	return {
		groups: [
			{
				id: "TASK-1",
				tasks: [
					makeTask("TASK-1", "Alpha", "backlog/tasks/task-1 - Alpha.md"),
					makeTask("TASK-01", "Beta", "backlog/tasks/task-01 - Beta.md"),
				],
			},
		],
		crossBranchFindings: [],
		changes: [
			{
				sourcePath: "backlog/tasks/task-01 - Beta.md",
				targetPath: "backlog/tasks/task-2 - Beta.md",
				oldId: "TASK-01",
				newId: "TASK-2",
				title: "Beta",
				location: "active",
				sourceHash: "abc",
			},
		],
		references: [
			{
				path: "backlog/docs/guide.md",
				line: 12,
				text: "See TASK-1 before continuing.",
				ids: ["TASK-1"],
			},
		],
		blockedReasons: [],
		repairable: true,
		fingerprint: "preview-fingerprint",
		...overrides,
	};
}

function renderWarning(plan = makePlan(), onRepaired = async () => {}): HTMLElement {
	const dom = new JSDOM("<!doctype html><html><body><div id='root'></div></body></html>", { url: "http://localhost" });
	(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
	globalThis.window = dom.window as unknown as Window & typeof globalThis;
	globalThis.document = dom.window.document as unknown as Document;
	globalThis.navigator = dom.window.navigator as unknown as Navigator;
	const container = document.getElementById("root") as HTMLElement;
	activeRoot = createRoot(container);
	act(() => {
		activeRoot?.render(<DuplicateIdWarning plan={plan} onRepaired={onRepaired} />);
	});
	return container;
}

async function click(button: Element): Promise<void> {
	await act(async () => {
		button.dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
		await Promise.resolve();
	});
}

function buttonWithText(container: HTMLElement, text: string): HTMLButtonElement {
	const button = Array.from(container.querySelectorAll("button")).find((candidate) => candidate.textContent?.includes(text));
	expect(button).toBeTruthy();
	return button as HTMLButtonElement;
}

afterEach(() => {
	if (activeRoot) {
		act(() => activeRoot?.unmount());
		activeRoot = null;
	}
	globalThis.fetch = originalFetch;
});

describe("DuplicateIdWarning", () => {
	it("uses a compact human repair action and removes copy/prompt language", async () => {
		const container = renderWarning();
		expect(container.textContent).toContain("Duplicate task IDs");
		expect(container.textContent).toContain("Review repair");
		expect(container.textContent?.toLowerCase()).not.toContain("copy");
		expect(container.textContent?.toLowerCase()).not.toContain("prompt");
		expect(container.textContent?.toLowerCase()).not.toContain("agent");

		await click(buttonWithText(container, "Review repair"));
		expect(container.textContent).toContain("Repair duplicate task IDs");
		expect(container.textContent).toContain("backlog/tasks/task-01 - Beta.md");
		expect(container.textContent).toContain("backlog/tasks/task-2 - Beta.md");
		expect(container.textContent).toContain("backlog/docs/guide.md:12");
		expect(container.textContent).toContain("not changed automatically");
	});

	it("requires a second explicit confirmation before applying the preview fingerprint", async () => {
		let repairedCalls = 0;
		let requestBody = "";
		globalThis.fetch = (async (_input: string | URL | Request, init?: RequestInit) => {
			requestBody = String(init?.body ?? "");
			return new Response(
				JSON.stringify({ repairedFiles: 1, changes: [], references: [], remainingGroups: [] }),
				{ status: 200, headers: { "Content-Type": "application/json" } },
			);
		}) as typeof fetch;
		const container = renderWarning(makePlan(), async () => {
			repairedCalls += 1;
		});

		await click(buttonWithText(container, "Review repair"));
		expect(container.textContent).not.toContain("Confirm repair");
		await click(buttonWithText(container, "Continue"));
		expect(container.textContent).toContain("Confirm repair");
		await click(buttonWithText(container, "Repair 1 file"));

		expect(JSON.parse(requestBody)).toEqual({ fingerprint: "preview-fingerprint" });
		expect(repairedCalls).toBe(1);
	});

	it("shows blocked reasons and does not offer a repair confirmation", async () => {
		const container = renderWarning(
			makePlan({
				repairable: false,
				blockedReasons: ["Target path already exists."],
			}),
		);
		await click(buttonWithText(container, "Review repair"));
		expect(container.textContent).toContain("Automatic repair is blocked");
		expect(container.textContent).toContain("Target path already exists.");
		expect(Array.from(container.querySelectorAll("button")).some((button) => button.textContent === "Continue")).toBe(false);
	});
});
