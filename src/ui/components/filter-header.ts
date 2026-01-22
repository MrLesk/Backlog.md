/**
 * FilterHeader component with CSS flexbox-like wrap behavior.
 * Filter items flow left-to-right and wrap to new rows when they don't fit.
 */

import type { BoxInterface, ListInterface, ScreenInterface, TextboxInterface } from "neo-neo-bblessed";
import { box, list, textbox } from "neo-neo-bblessed";
import { formatLabelSummary } from "../../utils/label-filter.ts";

export interface FilterState {
	search: string;
	status: string;
	priority: string;
	labels: string[];
}

export interface FilterHeaderOptions {
	parent: BoxInterface | ScreenInterface;
	statuses: string[];
	availableLabels: string[];
	initialFilters?: Partial<FilterState>;
	onFilterChange: (filters: FilterState) => void;
	onLabelPickerOpen: () => void;
}

interface FilterItem {
	id: "search" | "status" | "priority" | "labels";
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

// Filter items configuration - order matters for layout
const FILTER_ITEMS: FilterItem[] = [
	{ id: "search", labelText: "Search:", labelWidth: 8, minWidth: 28, flexGrow: true },
	{ id: "status", labelText: "Status:", labelWidth: 8, minWidth: 22, flexGrow: false },
	{ id: "priority", labelText: "Priority:", labelWidth: 9, minWidth: 20, flexGrow: false },
	{ id: "labels", labelText: "Labels:", labelWidth: 8, minWidth: 18, flexGrow: false },
];

const PADDING = 1; // Left padding inside header box
const GAP = 2; // Gap between filter items

/**
 * Compute row layout using flex-wrap algorithm
 */
function computeLayout(availableWidth: number): LayoutResult {
	const rows: LayoutRow[] = [];
	let currentRow: FilterItem[] = [];
	let currentRowWidth = 0;

	for (const item of FILTER_ITEMS) {
		const itemWidth = item.minWidth;
		const widthWithGap = currentRow.length > 0 ? itemWidth + GAP : itemWidth;

		if (currentRowWidth + widthWithGap > availableWidth && currentRow.length > 0) {
			// Wrap to next row
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

	// Height = top border (1) + content rows + bottom border (1)
	const height = 2 + rows.length;

	return { rows, height };
}

export class FilterHeader {
	private container: BoxInterface;
	private parent: BoxInterface | ScreenInterface;
	private options: FilterHeaderOptions;
	private state: FilterState;
	private currentLayout: LayoutResult;

	// Element references for focus management and updates
	private searchInput: TextboxInterface | null = null;
	private statusSelector: ListInterface | null = null;
	private prioritySelector: ListInterface | null = null;
	private labelsButton: BoxInterface | null = null;
	private elements: (BoxInterface | TextboxInterface | ListInterface)[] = [];

	// Focus tracking
	private currentFocus: "search" | "status" | "priority" | "labels" | null = null;
	private onFocusChange?: (focus: "search" | "status" | "priority" | "labels" | null) => void;

	constructor(options: FilterHeaderOptions) {
		this.options = options;
		this.parent = options.parent;
		this.state = {
			search: options.initialFilters?.search ?? "",
			status: options.initialFilters?.status ?? "",
			priority: options.initialFilters?.priority ?? "",
			labels: options.initialFilters?.labels ?? [],
		};

		// Compute initial layout
		const parentWidth = typeof this.parent.width === "number" ? this.parent.width : 80;
		const availableWidth = parentWidth - 2 - PADDING * 2; // Subtract borders and padding
		this.currentLayout = computeLayout(availableWidth);

		// Create container
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
			this.updateStatusSelector();
		}
		if (filters.priority !== undefined) {
			this.state.priority = filters.priority;
			this.updatePrioritySelector();
		}
		if (filters.labels !== undefined) {
			this.state.labels = filters.labels;
			this.updateLabelsButton();
		}
	}

	/**
	 * Rebuild layout on resize
	 */
	rebuild(): void {
		const parentWidth = typeof this.parent.width === "number" ? this.parent.width : 80;
		const availableWidth = parentWidth - 2 - PADDING * 2;
		const newLayout = computeLayout(availableWidth);

		// Only rebuild if layout changed
		if (newLayout.height !== this.currentLayout.height || newLayout.rows.length !== this.currentLayout.rows.length) {
			this.currentLayout = newLayout;
			this.container.height = newLayout.height;

			// Destroy and rebuild elements
			this.destroyElements();
			this.buildElements();
		} else {
			// Just reposition elements within existing layout
			this.repositionElements();
		}
	}

	/**
	 * Focus the search input
	 */
	focusSearch(): void {
		this.searchInput?.focus();
	}

	/**
	 * Focus the status selector
	 */
	focusStatus(): void {
		this.statusSelector?.focus();
	}

	/**
	 * Focus the priority selector
	 */
	focusPriority(): void {
		this.prioritySelector?.focus();
	}

	/**
	 * Focus the labels button
	 */
	focusLabels(): void {
		this.labelsButton?.focus();
	}

	/**
	 * Set callback for focus changes
	 */
	setFocusChangeHandler(handler: (focus: "search" | "status" | "priority" | "labels" | null) => void): void {
		this.onFocusChange = handler;
	}

	/**
	 * Set header border color (for active state indication)
	 */
	setBorderColor(color: string): void {
		const style = this.container.style as { border?: { fg?: string } };
		style.border = { ...(style.border ?? {}), fg: color };
	}

	/**
	 * Get the container box (for event binding)
	 */
	getContainer(): BoxInterface {
		return this.container;
	}

	/**
	 * Get current focus
	 */
	getCurrentFocus(): "search" | "status" | "priority" | "labels" | null {
		return this.currentFocus;
	}

	/**
	 * Cycle to next filter (Tab navigation)
	 */
	cycleNext(): void {
		const order: ("search" | "status" | "priority" | "labels")[] = ["search", "status", "priority", "labels"];
		const currentIndex = this.currentFocus ? order.indexOf(this.currentFocus) : -1;
		const nextIndex = (currentIndex + 1) % order.length;
		const nextFocus = order[nextIndex];
		if (nextFocus) {
			this.focusByName(nextFocus);
		}
	}

	/**
	 * Cycle to previous filter (Shift+Tab navigation)
	 */
	cyclePrev(): void {
		const order: ("search" | "status" | "priority" | "labels")[] = ["search", "status", "priority", "labels"];
		const currentIndex = this.currentFocus ? order.indexOf(this.currentFocus) : 0;
		const prevIndex = (currentIndex - 1 + order.length) % order.length;
		const prevFocus = order[prevIndex];
		if (prevFocus) {
			this.focusByName(prevFocus);
		}
	}

	/**
	 * Clean up resources
	 */
	destroy(): void {
		this.destroyElements();
		this.container.destroy();
	}

	// Private methods

	private focusByName(name: "search" | "status" | "priority" | "labels"): void {
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
		this.statusSelector = null;
		this.prioritySelector = null;
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
		// Calculate positions for items in this row
		let x = PADDING;

		// Calculate total fixed width
		let totalFixedWidth = 0;
		for (const item of row.items) {
			totalFixedWidth += item.minWidth;
		}
		totalFixedWidth += GAP * (row.items.length - 1);

		// Extra space goes to flex item
		const extraSpace = Math.max(0, availableWidth - totalFixedWidth);

		for (let i = 0; i < row.items.length; i++) {
			const item = row.items[i];
			if (!item) continue;
			let itemWidth = item.minWidth;

			// Flex item gets extra space
			if (item.flexGrow) {
				itemWidth += extraSpace;
			}

			this.buildFilterItem(item, x, row.y, itemWidth);

			x += itemWidth + GAP;
		}
	}

	private buildFilterItem(item: FilterItem, x: number, y: number, width: number): void {
		// Create label
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

		// Create control (after label)
		const controlX = x + item.labelWidth;
		const controlWidth = width - item.labelWidth;

		switch (item.id) {
			case "search":
				this.buildSearchInput(controlX, y, controlWidth);
				break;
			case "status":
				this.buildStatusSelector(controlX, y, controlWidth);
				break;
			case "priority":
				this.buildPrioritySelector(controlX, y, controlWidth);
				break;
			case "labels":
				this.buildLabelsButton(controlX, y, controlWidth);
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
			inputOnFocus: true,
			mouse: true,
			keys: true,
			style: {
				fg: "white",
				bg: "black",
				focus: { fg: "black", bg: "cyan", bold: true },
			},
		});
		this.elements.push(this.searchInput);

		// Handle search submit
		this.searchInput.on("submit", (value: unknown) => {
			this.state.search = String(value || "");
			this.emitFilterChange();
		});

		// Handle focus
		this.searchInput.on("focus", () => {
			this.currentFocus = "search";
			this.setBorderColor("yellow");
			this.onFocusChange?.("search");
		});

		this.searchInput.on("blur", () => {
			if (this.currentFocus === "search") {
				// Save current value on blur
				const value = this.searchInput?.getValue?.() ?? this.state.search;
				if (value !== this.state.search) {
					this.state.search = String(value);
					this.emitFilterChange();
				}
			}
		});

		// Tab navigation
		this.searchInput.key(["tab"], () => {
			const value = this.searchInput?.getValue?.();
			if (value !== undefined && value !== this.state.search) {
				this.state.search = String(value);
				this.emitFilterChange();
			}
			this.searchInput?.cancel();
			this.cycleNext();
			return false;
		});

		// Down arrow to exit search
		this.searchInput.key(["down"], () => {
			const value = this.searchInput?.getValue?.();
			if (value !== undefined && value !== this.state.search) {
				this.state.search = String(value);
				this.emitFilterChange();
			}
			this.searchInput?.cancel();
			// Signal to parent that user wants to leave filters
			this.onFocusChange?.(null);
			return false;
		});

		// Escape to cancel
		this.searchInput.key(["escape"], () => {
			this.searchInput?.cancel();
			this.onFocusChange?.(null);
			return false;
		});

		// Live search on keypress
		let searchTimeout: Timer | null = null;
		this.searchInput.on("keypress", () => {
			if (searchTimeout) clearTimeout(searchTimeout);
			searchTimeout = setTimeout(() => {
				const value = this.searchInput?.getValue?.();
				if (value !== undefined && value !== this.state.search) {
					this.state.search = String(value);
					this.emitFilterChange();
				}
			}, 150);
		});
	}

	private buildStatusSelector(x: number, y: number, width: number): void {
		const items = ["All", ...this.options.statuses];
		const selectedIndex = this.state.status ? this.options.statuses.indexOf(this.state.status) + 1 : 0;

		this.statusSelector = list({
			parent: this.container,
			items: items.map((s, i) => (i === 0 ? `${s} ▼` : s)),
			selected: Math.max(0, selectedIndex),
			top: y,
			left: x,
			width,
			height: 1,
			mouse: true,
			keys: true,
			interactive: true,
			style: {
				fg: "white",
				bg: "black",
				selected: { bg: "black", fg: "white" },
				item: { hover: { bg: "blue" } },
			},
		});
		this.elements.push(this.statusSelector);

		this.setupSelectorEvents(this.statusSelector, "status", this.options.statuses);
	}

	private buildPrioritySelector(x: number, y: number, width: number): void {
		const priorities = ["high", "medium", "low"];
		const items = ["All", ...priorities];
		const selectedIndex = this.state.priority ? priorities.indexOf(this.state.priority) + 1 : 0;

		this.prioritySelector = list({
			parent: this.container,
			items: items.map((s, i) => (i === 0 ? `${s} ▼` : s)),
			selected: Math.max(0, selectedIndex),
			top: y,
			left: x,
			width,
			height: 1,
			mouse: true,
			keys: true,
			interactive: true,
			style: {
				fg: "white",
				bg: "black",
				selected: { bg: "black", fg: "white" },
				item: { hover: { bg: "blue" } },
			},
		});
		this.elements.push(this.prioritySelector);

		this.setupSelectorEvents(this.prioritySelector, "priority", priorities);
	}

	private setupSelectorEvents(selector: ListInterface, field: "status" | "priority", values: string[]): void {
		// Handle selection
		const handleSelect = (index: number) => {
			const value = index === 0 ? "" : (values[index - 1] ?? "");
			if (field === "status") {
				this.state.status = value;
			} else {
				this.state.priority = value;
			}
			this.emitFilterChange();
		};

		selector.on("select", (...args: unknown[]) => {
			const index = typeof args[1] === "number" ? args[1] : typeof args[0] === "number" ? args[0] : 0;
			handleSelect(index);
		});

		// Live filter on navigation
		selector.on("select item", (...args: unknown[]) => {
			const index = typeof args[1] === "number" ? args[1] : typeof args[0] === "number" ? args[0] : 0;
			handleSelect(index);
		});

		// Focus handling
		selector.on("focus", () => {
			this.currentFocus = field;
			this.setBorderColor("yellow");
			const style = selector.style as { selected?: { bg?: string; fg?: string } };
			if (style.selected) {
				style.selected.bg = "blue";
				style.selected.fg = "white";
			}
			this.onFocusChange?.(field);
		});

		selector.on("blur", () => {
			const style = selector.style as { selected?: { bg?: string; fg?: string } };
			if (style.selected) {
				style.selected.bg = "black";
				style.selected.fg = "white";
			}
		});

		// Tab navigation
		selector.key(["tab"], () => {
			this.cycleNext();
			return false;
		});

		selector.key(["S-tab"], () => {
			this.cyclePrev();
			return false;
		});

		// Escape/down to exit
		selector.key(["escape", "down"], () => {
			this.onFocusChange?.(null);
			return false;
		});
	}

	private buildLabelsButton(x: number, y: number, width: number): void {
		const content = this.getLabelsButtonContent();

		this.labelsButton = box({
			parent: this.container,
			content,
			top: y,
			left: x,
			width,
			height: 1,
			tags: true,
			mouse: true,
			keys: true,
			style: {
				fg: "white",
				bg: "black",
				focus: { fg: "black", bg: "cyan" },
			},
		});
		this.elements.push(this.labelsButton);

		// Click to open picker
		this.labelsButton.on("click", () => {
			this.options.onLabelPickerOpen();
		});

		// Focus handling
		this.labelsButton.on("focus", () => {
			this.currentFocus = "labels";
			this.setBorderColor("yellow");
			const style = this.labelsButton?.style as { bg?: string; fg?: string } | undefined;
			if (style) {
				style.bg = "blue";
				style.fg = "white";
			}
			this.onFocusChange?.("labels");
		});

		this.labelsButton.on("blur", () => {
			const style = this.labelsButton?.style as { bg?: string; fg?: string } | undefined;
			if (style) {
				style.bg = "black";
				style.fg = "white";
			}
		});

		// Enter/Space to open picker
		this.labelsButton.key(["enter", "space"], () => {
			this.options.onLabelPickerOpen();
			return false;
		});

		// Tab navigation
		this.labelsButton.key(["tab"], () => {
			this.cycleNext();
			return false;
		});

		this.labelsButton.key(["S-tab"], () => {
			this.cyclePrev();
			return false;
		});

		// Escape/down to exit
		this.labelsButton.key(["escape", "down"], () => {
			this.onFocusChange?.(null);
			return false;
		});
	}

	private updateStatusSelector(): void {
		if (!this.statusSelector) return;
		const selectedIndex = this.state.status ? this.options.statuses.indexOf(this.state.status) + 1 : 0;
		this.statusSelector.select(Math.max(0, selectedIndex));
	}

	private updatePrioritySelector(): void {
		if (!this.prioritySelector) return;
		const priorities = ["high", "medium", "low"];
		const selectedIndex = this.state.priority ? priorities.indexOf(this.state.priority) + 1 : 0;
		this.prioritySelector.select(Math.max(0, selectedIndex));
	}

	private updateLabelsButton(): void {
		if (!this.labelsButton) return;
		this.labelsButton.setContent(this.getLabelsButtonContent());
	}

	private getLabelsButtonContent(): string {
		const summary = formatLabelSummary(this.state.labels).replace(/^Labels:\s*/, "");
		return `${summary} ▼`;
	}

	private repositionElements(): void {
		// For now, just rebuild - could optimize later
		this.destroyElements();
		this.buildElements();
	}

	private emitFilterChange(): void {
		this.options.onFilterChange({ ...this.state });
	}

	/**
	 * Update labels selection (called after picker closes)
	 */
	setLabels(labels: string[]): void {
		this.state.labels = labels;
		this.updateLabelsButton();
		this.emitFilterChange();
	}
}

/**
 * Factory function for creating FilterHeader
 */
export function createFilterHeader(options: FilterHeaderOptions): FilterHeader {
	return new FilterHeader(options);
}
