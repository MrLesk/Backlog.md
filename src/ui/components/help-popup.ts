import type { ScreenInterface } from "neo-neo-bblessed";
import { box } from "neo-neo-bblessed";
import { createPopupChrome } from "./filter-popup.ts";

export async function openHelpPopup(screen: ScreenInterface): Promise<void> {
	return new Promise<void>((resolve) => {
		let settled = false;
		const { popup, close } = createPopupChrome({
			screen,
			title: "Keyboard Shortcuts",
			helpText: " {cyan-fg}[Esc/q]{/} Close Help",
			width: 60,
			height: 20,
		});

		const shortcuts = [
			{ key: "Tab", desc: "Switch View (Kanban/List)" },
			{ key: "/", desc: "Search tasks" },
			{ key: "P", desc: "Filter by Priority" },
			{ key: "F", desc: "Filter by Labels" },
			{ key: "I", desc: "Filter by Milestone" },
			{ key: "←→", desc: "Navigate columns" },
			{ key: "↑↓", desc: "Navigate tasks" },
			{ key: "Enter", desc: "View task details" },
			{ key: "E", desc: "Edit task" },
			{ key: "M", desc: "Move task (Status/Order)" },
			{ key: "C", desc: "Complete task" },
			{ key: "A", desc: "Archive task" },
			{ key: "Y", desc: "Yank (Copy) task ID" },
			{ key: "?", desc: "Show this help menu" },
			{ key: "q/Esc", desc: "Quit / Close" },
		];

		const content = shortcuts.map((s) => `{cyan-fg}[${s.key.padStart(5)}]{/} ${s.desc}`).join("\n");

		box({
			parent: popup,
			top: 1,
			left: 2,
			right: 2,
			bottom: 1,
			content,
			tags: true,
		});

		const finish = () => {
			if (settled) return;
			settled = true;
			close();
			screen.render();
			resolve();
		};

		popup.key(["escape", "q", "Q", "?"], () => {
			finish();
			return false;
		});

		setImmediate(() => {
			popup.focus();
			screen.render();
		});
	});
}
