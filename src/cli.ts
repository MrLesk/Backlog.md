#!/usr/bin/env node

import { basename, dirname, isAbsolute, join } from "node:path";
import { stdin as input } from "node:process";
import { createInterface } from "node:readline/promises";
import * as clack from "@clack/prompts";
import { Command, type OptionValues } from "commander";
import { runAdvancedConfigWizard } from "./commands/advanced-config-wizard.ts";
import { type CompletionInstallResult, installCompletion, registerCompletionCommand } from "./commands/completion.ts";
import { configureAdvancedSettings } from "./commands/configure-advanced-settings.ts";
import {
	addHelpSchema,
	choiceType,
	getCliTaskTypeValues,
	priorityType,
	projectType,
	statusType,
	taskType,
} from "./commands/help-schema.ts";
import { registerInstructionsCommand } from "./commands/instructions.ts";
import { registerMcpCommand } from "./commands/mcp.ts";
import { pickTaskForEditWizard, runTaskCreateWizard, runTaskEditWizard } from "./commands/task-wizard.ts";
import { DEFAULT_DIRECTORIES, DEFAULT_FILES, DEFAULT_STATUSES } from "./constants/index.ts";
import { type DuplicateRepairPlan, findLocalDuplicateTaskIds } from "./core/duplicate-task-repair.ts";
import { initializeProject } from "./core/init.ts";
import { buildMilestoneBuckets, collectArchivedMilestoneKeys, milestoneKey } from "./core/milestones.ts";
import { isConfigValueError } from "./file-system/operations.ts";
import { decisionListJson, printJson, searchJson, taskListJson, taskViewJson } from "./formatters/json-output.ts";
import { formatTaskPlainText } from "./formatters/task-plain-text.ts";
import {
	type AgentInstructionFile,
	addAgentInstructions,
	Core,
	type EnsureMcpGuidelinesResult,
	ensureMcpGuidelines,
	exportKanbanBoardToFile,
	initializeGitRepository,
	installClaudeAgent,
	isGitRepository,
	updateReadmeWithBoard,
} from "./index.ts";
import { MilestoneHandlers, type MilestoneRemoveArgs } from "./mcp/tools/milestones/handlers.ts";
import type { CallToolResult } from "./mcp/types.ts";
import {
	type BacklogConfig,
	type Decision,
	type DecisionSearchResult,
	DOCUMENT_TYPE_VALUES,
	type Document as DocType,
	type DocumentSearchResult,
	isLocalEditableTask,
	type Milestone,
	type SearchPriorityFilter,
	type SearchResult,
	type SearchResultType,
	type Task,
	type TaskListFilter,
	type TaskSearchResult,
	type TaskUpdateInput,
} from "./types/index.ts";
import type { TaskEditArgs } from "./types/task-edit-args.ts";
import { formatAcceptanceCriteriaSummarySuffix } from "./ui/acceptance-criteria-progress.ts";
import { genericSelectList } from "./ui/components/generic-list.ts";
import { createLoadingScreen } from "./ui/loading.ts";
import { viewTaskEnhanced } from "./ui/task-viewer-with-search.ts";
import { scrollableViewer } from "./ui/tui.ts";
import { type AgentSelectionValue, processAgentSelection } from "./utils/agent-selection.ts";
import { normalizeProjectBacklogDirectory } from "./utils/backlog-directory.ts";
import { launchBrowser } from "./utils/browser-launch.ts";
import {
	type ContentIdentityReport,
	type DraftIdentityFindings,
	formatDuplicateTaskIdWarning,
	hasContentIdentityIssues,
	hasDraftIdentityFindings,
} from "./utils/duplicate-detection.ts";
import { AmbiguousIdError, isAmbiguousIdError } from "./utils/entity-id.ts";
import { findBacklogRoot } from "./utils/find-backlog-root.ts";
import { generateNextDecisionId } from "./utils/id-generators.ts";
import {
	formatMcpClientSetupCommand,
	getMcpClientSetupCommand,
	isMcpClientSetupKey,
	type McpClientSetupKey,
	runMcpClientSetupCommand,
} from "./utils/mcp-client-setup.ts";
import { resolveMilestoneInputForStorage } from "./utils/milestone-storage.ts";
import {
	DRAFT_PREFIX,
	getTaskPrefixError,
	hasAnyPrefix,
	isReservedTaskPrefix,
	normalizeId,
} from "./utils/prefix-config.ts";
import { formatValidPriorityValues, getPriorityOptions, resolvePriorityValue } from "./utils/priority-config.ts";
import {
	formatValidProjectValues,
	getProjectValues,
	noProjectsConfiguredMessage,
	resolveProjectValues,
} from "./utils/project-config.ts";
import { type ReadOutputMode, resolveReadOutputMode } from "./utils/read-output-mode.ts";
import { getTaskReadiness, loadReadinessGraph } from "./utils/readiness.ts";
import { resolveRuntimeCwd } from "./utils/runtime-cwd.ts";
import { formatValidStatuses, getCanonicalStatus, getCanonicalStatuses, getValidStatuses } from "./utils/status.ts";
import {
	parseClearableStringList,
	parseDelimitedStringList,
	parsePositiveIndexList,
	processAcceptanceCriteriaOptions,
	toStringArray,
} from "./utils/task-builders.ts";
import { buildTaskUpdateInput } from "./utils/task-edit-builder.ts";
import {
	AmbiguousTaskIdError,
	canonicalTaskId,
	isAmbiguousTaskIdError,
	LOCAL_TASK_LOOKUP_HINT,
	taskIdsEqual,
} from "./utils/task-path.ts";
import { sortTasks } from "./utils/task-sorting.ts";
import { formatValidTaskTypeValues, getTaskTypeValues, resolveTaskTypeValues } from "./utils/task-type-config.ts";
import { getTerminalStatus, isTerminalStatus } from "./utils/terminal-status.ts";
import { formatUtcDateForDisplay } from "./utils/utc-date-display.ts";
import { getVersion } from "./utils/version.ts";

type IntegrationMode = "mcp" | "cli" | "none";

const CONFIG_GET_KEYS = [
	"defaultEditor",
	"projectName",
	"defaultAssignee",
	"defaultStatus",
	"statuses",
	"labels",
	"priorities",
	"types",
	"projects",
	"milestones",
	"definitionOfDone",
	"dateFormat",
	"maxColumnWidth",
	"defaultPort",
	"autoOpenBrowser",
	"remoteOperations",
	"autoCommit",
	"filesystemOnly",
	"bypassGitHooks",
	"zeroPaddedIds",
	"checkActiveBranches",
	"activeBranchDays",
] as const;

const CONFIG_SET_KEYS = [
	"defaultEditor",
	"projectName",
	"defaultAssignee",
	"defaultStatus",
	"dateFormat",
	"maxColumnWidth",
	"autoOpenBrowser",
	"defaultPort",
	"remoteOperations",
	"autoCommit",
	"filesystemOnly",
	"bypassGitHooks",
	"zeroPaddedIds",
	"checkActiveBranches",
	"activeBranchDays",
] as const;

function normalizeIntegrationOption(value: string): IntegrationMode | null {
	const normalized = value.trim().toLowerCase();
	if (
		normalized === "mcp" ||
		normalized === "connector" ||
		normalized === "model-context-protocol" ||
		normalized === "model_context_protocol"
	) {
		return "mcp";
	}
	if (
		normalized === "cli" ||
		normalized === "legacy" ||
		normalized === "commands" ||
		normalized === "command" ||
		normalized === "instructions" ||
		normalized === "instruction" ||
		normalized === "agent" ||
		normalized === "agents"
	) {
		return "cli";
	}
	if (
		normalized === "none" ||
		normalized === "skip" ||
		normalized === "manual" ||
		normalized === "later" ||
		normalized === "no" ||
		normalized === "off"
	) {
		return "none";
	}
	return null;
}

// Always use "backlog" as the global MCP server name so fallback mode works when the project isn't initialized.
const MCP_SERVER_NAME = "backlog";

const MCP_CLIENT_INSTRUCTION_MAP: Record<string, AgentInstructionFile> = {
	claude: "CLAUDE.md",
	codex: "AGENTS.md",
	gemini: "GEMINI.md",
	kiro: "AGENTS.md",
	guide: "AGENTS.md",
};

const DOCUMENT_SEARCH_QUERY_MAX_LENGTH = 200;
const DOCUMENT_SEARCH_LIMIT_MAX = 100;
const TASK_SORT_FIELDS = ["priority", "id", "ordinal"];
const TASK_SORT_FIELD_LIST = TASK_SORT_FIELDS.join(", ");
const TASK_TYPE_EXAMPLE = JSON.stringify(getCliTaskTypeValues()[0] ?? "<configured-type>");

async function openUrlInBrowser(url: string): Promise<void> {
	try {
		await launchBrowser(url);
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		console.warn(`  ⚠️  Unable to open browser automatically (${message}). Please visit ${url}`);
	}
}

async function runMcpClientCommand(client: McpClientSetupKey, serverName = MCP_SERVER_NAME): Promise<string> {
	const { label, command, args } = getMcpClientSetupCommand(client, serverName);
	console.log(`    Configuring ${label}...`);
	try {
		await runMcpClientSetupCommand(command, args, { stdout: "inherit", stderr: "inherit" });
		console.log(`    ✓ Added Backlog MCP server to ${label}`);
		return label;
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		console.warn(`    ⚠️ Unable to configure ${label} automatically (${message}).`);
		console.warn(`       Run manually: ${formatMcpClientSetupCommand(command, args)}`);
		return `${label} (manual setup required)`;
	}
}

// Helper function for accumulating multiple CLI option values
function createMultiValueAccumulator() {
	return (value: string, previous: string | string[]) => {
		const soFar = Array.isArray(previous) ? previous : previous ? [previous] : [];
		return [...soFar, value];
	};
}

function printMissingRequiredArgument(argumentName: string): void {
	console.error(`error: missing required argument '${argumentName}'`);
	process.exitCode = 1;
}

/**
 * Reports a command that could not finish. A config value Backlog refuses to read already states
 * the file, the key, and the fix, so it is printed as written instead of behind a stack trace.
 */
function reportCommandFailure(summary: string, error: unknown): void {
	if (isConfigValueError(error)) {
		console.error(error.message);
	} else {
		console.error(summary, error);
	}
	process.exitCode = 1;
}

function parsePositiveIntegerOption(value: unknown, optionName: string, helpCommand?: string): number | null {
	const rawValue = String(value).trim();
	if (!/^[1-9]\d*$/.test(rawValue)) {
		const helpHint = helpCommand ? ` Try '${helpCommand}' for options.` : "";
		console.error(`${optionName} must be a positive integer (1 or greater).${helpHint}`);
		process.exitCode = 1;
		return null;
	}
	return Number.parseInt(rawValue, 10);
}

function formatTaskEditError(error: unknown, taskId: string, commandKind = "task"): string {
	const message = error instanceof Error ? error.message : String(error);
	if (
		message.startsWith("Malformed Acceptance Criteria markers:") ||
		message.startsWith("Malformed Definition of Done markers:")
	) {
		return `${message}\nThe edit was not applied. Run 'backlog ${commandKind} view ${taskId} --plain' to locate the ${commandKind} file, repair or remove the malformed marker block in that Markdown file, then rerun the edit.`;
	}
	if (message.startsWith("Invalid index:")) {
		return `${message} Try 'backlog ${commandKind} edit ${taskId} --help' for index options.`;
	}
	if (
		message.includes(" not found") &&
		(message.startsWith("Acceptance criterion ") || message.startsWith("Definition of Done item "))
	) {
		return `${message}\nRun 'backlog ${commandKind} view ${taskId} --plain' to inspect indexes, or 'backlog ${commandKind} edit ${taskId} --help' for edit options.`;
	}
	return message;
}

function formatPlainTaskListRow(task: Task, options: { includeStatus?: boolean } = {}): string {
	const priorityIndicator = task.priority ? `[${task.priority.toUpperCase()}] ` : "";
	const typeIndicator = task.type ? `[${task.type}] ` : "";
	const statusIndicator = options.includeStatus && task.status ? ` (${task.status})` : "";
	const acceptanceCriteria = formatAcceptanceCriteriaSummarySuffix(task);
	const dueDate = task.dueDate ? ` (due ${formatUtcDateForDisplay(task.dueDate, { appendUtcLabel: true })})` : "";
	return `  ${priorityIndicator}${typeIndicator}${task.id} - ${task.title}${statusIndicator}${acceptanceCriteria}${dueDate}`;
}

async function normalizeCliStatusList(core: Core, values: string[], optionName: string): Promise<string[] | null> {
	const { values: canonicalStatuses, invalid, validStatuses } = await getCanonicalStatuses(values, core);
	if (invalid.length > 0) {
		console.error(
			`Invalid ${optionName}: ${invalid.join(", ")}. Valid statuses are: ${formatValidStatuses(validStatuses)}`,
		);
		process.exitCode = 1;
		return null;
	}
	return canonicalStatuses;
}

async function normalizeCliPriority(core: Core, value: string): Promise<string | null> {
	const config = await core.filesystem.loadConfig();
	const normalized = resolvePriorityValue(value, config);
	if (!normalized) {
		console.error(`Invalid priority: ${value}. Valid values are: ${formatValidPriorityValues(config)}`);
		process.exitCode = 1;
		return null;
	}
	return normalized;
}

async function normalizeCliTaskTypes(core: Core, values: string[], optionName: string): Promise<string[] | null> {
	const config = await core.filesystem.loadConfig();
	const { values: canonicalTypes, invalid } = resolveTaskTypeValues(values, config);
	if (invalid.length > 0) {
		console.error(
			`Invalid ${optionName}: ${invalid.join(", ")}. Valid types are: ${formatValidTaskTypeValues(config)}`,
		);
		process.exitCode = 1;
		return null;
	}
	return canonicalTypes;
}

async function normalizeCliProjects(core: Core, values: string[], optionName: string): Promise<string[] | null> {
	const config = await core.filesystem.loadConfig();
	if (getProjectValues(config).length === 0) {
		console.error(noProjectsConfiguredMessage(core.filesystem.configFilePath));
		process.exitCode = 1;
		return null;
	}
	const { values: canonicalProjects, invalid } = resolveProjectValues(values, config);
	if (invalid.length > 0) {
		console.error(
			`Invalid ${optionName}: ${invalid.join(", ")}. Valid projects are: ${formatValidProjectValues(config)}`,
		);
		process.exitCode = 1;
		return null;
	}
	return canonicalProjects;
}

function formatToolResultText(result: CallToolResult): string {
	return result.content
		.map((item) => (item.type === "text" ? item.text : ""))
		.filter(Boolean)
		.join("\n");
}

function printToolResult(result: CallToolResult): void {
	const text = formatToolResultText(result);
	if (text) {
		console.log(text);
	}
	if (result.isError) {
		process.exitCode = 1;
	}
}

async function printDuplicateIntegrityWarning(core: Core): Promise<boolean> {
	const groups = await findLocalDuplicateTaskIds(core);
	if (groups.length === 0) return false;
	console.error(formatDuplicateTaskIdWarning(groups));
	process.exitCode = 1;
	return true;
}

function printDuplicateRepairPlan(plan: DuplicateRepairPlan): void {
	if (plan.groups.length > 0) {
		console.log(formatDuplicateTaskIdWarning(plan.groups));
		console.log("\nRepair preview (no files changed):");
		for (const change of plan.changes) {
			console.log(`  ${change.sourcePath}`);
			console.log(`    ${change.oldId} -> ${change.newId}`);
			console.log(`    new path: ${change.targetPath}`);
		}
	}
	if (plan.crossBranchFindings.length > 0) {
		console.log("\nPossible cross-branch ID collisions (diagnostic only):");
		for (const finding of plan.crossBranchFindings) {
			console.log(`  ${finding.id}:`);
			for (const location of finding.locations) {
				console.log(`    - ${location.branch}:${location.path} (${location.state})`);
			}
		}
		console.log("Switch to the affected branches and reconcile these paths; Backlog.md will not edit another branch.");
	}
	if (plan.groups.length > 0) {
		if (plan.references.length > 0) {
			console.log("\nReferences requiring human review after repair:");
			for (const reference of plan.references) {
				console.log(`  ${reference.path}:${reference.line} [${reference.ids.join(", ")}]`);
				if (reference.text) console.log(`    ${reference.text}`);
			}
			console.log("These references are not changed automatically because the original ID is ambiguous.");
		}
		if (!plan.referenceScanComplete) {
			console.log("\nReference scan incomplete; repair is blocked. See the failures below.");
		} else if (plan.references.length === 0) {
			console.log("\nNo textual references to the duplicate IDs were found in backlog Markdown files.");
		}
	}
	if (plan.blockedReasons.length > 0) {
		console.log("\nRepair is blocked:");
		for (const reason of plan.blockedReasons) console.log(`  - ${reason}`);
	}
}

function printContentIdentityReport(report: ContentIdentityReport): void {
	const sections = [
		["document", report.documents],
		["decision", report.decisions],
	] as const;
	for (const [label, issues] of sections) {
		if (issues.duplicates.length > 0) {
			console.log(`\nDuplicate ${label} IDs (diagnostic only):`);
			for (const group of issues.duplicates) {
				console.log(`  ${group.id}:`);
				for (const path of group.paths) console.log(`    - ${path}`);
			}
			console.log(`Give each file a unique id; ${label} lookups for these IDs stay blocked until then.`);
		}
		if (issues.missingIds.length > 0) {
			console.log(`\nMalformed ${label} files without an id in frontmatter:`);
			for (const path of issues.missingIds) console.log(`  - ${path}`);
			console.log(`Add an id to each file; these ${label}s cannot be addressed until then.`);
		}
		if (issues.unreadable.length > 0) {
			console.log(`\nUnreadable ${label} files or directories:`);
			for (const path of issues.unreadable) console.log(`  - ${path}`);
			console.log(`Repair the frontmatter or file permissions; identity could not be checked for these ${label}s.`);
		}
	}
}

function printDraftIdentityReport(findings: DraftIdentityFindings): void {
	if (findings.duplicates.length > 0) {
		console.log("\nDuplicate draft IDs (diagnostic only):");
		for (const group of findings.duplicates) {
			console.log(`  ${group.id}:`);
			for (const path of group.paths) console.log(`    - ${path}`);
		}
		console.log("Rename one file to a distinct numeric id, then make its frontmatter agree.");
	}
	if (findings.drifted.length > 0) {
		console.log("\nDrifted draft files (frontmatter id does not match filename):");
		for (const drift of findings.drifted) {
			console.log(
				`  - ${drift.path}: frontmatter declares ${drift.frontmatterId}, filename declares ${drift.filenameId}`,
			);
		}
		console.log("Fix the frontmatter id or rename each file so they agree.");
	}
	if (findings.unreadable.length > 0) {
		console.log("\nUnreadable draft files or directories:");
		for (const path of findings.unreadable) console.log(`  - ${path}`);
		console.log("Repair the YAML/frontmatter or file permissions; identity could not be checked for these drafts.");
	}
}

async function runMilestoneMutation(action: (handlers: MilestoneHandlers) => Promise<CallToolResult>): Promise<void> {
	const cwd = await requireProjectRoot();
	const core = new Core(cwd);
	const handlers = new MilestoneHandlers(core);

	try {
		printToolResult(await action(handlers));
	} catch (error) {
		console.error(error instanceof Error ? error.message : String(error));
		process.exitCode = 1;
	}
}

function parseMilestoneTaskHandling(value: string | undefined): MilestoneRemoveArgs["taskHandling"] | null {
	if (value === undefined) {
		return "clear";
	}
	const normalized = value.trim().toLowerCase();
	if (normalized === "clear" || normalized === "keep" || normalized === "reassign") {
		return normalized;
	}
	return null;
}

function hasCreateFieldFlags(options: Record<string, unknown>): boolean {
	return Boolean(
		options.description !== undefined ||
			options.desc !== undefined ||
			options.assignee !== undefined ||
			options.status !== undefined ||
			options.labels !== undefined ||
			options.priority !== undefined ||
			options.type !== undefined ||
			options.project !== undefined ||
			options.ordinal !== undefined ||
			options.milestone !== undefined ||
			options.dueDate !== undefined ||
			options.plain ||
			options.ac !== undefined ||
			options.acceptanceCriteria !== undefined ||
			options.dod !== undefined ||
			options.dodDefaults === false ||
			options.plan !== undefined ||
			options.notes !== undefined ||
			options.finalSummary !== undefined ||
			options.draft ||
			options.parent !== undefined ||
			options.dependsOn !== undefined ||
			options.dep !== undefined ||
			options.ref !== undefined ||
			options.doc !== undefined ||
			options.modifiedFile !== undefined,
	);
}

function hasEditFieldFlags(options: Record<string, unknown>): boolean {
	return Boolean(
		options.title !== undefined ||
			options.description !== undefined ||
			options.desc !== undefined ||
			options.assignee !== undefined ||
			options.status !== undefined ||
			options.label !== undefined ||
			options.priority !== undefined ||
			options.type !== undefined ||
			options.project !== undefined ||
			options.ordinal !== undefined ||
			options.milestone !== undefined ||
			options.clearMilestone ||
			options.dueDate !== undefined ||
			options.clearDueDate ||
			options.clearLabels ||
			options.plain ||
			options.addLabel !== undefined ||
			options.removeLabel !== undefined ||
			options.ac !== undefined ||
			options.clearAc ||
			options.dod !== undefined ||
			options.removeAc !== undefined ||
			options.removeDod !== undefined ||
			options.checkAc !== undefined ||
			options.checkDod !== undefined ||
			options.uncheckAc !== undefined ||
			options.uncheckDod !== undefined ||
			options.acceptanceCriteria !== undefined ||
			options.plan !== undefined ||
			options.notes !== undefined ||
			options.comment !== undefined ||
			options.commentAuthor !== undefined ||
			options.finalSummary !== undefined ||
			options.appendPlan !== undefined ||
			options.appendNotes !== undefined ||
			options.appendFinalSummary !== undefined ||
			options.clearFinalSummary ||
			options.dependsOn !== undefined ||
			options.dep !== undefined ||
			options.clearDeps ||
			options.ref !== undefined ||
			options.addRef !== undefined ||
			options.removeRef !== undefined ||
			options.clearRefs ||
			options.doc !== undefined ||
			options.clearDocs ||
			options.modifiedFile !== undefined,
	);
}

/**
 * Flags whose value cannot mean the same thing across a batch. A title, a body section, or a
 * 1-based checklist index belongs to one task, so `task edit` rejects them once the user passes
 * more than one task ID rather than writing the same value over every task.
 */
const PER_TASK_ONLY_EDIT_FLAGS: ReadonlyArray<{ option: string; flag: string }> = [
	{ option: "title", flag: "--title" },
	{ option: "description", flag: "--description" },
	{ option: "desc", flag: "--desc" },
	{ option: "plan", flag: "--plan" },
	{ option: "appendPlan", flag: "--append-plan" },
	{ option: "notes", flag: "--notes" },
	{ option: "appendNotes", flag: "--append-notes" },
	{ option: "finalSummary", flag: "--final-summary" },
	{ option: "appendFinalSummary", flag: "--append-final-summary" },
	{ option: "comment", flag: "--comment" },
	{ option: "commentAuthor", flag: "--comment-author" },
	{ option: "ordinal", flag: "--ordinal" },
	{ option: "modifiedFile", flag: "--modified-file" },
	{ option: "removeAc", flag: "--remove-ac" },
	{ option: "checkAc", flag: "--check-ac" },
	{ option: "uncheckAc", flag: "--uncheck-ac" },
	{ option: "removeDod", flag: "--remove-dod" },
	{ option: "checkDod", flag: "--check-dod" },
	{ option: "uncheckDod", flag: "--uncheck-dod" },
];

function findPerTaskOnlyFlag(options: Record<string, unknown>): string | null {
	for (const { option, flag } of PER_TASK_ONLY_EDIT_FLAGS) {
		if (options[option] !== undefined) {
			return `Cannot use ${flag} with more than one task ID. ${flag} applies to one task only. Run backlog task edit once per task.`;
		}
	}
	return null;
}

/**
 * Validate a clearable list option pair such as --ref/--clear-refs.
 * Returns an error message when the clear flag conflicts with a setter or a setter value is blank.
 * Omit `clearFlag` on surfaces without a clear flag (task create) so the guidance stays accurate.
 *
 * Set `emptyClears` where an explicit empty value is a second spelling of the clear flag, as it is for
 * `-a ""`. A blank value is then not a setter value at all: it cannot conflict with the clear flag and
 * needs no rejecting. Task create leaves it off because there is nothing to clear on a new task, and so
 * do the incremental --add-ref/--remove-ref flags, which have no list to replace.
 */
function validateClearableListInput(input: {
	rawValues: string[];
	cleared?: boolean;
	isBlank: (value: string) => boolean;
	setterFlags: string;
	clearFlag?: string;
	subject: string;
	emptyClears?: boolean;
}): string | undefined {
	const settingValues = input.emptyClears ? input.rawValues.filter((value) => !input.isBlank(value)) : input.rawValues;
	if (input.clearFlag && input.cleared && settingValues.length > 0) {
		return `Cannot combine ${input.clearFlag} with ${input.setterFlags}. Use ${input.clearFlag} by itself.`;
	}
	if (!input.emptyClears && input.rawValues.some(input.isBlank)) {
		const guidance = input.clearFlag
			? `Use ${input.clearFlag} to remove all ${input.subject}.`
			: `Omit the flag to leave ${input.subject} unset.`;
		return `Cannot use an empty value with ${input.setterFlags}. ${guidance}`;
	}
	return undefined;
}

/**
 * Resolve a --parent argument to the single task it names, before any child task is read.
 *
 * This is the same working-copy lookup that `task view` and `task create --parent` use, so one ID
 * cannot name a filterable parent for one command and a missing task for another. Identity fails
 * closed exactly as it does for a targeted task ID: a value matching several files must not silently
 * filter on whichever one came first. Returns the resolved canonical ID so filtering never runs on
 * the raw input.
 */
async function resolveParentFilterId(core: Core, parentId: string, parentDisplayId: string): Promise<string> {
	let parent: Task | null;
	try {
		parent = await core.loadTaskById(parentId, { includeCrossBranch: false });
	} catch (error) {
		// Report the collision under the configured prefix, which a bare numeric argument lacks.
		if (isAmbiguousTaskIdError(error)) throw new AmbiguousTaskIdError(parentDisplayId, error.candidates);
		throw error;
	}
	if (!parent) {
		throw new Error(`Parent task ${parentDisplayId} not found. ${LOCAL_TASK_LOOKUP_HINT}`);
	}
	return parent.id;
}

