import { afterEach, describe, expect, it } from "bun:test";
import { JSDOM } from "jsdom";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import type { Task } from "../types/index.ts";
import { TaskDetailsModal } from "../web/components/TaskDetailsModal";
import { apiClient } from "../web/lib/api";
import { TaskIdIndexProvider } from "../web/contexts/TaskIdIndexContext.tsx";
import { ThemeProvider } from "../web/contexts/ThemeContext";
import { setNativeInputValue } from "./react-dom-input.ts";

let activeRoot: Root | null = null;
let activeDom: JSDOM | null = null;

const existingTask: Task = {
	id: "BACK-1",
	title: "Existing task",
	status: "To Do",
	assignee: [],
	createdDate: "2026-08-09",
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

type SubmittedPayloads = Partial<Task>[];

type ModalProps = {
	task?: Task;
	defaultAssignee?: string[];
	onSubmit?: (taskData: Partial<Task>) => Promise<void>;
};

const renderInto = async ({ task, defaultAssignee, onSubmit }: ModalProps): Promise<void> => {
	await act(async () => {
		activeRoot?.render(
			<MemoryRouter initialEntries={["/"]}>
				<ThemeProvider>
					<TaskIdIndexProvider tasks={[existingTask]}>
						<TaskDetailsModal
							task={task}
							isOpen={true}
							onClose={() => {}}
							onSubmit={onSubmit}
							defaultAssignee={defaultAssignee}
						/>
					</TaskIdIndexProvider>
				</ThemeProvider>
			</MemoryRouter>,
		);
		await Promise.resolve();
	});
};

const renderModal = async (props: ModalProps): Promise<HTMLElement> => {
	setupDom();
	const container = document.getElementById("root");
	activeRoot = createRoot(container as HTMLElement);
	await renderInto(props);
	return container as HTMLElement;
};

/** Create mode, capturing every payload the form submits. */
const mountCreateModal = async (defaultAssignee?: string[]) => {
	const submitted: SubmittedPayloads = [];
	const onSubmit = async (taskData: Partial<Task>) => {
		submitted.push(taskData);
	};
	const container = await renderModal({ defaultAssignee, onSubmit });
	/** Re-render as App does after a refresh, with a config array that is a new reference. */
	const rerenderWithFreshConfig = (nextDefaultAssignee?: string[]) =>
		renderInto({ defaultAssignee: nextDefaultAssignee ? [...nextDefaultAssignee] : undefined, onSubmit });
	return { container, submitted, rerenderWithFreshConfig };
};

const click = async (element: Element) => {
	await act(async () => {
		element.dispatchEvent(new window.MouseEvent("click", { bubbles: true, cancelable: true }));
		await Promise.resolve();
	});
};

const findButton = (container: HTMLElement, label: string): HTMLButtonElement => {
	const button = Array.from(container.querySelectorAll("button")).find(
		(candidate) => candidate.textContent?.trim() === label,
	);
	expect(button, `button "${label}"`).toBeTruthy();
	return button as HTMLButtonElement;
};

/** The assignee ChipInput only, so label or dependency chips can never answer for it. */
const assigneeField = (container: HTMLElement): HTMLElement => {
	const input = container.querySelector("#chip-input-assignee");
	expect(input?.parentElement, "assignee chip field").toBeTruthy();
	return input?.parentElement as HTMLElement;
};

const assigneeChips = (container: HTMLElement): string[] =>
	Array.from(assigneeField(container).querySelectorAll('button[aria-label^="Remove "]')).map(
		(button) => button.getAttribute("aria-label")?.replace(/^Remove /, "") ?? "",
	);

const removeChip = async (container: HTMLElement, chip: string) => {
	const button = assigneeField(container).querySelector(`button[aria-label="Remove ${chip}"]`);
	expect(button, `remove button for "${chip}"`).toBeTruthy();
	await click(button as Element);
};

const typeAssignee = async (container: HTMLElement, value: string) => {
	const input = container.querySelector("#chip-input-assignee") as HTMLInputElement | null;
	expect(input).toBeTruthy();
	await act(async () => {
		setNativeInputValue(input as HTMLInputElement, value);
		await Promise.resolve();
	});
	await act(async () => {
		(input as HTMLInputElement).dispatchEvent(
			new window.KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true }),
		);
		await Promise.resolve();
	});
};

const fillTitle = async (container: HTMLElement, title: string) => {
	const input = container.querySelector('input[placeholder="Enter task title"]') as HTMLInputElement | null;
	expect(input).toBeTruthy();
	await act(async () => {
		setNativeInputValue(input as HTMLInputElement, title);
		await Promise.resolve();
	});
};

