import prompts from "prompts";
import type { BacklogConfig } from "../types/index.ts";
import { isEditorAvailable } from "../utils/editor.ts";

export type PromptRunner = (...args: Parameters<typeof prompts>) => ReturnType<typeof prompts>;

interface WizardOptions {
	existingConfig?: BacklogConfig | null;
	cancelMessage: string;
	includeClaudePrompt?: boolean;
	promptImpl?: PromptRunner;
}

export interface AdvancedConfigWizardResult {
	config: Partial<BacklogConfig>;
	installClaudeAgent: boolean;
}

function handlePromptCancel(message: string) {
	console.log(message);
	process.exit(1);
}

export async function runAdvancedConfigWizard({
	existingConfig,
	cancelMessage,
	includeClaudePrompt = false,
	promptImpl = prompts,
}: WizardOptions): Promise<AdvancedConfigWizardResult> {
	const onCancel = () => handlePromptCancel(cancelMessage);
	const config = existingConfig ?? null;

	let checkActiveBranches = config?.checkActiveBranches ?? true;
	let remoteOperations = config?.remoteOperations ?? true;
	let activeBranchDays = config?.activeBranchDays ?? 30;
	let bypassGitHooks = config?.bypassGitHooks ?? false;
	let autoCommit = config?.autoCommit ?? false;
	let zeroPaddedIds = config?.zeroPaddedIds;
	let defaultEditor = config?.defaultEditor;
	let defaultPort = config?.defaultPort ?? 6420;
	let autoOpenBrowser = config?.autoOpenBrowser ?? true;
	let installClaudeAgent = false;

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
	checkActiveBranches = crossBranchPrompt.checkActiveBranches ?? true;

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
		remoteOperations = remotePrompt.remoteOperations ?? remoteOperations;

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
	bypassGitHooks = gitHooksPrompt.bypassGitHooks ?? bypassGitHooks;

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
	autoCommit = autoCommitPrompt.autoCommit ?? autoCommit;

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

	if (zeroPaddingPrompt.enableZeroPadding) {
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
			{ onCancel },
		);
		if (typeof paddingPrompt?.paddingWidth === "number" && !Number.isNaN(paddingPrompt.paddingWidth)) {
			zeroPaddedIds = paddingPrompt.paddingWidth;
		}
	} else {
		zeroPaddedIds = undefined;
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

	if (webUIPrompt.configureWebUI) {
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
			{ onCancel },
		);
		if (typeof webUIValues?.defaultPort === "number" && !Number.isNaN(webUIValues.defaultPort)) {
			defaultPort = webUIValues.defaultPort;
		}
		autoOpenBrowser = Boolean(webUIValues?.autoOpenBrowser ?? autoOpenBrowser);
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
	};
}
