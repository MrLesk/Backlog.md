/**
 * FilterHeader component with CSS flexbox-like wrap behavior.
 * Filter items flow left-to-right and wrap to new rows when they don't fit.
 */

import type { BoxInterface, ScreenInterface, TextboxInterface } from "neo-neo-bblessed";
import { box, textbox } from "neo-neo-bblessed";
import { formatLabelSummary } from "../../utils/label-filter.ts";
import { NO_MILESTONE_FILTER_LABEL, NO_MILESTONE_FILTER_VALUE } from "../../utils/milestone-filter.ts";

export type FilterControlId = "search" | "status" | "priority" | "labels" | "milestone";

export interface FilterState {
	search: string;
	status: string;
	priority: string;
	labels: string[];
	milestone: string;
}

export interface FilterHeaderOptions {
	parent: BoxInterface | ScreenInterface;
	statuses: string[];
	availableLabels: string[];
	availableMilestones: string[];
	initialFilters?: Partial<FilterState>;
	visibleFilters?: FilterControlId[];
	onFilterChange: (filters: FilterState) => void;
	onFilterPickerOpen: (filterId: Exclude<FilterControlId, "search">) => void;
}

interface FilterItem {
	id: FilterControlId;
	labelText: string;
	labelWidth: number;
	minWidth: number;
	flexGrow: boolean; // If true, takes remaining space in row
}

interface LayoutRow {
	items: FilterItem[];
	y: number;
}

interface LayoutResult {
	rows: LayoutRow[];
	height: number;
}

const ALL_FILTER_ITEMS: FilterItem[] = [
	{ id: "search", labelText: "Search:", labelWidth: 8, minWidth: 28, flexGrow: true },
	{ id: "status", labelText: "Status:", labelWidth: 8, minWidth: 22, flexGrow: false },
	{ id: "priority", labelText: "Priority:", labelWidth: 9, minWidth: 20, flexGrow: false },
	{ id: "milestone", labelText: "Milestone:", labelWidth: 10, minWidth: 22, flexGrow: false },
	{ id: "labels", labelText: "Labels:", labelWidth: 8, minWidth: 18, flexGrow: false },
];

const PADDING = 1; // Left padding inside header box
const GAP = 2; // Gap between filter items

export function resolveSearchHorizontalNavigation(
	textWidth: number,
	cursorX: number,
	direction: "left" | "right",
): "stay" | "cycle-prev" | "cycle-next" {
	if (textWidth <= 0) {
		return direction === "left" ? "cycle-prev" : "cycle-next";
	}
	if (direction === "left" && cursorX <= -textWidth) {
		return "cycle-prev";
	}
	if (direction === "right" && cursorX >= 0) {
		return "cycle-next";
	}
	return "stay";
}

function normalizeVisibleFilters(visible: FilterControlId[] | undefined): FilterControlId[] {
	if (!visible || visible.length === 0) {
		return ALL_FILTER_ITEMS.map((item) => item.id);
	}
	const allowed = new Set(visible);
	const ordered = ALL_FILTER_ITEMS.map((item) => item.id).filter((id) => allowed.has(id));
	return ordered.length > 0 ? ordered : ALL_FILTER_ITEMS.map((item) => item.id);
}

function visibleFilterItems(ids: FilterControlId[]): FilterItem[] {
	const allowed = new Set(ids);
	return ALL_FILTER_ITEMS.filter((item) => allowed.has(item.id));
}

/**
 * Compute row layout using flex-wrap algorithm
 */
function computeLayout(items: FilterItem[], availableWidth: number): LayoutResult {
	const rows: LayoutRow[] = [];
	let currentRow: FilterItem[] = [];
	let currentRowWidth = 0;

	for (const item of items) {
		const itemWidth = item.minWidth;
		const widthWithGap = currentRow.length > 0 ? itemWidth + GAP : itemWidth;

		if (currentRowWidth + widthWithGap > availableWidth && currentRow.length > 0) {
			rows.push({ items: currentRow, y: rows.length });
			currentRow = [item];
			currentRowWidth = itemWidth;
		} else {
			currentRow.push(item);
			currentRowWidth += widthWithGap;
		}
	}

	if (currentRow.length > 0) {
		rows.push({ items: currentRow, y: rows.length });
	}

	const height = 2 + rows.length; // top border + content rows + bottom border
	return { rows, height };
}

export class FilterHeader {
	private container: BoxInterface;
	private parent: BoxInterface | ScreenInterface;
	private options: FilterHeaderOptions;
	private state: FilterState;
	private currentLayout: LayoutResult;
	private visibleFilterIds: FilterControlId[];

