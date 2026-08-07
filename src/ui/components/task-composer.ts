import type { BoxInterface, ScreenInterface, TextboxInterface } from "neo-neo-bblessed";
import { box, textarea, textbox } from "neo-neo-bblessed";
import type { Task, TaskCreateInput } from "../../types/index.ts";
import { getPriorityOptions } from "../../utils/priority-config.ts";
import { getTaskTypeValues } from "../../utils/task-type-config.ts";
import {
	createPopupChrome,
	createScrollableViewport,
	type FilterPopupChoice,
	openSingleSelectFilterPopup,
} from "./filter-popup.ts";

const DRAFT_STATUS = "Draft";

export type TaskComposerValues = {
	title: string;
	description: string;
	status: string;
	type: string;
	priority: string;
};

export type TaskComposerLayout = {
	compact: boolean;
	popupWidth: string | number;
	popupHeight: number;
	descriptionHeight: number;
	detailsTop: number;
	detailsHeight: number;
	actionsTop: number;
	contentHeight: number;
};

export function getTaskComposerLayout(screenWidth: number, screenHeight: number): TaskComposerLayout {
	const compact = screenWidth < 64 || screenHeight < 20;
	const descriptionHeight = compact ? 3 : 6;
	const detailsTop = 3 + descriptionHeight;
	const detailsHeight = compact ? 4 : 3;
	const actionsTop = detailsTop + detailsHeight;
	return {
		compact,
		popupWidth: screenWidth < 76 ? "96%" : 72,
		// The popup must never be taller than the screen: blessed centers it by subtracting
		// half its height, so an oversized popup starts at a negative row and its actions,
		// error and help rows fall outside the terminal.
		popupHeight: Math.min(20, Math.max(3, screenHeight - 2)),
		descriptionHeight,
		detailsTop,
		detailsHeight,
		actionsTop,
		// Compact hides the "Actions" caption, so the buttons are the last row instead of the second-last.
		contentHeight: actionsTop + (compact ? 1 : 2),
	};
}

function getTaskComposerHelpText(screenWidth: number, compact: boolean): string {
	if (compact || screenWidth < 60) {
		return " {cyan-fg}[↑↓←→]{/} Nav | {cyan-fg}[Enter]{/} Choose | {cyan-fg}[Esc]{/} Cancel";
	}
	return " {cyan-fg}[↑↓/←→]{/} Navigate | {cyan-fg}[Enter/Space]{/} Choose | {cyan-fg}[Esc]{/} Cancel";
}

type TaskComposerField = "title" | "description" | "status" | "type" | "priority" | "create" | "cancel";

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
	};
}

export function toTaskCreateInput(values: TaskComposerValues): TaskCreateInput {
	const title = values.title.trim();
	if (!title) throw new Error("Title is required.");
	const description = values.description.trim();
	return {
		title,
		status: values.status,
		...(description && { description }),
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
		let layout = getTaskComposerLayout(options.screen.width, options.screen.height);
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
			// Suppresses the inherited scroll key bindings; Tab inertness comes from makeTabInert.
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
		const selectorContent = (label: string, value: string) => `${label}: ${displayChoice(value)} ▼`;
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
				status: layout.detailsTop + 1,
				type: secondSelectorRow,
				priority: secondSelectorRow,
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
			const isTextInput = widget === titleInput || widget === descriptionInput;
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
			layout = getTaskComposerLayout(options.screen.width, options.screen.height);
			reflow(layout.popupWidth, layout.popupHeight, getTaskComposerHelpText(options.screen.width, layout.compact));
			descriptionInput.height = layout.descriptionHeight;
			detailsGroup.top = layout.detailsTop;
			detailsGroup.height = layout.detailsHeight;
			actionsLabel.top = layout.actionsTop;
			const mutableActionsLabel = actionsLabel as BoxInterface & { hide(): void; show(): void };
			if (layout.compact) mutableActionsLabel.hide();
			else mutableActionsLabel.show();
			const tops = getFieldTops();
			if (layout.compact) {
				setFieldGeometry(statusField, { top: tops.status, left: 3, width: "100%-6" });
				setFieldGeometry(typeField, { top: tops.type, left: 3, width: "44%" });
				setFieldGeometry(priorityField, { top: tops.priority, left: "50%", width: "44%" });
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
			if (activeField === "title" || activeField === "description") {
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
			if (field === "title" || field === "description") {
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
				if (activeField === "status" && direction === "up") next = "description";
				if (activeField === "status" && direction === "down") next = "type";
				if (activeField === "type" && direction === "up") next = "status";
				if (activeField === "type" && direction === "down") next = "create";
				if (activeField === "type" && direction === "right") next = "priority";
				if (activeField === "priority" && direction === "up") next = "status";
				if (activeField === "priority" && direction === "down") next = "cancel";
				if (activeField === "priority" && direction === "left") next = "type";
				if (activeField === "create" && direction === "up") next = "type";
				if (activeField === "cancel" && direction === "up") next = "priority";
			} else {
				if (["status", "type", "priority"].includes(activeField)) {
					if (direction === "up") next = "description";
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
			if (!controller.values.title.trim()) focusField("title");
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
		}

		type ComposerInput = TextboxInterface & {
			_listener?: (ch: string, key: { name?: string }) => void;
			_clines?: { length: number };
			getCursor?: () => { x: number; y: number };
		};
		const makeTabInert = (input: ComposerInput) => {
			const listener = input._listener?.bind(input);
			if (!listener) return;
			input._listener = (ch, key) => {
				if (key.name === "tab" || ch === "\t") return;
				listener(ch, key);
			};
		};
		makeTabInert(titleInput as ComposerInput);
		makeTabInert(descriptionInput as ComposerInput);

		let cursorBeforeKey: { y: number; lines: number } | null = null;
		for (const input of [titleInput, descriptionInput] as ComposerInput[]) {
			input.on("keypress", () => {
				cursorBeforeKey = {
					y: input.getCursor?.().y ?? 0,
					lines: Math.max(1, input._clines?.length ?? input.getValue().split("\n").length),
				};
				controller.error = "";
				errorBox.setContent("");
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
			if (cursorBeforeKey?.y === 0) focusField("status");
			return false;
		});

		for (const field of ["status", "type", "priority"] as const) {
			const widget = widgets[field];
			widget.key(["enter", "space"], () => {
				void openPicker(field);
				return false;
			});
			widget.on("click", () => void openPicker(field));
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
