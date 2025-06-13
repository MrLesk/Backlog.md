/* Task list component for displaying a list of tasks in the left pane */

import { createRequire } from "node:module";
import { stdout as output } from "node:process";
import type { Task } from "../types/index.ts";
import { formatStatusWithIcon, getStatusColor } from "./status-icon.ts";

// Load bblessed dynamically
// biome-ignore lint/suspicious/noExplicitAny: bblessed is dynamically loaded
async function loadBlessed(): Promise<any | null> {
	if (output.isTTY === false) return null;
	try {
		const require = createRequire(import.meta.url);
		const blessed = require("bblessed");
		return blessed;
	} catch {
		try {
			// biome-ignore lint/suspicious/noExplicitAny: dynamic import
			const mod = (await import("bblessed")) as any;
			return mod.default ?? mod;
		} catch {
			return null;
		}
	}
}

export interface TaskListOptions {
	// biome-ignore lint/suspicious/noExplicitAny: blessed parent element
	parent: any;
	top?: number | string;
	left?: number | string;
	width?: number | string;
	height?: number | string;
	tasks: Task[];
	selectedIndex?: number;
	onSelect?: (task: Task, index: number) => void;
}

export class TaskList {
	// biome-ignore lint/suspicious/noExplicitAny: blessed components
	private blessed: any;
	// biome-ignore lint/suspicious/noExplicitAny: blessed list component
	private listBox: any;
	private tasks: Task[];
	private selectedIndex: number;
	private onSelect?: (task: Task, index: number) => void;

	constructor(options: TaskListOptions) {
		this.tasks = options.tasks;
		this.selectedIndex = options.selectedIndex || 0;
		this.onSelect = options.onSelect;
	}

	async create(options: TaskListOptions): Promise<void> {
		this.blessed = await loadBlessed();
		if (!this.blessed) return;

		// Create the list box
		this.listBox = this.blessed.list({
			parent: options.parent,
			top: options.top || 0,
			left: options.left || 0,
			width: options.width || "30%",
			height: options.height || "100%",
			border: "line",
			label: " Tasks ",
			style: {
				border: { fg: "blue" },
				selected: { fg: "white", bg: "blue" },
				item: { fg: "white" },
				focus: { border: { fg: "yellow" } },
			},
			tags: true,
			keys: true,
			vi: true,
			mouse: true,
			scrollable: true,
			alwaysScroll: false,
		});

		this.refreshList();
		this.setupEventHandlers();

		// Select the first item if tasks exist
		if (this.tasks.length > 0) {
			this.listBox.select(this.selectedIndex);
			this.triggerSelection();
		}
	}

	private refreshList(): void {
		if (!this.listBox) return;

		const items = this.tasks.map((task) => {
			const statusIcon = formatStatusWithIcon(task.status);
			const statusColor = getStatusColor(task.status);
			const assigneeText = task.assignee?.length
				? ` {cyan-fg}${task.assignee[0].startsWith("@") ? task.assignee[0] : `@${task.assignee[0]}`}{/}`
				: "";
			const labelsText = task.labels?.length ? ` {yellow-fg}[${task.labels.join(", ")}]{/}` : "";

			return `{${statusColor}-fg}${statusIcon}{/} {bold}${task.id}{/bold} - ${task.title}${assigneeText}${labelsText}`;
		});

		this.listBox.setItems(items);
	}

	private setupEventHandlers(): void {
		if (!this.listBox) return;

		// Handle selection changes
		// biome-ignore lint/suspicious/noExplicitAny: blessed event handler parameter
		this.listBox.on("select", (item: any, index: number) => {
			this.selectedIndex = index;
			this.triggerSelection();
		});

		// Let blessed handle navigation automatically through the 'select' event above

		// Handle mouse clicks
		this.listBox.on("click", () => {
			this.triggerSelection();
		});
	}

	private triggerSelection(): void {
		if (this.onSelect && this.tasks.length > 0 && this.selectedIndex >= 0 && this.selectedIndex < this.tasks.length) {
			const selectedTask = this.tasks[this.selectedIndex];
			this.onSelect(selectedTask, this.selectedIndex);
		}
	}

	public updateTasks(tasks: Task[]): void {
		this.tasks = tasks;
		this.refreshList();

		// Ensure selected index is within bounds
		if (this.selectedIndex >= this.tasks.length) {
			this.selectedIndex = Math.max(0, this.tasks.length - 1);
		}

		if (this.tasks.length > 0) {
			this.listBox.select(this.selectedIndex);
			this.triggerSelection();
		}
	}

	public getSelectedTask(): Task | null {
		if (this.selectedIndex >= 0 && this.selectedIndex < this.tasks.length) {
			return this.tasks[this.selectedIndex];
		}
		return null;
	}

	public getSelectedIndex(): number {
		return this.selectedIndex;
	}

	public focus(): void {
		if (this.listBox) {
			this.listBox.focus();
		}
	}

	public getListBox() {
		return this.listBox;
	}
}
