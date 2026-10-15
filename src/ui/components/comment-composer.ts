import type { BoxInterface, ScreenInterface, TextboxInterface } from "neo-neo-bblessed";
import { box, textarea, textbox } from "neo-neo-bblessed";
import type { Task, TaskCommentInput } from "../../types/index.ts";
import { createPopupChrome } from "./filter-popup.ts";
import { ownComposerTextEditing } from "./task-composer.ts";

type CommentComposerField = "author" | "body" | "add" | "cancel";

/** Tab order, matching the top-to-bottom reading order of the composer. */
const FIELD_ORDER: readonly CommentComposerField[] = ["author", "body", "add", "cancel"];

const PREFERRED_POPUP_WIDTH = 72;
const PREFERRED_POPUP_HEIGHT = 16;
// Two popup borders, the form's top offset, the author input, the actions row and the
// two reserved footer rows (error + help).
const POPUP_VERTICAL_CHROME = 2 + 1 + 3 + 1 + 2;
const MIN_BODY_HEIGHT = 3;

export type CommentComposerLayout = { popupWidth: number; popupHeight: number; bodyHeight: number };

export function getCommentComposerLayout(screenWidth: number, screenHeight: number): CommentComposerLayout {
	// createPopupChrome's backdrop extends two columns beyond each side of the popup.
	const popupWidth = Math.max(1, Math.min(PREFERRED_POPUP_WIDTH, screenWidth - 4));
	const popupHeight = Math.max(1, Math.min(PREFERRED_POPUP_HEIGHT, screenHeight - 2));
	return { popupWidth, popupHeight, bodyHeight: Math.max(MIN_BODY_HEIGHT, popupHeight - POPUP_VERTICAL_CHROME) };
}

function getCommentComposerHelpText(screenWidth: number): string {
	if (screenWidth < 60) return " {cyan-fg}[Tab]{/} Next | {cyan-fg}[C-s]{/} Add";
	return " {cyan-fg}[Tab]{/} Next | {cyan-fg}[C-s]{/} Add comment | {cyan-fg}[Esc]{/} Cancel";
}

export type CommentComposerOptions = {
	screen: ScreenInterface;
	task: Task;
	/** Prefills the author field. */
	author?: string;
	persist: (comment: TaskCommentInput) => Promise<Task>;
};

/**
 * A modal for adding a comment to a task, like the task composer for creating one. Resolves
 * with the updated task, or null when cancelled.
 */
