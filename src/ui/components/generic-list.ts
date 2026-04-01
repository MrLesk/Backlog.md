/**
 * Generic list component that consolidates selectList, multiSelect, and TaskList functionality
 * Provides a unified interface for all list selection patterns in the UI
 */

import { stdout as output } from "node:process";
import type { ElementInterface, ListInterface, ScreenInterface } from "neo-neo-bblessed";
import { list } from "neo-neo-bblessed";
import { formatHeading } from "../heading.ts";
import { createScreen } from "../tui.ts";
import { stripBlessedFgTags } from "../utils/strip-tags.ts";

export interface GenericListItem {
	id: string;
}

export interface GenericListOptions<T extends GenericListItem> {
	parent?: ElementInterface | ScreenInterface;
	title?: string;
	items: T[];
	multiSelect?: boolean;
	searchable?: boolean;
	itemRenderer?: (item: T, index: number, selected: boolean) => string;
	groupBy?: (item: T) => string;
	selectedIndex?: number;
	selectedIndices?: number[];
	onSelect?: (selected: T | T[], index?: number | number[]) => void;
	// Called whenever the highlighted item changes (live navigation)
	onHighlight?: (selected: T | null, index: number) => void;
	// Called before wrapping at list boundaries. Return true to consume navigation.
	onBoundaryNavigation?: (direction: "up" | "down", selectedIndex: number, total: number) => boolean;
	width?: string | number;
	height?: string | number;
	top?: string | number;
	left?: string | number;
	border?: boolean;
	keys?: {
		up?: string[];
		down?: string[];
		select?: string[];
		toggle?: string[];
		cancel?: string[];
		search?: string[];
	};
	style?: {
		border?: { fg: string };
		selected?: { fg: string; bg: string };
		item?: { fg: string; bg?: string };
		focus?: { border: { fg: string } };
		bg?: string;
	};
	showHelp?: boolean;
}

export interface GenericListController<T extends GenericListItem> {
	getSelected(): T | T[] | null;
	getSelectedIndex(): number | number[];
	setSelectedIndex(index: number): void;
	updateItems(items: T[]): void;
	focus(): void;
	getListBox(): ListInterface;
	destroy(): void;
}

export class GenericList<T extends GenericListItem> implements GenericListController<T> {
	private listBox!: ListInterface;
	private screen?: ScreenInterface;
	private items: T[];
	private filteredItems: T[];
	private selectedIndex: number;
	private selectedIndices: Set<number>;
	private isMultiSelect: boolean;
	private onSelect?: (selected: T | T[], index?: number | number[]) => void;
	private onHighlight?: (selected: T | null, index: number) => void;
	private itemRenderer: (item: T, index: number, selected: boolean) => string;
	private groupBy?: (item: T) => string;
	private searchTerm = "";
	private isSearchMode = false;
	private options: GenericListOptions<T>;
	private displayIndexByFilteredIndex = new Map<number, number>();
	private filteredIndexByDisplayIndex = new Map<number, number>();
	private normalDisplayByFilteredIndex = new Map<number, string>();
	private highlightedDisplayByFilteredIndex = new Map<number, string>();
	private highlightedIndex: number | null = null;
	private updatingListSelection = false;

	constructor(options: GenericListOptions<T>) {
		this.options = options;
		this.items = options.items || [];
		this.filteredItems = [...this.items];
		this.isMultiSelect = options.multiSelect || false;
		this.selectedIndex = options.selectedIndex || 0;
		this.selectedIndices = new Set(options.selectedIndices || []);
		this.onSelect = options.onSelect;
		this.onHighlight = options.onHighlight;
		this.groupBy = options.groupBy;

		// Default item renderer
		this.itemRenderer =
			options.itemRenderer ||
			((item: T) => {
				if ("title" in item && (item as Record<string, unknown>).title) {
					return `${item.id} - ${String((item as Record<string, unknown>).title)}`;
				}
				return item.id;
			});

		if (output.isTTY === false) {
			this.handleNonTTY();
			return;
		}

		this.createListComponent();
	}

