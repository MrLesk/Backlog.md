import * as clack from "@clack/prompts";
import type { BacklogConfig } from "../types/index.ts";
import { isEditorAvailable, resolveEditor } from "../utils/editor.ts";

interface PromptChoice {
	title: string;
	value: string | number | boolean;
	description?: string;
	disabled?: boolean;
}

interface PromptQuestion {
	type: "confirm" | "number" | "text" | "select" | "multiselect";
	name: string;
	message: string;
	hint?: string;
	initial?: string | number | boolean;
	min?: number;
	max?: number;
	choices?: PromptChoice[];
}

interface PromptOptions {
	onCancel?: () => void;
}

export type PromptRunner = (
	question: PromptQuestion | PromptQuestion[],
	options?: PromptOptions,
) => Promise<Record<string, unknown>>;

interface WizardOptions {
	existingConfig?: BacklogConfig | null;
	cancelMessage: string;
	includeClaudePrompt?: boolean;
	promptImpl?: PromptRunner;
}

export interface AdvancedConfigWizardResult {
	config: Partial<BacklogConfig>;
	installClaudeAgent: boolean;
	installShellCompletions: boolean;
}

function handlePromptCancel(message: string) {
	clack.cancel(message);
	process.exit(1);
}

function withHint(message: string, hint?: string): string {
	return hint ? `${message} (${hint})` : message;
}

async function runSinglePrompt(question: PromptQuestion, options?: PromptOptions): Promise<Record<string, unknown>> {
	const onCancel = options?.onCancel;
	const message = withHint(question.message, question.hint);

	if (question.type === "confirm") {
		const result = await clack.confirm({
			message,
			initialValue: Boolean(question.initial ?? false),
		});
		if (clack.isCancel(result)) {
			onCancel?.();
			return {};
		}
		return { [question.name]: result };
	}

	if (question.type === "text") {
		const initialText = typeof question.initial === "string" ? question.initial : undefined;
		const result = await clack.text({
			message,
			initialValue: initialText,
		});
		if (clack.isCancel(result)) {
			onCancel?.();
			return {};
		}
		const normalized = String(result ?? "").trim();
		return { [question.name]: normalized };
	}

	if (question.type === "number") {
		const initialNumber = typeof question.initial === "number" ? question.initial : undefined;
		const result = await clack.text({
			message,
			initialValue: initialNumber !== undefined ? String(initialNumber) : undefined,
			validate: (value) => {
				const normalized = String(value ?? "").trim();
				if (!normalized) {
					// Allow Enter to keep the existing configured value when an initial value exists.
					if (initialNumber !== undefined) {
						return undefined;
					}
					return "Value is required.";
				}
				const parsed = Number(normalized);
				if (!Number.isFinite(parsed)) {
					return "Please enter a valid number.";
				}
				if (question.min !== undefined && parsed < question.min) {
					return `Value must be at least ${question.min}.`;
				}
				if (question.max !== undefined && parsed > question.max) {
					return `Value must be at most ${question.max}.`;
				}
				return undefined;
			},
		});
		if (clack.isCancel(result)) {
			onCancel?.();
			return {};
		}
		const normalized = String(result ?? "").trim();
		if (!normalized && initialNumber !== undefined) {
			return { [question.name]: initialNumber };
		}
		const parsed = Number(normalized);
		return { [question.name]: Number.isFinite(parsed) ? parsed : undefined };
	}

	if (question.type === "select") {
		const result = await clack.select({
			message,
			initialValue: question.initial,
			options: (question.choices ?? []).map((choice) => ({
				label: choice.title,
				value: choice.value,
				hint: choice.description,
				disabled: choice.disabled,
			})),
		});
		if (clack.isCancel(result)) {
			onCancel?.();
			return {};
		}
		return { [question.name]: result };
	}

	if (question.type === "multiselect") {
		const result = await clack.multiselect({
			message,
			required: false,
			options: (question.choices ?? []).map((choice) => ({
				label: choice.title,
				value: choice.value,
				hint: choice.description,
				disabled: choice.disabled,
			})),
		});
		if (clack.isCancel(result)) {
			onCancel?.();
			return {};
		}
		return { [question.name]: Array.isArray(result) ? result : [] };
	}

	return {};
}

