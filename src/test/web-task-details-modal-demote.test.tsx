import { afterEach, describe, expect, it } from "bun:test";
import { JSDOM } from "jsdom";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import type { Task } from "../types/index.ts";
import { TaskDetailsModal } from "../web/components/TaskDetailsModal.tsx";
import { ThemeProvider } from "../web/contexts/ThemeContext.tsx";
import { apiClient } from "../web/lib/api.ts";

let root: Root | null = null;
let dom: JSDOM | null = null;

const localTask: Task = {
	id: "BACK-419",
	title: "Demote action",
	status: "To Do",
	assignee: [],
	labels: [],
	dependencies: [],
	createdDate: "2026-01-01",
	source: "local",
};

function setupDom(): HTMLElement {
	dom = new JSDOM("<!doctype html><html><body><div id='root'></div></body></html>", {
		url: "http://localhost",
	});
	(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
	globalThis.window = dom.window as unknown as Window & typeof globalThis;
	globalThis.document = dom.window.document as Document;
	globalThis.navigator = dom.window.navigator as Navigator;
	globalThis.localStorage = dom.window.localStorage;
	globalThis.Element = dom.window.Element;
	globalThis.HTMLElement = dom.window.HTMLElement;
	globalThis.HTMLInputElement = dom.window.HTMLInputElement;
	globalThis.HTMLTextAreaElement = dom.window.HTMLTextAreaElement;
	globalThis.requestAnimationFrame = (callback: FrameRequestCallback) => window.setTimeout(callback, 0);
	globalThis.cancelAnimationFrame = (handle: number) => window.clearTimeout(handle);
	window.matchMedia = () =>
		({
			matches: false,
			media: "",
			onchange: null,
			addListener: () => {},
			removeListener: () => {},
			addEventListener: () => {},
			removeEventListener: () => {},
			dispatchEvent: () => false,
		}) as MediaQueryList;

	const container = document.getElementById("root");
	if (!container) throw new Error("Missing test root");
	root = createRoot(container);
	return container;
}

async function renderModal(
	task: Task,
	props: {
		isDraftMode?: boolean;
		isOpen?: boolean;
		onClose?: () => void;
		onSaved?: () => Promise<void> | void;
	} = {},
): Promise<void> {
	await act(async () => {
		root?.render(
			<ThemeProvider>
				<TaskDetailsModal
					task={task}
					isOpen={props.isOpen ?? true}
					isDraftMode={props.isDraftMode}
					onClose={props.onClose ?? (() => {})}
					onSaved={props.onSaved}
				/>
			</ThemeProvider>,
		);
		await Promise.resolve();
	});
}

function findDemoteButton(container: HTMLElement): HTMLButtonElement | undefined {
	return Array.from(container.querySelectorAll("button")).find((button) => button.title === "Move task to drafts");
}

async function click(element: Element): Promise<void> {
	await act(async () => {
		element.dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
		await Promise.resolve();
	});
}

async function waitFor(predicate: () => boolean): Promise<void> {
	for (let attempt = 0; attempt < 20; attempt += 1) {
		if (predicate()) return;
		await act(async () => {
			await new Promise((resolve) => setTimeout(resolve, 0));
		});
	}
	throw new Error("Condition was not met");
}

afterEach(() => {
	if (root) {
		act(() => root?.unmount());
		root = null;
	}
	dom?.window.close();
	dom = null;
});

describe("Web task demotion", () => {
	it("shows the action for a local active task", async () => {
		const container = setupDom();
		await renderModal(localTask);

		expect(findDemoteButton(container)).toBeTruthy();
	});

	it("hides the action when demotion is not applicable", async () => {
		const container = setupDom();
		const inapplicable: Array<{ task: Task; isDraftMode?: boolean }> = [
			{ task: { ...localTask, id: "DRAFT-1", status: "Draft" }, isDraftMode: true },
			{ task: { ...localTask, source: "completed" } },
			{ task: { ...localTask, source: "local-branch", branch: "tasks/elsewhere" } },
		];

		for (const candidate of inapplicable) {
			await renderModal(candidate.task, { isDraftMode: candidate.isDraftMode });
			expect(findDemoteButton(container), candidate.task.id).toBeUndefined();
		}
	});

	it("shows the action for an active task whose configured prefix is DRAFT", async () => {
		const container = setupDom();
		await renderModal({ ...localTask, id: "DRAFT-419" });

		expect(findDemoteButton(container)).toBeTruthy();
	});

	it("requires confirmation before calling the API", async () => {
		const container = setupDom();
		let apiCalls = 0;
		const originalDemoteTask = apiClient.demoteTask.bind(apiClient);
		apiClient.demoteTask = async () => {
			apiCalls += 1;
		};
		window.confirm = () => false;

		try {
			await renderModal(localTask);
			await click(findDemoteButton(container) as HTMLButtonElement);
			expect(apiCalls).toBe(0);
		} finally {
			apiClient.demoteTask = originalDemoteTask;
		}
	});

	it("refreshes tasks and drafts before closing after success", async () => {
		const container = setupDom();
		const events: string[] = [];
		const originalDemoteTask = apiClient.demoteTask.bind(apiClient);
		apiClient.demoteTask = async (id) => {
			events.push(`api:${id}`);
		};
		window.confirm = () => true;
		window.addEventListener("drafts-updated", () => events.push("drafts"), { once: true });

		try {
			await renderModal(localTask, {
				onSaved: async () => {
					events.push("saved");
				},
				onClose: () => events.push("closed"),
			});
			await click(findDemoteButton(container) as HTMLButtonElement);
			await waitFor(() => events.includes("closed"));

			expect(events).toEqual(["api:BACK-419", "drafts", "saved", "closed"]);
		} finally {
			apiClient.demoteTask = originalDemoteTask;
		}
	});

	it("keeps the modal open and reports an API failure", async () => {
		const container = setupDom();
		let closeCalls = 0;
		const originalDemoteTask = apiClient.demoteTask.bind(apiClient);
		apiClient.demoteTask = async () => {
			throw new Error("Demotion failed");
		};
		window.confirm = () => true;

		try {
			await renderModal(localTask, { onClose: () => closeCalls++ });
			await click(findDemoteButton(container) as HTMLButtonElement);
			await waitFor(() => container.textContent?.includes("Demotion failed") ?? false);

			expect(closeCalls).toBe(0);
			expect(findDemoteButton(container)?.disabled).toBe(false);
			expect(container.querySelector("[role='alert']")?.textContent).toContain("Demotion failed");
		} finally {
			apiClient.demoteTask = originalDemoteTask;
		}
	});

	it("ignores a deferred demotion after the modal closes and reopens for another task", async () => {
		const container = setupDom();
		let resolveRequest: (() => void) | undefined;
		let markStarted: (() => void) | undefined;
		const requestStarted = new Promise<void>((resolve) => {
			markStarted = resolve;
		});
		const requestRelease = new Promise<void>((resolve) => {
			resolveRequest = resolve;
		});
		let closeCalls = 0;
		let saveCalls = 0;
		let draftEvents = 0;
		const originalDemoteTask = apiClient.demoteTask.bind(apiClient);
		apiClient.demoteTask = async () => {
			markStarted?.();
			await requestRelease;
		};
		window.confirm = () => true;
		const onDraftsUpdated = () => draftEvents++;
		window.addEventListener("drafts-updated", onDraftsUpdated);
		const callbacks = {
			onClose: () => closeCalls++,
			onSaved: () => {
				saveCalls += 1;
			},
		};

		try {
			await renderModal(localTask, callbacks);
			await click(findDemoteButton(container) as HTMLButtonElement);
			await requestStarted;

			expect(findDemoteButton(container)?.disabled).toBe(true);
			expect((container.querySelector("button[aria-label='Close modal']") as HTMLButtonElement | null)?.disabled).toBe(
				true,
			);

			await renderModal(localTask, { ...callbacks, isOpen: false });
			const replacement = { ...localTask, id: "DRAFT-420", title: "Replacement task" };
			await renderModal(replacement, callbacks);
			expect(findDemoteButton(container)?.disabled).toBe(false);

			resolveRequest?.();
			await act(async () => {
				await requestRelease;
				await new Promise<void>((resolve) => setImmediate(resolve));
			});

			expect(closeCalls).toBe(0);
			expect(saveCalls).toBe(0);
			expect(draftEvents).toBe(0);
			expect(container.textContent).toContain("DRAFT-420 — Replacement task");
		} finally {
			resolveRequest?.();
			window.removeEventListener("drafts-updated", onDraftsUpdated);
			apiClient.demoteTask = originalDemoteTask;
		}
	});
});