	private buildDisplayContent(item: T, index: number, grouped: boolean): { normal: string; highlighted: string } {
		const isSelected = this.isMultiSelect ? this.selectedIndices.has(index) : false;
		const rendered = this.itemRenderer(item, index, isSelected);
		const prefix = this.isMultiSelect ? (isSelected ? "[✓] " : "[ ] ") : grouped ? "  " : "";
		const normal = prefix + rendered;
		return {
			normal,
			highlighted: stripBlessedFgTags(normal),
		};
	}

	private handleNonTTY(): void {
		// For non-TTY environments, return first item for single select or empty for multi
		if (!this.isMultiSelect && this.items.length > 0) {
			const firstItem = this.items[0];
			if (firstItem) {
				setTimeout(() => this.onSelect?.(firstItem, 0), 0);
			}
		} else {
			setTimeout(() => this.onSelect?.([], []), 0);
		}
	}

	private createListComponent(): void {
		// Create screen if not provided
		if (!this.options.parent) {
			this.screen = createScreen({
				style: { fg: "white", bg: "black" },
			});
		}

		const parent = this.options.parent || this.screen;

		// Default styling
		const defaultStyle = {
			border: { fg: "blue" },
			selected: { fg: "white", bg: "blue" },
			item: { fg: "white" },
			focus: { border: { fg: "yellow" } },
		};

		const style = { ...defaultStyle, ...this.options.style };

		// Extract bg for direct application to list widget
		const listBg = this.options.style?.bg;

		this.listBox = list({
			parent,
			label: this.options.title ? `\u00A0${this.options.title}\u00A0` : undefined,
			top: this.options.top || 0,
			left: this.options.left || 0,
			width: this.options.width || (parent === this.screen ? "90%" : "100%"),
			height: this.options.height || (parent === this.screen ? "80%" : "100%"),
			border: this.options.border !== false ? "line" : undefined,
			style: {
				...style,
				bg: listBg,
			},
			tags: true,
			// Disable built-in key handling to avoid double-processing with our custom handlers
			keys: false,
			mouse: true,
			scrollable: true,
			alwaysScroll: false,
		});

		this.refreshList();
		this.setupEventHandlers();
		this.selectInitialItem();
	}

	private refreshList(): void {
		if (!this.listBox) return;

		// Apply search filter
		this.filteredItems = this.searchTerm
			? this.items.filter((item) => JSON.stringify(item).toLowerCase().includes(this.searchTerm.toLowerCase()))
			: [...this.items];

		// Build display items
		const displayItems: string[] = [];
		this.displayIndexByFilteredIndex.clear();
		this.filteredIndexByDisplayIndex.clear();
		this.normalDisplayByFilteredIndex.clear();
		this.highlightedDisplayByFilteredIndex.clear();
		let displayIndex = 0;

		if (this.options.searchable && this.isSearchMode) {
			displayItems.push(`{cyan-fg}Search: ${this.searchTerm}_{/}`);
			displayIndex += 1;
		}

		if (this.groupBy) {
			// Group items
			const groups = new Map<string, Array<{ item: T; filteredIndex: number }>>();
			for (const [filteredIndex, item] of this.filteredItems.entries()) {
				const group = this.groupBy(item);
				if (!groups.has(group)) {
					groups.set(group, []);
				}
				const groupList = groups.get(group);
				if (groupList) {
					groupList.push({ item, filteredIndex });
				}
			}

			// Render groups
			for (const [group, groupItems] of groups) {
				displayItems.push(formatHeading(group || "No Group", 2));
				displayIndex += 1;
				for (const { item, filteredIndex } of groupItems) {
					const content = this.buildDisplayContent(item, filteredIndex, true);
					displayItems.push(content.normal);
					this.displayIndexByFilteredIndex.set(filteredIndex, displayIndex);
					this.filteredIndexByDisplayIndex.set(displayIndex, filteredIndex);
					this.normalDisplayByFilteredIndex.set(filteredIndex, content.normal);
					this.highlightedDisplayByFilteredIndex.set(filteredIndex, content.highlighted);
					displayIndex += 1;
				}
			}
		} else {
			// Render flat list
			for (const [filteredIndex, item] of this.filteredItems.entries()) {
				if (!item) continue;
				const content = this.buildDisplayContent(item, filteredIndex, false);
				displayItems.push(content.normal);
				this.displayIndexByFilteredIndex.set(filteredIndex, displayIndex);
				this.filteredIndexByDisplayIndex.set(displayIndex, filteredIndex);
				this.normalDisplayByFilteredIndex.set(filteredIndex, content.normal);
				this.highlightedDisplayByFilteredIndex.set(filteredIndex, content.highlighted);
				displayIndex += 1;
			}
		}

		// Add help text
		if (this.options.showHelp !== false) {
			const helpText = this.buildHelpText();
			displayItems.push("", helpText);
		}

		this.listBox.setItems(displayItems);
		this.highlightedIndex = null;
		if (this.filteredItems.length === 0) {
			return;
		}
		const clampedIndex = Math.max(0, Math.min(this.selectedIndex, this.filteredItems.length - 1));
		this.setHighlightedIndex(clampedIndex, { emitHighlight: false });
	}