/**
 * Validate the dependency, reference, and documentation list flags shared by task create and task edit.
 * `supportsClearFlags` is false for task create, which has no --clear-deps/--clear-refs/--clear-docs flags
 * and where an empty value therefore stays an error rather than clearing a list that does not exist yet.
 */
function validateTaskListFlags(
	options: Record<string, unknown>,
	{ supportsClearFlags }: { supportsClearFlags: boolean },
): string | undefined {
	const isBlankListValue = (value: string) => parseDelimitedStringList(value) === undefined;
	const clearFlag = (flag: string) => (supportsClearFlags ? flag : undefined);
	return (
		validateClearableListInput({
			rawValues: [...toStringArray(options.dependsOn), ...toStringArray(options.dep)],
			cleared: Boolean(options.clearDeps),
			isBlank: isBlankListValue,
			setterFlags: "--depends-on or --dep",
			clearFlag: clearFlag("--clear-deps"),
			subject: "task dependencies",
			emptyClears: supportsClearFlags,
		}) ??
		validateClearableListInput({
			rawValues: toStringArray(options.ref),
			cleared: Boolean(options.clearRefs),
			isBlank: isBlankListValue,
			setterFlags: "--ref",
			clearFlag: clearFlag("--clear-refs"),
			subject: "references",
			emptyClears: supportsClearFlags,
		}) ??
		validateClearableListInput({
			rawValues: toStringArray(options.addRef),
			cleared: Boolean(options.clearRefs),
			isBlank: isBlankListValue,
			setterFlags: "--add-ref",
			clearFlag: clearFlag("--clear-refs"),
			subject: "references",
		}) ??
		validateClearableListInput({
			rawValues: toStringArray(options.removeRef),
			cleared: Boolean(options.clearRefs),
			isBlank: isBlankListValue,
			setterFlags: "--remove-ref",
			clearFlag: clearFlag("--clear-refs"),
			subject: "references",
		}) ??
		validateClearableListInput({
			rawValues: toStringArray(options.doc),
			cleared: Boolean(options.clearDocs),
			isBlank: isBlankListValue,
			setterFlags: "--doc",
			clearFlag: clearFlag("--clear-docs"),
			subject: "documentation",
			emptyClears: supportsClearFlags,
		})
	);
}

async function resolveCliMilestoneInput(core: Core, milestone: string): Promise<string> {
	const [activeMilestones, archivedMilestones] = await Promise.all([
		core.filesystem.listMilestones(),
		core.filesystem.listArchivedMilestones(),
	]);
	return resolveMilestoneInputForStorage(milestone, activeMilestones, archivedMilestones);
}

// Helper function to process multiple AC operations
/**
 * Processes --ac and --acceptance-criteria options to extract acceptance criteria
 * Handles both single values and arrays from multi-value accumulators
 */
function getDefaultAdvancedConfig(existingConfig?: BacklogConfig | null): Partial<BacklogConfig> {
	return {
		checkActiveBranches: existingConfig?.checkActiveBranches ?? true,
		remoteOperations: existingConfig?.remoteOperations ?? true,
		activeBranchDays: existingConfig?.activeBranchDays ?? 30,
		bypassGitHooks: existingConfig?.bypassGitHooks ?? false,
		autoCommit: existingConfig?.autoCommit ?? false,
		zeroPaddedIds: existingConfig?.zeroPaddedIds,
		defaultEditor: existingConfig?.defaultEditor,
		definitionOfDone: existingConfig?.definitionOfDone ? [...existingConfig.definitionOfDone] : undefined,
		defaultPort: existingConfig?.defaultPort ?? 6420,
		autoOpenBrowser: existingConfig?.autoOpenBrowser ?? true,
	};
}

/**
 * Resolves the working directory commands operate on, honouring --cwd and BACKLOG_CWD.
 * Exits with the resolution error message when the override points at an invalid directory.
 */
async function requireRuntimeCwd(): Promise<string> {
	try {
		const runtimeCwd = await resolveRuntimeCwd();
		return runtimeCwd.cwd;
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		console.error(message);
		process.exit(1);
	}
}

/**
 * Resolves the Backlog.md project root from the current working directory.
 * Walks up the directory tree to find backlog/ or backlog.json, with git root fallback.
 * Exits with error message if no Backlog.md project is found.
 */
async function requireProjectRoot(): Promise<string> {
	const root = await findBacklogRoot(await requireRuntimeCwd());
	if (!root) {
		console.error("No Backlog.md project found. Run `backlog init` to initialize.");
		process.exit(1);
	}
	return root;
}

// Windows color fix
if (process.platform === "win32") {
	const term = process.env.TERM;
	if (!term || /^(xterm|dumb|ansi|vt100)$/i.test(term)) {
		process.env.TERM = "xterm-256color";
	}
}

// Auto-plain fallback for commands that otherwise launch interactive UIs.
// Require both stdin and stdout to be TTY before attempting an interactive experience.
const hasInteractiveTTY = Boolean(process.stdout.isTTY && process.stdin.isTTY);
const shouldAutoPlain = !hasInteractiveTTY;
const plainFlagInArgv = process.argv.includes("--plain");

function isPlainRequested(options?: { plain?: boolean }): boolean {
	return Boolean(options?.plain || plainFlagInArgv);
}

function getReadOutputMode(options: { json?: boolean; plain?: boolean }): ReadOutputMode | null {
	try {
		return resolveReadOutputMode(options, hasInteractiveTTY);
	} catch (error) {
		console.error(error instanceof Error ? error.message : String(error));
		process.exitCode = 1;
		return null;
	}
}

// Temporarily isolate BUN_OPTIONS during CLI parsing to prevent conflicts
// Save the original value so it's available for subsequent commands
const originalBunOptions = process.env.BUN_OPTIONS;
if (process.env.BUN_OPTIONS) {
	delete process.env.BUN_OPTIONS;
}

// Get version from package.json
const version = await getVersion();

// Bare-run entry handling (before Commander parses commands)
// Show a plain local help entry when invoked without subcommands, unless help/version requested.
try {
	let rawArgs = process.argv.slice(2);
	// Some package managers (e.g., Bun global shims) may inject the resolved
	// CLI executable path as the first non-node argument. Strip it if detected.
	if (rawArgs.length > 0) {
		const first = rawArgs[0];
		if (
			typeof first === "string" &&
			/node_modules[\\/]+backlog\.md-(darwin|linux|windows)-[^\\/]+[\\/]+backlog(\.exe)?$/.test(first)
		) {
			rawArgs = rawArgs.slice(1);
		}
	}
	const wantsHelp = rawArgs.includes("-h") || rawArgs.includes("--help");
	const wantsVersion = rawArgs.includes("-v") || rawArgs.includes("--version");
	const isBareRoot = rawArgs.length === 0 || (rawArgs.length === 1 && rawArgs[0] === "--plain");
	if (isBareRoot && !wantsHelp && !wantsVersion) {
		let initialized = false;
		try {
			const runtimeCwd = await resolveRuntimeCwd();
			const projectRoot = await findBacklogRoot(runtimeCwd.cwd);
			if (projectRoot) {
				const core = new Core(projectRoot);
				const cfg = await core.filesystem.loadConfig();
				initialized = !!cfg;
			}
		} catch (error) {
			// An initialized project whose config Backlog refuses to read must not be presented as an
			// uninitialized directory: report the value and stop, as every other entry point does.
			if (isConfigValueError(error)) {
				console.error(error.message);
				process.exit(1);
			}
			initialized = false;
		}

		const { printRootEntry } = await import("./ui/root-entry.ts");
		await printRootEntry({
			version,
			initialized,
			...(rawArgs.includes("--plain") ? { color: false } : {}),
		});
		// Ensure we don't enter Commander command parsing
		process.exit(0);
	}
} catch {
	// Fall through to normal CLI parsing on any root entry error.
}

function getMcpStartCwdOverrideFromArgv(argv = process.argv): string | undefined {
	const args = argv.slice(2);
	const mcpIndex = args.indexOf("mcp");
	if (mcpIndex < 0 || args[mcpIndex + 1] !== "start") {
		return undefined;
	}

	for (let i = mcpIndex + 2; i < args.length; i++) {
		const arg = args[i];
		if (!arg) {
			continue;
		}
		if (arg === "--cwd") {
			const next = args[i + 1]?.trim();
			return next || undefined;
		}
		if (arg?.startsWith("--cwd=")) {
			const value = arg.slice("--cwd=".length).trim();
			return value || undefined;
		}
	}

	return undefined;
}

// Global config migration - run before any command processing
// Only run if we're in a backlog project (skip for init, help, version)
const shouldRunMigration =
	!process.argv.includes("init") &&
	!process.argv.includes("--help") &&
	!process.argv.includes("-h") &&
	!process.argv.includes("--version") &&
	!process.argv.includes("-v") &&
	process.argv.length > 2; // Ensure we have actual commands

if (shouldRunMigration) {
	try {
		const runtimeCwd = await resolveRuntimeCwd({ cwd: getMcpStartCwdOverrideFromArgv() });
		const projectRoot = await findBacklogRoot(runtimeCwd.cwd);
		if (projectRoot) {
			const core = new Core(projectRoot);

			// Only migrate if config already exists (project is already initialized)
			const config = await core.filesystem.loadConfig();
			if (config) {
				await core.ensureConfigMigrated();
			}
		}
	} catch (_error) {
		// Silently ignore migration errors - project might not be initialized yet
	}
}

const program = new Command();
program
	.name("backlog")
	.description("Backlog.md - Project management CLI")
	.version(version, "-v, --version", "display version number")
	.showSuggestionAfterError()
	.showHelpAfterError("Run with --help to see accepted fields and examples.");

addHelpSchema(program.command("init [projectName]"), {
	required: [],
	optional: [
		{ name: "projectName", type: "String", description: "Project name; defaults to current directory name" },
		{
			name: "--integration-mode",
			type: `${choiceType(["cli", "mcp", "none"])} (default: cli)`,
			description: "AI integration mode; CLI instructions are recommended",
		},
		{
			name: "--agent-instructions",
			type: choiceType(["claude", "agents", "gemini", "copilot", "cursor", "none"], { multiple: true }),
			description: "Instruction files to create; cursor writes AGENTS.md; comma-separated",
		},
		{ name: "--backlog-dir", type: "Project-relative path", description: "backlog, .backlog, or custom path" },
		{
			name: "--task-prefix",
			type: "String (letters only; default: task)",
			description: "Task ID prefix; draft, doc, and decision are reserved",
		},
		{ name: "--no-git", type: "Boolean", description: "Initialize without Git integration" },
	],
	writes: "Backlog directory, config file, optional agent instruction files, and optional git commit",
	output: "Initialization summary with selected integration and config; defaults to CLI instructions",
	examples: [
		'backlog init "My Project" --defaults',
		'backlog init "My Project" --defaults --integration-mode cli',
		'backlog init "My Project" --defaults --agent-instructions agents,claude',
	],
})
	.description("initialize backlog project in the current directory (or BACKLOG_CWD when set)")
	.option(
		"--agent-instructions <instructions>",
		"comma-separated agent instructions to create. Valid: claude, agents, gemini, copilot, cursor (writes AGENTS.md), none. Use 'none' to skip; when combined with others, 'none' is ignored.",
	)
	.option("--check-branches <boolean>", "check task states across active branches (default: true)")
	.option("--include-remote <boolean>", "include remote branches when checking (default: true)")
	.option("--branch-days <number>", "days to consider branch active (default: 30)")
	.option("--bypass-git-hooks <boolean>", "bypass git hooks when committing (default: false)")
	.option("--zero-padded-ids <number>", "number of digits for zero-padding IDs (0 to disable)")
	.option("--default-editor <editor>", "default editor command")
	.option("--web-port <number>", "default web UI port (default: 6420)")
	.option("--auto-open-browser <boolean>", "auto-open browser for web UI (default: true)")
	.option("--install-claude-agent <boolean>", "install Claude Code agent (default: false)")
	.option(
		"--integration-mode <mode>",
		"choose AI integration mode: cli, mcp, or none (default: cli; cli instructions are recommended)",
	)
	.option("--backlog-dir <path>", "backlog folder for init: backlog, .backlog, or a custom project-relative path")
	.option("--config-location <location>", "config location for init: folder or root")
	.option(
		"--task-prefix <prefix>",
		"custom task prefix, letters only (default: task); draft, doc, and decision are reserved",
	)
	.option("--no-git", "initialize without Git integration")
	.option("--defaults", "use default values for all prompts")
	.action(
		async (
			projectName: string | undefined,
			options: {
				agentInstructions?: string;
				checkBranches?: string;
				includeRemote?: string;
				branchDays?: string;
				bypassGitHooks?: string;
				zeroPaddedIds?: string;
				defaultEditor?: string;
				webPort?: string;
				autoOpenBrowser?: string;
				installClaudeAgent?: string;
				integrationMode?: string;
				backlogDir?: string;
				configLocation?: string;
				taskPrefix?: string;
				git?: boolean;
				defaults?: boolean;
			},
		) => {
			try {
				// init targets the same directory every other command resolves (--cwd/BACKLOG_CWD, else process.cwd()).
				const cwd = await requireRuntimeCwd();
				const isRepo = await isGitRepository(cwd);
				let filesystemOnly = options.git === false;

				if (!isRepo && !filesystemOnly) {
					const repositoryMode = await clack.select({
						message: "No git repository found. How should Backlog.md initialize this project?",
						initialValue: "git",
						options: [
							{
								label: "Initialize a Git repository",
								value: "git",
								hint: "Use the standard Git-backed workflow",
							},
							{
								label: "Continue without Git",
								value: "filesystem",
								hint: "Use local Markdown files only",
							},
						],
					});
					if (clack.isCancel(repositoryMode)) {
						abortInitialization();
						return;
					}

					if (repositoryMode === "git") {
						await initializeGitRepository(cwd);
					} else {
						filesystemOnly = true;
					}
				}

				const core = new Core(cwd);

				// Check if project is already initialized and load existing config
				const existingConfig = await core.filesystem.loadConfig();
				const isReInitialization = !!existingConfig;

				if (isReInitialization) {
					console.log(
						"Existing backlog project detected. Current configuration will be preserved where not specified.",
					);
					if (options.backlogDir) {
						console.error(
							"The backlog directory is fixed after initialization. Re-run init without --backlog-dir for this project.",
						);
						process.exit(1);
					}
					if (options.configLocation) {
						console.error(
							"The config location is fixed after initialization. Re-run init without --config-location for this project.",
						);
						process.exit(1);
					}
				}

				// Helper function to parse boolean strings
				const parseBoolean = (value: string | undefined, defaultValue: boolean): boolean => {
					if (value === undefined) return defaultValue;
					return value.toLowerCase() === "true" || value === "1";
				};

				// Helper function to parse number strings
				const parseNumber = (value: string | undefined, defaultValue: number): number => {
					if (value === undefined) return defaultValue;
					const parsed = Number.parseInt(value, 10);
					return Number.isNaN(parsed) ? defaultValue : parsed;
				};
				function abortInitialization(message = "Aborting initialization.") {
					clack.cancel(message);
					process.exitCode = 1;
				}
				function cancelInitialization(message = "Initialization cancelled.") {
					clack.cancel(message);
				}

				// Non-interactive mode when any flag is provided or --defaults is used
				const isNonInteractive = !!(
					options.agentInstructions ||
					options.defaults ||
					options.checkBranches ||
					options.includeRemote ||
					options.branchDays ||
					options.bypassGitHooks ||
					options.zeroPaddedIds ||
					options.defaultEditor !== undefined ||
					options.webPort ||
					options.autoOpenBrowser ||
					options.installClaudeAgent ||
					options.integrationMode ||
					options.backlogDir ||
					options.configLocation ||
					options.taskPrefix ||
					options.git === false
				);

				// Get project name
				let name = projectName;
				if (!name) {
					const defaultName = existingConfig?.projectName || "";
					const promptMessage = isReInitialization && defaultName ? `Project name (${defaultName}):` : "Project name:";
					const enteredName = await clack.text({
						message: promptMessage,
						defaultValue: isReInitialization && defaultName ? defaultName : undefined,
						validate: (value) => {
							if (!isReInitialization || !defaultName) {
								if (!String(value ?? "").trim()) {
									return "Project name is required.";
								}
							}
							return undefined;
						},
					});
					if (clack.isCancel(enteredName)) {
						abortInitialization();
						return;
					}
					name = String(enteredName ?? "").trim();
					// Use existing name if nothing entered during re-init
					if (!name && isReInitialization && defaultName) {
						name = defaultName;
					}
					if (!name) {
						abortInitialization();
						return;
					}
				}

				let backlogDirectory: string | undefined;
				let backlogDirectorySource: "backlog" | ".backlog" | "custom" | undefined;
				let configLocation: "folder" | "root" | undefined;
				if (!isReInitialization) {
					const backlogResolution = core.filesystem.resolveBacklogDirectoryInfo();
					const defaultBacklogDirectory = backlogResolution.backlogDir ?? DEFAULT_DIRECTORIES.BACKLOG;
					const defaultBacklogSource = backlogResolution.source ?? "backlog";
					const defaultConfigLocation = backlogResolution.configSource ?? "folder";
					const normalizedBacklogDirOption = options.backlogDir
						? normalizeProjectBacklogDirectory(options.backlogDir)
						: undefined;
					const normalizedConfigLocation = options.configLocation?.trim().toLowerCase();
					if (options.backlogDir && !normalizedBacklogDirOption) {
						console.error(
							"Invalid --backlog-dir value. Use 'backlog', '.backlog', or a project-relative path inside the project.",
						);
						process.exit(1);
					}
					if (
						normalizedConfigLocation &&
						normalizedConfigLocation !== "folder" &&
						normalizedConfigLocation !== "root"
					) {
						console.error("Invalid --config-location value. Use 'folder' or 'root'.");
						process.exit(1);
					}

					if (isNonInteractive) {
						if (normalizedBacklogDirOption) {
							backlogDirectory = normalizedBacklogDirOption;
							backlogDirectorySource =
								normalizedBacklogDirOption === DEFAULT_DIRECTORIES.BACKLOG ||
								normalizedBacklogDirOption === DEFAULT_DIRECTORIES.HIDDEN_BACKLOG
									? (normalizedBacklogDirOption as "backlog" | ".backlog")
									: "custom";
						} else {
							backlogDirectory = defaultBacklogDirectory;
							backlogDirectorySource = defaultBacklogSource;
						}
						configLocation =
							(normalizedConfigLocation as "folder" | "root" | undefined) ??
							(backlogDirectorySource === "custom" ? "root" : defaultConfigLocation);
						if (backlogDirectorySource === "custom" && configLocation !== "root") {
							console.error("Custom backlog directories require --config-location root.");
							process.exit(1);
						}
					} else {
						const locationPrompt = await clack.select({
							message: "Where should Backlog.md store project files?",
							initialValue: defaultBacklogSource,
							options: [
								{
									label: "backlog/ (default)",
									value: "backlog",
									hint: "Store tasks and config in backlog/",
								},
								{
									label: ".backlog/",
									value: ".backlog",
									hint: "Store tasks and config in .backlog/",
								},
								{
									label: "Custom project-relative path",
									value: "custom",
									hint: `Backlog.md will store project config in ${backlogResolution.rootConfigPath}`,
								},
							],
						});
						if (clack.isCancel(locationPrompt)) {
							abortInitialization();
							return;
						}

						backlogDirectorySource = locationPrompt as "backlog" | ".backlog" | "custom";
						if (backlogDirectorySource === "custom") {
							const customDirectory = await clack.text({
								message: "Project-relative backlog directory:",
								defaultValue:
									defaultBacklogSource === "custom" && defaultBacklogDirectory ? defaultBacklogDirectory : "",
								validate: (value) => {
									const normalized = normalizeProjectBacklogDirectory(String(value ?? ""));
									if (!normalized) {
										return "Enter a project-relative path inside the current project.";
									}
									return undefined;
								},
							});
							if (clack.isCancel(customDirectory)) {
								abortInitialization();
								return;
							}
							backlogDirectory = normalizeProjectBacklogDirectory(String(customDirectory ?? "")) ?? undefined;
							configLocation = "root";
						} else {
							backlogDirectory = backlogDirectorySource;
							const configPrompt = await clack.select({
								message: "Where should Backlog.md store project configuration?",
								initialValue: defaultConfigLocation,
								options: [
									{
										label: `${backlogDirectorySource}/config.yml`,
										value: "folder",
										hint: "Keep config inside the backlog folder",
									},
									{
										label: "backlog.config.yml in project root",
										value: "root",
										hint: "Keep config at project root and point to the backlog folder there",
									},
								],
							});
							if (clack.isCancel(configPrompt)) {
								abortInitialization();
								return;
							}
							configLocation = configPrompt as "folder" | "root";
						}
					}
				}

				// Get task prefix (first-time init only, preserved on re-init)
				let taskPrefix = options.taskPrefix;
				if (!taskPrefix && !isNonInteractive && !isReInitialization) {
					const enteredPrefix = await clack.text({
						message: "Task prefix (default: task):",
						// The prompt trims what it accepts below, so judge the trimmed value here too.
						validate: (value) => getTaskPrefixError(String(value ?? "").trim()),
					});
					if (clack.isCancel(enteredPrefix)) {
						abortInitialization();
						return;
					}
					taskPrefix = String(enteredPrefix ?? "").trim();
				}
				const taskPrefixError = getTaskPrefixError(taskPrefix ?? "");
				if (taskPrefixError) {
					console.error(taskPrefixError);
					process.exit(1);
				}

				const defaultAdvancedConfig = getDefaultAdvancedConfig(existingConfig);
				const applyAdvancedOptionOverrides = () => {
					const result: Partial<BacklogConfig> = { ...defaultAdvancedConfig };
					result.checkActiveBranches = parseBoolean(options.checkBranches, result.checkActiveBranches ?? true);
					if (result.checkActiveBranches) {
						result.remoteOperations = parseBoolean(options.includeRemote, result.remoteOperations ?? true);
						result.activeBranchDays = parseNumber(options.branchDays, result.activeBranchDays ?? 30);
					} else {
						result.remoteOperations = false;
					}
					result.bypassGitHooks = parseBoolean(options.bypassGitHooks, result.bypassGitHooks ?? false);
					const paddingValue = parseNumber(options.zeroPaddedIds, result.zeroPaddedIds ?? 0);
					result.zeroPaddedIds = paddingValue > 0 ? paddingValue : undefined;
					result.defaultEditor =
						options.defaultEditor ??
						(existingConfig?.defaultEditor || process.env.EDITOR || process.env.VISUAL || undefined);
					result.defaultPort = parseNumber(options.webPort, result.defaultPort ?? 6420);
					result.autoOpenBrowser = parseBoolean(options.autoOpenBrowser, result.autoOpenBrowser ?? true);
					return result;
				};

				const integrationOption = options.integrationMode
					? normalizeIntegrationOption(options.integrationMode)
					: undefined;
				if (options.integrationMode && !integrationOption) {
					console.error(`Invalid integration mode: ${options.integrationMode}. Valid options are: mcp, cli, none`);
					process.exit(1);
				}

				let integrationMode: IntegrationMode | null = integrationOption ?? (isNonInteractive ? "cli" : null);
				const mcpServerName = MCP_SERVER_NAME;
				type AgentSelection = AgentSelectionValue;
				let agentFiles: AgentInstructionFile[] = [];
				let agentInstructionsSkipped = false;
				let mcpClientSetupSummary: string | undefined;
				const mcpGuideUrl = "https://github.com/MrLesk/Backlog.md#-mcp-integration-model-context-protocol";

				if (
					!integrationOption &&
					integrationMode === "mcp" &&
					(options.agentInstructions || options.installClaudeAgent)
				) {
					integrationMode = "cli";
				}

				if (integrationMode === "mcp" && (options.agentInstructions || options.installClaudeAgent)) {
					console.error(
						"The MCP connector option cannot be combined with --agent-instructions or --install-claude-agent.",
					);
					process.exit(1);
				}

				if (integrationMode === "none" && (options.agentInstructions || options.installClaudeAgent)) {
					console.error(
						"Skipping AI integration cannot be combined with --agent-instructions or --install-claude-agent.",
					);
					process.exit(1);
				}

				let integrationTipShown = false;
				mainSelection: while (true) {
					if (integrationMode === null) {
						if (!integrationTipShown) {
							clack.note("CLI instructions are recommended for AI tool integration.", "AI setup tip");
							integrationTipShown = true;
						}
						const integrationPrompt = await clack.select({
							message: "How would you like your AI tools to connect to Backlog.md?",
							initialValue: "cli",
							options: [
								{
									label: "via CLI instructions (recommended)",
									value: "cli",
								},
								{
									label: "via MCP connector (optional for Claude Code, Codex, Gemini CLI, Kiro, Cursor, etc.)",
									value: "mcp",
								},
								{
									label: "Skip for now (I am not using Backlog.md with AI tools)",
									value: "none",
								},
							],
						});

						if (clack.isCancel(integrationPrompt)) {
							cancelInitialization();
							return;
						}

						const selectedMode = integrationPrompt ? normalizeIntegrationOption(String(integrationPrompt)) : null;
						integrationMode = selectedMode ?? "mcp";
						console.log("");
					}

					if (integrationMode === "cli") {
						if (options.agentInstructions) {
							const nameMap: Record<string, AgentSelection> = {
								cursor: "AGENTS.md",
								claude: "CLAUDE.md",
								agents: "AGENTS.md",
								gemini: "GEMINI.md",
								copilot: ".github/copilot-instructions.md",
								none: "none",
								"CLAUDE.md": "CLAUDE.md",
								"AGENTS.md": "AGENTS.md",
								"GEMINI.md": "GEMINI.md",
								".github/copilot-instructions.md": ".github/copilot-instructions.md",
							};

							const requestedInstructions = options.agentInstructions.split(",").map((f) => f.trim().toLowerCase());
							const mappedFiles: AgentSelection[] = [];

							for (const instruction of requestedInstructions) {
								const mappedFile = nameMap[instruction];
								if (!mappedFile) {
									console.error(`Invalid agent instruction: ${instruction}`);
									console.error("Valid options are: cursor, claude, agents, gemini, copilot, none");
									process.exit(1);
								}
								mappedFiles.push(mappedFile);
							}

							const { files, needsRetry, skipped } = processAgentSelection({ selected: mappedFiles });
							if (needsRetry) {
								console.error("Please select at least one agent instruction file before continuing.");
								process.exit(1);
							}
							agentFiles = files;
							agentInstructionsSkipped = skipped;
						} else if (isNonInteractive) {
							agentFiles = ["AGENTS.md"];
						} else {
							while (true) {
								const response = await clack.multiselect({
									message: "Select instruction files for CLI-based AI tools (space toggles selections; enter accepts)",
									options: [
										{ label: "CLAUDE.md — Claude Code", value: "CLAUDE.md" },
										{
											label: "AGENTS.md — Codex, Cursor, Zed, Warp, Aider, RooCode, etc.",
											value: "AGENTS.md",
										},
										{ label: "GEMINI.md — Google Gemini Code Assist CLI", value: "GEMINI.md" },
										{
											label: "Copilot instructions — GitHub Copilot",
											value: ".github/copilot-instructions.md",
										},
									],
									required: false,
								});

								if (clack.isCancel(response)) {
									integrationMode = null;
									console.log("");
									continue mainSelection;
								}

								const selected = Array.isArray(response) ? (response as AgentSelection[]) : [];
								const { files, needsRetry, skipped } = processAgentSelection({ selected });
								if (needsRetry) {
									console.log("Please select at least one agent instruction file before continuing.");
									continue;
								}
								agentFiles = files;
								agentInstructionsSkipped = skipped;
								break;
							}
						}

						break;
					}

					if (integrationMode === "mcp") {
						if (isNonInteractive) {
							mcpClientSetupSummary = "skipped (non-interactive)";
							break;
						}

						console.log(`  MCP server name: ${mcpServerName}`);
						while (true) {
							const clientResponse = await clack.multiselect({
								message: "Which AI tools should we configure right now? (space toggles items; enter confirms)",
								options: [
									{ label: "Claude Code", value: "claude" },
									{ label: "OpenAI Codex", value: "codex" },
									{ label: "Gemini CLI", value: "gemini" },
									{ label: "Kiro", value: "kiro" },
									{ label: "Other (open setup guide)", value: "guide" },
								],
								required: true,
							});

							if (clack.isCancel(clientResponse)) {
								integrationMode = null;
								console.log("");
								continue mainSelection;
							}

							const selectedClients = Array.isArray(clientResponse) ? clientResponse : [];
							if (selectedClients.length === 0) {
								console.log("Please select at least one AI tool before continuing.");
								continue;
							}

							const results: string[] = [];
							const mcpGuidelineUpdates: EnsureMcpGuidelinesResult[] = [];
							const recordGuidelinesForClient = async (clientKey: string) => {
								const instructionFile = MCP_CLIENT_INSTRUCTION_MAP[clientKey];
								if (!instructionFile) {
									return;
								}
								const nudgeResult = await ensureMcpGuidelines(cwd, instructionFile);
								if (nudgeResult.changed) {
									mcpGuidelineUpdates.push(nudgeResult);
								}
							};
							const uniq = (values: string[]) => [...new Set(values)];

							for (const client of selectedClients) {
								if (isMcpClientSetupKey(client)) {
									const result = await runMcpClientCommand(client, mcpServerName);
									results.push(result);
									await recordGuidelinesForClient(client);
									continue;
								}
								if (client === "guide") {
									console.log("    Opening MCP setup guide in your browser...");
									await openUrlInBrowser(mcpGuideUrl);
									results.push("Setup guide opened");
									await recordGuidelinesForClient(client);
								}
							}

							if (mcpGuidelineUpdates.length > 0) {
								const createdFiles = uniq(
									mcpGuidelineUpdates.filter((entry) => entry.created).map((entry) => entry.fileName),
								);
								const updatedFiles = uniq(
									mcpGuidelineUpdates.filter((entry) => !entry.created).map((entry) => entry.fileName),
								);
								if (createdFiles.length > 0) {
									console.log(`    Created MCP reminder file(s): ${createdFiles.join(", ")}`);
								}
								if (updatedFiles.length > 0) {
									console.log(`    Added MCP reminder to ${updatedFiles.join(", ")}`);
								}
							}

							mcpClientSetupSummary = results.join(", ");
							break;
						}

						break;
					}

					if (integrationMode === "none") {
						agentFiles = [];
						agentInstructionsSkipped = false;
						break;
					}
				}

				let advancedConfig: Partial<BacklogConfig> = { ...defaultAdvancedConfig };
				let advancedConfigured = false;
				let installClaudeAgentSelection = false;
				let installShellCompletionsSelection = false;
				let completionInstallResult: CompletionInstallResult | null = null;
				let completionInstallError: string | null = null;

				if (isNonInteractive) {
					advancedConfig = applyAdvancedOptionOverrides();
					installClaudeAgentSelection =
						integrationMode === "cli" ? parseBoolean(options.installClaudeAgent, false) : false;
				} else {
					const advancedPrompt = await clack.confirm({
						message: "Configure advanced settings now? (Runs the advanced backlog config wizard)",
						initialValue: false,
					});
					if (clack.isCancel(advancedPrompt)) {
						abortInitialization();
						return;
					}

					if (advancedPrompt) {
						const wizardResult = await runAdvancedConfigWizard({
							existingConfig,
							cancelMessage: "Aborting initialization.",
							includeClaudePrompt: integrationMode === "cli",
						});
						advancedConfig = { ...defaultAdvancedConfig, ...wizardResult.config };
						installClaudeAgentSelection = integrationMode === "cli" ? wizardResult.installClaudeAgent : false;
						installShellCompletionsSelection = wizardResult.installShellCompletions;
						if (wizardResult.installShellCompletions) {
							try {
								completionInstallResult = await installCompletion();
							} catch (error) {
								completionInstallError = error instanceof Error ? error.message : String(error);
							}
						}
						advancedConfigured = true;
					}
				}
				if (filesystemOnly) {
					advancedConfig = {
						...advancedConfig,
						checkActiveBranches: false,
						remoteOperations: false,
						bypassGitHooks: false,
						autoCommit: false,
					};
				}
				// Call shared core init function
				const initResult = await initializeProject(core, {
					projectName: name,
					backlogDirectory,
					backlogDirectorySource,
					configLocation,
					integrationMode: integrationMode || "none",
					mcpClients: [], // MCP clients are handled separately in CLI with interactive prompts
					agentInstructions: agentFiles,
					installClaudeAgent: installClaudeAgentSelection,
					advancedConfig: {
						checkActiveBranches: advancedConfig.checkActiveBranches,
						remoteOperations: advancedConfig.remoteOperations,
						activeBranchDays: advancedConfig.activeBranchDays,
						bypassGitHooks: advancedConfig.bypassGitHooks,
						autoCommit: advancedConfig.autoCommit,
						zeroPaddedIds: advancedConfig.zeroPaddedIds,
						defaultEditor: advancedConfig.defaultEditor,
						definitionOfDone: advancedConfig.definitionOfDone,
						defaultPort: advancedConfig.defaultPort,
						autoOpenBrowser: advancedConfig.autoOpenBrowser,
						taskPrefix: taskPrefix || undefined,
					},
					existingConfig,
					filesystemOnly,
				});

				const config = initResult.config;
				const gitIntegrationDisabled = Boolean(config.filesystemOnly);

				// Show configuration summary
				const supportsColor = Boolean(process.stdout.isTTY) && !process.env.NO_COLOR;
				const colorize = (code: string, value: string): string =>
					supportsColor ? `\u001B[${code}m${value}\u001B[0m` : value;
				const label = (value: string): string => colorize("1;36", value);
				const good = (value: string): string => colorize("32", value);
				const bad = (value: string): string => colorize("31", value);
				const muted = (value: string): string => colorize("2", value);
				const boolValue = (value: boolean): string => (value ? good("true") : bad("false"));
				const formatCompletionInstructions = (instructions: string): string =>
					instructions
						.split("\n")
						.map((line) => {
							const trimmed = line.trim();
							if (!trimmed) {
								return line;
							}
							if (/^(path=|autoload|source )/.test(trimmed)) {
								return colorize("1;32", line);
							}
							if (
								/^(To enable completions, ensure the directory is in your fpath\.|Add this to your ~\/\.zshrc:|Then restart your shell or run:)$/.test(
									trimmed,
								)
							) {
								return colorize("36", line);
							}
							return line;
						})
						.join("\n");
				const summaryLines: string[] = [`${label("Project Name:")} ${colorize("1", config.projectName)}`];
				summaryLines.push(`${label("Backlog directory:")} ${backlogDirectory ?? core.filesystem.backlogDirName}`);
				summaryLines.push(
					`${label("Config location:")} ${configLocation === "root" ? DEFAULT_FILES.ROOT_CONFIG : "folder config.yml"}`,
				);
				summaryLines.push(
					`${label("Git integration:")} ${gitIntegrationDisabled ? muted("disabled (filesystem-only)") : good("enabled")}`,
				);
				if (integrationMode === "cli") {
					summaryLines.push(`${label("AI Integration:")} ${good("CLI instructions")}`);
					if (agentFiles.length > 0) {
						summaryLines.push(`${label("Agent instructions:")} ${agentFiles.join(", ")}`);
					} else if (agentInstructionsSkipped) {
						summaryLines.push(`${label("Agent instructions:")} ${muted("skipped")}`);
					} else {
						summaryLines.push(`${label("Agent instructions:")} ${muted("none")}`);
					}
				} else if (integrationMode === "mcp") {
					summaryLines.push(`${label("AI Integration:")} ${good("MCP connector")}`);
					summaryLines.push(
						`${label("Agent instruction files:")} ${muted("guidance is provided through the MCP connector.")}`,
					);
					summaryLines.push(`${label("MCP server name:")} ${mcpServerName}`);
					summaryLines.push(`${label("MCP client setup:")} ${mcpClientSetupSummary ?? muted("skipped")}`);
				} else {
					summaryLines.push(`${label("AI integration:")} ${muted("skipped (configure later via `backlog init`)")}`);
				}
				let completionSummary: string;
				if (completionInstallResult) {
					completionSummary = `${good("installed")} to ${completionInstallResult.installPath}`;
				} else if (installShellCompletionsSelection) {
					completionSummary = `${bad("installation failed")} (${muted("see warning below")})`;
				} else if (advancedConfigured) {
					completionSummary = muted("skipped");
				} else {
					completionSummary = muted("not configured");
				}
				summaryLines.push(`${label("Shell completions:")} ${completionSummary}`);
				if (advancedConfigured || gitIntegrationDisabled) {
					summaryLines.push(label("Advanced settings:"));
					summaryLines.push(`  ${label("Check active branches:")} ${boolValue(Boolean(config.checkActiveBranches))}`);
					summaryLines.push(`  ${label("Remote operations:")} ${boolValue(Boolean(config.remoteOperations))}`);
					summaryLines.push(`  ${label("Active branch days:")} ${String(config.activeBranchDays)}`);
					summaryLines.push(`  ${label("Bypass git hooks:")} ${boolValue(Boolean(config.bypassGitHooks))}`);
					summaryLines.push(`  ${label("Auto commit:")} ${boolValue(Boolean(config.autoCommit))}`);
					summaryLines.push(
						`  ${label("Zero-padded IDs:")} ${
							config.zeroPaddedIds ? `${String(config.zeroPaddedIds)} digits` : muted("disabled")
						}`,
					);
					summaryLines.push(`  ${label("Web UI port:")} ${String(config.defaultPort)}`);
					summaryLines.push(`  ${label("Auto open browser:")} ${boolValue(Boolean(config.autoOpenBrowser))}`);
					if (config.defaultEditor) {
						summaryLines.push(`  ${label("Default editor:")} ${config.defaultEditor}`);
					}
					summaryLines.push(
						`  ${label("Definition of Done defaults:")} ${
							(config.definitionOfDone ?? []).length > 0 ? config.definitionOfDone?.join(" | ") : muted("none")
						}`,
					);
				} else {
					summaryLines.push(`${label("Advanced settings:")} ${muted("unchanged (run `backlog config` to customize)")}`);
				}
				clack.note(summaryLines.join("\n"), "Initialization Summary");

				if (completionInstallResult) {
					const instructions = completionInstallResult.instructions.trim();
					clack.note(
						[
							`${label("Path:")} ${colorize("1", completionInstallResult.installPath)}`,
							formatCompletionInstructions(instructions),
						].join("\n\n"),
						`Shell completions installed (${completionInstallResult.shell})`,
					);
				} else if (completionInstallError) {
					const indentedError = completionInstallError
						.split("\n")
						.map((line) => `  ${line}`)
						.join("\n");
					console.warn(
						`⚠️  Shell completion installation failed:\n${indentedError}\n  Run \`backlog completion install\` later to retry.\n`,
					);
				}

				// Log init result
				if (initResult.isReInitialization) {
					clack.outro(`Updated backlog project configuration: ${name}`);
				} else {
					clack.outro(`Initialized backlog project: ${name}`);
				}

				// Log agent files result from shared init
				if (integrationMode === "cli") {
					if (initResult.mcpResults?.agentFiles) {
						clack.log.info(initResult.mcpResults.agentFiles);
					} else if (agentInstructionsSkipped) {
						clack.log.info("Skipping agent instruction files per selection.");
					}
				}

				// Log Claude agent result from shared init
				if (integrationMode === "cli" && initResult.mcpResults?.claudeAgent) {
					clack.log.info(`Claude Code Backlog.md agent ${initResult.mcpResults.claudeAgent}`);
				}

				// Final warning if remote operations were enabled but no git remotes are configured
				try {
					if (config.remoteOperations) {
						// Ensure git ops are ready (config not strictly required for this check)
						const hasRemotes = await core.gitOps.hasAnyRemote();
						if (!hasRemotes) {
							console.warn(
								[
									"Warning: remoteOperations is enabled but no git remotes are configured.",
									"Remote features will be skipped until a remote is added (e.g., 'git remote add origin <url>')",
									"or disable remoteOperations via 'backlog config set remoteOperations false'.",
								].join(" "),
							);
						}
					}
				} catch {
					// Ignore failures in final advisory warning
				}
			} catch (err) {
				reportCommandFailure("Failed to initialize project", err);
			}
		},
	);