const submitCreateForm = async (container: HTMLElement) => {
	await click(findButton(container, "Create"));
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

describe("Task details modal assignee on create", () => {
	it("applies the configured default when the prefilled chips are left alone", async () => {
		const { container, submitted } = await mountCreateModal(["@alice", "@bob"]);

		expect(assigneeChips(container)).toEqual(["@alice", "@bob"]);

		await fillTitle(container, "Task that keeps the default");
		await submitCreateForm(container);

		expect(submitted).toHaveLength(1);
		expect(submitted[0]?.assignee).toEqual(["@alice", "@bob"]);
	});

	it("sends an explicit empty list once every prefilled chip is removed", async () => {
		const { container, submitted } = await mountCreateModal(["@alice"]);

		await removeChip(container, "@alice");
		expect(assigneeChips(container)).toEqual([]);

		await fillTitle(container, "Task nobody owns");
		await submitCreateForm(container);

		expect(submitted).toHaveLength(1);
		expect(submitted[0]).toHaveProperty("assignee");
		expect(submitted[0]?.assignee).toEqual([]);
	});

	it("sends the typed assignee when the default is replaced", async () => {
		const { container, submitted } = await mountCreateModal(["@alice"]);

		await removeChip(container, "@alice");
		await typeAssignee(container, "@carol");
		expect(assigneeChips(container)).toEqual(["@carol"]);

		await fillTitle(container, "Task for someone else");
		await submitCreateForm(container);

		expect(submitted).toHaveLength(1);
		expect(submitted[0]?.assignee).toEqual(["@carol"]);
	});

	it("omits the field for a project without a default when the input is left blank", async () => {
		const { container, submitted } = await mountCreateModal();

		expect(assigneeChips(container)).toEqual([]);

		await fillTitle(container, "Task with no opinion on assignment");
		await submitCreateForm(container);

		expect(submitted).toHaveLength(1);
		expect(submitted[0]).not.toHaveProperty("assignee");
	});

	it("keeps a removed default when a refresh re-renders the open form", async () => {
		const { container, submitted, rerenderWithFreshConfig } = await mountCreateModal(["@alice"]);

		await removeChip(container, "@alice");
		await rerenderWithFreshConfig(["@alice"]);

		expect(assigneeChips(container)).toEqual([]);

		await fillTitle(container, "Task nobody owns, saved after a refresh");
		await submitCreateForm(container);

		expect(submitted[0]?.assignee).toEqual([]);
	});

	it("prefills once a late config arrives while the untouched form is open", async () => {
		const { container, submitted, rerenderWithFreshConfig } = await mountCreateModal();

		expect(assigneeChips(container)).toEqual([]);

		await rerenderWithFreshConfig(["@alice"]);

		expect(assigneeChips(container)).toEqual(["@alice"]);

		await fillTitle(container, "Task created after the config landed");
		await submitCreateForm(container);

		expect(submitted[0]?.assignee).toEqual(["@alice"]);
	});

	it("still sends what was typed for a project without a default", async () => {
		const { container, submitted } = await mountCreateModal();

		await typeAssignee(container, "@carol");

		await fillTitle(container, "Task with an explicit owner");
		await submitCreateForm(container);

		expect(submitted).toHaveLength(1);
		expect(submitted[0]?.assignee).toEqual(["@carol"]);
	});
});

describe("Task details modal assignee outside create", () => {
	it("leaves an existing task's empty assignee alone and still clears explicitly", async () => {
		const updates: Partial<Task>[] = [];
		const originalUpdateTask = apiClient.updateTask;
		(apiClient as { updateTask: typeof apiClient.updateTask }).updateTask = (async (
			_id: string,
			payload: Partial<Task>,
		) => {
			updates.push(payload);
			return { ...existingTask, ...payload } as Task;
		}) as typeof apiClient.updateTask;

		try {
			const container = await renderModal({
				task: { ...existingTask, assignee: ["@dave"] },
				defaultAssignee: ["@alice"],
			});

			// The default belongs to create only: an opened task shows its own assignees.
			expect(assigneeChips(container)).toEqual(["@dave"]);

			await removeChip(container, "@dave");

			expect(updates).toHaveLength(1);
			expect(updates[0]?.assignee).toEqual([]);
			expect(assigneeChips(container)).toEqual([]);
		} finally {
			(apiClient as { updateTask: typeof apiClient.updateTask }).updateTask = originalUpdateTask;
		}
	});
});