	private buildHelpText(): string {
		const parts = ["↑/↓ navigate"];

		if (this.isMultiSelect) {
			parts.push("Space toggle");
			parts.push("Enter confirm");
		} else {
			parts.push("Enter select");
		}

		if (this.options.searchable) {
			parts.push("/ search");
		}

		parts.push("Esc/q quit");
		return `{gray-fg}${parts.join(" · ")}{/gray-fg}`;
	}

	private setupEventHandlers(): void {
		if (!this.listBox) return;

		// Don't use the select event for navigation - only for explicit selection
		// This prevents conflicts between navigation and selection

		// Custom key bindings
		const keys = this.options.keys || {};

		// Circular navigation for up/down (including vim-style keys)
		const moveUp = () => {
			const total = this.filteredItems.length;
			if (total === 0) return;
			const sel = typeof this.selectedIndex === "number" ? this.selectedIndex : 0;
			if (sel <= 0 && this.options.onBoundaryNavigation?.("up", sel, total)) {
				return;
			}
			this.setHighlightedIndex(sel > 0 ? sel - 1 : total - 1, { render: true });
		};

		const moveDown = () => {
			const total = this.filteredItems.length;
			if (total === 0) return;
			const sel = typeof this.selectedIndex === "number" ? this.selectedIndex : 0;
			if (sel >= total - 1 && this.options.onBoundaryNavigation?.("down", sel, total)) {
				return;
			}
			this.setHighlightedIndex(sel < total - 1 ? sel + 1 : 0, { render: true });
		};

		this.listBox.key(["up", "k"], moveUp);
		this.listBox.key(["down", "j"], moveDown);

		this.listBox.on("select item", (_item: unknown, displayIndex: unknown) => {
			if (this.updatingListSelection) return;
			if (typeof displayIndex !== "number") return;
			const filteredIndex = this.filteredIndexByDisplayIndex.get(displayIndex);
			if (filteredIndex === undefined) return;
			this.setHighlightedIndex(filteredIndex, { selectList: false, render: true });
		});

		// Selection/Toggle
		if (this.isMultiSelect) {
			this.listBox.key(keys.toggle || ["space"], () => {
				const filteredIndex = this.getFilteredIndexFromSelection();
				if (filteredIndex === null) return;
				this.toggleSelection(filteredIndex);
			});

			this.listBox.key(keys.select || ["enter"], () => {
				this.confirmSelection();
			});
		} else {
			this.listBox.key(keys.select || ["enter"], () => {
				const filteredIndex = this.getFilteredIndexFromSelection();
				if (filteredIndex === null) return;
				this.selectedIndex = filteredIndex;
				this.triggerSelection();
			});
		}

		// Search
		if (this.options.searchable) {
			this.listBox.key(keys.search || ["/"], () => {
				this.enterSearchMode();
			});

			this.listBox.key(["escape"], () => {
				if (this.isSearchMode) {
					this.exitSearchMode();
				} else {
					this.cancel();
				}
			});
		}

		// Cancel
		this.listBox.key(keys.cancel || ["escape", "q", "C-c"], () => {
			this.cancel();
		});

		// Handle search input
		if (this.options.searchable) {
			this.listBox.on("keypress", (ch: string, key: { name: string; ctrl?: boolean; meta?: boolean }) => {
				if (this.isSearchMode && key.name !== "escape" && key.name !== "enter") {
					if (key.name === "backspace") {
						this.searchTerm = this.searchTerm.slice(0, -1);
					} else if (ch && ch.length === 1 && !key.ctrl && !key.meta) {
						this.searchTerm += ch;
					}
					this.refreshList();
				}
			});
		}
	}

