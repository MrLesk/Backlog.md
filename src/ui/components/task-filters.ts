/**
 * Task filter components for the TUI
 */

import type { BoxInterface, ElementInterface, ListInterface, ScreenInterface } from "neo-neo-bblessed";
import { box, list } from "neo-neo-bblessed";
import type { Core } from "../../core/backlog.ts";
import { getValidStatuses } from "../../utils/status.ts";

export interface FilterState {
	status?: string;
	priority?: string;
}

export interface TaskFiltersOptions {
	parent: ElementInterface | ScreenInterface;
	core: Core;
	left: string | number;
	top: string | number;
	width: string | number;
	height: string | number;
	onFilterChange?: (filter: FilterState) => void;
	initialFilter?: FilterState;
}

export interface TaskFiltersController {
	getFilter(): FilterState;
	focus(): void;
	destroy(): void;
	isVisible(): boolean;
	toggle(): void;
	hide(): void;
	show(): void;
}

const PRIORITY_OPTIONS = ["high", "medium", "low"];

export class TaskFilters implements TaskFiltersController {
	private container!: BoxInterface;
	private statusBox!: BoxInterface;
	private priorityBox!: BoxInterface;
	private statusList!: ListInterface;
	private priorityList!: ListInterface;
	private core: Core;
	private onFilterChange?: (filter: FilterState) => void;
	private currentFilter: FilterState;
	private visible = false;
	private statusOptions: string[] = [];

	constructor(options: TaskFiltersOptions) {
		this.core = options.core;
		this.onFilterChange = options.onFilterChange;
		this.currentFilter = options.initialFilter || {};

		this.createComponents(options);
		this.loadStatusOptions();
	}

	private createComponents(options: TaskFiltersOptions): void {
		// Main container - initially hidden
		this.container = box({
			parent: options.parent,
			left: options.left,
			top: options.top,
			width: options.width,
			height: options.height,
			border: "line",
			label: " Filters ",
			style: {
				border: { fg: "blue" },
			},
			hidden: true,
		});

		// Status filter box (left half)
		this.statusBox = box({
			parent: this.container,
			left: 0,
			top: 0,
			width: "50%-1",
			height: "100%-2",
			border: "line",
			label: " Status ",
			style: {
				border: { fg: "gray" },
			},
		});

		// Priority filter box (right half)
		this.priorityBox = box({
			parent: this.container,
			left: "50%",
			top: 0,
			width: "50%",
			height: "100%-2",
			border: "line",
			label: " Priority ",
			style: {
				border: { fg: "gray" },
			},
		});

		// Status list
		this.statusList = list({
			parent: this.statusBox,
			left: 1,
			top: 1,
			width: "100%-2",
			height: "100%-2",
			style: {
				selected: { fg: "white", bg: "blue" },
				item: { fg: "white" },
			},
			keys: false, // Disable built-in key handling
			tags: true,
		});

		// Priority list
		this.priorityList = list({
			parent: this.priorityBox,
			left: 1,
			top: 1,
			width: "100%-2",
			height: "100%-2",
			style: {
				selected: { fg: "white", bg: "blue" },
				item: { fg: "white" },
			},
			keys: false, // Disable built-in key handling
			tags: true,
		});

		this.setupPriorityList();
		this.setupEventHandlers();
	}

	private async loadStatusOptions(): Promise<void> {
		try {
			this.statusOptions = await getValidStatuses(this.core);
			this.setupStatusList();
		} catch {
			this.statusOptions = ["To Do", "In Progress", "Done"];
			this.setupStatusList();
		}
	}

	private setupStatusList(): void {
		const items = ["All", ...this.statusOptions];
		this.statusList.setItems(items);

		// Set initial selection
		const currentStatus = this.currentFilter.status;
		if (currentStatus) {
			const index = items.findIndex((item) => item.toLowerCase() === currentStatus.toLowerCase());
			if (index >= 0) {
				this.statusList.select(index);
			}
		} else {
			this.statusList.select(0); // "All"
		}
	}

	private setupPriorityList(): void {
		const items = ["All", ...PRIORITY_OPTIONS];
		this.priorityList.setItems(items);

		// Set initial selection
		const currentPriority = this.currentFilter.priority;
		if (currentPriority) {
			const index = items.findIndex((item) => item.toLowerCase() === currentPriority.toLowerCase());
			if (index >= 0) {
				this.priorityList.select(index);
			}
		} else {
			this.priorityList.select(0); // "All"
		}
	}

