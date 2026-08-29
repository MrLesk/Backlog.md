import { afterEach, describe, expect, it } from "bun:test";
import { JSDOM } from "jsdom";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import type { Task } from "../types/index.ts";
import { TaskDetailsModal } from "../web/components/TaskDetailsModal";
import { TaskIdIndexProvider } from "../web/contexts/TaskIdIndexContext.tsx";
import { ThemeProvider } from "../web/contexts/ThemeContext";
import { setNativeInputValue } from "./react-dom-input.ts";

let activeRoot: Root | null = null;
let activeDom: JSDOM | null = null;

const crossBranchTask: Task = {
	id: "BACK-50",
	title: "Cross branch task",
	status: "To Do",
	assignee: [],
	createdDate: "2026-08-10",
	labels: [],
	dependencies: [],
	source: "remote",
};

const localTask: Task = {
	id: "BACK-10",
	title: "Local task",
	status: "To Do",
	assignee: [],
	createdDate: "2026-08-10",
	labels: [],
	dependencies: [],
};

const setupDom = () => {
	activeDom = new JSDOM("<!doctype html><html><body><div id='root'></div></body></html>", {
		url: "http://localhost",
	});
	(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
	globalThis.window = activeDom.window as unknown as Window & typeof globalThis;
	globalThis.document = activeDom.window.document as Document;
	globalThis.navigator = activeDom.window.navigator as Navigator;
	globalThis.localStorage = activeDom.window.localStorage;
	globalThis.Element = activeDom.window.Element;
	globalThis.HTMLElement = activeDom.window.HTMLElement;
	globalThis.HTMLInputElement = activeDom.window.HTMLInputElement;
	globalThis.HTMLTextAreaElement = activeDom.window.HTMLTextAreaElement;
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

	const htmlElementPrototype = window.HTMLElement.prototype as unknown as {
		attachEvent?: () => void;
		detachEvent?: () => void;
	};
	htmlElementPrototype.attachEvent = () => {};
	htmlElementPrototype.detachEvent = () => {};
};

const renderModal = async (availableTasks: Task[]): Promise<HTMLElement> => {
	setupDom();
	const container = document.getElementById("root") as HTMLElement;
	activeRoot = createRoot(container);
	await act(async () => {
		activeRoot?.render(
			<MemoryRouter initialEntries={["/"]}>
				<ThemeProvider>
					<TaskIdIndexProvider tasks={availableTasks}>
						<TaskDetailsModal
							isOpen={true}
							onClose={() => {}}
							onSubmit={async () => {}}
							availableTasks={availableTasks}
						/>
					</TaskIdIndexProvider>
				</ThemeProvider>
			</MemoryRouter>,
		);
		await Promise.resolve();
	});
	return container;
};

const flushReact = async () => {
	await act(async () => {
		await Promise.resolve();
		await new Promise((resolve) => setTimeout(resolve, 0));
	});
};

const typeIntoDependencyInput = async (container: HTMLElement, value: string) => {
	const textarea = container.querySelector("#dependency-input") as HTMLTextAreaElement | null;
	expect(textarea).toBeTruthy();
	await act(async () => {
		setNativeInputValue(textarea as HTMLTextAreaElement, value);
		await Promise.resolve();
	});
};

const suggestionIds = (container: HTMLElement): string[] => {
	const textarea = container.querySelector("#dependency-input") as HTMLTextAreaElement | null;
	const wrapper = textarea?.closest(".relative.w-full");
	const buttons = wrapper?.querySelectorAll('div[class*="absolute"] button') ?? [];
	return Array.from(buttons).map((button) => button.querySelector(".font-medium")?.textContent ?? "");
};

afterEach(() => {
	if (activeRoot) {
		act(() => {
			activeRoot?.unmount();
		});
		activeRoot = null;
	}
	activeDom?.window.close();
	activeDom = null;
});

describe("Task details modal dependency picker", () => {
	it("only suggests tasks the local working copy can validate as dependencies", async () => {
		const container = await renderModal([crossBranchTask, localTask]);
		await flushReact();

		await typeIntoDependencyInput(container, "task");

		expect(suggestionIds(container)).toEqual(["BACK-10"]);
	});

	it("excludes ambiguous local IDs (multiple files sharing a canonical ID) from suggestions", async () => {
		const paddedDuplicate: Task = {
			...localTask,
			id: "BACK-010",
			title: "Local task (padded duplicate)",
		};
		const container = await renderModal([crossBranchTask, localTask, paddedDuplicate]);
		await flushReact();

		await typeIntoDependencyInput(container, "task");

		expect(suggestionIds(container)).toEqual([]);
	});
});
