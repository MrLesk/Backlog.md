import { TextPrompt } from "@clack/core";
import * as clack from "@clack/prompts";
import picocolors from "picocolors";
import { DEFAULT_STATUSES } from "../constants/index.ts";
import type { AcceptanceCriterion, Task, TaskCreateInput, TaskUpdateInput } from "../types/index.ts";
import { normalizeDependencies, normalizeStringList } from "../utils/task-builders.ts";

type WizardPriority = "high" | "medium" | "low";

interface TaskWizardValues {
	title: string;
	description: string;
	status: string;
	priority: string;
	assignee: string;
	labels: string;
	acceptanceCriteria: string;
	definitionOfDone: string;
	implementationPlan: string;
	implementationNotes: string;
	references: string;
	documentation: string;
	dependencies: string;
}

export interface TaskWizardTaskOption {
	id: string;
	title: string;
}

interface PromptChoice {
	label: string;
	value: string;
	hint?: string;
}

interface TaskWizardQuestion {
	type: "text" | "select";
	name: string;
	message: string;
	initial?: string;
	options?: PromptChoice[];
	validate?: (value: string | undefined) => string | undefined;
	allowBackspaceNavigation?: boolean;
}

interface TaskWizardValueQuestion extends Omit<TaskWizardQuestion, "name"> {
	name: keyof TaskWizardValues;
}

export type TaskWizardPromptRunner = (question: TaskWizardQuestion) => Promise<Record<string, unknown>>;

export class TaskWizardCancelledError extends Error {
	constructor() {
		super("Task wizard cancelled.");
	}
}

interface ChecklistEntry {
	text: string;
	checked: boolean;
}

interface WizardOptions {
	statuses: string[];
	promptImpl?: TaskWizardPromptRunner;
}

const SINGLE_LINE_PROMPT_GUIDANCE = "single-line prompt; Shift+Enter not supported";
const WIZARD_NAVIGATION_KEY = "__wizardNavigation";
const WIZARD_NAVIGATION_PREVIOUS = "previous";
const WIZARD_BACKSPACE_NAVIGATION = Symbol("task-wizard-backspace-navigation");

function normalizeStatusKey(status: string): string {
	return status.trim().toLowerCase().replace(/\s+/g, "");
}

function findCanonicalStatus(input: string, statuses: string[]): string | null {
	const normalizedInput = normalizeStatusKey(input);
	if (!normalizedInput) return null;
	for (const status of statuses) {
		if (normalizeStatusKey(status) === normalizedInput) {
			return status;
		}
	}
	return null;
}

function parseListInput(value: string): string[] {
	const entries = value
		.split(/,|\r?\n/g)
		.map((entry) => entry.trim())
		.filter((entry) => entry.length > 0);
	return normalizeStringList(entries) ?? [];
}

function parseChecklistInput(value: string): ChecklistEntry[] {
	const entries = value
		.split(/,|\r?\n/g)
		.map((entry) => entry.trim())
		.filter((entry) => entry.length > 0);
	const parsed: ChecklistEntry[] = [];
	for (const entry of entries) {
		const match = entry.match(/^\[(x|X| )\]\s*(.+)$/);
		if (match) {
			const checkedToken = match[1] ?? " ";
			const text = (match[2] ?? "").trim();
			if (text.length > 0) {
				parsed.push({ text, checked: checkedToken.toLowerCase() === "x" });
			}
			continue;
		}
		parsed.push({ text: entry, checked: false });
	}
	return parsed;
}

function getDefaultCreateStatus(statuses: string[]): string {
	const canonicalTodo = findCanonicalStatus("To Do", statuses);
	if (canonicalTodo) {
		return canonicalTodo;
	}
	const firstStatus = statuses.find((status) => status.trim().length > 0);
	return firstStatus ?? "To Do";
}