	private selectInitialItem(): void {
		if (this.filteredItems.length > 0) {
			const validIndex = Math.min(this.selectedIndex, this.filteredItems.length - 1);
			this.setHighlightedIndex(validIndex);
		}
	}

	private toggleSelection(index: number): void {
		if (this.selectedIndices.has(index)) {
			this.selectedIndices.delete(index);
		} else {
			this.selectedIndices.add(index);
		}
		// Update just the current item's display without full refresh
		const item = this.filteredItems[index];
		if (item) {
			const content = this.buildDisplayContent(item, index, Boolean(this.groupBy));
			this.normalDisplayByFilteredIndex.set(index, content.normal);
			this.highlightedDisplayByFilteredIndex.set(index, content.highlighted);
			this.setDisplayContent(index, index === this.selectedIndex);
			this.getScreen()?.render?.();
		}
	}

	private confirmSelection(): void {
		const selected = Array.from(this.selectedIndices)
			.map((i) => this.filteredItems[i])
			.filter((item): item is T => Boolean(item));

		const indices = Array.from(this.selectedIndices);
		this.onSelect?.(selected, indices);
	}

	private triggerSelection(): void {
		if (this.selectedIndex >= 0 && this.selectedIndex < this.filteredItems.length) {
			const selected = this.filteredItems[this.selectedIndex];
			if (selected) {
				this.onSelect?.(selected, this.selectedIndex);
			}
		}
	}

	private enterSearchMode(): void {
		this.isSearchMode = true;
		this.searchTerm = "";
		this.refreshList();
	}

	private exitSearchMode(): void {
		this.isSearchMode = false;
		this.searchTerm = "";
		this.refreshList();
	}

	private cancel(): void {
		if (this.isMultiSelect) {
			this.onSelect?.([], []);
		} else {
			this.onSelect?.(null as unknown as T, -1);
		}
	}

	// Public interface methods
	public getSelected(): T | T[] | null {
		if (this.isMultiSelect) {
			return Array.from(this.selectedIndices)
				.map((i) => this.filteredItems[i])
				.filter((item): item is T => Boolean(item));
		}
		return this.selectedIndex >= 0 && this.selectedIndex < this.filteredItems.length
			? (this.filteredItems[this.selectedIndex] ?? null)
			: null;
	}

	public getSelectedIndex(): number | number[] {
		return this.isMultiSelect ? Array.from(this.selectedIndices) : this.selectedIndex;
	}

	public setSelectedIndex(index: number): void {
		if (!this.listBox || this.filteredItems.length === 0) {
			return;
		}
		const clamped = Math.max(0, Math.min(index, this.filteredItems.length - 1));
		this.setHighlightedIndex(clamped, { render: true });
	}