	// Element references for focus management and updates
	private searchInput: TextboxInterface | null = null;
	private statusButton: BoxInterface | null = null;
	private priorityButton: BoxInterface | null = null;
	private milestoneButton: BoxInterface | null = null;
	private labelsButton: BoxInterface | null = null;
	private elements: (BoxInterface | TextboxInterface)[] = [];

	// Focus tracking
	private currentFocus: FilterControlId | null = null;
	private onFocusChange?: (focus: FilterControlId | null) => void;
	private onExitRequest?: (direction: "up" | "down" | "escape") => void;
	private suppressHorizontalCycle = false;

	constructor(options: FilterHeaderOptions) {
		this.options = options;
		this.parent = options.parent;
		this.visibleFilterIds = normalizeVisibleFilters(options.visibleFilters);
		this.state = {
			search: options.initialFilters?.search ?? "",
			status: options.initialFilters?.status ?? "",
			priority: options.initialFilters?.priority ?? "",
			labels: options.initialFilters?.labels ?? [],
			milestone: options.initialFilters?.milestone ?? "",
		};

		const parentWidth = typeof this.parent.width === "number" ? this.parent.width : 80;
		const availableWidth = parentWidth - 2 - PADDING * 2;
		this.currentLayout = computeLayout(visibleFilterItems(this.visibleFilterIds), availableWidth);

		this.container = box({
			parent: this.parent,
			top: 0,
			left: 0,
			width: "100%",
			height: this.currentLayout.height,
			border: { type: "line" },
			style: { border: { fg: "cyan" } },
			label: "\u00A0Filters\u00A0",
		});

		this.buildElements();
	}

	/**
	 * Get current header height (for positioning elements below)
	 */
	getHeight(): number {
		return this.currentLayout.height;
	}

	/**
	 * Get current filter state
	 */
	getFilters(): FilterState {
		return { ...this.state };
	}

	/**
	 * Update filter state externally
	 */
	setFilters(filters: Partial<FilterState>): void {
		if (filters.search !== undefined) {
			this.state.search = filters.search;
			this.searchInput?.setValue(filters.search);
		}
		if (filters.status !== undefined) {
			this.state.status = filters.status;
			this.updateStatusButton();
		}
		if (filters.priority !== undefined) {
			this.state.priority = filters.priority;
			this.updatePriorityButton();
		}
		if (filters.labels !== undefined) {
			this.state.labels = filters.labels;
			this.updateLabelsButton();
		}
		if (filters.milestone !== undefined) {
			this.state.milestone = filters.milestone;
			this.updateMilestoneButton();
		}
	}

	/**
	 * Rebuild layout on resize
	 */
	rebuild(): void {
		const parentWidth = typeof this.parent.width === "number" ? this.parent.width : 80;
		const availableWidth = parentWidth - 2 - PADDING * 2;
		const newLayout = computeLayout(visibleFilterItems(this.visibleFilterIds), availableWidth);

		if (newLayout.height !== this.currentLayout.height || newLayout.rows.length !== this.currentLayout.rows.length) {
			this.currentLayout = newLayout;
			this.container.height = newLayout.height;
			this.destroyElements();
			this.buildElements();
		} else {
			this.repositionElements();
		}
	}

	focusSearch(): void {
		this.searchInput?.focus();
	}

	focusStatus(): void {
		this.statusButton?.focus();
	}

	focusPriority(): void {
		this.priorityButton?.focus();
	}

	focusMilestone(): void {
		this.milestoneButton?.focus();
	}

	focusLabels(): void {
		this.labelsButton?.focus();
	}

	setFocusChangeHandler(handler: (focus: FilterControlId | null) => void): void {
		this.onFocusChange = handler;
	}

	setExitRequestHandler(handler: (direction: "up" | "down" | "escape") => void): void {
		this.onExitRequest = handler;
	}

	setBorderColor(color: string): void {
		const style = this.container.style as { border?: { fg?: string } };
		style.border = { ...(style.border ?? {}), fg: color };
	}

	getContainer(): BoxInterface {
		return this.container;
	}

	getCurrentFocus(): FilterControlId | null {
		return this.currentFocus;
	}

	cycleNext(): void {
		const order = this.visibleFilterIds;
		const currentIndex = this.currentFocus ? order.indexOf(this.currentFocus) : -1;
		const nextIndex = (currentIndex + 1) % order.length;
		const nextFocus = order[nextIndex];
		if (nextFocus) {
			this.focusByName(nextFocus);
		}
	}

	cyclePrev(): void {
		const order = this.visibleFilterIds;
		const currentIndex = this.currentFocus ? order.indexOf(this.currentFocus) : 0;
		const prevIndex = (currentIndex - 1 + order.length) % order.length;
		const prevFocus = order[prevIndex];
		if (prevFocus) {
			this.focusByName(prevFocus);
		}
	}