function buildStatusPromptValues(params: { statuses: string[]; mode: "create" | "edit"; initialStatus: string }): {
	options: PromptChoice[];
	initial: string;
} {
	const configuredStatuses = normalizeStringList(params.statuses.map((status) => status.trim())) ?? [];
	const baseStatuses = configuredStatuses.length > 0 ? configuredStatuses : [...DEFAULT_STATUSES];
	const hasDraftStatus = baseStatuses.some((status) => normalizeStatusKey(status) === normalizeStatusKey("Draft"));
	const selectableStatuses = hasDraftStatus ? baseStatuses : ["Draft", ...baseStatuses];
	const options: PromptChoice[] = selectableStatuses.map((status) => ({
		label: status,
		value: status,
	}));

	if (params.mode === "create") {
		const createDefault = getDefaultCreateStatus(baseStatuses);
		return {
			options,
			initial: createDefault,
		};
	}

	const initialStatus = params.initialStatus.trim();
	if (!initialStatus) {
		return {
			options,
			initial: getDefaultCreateStatus(baseStatuses),
		};
	}

	const canonicalInitial = findCanonicalStatus(initialStatus, selectableStatuses);
	if (canonicalInitial) {
		return {
			options,
			initial: canonicalInitial,
		};
	}

	return {
		options: [{ label: `${params.initialStatus} (current)`, value: params.initialStatus }, ...options],
		initial: params.initialStatus,
	};
}

function buildPriorityPromptValues(initialPriority: string): {
	options: PromptChoice[];
	initial: string;
} {
	const normalizedInitial = initialPriority.trim().toLowerCase();
	const options: PromptChoice[] = [
		{ label: "None", value: "", hint: "No priority" },
		{ label: "High", value: "high" },
		{ label: "Medium", value: "medium" },
		{ label: "Low", value: "low" },
	];
	if (!normalizedInitial) {
		return { options, initial: "" };
	}
	if (normalizedInitial === "high" || normalizedInitial === "medium" || normalizedInitial === "low") {
		return { options, initial: normalizedInitial };
	}
	return {
		options: [{ label: `${initialPriority} (current)`, value: normalizedInitial }, ...options],
		initial: normalizedInitial,
	};
}

function formatListInput(values?: string[]): string {
	return values && values.length > 0 ? values.join(", ") : "";
}

function formatChecklistInput(values?: AcceptanceCriterion[]): string {
	if (!values || values.length === 0) return "";
	return values
		.slice()
		.sort((a, b) => a.index - b.index)
		.map((entry) => `[${entry.checked ? "x" : " "}] ${entry.text}`)
		.join(", ");
}

function areStringArraysEqual(a: string[], b: string[]): boolean {
	if (a.length !== b.length) return false;
	return a.every((value, index) => value === b[index]);
}

function areChecklistEntriesEqual(existing: ChecklistEntry[], next: ChecklistEntry[]): boolean {
	if (existing.length !== next.length) return false;
	return existing.every((entry, index) => {
		const candidate = next[index];
		if (!candidate) return false;
		return entry.text === candidate.text && entry.checked === candidate.checked;
	});
}

