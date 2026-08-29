import type { BoxInterface, ScreenInterface, TextboxInterface } from "neo-neo-bblessed";
import { box, textarea, textbox } from "neo-neo-bblessed";
import { DEFAULT_STATUSES } from "../../constants/index.ts";
import type { Task, TaskCreateInput } from "../../types/index.ts";
import { getPriorityOptions } from "../../utils/priority-config.ts";
import { getTaskTypeValues } from "../../utils/task-type-config.ts";
import { normalizeUtcDateTime } from "../../utils/utc-datetime.ts";
import {
	createPopupChrome,
	createScrollableViewport,
	type FilterPopupChoice,
	openSingleSelectFilterPopup,
} from "./filter-popup.ts";

const DRAFT_STATUS = "Draft";

/** Tab order, matching the top-to-bottom reading order of the composer. */
const FIELD_ORDER = ["title", "description", "dueDate", "status", "type", "priority", "create", "cancel"] as const;

/** The widget's wrapped lines (`real`), the logical lines they belong to, and how many there are. */
export type CaretLines = {
	real: readonly string[];
	rtof: readonly number[];
	fakeCount: number;
	displayWidth?: (value: string) => number;
};

// Blessed inserts this zero-width marker after double-width characters while wrapping.
// It is not part of the input value, so caret calculations must ignore it.
const WIDE_CHARACTER_PLACEHOLDER = "\x03";

// An astral character such as an emoji is two UTF-16 units, and splitting them leaves an
// unpaired surrogate that renders as a replacement character and corrupts the saved task file.
const isHighSurrogate = (code: number) => code >= 0xd800 && code <= 0xdbff;
const isLowSurrogate = (code: number) => code >= 0xdc00 && code <= 0xdfff;

const visibleLineText = (value: string): string => value.replaceAll(WIDE_CHARACTER_PLACEHOLDER, "");
const codePointWidth = (value: string): number => Array.from(value).length;

function safeCodePointBoundary(value: string, index: number): number {
	const clamped = Math.min(value.length, Math.max(0, index));
	if (isLowSurrogate(value.charCodeAt(clamped)) && isHighSurrogate(value.charCodeAt(clamped - 1))) {
		return clamped - 1;
	}
	return clamped;
}

function indexAtDisplayColumn(value: string, column: number, displayWidth: (value: string) => number): number {
	const target = Math.max(0, column);
	let index = 0;
	let width = 0;
	for (const character of value) {
		const nextWidth = width + Math.max(0, displayWidth(character));
		if (target < nextWidth) return index;
		width = nextWidth;
		index += character.length;
	}
	return value.length;
}

/**
 * The input widgets report the caret as a negative offset from the end of its wrapped line
 * rather than as an index, so count everything that follows the caret to place it in the value.
 */
export function caretIndexFromCursor(value: string, cursor: { x: number; y: number }, lines: CaretLines): number {
	if (lines.real.length === 0) return value.length;
	const lastLine = lines.real.length - 1;
	const currentLine = Math.min(lastLine, Math.max(0, lastLine + cursor.y));
	const displayWidth = lines.displayWidth ?? codePointWidth;
	const currentText = visibleLineText(lines.real[currentLine] ?? "");
	const caretColumn = displayWidth(currentText) + Math.min(0, cursor.x);
	const lineIndex = indexAtDisplayColumn(currentText, caretColumn, displayWidth);
	let after = currentText.length - lineIndex;
	for (let line = currentLine + 1; line <= lastLine; line += 1) {
		after += visibleLineText(lines.real[line] ?? "").length;
	}
	// Wrapped lines share a logical line; only logical breaks add a newline character.
	after += Math.max(0, lines.fakeCount - 1 - (lines.rtof[currentLine] ?? 0));
	return safeCodePointBoundary(value, value.length - after);
}

/** Cursor offsets placing the caret at `caretIndex`; the inverse of {@link caretIndexFromCursor}. */
export function cursorFromCaretIndex(value: string, caretIndex: number, lines: CaretLines): { x: number; y: number } {
	const lastLine = lines.real.length - 1;
	if (lastLine < 0) return { x: 0, y: 0 };
	const displayWidth = lines.displayWidth ?? codePointWidth;
	const after = value.length - safeCodePointBoundary(value, caretIndex);
	let trailing = 0;
	for (let line = lastLine; line >= 0; line -= 1) {
		const lineText = visibleLineText(lines.real[line] ?? "");
		const newlines = Math.max(0, lines.fakeCount - 1 - (lines.rtof[line] ?? 0));
		const trailingCodeUnits = after - trailing - newlines;
		if (trailingCodeUnits >= 0 && trailingCodeUnits <= lineText.length) {
			return {
				x: -displayWidth(lineText.slice(lineText.length - trailingCodeUnits)),
				y: line === lastLine ? 0 : -(lastLine - line),
			};
		}
		trailing += lineText.length;
	}
	return { x: 0, y: -lastLine };
}

