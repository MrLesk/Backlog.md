import type { BoxInterface, ScreenInterface } from "neo-neo-bblessed";
import { box, list } from "neo-neo-bblessed";
import { createGenericList } from "./generic-list.ts";

export interface FilterPopupChoice {
	label: string;
	value: string;
}

interface PopupChromeOptions {
	screen: ScreenInterface;
	title: string;
	helpText: string;
	width?: string | number;
	height?: string | number;
}

function resolveDimension(value: string | number, total: number): number {
	if (typeof value === "number") {
		return value;
	}
	if (value.endsWith("%")) {
		const percent = Number.parseFloat(value.slice(0, -1));
		if (!Number.isNaN(percent)) {
			return Math.floor((percent / 100) * total);
		}
	}
	const parsed = Number.parseInt(value, 10);
	return Number.isNaN(parsed) ? total : parsed;
}

function resolvePosition(value: string | number, total: number, size: number): number {
	if (typeof value === "number") {
		return value;
	}
	if (value === "center") {
		return Math.max(0, Math.floor((total - size) / 2));
	}
	if (value.endsWith("%")) {
		const percent = Number.parseFloat(value.slice(0, -1));
		if (!Number.isNaN(percent)) {
			return Math.floor((percent / 100) * total);
		}
	}
	const parsed = Number.parseInt(value, 10);
	return Number.isNaN(parsed) ? 0 : parsed;
}

function createPopupChrome(options: PopupChromeOptions): {
	popup: BoxInterface;
	close: () => void;
} {
	const width = options.width ?? "50%";
	const height = options.height ?? "70%";
	const popup = box({
		parent: options.screen,
		top: "center",
		left: "center",
		width,
		height,
		border: { type: "line" },
		style: {
			border: { fg: "yellow" },
			bg: "default",
		},
		label: ` ${options.title} `,
	});

	const screenWidth = typeof options.screen.width === "number" ? options.screen.width : 120;
	const screenHeight = typeof options.screen.height === "number" ? options.screen.height : 40;
	const popupWidth = resolveDimension(popup.width ?? width, screenWidth);
	const popupHeight = resolveDimension(popup.height ?? height, screenHeight);
	const popupTop = resolvePosition(popup.top ?? "center", screenHeight, popupHeight);
	const popupLeft = resolvePosition(popup.left ?? "center", screenWidth, popupWidth);

	const backdrop = box({
		parent: options.screen,
		top: Math.max(0, popupTop - 1),
		left: Math.max(0, popupLeft - 2),
		width: Math.min(screenWidth, popupWidth + 4),
		height: Math.min(screenHeight, popupHeight + 2),
		style: {
			bg: "gray",
		},
	});
	(popup as BoxInterface & { setFront?: () => void }).setFront?.();

	const escBadge = box({
		parent: popup,
		content: " Esc ",
		top: -1,
		right: 1,
		width: 5,
		height: 1,
		style: { fg: "white", bg: "blue" },
	});

	const helpBox = box({
		parent: popup,
		bottom: 0,
		left: 1,
		right: 1,
		height: 1,
		tags: true,
		style: { fg: "gray", bg: "default" },
		content: options.helpText,
	});

	const close = () => {
		escBadge.destroy();
		helpBox.destroy();
		popup.destroy();
		backdrop.destroy();
	};

	return { popup, close };
}