const clackPromptRunner: TaskWizardPromptRunner = async (question) => {
	if (question.type === "text") {
		const textPrompt = new TextPrompt({
			initialValue: question.initial,
			validate: question.validate,
			render() {
				const withGuide = clack.settings.withGuide;
				const header = `${withGuide ? `${picocolors.gray(clack.S_BAR)}\n` : ""}${clack.symbol(this.state)}  ${question.message}\n`;
				const placeholder = picocolors.inverse(picocolors.hidden("_"));
				const inputValue = this.userInput.length > 0 ? this.userInputWithCursor : placeholder;
				const submittedValue = String(this.value ?? "");

				switch (this.state) {
					case "error": {
						const linePrefix = withGuide ? `${picocolors.yellow(clack.S_BAR)}  ` : "";
						const footer = withGuide ? picocolors.yellow(clack.S_BAR_END) : "";
						const errorMessage = this.error.length > 0 ? `  ${picocolors.yellow(this.error)}` : "";
						return `${header.trimEnd()}\n${linePrefix}${inputValue}\n${footer}${errorMessage}\n`;
					}
					case "submit": {
						const linePrefix = withGuide ? picocolors.gray(clack.S_BAR) : "";
						const value = submittedValue.length > 0 ? `  ${picocolors.dim(submittedValue)}` : "";
						return `${header}${linePrefix}${value}`;
					}
					case "cancel": {
						const linePrefix = withGuide ? picocolors.gray(clack.S_BAR) : "";
						const value =
							submittedValue.length > 0 ? `  ${picocolors.strikethrough(picocolors.dim(submittedValue))}` : "";
						return `${header}${linePrefix}${value}${submittedValue.trim().length > 0 ? `\n${linePrefix}` : ""}`;
					}
					default: {
						const linePrefix = withGuide ? `${picocolors.cyan(clack.S_BAR)}  ` : "";
						const footer = withGuide ? picocolors.cyan(clack.S_BAR_END) : "";
						return `${header}${linePrefix}${inputValue}\n${footer}\n`;
					}
				}
			},
		});
		let previousInput = question.initial ?? "";
		textPrompt.on("key", (_key, keyInfo) => {
			if (keyInfo.name !== "backspace") {
				previousInput = textPrompt.userInput;
				return;
			}
			const wasEmptyBeforeKeypress = previousInput.length === 0;
			const isEmptyAfterKeypress = textPrompt.userInput.length === 0;
			if (question.allowBackspaceNavigation && wasEmptyBeforeKeypress && isEmptyAfterKeypress) {
				textPrompt.state = "submit";
				textPrompt.value = WIZARD_BACKSPACE_NAVIGATION as unknown as string;
				return;
			}
			previousInput = textPrompt.userInput;
		});
		const result = await textPrompt.prompt();
		if (result === WIZARD_BACKSPACE_NAVIGATION) {
			return { [WIZARD_NAVIGATION_KEY]: WIZARD_NAVIGATION_PREVIOUS };
		}
		if (clack.isCancel(result)) {
			throw new TaskWizardCancelledError();
		}
		return { [question.name]: String(result ?? "") };
	}

	const options = question.options ?? [];
	if (options.length === 0) {
		throw new Error(`No options provided for select prompt '${question.name}'.`);
	}
	const result = await clack.select({
		message: question.message,
		initialValue: question.initial,
		options: options.map((option) => ({
			label: option.label,
			value: option.value,
			hint: option.hint,
		})),
	});
	if (clack.isCancel(result)) {
		throw new TaskWizardCancelledError();
	}
	return { [question.name]: String(result ?? "") };
};

async function promptText(
	prompt: TaskWizardPromptRunner,
	options: {
		name: keyof TaskWizardValues;
		message: string;
		initial?: string;
		validate?: (value: string | undefined) => string | undefined;
		allowBackspaceNavigation?: boolean;
	},
): Promise<string | typeof WIZARD_BACKSPACE_NAVIGATION> {
	const response = await prompt({
		type: "text",
		name: options.name,
		message: options.message,
		initial: options.initial,
		validate: options.validate,
		allowBackspaceNavigation: options.allowBackspaceNavigation,
	});
	if (response[WIZARD_NAVIGATION_KEY] === WIZARD_NAVIGATION_PREVIOUS) {
		return WIZARD_BACKSPACE_NAVIGATION;
	}
	return String(response[options.name] ?? "");
}

async function promptSelect(
	prompt: TaskWizardPromptRunner,
	options: {
		name: keyof TaskWizardValues;
		message: string;
		initial?: string;
		choices: PromptChoice[];
	},
): Promise<string> {
	const response = await prompt({
		type: "select",
		name: options.name,
		message: options.message,
		initial: options.initial,
		options: options.choices,
	});
	return String(response[options.name] ?? "");
}