	public updateItems(items: T[]): void {
		this.items = items;
		this.refreshList();
		this.selectInitialItem();
	}

	public focus(): void {
		if (this.listBox) {
			this.listBox.focus();
		}
	}

	public getListBox(): ListInterface {
		return this.listBox;
	}

	public destroy(): void {
		if (this.listBox) {
			this.listBox.destroy();
		}
		if (this.screen) {
			this.screen.destroy();
		}
	}

	private getScreen(): ScreenInterface | undefined {
		if (this.screen) return this.screen;
		const maybeHasScreen = this.listBox as unknown as { screen?: ScreenInterface };
		return maybeHasScreen?.screen;
	}

	private getFilteredIndexFromSelection(): number | null {
		const displayIndex = (this.listBox as ListInterface & { selected?: number }).selected ?? 0;
		return this.filteredIndexByDisplayIndex.get(displayIndex) ?? null;
	}

	private selectFilteredIndex(index: number): void {
		const displayIndex = this.displayIndexByFilteredIndex.get(index);
		if (displayIndex === undefined) {
			return;
		}
		this.listBox.select(displayIndex);
		(this.listBox as ListInterface & { selected?: number }).selected = displayIndex;
	}

	private setHighlightedIndex(
		index: number,
		options: { selectList?: boolean; emitHighlight?: boolean; render?: boolean } = {},
	): void {
		if (!this.listBox || index < 0 || index >= this.filteredItems.length) {
			return;
		}
		const { selectList = true, emitHighlight = true, render = false } = options;
		if (this.highlightedIndex !== null && this.highlightedIndex !== index) {
			this.setDisplayContent(this.highlightedIndex, false);
		}
		this.selectedIndex = index;
		if (selectList) {
			this.updatingListSelection = true;
			try {
				this.selectFilteredIndex(index);
			} finally {
				this.updatingListSelection = false;
			}
		}
		this.setDisplayContent(index, true);
		this.highlightedIndex = index;
		if (emitHighlight) {
			this.onHighlight?.(this.filteredItems[index] ?? null, index);
		}
		if (render) {
			this.getScreen()?.render?.();
		}
	}

	private setDisplayContent(index: number, highlighted: boolean): void {
		const displayIndex = this.displayIndexByFilteredIndex.get(index);
		if (displayIndex === undefined) {
			return;
		}
		const content = highlighted
			? this.highlightedDisplayByFilteredIndex.get(index)
			: this.normalDisplayByFilteredIndex.get(index);
		if (!content) {
			return;
		}
		(this.listBox as { setItem?: (itemIndex: number, content: string) => void }).setItem?.(displayIndex, content);
	}
}

// Factory function for easier usage
export function createGenericList<T extends GenericListItem>(options: GenericListOptions<T>): GenericList<T> {
	return new GenericList<T>(options);
}

// Promise-based convenience functions for backward compatibility
export async function genericSelectList<T extends GenericListItem>(
	title: string,
	items: T[],
	options?: Partial<GenericListOptions<T>>,
): Promise<T | null> {
	if (output.isTTY === false || items.length === 0) {
		return null;
	}

	return new Promise<T | null>((resolve) => {
		const list = new GenericList<T>({
			title,
			items,
			multiSelect: false,
			showHelp: true,
			onSelect: (selected) => {
				list.destroy();
				resolve(selected as T | null);
			},
			...options,
		});
	});
}

export async function genericMultiSelect<T extends GenericListItem>(
	title: string,
	items: T[],
	options?: Partial<GenericListOptions<T>>,
): Promise<T[]> {
	if (output.isTTY === false) {
		return [];
	}

	return new Promise<T[]>((resolve) => {
		const list = new GenericList<T>({
			title,
			items,
			multiSelect: true,
			showHelp: true,
			onSelect: (selected) => {
				list.destroy();
				resolve(selected as T[]);
			},
			...options,
		});
	});
}
