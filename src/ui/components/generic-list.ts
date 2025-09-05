/**
 * Generic list component that consolidates selectList, multiSelect, and TaskList functionality
 * Provides a unified interface for all list selection patterns in the UI
 */

import { stdout as output } from "node:process";
import type { ElementInterface, ListInterface, ScreenInterface } from "neo-neo-bblessed";
import { list } from "neo-neo-bblessed";
import { formatHeading } from "../heading.ts";
import { createScreen } from "../tui.ts";

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
		item?: { fg: string };
		focus?: { border: { fg: string } };
	};
	showHelp?: boolean;
}

export interface GenericListController<T extends GenericListItem> {
	getSelected(): T | T[] | null;
	getSelectedIndex(): number | number[];
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

		this.listBox = list({
			parent,
			label: this.options.title ? `\u00A0${this.options.title}\u00A0` : undefined,
			top: this.options.top || 0,
			left: this.options.left || 0,
			width: this.options.width || (parent === this.screen ? "90%" : "100%"),
			height: this.options.height || (parent === this.screen ? "80%" : "100%"),
			border: this.options.border !== false ? "line" : undefined,
			style,
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
		const itemMap = new Map<number, T | null>();
		let index = 0;

		if (this.groupBy) {
			// Group items
			const groups = new Map<string, T[]>();
			for (const item of this.filteredItems) {
				const group = this.groupBy(item);
				if (!groups.has(group)) {
					groups.set(group, []);
				}
				const groupList = groups.get(group);
				if (groupList) {
					groupList.push(item);
				}
			}

			// Render groups
			for (const [group, groupItems] of groups) {
				displayItems.push(formatHeading(group || "No Group", 2));
				itemMap.set(index++, null); // Group header
				for (const item of groupItems) {
					const isSelected = this.isMultiSelect ? this.selectedIndices.has(index) : false;
					const rendered = this.itemRenderer(item, index, isSelected);
					const prefix = this.isMultiSelect ? (isSelected ? "[✓] " : "[ ] ") : "  ";
					displayItems.push(prefix + rendered);
					itemMap.set(index++, item);
				}
			}
		} else {
			// Render flat list
			for (let i = 0; i < this.filteredItems.length; i++) {
				const item = this.filteredItems[i];
				if (!item) continue;
				const isSelected = this.isMultiSelect ? this.selectedIndices.has(i) : false;
				const rendered = this.itemRenderer(item, i, isSelected);
				const prefix = this.isMultiSelect ? (isSelected ? "[✓] " : "[ ] ") : "";
				displayItems.push(prefix + rendered);
				itemMap.set(index++, item);
			}
		}

		// Add search indicator
		if (this.options.searchable && this.isSearchMode) {
			displayItems.unshift(`{cyan-fg}Search: ${this.searchTerm}_{/}`);
		}

		// Add help text
		if (this.options.showHelp !== false) {
			const helpText = this.buildHelpText();
			displayItems.push("", helpText);
		}

		this.listBox.setItems(displayItems);
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
			const nextIndex = sel > 0 ? sel - 1 : total - 1;
			this.listBox.select(nextIndex);
			this.selectedIndex = nextIndex;
			this.onHighlight?.(this.filteredItems[nextIndex] ?? null, nextIndex);
			this.listBox.screen?.render();
		};

		const moveDown = () => {
			const total = this.filteredItems.length;
			if (total === 0) return;
			const sel = typeof this.selectedIndex === "number" ? this.selectedIndex : 0;
			const nextIndex = sel < total - 1 ? sel + 1 : 0;
			this.listBox.select(nextIndex);
			this.selectedIndex = nextIndex;
			this.onHighlight?.(this.filteredItems[nextIndex] ?? null, nextIndex);
			this.listBox.screen?.render();
		};

		this.listBox.key(["up", "k"], moveUp);
		this.listBox.key(["down", "j"], moveDown);

		// Selection/Toggle
		if (this.isMultiSelect) {
			this.listBox.key(keys.toggle || ["space"], () => {
				this.toggleSelection(this.listBox.selected ?? 0);
			});

			this.listBox.key(keys.select || ["enter"], () => {
				this.confirmSelection();
			});
		} else {
			this.listBox.key(keys.select || ["enter"], () => {
				this.selectedIndex = this.listBox.selected ?? 0;
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
			this.listBox.select(validIndex);
			this.selectedIndex = validIndex;
			// Emit initial highlight so hosts can synchronize detail panes
			this.onHighlight?.(this.filteredItems[validIndex] ?? null, validIndex);
			// For multi-select, keep internal selectedIndex aligned with highlight
		}
	}

	private toggleSelection(index: number): void {
		if (this.selectedIndices.has(index)) {
			this.selectedIndices.delete(index);
		} else {
			this.selectedIndices.add(index);
		}
		this.refreshList();
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
		if (this.screen) {
			this.screen.destroy();
		}
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