const taskCmd = program.command("task").aliases(["tasks"]);

function getTaskReadOutputMode(options: { json?: boolean; plain?: boolean }): ReadOutputMode | null {
	const taskOptions = taskCmd.opts<{ json?: boolean; plain?: boolean }>();
	return getReadOutputMode({
		json: Boolean(options.json || taskOptions.json),
		plain: Boolean(options.plain || taskOptions.plain),
	});
}

taskCmd.hook("preSubcommand", (command, subcommand) => {
	if (command.opts().json && !["list", "view"].includes(subcommand.name())) {
		command.error("error: unknown option '--json'", { code: "commander.unknownOption", exitCode: 1 });
	}
});

addHelpSchema(taskCmd.command("create [title]"), {
	required: [{ name: "title", type: "String", description: "Task title; prompted when omitted in interactive mode" }],
	optional: [
		{ name: "description", type: "Markdown", description: "Task outcome and context" },
		{
			name: "status",
			type: () => statusType({ includeDraft: true }),
			description: "Project task status; case-insensitive",
		},
		{
			name: "assignee",
			type: "Comma-separated strings",
			description:
				'Assign one or more @names; repeat -a or use @name1,@name2; omitting it applies the configured defaultAssignee, while -a "" leaves the task unassigned',
		},
		{
			name: "labels",
			type: "Comma-separated strings",
			description: "Task labels; repeat -l or use label1,label2",
		},
		{ name: "priority", type: priorityType, description: "Task priority" },
		{ name: "type", type: taskType, description: "Task type; case-insensitive" },
		{ name: "project", type: projectType, description: "Task project; case-insensitive" },
		{ name: "due-date", type: "UTC datetime", description: "Optional due date and time" },
		{ name: "acceptanceCriteria", type: "Markdown list item text", description: "Repeat --ac for multiple criteria" },
		{ name: "ordinal", type: "Integer", description: "Non-negative manual ordering value" },
		{ name: "parent", type: "Task ID", description: "Existing parent task for subtasks; not a milestone ID" },
		{
			name: "plan",
			type: "Markdown",
			description:
				"Only for already-started work created directly in a configured active status (for example, In Progress)",
		},
		{ name: "notes", type: "Markdown", description: "Same restriction as plan" },
		{
			name: "final-summary",
			type: "Markdown",
			description: "Only for finished, verified work created directly in a configured terminal status",
		},
	],
	writes: "Creates a task or draft markdown file through Backlog.md",
	output: "Created task details; use --plain for text output",
	examples: [
		'backlog task create "Add OAuth" --ac "Login succeeds"',
		`backlog task create "Fix session expiry" --type ${TASK_TYPE_EXAMPLE}`,
		'backlog task create -p {{TASK_ID:1}} "Add tests"',
	],
})
	.option("-d, --description <text>", "task description")
	.option("--desc <text>", "alias for --description")
	.option(
		"-a, --assignee <assignees>",
		'assign task to one or more @names (comma-separated or repeatable); pass "" to leave it unassigned',
		createMultiValueAccumulator(),
	)
	.option("-s, --status <status>")
	.option("-l, --labels <labels>", "add task labels (comma-separated or repeatable)", createMultiValueAccumulator())
	.option("--priority <priority>", "set task priority (configured priorities)")
	.option("--type <type>", "set task type (configured task types)")
	.option("--project <project>", "set task project (configured projects)")
	.option("--due-date <datetime>", "set due date as a UTC datetime")
	.option("--plain", "use plain text output after creating")
	.option("--ac <criteria>", "add acceptance criteria (can be used multiple times)", createMultiValueAccumulator())
	.option(
		"--acceptance-criteria <criteria>",
		"add acceptance criteria (can be used multiple times)",
		createMultiValueAccumulator(),
	)
	.option("--dod <item>", "add Definition of Done item (can be used multiple times)", createMultiValueAccumulator())
	.option("--no-dod-defaults", "disable Definition of Done defaults")
	.option(
		"--plan <text>",
		"add a plan only for already-started work created directly in an active status (for example, In Progress)",
	)
	.option("--notes <text>", "add implementation notes")
	.option("--final-summary <text>", "add final summary")
	.option("--ordinal <number>", "set task ordinal for custom ordering")
	.option("-m, --milestone <milestone>", "assign task to milestone by ID or title")
	.option("--draft")
	.option("-p, --parent <taskId>", "specify existing parent task ID, not a milestone ID")
	.option(
		"--depends-on <taskIds>",
		"specify task dependencies (comma-separated or use multiple times)",
		(value, previous) => {
			const soFar = Array.isArray(previous) ? previous : previous ? [previous] : [];
			return [...soFar, value];
		},
	)
	.option("--dep <taskIds>", "specify task dependencies (shortcut for --depends-on)", (value, previous) => {
		const soFar = Array.isArray(previous) ? previous : previous ? [previous] : [];
		return [...soFar, value];
	})
	.option("--ref <reference>", "add reference URL or file path (can be used multiple times)", (value, previous) => {
		const soFar = Array.isArray(previous) ? previous : previous ? [previous] : [];
		return [...soFar, value];
	})
	.option(
		"--modified-file <path>",
		"add modified file path from project root (can be used multiple times)",
		(value, previous) => {
			const soFar = Array.isArray(previous) ? previous : previous ? [previous] : [];
			return [...soFar, value];
		},
	)
	.option(
		"--doc <documentation>",
		"add documentation URL or file path (can be used multiple times)",
		(value, previous) => {
			const soFar = Array.isArray(previous) ? previous : previous ? [previous] : [];
			return [...soFar, value];
		},
	)
	.action(async (title: string | undefined, options) => {
		const shouldUseWizard = hasInteractiveTTY && title === undefined && !hasCreateFieldFlags(options);
		if (!shouldUseWizard && (title === undefined || title.trim().length === 0)) {
			printMissingRequiredArgument("title");
			return;
		}

		const cwd = await requireProjectRoot();
		const core = new Core(cwd);
		await core.ensureConfigLoaded();

		if (shouldUseWizard) {
			const statuses = await getValidStatuses(core);
			const config = await core.filesystem.loadConfig();
			const wizardInput = await runTaskCreateWizard({
				statuses,
				priorities: config?.priorities,
				types: config?.types,
				projects: config?.projects,
			});
			if (!wizardInput) {
				clack.cancel("Task create cancelled.");
				return;
			}
			try {
				const { task, filePath } = await core.createTaskFromInput(wizardInput);
				console.log(`Created task ${task.id}`);
				if (filePath) {
					console.log(`File: ${filePath}`);
				}
			} catch (error) {
				console.error(error instanceof Error ? error.message : String(error));
				process.exitCode = 1;
			}
			return;
		}

		const createAsDraft = Boolean(options.draft);
		const usePlainOutput = isPlainRequested(options);
		let ordinalValue: number | undefined;

		if (options.ordinal !== undefined) {
			const parsed = Number(options.ordinal);
			if (!Number.isFinite(parsed) || parsed < 0) {
				console.error(`Invalid ordinal: ${options.ordinal}. Must be a non-negative number.`);
				process.exitCode = 1;
				return;
			}
			ordinalValue = parsed;
		}

		const listFlagError = validateTaskListFlags(options, { supportsClearFlags: false });
		if (listFlagError) {
			console.error(listFlagError);
			process.exitCode = 1;
			return;
		}

		const dependencies = parseDelimitedStringList([...toStringArray(options.dependsOn), ...toStringArray(options.dep)]);

		try {
			const criteria = processAcceptanceCriteriaOptions(options);
			const milestone =
				typeof options.milestone === "string" ? await resolveCliMilestoneInput(core, options.milestone) : undefined;
			const { task, filePath } = await core.createTaskFromInput({
				title: title ?? "",
				description: options.description || options.desc ? String(options.description || options.desc) : undefined,
				status: createAsDraft ? "Draft" : options.status ? String(options.status) : undefined,
				dueDate: typeof options.dueDate === "string" ? options.dueDate : undefined,
				assignee: parseClearableStringList(options.assignee),
				labels: parseDelimitedStringList(options.labels),
				dependencies,
				references: parseDelimitedStringList(options.ref),
				documentation: parseDelimitedStringList(options.doc),
				modifiedFiles: parseDelimitedStringList(options.modifiedFile),
				parentTaskId: options.parent ? String(options.parent) : undefined,
				priority: options.priority ? String(options.priority) : undefined,
				type: options.type !== undefined ? String(options.type) : undefined,
				project: options.project !== undefined ? String(options.project) : undefined,
				...(ordinalValue !== undefined ? { ordinal: ordinalValue } : {}),
				milestone,
				implementationPlan: options.plan ? String(options.plan) : undefined,
				implementationNotes: options.notes ? String(options.notes) : undefined,
				finalSummary: options.finalSummary ? String(options.finalSummary) : undefined,
				acceptanceCriteria: criteria.map((text) => ({ text, checked: false })),
				definitionOfDoneAdd: toStringArray(options.dod),
				disableDefinitionOfDoneDefaults: options.dodDefaults === false,
			});

			if (usePlainOutput) {
				console.log(formatTaskPlainText(task, { filePathOverride: filePath }));
				return;
			}

			if (createAsDraft) {
				console.log(`Created draft ${task.id}`);
				console.log(`File: ${filePath}`);
				return;
			}

			console.log(`Created task ${task.id}`);
			console.log(`File: ${filePath}`);
		} catch (error) {
			console.error(error instanceof Error ? error.message : String(error));
			process.exitCode = 1;
		}
	});

