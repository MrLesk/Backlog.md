import type { BoxInterface, ScreenInterface, TextboxInterface } from "neo-neo-bblessed";
import { box, textarea, textbox } from "neo-neo-bblessed";
import type { Task, TaskCreateInput } from "../../types/index.ts";
import { getPriorityOptions } from "../../utils/priority-config.ts";
import { getTaskTypeValues } from "../../utils/task-type-config.ts";
import { createPopupChrome, type FilterPopupChoice, openSingleSelectFilterPopup } from "./filter-popup.ts";

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
};

export function getTaskComposerLayout(screenWidth: number, screenHeight: number): TaskComposerLayout {
	const compact = screenWidth < 70 || screenHeight < 30;
	return {
		compact,
		popupWidth: screenWidth < 76 ? "96%" : 72,
		popupHeight: compact ? Math.max(8, screenHeight - 2) : Math.min(30, screenHeight),
	};
}

function getTaskComposerHelpText(screenWidth: number, compact: boolean): string {
	if (!compact) {
		return " {cyan-fg}[Tab/Shift+Tab]{/} Field | {cyan-fg}[Enter/Space]{/} Open/Create | {cyan-fg}[Esc]{/} Cancel";
	}
	if (screenWidth < 60) {
		return " {cyan-fg}[Tab]{/} Next | {cyan-fg}[Enter]{/} Open | {cyan-fg}[Esc]{/} Cancel";
	}
	return " {cyan-fg}[Tab]{/} Next | {cyan-fg}[Enter]{/} Open/Create | {cyan-fg}[Esc]{/} Cancel";
}

type TaskComposerField = "title" | "description" | "status" | "type" | "priority" | "create" | "cancel";