async function runTaskWizardValues(params: {
	mode: "create" | "edit";
	statuses: string[];
	initialValues: TaskWizardValues;
	promptImpl?: TaskWizardPromptRunner;
}): Promise<TaskWizardValues | null> {
	const prompt = params.promptImpl ?? clackPromptRunner;
	const statuses = params.statuses;
	const initial = params.initialValues;
	const statusPrompt = buildStatusPromptValues({
		statuses,
		mode: params.mode,
		initialStatus: initial.status,
	});
	const priorityPrompt = buildPriorityPromptValues(initial.priority);

	try {
		const values: TaskWizardValues = {
			...initial,
			status: statusPrompt.initial,
			priority: priorityPrompt.initial,
		};
		const questions: TaskWizardValueQuestion[] = [
			{
				type: "text",
				name: "title",
				message: "Title",
				validate: (value) => {
					const normalized = String(value ?? "");
					if (normalized.trim().length === 0) {
						return "Title is required.";
					}
					return undefined;
				},
			},
			{
				type: "text",
				name: "description",
				message: `Description (${SINGLE_LINE_PROMPT_GUIDANCE})`,
			},
			{
				type: "select",
				name: "status",
				message: "Status",
				options: statusPrompt.options,
			},
			{
				type: "select",
				name: "priority",
				message: "Priority",
				options: priorityPrompt.options,
			},
			{
				type: "text",
				name: "assignee",
				message:
					params.mode === "create"
						? "Assignee (comma-separated)"
						: "Assignee (comma-separated; blank keeps current value)",
			},
			{
				type: "text",
				name: "labels",
				message:
					params.mode === "create" ? "Labels (comma-separated)" : "Labels (comma-separated; blank keeps current value)",
			},
			{
				type: "text",
				name: "acceptanceCriteria",
				message: "Acceptance Criteria (comma/newline-separated; optional [x]/[ ] prefix per item)",
			},
			{
				type: "text",
				name: "definitionOfDone",
				message:
					"Task Definition of Done (per-task; project-level DoD configured elsewhere; comma/newline-separated; optional [x]/[ ] prefix per item)",
			},
			{
				type: "text",
				name: "implementationPlan",
				message:
					params.mode === "create"
						? `Implementation Plan (${SINGLE_LINE_PROMPT_GUIDANCE})`
						: `Implementation Plan (${SINGLE_LINE_PROMPT_GUIDANCE}; blank keeps current value)`,
			},
			{
				type: "text",
				name: "implementationNotes",
				message:
					params.mode === "create"
						? `Implementation Notes (${SINGLE_LINE_PROMPT_GUIDANCE})`
						: `Implementation Notes (${SINGLE_LINE_PROMPT_GUIDANCE}; blank keeps current value)`,
			},
			{
				type: "text",
				name: "references",
				message:
					params.mode === "create"
						? "References (comma-separated)"
						: "References (comma-separated; blank keeps current value)",
			},
			{
				type: "text",
				name: "documentation",
				message:
					params.mode === "create"
						? "Documentation (comma-separated)"
						: "Documentation (comma-separated; blank keeps current value)",
			},
			{
				type: "text",
				name: "dependencies",
				message:
					params.mode === "create"
						? "Dependencies (comma-separated task IDs)"
						: "Dependencies (comma-separated task IDs; blank keeps current value)",
			},
		];

		let questionIndex = 0;
		while (questionIndex < questions.length) {
			const question = questions[questionIndex];
			if (!question) {
				break;
			}
			if (question.type === "text") {
				const response = await promptText(prompt, {
					name: question.name,
					message: question.message,
					initial: values[question.name],
					validate: question.validate,
					allowBackspaceNavigation: questionIndex > 0,
				});
				if (response === WIZARD_BACKSPACE_NAVIGATION) {
					questionIndex = Math.max(0, questionIndex - 1);
					continue;
				}
				values[question.name] = response;
				questionIndex += 1;
				continue;
			}
			values[question.name] = await promptSelect(prompt, {
				name: question.name,
				message: question.message,
				initial: values[question.name],
				choices: question.options ?? [],
			});
			questionIndex += 1;
		}

		const canonicalStatus =
			values.status.trim().length > 0 ? (findCanonicalStatus(values.status, statuses) ?? values.status.trim()) : "";

		return {
			title: values.title.trim(),
			description: values.description,
			status: canonicalStatus,
			priority: values.priority.trim().toLowerCase(),
			assignee: values.assignee,
			labels: values.labels,
			acceptanceCriteria: values.acceptanceCriteria,
			definitionOfDone: values.definitionOfDone,
			implementationPlan: values.implementationPlan,
			implementationNotes: values.implementationNotes,
			references: values.references,
			documentation: values.documentation,
			dependencies: values.dependencies,
		};
	} catch (error) {
		if (error instanceof TaskWizardCancelledError) {
			return null;
		}
		throw error;
	}
}