addHelpSchema(program.command("search [query]"), {
	reads: "Tasks, documents, and decisions from the configured backlog directory",
	required: [],
	optional: [
		{ name: "query", type: "String", description: "Fuzzy search text" },
		{
			name: "type",
			type: choiceType(["task", "document", "decision"], { multiple: true }),
			description: "Result types",
		},
		{
			name: "task-type",
			type: () => taskType({ multiple: true }),
			description: "Filter task results by one or more configured task types; repeat or comma-separate values",
		},
		{
			name: "status",
			type: () => statusType({ multiple: true }),
			description: "Filter task results by one or more statuses; repeat or comma-separate values; case-insensitive",
		},
		{
			name: "exclude-status",
			type: statusType,
			description: "Exclude task results with one or more statuses; repeat or comma-separate values",
		},
		{ name: "priority", type: priorityType, description: "Filter task results by priority" },
		{
			name: "project",
			type: () => projectType({ multiple: true }),
			description: "Filter task results by one or more configured projects; repeat or comma-separate values",
		},
		{
			name: "modified-file",
			type: "Project-root-relative path",
			description: "Filter by modified file path substring",
		},
		{ name: "limit", type: "Integer", description: "Maximum number of results" },
		{ name: "plain", type: "Boolean", description: "Use text output instead of interactive UI" },
		{ name: "json", type: "Boolean", description: "Use versioned machine-readable JSON output" },
	],
	output: "Interactive search UI, plain text with --plain, or versioned JSON with --json",
	examples: [
		'backlog search "auth" --plain',
		'backlog search "auth" --json',
		'backlog search "api" --type task --status "<active status>"',
		`backlog search "crash" --task-type ${TASK_TYPE_EXAMPLE} --plain`,
	],
})
	.description("search tasks, documents, and decisions using the shared index")
	.option("--type <type>", "limit results to type (task, document, decision)", createMultiValueAccumulator())
	.option(
		"--task-type <type>",
		"filter task results by configured task type (repeatable or comma-separated)",
		createMultiValueAccumulator(),
	)
	.option(
		"--status <status>",
		"filter task results by status (repeatable or comma-separated)",
		createMultiValueAccumulator(),
	)
	.option(
		"--exclude-status <status>",
		"exclude task results by status (repeatable or comma-separated)",
		createMultiValueAccumulator(),
	)
	.option("--priority <priority>", "filter task results by priority (configured priorities)")
	.option(
		"--project <project>",
		"filter task results by configured project (repeatable or comma-separated)",
		createMultiValueAccumulator(),
	)
	.option(
		"--modified-file <path>",
		"filter task results by modified file path substring",
		createMultiValueAccumulator(),
	)
	.option("--limit <number>", "limit total results returned")
	.option("--plain", "print plain text output instead of interactive UI")
	.option("--json", "print versioned machine-readable JSON output")
	.action(async (query: string | undefined, options) => {
		const outputMode = getReadOutputMode(options);
		if (!outputMode) return;
		const cwd = await requireProjectRoot();
		const core = new Core(cwd);
		const hasDuplicateIds = await printDuplicateIntegrityWarning(core);
		const searchService = await core.getSearchService();
		const contentStore = await core.getContentStore();
		const cleanup = () => {
			searchService.dispose();
			contentStore.dispose();
		};
		if (hasDuplicateIds && outputMode === "json") {
			cleanup();
			return;
		}

		const modifiedFileFilters = parseDelimitedStringList(options.modifiedFile);
		const rawTaskTypes = parseDelimitedStringList(options.taskType) ?? [];
		const rawSearchProjects = parseDelimitedStringList(options.project) ?? [];
		const rawTypes = options.type ? (Array.isArray(options.type) ? options.type : [options.type]) : undefined;
		const allowedTypes: SearchResultType[] = ["task", "document", "decision"];
		const types = rawTypes
			? rawTypes
					.map((value: string) => value.toLowerCase())
					.filter((value: string): value is SearchResultType => {
						if (!allowedTypes.includes(value as SearchResultType)) {
							console.warn(`Ignoring unsupported type '${value}'. Supported: task, document, decision`);
							return false;
						}
						return true;
					})
			: modifiedFileFilters?.length || rawTaskTypes.length > 0 || rawSearchProjects.length > 0
				? ["task"]
				: allowedTypes;
		if (rawTaskTypes.length > 0 && rawTypes && !types.includes("task")) {
			console.error("--task-type filters task results. Include --type task or omit --type.");
			cleanup();
			process.exitCode = 1;
			return;
		}
		if (rawSearchProjects.length > 0 && rawTypes && !types.includes("task")) {
			console.error("--project filters task results. Include --type task or omit --type.");
			cleanup();
			process.exitCode = 1;
			return;
		}

		const filters: {
			status?: string | string[];
			excludeStatus?: string[];
			type?: string[];
			project?: string[];
			priority?: SearchPriorityFilter;
			modifiedFiles?: string[];
		} = {};
		if (options.status) {
			filters.status = parseDelimitedStringList(options.status) ?? options.status;
		}
		const excludeStatuses = parseDelimitedStringList(options.excludeStatus) ?? [];
		if (excludeStatuses.length > 0) {
			const canonicalExcludeStatuses = await normalizeCliStatusList(core, excludeStatuses, "exclude-status");
			if (!canonicalExcludeStatuses) {
				cleanup();
				return;
			}
			filters.excludeStatus = canonicalExcludeStatuses;
		}
		if (rawTaskTypes.length > 0) {
			const canonicalTaskTypes = await normalizeCliTaskTypes(core, rawTaskTypes, "task-type");
			if (!canonicalTaskTypes) {
				cleanup();
				return;
			}
			filters.type = canonicalTaskTypes;
		}
		if (rawSearchProjects.length > 0) {
			const canonicalProjects = await normalizeCliProjects(core, rawSearchProjects, "project");
			if (!canonicalProjects) {
				cleanup();
				return;
			}
			filters.project = canonicalProjects;
		}
		if (options.priority) {
			const priority = await normalizeCliPriority(core, String(options.priority));
			if (!priority) {
				cleanup();
				return;
			}
			filters.priority = priority;
		}
		if (modifiedFileFilters?.length) {
			filters.modifiedFiles = modifiedFileFilters;
		}

		let limit: number | undefined;
		if (options.limit !== undefined) {
			const parsed = parsePositiveIntegerOption(options.limit, "--limit", "backlog search --help");
			if (parsed === null) {
				cleanup();
				return;
			}
			limit = parsed;
		}

		const searchResults = searchService.search({
			query: query ?? "",
			limit,
			types,
			filters,
		});

		if (outputMode === "json") {
			printJson(searchJson(searchResults, cwd, core.filesystem.docsDir));
			cleanup();
			return;
		}

		if (outputMode === "plain") {
			printSearchResults(searchResults);
			cleanup();
			return;
		}

		const taskResults = searchResults.filter(isTaskSearchResult);
		const searchResultTasks = taskResults.map((result) => result.task);

		const allTasks = (await core.queryTasks()).filter(
			(task) => task.id && task.id.trim() !== "" && hasAnyPrefix(task.id),
		);

		// If no tasks exist at all, show plain text results
		if (allTasks.length === 0) {
			printSearchResults(searchResults);
			cleanup();
			return;
		}

		// Only filters the interactive view cannot edit may narrow the set it loads. Modified-file
		// filters have no in-view control, so the view would never be able to widen past them.
		// Project does have one, and it is applied below as a view filter, so prefiltering here
		// would leave clearing it in the picker unable to reveal anything it had excluded.
		const requiresPrefilteredTaskSet = Boolean(modifiedFileFilters?.length);
		const interactiveTasks = requiresPrefilteredTaskSet ? searchResultTasks : allTasks;
		if (interactiveTasks.length === 0) {
			printSearchResults(searchResults);
			cleanup();
			return;
		}

		// Use the first search result as the selected task, or first available task if no results
		const firstTask = searchResultTasks[0] || interactiveTasks[0];
		const priorityFilter = filters.priority ? filters.priority : undefined;
		const statusFilter = filters.status;
		const { runUnifiedView } = await import("./ui/unified-view.ts");

		await runUnifiedView({
			core,
			initialView: "task-list",
			selectedTask: firstTask,
			tasks: interactiveTasks,
			filter: {
				title: query ? `Search: ${query}` : "Search",
				filterDescription: buildSearchFilterDescription({
					status: statusFilter,
					excludeStatus: filters.excludeStatus,
					type: filters.type,
					project: filters.project,
					priority: priorityFilter,
					query: query ?? "",
					modifiedFiles: modifiedFileFilters ?? [],
				}),
				status: statusFilter,
				excludeStatus: filters.excludeStatus,
				type: filters.type,
				project: filters.project,
				priority: priorityFilter,
				searchQuery: query ?? "", // Pre-populate search with the query
			},
		});
		cleanup();
	});

function buildSearchFilterDescription(filters: {
	status?: string | string[];
	excludeStatus?: string[];
	type?: string[];
	project?: string[];
	priority?: SearchPriorityFilter;
	query?: string;
	modifiedFiles?: string[];
}): string {
	const parts: string[] = [];
	if (filters.query) {
		parts.push(`Query: ${filters.query}`);
	}
	if (filters.status) {
		const statusText = Array.isArray(filters.status) ? filters.status.join(", ") : filters.status;
		parts.push(`Status: ${statusText}`);
	}
	if (filters.excludeStatus?.length) {
		parts.push(`Exclude status: ${filters.excludeStatus.join(", ")}`);
	}
	if (filters.type?.length) {
		parts.push(`Type: ${filters.type.join(", ")}`);
	}
	if (filters.project?.length) {
		parts.push(`Project: ${filters.project.join(", ")}`);
	}
	if (filters.priority) {
		parts.push(`Priority: ${filters.priority}`);
	}
	if (filters.modifiedFiles?.length) {
		parts.push(`Modified files: ${filters.modifiedFiles.join(", ")}`);
	}
	return parts.join(" • ");
}

function printSearchResults(results: SearchResult[]): void {
	if (results.length === 0) {
		console.log("No results found.");
		return;
	}

	const tasks: TaskSearchResult[] = [];
	const documents: DocumentSearchResult[] = [];
	const decisions: DecisionSearchResult[] = [];

	for (const result of results) {
		if (result.type === "task") {
			tasks.push(result);
			continue;
		}
		if (result.type === "document") {
			documents.push(result);
			continue;
		}
		decisions.push(result);
	}

	const localTasks = tasks.filter((t) => isLocalEditableTask(t.task));

	let printed = false;

	if (localTasks.length > 0) {
		console.log("Tasks:");
		for (const taskResult of localTasks) {
			const { task } = taskResult;
			const scoreText = formatScore(taskResult.score);
			const statusText = task.status ? ` (${task.status})` : "";
			const priorityText = task.priority ? ` [${task.priority.toUpperCase()}]` : "";
			console.log(`  ${task.id} - ${task.title}${statusText}${priorityText}${scoreText}`);
		}
		printed = true;
	}

	if (documents.length > 0) {
		if (printed) {
			console.log("");
		}
		console.log("Documents:");
		for (const documentResult of documents) {
			const { document } = documentResult;
			const scoreText = formatScore(documentResult.score);
			console.log(`  ${document.id} - ${document.title}${scoreText}`);
		}
		printed = true;
	}

	if (decisions.length > 0) {
		if (printed) {
			console.log("");
		}
		console.log("Decisions:");
		for (const decisionResult of decisions) {
			const { decision } = decisionResult;
			const scoreText = formatScore(decisionResult.score);
			console.log(`  ${decision.id} - ${decision.title}${scoreText}`);
		}
		printed = true;
	}

	if (!printed) {
		console.log("No results found.");
	}
}

function formatScore(score: number | null): string {
	if (score === null || score === undefined) {
		return "";
	}
	// Invert score so higher is better (Fuse.js uses 0=perfect match, 1=no match)
	const invertedScore = 1 - score;
	return ` [score ${invertedScore.toFixed(3)}]`;
}

function parseDocumentSearchLimit(value: unknown): number | undefined | null {
	if (value === undefined) {
		return undefined;
	}
	const rawValue = String(value).trim();
	const parsed = Number(rawValue);
	if (rawValue.length === 0 || !Number.isInteger(parsed) || parsed < 1 || parsed > DOCUMENT_SEARCH_LIMIT_MAX) {
		console.error(
			`Invalid limit: ${rawValue || "(empty)"}. Limit must be an integer between 1 and ${DOCUMENT_SEARCH_LIMIT_MAX}.`,
		);
		process.exitCode = 1;
		return null;
	}
	return parsed;
}

function formatDocumentSearchTags(document: DocType): string {
	return document.tags && document.tags.length > 0 ? document.tags.join(", ") : "(none)";
}

function printDocumentSearchResults(results: DocumentSearchResult[], query: string): void {
	if (results.length === 0) {
		console.log(`No documents found for "${query}".`);
		return;
	}

	console.log("Documents:");
	for (const result of results) {
		const { document } = result;
		const scoreText = formatScore(result.score);
		const pathText = document.path ?? "(unknown)";
		const tagsText = formatDocumentSearchTags(document);
		console.log(
			`  ${document.id} - ${document.title} (path: ${pathText}, type: ${document.type}, tags: ${tagsText})${scoreText}`,
		);
		console.log(`    View: backlog doc view ${document.id}`);
	}
}

function isTaskSearchResult(result: SearchResult): result is TaskSearchResult {
	return result.type === "task";
}

function isDocumentSearchResult(result: SearchResult): result is DocumentSearchResult {
	return result.type === "document";
}

addHelpSchema(taskCmd.command("list"), {
	reads: "Local editable tasks from the configured backlog directory",
	required: [],
	optional: [
		{
			name: "status",
			type: () => statusType({ multiple: true }),
			description: "Filter tasks by one or more statuses; repeat or comma-separate values; case-insensitive",
		},
		{
			name: "exclude-status",
			type: statusType,
			description: "Exclude tasks with one or more statuses; repeat or comma-separate values",
		},
		{ name: "assignee", type: "Assignee", description: "Filter by @name" },
		{
			name: "unassigned",
			type: "Boolean",
			description: "Only tasks without an assignee; cannot be combined with --assignee",
		},
		{ name: "milestone", type: "Milestone ID or title", description: "Closest case-insensitive match" },
		{ name: "parent", type: "Task ID", description: "Show subtasks of a parent task" },
		{ name: "priority", type: priorityType, description: "Filter by task priority" },
		{
			name: "type",
			type: () => taskType({ multiple: true }),
			description: "Filter by one or more configured task types; repeat or comma-separate values",
		},
		{
			name: "project",
			type: () => projectType({ multiple: true }),
			description: "Filter by one or more configured projects; repeat or comma-separate values",
		},
		{
			name: "labels",
			type: "Comma-separated strings",
			description: "Require every listed label; repeat --labels or use label1,label2",
		},
		{ name: "search", type: "String", description: "Search task title, description, notes, comments, and metadata" },
		{ name: "ready", type: "Boolean", description: "Only show unblocked tasks with all dependencies completed" },
		{ name: "limit", type: "Positive integer", description: "Maximum tasks to display after sorting" },
		{ name: "sort", type: choiceType(TASK_SORT_FIELDS), description: "Task ordering before applying limit" },
		{ name: "plain", type: "Boolean", description: "Use text output instead of interactive UI" },
		{ name: "json", type: "Boolean", description: "Use versioned machine-readable JSON output" },
	],
	output: "Interactive task list, plain text with --plain, or versioned JSON with --json",
	examples: [
		'backlog task list --status "<todo status>" --plain',
		"backlog task list --ready --plain",
		'backlog task list --status "<todo status>" --json',
		"backlog task list --parent {{TASK_ID:1}}",
		`backlog task list --type ${TASK_TYPE_EXAMPLE} --plain`,
		'backlog task list --labels frontend,bug --search "login" --limit 10 --plain',
	],
})
	.description("list tasks grouped by status")
	.option(
		"-s, --status <status>",
		"filter tasks by status (case-insensitive, repeatable or comma-separated)",
		createMultiValueAccumulator(),
	)
	.option(
		"--exclude-status <status>",
		"exclude tasks by status (repeatable or comma-separated)",
		createMultiValueAccumulator(),
	)
	.option("-a, --assignee <assignee>", "filter tasks by assignee")
	.option("--unassigned", "filter tasks without an assignee (cannot be combined with --assignee)")
	.option("-m, --milestone <milestone>", "filter tasks by milestone (closest match, case-insensitive)")
	.option("-p, --parent <taskId>", "filter tasks by parent task ID")
	.option("--priority <priority>", "filter tasks by priority (configured priorities)")
	.option(
		"--type <type>",
		"filter tasks by configured task type (repeatable or comma-separated)",
		createMultiValueAccumulator(),
	)
	.option(
		"--project <project>",
		"filter tasks by configured project (repeatable or comma-separated)",
		createMultiValueAccumulator(),
	)
	.option(
		"-l, --labels <labels>",
		"filter tasks by labels; require every comma-separated label (repeatable)",
		createMultiValueAccumulator(),
	)
	.option("--search <query>", "search task title, description, notes, comments, and metadata")
	.option("--ready", "only show unblocked tasks with all dependencies completed")
	.option("--limit <number>", "limit tasks displayed after sorting")
	.option("--sort <field>", `sort tasks by field (${TASK_SORT_FIELD_LIST})`)
	.option("--plain", "use plain text output instead of interactive UI")
	.option("--json", "print versioned machine-readable JSON output")
	.action(async (options) => {
		const outputMode = getTaskReadOutputMode(options);
		if (!outputMode) return;
		const cwd = await requireProjectRoot();
		const core = new Core(cwd);
		const hasDuplicateIds = await printDuplicateIntegrityWarning(core);
		const cleanup = () => {
			core.disposeSearchService();
			core.disposeContentStore();
		};
		if (hasDuplicateIds && outputMode === "json") {
			cleanup();
			return;
		}
		if (options.assignee && options.unassigned) {
			console.error("--unassigned cannot be combined with --assignee.");
			process.exitCode = 1;
			cleanup();
			return;
		}
		const baseFilters: TaskListFilter = {};
		if (options.status) {
			baseFilters.status = parseDelimitedStringList(options.status) ?? options.status;
		}
		const excludeStatuses = parseDelimitedStringList(options.excludeStatus) ?? [];
		if (excludeStatuses.length > 0) {
			const canonicalExcludeStatuses = await normalizeCliStatusList(core, excludeStatuses, "exclude-status");
			if (!canonicalExcludeStatuses) {
				cleanup();
				return;
			}
			baseFilters.excludeStatus = canonicalExcludeStatuses;
		}
		if (options.assignee) {
			baseFilters.assignee = options.assignee;
		}
		if (options.unassigned) {
			baseFilters.unassigned = true;
		}
		if (options.milestone) {
			baseFilters.milestone = options.milestone;
		}
		if (options.priority) {
			const priority = await normalizeCliPriority(core, String(options.priority));
			if (!priority) {
				cleanup();
				return;
			}
			baseFilters.priority = priority;
		}
		const rawTaskTypes = parseDelimitedStringList(options.type) ?? [];
		if (rawTaskTypes.length > 0) {
			const canonicalTaskTypes = await normalizeCliTaskTypes(core, rawTaskTypes, "type");
			if (!canonicalTaskTypes) {
				cleanup();
				return;
			}
			baseFilters.type = canonicalTaskTypes;
		}
		const rawProjects = parseDelimitedStringList(options.project) ?? [];
		if (rawProjects.length > 0) {
			const canonicalProjects = await normalizeCliProjects(core, rawProjects, "project");
			if (!canonicalProjects) {
				cleanup();
				return;
			}
			baseFilters.project = canonicalProjects;
		}

		const labelFilters = parseDelimitedStringList(options.labels) ?? [];
		if (labelFilters.length > 0) {
			// `--labels` is documented as requiring every listed label.
			baseFilters.labels = labelFilters;
			baseFilters.labelMatch = "all";
		}
		const searchQuery = typeof options.search === "string" ? options.search.trim() : "";
		let taskLimit: number | undefined;
		if (options.limit !== undefined) {
			const parsedLimit = parsePositiveIntegerOption(options.limit, "--limit", "backlog task list --help");
			if (parsedLimit === null) {
				cleanup();
				return;
			}
			taskLimit = parsedLimit;
		}

		// The raw argument reaches identity comparison untouched so bare numeric IDs resolve under any
		// configured prefix; the canonical form is only used for display.
		let parentId: string | undefined;
		let parentDisplayId: string | undefined;
		if (options.parent !== undefined) {
			parentId = String(options.parent).trim();
			if (parentId === "") {
				// A blank value must not silently degrade into "no parent filter" and list every task.
				console.error("Cannot use an empty value with --parent. Omit the flag to list every task.");
				process.exitCode = 1;
				cleanup();
				return;
			}
			baseFilters.parentTaskId = parentId;
			const config = await core.filesystem.loadConfig();
			parentDisplayId = canonicalTaskId(parentId, config?.prefixes?.task ?? "task");
		}

		if (options.sort) {
			const sortField = options.sort.toLowerCase();
			if (!TASK_SORT_FIELDS.includes(sortField)) {
				console.error(`Invalid sort field: ${options.sort}. Valid values are: ${TASK_SORT_FIELD_LIST}`);
				process.exitCode = 1;
				cleanup();
				return;
			}
		}

		if (outputMode !== "interactive") {
			// Resolve the parent before reading children so an ambiguous ID never emits task data.
			let resolvedParentId: string | undefined;
			if (parentId) {
				try {
					resolvedParentId = await resolveParentFilterId(core, parentId, parentDisplayId ?? parentId);
				} catch (error) {
					console.error(error instanceof Error ? error.message : String(error));
					process.exitCode = 1;
					cleanup();
					return;
				}
				baseFilters.parentTaskId = resolvedParentId;
			}

			let tasks = await core.queryTasks({
				query: searchQuery || undefined,
				filters: Object.keys(baseFilters).length > 0 ? baseFilters : undefined,
				includeCrossBranch: false,
			});
			const config = await core.filesystem.loadConfig();

			if (options.ready) {
				const readinessGraph = await loadReadinessGraph(core);
				tasks = tasks.filter((task) => getTaskReadiness(task, readinessGraph).isReady);
			}

			let sortedTasks = tasks;
			if (options.sort) {
				const sortField = options.sort.toLowerCase();
				if (!TASK_SORT_FIELDS.includes(sortField)) {
					console.error(`Invalid sort field: ${options.sort}. Valid values are: ${TASK_SORT_FIELD_LIST}`);
					process.exitCode = 1;
					cleanup();
					return;
				}
				sortedTasks = sortTasks(tasks, sortField, config?.priorities);
			} else {
				sortedTasks = sortTasks(tasks, "priority", config?.priorities);
			}

			let filtered = sortedTasks;
			if (resolvedParentId) {
				const parent = resolvedParentId;
				filtered = filtered.filter((task) => task.parentTaskId && taskIdsEqual(parent, task.parentTaskId));
			}
			const displayTasks = taskLimit !== undefined ? filtered.slice(0, taskLimit) : filtered;

			if (outputMode === "json") {
				printJson(taskListJson(displayTasks));
				cleanup();
				return;
			}

			if (filtered.length === 0) {
				if (resolvedParentId) {
					console.log(`No child tasks found for parent task ${parentDisplayId}.`);
				} else {
					console.log("No tasks found.");
				}
				cleanup();
				return;
			}

			if (options.sort && options.sort.toLowerCase() === "priority") {
				console.log("Tasks (sorted by priority):");
				for (const t of displayTasks) {
					console.log(formatPlainTaskListRow(t, { includeStatus: true }));
				}
				cleanup();
				return;
			}

			const canonicalByLower = new Map<string, string>();
			const statuses = config?.statuses || [];
			for (const status of statuses) {
				canonicalByLower.set(status.toLowerCase(), status);
			}

			const groups = new Map<string, Task[]>();
			for (const task of displayTasks) {
				const rawStatus = (task.status || "").trim();
				const canonicalStatus = canonicalByLower.get(rawStatus.toLowerCase()) || rawStatus;
				const list = groups.get(canonicalStatus) || [];
				list.push(task);
				groups.set(canonicalStatus, list);
			}

			const orderedStatuses = [
				...statuses.filter((status) => groups.has(status)),
				...Array.from(groups.keys()).filter((status) => !statuses.includes(status)),
			];

			for (const status of orderedStatuses) {
				const list = groups.get(status);
				if (!list) continue;
				console.log(`${status || "No Status"}:`);
				list.forEach((task) => {
					console.log(formatPlainTaskListRow(task));
				});
				console.log();
			}
			cleanup();
			return;
		}

		let filterDescription = "";
		let title = "Tasks";
		const activeFilters: string[] = [];
		if (options.status) activeFilters.push(`Status: ${options.status}`);
		if (baseFilters.excludeStatus) {
			const excluded = Array.isArray(baseFilters.excludeStatus)
				? baseFilters.excludeStatus
				: [baseFilters.excludeStatus];
			activeFilters.push(`Exclude status: ${excluded.join(", ")}`);
		}
		if (options.assignee) activeFilters.push(`Assignee: ${options.assignee}`);
		if (options.unassigned) activeFilters.push("Unassigned");
		if (options.ready) activeFilters.push("Ready");
		if (parentId) {
			activeFilters.push(`Parent: ${parentDisplayId}`);
		}
		if (options.milestone) activeFilters.push(`Milestone: ${options.milestone}`);
		if (baseFilters.priority) activeFilters.push(`Priority: ${baseFilters.priority}`);
		if (baseFilters.type) {
			const taskTypes = Array.isArray(baseFilters.type) ? baseFilters.type : [baseFilters.type];
			activeFilters.push(`Type: ${taskTypes.join(", ")}`);
		}
		if (baseFilters.project) {
			const projects = Array.isArray(baseFilters.project) ? baseFilters.project : [baseFilters.project];
			activeFilters.push(`Project: ${projects.join(", ")}`);
		}
		if (labelFilters.length > 0) activeFilters.push(`Labels: ${labelFilters.join(", ")}`);
		if (searchQuery) activeFilters.push(`Search: ${searchQuery}`);
		if (taskLimit !== undefined) activeFilters.push(`Limit: ${taskLimit}`);
		if (options.sort) activeFilters.push(`Sort: ${options.sort}`);

		if (activeFilters.length > 0) {
			filterDescription = activeFilters.join(", ");
			title = `Tasks (${activeFilters.join(" • ")})`;
		}
		const initialUnifiedFilter: {
			status?: string | string[];
			excludeStatus?: string[];
			assignee?: string;
			milestone?: string;
			type?: string[];
			project?: string[];
			priority?: string;
			sort?: string;
			labels?: string[];
			labelMatch?: "all";
			searchQuery?: string;
			title?: string;
			filterDescription?: string;
			parentTaskId?: string;
			limit?: number;
			ready?: boolean;
		} = {
			status: baseFilters.status,
			excludeStatus: Array.isArray(baseFilters.excludeStatus) ? baseFilters.excludeStatus : undefined,
			assignee: options.assignee,
			milestone: options.milestone,
			type: Array.isArray(baseFilters.type) ? baseFilters.type : baseFilters.type ? [baseFilters.type] : undefined,
			project: Array.isArray(baseFilters.project)
				? baseFilters.project
				: baseFilters.project
					? [baseFilters.project]
					: undefined,
			priority: baseFilters.priority,
			sort: options.sort,
			labels: labelFilters,
			labelMatch: labelFilters.length > 0 ? "all" : undefined,
			title,
			filterDescription,
			parentTaskId: parentId,
			limit: taskLimit,
			ready: options.ready,
		};
		if (searchQuery) {
			initialUnifiedFilter.searchQuery = searchQuery;
		}

		const { runUnifiedView } = await import("./ui/unified-view.ts");
		const interactiveLoaderFilters: TaskListFilter = {};
		if (options.assignee) {
			interactiveLoaderFilters.assignee = options.assignee;
		}
		if (options.unassigned) {
			interactiveLoaderFilters.unassigned = true;
		}
		if (parentId) {
			interactiveLoaderFilters.parentTaskId = parentId;
		}
		// Assignee and parent stay loader filters because the view has no control for them.
		// Project deliberately does not: it travels in initialUnifiedFilter instead, so the
		// picker can widen it again. Loading a project-narrowed set would make that a no-op.
		const prefiltersDisplayList = Object.keys(interactiveLoaderFilters).length > 0;
		await runUnifiedView({
			core,
			initialView: "task-list",
			tasksLoader: async (updateProgress) => {
				updateProgress("Loading configuration...");
				const config = await core.filesystem.loadConfig();

				updateProgress("Loading local tasks...");
				const tasks = await core.queryTasks({
					filters: Object.keys(interactiveLoaderFilters).length > 0 ? interactiveLoaderFilters : undefined,
					includeCrossBranch: false,
				});

				// Throws before anything is displayed when the parent is missing or ambiguous.
				const resolvedParentId = parentId
					? await resolveParentFilterId(core, parentId, parentDisplayId ?? parentId)
					: undefined;

				let sortedTasks = tasks;
				if (options.sort) {
					const sortField = options.sort.toLowerCase();
					if (!TASK_SORT_FIELDS.includes(sortField)) {
						throw new Error(`Invalid sort field: ${options.sort}. Valid values are: ${TASK_SORT_FIELD_LIST}`);
					}
					sortedTasks = sortTasks(tasks, sortField, config?.priorities);
				} else {
					sortedTasks = sortTasks(tasks, "priority", config?.priorities);
				}

				let filtered = sortedTasks;
				if (resolvedParentId) {
					filtered = filtered.filter((task) => task.parentTaskId && taskIdsEqual(resolvedParentId, task.parentTaskId));
				}

				return {
					tasks: filtered,
					statuses: config?.statuses || [],
					// The filters above narrow what is displayed. Dependency readiness must still see
					// every task, or a dependency assigned to someone else reads as unknown.
					readinessTasks: prefiltersDisplayList ? await core.queryTasks({ includeCrossBranch: false }) : undefined,
				};
			},
			filter: initialUnifiedFilter,
		});
		cleanup();
	});