const clackPromptRunner: PromptRunner = async (question, options) => {
	if (Array.isArray(question)) {
		const merged: Record<string, unknown> = {};
		let cancelled = false;
		for (const single of question) {
			const singleResult = await runSinglePrompt(single, {
				onCancel: () => {
					cancelled = true;
					options?.onCancel?.();
				},
			});
			Object.assign(merged, singleResult);
			if (cancelled) {
				break;
			}
		}
		return merged;
	}
	return runSinglePrompt(question, options);
};

export async function runAdvancedConfigWizard({
	existingConfig,
	cancelMessage,
	includeClaudePrompt = false,
	promptImpl = clackPromptRunner,
}: WizardOptions): Promise<AdvancedConfigWizardResult> {
	const onCancel = () => handlePromptCancel(cancelMessage);
	const config = existingConfig ?? null;

	let checkActiveBranches = config?.checkActiveBranches ?? true;
	let remoteOperations = config?.remoteOperations ?? true;
	let activeBranchDays = config?.activeBranchDays ?? 30;
	let bypassGitHooks = config?.bypassGitHooks ?? false;
	let autoCommit = config?.autoCommit ?? false;
	let zeroPaddedIds = config?.zeroPaddedIds;
	let defaultEditor: string | undefined =
		config?.defaultEditor ?? process.env.EDITOR ?? process.env.VISUAL ?? resolveEditor(null);
	let defaultPort = config?.defaultPort ?? 6420;
	let autoOpenBrowser = config?.autoOpenBrowser ?? true;
	let installClaudeAgent = false;
	let installShellCompletions = false;

	const completionPrompt = await promptImpl(
		{
			type: "confirm",
			name: "installCompletions",
			message: "Install shell completions now?",
			hint: "Adds TAB completion support for backlog commands in your shell",
			initial: true,
		},
		{ onCancel },
	);
	installShellCompletions = Boolean(completionPrompt?.installCompletions);

	const crossBranchPrompt = await promptImpl(
		{
			type: "confirm",
			name: "checkActiveBranches",
			message: "Check task states across active branches?",
			hint: "Ensures accurate task tracking across branches (may impact performance on large repos)",
			initial: checkActiveBranches,
		},
		{ onCancel },
	);
	checkActiveBranches = Boolean(crossBranchPrompt.checkActiveBranches ?? true);

	if (checkActiveBranches) {
		const remotePrompt = await promptImpl(
			{
				type: "confirm",
				name: "remoteOperations",
				message: "Check task states in remote branches?",
				hint: "Required for accessing tasks from feature branches on remote repos",
				initial: remoteOperations,
			},
			{ onCancel },
		);
		remoteOperations = Boolean(remotePrompt.remoteOperations ?? remoteOperations);

		const daysPrompt = await promptImpl(
			{
				type: "number",
				name: "activeBranchDays",
				message: "How many days should a branch be considered active?",
				hint: "Lower values improve performance (default: 30 days)",
				initial: activeBranchDays,
				min: 1,
				max: 365,
			},
			{ onCancel },
		);
		if (typeof daysPrompt.activeBranchDays === "number" && !Number.isNaN(daysPrompt.activeBranchDays)) {
			activeBranchDays = daysPrompt.activeBranchDays;
		}
	} else {
		remoteOperations = false;
	}

	const gitHooksPrompt = await promptImpl(
		{
			type: "confirm",
			name: "bypassGitHooks",
			message: "Bypass git hooks when committing?",
			hint: "Use --no-verify flag to skip pre-commit hooks",
			initial: bypassGitHooks,
		},
		{ onCancel },
	);
	bypassGitHooks = Boolean(gitHooksPrompt.bypassGitHooks ?? bypassGitHooks);

	const autoCommitPrompt = await promptImpl(
		{
			type: "confirm",
			name: "autoCommit",
			message: "Enable automatic commits for Backlog operations?",
			hint: "Creates commits automatically after CLI changes",
			initial: autoCommit,
		},
		{ onCancel },
	);
	autoCommit = Boolean(autoCommitPrompt.autoCommit ?? autoCommit);

	while (true) {
		const zeroPaddingPrompt = await promptImpl(
			{
				type: "confirm",
				name: "enableZeroPadding",
				message: "Enable zero-padded IDs for consistent formatting?",
				hint: "Example: task-001, doc-001 instead of task-1, doc-1",
				initial: (zeroPaddedIds ?? 0) > 0,
			},
			{ onCancel },
		);

		const enableZeroPadding = Boolean(zeroPaddingPrompt.enableZeroPadding);
		if (!enableZeroPadding) {
			zeroPaddedIds = undefined;
			break;
		}

		let goBackToZeroPaddingPrompt = false;
		const paddingPrompt = await promptImpl(
			{
				type: "number",
				name: "paddingWidth",
				message: "Number of digits for zero-padding:",
				hint: "e.g., 3 creates task-001; 4 creates task-0001",
				initial: zeroPaddedIds ?? 3,
				min: 1,
				max: 10,
			},
			{
				onCancel: () => {
					goBackToZeroPaddingPrompt = true;
				},
			},
		);

		if (goBackToZeroPaddingPrompt) {
			continue;
		}

		if (typeof paddingPrompt?.paddingWidth === "number" && !Number.isNaN(paddingPrompt.paddingWidth)) {
			zeroPaddedIds = paddingPrompt.paddingWidth;
			break;
		}
	}

	const editorPrompt = await promptImpl(
		{
			type: "text",
			name: "editor",
			message: "Default editor command (leave blank to use system default):",
			hint: "e.g., 'code --wait', 'vim', 'nano'",
			initial: defaultEditor ?? "",
		},
		{ onCancel },
	);

	let editorResult = String(editorPrompt.editor ?? "").trim();
	if (editorResult.length > 0) {
		const isAvailable = await isEditorAvailable(editorResult);
		if (!isAvailable) {
			console.warn(`Warning: Editor command '${editorResult}' not found in PATH`);
			const confirmAnyway = await promptImpl(
				{
					type: "confirm",
					name: "confirm",
					message: "Editor not found. Set it anyway?",
					initial: false,
				},
				{ onCancel },
			);
			if (!confirmAnyway?.confirm) {
				editorResult = "";
			}
		}
	}
	defaultEditor = editorResult.length > 0 ? editorResult : undefined;

	while (true) {
		const webUIPrompt = await promptImpl(
			{
				type: "confirm",
				name: "configureWebUI",
				message: "Configure web UI settings now?",
				hint: "Port and browser auto-open",
				initial: false,
			},
			{ onCancel },
		);

		if (!webUIPrompt.configureWebUI) {
			break;
		}

		let goBackToWebUIPrompt = false;
		const webUIValues = await promptImpl(
			[
				{
					type: "number",
					name: "defaultPort",
					message: "Default web UI port:",
					hint: "Port number for the web interface (1-65535)",
					initial: defaultPort,
					min: 1,
					max: 65535,
				},
				{
					type: "confirm",
					name: "autoOpenBrowser",
					message: "Automatically open browser when starting web UI?",
					hint: "When enabled, 'backlog web' opens your browser",
					initial: autoOpenBrowser,
				},
			],
			{
				onCancel: () => {
					goBackToWebUIPrompt = true;
				},
			},
		);

		if (goBackToWebUIPrompt) {
			continue;
		}

		if (typeof webUIValues?.defaultPort === "number" && !Number.isNaN(webUIValues.defaultPort)) {
			defaultPort = webUIValues.defaultPort;
		}
		autoOpenBrowser = Boolean(webUIValues?.autoOpenBrowser ?? autoOpenBrowser);
		break;
	}

	if (includeClaudePrompt) {
		const claudePrompt = await promptImpl(
			{
				type: "confirm",
				name: "installClaudeAgent",
				message: "Install Claude Code Backlog.md agent?",
				hint: "Adds configuration under .claude/agents/",
				initial: false,
			},
			{ onCancel },
		);
		installClaudeAgent = Boolean(claudePrompt?.installClaudeAgent);
	}

	return {
		config: {
			checkActiveBranches,
			remoteOperations,
			activeBranchDays,
			bypassGitHooks,
			autoCommit,
			zeroPaddedIds,
			defaultEditor,
			defaultPort,
			autoOpenBrowser,
		},
		installClaudeAgent,
		installShellCompletions,
	};
}