export async function pickTaskForEditWizard(params: {
	tasks: TaskWizardTaskOption[];
	promptImpl?: TaskWizardPromptRunner;
}): Promise<string | undefined> {
	const prompt = params.promptImpl ?? clackPromptRunner;
	const tasks = [...params.tasks].sort((a, b) => a.id.localeCompare(b.id, undefined, { numeric: true }));
	if (tasks.length === 0) {
		return undefined;
	}

	try {
		const response = await prompt({
			type: "select",
			name: "taskId",
			message: "Select task to edit",
			options: tasks.map((task) => ({
				label: `${task.id} - ${task.title}`,
				value: task.id,
			})),
		});
		const selected = response.taskId;
		return typeof selected === "string" ? selected : undefined;
	} catch (error) {
		if (error instanceof TaskWizardCancelledError) {
			return undefined;
		}
		throw error;
	}
}

function toInitialWizardValues(input: { title?: string } & Partial<Task>): TaskWizardValues {
	return {
		title: input.title ?? "",
		description: input.description ?? "",
		status: input.status ?? "",
		priority: input.priority ?? "",
		assignee: formatListInput(input.assignee),
		labels: formatListInput(input.labels),
		acceptanceCriteria: formatChecklistInput(input.acceptanceCriteriaItems),
		definitionOfDone: formatChecklistInput(input.definitionOfDoneItems),
		implementationPlan: input.implementationPlan ?? "",
		implementationNotes: input.implementationNotes ?? "",
		references: formatListInput(input.references),
		documentation: formatListInput(input.documentation),
		dependencies: formatListInput(input.dependencies),
	};
}

export async function runTaskCreateWizard(
	options: {
		initialTitle?: string;
	} & WizardOptions,
): Promise<TaskCreateInput | null> {
	const initialValues = toInitialWizardValues({ title: options.initialTitle ?? "" });
	const values = await runTaskWizardValues({
		mode: "create",
		statuses: options.statuses,
		initialValues,
		promptImpl: options.promptImpl,
	});
	if (!values) {
		return null;
	}

	const priority = values.priority.trim();
	const parsedPriority = priority.length > 0 ? (priority as WizardPriority) : undefined;
	const assignee = parseListInput(values.assignee);
	const labels = parseListInput(values.labels);
	const references = parseListInput(values.references);
	const documentation = parseListInput(values.documentation);
	const dependencies = normalizeDependencies(parseListInput(values.dependencies));
	const acceptanceCriteria = parseChecklistInput(values.acceptanceCriteria).map((entry) => ({
		text: entry.text,
		checked: false,
	}));
	const definitionOfDoneAdd = parseChecklistInput(values.definitionOfDone).map((entry) => entry.text);

	const input: TaskCreateInput = {
		title: values.title,
		...(values.description.trim().length > 0 && { description: values.description }),
		...(values.status.trim().length > 0 && { status: values.status }),
		...(parsedPriority && { priority: parsedPriority }),
		...(assignee.length > 0 && { assignee }),
		...(labels.length > 0 && { labels }),
		...(dependencies.length > 0 && { dependencies }),
		...(references.length > 0 && { references }),
		...(documentation.length > 0 && { documentation }),
		...(acceptanceCriteria.length > 0 && { acceptanceCriteria }),
		...(definitionOfDoneAdd.length > 0 && { definitionOfDoneAdd }),
		...(values.implementationPlan.trim().length > 0 && { implementationPlan: values.implementationPlan }),
		...(values.implementationNotes.trim().length > 0 && { implementationNotes: values.implementationNotes }),
	};
	return input;
}

