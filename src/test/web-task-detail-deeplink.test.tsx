import { afterEach, describe, expect, it, spyOn } from "bun:test";
import { JSDOM } from "jsdom";
import { StrictMode, act, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import { ThemeProvider } from "../web/contexts/ThemeContext";
import type { Task } from "../types/index.ts";
import TaskDetailsModal from "../web/components/TaskDetailsModal.tsx";
import TaskList from "../web/components/TaskList.tsx";

const createTask = (overrides: Partial<Task>): Task => ({
	id: "TASK-1",
	title: "Task",
	status: "To Do",
	assignee: [],
	labels: [],
	dependencies: [],
	comments: [],
	references: [],
	acceptanceCriteriaItems: [],
	definitionOfDoneItems: [],
	createdDate: "2026-01-01",
	...overrides,
});

const taskFixtures: Task[] = [
	createTask({ id: "TASK-101", title: "Fix labels dropdown", labels: ["bug"] }),
	createTask({ id: "JIRA-456", title: "Ship docs", labels: ["docs"] }),
];

let activeRoot: Root | null = null;
const originalFetch = globalThis.fetch;
let consoleErrorSpy: ReturnType<typeof spyOn> | null = null;

type HarnessOptions = {
	initialEntries: string[];
	tasks?: Task[];
	strictMode?: boolean;
	taskById?: (id: string) => Task | null;
};

const setupDom = () => {
	const dom = new JSDOM("<!doctype html><html><body><div id='root'></div></body></html>", { url: "http://localhost" });
	(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
	globalThis.window = dom.window as unknown as Window & typeof globalThis;
	globalThis.document = dom.window.document as unknown as Document;
	globalThis.navigator = dom.window.navigator as unknown as Navigator;
	globalThis.localStorage = dom.window.localStorage as unknown as Storage;

	if (!window.matchMedia) {
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
	}

	const htmlElementPrototype = window.HTMLElement.prototype as unknown as {
		attachEvent?: () => void;
		detachEvent?: () => void;
	};
	if (typeof htmlElementPrototype.attachEvent !== "function") {
		htmlElementPrototype.attachEvent = () => {};
	}
	if (typeof htmlElementPrototype.detachEvent !== "function") {
		htmlElementPrototype.detachEvent = () => {};
	}
};

const response = <T,>(data: T, init: { status?: number; statusText?: string } = {}) =>
	({
		ok: (init.status ?? 200) >= 200 && (init.status ?? 200) < 300,
		status: init.status ?? 200,
		statusText: init.statusText ?? "OK",
		json: async () => data,
		text: async () => JSON.stringify(data),
		headers: new Headers({ "content-type": "application/json" }),
	} as Response);

const installFetchMock = (options: { tasks: Task[]; taskById?: (id: string) => Task | null }) => {
	globalThis.fetch = (async (input: RequestInfo | URL) => {
		const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
		if (url.endsWith("/api/tasks")) {
			return response(options.tasks);
		}
		if (url.endsWith("/api/statuses")) {
			return response(["To Do", "In Progress", "Done"]);
		}
		const taskMatch = url.match(/\/api\/task\/(.+)$/);
		if (taskMatch?.[1]) {
			const requestedId = decodeURIComponent(taskMatch[1]);
			const task = options.taskById?.(requestedId) ?? options.tasks.find((item) => item.id === requestedId) ?? null;
			if (task) {
				return response(task);
			}
			return response({ error: "Not found" }, { status: 404, statusText: "Not Found" });
		}
		return response([]);
	}) as typeof fetch;
};

const waitFor = async (predicate: () => boolean) => {
	for (let attempt = 0; attempt < 15; attempt += 1) {
		if (predicate()) {
			return;
		}
		await act(async () => {
			await new Promise((resolve) => setTimeout(resolve, 0));
		});
	}
	throw new Error("Timed out waiting for condition");
};

const renderHarness = (options: HarnessOptions): HTMLElement => {
	setupDom();
	installFetchMock({
		tasks: options.tasks ?? taskFixtures,
		taskById: options.taskById,
	});
	const container = document.getElementById("root");
	expect(container).toBeTruthy();
	activeRoot = createRoot(container as HTMLElement);

	const Harness = () => {
		const [editingTask, setEditingTask] = useState<Task | null>(null);
		const [showModal, setShowModal] = useState(false);
		const location = useLocation();
		const navigate = useNavigate();

		const handleEditTask = (task: Task) => {
			setEditingTask(task);
			setShowModal(true);
		};

		const handleClose = () => {
			setShowModal(false);
			setEditingTask(null);
			if (location.pathname.startsWith("/tasks/")) {
				navigate("/tasks", { replace: true });
			}
		};

			return (
				<>
					<Routes>
						<Route
							path="/tasks"
							element={
								<TaskList
									tasks={options.tasks ?? taskFixtures}
									availableStatuses={["To Do", "In Progress", "Done"]}
									availableLabels={["bug", "docs"]}
									availableMilestones={[]}
									milestoneEntities={[]}
									archivedMilestones={[]}
								onEditTask={handleEditTask}
								onNewTask={() => {}}
							/>
						}
					/>
						<Route
							path="/tasks/:id"
							element={
								<TaskList
									tasks={options.tasks ?? taskFixtures}
									availableStatuses={["To Do", "In Progress", "Done"]}
									availableLabels={["bug", "docs"]}
									availableMilestones={[]}
									milestoneEntities={[]}
									archivedMilestones={[]}
								onEditTask={handleEditTask}
								onNewTask={() => {}}
							/>
						}
					/>
						<Route
							path="/tasks/:id/:title"
							element={
								<TaskList
									tasks={options.tasks ?? taskFixtures}
									availableStatuses={["To Do", "In Progress", "Done"]}
									availableLabels={["bug", "docs"]}
									availableMilestones={[]}
									milestoneEntities={[]}
									archivedMilestones={[]}
								onEditTask={handleEditTask}
								onNewTask={() => {}}
							/>
						}
					/>
				</Routes>
				<div data-testid="pathname">{location.pathname}</div>
				<TaskDetailsModal
					task={editingTask || undefined}
					isOpen={showModal}
					onClose={handleClose}
					availableStatuses={["To Do", "In Progress", "Done"]}
					availableMilestones={[]}
					milestoneEntities={[]}
					archivedMilestoneEntities={[]}
				/>
			</>
		);
	};

	act(() => {
		activeRoot?.render(
				<ThemeProvider>
					<MemoryRouter initialEntries={options.initialEntries}>
						{options.strictMode ? (
							<StrictMode>
								<Harness />
							</StrictMode>
						) : (
							<Harness />
						)}
					</MemoryRouter>
				</ThemeProvider>,
			);
	});

	return container as HTMLElement;
};

const clickElement = async (element: Element) => {
	await act(async () => {
		element.dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
		await Promise.resolve();
	});
};

afterEach(() => {
	globalThis.fetch = originalFetch;
	consoleErrorSpy?.mockRestore();
	consoleErrorSpy = null;
	if (activeRoot) {
		act(() => {
			activeRoot?.unmount();
		});
		activeRoot = null;
	}
});

describe("TaskList deep link handling", () => {
	it("opens the modal for numeric task URLs", async () => {
		const container = renderHarness({ initialEntries: ["/tasks/101"] });

		await waitFor(() => container.querySelector("[role='dialog']") !== null);

		expect(container.querySelector("[role='dialog']")).toBeTruthy();
		expect(container.querySelector("#modal-title")?.textContent).toContain("Fix labels dropdown");
	});

	it("opens the modal for prefixed task URLs", async () => {
		const container = renderHarness({ initialEntries: ["/tasks/task-101"] });

		await waitFor(() => container.querySelector("[role='dialog']") !== null);

		expect(container.querySelector("[role='dialog']")).toBeTruthy();
		expect(container.querySelector("#modal-title")?.textContent).toContain("Fix labels dropdown");
	});

	it("resolves custom prefixes from the URL", async () => {
		const container = renderHarness({ initialEntries: ["/tasks/JIRA-456"] });

		await waitFor(() => container.querySelector("[role='dialog']") !== null);

		expect(container.querySelector("[role='dialog']")).toBeTruthy();
		expect(container.querySelector("#modal-title")?.textContent).toContain("Ship docs");
	});

	it("returns to /tasks when the deep-linked modal closes", async () => {
		const container = renderHarness({ initialEntries: ["/tasks/101"] });

		await waitFor(() => container.querySelector("[role='dialog']") !== null);

		const closeButton = container.querySelector("button[aria-label='Close modal']");
		expect(closeButton).toBeTruthy();
		await clickElement(closeButton as HTMLButtonElement);

		await waitFor(() => container.querySelector("[role='dialog']") === null && container.querySelector("[data-testid='pathname']")?.textContent === "/tasks");

		expect(container.querySelector("[role='dialog']")).toBeNull();
		expect(container.querySelector("[data-testid='pathname']")?.textContent).toBe("/tasks");
	});

	it("opens via fetch in StrictMode when tasks are initially empty", async () => {
		const fetchedTask = createTask({ id: "TASK-101", title: "StrictMode fetched task" });
		const container = renderHarness({
			initialEntries: ["/tasks/TASK-101"],
			tasks: [],
			strictMode: true,
			taskById: (id) => (id === fetchedTask.id ? fetchedTask : null),
		});

		await waitFor(() => container.querySelector("[role='dialog']") !== null);

		expect(container.querySelector("[role='dialog']")).toBeTruthy();
		expect(container.querySelector("#modal-title")?.textContent).toContain("StrictMode fetched task");
	});

	it("logs and leaves modal closed when StrictMode fetch fails", async () => {
		consoleErrorSpy = spyOn(console, "error").mockImplementation(() => {});
		const container = renderHarness({
			initialEntries: ["/tasks/TASK-404"],
			tasks: [],
			strictMode: true,
			taskById: () => null,
		});

		await waitFor(() => (consoleErrorSpy?.mock.calls.length ?? 0) > 0);
		await waitFor(() => container.querySelector("[role='dialog']") === null);

		expect(container.querySelector("[role='dialog']")).toBeNull();
		expect(consoleErrorSpy?.mock.calls.length ?? 0).toBeGreaterThan(0);
		expect(consoleErrorSpy?.mock.calls[0]?.[0]).toBe("Failed to load task from deep link:");
	});
});