type EditCommandTarget = {
	label: string;
	pluralLabel: string;
	statuses: (core: Core) => Promise<string[]>;
	resolve: (core: Core, idOrSelectedPath: string) => Promise<Task | null>;
	listCandidates: (core: Core) => Promise<Task[]>;
	selectionValue: (candidate: Task) => string;
	update: (core: Core, existing: Task, input: TaskUpdateInput) => Promise<Task>;
	notFoundMessage: (id: string) => string;
};

const taskEditTarget: EditCommandTarget = {
	label: "Task",
	pluralLabel: "tasks",
	statuses: (core) => getValidStatuses(core),
	resolve: (core, id) => core.loadTaskById(id, { includeCrossBranch: false }),
	listCandidates: (core) => core.queryTasks({ includeCrossBranch: false }),
	selectionValue: (candidate) => candidate.id,
	update: (core, existing, input) => core.editTask(existing.id, input, undefined, { includeCrossBranch: false }),
	notFoundMessage: (id) => `Task ${id} not found. ${LOCAL_TASK_LOOKUP_HINT}`,
};

const draftEditTarget: EditCommandTarget = {
	label: "Draft",
	pluralLabel: "drafts",
	statuses: async () => ["Draft"],
	async resolve(core, idOrSelectedPath) {
		// The single resolution authority for every draft entry point: direct ids go through the
		// id resolver; wizard selections arrive as the selected row's file path and are validated
		// against that exact file. Path-form handles re-resolve through the id authority so a
		// duplicate numeric identity can never bypass ambiguity detection.
		if (isAbsolute(idOrSelectedPath)) {
			const draftsDir = await core.filesystem.getDraftsDir();
			if (dirname(idOrSelectedPath) !== draftsDir) {
				throw new Error(
					`Invalid draft id: ${idOrSelectedPath}. Use a draft id (for example DRAFT-1), or pick the draft through 'backlog draft edit'.`,
				);
			}
			const direct = await core.filesystem.draftReferenceFromPath(idOrSelectedPath);
			const resolved = await core.filesystem.resolveDraftReference(direct.canonicalId);
			if (!resolved || resolved.filePath !== idOrSelectedPath) {
				throw new AmbiguousIdError(
					"Draft",
					normalizeId(direct.canonicalId, DRAFT_PREFIX),
					[idOrSelectedPath],
					"Rename one file to a distinct numeric id, then make its frontmatter agree.",
				);
			}
			return { ...resolved.task, id: resolved.canonicalId, filePath: resolved.filePath };
		}
		const reference = await core.filesystem.resolveDraftReference(idOrSelectedPath);
		return reference ? { ...reference.task, id: reference.canonicalId, filePath: reference.filePath } : null;
	},
	listCandidates: (core) => core.filesystem.listHealthyDrafts(),
	selectionValue: (candidate) => candidate.filePath ?? candidate.id,
	update: (core, existing, input) => {
		if (!existing.filePath) {
			throw new Error(`Cannot update draft ${existing.id} without its file path.`);
		}
		return core.updateDraftFromInput({ filePath: existing.filePath, canonicalId: existing.id }, input);
	},
	notFoundMessage: (id) => `Draft ${id} not found.`,
};

async function runEditCommand(target: EditCommandTarget, requestedIds: string[] | undefined, options: OptionValues) {
	// Listing the same task twice is a slip, not a request to edit it twice, so identities that
	// compare equal collapse to the first spelling the user typed. Canonical identity keeps a bare
	// number on the default prefix, so "7" cannot swallow an explicit "JIRA-7".
	const taskIds: string[] = [];
	for (const value of requestedIds ?? []) {
		const trimmed = String(value).trim();
		if (!trimmed) continue;
		if (taskIds.some((seen) => canonicalTaskId(seen) === canonicalTaskId(trimmed))) continue;
		taskIds.push(trimmed);
	}
	const taskId = taskIds[0];
	const shouldUseWizard = hasInteractiveTTY && !hasEditFieldFlags(options);
	if (!shouldUseWizard && !taskId) {
		printMissingRequiredArgument("taskId");
		return;
	}

	if (taskIds.length > 1) {
		// These two guards run whether or not a terminal is attached: a batch means the same value is
		// written to every listed task, so a batch the CLI cannot apply must fail the same way in a
		// script and in a terminal rather than quietly becoming a wizard over the first ID.
		// --plain only chooses an output shape, so it never counts as a change to apply.
		if (!hasEditFieldFlags({ ...options, plain: undefined })) {
			console.error(
				`Cannot edit ${taskIds.length} ${target.pluralLabel} without any field flag. Pass the change to apply to every ${target.label.toLowerCase()}, for example --status "In Progress", or edit one ${target.label.toLowerCase()} at a time to use the interactive editor.`,
			);
			process.exitCode = 1;
			return;
		}
		const perTaskFlagError = findPerTaskOnlyFlag(options);
		if (perTaskFlagError) {
			console.error(perTaskFlagError);
			process.exitCode = 1;
			return;
		}
	}

	const cwd = await requireProjectRoot();
	const core = new Core(cwd);

	if (shouldUseWizard) {
		let selectedTaskId = taskId?.trim() || undefined;
		if (!selectedTaskId) {
			const candidates = await target.listCandidates(core);
			const taskOptions = candidates.map((candidate) => ({
				id: candidate.id,
				title: candidate.title,
				value: target.selectionValue(candidate),
			}));
			if (taskOptions.length === 0) {
				console.log(`No ${target.pluralLabel} found.`);
				return;
			}
			selectedTaskId = await pickTaskForEditWizard({ tasks: taskOptions });
			if (!selectedTaskId) {
				clack.cancel(`${target.label} edit cancelled.`);
				return;
			}
		}

		const existingTaskForWizard = await target.resolve(core, selectedTaskId);
		if (!existingTaskForWizard) {
			console.error(target.notFoundMessage(selectedTaskId));
			process.exitCode = 1;
			return;
		}

		const statuses = await target.statuses(core);
		const config = await core.filesystem.loadConfig();
		const wizardInput = await runTaskEditWizard({
			task: existingTaskForWizard,
			statuses,
			priorities: config?.priorities,
			types: config?.types,
			projects: config?.projects,
		});
		if (!wizardInput) {
			clack.cancel(`${target.label} edit cancelled.`);
			return;
		}

		try {
			const updatedTask = await target.update(core, existingTaskForWizard, wizardInput);
			console.log(`Updated ${target.label.toLowerCase()} ${updatedTask.id}`);
		} catch (error) {
			console.error(formatTaskEditError(error, existingTaskForWizard.id, target.label.toLowerCase()));
			process.exitCode = 1;
		}
		return;
	}

	// Resolve every listed ID first so an unresolvable or ambiguous ID is reported as its own failure
	// instead of aborting the tasks that did resolve. A single ID keeps the original one-error output.
	const resolvedTasks: Task[] = [];
	const editFailures: Array<{ taskId: string; message: string }> = [];
	for (const requestedId of taskIds) {
		try {
			const loaded = await target.resolve(core, requestedId);
			if (loaded) resolvedTasks.push(loaded);
			else editFailures.push({ taskId: requestedId, message: target.notFoundMessage(requestedId) });
		} catch (error) {
			editFailures.push({
				taskId: requestedId,
				message: formatTaskEditError(error, requestedId, target.label.toLowerCase()),
			});
		}
	}

	const existingTask = resolvedTasks[0];
	if (!existingTask) {
		for (const failure of editFailures) {
			console.error(failure.message);
		}
		process.exitCode = 1;
		return;
	}

	let canonicalStatus: string | undefined;
	if (options.status) {
		const validStatuses = await target.statuses(core);
		const canonical = await getCanonicalStatus(String(options.status), core, validStatuses);
		if (!canonical) {
			console.error(`Invalid status: ${options.status}. Valid statuses are: ${formatValidStatuses(validStatuses)}`);
			process.exitCode = 1;
			return;
		}
		canonicalStatus = canonical;
	}

	let normalizedPriority: string | undefined;
	if (options.priority) {
		const priority = await normalizeCliPriority(core, String(options.priority));
		if (!priority) {
			return;
		}
		normalizedPriority = priority;
	}

	let ordinalValue: number | undefined;
	if (options.ordinal !== undefined) {
		const parsed = Number(options.ordinal);
		if (Number.isNaN(parsed) || parsed < 0) {
			console.error(`Invalid ordinal: ${options.ordinal}. Must be a non-negative number.`);
			process.exitCode = 1;
			return;
		}
		ordinalValue = parsed;
	}

	if (options.milestone !== undefined && options.clearMilestone) {
		console.error("Cannot use --milestone and --clear-milestone together.");
		process.exitCode = 1;
		return;
	}
	if (options.dueDate !== undefined && options.clearDueDate) {
		console.error("Cannot use --due-date and --clear-due-date together.");
		process.exitCode = 1;
		return;
	}

	let milestoneValue: string | null | undefined;
	if (typeof options.milestone === "string") {
		milestoneValue = await resolveCliMilestoneInput(core, options.milestone);
	} else if (options.clearMilestone) {
		milestoneValue = null;
	}

	let removeCriteria: number[] | undefined;
	let checkCriteria: number[] | undefined;
	let uncheckCriteria: number[] | undefined;
	let removeDod: number[] | undefined;
	let checkDod: number[] | undefined;
	let uncheckDod: number[] | undefined;

	try {
		const removes = parsePositiveIndexList(options.removeAc);
		if (removes.length > 0) {
			removeCriteria = removes;
		}
		const checks = parsePositiveIndexList(options.checkAc);
		if (checks.length > 0) {
			checkCriteria = checks;
		}
		const unchecks = parsePositiveIndexList(options.uncheckAc);
		if (unchecks.length > 0) {
			uncheckCriteria = unchecks;
		}
		const dodRemoves = parsePositiveIndexList(options.removeDod);
		if (dodRemoves.length > 0) {
			removeDod = dodRemoves;
		}
		const dodChecks = parsePositiveIndexList(options.checkDod);
		if (dodChecks.length > 0) {
			checkDod = dodChecks;
		}
		const dodUnchecks = parsePositiveIndexList(options.uncheckDod);
		if (dodUnchecks.length > 0) {
			uncheckDod = dodUnchecks;
		}
	} catch (error) {
		console.error(formatTaskEditError(error, existingTask.id, target.label.toLowerCase()));
		process.exitCode = 1;
		return;
	}

	if (
		options.clearLabels &&
		(options.label !== undefined || options.addLabel !== undefined || options.removeLabel !== undefined)
	) {
		console.error(
			"Cannot combine --clear-labels with --label, --add-label, or --remove-label. Use --clear-labels by itself, or --label a,b for the final full label set.",
		);
		process.exitCode = 1;
		return;
	}

	if (options.label !== undefined && (options.addLabel !== undefined || options.removeLabel !== undefined)) {
		console.error(
			"Cannot combine --label with --add-label or --remove-label. Use --label a,b for the final full label set, or use add/remove flags without --label.",
		);
		process.exitCode = 1;
		return;
	}

	const hasIncrementalAcceptanceCriteriaMutation =
		options.ac !== undefined ||
		options.removeAc !== undefined ||
		options.checkAc !== undefined ||
		options.uncheckAc !== undefined;
	if (options.clearAc && (options.acceptanceCriteria !== undefined || hasIncrementalAcceptanceCriteriaMutation)) {
		console.error(
			"Cannot combine --clear-ac with --acceptance-criteria, --ac, --remove-ac, --check-ac, or --uncheck-ac. Use --clear-ac by itself.",
		);
		process.exitCode = 1;
		return;
	}
	if (options.acceptanceCriteria !== undefined && hasIncrementalAcceptanceCriteriaMutation) {
		console.error(
			"Cannot combine --acceptance-criteria with --ac, --remove-ac, --check-ac, or --uncheck-ac. Use replacement by itself, or use only incremental operations.",
		);
		process.exitCode = 1;
		return;
	}

	const labelValues = parseDelimitedStringList(options.label) ?? [];
	const addLabelValues = parseDelimitedStringList(options.addLabel) ?? [];
	const removeLabelValues = parseDelimitedStringList(options.removeLabel) ?? [];
	const assigneeValues = parseClearableStringList(options.assignee);
	const acceptanceAdditions = processAcceptanceCriteriaOptions({ ac: options.ac });
	const acceptanceReplacement = processAcceptanceCriteriaOptions({
		acceptanceCriteria: options.acceptanceCriteria,
	});
	const definitionOfDoneAdditions = toStringArray(options.dod)
		.map((value) => String(value).trim())
		.filter((value) => value.length > 0);

	const clearableListError = validateTaskListFlags(options, { supportsClearFlags: true });
	if (clearableListError) {
		console.error(clearableListError);
		process.exitCode = 1;
		return;
	}

	if (options.ref !== undefined && (options.addRef !== undefined || options.removeRef !== undefined)) {
		console.error(
			"Cannot combine --ref with --add-ref or --remove-ref. Use --ref a,b for the final full reference set, or use add/remove flags without --ref.",
		);
		process.exitCode = 1;
		return;
	}
	// These three read as clearable lists: an absent flag keeps the current list, and an explicit
	// empty value produces [], which the assignments below apply as the same clear as --clear-deps.
	const dependencyValues = parseClearableStringList([
		...toStringArray(options.dependsOn),
		...toStringArray(options.dep),
	]);

	const normalizedReferences = parseClearableStringList(options.ref);
	const addReferenceValues = parseDelimitedStringList(options.addRef) ?? [];
	const removeReferenceValues = parseDelimitedStringList(options.removeRef) ?? [];
	const normalizedDocumentation = parseClearableStringList(options.doc);
	const normalizedModifiedFiles = parseDelimitedStringList(options.modifiedFile);

	const planAppendValues = toStringArray(options.appendPlan);
	const notesAppendValues = toStringArray(options.appendNotes);
	const commentsAppendValues = toStringArray(options.comment);
	const finalSummaryAppendValues = toStringArray(options.appendFinalSummary);

	const editArgs: TaskEditArgs = {};
	if (options.title) {
		editArgs.title = String(options.title);
	}
	const descriptionOption = options.description ?? options.desc;
	if (descriptionOption !== undefined) {
		editArgs.description = String(descriptionOption);
	}
	if (canonicalStatus) {
		editArgs.status = canonicalStatus;
	}
	if (normalizedPriority) {
		editArgs.priority = normalizedPriority;
	}
	if (options.type !== undefined) {
		editArgs.type = String(options.type);
	}
	if (options.project !== undefined) {
		editArgs.project = String(options.project);
	}
	if (ordinalValue !== undefined) {
		editArgs.ordinal = ordinalValue;
	}
	if (milestoneValue !== undefined) {
		editArgs.milestone = milestoneValue;
	}
	if (typeof options.dueDate === "string") {
		editArgs.dueDate = options.dueDate;
	} else if (options.clearDueDate) {
		editArgs.dueDate = null;
	}
	if (labelValues.length > 0) {
		editArgs.labels = labelValues;
	} else if (options.clearLabels) {
		editArgs.labels = [];
	}
	if (addLabelValues.length > 0) {
		editArgs.addLabels = addLabelValues;
	}
	if (removeLabelValues.length > 0) {
		editArgs.removeLabels = removeLabelValues;
	}
	if (assigneeValues) {
		editArgs.assignee = assigneeValues;
	}
	if (dependencyValues) {
		editArgs.dependencies = dependencyValues;
	} else if (options.clearDeps) {
		editArgs.dependencies = [];
	}
	if (normalizedReferences) {
		editArgs.references = normalizedReferences;
	} else if (options.clearRefs) {
		editArgs.references = [];
	}
	if (addReferenceValues.length > 0) {
		editArgs.addReferences = addReferenceValues;
	}
	if (removeReferenceValues.length > 0) {
		editArgs.removeReferences = removeReferenceValues;
	}
	if (normalizedDocumentation) {
		editArgs.documentation = normalizedDocumentation;
	} else if (options.clearDocs) {
		editArgs.documentation = [];
	}
	if (normalizedModifiedFiles && normalizedModifiedFiles.length > 0) {
		editArgs.modifiedFiles = normalizedModifiedFiles;
	}
	if (typeof options.plan === "string") {
		editArgs.planSet = String(options.plan);
	}
	if (typeof options.notes === "string") {
		editArgs.notesSet = String(options.notes);
	}
	if (planAppendValues.length > 0) {
		editArgs.planAppend = planAppendValues;
	}
	if (notesAppendValues.length > 0) {
		editArgs.notesAppend = notesAppendValues;
	}
	if (commentsAppendValues.length > 0) {
		editArgs.commentsAppend = commentsAppendValues;
	}
	if (typeof options.commentAuthor === "string") {
		editArgs.commentAuthor = String(options.commentAuthor);
	}
	if (typeof options.finalSummary === "string") {
		editArgs.finalSummary = String(options.finalSummary);
	}
	if (finalSummaryAppendValues.length > 0) {
		editArgs.finalSummaryAppend = finalSummaryAppendValues;
	}
	if (options.clearFinalSummary) {
		editArgs.finalSummaryClear = true;
	}
	if (options.clearAc) {
		editArgs.acceptanceCriteriaSet = [];
	} else if (options.acceptanceCriteria !== undefined) {
		editArgs.acceptanceCriteriaSet = acceptanceReplacement;
	}
	if (acceptanceAdditions.length > 0) {
		editArgs.acceptanceCriteriaAdd = acceptanceAdditions;
	}
	if (removeCriteria) {
		editArgs.acceptanceCriteriaRemove = removeCriteria;
	}
	if (checkCriteria) {
		editArgs.acceptanceCriteriaCheck = checkCriteria;
	}
	if (uncheckCriteria) {
		editArgs.acceptanceCriteriaUncheck = uncheckCriteria;
	}
	if (definitionOfDoneAdditions.length > 0) {
		editArgs.definitionOfDoneAdd = definitionOfDoneAdditions;
	}
	if (removeDod) {
		editArgs.definitionOfDoneRemove = removeDod;
	}
	if (checkDod) {
		editArgs.definitionOfDoneCheck = checkDod;
	}
	if (uncheckDod) {
		editArgs.definitionOfDoneUncheck = uncheckDod;
	}

	if (taskIds.length === 1) {
		let updatedTask: Task;
		try {
			updatedTask = await target.update(core, existingTask, buildTaskUpdateInput(editArgs));
		} catch (error) {
			console.error(formatTaskEditError(error, existingTask.id, target.label.toLowerCase()));
			process.exitCode = 1;
			return;
		}

		if (isPlainRequested(options)) {
			console.log(formatTaskPlainText(updatedTask));
			return;
		}

		console.log(`Updated ${target.label.toLowerCase()} ${updatedTask.id}`);
		return;
	}

	// A batch writes the same change to independent files, so one failure must not stop the rest.
	// The outcome of each task is the useful output here, so a batch reports one line per task
	// rather than repeating a full task body for every ID.
	for (const task of resolvedTasks) {
		try {
			const updated = await target.update(core, task, buildTaskUpdateInput(editArgs));
			console.log(`Updated ${target.label.toLowerCase()} ${updated.id}`);
		} catch (error) {
			editFailures.push({ taskId: task.id, message: formatTaskEditError(error, task.id, target.label.toLowerCase()) });
		}
	}

	for (const failure of editFailures) {
		console.error(`Failed to update ${failure.taskId}: ${failure.message}`);
	}
	if (editFailures.length > 0) {
		process.exitCode = 1;
	}
}

function addEditFieldOptions(cmd: Command) {
	return cmd
		.option("-t, --title <title>")
		.option("-d, --description <text>", "task description")
		.option("--desc <text>", "alias for --description")
		.option(
			"-a, --assignee <assignees>",
			'replace all task assignees with one or more @names (comma-separated or repeatable); pass "" to clear them',
			createMultiValueAccumulator(),
		)
		.option("-s, --status <status>")
		.option(
			"-l, --label <labels>",
			"replace all task labels (comma-separated or repeatable; cannot combine with --add-label/--remove-label)",
			createMultiValueAccumulator(),
		)
		.option("--priority <priority>", "set task priority (configured priorities)")
		.option("--type <type>", "set task type (configured task types; pass an empty value to clear)")
		.option("--project <project>", "set task project (configured projects; pass an empty value to clear)")
		.option("--due-date <datetime>", "set due date as a UTC datetime")
		.option("--clear-due-date", "clear task due date")
		.option("--ordinal <number>", "set task ordinal for custom ordering")
		.option("-m, --milestone <milestone>", "assign task to milestone by ID or title")
		.option("--clear-milestone", "clear task milestone assignment")
		.option("--plain", "use plain text output after editing")
		.option(
			"--add-label <labels>",
			"add task labels without replacing existing labels (comma-separated or repeatable)",
			createMultiValueAccumulator(),
		)
		.option(
			"--remove-label <labels>",
			"remove task labels without replacing others (comma-separated or repeatable)",
			createMultiValueAccumulator(),
		)
		.option("--clear-labels", "remove all task labels (cannot combine with --label/--add-label/--remove-label)")
		.option("--ac <criteria>", "add acceptance criteria (can be used multiple times)", createMultiValueAccumulator())
		.option("--dod <item>", "add Definition of Done item (can be used multiple times)", createMultiValueAccumulator())
		.option(
			"--remove-ac <index>",
			"remove acceptance criterion by index (1-based, can be used multiple times)",
			createMultiValueAccumulator(),
		)
		.option(
			"--remove-dod <index>",
			"remove Definition of Done item by index (1-based, can be used multiple times)",
			createMultiValueAccumulator(),
		)
		.option(
			"--check-ac <index>",
			"check acceptance criterion by index (1-based, can be used multiple times)",
			createMultiValueAccumulator(),
		)
		.option(
			"--check-dod <index>",
			"check Definition of Done item by index (1-based, can be used multiple times)",
			createMultiValueAccumulator(),
		)
		.option(
			"--uncheck-ac <index>",
			"uncheck acceptance criterion by index (1-based, can be used multiple times)",
			createMultiValueAccumulator(),
		)
		.option(
			"--uncheck-dod <index>",
			"uncheck Definition of Done item by index (1-based, can be used multiple times)",
			createMultiValueAccumulator(),
		)
		.option(
			"--acceptance-criteria <criteria>",
			"replace all acceptance criteria (can be used multiple times; commas are preserved)",
			createMultiValueAccumulator(),
		)
		.option("--clear-ac", "remove all acceptance criteria (cannot combine with acceptance criteria mutation options)")
		.option("--plan <text>", "set implementation plan")
		.option("--notes <text>", "set implementation notes (replaces existing)")
		.option(
			"--comment <text>",
			"append a task comment; standalone '---' lines are reserved (can be used multiple times)",
			createMultiValueAccumulator(),
		)
		.option("--comment-author <author>", "author to record for appended comments")
		.option("--final-summary <text>", "set final summary (replaces existing)")
		.option(
			"--append-plan <text>",
			"append after --plan replacement (can be used multiple times)",
			createMultiValueAccumulator(),
		)
		.option(
			"--append-notes <text>",
			"append to implementation notes (can be used multiple times)",
			createMultiValueAccumulator(),
		)
		.option(
			"--append-final-summary <text>",
			"append to final summary (can be used multiple times)",
			createMultiValueAccumulator(),
		)
		.option("--clear-final-summary", "remove final summary")
		.option("--clear-deps", "remove all task dependencies (cannot combine with --depends-on or --dep)")
		.option(
			"--depends-on <taskIds>",
			'set task dependencies (comma-separated or use multiple times); pass "" to clear them',
			(value, previous) => {
				const soFar = Array.isArray(previous) ? previous : previous ? [previous] : [];
				return [...soFar, value];
			},
		)
		.option("--dep <taskIds>", "set task dependencies (shortcut for --depends-on)", (value, previous) => {
			const soFar = Array.isArray(previous) ? previous : previous ? [previous] : [];
			return [...soFar, value];
		})
		.option(
			"--ref <reference>",
			'replace all references (comma-separated or repeatable; cannot combine with --add-ref/--remove-ref); pass "" to clear them',
			createMultiValueAccumulator(),
		)
		.option(
			"--add-ref <reference>",
			"add references without replacing existing references (comma-separated or repeatable)",
			createMultiValueAccumulator(),
		)
		.option(
			"--remove-ref <reference>",
			"remove references without replacing others (comma-separated or repeatable)",
			createMultiValueAccumulator(),
		)
		.option("--clear-refs", "remove all references (cannot combine with --ref/--add-ref/--remove-ref)")
		.option(
			"--modified-file <path>",
			"set modified file paths from project root (can be used multiple times)",
			(value, previous) => {
				const soFar = Array.isArray(previous) ? previous : previous ? [previous] : [];
				return [...soFar, value];
			},
		)
		.option(
			"--doc <documentation>",
			'set documentation (can be used multiple times); pass "" to clear it',
			(value, previous) => {
				const soFar = Array.isArray(previous) ? previous : previous ? [previous] : [];
				return [...soFar, value];
			},
		)
		.option("--clear-docs", "remove all documentation (cannot combine with --doc)");
}