export async function openCommentComposer(options: CommentComposerOptions): Promise<Task | null> {
	return new Promise<Task | null>((resolve) => {
		const { screen } = options;
		let layout = getCommentComposerLayout(screen.width, screen.height);
		let settled = false;
		let submitting = false;
		let activeField: CommentComposerField = "body";
		const { popup, close, reflow } = createPopupChrome({
			screen,
			title: `Comment on ${options.task.id}`,
			helpText: getCommentComposerHelpText(screen.width),
			width: layout.popupWidth,
			height: layout.popupHeight,
		});

		const authorInput = textbox({
			parent: popup,
			top: 1,
			left: 1,
			right: 1,
			height: 3,
			border: { type: "line" },
			label: " Author ",
			keys: true,
			mouse: true,
			inputOnFocus: false,
			// Suppresses the scroll key bindings this widget inherits from its scrollable base.
			ignoreKeys: true,
			style: { border: { fg: "gray" } },
		});
		authorInput.setValue(options.author ?? "");

		const bodyInput = textarea({
			parent: popup,
			top: 4,
			left: 1,
			right: 1,
			height: layout.bodyHeight,
			border: { type: "line" },
			label: " Comment ",
			keys: true,
			mouse: true,
			inputOnFocus: false,
			scrollable: true,
			style: { border: { fg: "gray" } },
		});

		const actionsTop = () => 4 + layout.bodyHeight;
		const addAction = box({
			parent: popup,
			top: actionsTop(),
			left: 2,
			width: 18,
			height: 1,
			align: "center",
			content: "Add comment",
			keys: true,
			mouse: true,
			style: { fg: "green" },
		});
		const cancelAction = box({
			parent: popup,
			top: actionsTop(),
			left: 22,
			width: 14,
			height: 1,
			align: "center",
			content: "Cancel",
			keys: true,
			mouse: true,
			style: { fg: "gray" },
		});

		const errorBox = box({
			parent: popup,
			bottom: 1,
			left: 2,
			right: 2,
			height: 1,
			content: "",
			style: { fg: "red" },
		});

		const widgets: Record<CommentComposerField, BoxInterface | TextboxInterface> = {
			author: authorInput,
			body: bodyInput,
			add: addAction,
			cancel: cancelAction,
		};
		const textInputs = new Set<BoxInterface | TextboxInterface>([authorInput, bodyInput]);

		const cancelInputIfReading = (input: TextboxInterface) => {
			if ((input as TextboxInterface & { _reading?: boolean })._reading) input.cancel();
		};

		const focusField = (field: CommentComposerField) => {
			const previous = widgets[activeField];
			if (textInputs.has(previous)) cancelInputIfReading(previous as TextboxInterface);
			activeField = field;
			for (const [name, widget] of Object.entries(widgets) as Array<
				[CommentComposerField, BoxInterface | TextboxInterface]
			>) {
				const style = (widget.style ?? {}) as { border?: { fg?: string }; inverse?: boolean; bold?: boolean };
				const active = name === field;
				if (textInputs.has(widget)) {
					style.border ??= {};
					style.border.fg = active ? "yellow" : "gray";
				} else {
					style.inverse = active;
					style.bold = active;
				}
				widget.style = style;
			}
			const widget = widgets[field];
			widget.focus();
			if (textInputs.has(widget)) (widget as TextboxInterface).readInput();
			screen.render();
		};

		const moveFocus = (step: number) => {
			const index = FIELD_ORDER.indexOf(activeField);
			const next = FIELD_ORDER[(index + step + FIELD_ORDER.length) % FIELD_ORDER.length];
			if (next) focusField(next);
		};

		const onResize = () => {
			layout = getCommentComposerLayout(screen.width, screen.height);
			reflow(layout.popupWidth, layout.popupHeight, getCommentComposerHelpText(screen.width));
			bodyInput.height = layout.bodyHeight;
			addAction.top = actionsTop();
			cancelAction.top = actionsTop();
			screen.render();
		};

		let escapeHandler: () => false;
		let submitHandler: () => false;
		const finish = (task: Task | null) => {
			if (settled) return;
			settled = true;
			(
				screen as ScreenInterface & { removeListener(event: string, listener: (...args: unknown[]) => void): void }
			).removeListener("resize", onResize);
			for (const widget of [popup, ...Object.values(widgets)]) {
				widget.unkey(["escape"], escapeHandler);
				widget.unkey(["C-s"], submitHandler);
			}
			cancelInputIfReading(authorInput);
			cancelInputIfReading(bodyInput);
			close();
			resolve(task);
		};

		const showError = (message: string) => {
			errorBox.setContent(message ? ` ${message}` : "");
			screen.render();
		};

		const submit = async () => {
			if (submitting) return;
			const body = bodyInput.getValue().trim();
			const author = authorInput.getValue().trim();
			if (!body) {
				showError("Write a comment first.");
				focusField("body");
				return;
			}
			submitting = true;
			showError("");
			try {
				finish(await options.persist({ body, ...(author && { author }) }));
			} catch (error) {
				showError(error instanceof Error ? error.message : "Adding the comment failed.");
				focusField("body");
			} finally {
				submitting = false;
			}
		};

		const cancel = () => {
			if (!submitting) finish(null);
		};

		escapeHandler = () => {
			cancel();
			return false;
		};
		submitHandler = () => {
			void submit();
			return false;
		};
		for (const widget of [popup, ...Object.values(widgets)]) {
			widget.key(["escape"], escapeHandler);
			widget.key(["C-s"], submitHandler);
		}
		for (const widget of Object.values(widgets)) {
			widget.key(["tab"], () => {
				moveFocus(1);
				return false;
			});
			widget.key(["S-tab"], () => {
				moveFocus(-1);
				return false;
			});
		}

		const textEditing = { screen, onChange: () => {}, onKeypress: () => showError("") };
		ownComposerTextEditing(authorInput, textEditing);
		const bodyEditing = ownComposerTextEditing(bodyInput, textEditing);

		authorInput.key(["down"], () => {
			focusField("body");
			return false;
		});
		authorInput.on("submit", () => focusField("body"));
		bodyInput.key(["up"], () => {
			if (bodyEditing.isOnFirstLine()) focusField("author");
			return false;
		});
		bodyInput.key(["down"], () => {
			if (bodyEditing.isOnLastLine()) focusField("add");
			return false;
		});
		for (const action of ["add", "cancel"] as const) {
			widgets[action].key(["up"], () => {
				focusField("body");
				return false;
			});
		}
		addAction.key(["right"], () => {
			focusField("cancel");
			return false;
		});
		cancelAction.key(["left"], () => {
			focusField("add");
			return false;
		});

		for (const field of ["author", "body"] as const) {
			widgets[field].on("click", () => {
				focusField(field);
				// The screen otherwise auto-focuses clickable widgets after this event bubbles,
				// which blurs a text field immediately after readInput starts.
				return false;
			});
		}
		addAction.key(["enter", "space"], submitHandler);
		addAction.on("click", () => void submit());
		cancelAction.key(["enter", "space"], () => {
			cancel();
			return false;
		});
		cancelAction.on("click", cancel);

		screen.on("resize", onResize);
		setImmediate(() => focusField("body"));
	});
}