/** First index Backspace (one character) or Ctrl+W (one word) should remove, counting back from the caret. */
export function deletionStart(value: string, caretIndex: number, unit: "char" | "word"): number {
	if (caretIndex <= 0) return caretIndex;
	if (unit === "char") {
		const pairedBack =
			isLowSurrogate(value.charCodeAt(caretIndex - 1)) && isHighSurrogate(value.charCodeAt(caretIndex - 2));
		return caretIndex - (pairedBack ? 2 : 1);
	}
	let start = caretIndex;
	while (start > 0 && /\s/.test(value[start - 1] ?? "")) start -= 1;
	while (start > 0 && !/\s/.test(value[start - 1] ?? "")) start -= 1;
	return start;
}

/** Last index Delete should remove, counting forward from the caret. */
export function deletionEnd(value: string, caretIndex: number): number {
	if (caretIndex >= value.length) return caretIndex;
	const pairedForward =
		isHighSurrogate(value.charCodeAt(caretIndex)) && isLowSurrogate(value.charCodeAt(caretIndex + 1));
	return caretIndex + (pairedForward ? 2 : 1);
}

export type TaskComposerValues = {
	title: string;
	description: string;
	status: string;
	type: string;
	priority: string;
	dueDate: string;
};

export type TaskComposerLayout = {
	compact: boolean;
	stackSelectors: boolean;
	popupWidth: number;
	popupHeight: number;
	descriptionHeight: number;
	detailsTop: number;
	detailsHeight: number;
	actionsTop: number;
	contentHeight: number;
};

export type TaskComposerLayoutOptions = {
	statuses?: readonly string[];
	types?: readonly string[];
	priorities?: readonly string[];
};

const TEXT_INPUT_HEIGHT = 3;
// Two popup borders, then the form's top offset and two reserved footer rows.
const POPUP_FORM_VERTICAL_CHROME = 5;
// Two popup borders and the form's one-column inset on each side.
const POPUP_FORM_HORIZONTAL_CHROME = 4;
// createPopupChrome's backdrop extends two columns beyond each side of the popup.
const POPUP_OUTER_HORIZONTAL_MARGIN = 4;
const PREFERRED_POPUP_WIDTH = 72;
const NORMAL_SELECTOR_WIDTH_RATIO = 0.3;
const COMPACT_SELECTOR_WIDTH_RATIO = 0.44;

function selectorContent(label: string, value: string): string {
	return `${label}: ${displayChoice(value)} ▼`;
}

function getSelectorContentWidths(options: TaskComposerLayoutOptions): {
	longest: number;
	longestCompactColumn: number;
} {
	const selectors: Array<[string, FilterPopupChoice[]]> = [
		["Status", getTaskComposerStatusChoices(options.statuses ?? DEFAULT_STATUSES)],
		["Type", getTaskComposerTypeChoices(options.types)],
		["Priority", getTaskComposerPriorityChoices(options.priorities)],
	];
	let longest = 0;
	let longestCompactColumn = 0;
	for (const [label, choices] of selectors) {
		for (const choice of choices) {
			const width = Bun.stringWidth(selectorContent(label, choice.value));
			longest = Math.max(longest, width);
			if (label === "Type" || label === "Priority") longestCompactColumn = Math.max(longestCompactColumn, width);
		}
	}
	return { longest, longestCompactColumn };
}