	destroy(): void {
		this.destroyElements();
		this.container.destroy();
	}

	setLabels(labels: string[]): void {
		this.state.labels = labels;
		this.updateLabelsButton();
		this.emitFilterChange();
	}

	private requestExit(direction: "up" | "down" | "escape"): void {
		this.onExitRequest?.(direction);
		this.onFocusChange?.(null);
	}

	private commitSearchValue(): void {
		const value = this.searchInput?.getValue?.();
		if (value !== undefined && value !== this.state.search) {
			this.state.search = String(value);
			this.emitFilterChange();
		}
	}

	private getSearchCursorX(): number {
		const searchInput = this.searchInput as unknown as { getCursor?: () => { x: number; y: number } };
		return searchInput.getCursor?.().x ?? 0;
	}

	private getSearchTextWidth(value: string): number {
		const searchInput = this.searchInput as unknown as { strWidth?: (input: string) => number };
		return searchInput.strWidth?.(value) ?? value.length;
	}

	private suppressNextHorizontalCycle(): void {
		this.suppressHorizontalCycle = true;
		setImmediate(() => {
			this.suppressHorizontalCycle = false;
		});
	}

	private focusByName(name: FilterControlId): void {
		switch (name) {
			case "search":
				this.focusSearch();
				break;
			case "status":
				this.focusStatus();
				break;
			case "priority":
				this.focusPriority();
				break;
			case "milestone":
				this.focusMilestone();
				break;
			case "labels":
				this.focusLabels();
				break;
		}
	}

	private destroyElements(): void {
		for (const element of this.elements) {
			element.destroy();
		}
		this.elements = [];
		this.searchInput = null;
		this.statusButton = null;
		this.priorityButton = null;
		this.milestoneButton = null;
		this.labelsButton = null;
	}

	private buildElements(): void {
		const parentWidth = typeof this.parent.width === "number" ? this.parent.width : 80;
		const availableWidth = parentWidth - 2 - PADDING * 2;

		for (const row of this.currentLayout.rows) {
			this.buildRow(row, availableWidth);
		}
	}

	private buildRow(row: LayoutRow, availableWidth: number): void {
		let x = PADDING;

		let totalFixedWidth = 0;
		for (const item of row.items) {
			totalFixedWidth += item.minWidth;
		}
		totalFixedWidth += GAP * (row.items.length - 1);

		const extraSpace = Math.max(0, availableWidth - totalFixedWidth);

		for (const item of row.items) {
			let itemWidth = item.minWidth;
			if (item.flexGrow) {
				itemWidth += extraSpace;
			}

			this.buildFilterItem(item, x, row.y, itemWidth);
			x += itemWidth + GAP;
		}
	}

	private buildFilterItem(item: FilterItem, x: number, y: number, width: number): void {
		const label = box({
			parent: this.container,
			content: item.labelText,
			top: y,
			left: x,
			width: item.labelWidth,
			height: 1,
			tags: true,
		});
		this.elements.push(label);

		const controlX = x + item.labelWidth;
		const controlWidth = width - item.labelWidth;

		switch (item.id) {
			case "search":
				this.buildSearchInput(controlX, y, controlWidth);
				break;
			case "status":
				this.buildPopupButton("status", controlX, y, controlWidth);
				break;
			case "priority":
				this.buildPopupButton("priority", controlX, y, controlWidth);
				break;
			case "milestone":
				this.buildPopupButton("milestone", controlX, y, controlWidth);
				break;
			case "labels":
				this.buildPopupButton("labels", controlX, y, controlWidth);
				break;
		}
	}