	private setupEventHandlers(): void {
		let focusedList: "status" | "priority" = "status";

		const updateFocus = () => {
			if (focusedList === "status") {
				const statusStyle = this.statusBox.style as { border?: { fg?: string } };
				const priorityStyle = this.priorityBox.style as { border?: { fg?: string } };
				if (statusStyle.border) statusStyle.border.fg = "yellow";
				if (priorityStyle.border) priorityStyle.border.fg = "gray";
				this.statusList.focus();
			} else {
				const statusStyle = this.statusBox.style as { border?: { fg?: string } };
				const priorityStyle = this.priorityBox.style as { border?: { fg?: string } };
				if (statusStyle.border) statusStyle.border.fg = "gray";
				if (priorityStyle.border) priorityStyle.border.fg = "yellow";
				this.priorityList.focus();
			}
			this.getScreen()?.render?.();
		};

		// Navigation between lists
		this.container.key(["left", "h"], () => {
			focusedList = "status";
			updateFocus();
		});

		this.container.key(["right", "l"], () => {
			focusedList = "priority";
			updateFocus();
		});

		// Selection handlers
		const applyFilter = () => {
			const statusIndex = this.statusList.selected ?? 0;
			const priorityIndex = this.priorityList.selected ?? 0;

			const statusItems = ["All", ...this.statusOptions];
			const priorityItems = ["All", ...PRIORITY_OPTIONS];

			const selectedStatus = statusItems[statusIndex];
			const selectedPriority = priorityItems[priorityIndex];

			this.currentFilter = {
				status: selectedStatus === "All" ? undefined : selectedStatus,
				priority: selectedPriority === "All" ? undefined : selectedPriority,
			};

			this.onFilterChange?.(this.currentFilter);
		};

		// Status list navigation and selection
		this.statusList.key(["up", "k"], () => {
			const current = this.statusList.selected ?? 0;
			const items = this.statusList.items?.length ?? 0;
			const next = current > 0 ? current - 1 : items - 1;
			this.statusList.select(next);
		});

		this.statusList.key(["down", "j"], () => {
			const current = this.statusList.selected ?? 0;
			const items = this.statusList.items?.length ?? 0;
			const next = current < items - 1 ? current + 1 : 0;
			this.statusList.select(next);
		});

		this.statusList.key(["enter"], () => {
			applyFilter();
		});

		// Priority list navigation and selection
		this.priorityList.key(["up", "k"], () => {
			const current = this.priorityList.selected ?? 0;
			const items = this.priorityList.items?.length ?? 0;
			const next = current > 0 ? current - 1 : items - 1;
			this.priorityList.select(next);
		});

		this.priorityList.key(["down", "j"], () => {
			const current = this.priorityList.selected ?? 0;
			const items = this.priorityList.items?.length ?? 0;
			const next = current < items - 1 ? current + 1 : 0;
			this.priorityList.select(next);
		});

		this.priorityList.key(["enter"], () => {
			applyFilter();
		});

		// Clear all filters
		this.container.key(["c", "C"], () => {
			this.statusList.select(0);
			this.priorityList.select(0);
			applyFilter();
		});

		// Hide filters
		this.container.key(["escape", "f"], () => {
			this.hide();
		});

		// Initialize focus
		updateFocus();
	}

	// Public interface methods
	public getFilter(): FilterState {
		return { ...this.currentFilter };
	}

	public focus(): void {
		if (this.visible) {
			this.statusList.focus();
		}
	}

	public destroy(): void {
		this.container.destroy();
	}

	public isVisible(): boolean {
		return this.visible;
	}

	public toggle(): void {
		if (this.visible) {
			this.hide();
		} else {
			this.show();
		}
	}

	public hide(): void {
		(this.container as unknown as { hide: () => void }).hide();
		this.visible = false;
		this.getScreen()?.render?.();
	}

	public show(): void {
		(this.container as unknown as { show: () => void }).show();
		this.visible = true;
		this.focus();
		this.getScreen()?.render?.();
	}

	private getScreen(): ScreenInterface | undefined {
		const maybeHasScreen = this.container as unknown as { screen?: ScreenInterface };
		return maybeHasScreen?.screen;
	}
}

// Factory function
export function createTaskFilters(options: TaskFiltersOptions): TaskFilters {
	return new TaskFilters(options);
}