const taskEditCommand = addHelpSchema(taskCmd.command("edit [taskIds...]"), {
	required: [
		{
			name: "taskIds",
			type: "Task IDs",
			description:
				"Tasks to update; prompted when omitted in interactive mode. Several IDs apply the same shared-field change to every task",
		},
	],
	optional: [
		{ name: "title", type: "String", description: "Replacement task title" },
		{ name: "description", type: "Markdown", description: "Replacement description" },
		{ name: "status", type: statusType, description: "Project task status; case-insensitive" },
		{ name: "type", type: taskType, description: "Replacement task type; case-insensitive" },
		{
			name: "project",
			type: projectType,
			description: "Replacement task project; case-insensitive; pass an empty value to clear",
		},
		{ name: "due-date", type: "UTC datetime", description: "Set the task due date and time" },
		{ name: "clear-due-date", type: "Boolean", description: "Clear the task due date" },
		{
			name: "assignee",
			type: "Comma-separated strings",
			description: 'Replace all assignees; repeat -a or use @name1,@name2; -a "" clears them',
		},
		{
			name: "label",
			type: "Comma-separated strings",
			description: "Replace all labels; repeat --label or use label1,label2",
		},
		{
			name: "add-label",
			type: "Comma-separated strings",
			description: "Add labels; repeat --add-label or use label1,label2",
		},
		{
			name: "remove-label",
			type: "Comma-separated strings",
			description: "Remove labels; repeat --remove-label or use label1,label2",
		},
		{
			name: "clear-labels",
			type: "Boolean",
			description: "Remove all labels; cannot combine with other label flags",
		},
		{
			name: "clear-deps",
			type: "Boolean",
			description: "Remove all task dependencies; cannot combine with dependency flags",
		},
		{
			name: "add-ref",
			type: "Comma-separated strings",
			description: "Add references; repeat --add-ref or use ref1,ref2",
		},
		{
			name: "remove-ref",
			type: "Comma-separated strings",
			description: "Remove references; repeat --remove-ref or use ref1,ref2",
		},
		{
			name: "clear-refs",
			type: "Boolean",
			description: "Remove all references; cannot combine with --ref, --add-ref, or --remove-ref",
		},
		{
			name: "clear-docs",
			type: "Boolean",
			description: "Remove all documentation; cannot combine with --doc",
		},
		{ name: "plan", type: "Markdown", description: "Replacement implementation plan" },
		{
			name: "append-plan",
			type: "Markdown",
			description: "Append after --plan replacement; repeatable",
		},
		{ name: "notes", type: "Markdown", description: "Replacement implementation notes" },
		{ name: "append-notes", type: "Markdown", description: "Append to implementation notes; repeatable" },
		{ name: "comment", type: "Markdown", description: "Append a discussion comment" },
		{ name: "final-summary", type: "Markdown", description: "Completion summary" },
		{ name: "append-final-summary", type: "Markdown", description: "Append to final summary; repeatable" },
		{ name: "check-ac", type: "Integer", description: "1-based acceptance criterion index" },
	],
	writes: "Updates task metadata and structured task sections through Backlog.md",
	output: "Updated task details; use --plain for text output",
	examples: [
		'backlog task edit {{TASK_ID:1}} --status "<active status>" -a @sara',
		`backlog task edit {{TASK_ID:1}} --type ${TASK_TYPE_EXAMPLE}`,
		"backlog task edit {{TASK_ID:1}} --check-ac 1",
		'backlog task edit {{TASK_ID:1}} {{TASK_ID:2}} --status "<active status>"',
	],
}).description("edit an existing task");
addEditFieldOptions(taskEditCommand).action(async (taskIds: string[] | undefined, options) => {
	await runEditCommand(taskEditTarget, taskIds, options);
});

// Note: Implementation notes appending is handled via `task edit --append-notes` only.

addHelpSchema(taskCmd.command("view <taskId>"), {
	reads: "Task metadata, description, plan, notes, comments, final summary, AC, and DoD",
	required: [{ name: "taskId", type: "Task ID", description: "Task to display" }],
	optional: [
		{ name: "plain", type: "Boolean", description: "Use text output instead of interactive UI" },
		{ name: "json", type: "Boolean", description: "Use versioned machine-readable JSON output" },
	],
	output: "Interactive task detail view, plain text with --plain, or versioned JSON with --json",
	examples: ["backlog task view {{TASK_ID:1}} --plain", "backlog task view {{TASK_ID:1}} --json"],
})
	.description("display task details")
	.option("--plain", "use plain text output instead of interactive UI")
	.option("--json", "print versioned machine-readable JSON output")
	.action(async (taskId: string, options) => {
		const outputMode = getTaskReadOutputMode(options);
		if (!outputMode) return;
		const cwd = await requireProjectRoot();
		const core = new Core(cwd);
		const localTasks = await core.fs.listTasks();
		const task = await core.getTaskWithSubtasks(taskId, localTasks, { includeCrossBranch: false });
		if (!task) {
			console.error(`Task ${taskId} not found. ${LOCAL_TASK_LOOKUP_HINT}`);
			process.exitCode = 1;
			return;
		}

		const allTasks = localTasks.some((candidate) => taskIdsEqual(task.id, candidate.id))
			? localTasks
			: [...localTasks, task];

		// Plain text output for non-interactive environments
		if (outputMode === "json") {
			printJson(taskViewJson(task, cwd));
			return;
		}

		if (outputMode === "plain") {
			console.log(formatTaskPlainText(task));
			return;
		}

		// Use enhanced task viewer with detail focus
		await viewTaskEnhanced(task, { startWithDetailFocus: true, core, tasks: allTasks });
	});

addHelpSchema(taskCmd.command("archive <taskId>"), {
	required: [{ name: "taskId", type: "Task ID", description: "Task to archive" }],
	optional: [],
	writes: "Moves a task that should not be completed into the archive",
	output: "Archive confirmation text",
	examples: ["backlog task archive {{TASK_ID:1}}"],
})
	.description("archive a task")
	.action(async (taskId: string) => {
		const cwd = await requireProjectRoot();
		const core = new Core(cwd);
		const task = await core.loadTaskById(taskId, { includeCrossBranch: false });
		if (!task) {
			console.error(`Task ${taskId} not found. ${LOCAL_TASK_LOOKUP_HINT}`);
			process.exitCode = 1;
			return;
		}

		if (!isLocalEditableTask(task)) {
			console.error(`Cannot archive task from another branch: ${task.id}`);
			process.exitCode = 1;
			return;
		}

		const config = await core.filesystem.loadConfig();
		const statuses = config?.statuses ?? [...DEFAULT_STATUSES];
		const terminalStatus = getTerminalStatus(statuses) ?? "Done";
		if (isTerminalStatus(task.status, statuses)) {
			console.error(
				`Task ${task.id} is ${terminalStatus}. ${terminalStatus} tasks should be completed, not archived. Use: backlog task complete ${task.id}`,
			);
			process.exitCode = 1;
			return;
		}

		const success = await core.archiveTask(task.id, undefined, { includeCrossBranch: false });
		if (success) {
			console.log(`Archived task ${task.id}`);
		} else {
			console.error(`Failed to archive task: ${task.id}`);
			process.exitCode = 1;
		}
	});

addHelpSchema(taskCmd.command("complete <taskId>"), {
	required: [
		{
			name: "taskId",
			type: "Task ID",
			description: "Task in the configured terminal status to move to completed",
		},
	],
	optional: [],
	writes:
		"WARNING: This is a cleanup procedure. It moves a terminal-status task to completed, removes it from the active Kanban board, and should only be used for cleanup/archive purposes.",
	output: "Completion cleanup confirmation and completed file path",
	examples: ["backlog task complete {{TASK_ID:1}}"],
})
	.description("cleanup/archive a terminal-status task into completed")
	.addHelpText(
		"before",
		"\nWarning: This is a cleanup procedure. It will make the task disappear from the active Kanban board and should only be used for cleanup/archive purposes.\n",
	)
	.action(async (taskId: string) => {
		const cwd = await requireProjectRoot();
		const core = new Core(cwd);
		const task = await core.loadTaskById(taskId, { includeCrossBranch: false });

		if (!task) {
			console.error(`Task ${taskId} not found. ${LOCAL_TASK_LOOKUP_HINT}`);
			process.exitCode = 1;
			return;
		}

		if (!isLocalEditableTask(task)) {
			console.error(`Cannot complete task from another branch: ${task.id}`);
			process.exitCode = 1;
			return;
		}

		const config = await core.filesystem.loadConfig();
		const statuses = config?.statuses ?? [...DEFAULT_STATUSES];
		const terminalStatus = getTerminalStatus(statuses) ?? "Done";
		if (!isTerminalStatus(task.status, statuses)) {
			console.error(
				`Task ${task.id} is not ${terminalStatus}. Set status to "${terminalStatus}" with: backlog task edit ${task.id} -s "${terminalStatus}" before cleanup.`,
			);
			process.exitCode = 1;
			return;
		}

		const completedFilePath = task.filePath ? join(core.filesystem.completedDir, basename(task.filePath)) : undefined;
		const success = await core.completeTask(task.id, undefined, { includeCrossBranch: false });
		if (!success) {
			console.error(`Failed to complete task: ${task.id}`);
			process.exitCode = 1;
			return;
		}

		console.log(`Completed task ${task.id}.`);
		if (completedFilePath) {
			console.log(`File: ${completedFilePath}`);
		}
	});

taskCmd
	.command("demote <taskId>")
	.description("move task back to drafts")
	.action(async (taskId: string) => {
		const cwd = await requireProjectRoot();
		const core = new Core(cwd);
		try {
			const task = await core.loadTaskById(taskId, { includeCrossBranch: false });
			if (task && (await core.demoteTask(task.id, undefined, { includeCrossBranch: false }))) {
				console.log(`Demoted task ${task.id}`);
			} else {
				console.error(`Task ${taskId} not found. ${LOCAL_TASK_LOOKUP_HINT}`);
				process.exitCode = 1;
			}
		} catch (error) {
			console.error(error instanceof Error ? error.message : String(error));
			process.exitCode = 1;
		}
	});

taskCmd
	.argument("[taskId]")
	.option("--plain", "use plain text output")
	.option("--json", "print versioned machine-readable JSON output")
	.action(async (taskId: string | undefined, options: { json?: boolean; plain?: boolean }) => {
		const outputMode = getReadOutputMode(options);
		if (!outputMode) return;
		const cwd = await requireProjectRoot();
		const core = new Core(cwd);

		// Don't handle commands that should be handled by specific command handlers
		const reservedCommands = ["create", "list", "edit", "view", "archive", "complete", "demote"];
		if (taskId && reservedCommands.includes(taskId)) {
			console.error(`Unknown command: ${taskId}`);
			taskCmd.help();
			return;
		}

		// Handle single task view only
		if (!taskId) {
			taskCmd.help();
			return;
		}

		const localTasks = await core.fs.listTasks();
		const task = await core.getTaskWithSubtasks(taskId, localTasks, { includeCrossBranch: false });
		if (!task) {
			console.error(`Task ${taskId} not found. ${LOCAL_TASK_LOOKUP_HINT}`);
			process.exitCode = 1;
			return;
		}

		const allTasks = localTasks.some((candidate) => taskIdsEqual(task.id, candidate.id))
			? localTasks
			: [...localTasks, task];

		// Plain text output for non-interactive environments
		if (outputMode === "json") {
			printJson(taskViewJson(task, cwd));
			return;
		}

		if (outputMode === "plain") {
			console.log(formatTaskPlainText(task));
			return;
		}

		// Use unified view with detail focus and Tab switching support
		const { runUnifiedView } = await import("./ui/unified-view.ts");
		await runUnifiedView({
			core,
			initialView: "task-detail",
			selectedTask: task,
			tasks: allTasks,
		});
	});

async function viewDraftById(core: Core, taskId: string, options?: { plain?: boolean }): Promise<void> {
	try {
		const draft = await core.filesystem.loadDraft(taskId);
		if (!draft) {
			console.error(`Draft ${taskId} not found.`);
			return;
		}
		const usePlainOutput = isPlainRequested(options) || shouldAutoPlain;
		if (usePlainOutput) {
			console.log(formatTaskPlainText(draft));
			return;
		}
		await viewTaskEnhanced(draft, { startWithDetailFocus: true, core });
	} catch (error) {
		if (isAmbiguousIdError(error)) {
			console.error(error.message);
			process.exitCode = 1;
			return;
		}
		throw error;
	}
}

const draftCmd = program.command("draft");

draftCmd
	.command("list")
	.description("list all drafts")
	.option("--sort <field>", `sort drafts by field (${TASK_SORT_FIELD_LIST})`)
	.option("--plain", "use plain text output")
	.action(async (options: { plain?: boolean; sort?: string }) => {
		const cwd = await requireProjectRoot();
		const core = new Core(cwd);
		await core.ensureConfigLoaded();
		const drafts = await core.filesystem.listDrafts();

		if (!drafts || drafts.length === 0) {
			console.log("No drafts found.");
			return;
		}

		// Apply sorting - default to priority sorting like the web UI
		const { sortTasks } = await import("./utils/task-sorting.ts");
		const config = await core.filesystem.loadConfig();
		let sortedDrafts = drafts;

		if (options.sort) {
			const sortField = options.sort.toLowerCase();
			if (!TASK_SORT_FIELDS.includes(sortField)) {
				console.error(`Invalid sort field: ${options.sort}. Valid values are: ${TASK_SORT_FIELD_LIST}`);
				process.exitCode = 1;
				return;
			}
			sortedDrafts = sortTasks(drafts, sortField, config?.priorities);
		} else {
			// Default to priority sorting to match web UI behavior
			sortedDrafts = sortTasks(drafts, "priority", config?.priorities);
		}

		const usePlainOutput = isPlainRequested(options) || shouldAutoPlain;
		if (usePlainOutput) {
			// Plain text output for non-interactive environments
			console.log("Drafts:");
			for (const draft of sortedDrafts) {
				const priorityIndicator = draft.priority ? `[${draft.priority.toUpperCase()}] ` : "";
				console.log(`  ${priorityIndicator}${draft.id} - ${draft.title}`);
			}
		} else {
			// Interactive UI - use unified view with draft support
			const firstDraft = sortedDrafts[0];
			if (!firstDraft) return;

			const { runUnifiedView } = await import("./ui/unified-view.ts");
			await runUnifiedView({
				core,
				initialView: "task-list",
				selectedTask: firstDraft,
				tasks: sortedDrafts,
				filter: {
					filterDescription: "All Drafts",
				},
				title: "Drafts",
			});
		}
	});

draftCmd
	.command("create <title>")
	.option("-d, --description <text>", "task description (multi-line: include real newlines inside the quoted string)")
	.option("--desc <text>", "alias for --description")
	.option(
		"-a, --assignee <assignees>",
		'assign draft to one or more @names (comma-separated or repeatable); pass "" to leave it unassigned',
		createMultiValueAccumulator(),
	)
	.option("-s, --status <status>")
	.option("-l, --labels <labels>", "add draft labels (comma-separated or repeatable)", createMultiValueAccumulator())
	.action(async (title: string, options) => {
		const cwd = await requireProjectRoot();
		const core = new Core(cwd);
		await core.ensureConfigLoaded();
		try {
			const { task, filePath } = await core.createTaskFromInput({
				title,
				description: options.description || options.desc ? String(options.description || options.desc) : undefined,
				status: "Draft",
				assignee: parseClearableStringList(options.assignee),
				labels: parseDelimitedStringList(options.labels),
			});
			console.log(`Created draft ${task.id}`);
			console.log(`File: ${filePath}`);
		} catch (error) {
			console.error(error instanceof Error ? error.message : String(error));
			process.exitCode = 1;
		}
	});

const draftEditCommand = addHelpSchema(draftCmd.command("edit [taskId]"), {
	required: [
		{ name: "taskId", type: "Draft ID", description: "Draft to update; prompted when omitted in interactive mode" },
	],
	optional: [
		{ name: "title", type: "String", description: "Replacement draft title" },
		{ name: "description", type: "Markdown", description: "Replacement description" },
		{ name: "status", type: "String", description: 'Only "Draft" is valid; drafts cannot change status' },
		{ name: "type", type: taskType, description: "Replacement task type; case-insensitive" },
		{
			name: "project",
			type: projectType,
			description: "Replacement task project; case-insensitive; pass an empty value to clear",
		},
		{ name: "due-date", type: "UTC datetime", description: "Set the due date and time" },
		{ name: "clear-due-date", type: "Boolean", description: "Clear the due date" },
		{
			name: "assignee",
			type: "Comma-separated strings",
			description: 'Replace all assignees; repeat -a or use @name1,@name2; -a "" clears them',
		},
		{ name: "label", type: "Comma-separated strings", description: "Replace all labels; repeatable" },
		{ name: "add-label", type: "Comma-separated strings", description: "Add labels; repeatable" },
		{ name: "remove-label", type: "Comma-separated strings", description: "Remove labels; repeatable" },
		{ name: "clear-labels", type: "Boolean", description: "Remove all labels" },
		{ name: "priority", type: "String", description: "Set priority (configured priorities)" },
		{ name: "ordinal", type: "Number", description: "Set ordinal for custom ordering" },
		{ name: "milestone", type: "String", description: "Assign to milestone by ID or title" },
		{ name: "clear-milestone", type: "Boolean", description: "Clear the milestone assignment" },
		{ name: "ac", type: "Comma-separated strings", description: "Add acceptance criteria; repeatable" },
		{ name: "acceptance-criteria", type: "Comma-separated strings", description: "Replace all acceptance criteria" },
		{ name: "clear-ac", type: "Boolean", description: "Remove all acceptance criteria" },
		{ name: "remove-ac", type: "Integer", description: "Remove acceptance criterion by 1-based index; repeatable" },
		{ name: "check-ac", type: "Integer", description: "Check acceptance criterion by 1-based index; repeatable" },
		{ name: "uncheck-ac", type: "Integer", description: "Uncheck acceptance criterion by 1-based index; repeatable" },
		{ name: "dod", type: "Comma-separated strings", description: "Add Definition of Done items; repeatable" },
		{ name: "remove-dod", type: "Integer", description: "Remove Definition of Done item by index; repeatable" },
		{ name: "check-dod", type: "Integer", description: "Check Definition of Done item by index; repeatable" },
		{ name: "uncheck-dod", type: "Integer", description: "Uncheck Definition of Done item by index; repeatable" },
		{ name: "plan", type: "Markdown", description: "Replacement implementation plan" },
		{ name: "append-plan", type: "Markdown", description: "Append after --plan replacement; repeatable" },
		{ name: "notes", type: "Markdown", description: "Replacement implementation notes" },
		{ name: "append-notes", type: "Markdown", description: "Append to implementation notes; repeatable" },
		{ name: "comment", type: "Markdown", description: "Append a discussion comment; repeatable" },
		{ name: "comment-author", type: "String", description: "Author to record for appended comments" },
		{ name: "final-summary", type: "Markdown", description: "Completion summary" },
		{ name: "append-final-summary", type: "Markdown", description: "Append to final summary; repeatable" },
		{ name: "clear-final-summary", type: "Boolean", description: "Remove final summary" },
		{ name: "depends-on", type: "Comma-separated strings", description: 'Set dependencies; pass "" to clear' },
		{ name: "dep", type: "Comma-separated strings", description: "Set dependencies (shortcut for --depends-on)" },
		{ name: "clear-deps", type: "Boolean", description: "Remove all dependencies" },
		{ name: "ref", type: "Comma-separated strings", description: 'Replace all references; pass "" to clear' },
		{ name: "add-ref", type: "Comma-separated strings", description: "Add references; repeatable" },
		{ name: "remove-ref", type: "Comma-separated strings", description: "Remove references; repeatable" },
		{ name: "clear-refs", type: "Boolean", description: "Remove all references" },
		{ name: "doc", type: "Comma-separated strings", description: 'Set documentation; pass "" to clear' },
		{ name: "modified-file", type: "Comma-separated strings", description: "Set modified file paths; repeatable" },
		{ name: "clear-docs", type: "Boolean", description: "Remove all documentation" },
		{ name: "plain", type: "Boolean", description: "Use plain text output after editing" },
	],
	writes: "Updates draft metadata and structured sections through Backlog.md",
	output: "Updated draft details; use --plain for text output",
	examples: ['backlog draft edit DRAFT-1 -t "Renamed draft"', "backlog draft edit DRAFT-1 --check-ac 1"],
}).description("edit an existing draft");
addEditFieldOptions(draftEditCommand).action(async (taskId: string | undefined, options) => {
	await runEditCommand(draftEditTarget, taskId ? [taskId] : [], options);
});

draftCmd
	.command("archive <taskId>")
	.description("archive a draft")
	.action(async (taskId: string) => {
		const cwd = await requireProjectRoot();
		const core = new Core(cwd);
		try {
			// The argument itself selects the draft file; re-resolving by its frontmatter ID could
			// target a different file when a draft filename and its ID have drifted apart.
			if (await core.archiveDraft(taskId)) {
				console.log(`Archived draft ${normalizeId(taskId, DRAFT_PREFIX)}`);
			} else {
				console.error(`Draft ${taskId} not found.`);
				process.exitCode = 1;
			}
		} catch (error) {
			console.error(error instanceof Error ? error.message : String(error));
			process.exitCode = 1;
		}
	});

draftCmd
	.command("promote <taskId>")
	.description("promote draft to task")
	.action(async (taskId: string) => {
		const cwd = await requireProjectRoot();
		const core = new Core(cwd);
		try {
			// Same as archive: the argument selects the file, so it must not be re-resolved by ID.
			if (await core.promoteDraft(taskId)) {
				console.log(`Promoted draft ${normalizeId(taskId, DRAFT_PREFIX)}`);
			} else {
				console.error(`Draft ${taskId} not found.`);
				process.exitCode = 1;
			}
		} catch (error) {
			console.error(error instanceof Error ? error.message : String(error));
			process.exitCode = 1;
		}
	});

draftCmd
	.command("view <taskId>")
	.description("display draft details")
	.option("--plain", "use plain text output instead of interactive UI")
	.action(async (taskId: string, options) => {
		const cwd = await requireProjectRoot();
		const core = new Core(cwd);
		await viewDraftById(core, taskId, options);
	});

draftCmd
	.argument("[taskId]")
	.option("--plain", "use plain text output")
	.action(async (taskId: string | undefined, options: { plain?: boolean }) => {
		if (!taskId) {
			draftCmd.help();
			return;
		}

		const cwd = await requireProjectRoot();
		const core = new Core(cwd);
		await viewDraftById(core, taskId, options);
	});

const milestoneCmd = program.command("milestone").aliases(["milestones"]);

addHelpSchema(milestoneCmd.command("list"), {
	reads: "Milestone files and local task milestone values",
	required: [],
	optional: [
		{ name: "show-completed", type: "Boolean", description: "Include completed milestones" },
		{ name: "plain", type: "Boolean", description: "Use text output instead of interactive UI" },
	],
	output: "Milestone list with completion status",
	examples: ["backlog milestone list --plain"],
})
	.description("list milestones with completion status")
	.option("--show-completed", "show completed milestones")
	.option("--plain", "use plain text output")
	.action(async (options: { showCompleted?: boolean; plain?: boolean }) => {
		const cwd = await requireProjectRoot();
		const core = new Core(cwd);
		await core.ensureConfigLoaded();

		const [tasks, milestones, archivedMilestones, config] = await Promise.all([
			core.queryTasks({ includeCrossBranch: false }),
			core.filesystem.listMilestones(),
			core.filesystem.listArchivedMilestones(),
			core.filesystem.loadConfig(),
		]);

		const statuses = config?.statuses ?? ["To Do", "In Progress", "Done"];
		const archivedMilestoneIds = collectArchivedMilestoneKeys(archivedMilestones, milestones);
		const buckets = buildMilestoneBuckets(tasks, milestones, statuses, { archivedMilestoneIds, archivedMilestones });
		const active = buckets.filter((bucket) => !bucket.isNoMilestone && !bucket.isCompleted);
		const completed = buckets.filter((bucket) => !bucket.isNoMilestone && bucket.isCompleted);

		const formatBucket = (bucket: (typeof buckets)[number]) => {
			const id = bucket.milestone ?? bucket.label;
			const label = bucket.label;
			const milestone = [...milestones, ...archivedMilestones].find(
				(candidate) => milestoneKey(candidate.id) === milestoneKey(id),
			);
			const dueDate = milestone?.dueDate
				? `, due ${formatUtcDateForDisplay(milestone.dueDate, { appendUtcLabel: true })}`
				: "";
			return `  ${id}: ${label} (${bucket.doneCount}/${bucket.total} done${dueDate})`;
		};

		console.log(`Active milestones (${active.length}):`);
		if (active.length === 0) {
			console.log("  (none)");
		} else {
			for (const bucket of active) {
				console.log(formatBucket(bucket));
			}
		}

		console.log(`\nCompleted milestones (${completed.length}):`);
		if (completed.length === 0) {
			console.log("  (none)");
		} else if (options.showCompleted || process.argv.includes("--show-completed")) {
			for (const bucket of completed) {
				console.log(formatBucket(bucket));
			}
		} else {
			console.log("  (collapsed, use --show-completed to list)");
		}
	});

addHelpSchema(milestoneCmd.command("add <name>"), {
	reads: "Active milestone files for duplicate and alias validation",
	required: [{ name: "name", type: "String", description: "Milestone name/title, trimmed before storage" }],
	optional: [
		{ name: "description", type: "Markdown", description: "Optional milestone description" },
		{ name: "due-date", type: "UTC datetime", description: "Optional milestone due date and time" },
	],
	writes: "Creates a milestone markdown file in the active milestones directory",
	output: "Created milestone title and ID",
	examples: ['backlog milestone add "Release 1.0"', 'backlog milestone add "Beta" --description "Beta scope"'],
})
	.description("add a milestone file")
	.option("-d, --description <text>", "milestone description")
	.option("--due-date <datetime>", "set due date as a UTC datetime")
	.action(async (name: string, options: { description?: string; dueDate?: string }) => {
		await runMilestoneMutation((handlers) =>
			handlers.addMilestone({ name, description: options.description, dueDate: options.dueDate }),
		);
	});

addHelpSchema(milestoneCmd.command("rename <from> <to>"), {
	reads: "Active and archived milestone files, plus local tasks when task updates are enabled",
	required: [
		{ name: "from", type: "Milestone ID or title", description: "Existing active milestone to rename" },
		{ name: "to", type: "String", description: "New milestone title; checked for alias conflicts" },
	],
	optional: [
		{
			name: "update-tasks",
			type: "Boolean",
			description: "Update local task milestone references; default true, disable with --no-update-tasks",
		},
		{ name: "due-date", type: "UTC datetime", description: "Set the milestone due date and time" },
		{ name: "clear-due-date", type: "Boolean", description: "Clear the milestone due date" },
	],
	writes: "Renames the milestone file and, by default, updates matching local task milestone values",
	output: "Rename summary, task update count, and file move path when changed",
	examples: [
		'backlog milestone rename "Release 1.0" "Release 2.0"',
		'backlog milestone rename m-1 "Release 2.0" --no-update-tasks',
	],
})
	.description("rename a milestone file and update local tasks by default")
	.option("--no-update-tasks", "do not update local tasks that reference the milestone")
	.option("--due-date <datetime>", "set due date as a UTC datetime")
	.option("--clear-due-date", "clear milestone due date")
	.action(
		async (from: string, to: string, options: { updateTasks?: boolean; dueDate?: string; clearDueDate?: boolean }) => {
			if (options.dueDate !== undefined && options.clearDueDate) {
				console.error("Cannot use --due-date and --clear-due-date together.");
				process.exitCode = 1;
				return;
			}
			await runMilestoneMutation((handlers) =>
				handlers.renameMilestone({
					from,
					to,
					updateTasks: options.updateTasks !== false,
					dueDate: options.clearDueDate ? null : options.dueDate,
				}),
			);
		},
	);