export function getTaskComposerLayout(
	screenWidth: number,
	screenHeight: number,
	options: TaskComposerLayoutOptions = {},
): TaskComposerLayout {
	const { longest: longestSelectorWidth, longestCompactColumn } = getSelectorContentWidths(options);
	const requiredPopupWidth =
		Math.ceil(longestSelectorWidth / NORMAL_SELECTOR_WIDTH_RATIO) + POPUP_FORM_HORIZONTAL_CHROME;
	const availablePopupWidth = Math.max(1, screenWidth - POPUP_OUTER_HORIZONTAL_MARGIN);
	const popupWidth = Math.min(availablePopupWidth, Math.max(PREFERRED_POPUP_WIDTH, requiredPopupWidth));
	const popupHeight = Math.min(
		20,
		screenHeight,
		Math.max(screenHeight - 2, POPUP_FORM_VERTICAL_CHROME + TEXT_INPUT_HEIGHT),
	);
	const normalSelectorWidth = Math.floor(
		Math.max(0, popupWidth - POPUP_FORM_HORIZONTAL_CHROME) * NORMAL_SELECTOR_WIDTH_RATIO,
	);
	const compactSelectorWidth = Math.floor(
		Math.max(0, popupWidth - POPUP_FORM_HORIZONTAL_CHROME) * COMPACT_SELECTOR_WIDTH_RATIO,
	);
	const expandedDescriptionHeight = 6;
	const expandedDetailsHeight = 3;
	const expandedActionsHeight = 2;
	const expandedContentHeight =
		TEXT_INPUT_HEIGHT + expandedDescriptionHeight + TEXT_INPUT_HEIGHT + expandedDetailsHeight + expandedActionsHeight;
	const visibleFormHeight = Math.max(0, popupHeight - POPUP_FORM_VERTICAL_CHROME);
	const compact = normalSelectorWidth < longestSelectorWidth || visibleFormHeight < expandedContentHeight;
	const stackSelectors = compact && longestCompactColumn > compactSelectorWidth;
	const descriptionHeight = compact ? 3 : expandedDescriptionHeight;
	const detailsTop = TEXT_INPUT_HEIGHT + descriptionHeight + TEXT_INPUT_HEIGHT;
	const detailsHeight = compact ? (stackSelectors ? 5 : 4) : expandedDetailsHeight;
	const actionsTop = detailsTop + detailsHeight;
	return {
		compact,
		stackSelectors,
		popupWidth,
		// The popup must never be taller than the screen: blessed centers it by subtracting
		// half its height. At extreme sizes it also needs enough rows for popup chrome and one
		// complete bordered input, otherwise the editable row and cursor are both clipped.
		popupHeight,
		descriptionHeight,
		detailsTop,
		detailsHeight,
		actionsTop,
		// Compact hides the "Actions" caption, so the buttons are the last row instead of the second-last.
		contentHeight: actionsTop + (compact ? 1 : 2),
	};
}

function getTaskComposerHelpText(screenWidth: number, compact: boolean): string {
	// Each variant has to fit the popup width it is shown at, so drop hints as the screen narrows.
	if (screenWidth < 60) {
		return " {cyan-fg}[↑↓←→/Tab]{/} Nav | {cyan-fg}[Enter]{/} Choose";
	}
	if (compact) {
		return " {cyan-fg}[↑↓←→/Tab]{/} Nav | {cyan-fg}[Enter]{/} Choose | {cyan-fg}[Esc]{/} Cancel";
	}
	return " {cyan-fg}[↑↓/←→/Tab]{/} Navigate | {cyan-fg}[Enter/Space]{/} Choose | {cyan-fg}[Esc]{/} Cancel";
}

type TaskComposerField = "title" | "description" | "dueDate" | "status" | "type" | "priority" | "create" | "cancel";

function uniqueChoices(values: readonly string[], excludedValue?: string): string[] {
	const choices: string[] = [];
	const seen = new Set<string>();
	for (const value of values) {
		const trimmed = String(value ?? "").trim();
		const normalized = trimmed.toLowerCase();
		if (!trimmed || normalized === excludedValue?.toLowerCase() || seen.has(normalized)) continue;
		seen.add(normalized);
		choices.push(trimmed);
	}
	return choices;
}

export function getTaskComposerWorkflowStatuses(statuses: readonly string[]): string[] {
	const configured = uniqueChoices(statuses, DRAFT_STATUS);
	return configured.length > 0 ? configured : ["To Do"];
}

export function getTaskComposerStatusChoices(statuses: readonly string[]): FilterPopupChoice[] {
	return [
		{ label: DRAFT_STATUS, value: DRAFT_STATUS },
		...getTaskComposerWorkflowStatuses(statuses).map((status) => ({ label: status, value: status })),
	];
}

export function getTaskComposerTypeChoices(types?: readonly string[]): FilterPopupChoice[] {
	return [{ label: "None", value: "" }, ...getTaskTypeValues(types).map((type) => ({ label: type, value: type }))];
}

