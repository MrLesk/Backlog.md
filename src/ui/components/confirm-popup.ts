import type { ScreenInterface } from "neo-neo-bblessed";
import { box } from "neo-neo-bblessed";
import { createPopupChrome } from "./filter-popup.ts";

export function openQuitConfirmPopup(screen: ScreenInterface): Promise<boolean> {
	return openConfirmPopup({
		screen,
		title: "Quit Backlog.md?",
		message: "",
		confirmLabel: "Quit",
		cancelLabel: "Cancel",
		selectableActions: true,
	});
}

export async function openConfirmPopup(options: {
	screen: ScreenInterface;
	title: string;
	message: string;
	confirmLabel?: string;
	cancelLabel?: string;
	/** Show Cancel on the left and confirmation on the right, initially selected. */
	selectableActions?: boolean;
}): Promise<boolean> {
	return new Promise<boolean>((resolve) => {
		let settled = false;
		const { popup, close } = createPopupChrome({
			screen: options.screen,
			title: options.title,
			helpText: options.selectableActions ? "" : " {cyan-fg}[Enter/y]{/} Yes | {cyan-fg}[Esc/n]{/} No",
			width: options.selectableActions ? 34 : 40,
			height: options.selectableActions ? 6 : 10,
		});

		const content = box({
			parent: popup,
			top: "center",
			left: 1,
			right: 1,
			height: 3,
			align: "center",
			content: options.message,
			tags: true,
		});

		const finish = (value: boolean) => {
			if (settled) return;
			settled = true;
			content.destroy();
			close();
			options.screen.render();
			resolve(value);
		};

		popup.key(["escape", "n", "N"], () => {
			finish(false);
			return false;
		});

		if (options.selectableActions) {
			popup.key(["q", "C-c"], () => {
				finish(true);
				return false;
			});
			let confirmSelected = true;
			const cancelAction = box({
				parent: popup,
				top: 2,
				left: 5,
				width: 8,
				height: 1,
				align: "center",
				content: `[${options.cancelLabel ?? "No"}]`,
				mouse: true,
			});
			const confirmAction = box({
				parent: popup,
				top: 2,
				right: 5,
				width: 7,
				height: 1,
				align: "center",
				content: `[${options.confirmLabel ?? "Yes"}]`,
				mouse: true,
			});
			const renderSelection = () => {
				confirmAction.style = { inverse: confirmSelected, bold: confirmSelected };
				cancelAction.style = { inverse: !confirmSelected, bold: !confirmSelected };
				options.screen.render();
			};
			popup.key(["left", "right", "up", "down", "tab", "S-tab"], () => {
				confirmSelected = !confirmSelected;
				renderSelection();
				return false;
			});
			popup.key(["enter", "linefeed"], () => {
				finish(confirmSelected);
				return false;
			});
			confirmAction.on("click", () => finish(true));
			cancelAction.on("click", () => finish(false));
			renderSelection();
		} else {
			popup.key(["enter", "y", "Y"], () => {
				finish(true);
				return false;
			});
		}

		setImmediate(() => {
			popup.focus();
			options.screen.render();
		});
	});
}
