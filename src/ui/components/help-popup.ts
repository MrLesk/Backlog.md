import type { ScreenInterface } from "neo-neo-bblessed";
import { createPopupChrome, createScrollableViewport } from "./filter-popup.ts";

export type HelpPopupContext = "board" | "task-list";

type Shortcut = {
	key: string;
	desc: string;
};

// Letters are uppercase key indicators, matching the footer: `T` means "press the T key",
// not Shift+T. The bound key is the lowercase letter.
const BOARD_SHORTCUTS: Shortcut[] = [
	{ key: "Tab", desc: "Switch View (Kanban/List)" },
	{ key: "N", desc: "Create a task" },
	{ key: "/", desc: "Search tasks" },
	{ key: "T", desc: "Filter by Type" },
	{ key: "P", desc: "Filter by Priority" },
	{ key: "I", desc: "Filter by Milestone" },
	{ key: "F", desc: "Filter by Labels" },
	{ key: "←→", desc: "Navigate columns" },
	{ key: "↑↓", desc: "Navigate tasks" },
	{ key: "Enter", desc: "View task details" },
	{ key: "E", desc: "Edit task" },
	{ key: "M", desc: "Move task (Status/Order)" },
	{ key: "C", desc: "Complete task" },
	{ key: "A", desc: "Archive task" },
	{ key: "Y", desc: "Yank (Copy) task ID" },
	{ key: "H", desc: "Hide/show empty columns" },
	{ key: "?", desc: "Show this help menu" },
	{ key: "q/Esc", desc: "Quit / Close" },
];

const TASK_LIST_SHORTCUTS: Shortcut[] = [
	{ key: "Tab", desc: "Switch View (Kanban/List)" },
	{ key: "/", desc: "Search tasks" },
	{ key: "S", desc: "Filter by Status" },
	{ key: "T", desc: "Filter by Type" },
	{ key: "P", desc: "Filter by Priority" },
	{ key: "I", desc: "Filter by Milestone" },
	{ key: "L", desc: "Filter by Labels" },
	{ key: "↑↓", desc: "Navigate tasks" },
	{ key: "←→", desc: "Switch between list and details" },
	{ key: "Enter", desc: "Focus task details" },
	{ key: "E", desc: "Edit task" },
	{ key: "C", desc: "Complete task" },
	{ key: "A", desc: "Archive task" },
	{ key: "Y", desc: "Yank (Copy) task ID" },
	{ key: "?", desc: "Show this help menu" },
	{ key: "q/Esc", desc: "Quit / Close" },
];

export function getHelpShortcuts(context: HelpPopupContext = "board"): Shortcut[] {
	return context === "task-list" ? TASK_LIST_SHORTCUTS : BOARD_SHORTCUTS;
}

/** Popup rows spent on borders, the top spacer and the help line, leaving one row per shortcut. */
const HELP_POPUP_CHROME_ROWS = 4;
const HELP_POPUP_WIDTH = 60;

function getHelpText(scrolls: boolean): string {
	return scrolls ? " {cyan-fg}[↑↓]{/} Scroll | {cyan-fg}[Esc/q]{/} Close Help" : " {cyan-fg}[Esc/q]{/} Close Help";
}

export function getHelpPopupHeight(shortcutCount: number, screenHeight: number): number {
	const boundedScreenHeight = Math.max(1, screenHeight);
	const preferredHeight = Math.max(5, Math.min(shortcutCount + HELP_POPUP_CHROME_ROWS, boundedScreenHeight - 2));
	return Math.min(boundedScreenHeight, preferredHeight);
}

export async function openHelpPopup(screen: ScreenInterface, context: HelpPopupContext = "board"): Promise<void> {
	return new Promise<void>((resolve) => {
		let settled = false;
		const shortcuts = getHelpShortcuts(context);
		let popupHeight = getHelpPopupHeight(shortcuts.length, screen.height);
		const { popup, close, reflow } = createPopupChrome({
			screen,
			title: "Keyboard Shortcuts",
			helpText: getHelpText(false),
			width: HELP_POPUP_WIDTH,
			height: popupHeight,
		});

		const content = shortcuts.map((s) => `{cyan-fg}[${s.key.padStart(5)}]{/} ${s.desc}`).join("\n");

		// Terminals too short for every shortcut keep the remaining rows reachable by scrolling.
		const contentBox = createScrollableViewport({
			parent: popup,
			top: 1,
			left: 2,
			right: 2,
			bottom: 1,
			content,
			tags: true,
		});
		const getMaxScrollOffset = () => {
			const visibleRows =
				typeof contentBox.height === "number" ? contentBox.height : popupHeight - HELP_POPUP_CHROME_ROWS;
			return Math.max(0, contentBox.getScrollHeight() - Math.max(1, visibleRows));
		};
		const applyLayout = () => {
			popupHeight = getHelpPopupHeight(shortcuts.length, screen.height);
			reflow(HELP_POPUP_WIDTH, popupHeight);
			// Rendering reparses the content at its new width, producing the exact number of
			// visual rows after tag removal and wrapping.
			screen.render();
			const maxOffset = getMaxScrollOffset();
			contentBox.childBase = Math.min(maxOffset, Math.max(0, contentBox.childBase));
			reflow(HELP_POPUP_WIDTH, popupHeight, getHelpText(maxOffset > 0));
			screen.render();
		};
		const onResize = () => {
			if (!settled) applyLayout();
		};

		const finish = () => {
			if (settled) return;
			settled = true;
			(
				screen as ScreenInterface & {
					removeListener(event: string, listener: (...args: unknown[]) => void): void;
				}
			).removeListener("resize", onResize);
			close();
			screen.render();
			resolve();
		};

		popup.key(["escape", "q", "Q", "?"], () => {
			finish();
			return false;
		});

		const scrollBy = (delta: number) => {
			const maxOffset = getMaxScrollOffset();
			contentBox.childBase = Math.min(maxOffset, Math.max(0, contentBox.childBase + delta));
			screen.render();
			return false;
		};
		popup.key(["up"], () => scrollBy(-1));
		popup.key(["down"], () => scrollBy(1));
		screen.on("resize", onResize);

		setImmediate(() => {
			if (settled) return;
			popup.focus();
			applyLayout();
		});
	});
}