export function getTaskComposerPriorityChoices(priorities?: readonly string[]): FilterPopupChoice[] {
	return [
		{ label: "None", value: "" },
		...getPriorityOptions(priorities).map((priority) => ({ label: priority.label, value: priority.value })),
	];
}

export function createTaskComposerValues(statuses: readonly string[]): TaskComposerValues {
	return {
		title: "",
		description: "",
		status: getTaskComposerWorkflowStatuses(statuses)[0] ?? "To Do",
		type: "",
		priority: "",
		dueDate: "",
	};
}

export function toTaskCreateInput(values: TaskComposerValues): TaskCreateInput {
	const title = values.title.trim();
	if (!title) throw new Error("Title is required.");
	const description = values.description.trim();
	const dueDate = normalizeUtcDateTime(values.dueDate, "Due date");
	return {
		title,
		status: values.status,
		...(description && { description }),
		...(dueDate && { dueDate }),
		...(values.type && { type: values.type }),
		...(values.priority && { priority: values.priority }),
	};
}

export class TaskComposerController {
	readonly values: TaskComposerValues;
	error = "";
	submitting = false;

	constructor(statuses: readonly string[]) {
		this.values = createTaskComposerValues(statuses);
	}

	async create(persist: (input: TaskCreateInput) => Promise<Task>): Promise<Task | null> {
		if (this.submitting) return null;
		this.error = "";
		let input: TaskCreateInput;
		try {
			input = toTaskCreateInput(this.values);
		} catch (error) {
			this.error = error instanceof Error ? error.message : "Task creation failed.";
			return null;
		}

		this.submitting = true;
		try {
			return await persist(input);
		} catch (error) {
			this.error = error instanceof Error ? error.message : "Task creation failed.";
			return null;
		} finally {
			this.submitting = false;
		}
	}
}

function displayChoice(value: string): string {
	return value || "None";
}

export type TaskComposerOptions = {
	screen: ScreenInterface;
	statuses: readonly string[];
	types?: readonly string[];
	priorities?: readonly string[];
	persist: (input: TaskCreateInput) => Promise<Task>;
};