const FIELD_ORDER: TaskComposerField[] = ["title", "description", "status", "type", "priority", "create", "cancel"];

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
		let narrow = layout.compact;
		const { popup, close, reflow } = createPopupChrome({
			screen: options.screen,
			title: "Create Task",
			helpText: getTaskComposerHelpText(options.screen.width, narrow),
			width: layout.popupWidth,
			height: layout.popupHeight,
		});

		const form = box({
			parent: popup,
			top: 1,
			left: 1,
			right: 1,
			bottom: 2,
			scrollable: true,
			alwaysScroll: true,
			keys: false,
			mouse: true,
		});

		const label = (top: number, content: string) =>
			box({ parent: form, top, left: 1, height: 1, content, style: { fg: "cyan" } });

		const titleLabel = label(0, "Title");
		const titleInput = textbox({
			parent: form,
			top: 1,
			left: 1,
			right: 1,
			height: 3,
			border: { type: "line" },
			keys: true,
			mouse: true,
			inputOnFocus: false,
		});

		const descriptionLabel = label(4, "Description");
		const descriptionInput = textarea({
			parent: form,
			top: 5,
			left: 1,
			right: 1,
			height: narrow ? 3 : 5,
			border: { type: "line" },
			keys: true,
			mouse: true,
			inputOnFocus: false,
			scrollable: true,
		});

		const createSelectField = (top: number, fieldLabel: string, value: string, side?: "left" | "right") => {
			return box({
				parent: form,
				top: narrow ? top : top + 1,
				left: narrow && side === "right" ? "50%" : 1,
				...(narrow && side ? { width: "48%" } : { right: 1 }),
				height: narrow ? 1 : 3,
				...(narrow ? {} : { border: { type: "line" } }),
				content: narrow ? `${fieldLabel}: ${displayChoice(value)}` : ` ${displayChoice(value)}`,
				keys: true,
				mouse: true,
			});
		};

		const statusLabel = label(10, "Status");
		const typeLabel = label(14, "Type");
		const priorityLabel = label(18, "Priority");
		const statusField = createSelectField(narrow ? 8 : 10, "Status", controller.values.status);
		const typeField = createSelectField(narrow ? 9 : 14, "Type", controller.values.type, narrow ? "left" : undefined);
		const priorityField = createSelectField(
			narrow ? 9 : 18,
			"Priority",
			controller.values.priority,
			narrow ? "right" : undefined,
		);

		const createAction = box({
			parent: form,
			top: narrow ? 10 : 22,
			left: 1,
			width: 14,
			height: narrow ? 1 : 3,
			...(narrow ? {} : { border: { type: "line" } }),
			align: "center",
			valign: "middle",
			content: "Create",
			keys: true,
			mouse: true,
		});
		const cancelAction = box({
			parent: form,
			top: narrow ? 10 : 22,
			left: 17,
			width: 14,
			height: narrow ? 1 : 3,
			...(narrow ? {} : { border: { type: "line" } }),
			align: "center",
			valign: "middle",
			content: "Cancel",
			keys: true,
			mouse: true,
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
		const getFieldTop = (field: TaskComposerField): number => {
			const tops: Record<TaskComposerField, number> = {
				title: 0,
				description: 4,
				status: narrow ? 8 : 10,
				type: narrow ? 9 : 14,
				priority: narrow ? 9 : 18,
				create: narrow ? 10 : 22,
				cancel: narrow ? 10 : 22,
			};
			return tops[field];
		};
		type MutableLayoutWidget = BoxInterface & {
			border?: { type: "line" };
			hide(): void;
			show(): void;
		};
		const setFieldGeometry = (
			widget: BoxInterface,
			geometry: { top: number; left: string | number; width: string | number; height: number },
			bordered: boolean,
		) => {
			widget.top = geometry.top;
			widget.left = geometry.left;
			widget.width = geometry.width;
			widget.height = geometry.height;
			(widget as MutableLayoutWidget).border = bordered ? { type: "line" } : undefined;
		};
		const applyLayout = () => {
			layout = getTaskComposerLayout(options.screen.width, options.screen.height);
			narrow = layout.compact;
			reflow(layout.popupWidth, layout.popupHeight, getTaskComposerHelpText(options.screen.width, layout.compact));
			titleLabel.top = 0;
			descriptionLabel.top = 4;
			descriptionInput.height = narrow ? 3 : 5;
			for (const fieldLabel of [statusLabel, typeLabel, priorityLabel] as MutableLayoutWidget[]) {
				if (narrow) fieldLabel.hide();
				else fieldLabel.show();
			}
			statusLabel.top = 10;
			typeLabel.top = 14;
			priorityLabel.top = 18;
			setFieldGeometry(
				statusField,
				{ top: narrow ? 8 : 11, left: 1, width: "100%-2", height: narrow ? 1 : 3 },
				!narrow,
			);
			setFieldGeometry(
				typeField,
				{ top: narrow ? 9 : 15, left: 1, width: narrow ? "48%" : "100%-2", height: narrow ? 1 : 3 },
				!narrow,
			);
			setFieldGeometry(
				priorityField,
				{
					top: narrow ? 9 : 19,
					left: narrow ? "50%" : 1,
					width: narrow ? "48%" : "100%-2",
					height: narrow ? 1 : 3,
				},
				!narrow,
			);
			setFieldGeometry(createAction, { top: narrow ? 10 : 22, left: 1, width: 14, height: narrow ? 1 : 3 }, !narrow);
			setFieldGeometry(cancelAction, { top: narrow ? 10 : 22, left: 17, width: 14, height: narrow ? 1 : 3 }, !narrow);
			statusField.setContent(
				narrow ? `Status: ${displayChoice(controller.values.status)}` : ` ${displayChoice(controller.values.status)}`,
			);
			typeField.setContent(
				narrow ? `Type: ${displayChoice(controller.values.type)}` : ` ${displayChoice(controller.values.type)}`,
			);
			priorityField.setContent(
				narrow
					? `Priority: ${displayChoice(controller.values.priority)}`
					: ` ${displayChoice(controller.values.priority)}`,
			);
			scrollFieldIntoView(activeField);
		};

		const setBorder = (widget: BoxInterface | TextboxInterface, active: boolean) => {
			const style = (widget.style ?? {}) as { border?: { fg?: string }; inverse?: boolean; bold?: boolean };
			style.border ??= {};
			style.border.fg = active ? "yellow" : "gray";
			const isTextInput = widget === titleInput || widget === descriptionInput;
			style.inverse = active && (!isTextInput || widget === createAction || widget === cancelAction) && narrow;
			style.bold = active && (widget === createAction || widget === cancelAction);
			widget.style = style;
		};

		const syncInputs = () => {
			controller.values.title = titleInput.getValue();
			controller.values.description = descriptionInput.getValue();
		};

		const scrollFieldIntoView = (field: TaskComposerField) => {
			const scrollable = form as BoxInterface & { scrollTo?: (index: number) => void };
			const visibleHeight = typeof form.height === "number" ? form.height : 14;
			const top = getFieldTop(field);
			const target = Math.max(0, top - Math.max(0, visibleHeight - 5));
			scrollable.scrollTo?.(target);
		};

		const focusField = (field: TaskComposerField) => {
			if (activeField === "title" || activeField === "description") {
				syncInputs();
				(titleInput as TextboxInterface).cancel();
				(descriptionInput as TextboxInterface).cancel();
			}
			activeField = field;
			for (const [name, widget] of Object.entries(widgets) as Array<
				[TaskComposerField, BoxInterface | TextboxInterface]
			>) {
				setBorder(widget, name === field);
			}
			scrollFieldIntoView(field);
			const widget = widgets[field];
			widget.focus();
			if (field === "title" || field === "description") {
				(widget as TextboxInterface).readInput();
			}
			options.screen.render();
		};

		const moveFocus = (direction: -1 | 1) => {
			const index = FIELD_ORDER.indexOf(activeField);
			const nextIndex = (index + direction + FIELD_ORDER.length) % FIELD_ORDER.length;
			focusField(FIELD_ORDER[nextIndex] ?? "title");
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
			titleInput.cancel();
			descriptionInput.cancel();
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
					widgets[field].setContent(
						narrow ? `${fieldLabel}: ${displayChoice(selected)}` : ` ${displayChoice(selected)}`,
					);
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

		for (const input of [titleInput, descriptionInput]) {
			input.key(["tab"], () => {
				moveFocus(1);
				return false;
			});
			input.key(["S-tab"], () => {
				moveFocus(-1);
				return false;
			});
			input.on("keypress", () => {
				controller.error = "";
				errorBox.setContent("");
			});
		}
		titleInput.on("submit", () => focusField("description"));

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
			widget.key(["tab"], () => {
				moveFocus(1);
				return false;
			});
			widget.key(["S-tab"], () => {
				moveFocus(-1);
				return false;
			});
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