addHelpSchema(milestoneCmd.command("remove <name>"), {
	reads: "Active and archived milestone files, plus local tasks unless task handling is keep",
	required: [{ name: "name", type: "Milestone ID or title", description: "Active milestone to remove" }],
	optional: [
		{
			name: "task-handling",
			type: choiceType(["clear", "keep", "reassign"]),
			description: "How to handle matching local task milestone values; default clear",
		},
		{
			name: "reassign-to",
			type: "Milestone ID or title",
			description: "Required when task-handling is reassign; target must be an active milestone",
		},
	],
	writes: "Moves the milestone file to the archived milestones directory and may clear or reassign local tasks",
	output: "Removal summary and task handling count",
	examples: [
		'backlog milestone remove "Release 1.0"',
		'backlog milestone remove "Release 1.0" --task-handling keep',
		'backlog milestone remove "Release 1.0" --task-handling reassign --reassign-to "Release 2.0"',
	],
})
	.description("remove a milestone file and clear, keep, or reassign matching tasks")
	.option("--task-handling <mode>", "how to handle matching tasks (clear|keep|reassign)", "clear")
	.option("--reassign-to <milestone>", "target milestone when --task-handling reassign")
	.action(async (name: string, options: { taskHandling?: string; reassignTo?: string }) => {
		const taskHandling = parseMilestoneTaskHandling(options.taskHandling);
		if (!taskHandling) {
			console.error(`Invalid task handling: ${options.taskHandling}. Valid values are: clear, keep, reassign`);
			process.exitCode = 1;
			return;
		}

		await runMilestoneMutation((handlers) =>
			handlers.removeMilestone({
				name,
				taskHandling,
				reassignTo: options.reassignTo,
			}),
		);
	});

addHelpSchema(milestoneCmd.command("archive <name>"), {
	reads: "Active milestone files",
	required: [{ name: "name", type: "Milestone ID or title", description: "Milestone to archive" }],
	optional: [],
	writes: "Moves a milestone file into the archived milestones directory",
	output: "Archive confirmation text",
	examples: ["backlog milestone archive m-1"],
})
	.description("archive a milestone by id or title")
	.action(async (name: string) => {
		await runMilestoneMutation((handlers) => handlers.archiveMilestone({ name }));
	});

const boardCmd = program.command("board");

function addBoardOptions(cmd: Command) {
	return cmd
		.option("-l, --layout <layout>", "board layout (horizontal|vertical)", "horizontal")
		.option("--vertical", "use vertical layout (shortcut for --layout vertical)")
		.option("-m, --milestones", "group tasks by milestone");
}

async function handleBoardView(options: { layout?: string; vertical?: boolean; milestones?: boolean }) {
	const cwd = await requireProjectRoot();
	const core = new Core(cwd);
	const config = await core.filesystem.loadConfig();

	const statuses = config?.statuses || [];

	// Use unified view for Tab switching support
	const { runUnifiedView } = await import("./ui/unified-view.ts");
	await runUnifiedView({
		core,
		initialView: "kanban",
		milestoneMode: options.milestones,
		tasksLoader: async (updateProgress) => {
			const [tasks, milestoneEntities, archivedMilestones] = await Promise.all([
				core.loadTasks((msg) => {
					updateProgress(msg);
				}),
				core.filesystem.listMilestones(),
				core.filesystem.listArchivedMilestones(),
			]);
			const resolveMilestoneAlias = (value?: string): string => {
				const normalized = (value ?? "").trim();
				if (!normalized) {
					return "";
				}
				const key = normalized.toLowerCase();
				const looksLikeMilestoneId = /^\d+$/.test(normalized) || /^m-\d+$/i.test(normalized);
				const canonicalInputId = looksLikeMilestoneId
					? `m-${String(Number.parseInt(normalized.replace(/^m-/i, ""), 10))}`
					: null;
				const aliasKeys = new Set<string>([key]);
				if (/^\d+$/.test(normalized)) {
					const numericAlias = String(Number.parseInt(normalized, 10));
					aliasKeys.add(numericAlias);
					aliasKeys.add(`m-${numericAlias}`);
				} else {
					const idMatch = normalized.match(/^m-(\d+)$/i);
					if (idMatch?.[1]) {
						const numericAlias = String(Number.parseInt(idMatch[1], 10));
						aliasKeys.add(numericAlias);
						aliasKeys.add(`m-${numericAlias}`);
					}
				}
				const idMatchesAlias = (milestoneId: string): boolean => {
					const idKey = milestoneId.trim().toLowerCase();
					if (aliasKeys.has(idKey)) {
						return true;
					}
					const idMatch = milestoneId.trim().match(/^m-(\d+)$/i);
					if (!idMatch?.[1]) {
						return false;
					}
					const numericAlias = String(Number.parseInt(idMatch[1], 10));
					return aliasKeys.has(numericAlias) || aliasKeys.has(`m-${numericAlias}`);
				};
				const findIdMatch = (milestones: Milestone[]): Milestone | undefined => {
					const rawExactMatch = milestones.find((milestone) => milestone.id.trim().toLowerCase() === key);
					if (rawExactMatch) {
						return rawExactMatch;
					}
					if (canonicalInputId) {
						const canonicalRawMatch = milestones.find(
							(milestone) => milestone.id.trim().toLowerCase() === canonicalInputId,
						);
						if (canonicalRawMatch) {
							return canonicalRawMatch;
						}
					}
					return milestones.find((milestone) => idMatchesAlias(milestone.id));
				};

				const activeIdMatch = findIdMatch(milestoneEntities);
				if (activeIdMatch) {
					return activeIdMatch.id;
				}
				if (looksLikeMilestoneId) {
					const archivedIdMatch = findIdMatch(archivedMilestones);
					if (archivedIdMatch) {
						return archivedIdMatch.id;
					}
				}
				const activeTitleMatches = milestoneEntities.filter(
					(milestone) => milestone.title.trim().toLowerCase() === key,
				);
				if (activeTitleMatches.length === 1) {
					return activeTitleMatches[0]?.id ?? normalized;
				}
				if (activeTitleMatches.length > 1) {
					return normalized;
				}
				const archivedIdMatch = findIdMatch(archivedMilestones);
				if (archivedIdMatch) {
					return archivedIdMatch.id;
				}
				const archivedTitleMatches = archivedMilestones.filter(
					(milestone) => milestone.title.trim().toLowerCase() === key,
				);
				if (archivedTitleMatches.length === 1) {
					return archivedTitleMatches[0]?.id ?? normalized;
				}
				return normalized;
			};
			const archivedKeys = new Set(collectArchivedMilestoneKeys(archivedMilestones, milestoneEntities));
			const normalizedTasks =
				archivedKeys.size > 0
					? tasks.map((task) => {
							const key = milestoneKey(resolveMilestoneAlias(task.milestone));
							if (!key || !archivedKeys.has(key)) {
								return task;
							}
							return { ...task, milestone: undefined };
						})
					: tasks;
			return {
				tasks: normalizedTasks.map((t) => ({ ...t, status: t.status || "" })),
				statuses,
			};
		},
	});
}

addBoardOptions(boardCmd).description("display tasks in a Kanban board").action(handleBoardView);

addBoardOptions(boardCmd.command("view").description("display tasks in a Kanban board")).action(handleBoardView);

boardCmd
	.command("export [filename]")
	.description("export kanban board to markdown file")
	.option("--force", "overwrite existing file without confirmation")
	.option("--readme", "export to README.md with markers")
	.option("--export-version <version>", "version to include in the export")
	.action(async (filename, options) => {
		const cwd = await requireProjectRoot();
		const core = new Core(cwd);
		const config = await core.filesystem.loadConfig();
		const statuses = config?.statuses || [];
		if (await printDuplicateIntegrityWarning(core)) return;

		// Load tasks with progress tracking
		const loadingScreen = await createLoadingScreen("Loading tasks for export");

		let finalTasks: Task[];
		try {
			// Use the shared Core method for loading board tasks
			finalTasks = await core.loadTasks((msg) => {
				loadingScreen?.update(msg);
			});

			loadingScreen?.update(`Total tasks: ${finalTasks.length}`);

			// Close loading screen before export
			loadingScreen?.close();

			// Get project name from config or use directory name
			const { basename } = await import("node:path");
			const projectName = config?.projectName || basename(cwd);

			if (options.readme) {
				// Use version from option if provided, otherwise use the CLI version
				const exportVersion = options.exportVersion || version;
				await updateReadmeWithBoard(finalTasks, statuses, projectName, exportVersion);
				console.log("Updated README.md with Kanban board.");
			} else {
				// Use filename argument or default to Backlog.md
				const outputFile = filename || "Backlog.md";
				const outputPath = join(cwd, outputFile as string);

				// Check if file exists and handle overwrite confirmation
				const fileExists = await Bun.file(outputPath).exists();
				if (fileExists && !options.force) {
					const rl = createInterface({ input });
					try {
						const answer = await rl.question(`File "${outputPath}" already exists. Overwrite? (y/N): `);
						if (!answer.toLowerCase().startsWith("y")) {
							console.log("Export cancelled.");
							return;
						}
					} finally {
						rl.close();
					}
				}

				await exportKanbanBoardToFile(finalTasks, statuses, outputPath, projectName, options.force || !fileExists);
				console.log(`Exported board to ${outputPath}`);
			}
		} catch (error) {
			loadingScreen?.close();
			throw error;
		}
	});

const docCmd = program.command("doc");

addHelpSchema(docCmd.command("create <title>"), {
	required: [{ name: "title", type: "String", description: "Document title" }],
	optional: [
		{
			name: "path",
			type: "Docs-relative path",
			description: "Subdirectory under backlog/docs; absolute paths and .. are rejected",
		},
		{ name: "type", type: choiceType(DOCUMENT_TYPE_VALUES), description: "Document type" },
		{ name: "plain", type: "Boolean", description: "Use plain text output" },
	],
	writes: "Creates a document markdown file under the configured docs directory",
	output: "Created document ID and path",
	examples: ['backlog doc create "API Guidelines" -p guides/api'],
})
	.option("-p, --path <path>")
	.option("-t, --type <type>", `document type (${DOCUMENT_TYPE_VALUES.join(", ")})`)
	// Accepted so agent guidance that always passes --plain works; create output is already plain text.
	.option("--plain", "use plain text output")
	.action(async (title: string, options) => {
		const cwd = await requireProjectRoot();
		const core = new Core(cwd);
		const document = await core.createDocumentFromInput({
			title: title as string,
			type: (options.type || "other") as DocType["type"],
			path: options.path,
			content: "",
		});
		console.log(`Created document ${document.id}`);
		if (document.path) {
			console.log(`Path: ${core.filesystem.backlogDirName}/docs/${document.path}`);
		}
	});

addHelpSchema(docCmd.command("update <docId>"), {
	required: [{ name: "docId", type: "Document ID", description: "Document to update" }],
	optional: [
		{ name: "title", type: "String", description: "Replacement title" },
		{ name: "content", type: "Markdown", description: "Replacement document body" },
		{ name: "path", type: "Docs-relative path", description: "Move document under backlog/docs" },
		{ name: "type", type: choiceType(DOCUMENT_TYPE_VALUES), description: "Document type" },
		{ name: "tags", type: "Comma-separated strings", description: "Replacement tags" },
	],
	writes: "Updates document content, metadata, or docs-relative path",
	output: "Updated document ID and path",
	examples: ['backlog doc update doc-1 --content "Updated markdown"', "backlog doc update doc-1 -p guides"],
})
	.description("update a document")
	.option("--title <title>", "update document title")
	.option("--content <content>", "replace document markdown content")
	.option("-p, --path <path>", "move document under a docs-relative path (absolute paths and .. are rejected)")
	.option("-t, --type <type>", `document type (${DOCUMENT_TYPE_VALUES.join(", ")})`)
	.option("--tags <tags>", "set tags (comma-separated or use multiple times)", createMultiValueAccumulator())
	.action(async (docId: string, options) => {
		const cwd = await requireProjectRoot();
		const core = new Core(cwd);
		const existingDocument = await core.getDocument(docId);
		if (!existingDocument) {
			throw new Error(`Document not found: ${docId}`);
		}

		const document = await core.updateDocumentFromInput({
			id: docId,
			title: options.title,
			content: options.content ?? existingDocument.rawContent,
			type: options.type,
			path: options.path,
			...(options.tags !== undefined && { tags: parseDelimitedStringList(options.tags) ?? [] }),
		});

		console.log(`Updated document ${document.id}`);
		if (document.path) {
			console.log(`Path: ${core.filesystem.backlogDirName}/docs/${document.path}`);
		}
	});

addHelpSchema(docCmd.command("list"), {
	reads: "Documents under the configured docs directory",
	required: [],
	optional: [{ name: "plain", type: "Boolean", description: "Use text output instead of interactive UI" }],
	output: "Document list with IDs, titles, types, paths, and tags",
	examples: ["backlog doc list --plain"],
})
	.option("--plain", "use plain text output instead of interactive UI")
	.action(async (options) => {
		const cwd = await requireProjectRoot();
		const core = new Core(cwd);
		const docs = await core.filesystem.listDocuments();
		if (docs.length === 0) {
			console.log("No docs found.");
			return;
		}

		// Plain text output for non-interactive environments
		const usePlainOutput = isPlainRequested(options) || shouldAutoPlain;
		if (usePlainOutput) {
			for (const d of docs) {
				console.log(`${d.id} - ${d.title}`);
			}
			return;
		}

		// Interactive UI
		const selected = await genericSelectList("Select a document", docs);
		if (selected) {
			// Resolve through the same reader as `doc view`. Matching filenames against the id
			// only found `<id> - <title>.md` at the top level, so documents written under the
			// older title-only filenames, or in a subdirectory, opened as nothing.
			const content = await core.getDocumentContent(selected.id);
			if (content !== null) {
				await scrollableViewer(content);
			}
		}
	});

addHelpSchema(docCmd.command("search <query>"), {
	reads: "Documents under the configured docs directory using the shared fuzzy search index",
	writes: "None; this is a read-only command",
	required: [{ name: "query", type: "String", description: "Search text, 1-200 characters" }],
	optional: [
		{
			name: "limit",
			type: "Integer",
			description: `Maximum matching documents to return, 1-${DOCUMENT_SEARCH_LIMIT_MAX}`,
		},
	],
	output: "Plain text Documents list with id, title, path, type, tags, score, and a follow-up doc view command",
	examples: ['backlog doc search "architecture"', 'backlog doc search "runbook" --limit 5'],
})
	.description("search documents using the shared fuzzy index")
	.option("-l, --limit <number>", `limit results returned (1-${DOCUMENT_SEARCH_LIMIT_MAX})`)
	.action(async (query: string, options) => {
		const normalizedQuery = query.trim();
		if (normalizedQuery.length === 0) {
			console.error('Query is required. Provide non-empty text, for example: backlog doc search "architecture"');
			process.exitCode = 1;
			return;
		}
		if (normalizedQuery.length > DOCUMENT_SEARCH_QUERY_MAX_LENGTH) {
			console.error(`Query must be ${DOCUMENT_SEARCH_QUERY_MAX_LENGTH} characters or fewer.`);
			process.exitCode = 1;
			return;
		}

		const limit = parseDocumentSearchLimit(options.limit);
		if (limit === null) {
			return;
		}

		const cwd = await requireProjectRoot();
		const core = new Core(cwd);
		const searchService = await core.getSearchService();
		const contentStore = await core.getContentStore();
		const cleanup = () => {
			searchService.dispose();
			contentStore.dispose();
		};

		const results = searchService
			.search({
				query: normalizedQuery,
				limit,
				types: ["document"],
			})
			.filter(isDocumentSearchResult);

		printDocumentSearchResults(results, normalizedQuery);
		cleanup();
	});

// Document view command
addHelpSchema(docCmd.command("view <docId>"), {
	reads: "Document metadata and markdown body",
	required: [{ name: "docId", type: "Document ID", description: "Document to display" }],
	optional: [{ name: "plain", type: "Boolean", description: "Use text output instead of interactive UI" }],
	output: "Document metadata and markdown content",
	examples: ["backlog doc view doc-1", "backlog doc view doc-1 --plain"],
})
	.description("view a document")
	.option("--plain", "use plain text output instead of interactive UI")
	.action(async (docId: string, options) => {
		const cwd = await requireProjectRoot();
		const core = new Core(cwd);
		try {
			const content = await core.getDocumentContent(docId);
			if (content === null) {
				console.error(`Document ${docId} not found.`);
				return;
			}
			const usePlainOutput = isPlainRequested(options) || shouldAutoPlain;
			if (usePlainOutput) {
				console.log(content);
				return;
			}
			await scrollableViewer(content);
		} catch (error) {
			if (isAmbiguousIdError(error)) {
				console.error(error.message);
				process.exitCode = 1;
				return;
			}
			console.error(`Document ${docId} not found.`);
		}
	});

const decisionCmd = program.command("decision");

addHelpSchema(decisionCmd.command("create <title>"), {
	required: [{ name: "title", type: "String", description: "Decision title" }],
	optional: [
		{ name: "status", type: "String", description: "Decision status; free-form, defaults to proposed" },
		{ name: "plain", type: "Boolean", description: "Use plain text output" },
	],
	writes: "Creates a decision markdown file under the configured decisions directory",
	output: "Created decision ID",
	examples: ['backlog decision create "Adopt Bun test runner" -s accepted --plain'],
})
	.description("create a decision")
	.option("-s, --status <status>", "set decision status (free-form, defaults to proposed)")
	// Accepted so agent guidance that always passes --plain works; create output is already plain text.
	.option("--plain", "use plain text output")
	.action(async (title: string, options) => {
		const cwd = await requireProjectRoot();
		const core = new Core(cwd);
		const id = await generateNextDecisionId(core);
		const decision: Decision = {
			id,
			title: title as string,
			date: new Date().toISOString().slice(0, 16).replace("T", " "),
			status: (options.status || "proposed") as Decision["status"],
			context: "",
			decision: "",
			consequences: "",
			rawContent: "",
		};
		await core.createDecision(decision);
		console.log(`Created decision ${id}`);
	});

addHelpSchema(decisionCmd.command("list"), {
	reads: "Decisions under the configured decisions directory",
	writes: "None; this is a read-only command",
	required: [],
	optional: [
		{ name: "plain", type: "Boolean", description: "Use plain text output, which is the default for this command" },
		{ name: "json", type: "Boolean", description: "Use versioned machine-readable JSON output" },
	],
	output: "Decision list with IDs, titles, and statuses; versioned JSON with --json",
	examples: ["backlog decision list --plain", "backlog decision list --json"],
})
	.description("list decisions")
	.option("--plain", "use plain text output")
	.option("--json", "print versioned machine-readable JSON output")
	.action(async (options) => {
		const outputMode = getReadOutputMode(options);
		if (!outputMode) return;
		const cwd = await requireProjectRoot();
		const core = new Core(cwd);
		const decisions = await core.filesystem.listDecisions();

		if (outputMode === "json") {
			printJson(decisionListJson(decisions));
			return;
		}

		if (decisions.length === 0) {
			console.log("No decisions found.");
			return;
		}

		// Decisions have no interactive detail view, so text output covers plain and TTY runs.
		for (const decision of decisions) {
			const status = decision.status ? ` (${decision.status})` : "";
			console.log(`${decision.id} - ${decision.title}${status}`);
		}
	});

// Agents command group
const agentsCmd = addHelpSchema(program.command("agents"), {
	reads: "Project config and existing agent instruction files when updating",
	required: [],
	optional: [
		{
			name: "--update-instructions",
			type: "Boolean",
			description: "Interactively select instruction files and refresh the short Backlog.md CLI nudge",
		},
	],
	writes:
		"Creates or updates the managed Backlog.md CLI nudge in selected instruction files; preserves existing content outside the managed block",
	output: "Interactive file selection followed by created, updated, or unchanged file summary",
	examples: ["backlog agents --update-instructions"],
});

agentsCmd
	.description("manage the short Backlog.md CLI nudge in agent instruction files")
	.option(
		"--update-instructions",
		"update the Backlog.md CLI nudge in agent instruction files while preserving existing content",
	)
	.action(async (options) => {
		if (!options.updateInstructions) {
			agentsCmd.help();
			return;
		}
		try {
			const cwd = await requireProjectRoot();
			const core = new Core(cwd);

			// Check if backlog project is initialized
			const config = await core.filesystem.loadConfig();
			if (!config) {
				console.error("No backlog project found. Initialize one first with: backlog init");
				process.exit(1);
			}

			const selected = await clack.multiselect({
				message: "Select agent instruction files to update (space toggles selections; enter confirms)",
				required: false,
				options: [
					{ label: "CLAUDE.md (Claude Code)", value: "CLAUDE.md" },
					{
						label: "AGENTS.md (Codex, Jules, Amp, Cursor, Zed, Warp, Aider, GitHub, RooCode)",
						value: "AGENTS.md",
					},
					{ label: "GEMINI.md (Google CLI)", value: "GEMINI.md" },
					{ label: "Copilot (GitHub Copilot)", value: ".github/copilot-instructions.md" },
				],
			});
			if (clack.isCancel(selected)) {
				clack.log.info("Agent instruction update cancelled.");
				return;
			}

			const files: AgentInstructionFile[] = Array.isArray(selected) ? (selected as AgentInstructionFile[]) : [];
			if (files.length > 0) {
				// Get autoCommit setting from config
				const config = await core.filesystem.loadConfig();
				const shouldAutoCommit = config?.autoCommit ?? false;
				await addAgentInstructions(cwd, core.gitOps, files, shouldAutoCommit);
				console.log(`Updated ${files.length} agent instruction file(s): ${files.join(", ")}`);
			} else {
				console.log("No files selected for update.");
			}
		} catch (err) {
			reportCommandFailure("Failed to update agent instructions", err);
		}
	});

// Config command group
const CONFIG_AVAILABLE_KEYS =
	"Available keys: defaultEditor, projectName, defaultAssignee, defaultStatus, statuses, labels, priorities, types, projects, milestones, definitionOfDone, dateFormat, maxColumnWidth, defaultPort, autoOpenBrowser, hideEmptyColumns, remoteOperations, autoCommit, filesystemOnly, bypassGitHooks, zeroPaddedIds, checkActiveBranches, activeBranchDays";

const configCmd = addHelpSchema(program.command("config"), {
	reads: "Project Backlog.md configuration",
	required: [],
	optional: [],
	writes: "Interactive configuration updates when run without a subcommand",
	output: "Interactive wizard results or subcommand output",
	examples: ["backlog config", "backlog config list", "backlog config get defaultEditor"],
})
	.description("manage backlog configuration")
	.action(async () => {
		try {
			const cwd = await requireProjectRoot();
			const core = new Core(cwd);
			const existingConfig = await core.filesystem.loadConfig();

			if (!existingConfig) {
				console.error("No backlog project found. Initialize one first with: backlog init");
				process.exit(1);
			}

			const {
				mergedConfig,
				installClaudeAgent: shouldInstallClaude,
				installShellCompletions: shouldInstallCompletions,
			} = await configureAdvancedSettings(core);

			let completionResult: CompletionInstallResult | null = null;
			let completionError: string | null = null;
			if (shouldInstallCompletions) {
				try {
					completionResult = await installCompletion();
				} catch (error) {
					completionError = error instanceof Error ? error.message : String(error);
				}
			}

			console.log("\nAdvanced configuration updated.");
			console.log(`  Check active branches: ${mergedConfig.checkActiveBranches ?? true}`);
			console.log(`  Remote operations: ${mergedConfig.remoteOperations ?? true}`);
			console.log(
				`  Zero-padded IDs: ${
					typeof mergedConfig.zeroPaddedIds === "number" ? `${mergedConfig.zeroPaddedIds} digits` : "disabled"
				}`,
			);
			console.log(`  Web UI port: ${mergedConfig.defaultPort ?? 6420}`);
			console.log(`  Auto open browser: ${mergedConfig.autoOpenBrowser ?? true}`);
			console.log(`  Bypass git hooks: ${mergedConfig.bypassGitHooks ?? false}`);
			console.log(`  Auto commit: ${mergedConfig.autoCommit ?? false}`);
			console.log(`  Definition of Done defaults: ${(mergedConfig.definitionOfDone ?? []).join(" | ") || "(none)"}`);
			if (completionResult) {
				console.log(`  Shell completions: installed to ${completionResult.installPath}`);
			} else if (completionError) {
				console.log("  Shell completions: installation failed (see warning below)");
			} else {
				console.log("  Shell completions: skipped");
			}
			if (mergedConfig.defaultEditor) {
				console.log(`  Default editor: ${mergedConfig.defaultEditor}`);
			}
			if (shouldInstallClaude) {
				await installClaudeAgent(cwd);
				console.log("✓ Claude Code Backlog.md agent installed to .claude/agents/");
			}
			if (completionResult) {
				const instructions = completionResult.instructions.trim();
				console.log(
					[
						"",
						`Shell completion script installed for ${completionResult.shell}.`,
						`  Path: ${completionResult.installPath}`,
						instructions,
						"",
					].join("\n"),
				);
			} else if (completionError) {
				const indentedError = completionError
					.split("\n")
					.map((line) => `  ${line}`)
					.join("\n");
				console.warn(
					`⚠️  Shell completion installation failed:\n${indentedError}\n  Run \`backlog completion install\` later to retry.\n`,
				);
			}
			console.log("\nUse `backlog config list` to review all configuration values.");
		} catch (err) {
			reportCommandFailure("Failed to update configuration", err);
		}
	});