export async function openTaskComposer(options: TaskComposerOptions): Promise<Task | null> {
	return new Promise<Task | null>((resolve) => {
		const controller = new TaskComposerController(options.statuses);
		let settled = false;
		let pickerOpen = false;
		let activeField: TaskComposerField = "title";
		let layout = getTaskComposerLayout(options.screen.width, options.screen.height, options);
		const { popup, close, reflow } = createPopupChrome({
			screen: options.screen,
			title: "Create Task",
			helpText: getTaskComposerHelpText(options.screen.width, layout.compact),
			width: layout.popupWidth,
			height: layout.popupHeight,
		});

		// Short terminals cannot show every field at once, so the fields live in a viewport
		// that clips them to the popup and scrolls the focused one into view.
		const form = createScrollableViewport({
			parent: popup,
			top: 1,
			left: 1,
			right: 1,
			bottom: 2,
			keys: false,
			mouse: true,
		});

		const titleInput = textbox({
			parent: form,
			top: 0,
			left: 1,
			right: 1,
			height: 3,
			border: { type: "line" },
			label: " Title ",
			keys: true,
			mouse: true,
			inputOnFocus: false,
			// Suppresses the scroll key bindings this widget inherits from its scrollable base.
			ignoreKeys: true,
			style: { border: { fg: "gray" } },
		});

		const descriptionInput = textarea({
			parent: form,
			top: 3,
			left: 1,
			right: 1,
			height: layout.descriptionHeight,
			border: { type: "line" },
			label: " Description ",
			keys: true,
			mouse: true,
			inputOnFocus: false,
			scrollable: true,
			style: { border: { fg: "gray" } },
		});

		const dueDateInput = textbox({
			parent: form,
			top: 3 + layout.descriptionHeight,
			left: 1,
			right: 1,
			height: 3,
			border: { type: "line" },
			label: " Due (UTC) ",
			keys: true,
			mouse: true,
			inputOnFocus: false,
			ignoreKeys: true,
			style: { border: { fg: "gray" } },
		});

		const detailsGroup = box({
			parent: form,
			top: layout.detailsTop,
			left: 1,
			right: 1,
			height: layout.detailsHeight,
			border: { type: "line" },
			label: " Details ",
			style: { border: { fg: "cyan" } },
		});
		// The selectors and buttons sit inside the details frame visually, but stay direct
		// children of the viewport: blessed drops grandchildren of a scrolled viewport, which
		// would make them invisible on short terminals.
		const createSelector = (label: string, value: string) =>
			box({
				parent: form,
				top: 0,
				left: 3,
				height: 1,
				content: selectorContent(label, value),
				keys: true,
				mouse: true,
			});
		const statusField = createSelector("Status", controller.values.status);
		const typeField = createSelector("Type", controller.values.type);
		const priorityField = createSelector("Priority", controller.values.priority);

		const actionsLabel = box({
			parent: form,
			top: layout.actionsTop,
			left: 1,
			height: 1,
			content: "Actions",
			style: { fg: "cyan", bold: true },
		});
		const createAction = box({
			parent: form,
			top: layout.actionsTop + 1,
			left: 2,
			width: 18,
			height: 1,
			align: "center",
			content: "Create task",
			keys: true,
			mouse: true,
			style: { fg: "green" },
		});
		const cancelAction = box({
			parent: form,
			top: layout.actionsTop + 1,
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

		const widgets: Record<TaskComposerField, BoxInterface | TextboxInterface> = {
			title: titleInput,
			description: descriptionInput,
			dueDate: dueDateInput,
			status: statusField,
			type: typeField,
			priority: priorityField,
			create: createAction,
			cancel: cancelAction,
		};
		/** Row of each field inside the scrollable viewport; selectors sit inside the details frame. */
		const getFieldTops = (): Record<TaskComposerField, number> => {
			const secondSelectorRow = layout.detailsTop + (layout.compact ? 2 : 1);
			const actionsRow = layout.actionsTop + (layout.compact ? 0 : 1);
			return {
				title: 0,
				description: 3,
				dueDate: 3 + layout.descriptionHeight,
				status: layout.detailsTop + 1,
				type: secondSelectorRow,
				priority: layout.stackSelectors ? secondSelectorRow + 1 : secondSelectorRow,
				create: actionsRow,
				cancel: actionsRow,
			};
		};
		const getFieldTop = (field: TaskComposerField): number => getFieldTops()[field];
		const setFieldGeometry = (
			widget: BoxInterface,
			geometry: { top: number; left: string | number; width: string | number; height?: number },
		) => {
			widget.top = geometry.top;
			widget.left = geometry.left;
			widget.width = geometry.width;
			if (geometry.height !== undefined) widget.height = geometry.height;
		};

		const setBorder = (widget: BoxInterface | TextboxInterface, active: boolean) => {
			const style = (widget.style ?? {}) as { border?: { fg?: string }; inverse?: boolean; bold?: boolean };
			const isTextInput = widget === titleInput || widget === descriptionInput || widget === dueDateInput;
			if (isTextInput) {
				style.border ??= {};
				style.border.fg = active ? "yellow" : "gray";
			}
			style.inverse = active && !isTextInput;
			style.bold = active && !isTextInput;
			widget.style = style;
		};

		const syncInputs = () => {
			controller.values.title = titleInput.getValue();
			controller.values.description = descriptionInput.getValue();
			controller.values.dueDate = dueDateInput.getValue();
		};
		const cancelInputIfReading = (input: TextboxInterface) => {
			if ((input as TextboxInterface & { _reading?: boolean })._reading) input.cancel();
		};

		const scrollFieldIntoView = (field: TaskComposerField) => {
			const visibleHeight = typeof form.height === "number" ? form.height : 12;
			const target = Math.max(0, getFieldTop(field) - Math.max(0, visibleHeight - 3));
			form.childBase = Math.min(Math.max(0, layout.contentHeight - visibleHeight), target);
		};

		const applyLayout = () => {
			layout = getTaskComposerLayout(options.screen.width, options.screen.height, options);
			reflow(layout.popupWidth, layout.popupHeight, getTaskComposerHelpText(options.screen.width, layout.compact));
			descriptionInput.height = layout.descriptionHeight;
			dueDateInput.top = 3 + layout.descriptionHeight;
			detailsGroup.top = layout.detailsTop;
			detailsGroup.height = layout.detailsHeight;
			actionsLabel.top = layout.actionsTop;
			const mutableActionsLabel = actionsLabel as BoxInterface & { hide(): void; show(): void };
			if (layout.compact) mutableActionsLabel.hide();
			else mutableActionsLabel.show();
			const tops = getFieldTops();
			if (layout.compact) {
				setFieldGeometry(statusField, { top: tops.status, left: 3, width: "100%-6" });
				if (layout.stackSelectors) {
					setFieldGeometry(typeField, { top: tops.type, left: 3, width: "100%-6" });
					setFieldGeometry(priorityField, { top: tops.priority, left: 3, width: "100%-6" });
				} else {
					setFieldGeometry(typeField, { top: tops.type, left: 3, width: "44%" });
					setFieldGeometry(priorityField, { top: tops.priority, left: "50%", width: "44%" });
				}
				setFieldGeometry(createAction, { top: tops.create, left: 3, width: "44%" });
				setFieldGeometry(cancelAction, { top: tops.cancel, left: "50%", width: "44%" });
			} else {
				setFieldGeometry(statusField, { top: tops.status, left: 3, width: "30%" });
				setFieldGeometry(typeField, { top: tops.type, left: "35%", width: "30%" });
				setFieldGeometry(priorityField, { top: tops.priority, left: "67%", width: "30%" });
				setFieldGeometry(createAction, { top: tops.create, left: 2, width: 18 });
				setFieldGeometry(cancelAction, { top: tops.cancel, left: 22, width: 14 });
			}
			statusField.setContent(selectorContent("Status", controller.values.status));
			typeField.setContent(selectorContent("Type", controller.values.type));
			priorityField.setContent(selectorContent("Priority", controller.values.priority));
			scrollFieldIntoView(activeField);
		};

		const focusField = (field: TaskComposerField) => {
			if (activeField === "title" || activeField === "description" || activeField === "dueDate") {
				syncInputs();
				cancelInputIfReading(widgets[activeField] as TextboxInterface);
			}
			activeField = field;
			for (const [name, widget] of Object.entries(widgets) as Array<
				[TaskComposerField, BoxInterface | TextboxInterface]
			>) {
				setBorder(widget, name === field);
			}
			const widget = widgets[field];
			widget.focus();
			if (field === "title" || field === "description" || field === "dueDate") {
				(widget as TextboxInterface).readInput();
			}
			// blessed scrolls a focused widget into view using its offset within its immediate
			// parent, which is wrong for the grouped selectors and buttons, so correct it after.
			scrollFieldIntoView(field);
			options.screen.render();
		};

		const navigate = (direction: "up" | "down" | "left" | "right") => {
			let next = activeField;
			if (layout.compact) {
				if (activeField === "status" && direction === "up") next = "dueDate";
				if (activeField === "status" && direction === "down") next = "type";
				if (activeField === "type" && direction === "up") next = "status";
				if (activeField === "type" && direction === "down") next = layout.stackSelectors ? "priority" : "create";
				if (activeField === "type" && direction === "right" && !layout.stackSelectors) next = "priority";
				if (activeField === "priority" && direction === "up") next = layout.stackSelectors ? "type" : "status";
				if (activeField === "priority" && direction === "down") next = layout.stackSelectors ? "create" : "cancel";
				if (activeField === "priority" && direction === "left") next = "type";
				if (activeField === "create" && direction === "up") next = layout.stackSelectors ? "priority" : "type";
				if (activeField === "cancel" && direction === "up") next = "priority";
			} else {
				if (["status", "type", "priority"].includes(activeField)) {
					if (direction === "up") next = "dueDate";
					if (direction === "down") next = activeField === "priority" ? "cancel" : "create";
				}
				if (activeField === "create" && direction === "up") next = "status";
				if (activeField === "cancel" && direction === "up") next = "priority";
			}
			if (activeField === "status" && direction === "left") next = "status";
			if (activeField === "status" && direction === "right" && !layout.compact) next = "type";
			if (activeField === "type" && direction === "left" && !layout.compact) next = "status";
			if (activeField === "type" && direction === "right" && !layout.compact) next = "priority";
			if (activeField === "priority" && direction === "left" && !layout.compact) next = "type";
			if (activeField === "create" && direction === "right") next = "cancel";
			if (activeField === "cancel" && direction === "left") next = "create";
			if (next !== activeField) focusField(next);
		};

		/** Tab traversal: reading order, wrapping at both ends. */
		const moveFocus = (step: number) => {
			const index = FIELD_ORDER.indexOf(activeField);
			const next = FIELD_ORDER[(index + step + FIELD_ORDER.length) % FIELD_ORDER.length];
			if (next) focusField(next);
		};
		const onResize = () => {
			syncInputs();
			if (!pickerOpen) applyLayout();
			options.screen.render();
		};
		let escapeHandler: () => false;

		const finish = (task: Task | null) => {
			if (settled) return;
			settled = true;
			(
				options.screen as ScreenInterface & {
					removeListener(event: string, listener: (...args: unknown[]) => void): void;
				}
			).removeListener("resize", onResize);
			popup.unkey(["escape"], escapeHandler);
			for (const widget of Object.values(widgets)) {
				widget.unkey(["escape"], escapeHandler);
			}
			cancelInputIfReading(titleInput);
			cancelInputIfReading(descriptionInput);
			cancelInputIfReading(dueDateInput);
			close();
			resolve(task);
		};

		const showError = () => {
			errorBox.setContent(controller.error ? ` ${controller.error}` : "");
			options.screen.render();
		};

		const submit = async () => {
			if (pickerOpen || controller.submitting) return;
			syncInputs();
			errorBox.setContent(" Creating task...");
			options.screen.render();
			const task = await controller.create(options.persist);
			if (task) {
				finish(task);
				return;
			}
			showError();
			if (controller.error.startsWith("Due date")) focusField("dueDate");
			else if (!controller.values.title.trim()) focusField("title");
			else focusField("create");
		};

		const openPicker = async (field: "status" | "type" | "priority") => {
			if (pickerOpen || controller.submitting) return;
			syncInputs();
			pickerOpen = true;
			const currentValue = controller.values[field];
			const choices =
				field === "status"
					? getTaskComposerStatusChoices(options.statuses)
					: field === "type"
						? getTaskComposerTypeChoices(options.types)
						: getTaskComposerPriorityChoices(options.priorities);
			try {
				const selected = await openSingleSelectFilterPopup({
					screen: options.screen,
					title: field === "status" ? "Task Status" : field === "type" ? "Task Type" : "Task Priority",
					choices,
					selectedValue: currentValue,
				});
				if (selected !== null) {
					controller.values[field] = selected;
					const fieldLabel = field === "status" ? "Status" : field === "type" ? "Type" : "Priority";
					widgets[field].setContent(selectorContent(fieldLabel, selected));
				}
			} finally {
				pickerOpen = false;
				applyLayout();
				focusField(field);
			}
		};

		const cancel = () => {
			if (!pickerOpen && !controller.submitting) finish(null);
		};

		escapeHandler = () => {
			cancel();
			return false;
		};
		popup.key(["escape"], escapeHandler);
		for (const widget of Object.values(widgets)) {
			widget.key(["escape"], escapeHandler);
			widget.key(["tab"], () => {
				moveFocus(1);
				return false;
			});
			widget.key(["S-tab"], () => {
				moveFocus(-1);
				return false;
			});
		}

		type ComposerInput = TextboxInterface & {
			_listener?: (ch: string, key: { name?: string }) => void;
			_clines?: { length: number; real?: string[]; rtof?: number[]; fake?: string[] };
			getCursor?: () => { x: number; y: number };
			setCursor?: (x: number, y: number) => void;
			setScroll?: (offset: number) => void;
			strWidth?: (value: string) => number;
			_updateCursor?: () => void;
		};
		const readCaretLines = (input: ComposerInput, value: string): CaretLines => ({
			real: input._clines?.real ?? [value],
			rtof: input._clines?.rtof ?? [0],
			fakeCount: input._clines?.fake?.length ?? 1,
			displayWidth: input.strWidth?.bind(input),
		});

		const setTextAtCaret = (input: ComposerInput, value: string, caret: number) => {
			// Changing a line can invalidate the widget's current negative row offset. Park the
			// caret on the last line first, which is valid for any replacement value.
			input.setCursor?.(0, 0);
			input.setValue(value);
			syncInputs();
			const lines = readCaretLines(input, value);
			const cursor = cursorFromCaretIndex(value, caret, lines);
			input.setCursor?.(cursor.x, cursor.y);
			// setValue() scrolls to the last line while the caret is parked at (0, 0). Restore
			// the caret's line so an edit near the top of a long description stays visible.
			input.setScroll?.(Math.max(0, lines.real.length - 1 + cursor.y));
			input._updateCursor?.();
			options.screen.render();
		};

		const insertText = (input: ComposerInput, inserted: string) => {
			const value = input.getValue();
			const cursor = input.getCursor?.() ?? { x: 0, y: 0 };
			const caret = caretIndexFromCursor(value, cursor, readCaretLines(input, value));
			setTextAtCaret(input, value.slice(0, caret) + inserted + value.slice(caret), caret + inserted.length);
		};

		const deleteText = (input: ComposerInput, unit: "char" | "word" | "forward") => {
			const value = input.getValue();
			const cursor = input.getCursor?.() ?? { x: 0, y: 0 };
			const caret = caretIndexFromCursor(value, cursor, readCaretLines(input, value));
			const start = unit === "forward" ? caret : deletionStart(value, caret, unit);
			const end = unit === "forward" ? deletionEnd(value, caret) : caret;
			if (start >= end) return;
			setTextAtCaret(input, value.slice(0, start) + value.slice(end), start);
		};

		/**
		 * Text changes the composer implements itself. The widgets mix display-cell cursor offsets
		 * with UTF-16 slicing, and their deletion behavior also differs between textbox and textarea.
		 * Owning both paths keeps every mutation on a code-point boundary.
		 */
		const ownedInputKeys = new Set(["tab", "backspace", "delete"]);
		const isTextInsertion = (ch: string): boolean => {
			if (!ch) return false;
			if (ch.length > 1) return true;
			const code = ch.charCodeAt(0);
			return code > 0x1f && code !== 0x7f;
		};
		const ownInputKeys = (input: ComposerInput) => {
			const listener = input._listener?.bind(input);
			if (!listener) return;
			input._listener = (ch, key) => {
				if ((key.name && ownedInputKeys.has(key.name)) || ch === "\t") return;
				if (isTextInsertion(ch)) {
					insertText(input, ch);
					return;
				}
				listener(ch, key);
			};
		};
		ownInputKeys(titleInput as ComposerInput);
		ownInputKeys(descriptionInput as ComposerInput);
		ownInputKeys(dueDateInput as ComposerInput);

		let cursorBeforeKey: { y: number; lines: number } | null = null;
		for (const input of [titleInput, descriptionInput, dueDateInput] as ComposerInput[]) {
			input.on("keypress", () => {
				cursorBeforeKey = {
					y: input.getCursor?.().y ?? 0,
					lines: Math.max(1, input._clines?.length ?? input.getValue().split("\n").length),
				};
				controller.error = "";
				errorBox.setContent("");
			});
			input.key(["backspace"], () => {
				deleteText(input, "char");
				return false;
			});
			input.key(["delete"], () => {
				deleteText(input, "forward");
				return false;
			});
			input.key(["C-w"], () => {
				deleteText(input, "word");
				return false;
			});
		}
		titleInput.key(["down"], () => {
			focusField("description");
			return false;
		});
		titleInput.on("submit", () => focusField("description"));
		descriptionInput.key(["up"], () => {
			const cursor = cursorBeforeKey;
			if (cursor && cursor.y <= -(cursor.lines - 1)) focusField("title");
			return false;
		});
		descriptionInput.key(["down"], () => {
			if (cursorBeforeKey?.y === 0) focusField("dueDate");
			return false;
		});
		dueDateInput.key(["up"], () => {
			focusField("description");
			return false;
		});
		dueDateInput.key(["down"], () => {
			focusField("status");
			return false;
		});
		dueDateInput.on("submit", () => focusField("status"));

		for (const field of ["status", "type", "priority"] as const) {
			const widget = widgets[field];
			widget.key(["enter", "space"], () => {
				void openPicker(field);
				return false;
			});
		}

		// Pointer activation uses the same transition as keyboard navigation so text inputs
		// enter read mode and every field has one source of truth for focus styling and scrolling.
		for (const field of ["title", "description", "dueDate", "status", "type", "priority"] as const) {
			widgets[field].on("click", () => {
				focusField(field);
				if (field === "status" || field === "type" || field === "priority") void openPicker(field);
				// The screen otherwise auto-focuses clickable widgets after this event bubbles,
				// which blurs a text field immediately after readInput starts.
				return false;
			});
		}

		for (const field of ["status", "type", "priority", "create", "cancel"] as const) {
			const widget = widgets[field];
			for (const direction of ["up", "down", "left", "right"] as const) {
				widget.key([direction], () => {
					navigate(direction);
					return false;
				});
			}
		}

		createAction.key(["enter", "space"], () => {
			void submit();
			return false;
		});
		createAction.on("click", () => void submit());
		cancelAction.key(["enter", "space"], () => {
			cancel();
			return false;
		});
		cancelAction.on("click", cancel);

		options.screen.on("resize", onResize);
		applyLayout();
		setImmediate(() => focusField("title"));
	});
}