export async function runTaskEditWizard(
	options: {
		task: Task;
	} & WizardOptions,
): Promise<TaskUpdateInput | null> {
	const initial = toInitialWizardValues(options.task);
	const values = await runTaskWizardValues({
		mode: "edit",
		statuses: options.statuses,
		initialValues: initial,
		promptImpl: options.promptImpl,
	});
	if (!values) {
		return null;
	}

	const updateInput: TaskUpdateInput = {};
	if (values.title !== initial.title) {
		updateInput.title = values.title;
	}
	if (values.description !== initial.description) {
		updateInput.description = values.description;
	}
	if (values.status !== initial.status && values.status.trim().length > 0) {
		updateInput.status = values.status;
	}
	if (values.priority !== initial.priority && values.priority.trim().length > 0) {
		updateInput.priority = values.priority as WizardPriority;
	}

	const initialAssignee = parseListInput(initial.assignee);
	const nextAssignee = parseListInput(values.assignee);
	if (!areStringArraysEqual(initialAssignee, nextAssignee)) {
		updateInput.assignee = nextAssignee;
	}

	const initialLabels = parseListInput(initial.labels);
	const nextLabels = parseListInput(values.labels);
	if (!areStringArraysEqual(initialLabels, nextLabels)) {
		updateInput.labels = nextLabels;
	}

	const initialDependencies = normalizeDependencies(parseListInput(initial.dependencies));
	const nextDependencies = normalizeDependencies(parseListInput(values.dependencies));
	if (!areStringArraysEqual(initialDependencies, nextDependencies)) {
		updateInput.dependencies = nextDependencies;
	}

	const initialReferences = parseListInput(initial.references);
	const nextReferences = parseListInput(values.references);
	if (!areStringArraysEqual(initialReferences, nextReferences)) {
		updateInput.references = nextReferences;
	}

	const initialDocumentation = parseListInput(initial.documentation);
	const nextDocumentation = parseListInput(values.documentation);
	if (!areStringArraysEqual(initialDocumentation, nextDocumentation)) {
		updateInput.documentation = nextDocumentation;
	}

	if (values.implementationPlan !== initial.implementationPlan) {
		updateInput.implementationPlan = values.implementationPlan;
	}
	if (values.implementationNotes !== initial.implementationNotes) {
		updateInput.implementationNotes = values.implementationNotes;
	}

	const existingCriteria = (options.task.acceptanceCriteriaItems ?? [])
		.slice()
		.sort((a, b) => a.index - b.index)
		.map((entry) => ({ text: entry.text, checked: entry.checked }));
	const targetCriteria = parseChecklistInput(values.acceptanceCriteria);
	if (!areChecklistEntriesEqual(existingCriteria, targetCriteria)) {
		updateInput.acceptanceCriteria = targetCriteria.map((entry) => ({
			text: entry.text,
			checked: entry.checked,
		}));
	}

	const existingDod = (options.task.definitionOfDoneItems ?? [])
		.slice()
		.sort((a, b) => a.index - b.index)
		.map((entry) => ({ text: entry.text, checked: entry.checked }));
	const targetDod = parseChecklistInput(values.definitionOfDone);
	if (!areChecklistEntriesEqual(existingDod, targetDod)) {
		const existingIndices = (options.task.definitionOfDoneItems ?? []).map((entry) => entry.index);
		if (existingIndices.length > 0) {
			updateInput.removeDefinitionOfDone = existingIndices;
		}
		if (targetDod.length > 0) {
			updateInput.addDefinitionOfDone = targetDod.map((entry) => entry.text);
			const checkOffset = existingIndices.length;
			const checkedIndices = targetDod
				.map((entry, index) => ({ checked: entry.checked, index: index + 1 + checkOffset }))
				.filter((entry) => entry.checked)
				.map((entry) => entry.index);
			if (checkedIndices.length > 0) {
				updateInput.checkDefinitionOfDone = checkedIndices;
			}
		}
	}

	return updateInput;
}