addHelpSchema(configCmd.command("get <key>"), {
	reads: "Project Backlog.md configuration",
	required: [{ name: "key", type: choiceType(CONFIG_GET_KEYS), description: "Configuration value to print" }],
	optional: [],
	output: "The selected configuration value",
	examples: ["backlog config get defaultEditor", "backlog config get types"],
})
	.description("get a configuration value")
	.action(async (key: string) => {
		try {
			const cwd = await requireProjectRoot();
			const core = new Core(cwd);
			const config = await core.filesystem.loadConfig();

			if (!config) {
				console.error("No backlog project found. Initialize one first with: backlog init");
				process.exit(1);
			}

			// Handle specific config keys
			switch (key) {
				case "defaultEditor":
					if (config.defaultEditor) {
						console.log(config.defaultEditor);
					} else {
						console.log("defaultEditor is not set");
						process.exit(1);
					}
					break;
				case "projectName":
					console.log(config.projectName);
					break;
				case "defaultAssignee":
					console.log(config.defaultAssignee?.join(", ") || "");
					break;
				case "defaultStatus":
					console.log(config.defaultStatus || "");
					break;
				case "statuses":
					console.log(config.statuses.join(", "));
					break;
				case "labels":
					console.log(config.labels.join(", "));
					break;
				case "priorities":
					console.log(
						getPriorityOptions(config)
							.map((priority) => priority.label)
							.join(", "),
					);
					break;
				case "types":
					console.log(getTaskTypeValues(config).join(", "));
					break;
				case "projects":
					console.log(getProjectValues(config).join(", "));
					break;
				case "milestones": {
					const milestones = await core.filesystem.listMilestones();
					console.log(milestones.map((milestone) => milestone.id).join(", "));
					break;
				}
				case "definitionOfDone":
					console.log(config.definitionOfDone?.join(", ") || "");
					break;
				case "dateFormat":
					console.log(config.dateFormat);
					break;
				case "maxColumnWidth":
					console.log(config.maxColumnWidth?.toString() || "");
					break;
				case "defaultPort":
					console.log(config.defaultPort?.toString() || "");
					break;
				case "autoOpenBrowser":
					console.log(config.autoOpenBrowser?.toString() || "");
					break;
				case "hideEmptyColumns":
					console.log(config.hideEmptyColumns?.toString() || "false");
					break;
				case "remoteOperations":
					console.log(config.remoteOperations?.toString() || "");
					break;
				case "autoCommit":
					console.log(config.autoCommit?.toString() || "");
					break;
				case "filesystemOnly":
					console.log(config.filesystemOnly?.toString() || "false");
					break;
				case "bypassGitHooks":
					console.log(config.bypassGitHooks?.toString() || "");
					break;
				case "zeroPaddedIds":
					console.log(config.zeroPaddedIds?.toString() || "(disabled)");
					break;
				case "checkActiveBranches":
					console.log(config.checkActiveBranches?.toString() || "true");
					break;
				case "activeBranchDays":
					console.log(config.activeBranchDays?.toString() || "30");
					break;
				default:
					console.error(`Unknown config key: ${key}`);
					console.error(CONFIG_AVAILABLE_KEYS);
					process.exit(1);
			}
		} catch (err) {
			reportCommandFailure("Failed to get config value", err);
		}
	});

addHelpSchema(configCmd.command("set <key> <value>"), {
	required: [
		{ name: "key", type: choiceType(CONFIG_SET_KEYS), description: "Configuration value to update" },
		{ name: "value", type: "String", description: "New value; parsed based on key type" },
	],
	optional: [],
	writes: "Updates the project Backlog.md configuration file",
	output: "Confirmation of the updated config value",
	examples: [
		'backlog config set defaultEditor "code --wait"',
		"backlog config set autoCommit true",
		'backlog config set defaultAssignee "@alice,@bob"',
	],
})
	.description("set a configuration value")
	.action(async (key: string, value: string) => {
		try {
			const cwd = await requireProjectRoot();
			const core = new Core(cwd);
			const config = await core.filesystem.loadConfig();

			if (!config) {
				console.error("No backlog project found. Initialize one first with: backlog init");
				process.exit(1);
			}

			// Handle specific config keys
			switch (key) {
				case "defaultEditor": {
					// An explicitly empty value means "no editor" and skips executable validation
					if (value) {
						// Validate that the editor command exists
						const { isEditorAvailable } = await import("./utils/editor.ts");
						const isAvailable = await isEditorAvailable(value);
						if (!isAvailable) {
							console.error(`Editor command not found: ${value}`);
							console.error("Please ensure the editor is installed and available in your PATH");
							process.exit(1);
						}
					}
					config.defaultEditor = value;
					break;
				}
				case "projectName":
					config.projectName = value;
					break;
				case "defaultAssignee":
					// An empty value clears the default; comma-separated values set several assignees.
					config.defaultAssignee = parseDelimitedStringList(value);
					break;
				case "defaultStatus":
					config.defaultStatus = value;
					break;
				case "dateFormat":
					config.dateFormat = value;
					break;
				case "maxColumnWidth": {
					const width = Number.parseInt(value, 10);
					if (Number.isNaN(width) || width <= 0) {
						console.error("maxColumnWidth must be a positive number");
						process.exit(1);
					}
					config.maxColumnWidth = width;
					break;
				}
				case "autoOpenBrowser": {
					const boolValue = value.toLowerCase();
					if (boolValue === "true" || boolValue === "1" || boolValue === "yes") {
						config.autoOpenBrowser = true;
					} else if (boolValue === "false" || boolValue === "0" || boolValue === "no") {
						config.autoOpenBrowser = false;
					} else {
						console.error("autoOpenBrowser must be true or false");
						process.exit(1);
					}
					break;
				}
				case "hideEmptyColumns": {
					const boolValue = value.toLowerCase();
					if (boolValue === "true" || boolValue === "1" || boolValue === "yes") {
						config.hideEmptyColumns = true;
					} else if (boolValue === "false" || boolValue === "0" || boolValue === "no") {
						config.hideEmptyColumns = false;
					} else {
						console.error("hideEmptyColumns must be true or false");
						process.exit(1);
					}
					break;
				}
				case "defaultPort": {
					const port = Number.parseInt(value, 10);
					if (Number.isNaN(port) || port < 1 || port > 65535) {
						console.error("defaultPort must be a valid port number (1-65535)");
						process.exit(1);
					}
					config.defaultPort = port;
					break;
				}
				case "remoteOperations": {
					const boolValue = value.toLowerCase();
					if (boolValue === "true" || boolValue === "1" || boolValue === "yes") {
						config.remoteOperations = true;
					} else if (boolValue === "false" || boolValue === "0" || boolValue === "no") {
						config.remoteOperations = false;
					} else {
						console.error("remoteOperations must be true or false");
						process.exit(1);
					}
					break;
				}
				case "autoCommit": {
					const boolValue = value.toLowerCase();
					if (boolValue === "true" || boolValue === "1" || boolValue === "yes") {
						config.autoCommit = true;
					} else if (boolValue === "false" || boolValue === "0" || boolValue === "no") {
						config.autoCommit = false;
					} else {
						console.error("autoCommit must be true or false");
						process.exit(1);
					}
					break;
				}
				case "filesystemOnly": {
					const boolValue = value.toLowerCase();
					if (boolValue === "true" || boolValue === "1" || boolValue === "yes") {
						config.filesystemOnly = true;
						config.checkActiveBranches = false;
						config.remoteOperations = false;
						config.autoCommit = false;
						config.bypassGitHooks = false;
					} else if (boolValue === "false" || boolValue === "0" || boolValue === "no") {
						config.filesystemOnly = false;
					} else {
						console.error("filesystemOnly must be true or false");
						process.exit(1);
					}
					break;
				}
				case "bypassGitHooks": {
					const boolValue = value.toLowerCase();
					if (boolValue === "true" || boolValue === "1" || boolValue === "yes") {
						config.bypassGitHooks = true;
					} else if (boolValue === "false" || boolValue === "0" || boolValue === "no") {
						config.bypassGitHooks = false;
					} else {
						console.error("bypassGitHooks must be true or false");
						process.exit(1);
					}
					break;
				}
				case "zeroPaddedIds": {
					const padding = Number.parseInt(value, 10);
					if (Number.isNaN(padding) || padding < 0) {
						console.error("zeroPaddedIds must be a non-negative number.");
						process.exit(1);
					}
					// Set to undefined if 0 to remove it from config
					config.zeroPaddedIds = padding > 0 ? padding : undefined;
					break;
				}
				case "checkActiveBranches": {
					const boolValue = value.toLowerCase();
					if (boolValue === "true" || boolValue === "1" || boolValue === "yes") {
						config.checkActiveBranches = true;
					} else if (boolValue === "false" || boolValue === "0" || boolValue === "no") {
						config.checkActiveBranches = false;
					} else {
						console.error("checkActiveBranches must be true or false");
						process.exit(1);
					}
					break;
				}
				case "activeBranchDays": {
					const days = Number.parseInt(value, 10);
					if (Number.isNaN(days) || days < 0) {
						console.error("activeBranchDays must be a non-negative number.");
						process.exit(1);
					}
					config.activeBranchDays = days;
					break;
				}
				case "statuses":
				case "labels":
				case "types":
				case "priorities":
				case "projects":
				case "milestones":
				case "definitionOfDone":
					if (key === "milestones") {
						console.error("milestones cannot be set directly.");
						console.error(
							"Use milestone files via milestone commands (e.g. `backlog milestone list`, `backlog milestone add`).",
						);
					} else if (key === "definitionOfDone") {
						console.error("definitionOfDone cannot be set directly.");
						console.error(
							"Use `backlog config` for interactive editing, update the project config file (`backlog/config.yml`, `.backlog/config.yml`, or `backlog.config.yml`), or use Web UI Settings.",
						);
					} else {
						console.error(`${key} cannot be set directly. View current values with 'backlog config get ${key}'.`);
						console.error(
							"Edit the list in the project config file (`backlog/config.yml`, `.backlog/config.yml`, or `backlog.config.yml`) directly.",
						);
					}
					process.exit(1);
					break;
				case "taskPrefix":
				case "prefixes":
					console.error("Task prefix cannot be changed after initialization.");
					console.error(
						"The prefix is set during 'backlog init' and is permanent to avoid breaking existing task IDs.",
					);
					process.exit(1);
					break;
				default:
					console.error(`Unknown config key: ${key}`);
					console.error(CONFIG_AVAILABLE_KEYS);
					process.exit(1);
			}

			await core.filesystem.saveConfig(config);
			console.log(`Set ${key} = ${value}`);
		} catch (err) {
			reportCommandFailure("Failed to set config value", err);
		}
	});

addHelpSchema(configCmd.command("list"), {
	reads: "Project Backlog.md configuration",
	required: [],
	optional: [],
	output: "All public configuration values",
	examples: ["backlog config list"],
})
	.description("list all configuration values")
	.action(async () => {
		try {
			const cwd = await requireProjectRoot();
			const core = new Core(cwd);
			const config = await core.filesystem.loadConfig();

			if (!config) {
				console.error("No backlog project found. Initialize one first with: backlog init");
				process.exit(1);
			}

			console.log("Configuration:");
			console.log(`  projectName: ${config.projectName}`);
			console.log(`  defaultEditor: ${config.defaultEditor || "(not set)"}`);
			console.log(`  defaultAssignee: [${(config.defaultAssignee ?? []).join(", ")}]`);
			console.log(`  defaultStatus: ${config.defaultStatus || "(not set)"}`);
			console.log(`  statuses: [${config.statuses.join(", ")}]`);
			console.log(`  labels: [${config.labels.join(", ")}]`);
			console.log(
				`  priorities: [${getPriorityOptions(config)
					.map((priority) => priority.label)
					.join(", ")}]`,
			);
			console.log(`  types: [${getTaskTypeValues(config).join(", ")}]`);
			console.log(`  projects: [${getProjectValues(config).join(", ")}]`);
			const milestones = await core.filesystem.listMilestones();
			console.log(`  milestones: [${milestones.map((milestone) => milestone.id).join(", ")}]`);
			console.log(`  definitionOfDone: [${(config.definitionOfDone ?? []).join(", ")}]`);
			console.log(`  dateFormat: ${config.dateFormat}`);
			console.log(`  maxColumnWidth: ${config.maxColumnWidth || "(not set)"}`);
			console.log(`  autoOpenBrowser: ${config.autoOpenBrowser ?? "(not set)"}`);
			console.log(`  hideEmptyColumns: ${config.hideEmptyColumns ?? "(not set)"}`);
			console.log(`  defaultPort: ${config.defaultPort ?? "(not set)"}`);
			console.log(`  remoteOperations: ${config.remoteOperations ?? "(not set)"}`);
			console.log(`  autoCommit: ${config.autoCommit ?? "(not set)"}`);
			console.log(`  filesystemOnly: ${config.filesystemOnly ?? "false"}`);
			console.log(`  bypassGitHooks: ${config.bypassGitHooks ?? "(not set)"}`);
			console.log(`  zeroPaddedIds: ${config.zeroPaddedIds ?? "(disabled)"}`);
			console.log(`  taskPrefix: ${config.prefixes?.task || "task"} (read-only)`);
			console.log(`  checkActiveBranches: ${config.checkActiveBranches ?? "true"}`);
			console.log(`  activeBranchDays: ${config.activeBranchDays ?? "30"}`);
		} catch (err) {
			reportCommandFailure("Failed to list config values", err);
		}
	});
addHelpSchema(program.command("doctor"), {
	reads: "Active and completed task files, document, decision, and draft files, plus Backlog Markdown references",
	required: [],
	optional: [
		{ name: "fix", type: "Boolean", description: "Apply the displayed duplicate-ID repair" },
		{ name: "yes", type: "Boolean", description: "Confirm --fix without an interactive prompt" },
	],
	writes:
		"With --fix, atomically renames duplicate task files and updates only their frontmatter IDs; ambiguous references are reported for human review",
	output:
		"Duplicate-ID diagnosis for tasks, documents, decisions, and drafts, a deterministic task repair preview, and a reference-review report",
	examples: ["backlog doctor", "backlog doctor --fix", "backlog doctor --fix --yes"],
})
	.description("diagnose duplicate task, document, and decision IDs and safely repair duplicate task IDs")
	.option("--fix", "apply the displayed duplicate task ID repair")
	.option("--yes", "confirm --fix without prompting")
	.action(async (options: { fix?: boolean; yes?: boolean }) => {
		if (options.yes && !options.fix) {
			console.error("--yes can only be used together with --fix.");
			process.exitCode = 1;
			return;
		}

		const cwd = await requireProjectRoot();
		const core = new Core(cwd);
		try {
			const config = await core.filesystem.loadConfig();
			const taskPrefix = config?.prefixes?.task;
			const reservedTaskPrefix = taskPrefix && isReservedTaskPrefix(taskPrefix) ? taskPrefix : null;
			if (reservedTaskPrefix) {
				console.error(
					`Task prefix "${reservedTaskPrefix}" collides with a reserved prefix (draft, doc, decision); tasks are misrouted as that entity type.`,
				);
				console.error(
					"There is no automated migration. Rename the affected task files and IDs to a non-reserved prefix, then set task_prefix in the project config file to match.",
				);
				process.exitCode = 1;
				if (options.fix) {
					console.error("Resolve the reserved task prefix before running --fix.");
					return;
				}
			}

			const plan = await core.previewDuplicateTaskIdRepair({ includeBranches: true });
			const contentIdentity = await core.diagnoseContentIdentity();
			const contentIdentityBroken = hasContentIdentityIssues(contentIdentity);
			const draftIdentity = await core.filesystem.diagnoseDraftIdentity();
			const draftIdentityBroken = hasDraftIdentityFindings(draftIdentity);
			if (
				plan.groups.length === 0 &&
				plan.crossBranchFindings.length === 0 &&
				!contentIdentityBroken &&
				!draftIdentityBroken
			) {
				if (!reservedTaskPrefix) {
					console.log("No duplicate task, document, decision, or draft IDs found.");
				}
				return;
			}

			printDuplicateRepairPlan(plan);
			printContentIdentityReport(contentIdentity);
			printDraftIdentityReport(draftIdentity);
			if (!options.fix) {
				if (plan.groups.length > 0 && plan.repairable) {
					console.log("\nRun 'backlog doctor --fix' to apply this repair after reviewing the preview.");
				} else if (plan.groups.length > 0) {
					console.log("\nResolve the blocked reasons above, then run 'backlog doctor' again.");
				}
				process.exitCode = 1;
				return;
			}
			if (plan.groups.length === 0) {
				console.error("The reported findings cannot be repaired automatically; resolve them by hand.");
				process.exitCode = 1;
				return;
			}
			if (!plan.repairable) {
				process.exitCode = 1;
				return;
			}

			let confirmed = Boolean(options.yes);
			if (!confirmed) {
				if (!hasInteractiveTTY) {
					console.error("Interactive confirmation is unavailable. Review the preview, then use --fix --yes.");
					process.exitCode = 1;
					return;
				}
				const confirmation = await clack.confirm({
					message: `Rename ${plan.changes.length} duplicate task ${plan.changes.length === 1 ? "file" : "files"}?`,
					initialValue: false,
				});
				confirmed = !clack.isCancel(confirmation) && confirmation === true;
			}
			if (!confirmed) {
				console.log("Repair cancelled. No files changed.");
				return;
			}

			const result = await core.repairDuplicateTaskIds(plan.fingerprint);
			console.log(
				`\nRepaired ${result.repairedFiles} duplicate task ${result.repairedFiles === 1 ? "file" : "files"}.`,
			);
			for (const change of result.changes) {
				console.log(`  ${change.sourcePath} -> ${change.targetPath} (${change.oldId} -> ${change.newId})`);
			}
			if (result.references.length > 0) {
				console.log(
					`Review the ${result.references.length} reported reference ${result.references.length === 1 ? "line" : "lines"}; they were intentionally not changed.`,
				);
			}
			console.log("Verification passed: no duplicate active/completed task IDs remain.");
			if (plan.crossBranchFindings.length > 0) {
				console.log("Cross-branch findings remain diagnostic-only and still require branch-by-branch review.");
				process.exitCode = 1;
			}
			if (contentIdentityBroken) {
				console.log("Document and decision findings remain diagnostic-only and still require manual review.");
				process.exitCode = 1;
			}
			if (draftIdentityBroken) {
				console.log("Draft identity findings remain diagnostic-only and still require manual review.");
				process.exitCode = 1;
			}
		} catch (error) {
			console.error(error instanceof Error ? error.message : String(error));
			process.exitCode = 1;
		}
	});

// Cleanup command for managing completed tasks
addHelpSchema(program.command("cleanup"), {
	reads: "Tasks in terminal status from the configured backlog directory",
	required: [],
	optional: [],
	writes: "Moves selected terminal-status tasks to the completed folder",
	output: "Interactive cleanup summary",
	examples: ["backlog cleanup"],
})
	.description("move completed tasks to completed folder based on age")
	.action(async () => {
		try {
			const cwd = await requireProjectRoot();
			const core = new Core(cwd);

			// Check if backlog project is initialized
			const config = await core.filesystem.loadConfig();
			if (!config) {
				console.error("No backlog project found. Initialize one first with: backlog init");
				process.exit(1);
			}
			core.gitOps.setConfig(config);

			const statuses = config.statuses ?? [...DEFAULT_STATUSES];
			const terminalStatus = getTerminalStatus(statuses);
			if (!terminalStatus) {
				console.log("No terminal status configured for cleanup.");
				return;
			}

			const tasks = await core.queryTasks();
			const terminalStatusTasks = tasks.filter((task) => isTerminalStatus(task.status, statuses));

			if (terminalStatusTasks.length === 0) {
				console.log(`No ${terminalStatus} tasks found to clean up.`);
				return;
			}

			console.log(`Found ${terminalStatusTasks.length} tasks marked as ${terminalStatus}.`);

			const ageOptions = [
				{ title: "1 day", value: 1 },
				{ title: "1 week", value: 7 },
				{ title: "2 weeks", value: 14 },
				{ title: "3 weeks", value: 21 },
				{ title: "1 month", value: 30 },
				{ title: "3 months", value: 90 },
				{ title: "1 year", value: 365 },
			];

			const selectedAgePrompt = await clack.select({
				message: "Move tasks to completed folder if they are older than:",
				options: ageOptions.map((option) => ({ label: option.title, value: option.value })),
			});
			const selectedAge = clack.isCancel(selectedAgePrompt) ? undefined : selectedAgePrompt;

			if (selectedAge === undefined) {
				console.log("Cleanup cancelled.");
				return;
			}

			// Get tasks older than selected period
			const tasksToMove = await core.getTerminalStatusTasksByAge(selectedAge);

			if (tasksToMove.length === 0) {
				console.log(`No tasks found that are older than ${ageOptions.find((o) => o.value === selectedAge)?.title}.`);
				return;
			}

			console.log(
				`\nFound ${tasksToMove.length} tasks older than ${ageOptions.find((o) => o.value === selectedAge)?.title}:`,
			);
			for (const task of tasksToMove.slice(0, 5)) {
				const date = formatUtcDateForDisplay(task.updatedDate || task.createdDate, {
					dateFormat: config.dateFormat,
				});
				console.log(`  - ${task.id}: ${task.title} (${date})`);
			}
			if (tasksToMove.length > 5) {
				console.log(`  ... and ${tasksToMove.length - 5} more`);
			}

			const confirmedPrompt = await clack.confirm({
				message: `Move ${tasksToMove.length} tasks to completed folder?`,
				initialValue: false,
			});
			const confirmed = clack.isCancel(confirmedPrompt) ? false : confirmedPrompt;

			if (!confirmed) {
				console.log("Cleanup cancelled.");
				return;
			}

			// Move tasks to completed folder
			let successCount = 0;
			const shouldAutoCommit = config.autoCommit ?? false;

			console.log("Moving tasks...");
			const movedTasks: Array<{ fromPath: string; toPath: string; taskId: string }> = [];

			for (const task of tasksToMove) {
				const fromPath = task.filePath ?? (await core.getTask(task.id))?.filePath ?? null;

				if (!fromPath) {
					console.error(`Failed to locate file for task ${task.id}`);
					continue;
				}

				const taskFilename = basename(fromPath);
				const toPath = join(core.filesystem.completedDir, taskFilename);

				const success = await core.completeTask(task.id);
				if (success) {
					successCount++;
					movedTasks.push({ fromPath, toPath, taskId: task.id });
				} else {
					console.error(`Failed to move task ${task.id}`);
				}
			}

			// If autoCommit is disabled, stage the moves so Git recognizes them
			const hasGitRepository = await core.gitOps.isRepository();
			if (successCount > 0 && !shouldAutoCommit && hasGitRepository) {
				console.log("Staging file moves for Git...");
				for (const { fromPath, toPath } of movedTasks) {
					try {
						await core.gitOps.stageFileMove(fromPath, toPath);
					} catch (error) {
						console.warn(`Warning: Could not stage move for Git: ${error}`);
					}
				}
			}

			console.log(`Successfully moved ${successCount} of ${tasksToMove.length} tasks to completed folder.`);
			if (successCount > 0 && !shouldAutoCommit && hasGitRepository) {
				console.log("Files have been staged. To commit: git commit -m 'cleanup: Move completed tasks'");
			}
		} catch (err) {
			reportCommandFailure("Failed to run cleanup", err);
		}
	});

// Browser command for web UI
program
	.command("browser")
	.description("open browser interface on this machine only at 127.0.0.1 (press Ctrl+C or Cmd+C to stop)")
	.option("-p, --port <port>", "port to run server on")
	.option("--no-open", "don't automatically open browser")
	.option("--non-interactive", "automatically use next free port without asking")
	.action(async (options) => {
		try {
			const cwd = await requireProjectRoot();
			const { BacklogServer, findNextAvailablePort, isPortAvailable } = await import("./server/index.ts");
			const server = new BacklogServer(cwd);

			// Load config to get default port
			const core = new Core(cwd);
			const config = await core.filesystem.loadConfig();
			const defaultPort = config?.defaultPort ?? 6420;

			let port = Number.parseInt(options.port || defaultPort.toString(), 10);
			if (Number.isNaN(port) || port < 1 || port > 65535) {
				console.error("Invalid port number. Must be between 1 and 65535.");
				process.exit(1);
			}

			// Pre-check port availability and offer interactive retry
			if (!(await isPortAvailable(port))) {
				const nextPort = await findNextAvailablePort(port + 1);
				if (nextPort === null) {
					console.error(`No available port found after ${port}. Use --port to specify an available port.`);
					process.exit(1);
				}

				const shouldPromptForPort = !options.nonInteractive && hasInteractiveTTY;
				if (!shouldPromptForPort) {
					console.log(`⚠️  Port ${port} is already in use. Using port ${nextPort} instead.`);
					port = nextPort;
				} else {
					const rl = createInterface({ input, output: process.stdout });
					const answer = (
						await rl.question(
							`\n⚠️  Port ${port} is already in use.\n💡 Port ${nextPort} is available. Start on port ${nextPort}? [Y/n] `,
						)
					)
						.trim()
						.toLowerCase();
					rl.close();
					if (answer === "" || answer === "y") {
						port = nextPort;
					} else {
						console.log("Aborted.");
						process.exit(0);
					}
				}
			}

			await server.start(port, options.open !== false);

			// Graceful shutdown on common termination signals (register once)
			let shuttingDown = false;
			const shutdown = async (signal: string) => {
				if (shuttingDown) return;
				shuttingDown = true;
				console.log(`\nReceived ${signal}. Shutting down server...`);
				try {
					const stopPromise = server.stop();
					const timeout = new Promise<void>((resolve) => setTimeout(resolve, 1500));
					await Promise.race([stopPromise, timeout]);
				} finally {
					process.exit(0);
				}
			};

			process.once("SIGINT", () => void shutdown("SIGINT"));
			process.once("SIGTERM", () => void shutdown("SIGTERM"));
			process.once("SIGQUIT", () => void shutdown("SIGQUIT"));
		} catch (err) {
			reportCommandFailure("Failed to start browser interface", err);
		}
	});

// Overview command for statistics
program
	.command("overview")
	.description("display project statistics and metrics")
	.action(async () => {
		try {
			const cwd = await requireProjectRoot();
			const core = new Core(cwd);
			const config = await core.filesystem.loadConfig();

			if (!config) {
				console.error("No backlog project found. Initialize one first with: backlog init");
				process.exit(1);
			}

			// Import and run the overview command
			const { runOverviewCommand } = await import("./commands/overview.ts");
			await runOverviewCommand(core);
		} catch (err) {
			reportCommandFailure("Failed to display project overview", err);
		}
	});

// Completion command group
registerCompletionCommand(program);

// Instructions command group
registerInstructionsCommand(program);

// MCP command group
registerMcpCommand(program);

program
	.parseAsync(process.argv)
	.catch((error) => {
		console.error(error instanceof Error ? error.message : String(error));
		process.exitCode = 1;
	})
	.finally(() => {
		// Restore BUN_OPTIONS after CLI parsing completes so it's available for subsequent commands
		if (originalBunOptions) {
			process.env.BUN_OPTIONS = originalBunOptions;
		}
	});