export async function openSingleSelectFilterPopup(options: {
	screen: ScreenInterface;
	title: string;
	choices: FilterPopupChoice[];
	selectedValue: string;
	helpText?: string;
}): Promise<string | null> {
	if (options.choices.length === 0) {
		return null;
	}

	return new Promise<string | null>((resolve) => {
		let settled = false;
		const { popup, close } = createPopupChrome({
			screen: options.screen,
			title: options.title,
			helpText:
				options.helpText ?? " {cyan-fg}[↑↓]{/} Navigate | {cyan-fg}[Enter]{/} Select | {cyan-fg}[Esc]{/} Cancel",
			width: "48%",
			height: "60%",
		});
		const contentBox = box({
			parent: popup,
			top: 1,
			left: 1,
			width: "100%-4",
			height: "100%-3",
			style: { bg: "default" },
		});

		const selectedIndex = Math.max(
			0,
			options.choices.findIndex((choice) => choice.value === options.selectedValue),
		);

		const picker = list({
			parent: contentBox,
			top: 0,
			left: 0,
			width: "100%",
			height: "100%",
			items: options.choices.map((choice) => choice.label),
			selected: selectedIndex,
			keys: true,
			mouse: true,
			tags: true,
			scrollable: true,
			style: {
				bg: "default",
				selected: { bg: "blue", fg: "white" },
				item: { bg: "default", hover: { bg: "blue" } },
			},
		});

		const finish = (value: string | null) => {
			if (settled) return;
			settled = true;
			picker.destroy();
			contentBox.destroy();
			close();
			options.screen.render();
			resolve(value);
		};

		popup.key(["escape", "q"], () => {
			finish(null);
			return false;
		});

		// Ensure cancel keys work while list widget has focus.
		picker.key(["escape", "q"], () => {
			finish(null);
			return false;
		});

		picker.key(["enter"], () => {
			const index = picker.selected ?? 0;
			const choice = options.choices[index];
			finish(choice?.value ?? null);
			return false;
		});

		picker.on("select", (...args: unknown[]) => {
			const index =
				typeof args[1] === "number" ? args[1] : typeof args[0] === "number" ? args[0] : (picker.selected ?? 0);
			const choice = options.choices[index];
			finish(choice?.value ?? null);
		});

		setImmediate(() => {
			picker.focus();
			options.screen.render();
		});
	});
}

export async function openMultiSelectFilterPopup(options: {
	screen: ScreenInterface;
	title: string;
	items: string[];
	selectedItems: string[];
	helpText?: string;
}): Promise<string[] | null> {
	if (options.items.length === 0) {
		return [];
	}

	return new Promise<string[] | null>((resolve) => {
		let settled = false;
		const { popup, close } = createPopupChrome({
			screen: options.screen,
			title: options.title,
			helpText:
				options.helpText ??
				" {cyan-fg}[↑↓]{/} Navigate | {cyan-fg}[Space]{/} Toggle | {cyan-fg}[Enter]{/} Apply | {cyan-fg}[Esc]{/} Cancel",
			width: "52%",
			height: "72%",
		});
		const contentBox = box({
			parent: popup,
			top: 1,
			left: 1,
			width: "100%-4",
			height: "100%-3",
			style: { bg: "default" },
		});

		const selectedSet = new Set(options.selectedItems.map((item) => item.toLowerCase()));
		const selectableItems = options.items.map((label) => ({ id: label, title: label }));
		const selectedIndices = selectableItems
			.map((item, index) => (selectedSet.has(item.id.toLowerCase()) ? index : -1))
			.filter((index) => index >= 0);

		const picker = createGenericList({
			parent: contentBox,
			title: "",
			items: selectableItems,
			multiSelect: true,
			selectedIndices,
			top: 0,
			left: 0,
			width: "100%",
			height: "100%",
			border: false,
			showHelp: false,
			style: {
				bg: "default",
				item: { fg: "white", bg: "default" },
				selected: { fg: "white", bg: "blue" },
			},
			keys: {
				cancel: ["C-]"],
			},
			onSelect: (selected) => {
				const chosen = Array.isArray(selected) ? selected.map((item) => item.id) : [];
				finish(chosen);
			},
		});

		const finish = (value: string[] | null) => {
			if (settled) return;
			settled = true;
			picker.destroy();
			contentBox.destroy();
			close();
			options.screen.render();
			resolve(value);
		};

		popup.key(["escape", "q"], () => {
			finish(null);
			return false;
		});

		// Ensure cancel keys work while generic-list widget has focus.
		const pickerList = picker.getListBox();
		pickerList.key(["escape", "q"], () => {
			finish(null);
			return false;
		});

		setImmediate(() => {
			picker.focus();
			options.screen.render();
		});
	});
}
