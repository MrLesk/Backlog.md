import { afterEach, describe, expect, it } from "bun:test";
import { JSDOM } from "jsdom";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import type { Task } from "../types/index.ts";
import { AppSuccessToasts } from "../web/components/AppSuccessToasts.tsx";

let root: Root | null = null;

function setupDom(): HTMLElement {
	const dom = new JSDOM("<!doctype html><html><body><div id='root'></div></body></html>");
	(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
	globalThis.window = dom.window as unknown as Window & typeof globalThis;
	globalThis.document = dom.window.document as unknown as Document;
	const container = document.getElementById("root");
	if (!container) throw new Error("Missing test root");
	return container;
}

afterEach(() => {
	act(() => root?.unmount());
	root = null;
});

describe("App success toast stacking", () => {
	it("keeps amended creation feedback visible with the task confirmation", async () => {
		const task: Task = {
			id: "task-1",
			title: "Visible replacement",
			status: "To Do",
			assignee: [],
			createdDate: "2026-07-29 00:00",
			labels: [],
			dependencies: [],
		};
		const dismissed: number[] = [];
		const container = setupDom();
		root = createRoot(container);
		await act(async () => {
			root?.render(
				<AppSuccessToasts
					autoCommitNotices={[
						{ id: 1, message: "Amended Backlog commit old as new." },
						{ id: 2, message: "Amended Backlog commit newer as newest." },
					]}
					taskConfirmation={{ task, isDraft: false }}
					onDismissAutoCommitNotice={(id) => dismissed.push(id)}
					onDismissTaskConfirmation={() => {}}
				/>,
			);
		});

		const stack = container.querySelector<HTMLElement>("[data-testid='app-success-toast-stack']");
		expect(stack).not.toBeNull();
		expect(stack?.children).toHaveLength(3);
		expect(stack?.textContent).toContain("Amended Backlog commit old as new.");
		expect(stack?.textContent).toContain('Task "Visible replacement" created successfully!');
		expect(Array.from(stack?.children ?? []).every((toast) => !toast.classList.contains("fixed"))).toBe(true);

		await act(async () => {
			stack?.querySelector<HTMLButtonElement>("button")?.click();
		});
		expect(dismissed).toEqual([1]);
	});
});