	private buildSearchInput(x: number, y: number, width: number): void {
		this.searchInput = textbox({
			parent: this.container,
			value: this.state.search,
			top: y,
			left: x,
			width,
			height: 1,
			inputOnFocus: false,
			mouse: true,
			keys: true,
			style: {
				fg: "white",
				bg: "black",
				focus: { fg: "black", bg: "cyan", bold: true },
			},
		});
		this.elements.push(this.searchInput);

		this.searchInput.on("submit", (value: unknown) => {
			this.state.search = String(value || "");
			this.emitFilterChange();
		});

		this.searchInput.on("focus", () => {
			this.currentFocus = "search";
			this.setBorderColor("yellow");
			this.searchInput?.readInput?.();
			this.onFocusChange?.("search");
		});

		this.searchInput.on("blur", () => {
			if (this.currentFocus === "search") {
				this.commitSearchValue();
			}
		});

		this.searchInput.key(["left"], () => {
			this.commitSearchValue();
			this.searchInput?.cancel();
			this.suppressNextHorizontalCycle();
			this.cyclePrev();
			return false;
		});

		this.searchInput.key(["right"], () => {
			const value = String(this.searchInput?.getValue?.() ?? this.state.search);
			const behavior = resolveSearchHorizontalNavigation(
				this.getSearchTextWidth(value),
				this.getSearchCursorX(),
				"right",
			);
			if (behavior === "cycle-next") {
				this.commitSearchValue();
				this.searchInput?.cancel();
				this.suppressNextHorizontalCycle();
				this.cycleNext();
				return false;
			}
			return true;
		});

		this.searchInput.key(["down"], () => {
			this.commitSearchValue();
			this.searchInput?.cancel();
			this.requestExit("down");
			return false;
		});

		this.searchInput.key(["up"], () => {
			this.commitSearchValue();
			this.searchInput?.cancel();
			this.requestExit("up");
			return false;
		});

		this.searchInput.key(["escape"], () => {
			this.searchInput?.cancel();
			this.requestExit("escape");
			return false;
		});

		let searchTimeout: ReturnType<typeof setTimeout> | null = null;
		this.searchInput.on("keypress", () => {
			if (searchTimeout) {
				clearTimeout(searchTimeout);
			}
			searchTimeout = setTimeout(() => {
				const value = this.searchInput?.getValue?.();
				if (value !== undefined && value !== this.state.search) {
					this.state.search = String(value);
					this.emitFilterChange();
				}
			}, 150);
		});
	}

	private buildPopupButton(field: Exclude<FilterControlId, "search">, x: number, y: number, width: number): void {
		const button = box({
			parent: this.container,
			content: this.getPopupButtonContent(field),
			top: y,
			left: x,
			width,
			height: 1,
			mouse: true,
			keys: true,
			style: {
				fg: "white",
				bg: "black",
				focus: { fg: "black", bg: "cyan" },
			},
		});
		this.elements.push(button);

		if (field === "status") this.statusButton = button;
		if (field === "priority") this.priorityButton = button;
		if (field === "milestone") this.milestoneButton = button;
		if (field === "labels") this.labelsButton = button;

		button.on("click", () => {
			this.options.onFilterPickerOpen(field);
		});

		button.on("focus", () => {
			this.currentFocus = field;
			this.setBorderColor("yellow");
			const style = button.style as { bg?: string; fg?: string };
			style.bg = "blue";
			style.fg = "white";
			this.onFocusChange?.(field);
		});

		button.on("blur", () => {
			const style = button.style as { bg?: string; fg?: string };
			style.bg = "black";
			style.fg = "white";
		});

		button.key(["enter", "space"], () => {
			this.options.onFilterPickerOpen(field);
			return false;
		});

		button.key(["right"], () => {
			if (this.suppressHorizontalCycle) {
				return false;
			}
			this.cycleNext();
			return false;
		});

		button.key(["left"], () => {
			if (this.suppressHorizontalCycle) {
				return false;
			}
			this.cyclePrev();
			return false;
		});

		button.key(["escape"], () => {
			this.requestExit("escape");
			return false;
		});

		button.key(["down"], () => {
			this.requestExit("down");
			return false;
		});
	}

	private getPopupButtonContent(field: Exclude<FilterControlId, "search">): string {
		switch (field) {
			case "status":
				return this.state.status ? `${this.state.status} ▼` : "All ▼";
			case "priority":
				return this.state.priority ? `${this.state.priority} ▼` : "All ▼";
			case "milestone":
				if (!this.state.milestone) {
					return "All ▼";
				}
				return `${this.state.milestone === NO_MILESTONE_FILTER_VALUE ? NO_MILESTONE_FILTER_LABEL : this.state.milestone} ▼`;
			case "labels": {
				const summary = formatLabelSummary(this.state.labels).replace(/^Labels:\s*/, "");
				return `${summary} ▼`;
			}
		}
	}

	private updateStatusButton(): void {
		if (!this.statusButton) return;
		this.statusButton.setContent(this.getPopupButtonContent("status"));
	}

	private updatePriorityButton(): void {
		if (!this.priorityButton) return;
		this.priorityButton.setContent(this.getPopupButtonContent("priority"));
	}

	private updateMilestoneButton(): void {
		if (!this.milestoneButton) return;
		this.milestoneButton.setContent(this.getPopupButtonContent("milestone"));
	}

	private updateLabelsButton(): void {
		if (!this.labelsButton) return;
		this.labelsButton.setContent(this.getPopupButtonContent("labels"));
	}

	private repositionElements(): void {
		this.destroyElements();
		this.buildElements();
	}

	private emitFilterChange(): void {
		this.options.onFilterChange({ ...this.state });
	}
}

/**
 * Factory function for creating FilterHeader
 */
export function createFilterHeader(options: FilterHeaderOptions): FilterHeader {
	return new FilterHeader(options);
}
