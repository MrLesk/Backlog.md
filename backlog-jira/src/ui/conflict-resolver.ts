import { confirm, select, input } from "@inquirer/prompts";
import chalk from "chalk";
import type { Conflict, FieldConflict } from "../commands/sync.ts";

export interface ResolutionChoice {
	field: string;
	source: "backlog" | "jira" | "manual";
	value: unknown;
}

export interface ConflictResolution {
	resolutions: ResolutionChoice[];
	savePreference: boolean;
}

/**
 * Prompt user to resolve conflicts interactively in the terminal
 */
export async function promptForConflictResolution(
	conflict: Conflict,
): Promise<ConflictResolution> {
	console.log(chalk.bold.yellow("\n⚠️  Conflict Detected\n"));
	console.log(chalk.gray(`Task: ${conflict.taskId}`));
	console.log(chalk.gray(`Jira: ${conflict.jiraKey}`));
	console.log(chalk.gray(`Fields in conflict: ${conflict.fields.length}\n`));

	const resolutions: ResolutionChoice[] = [];

	// Process each conflicting field
	for (const fieldConflict of conflict.fields) {
		console.log(chalk.bold.cyan(`\n━━━ ${fieldConflict.field.toUpperCase()} ━━━\n`));

		// Display values side by side
		displayFieldComparison(fieldConflict);

		// Prompt for resolution choice
		const choice = await select({
			message: `How do you want to resolve ${fieldConflict.field}?`,
			choices: [
				{
					name: `${chalk.green("✓")} Use Backlog version`,
					value: "backlog",
					description: formatValue(fieldConflict.backlogValue),
				},
				{
					name: `${chalk.blue("✓")} Use Jira version`,
					value: "jira",
					description: formatValue(fieldConflict.jiraValue),
				},
				{
					name: `${chalk.yellow("✎")} Enter manually`,
					value: "manual",
					description: "Type a custom value",
				},
			],
		});

		let resolvedValue: unknown;

		if (choice === "manual") {
			// Prompt for manual input
			const manualValue = await input({
				message: `Enter value for ${fieldConflict.field}:`,
				default: String(fieldConflict.backlogValue || ""),
			});
			resolvedValue = manualValue;
		} else if (choice === "backlog") {
			resolvedValue = fieldConflict.backlogValue;
		} else {
			resolvedValue = fieldConflict.jiraValue;
		}

		resolutions.push({
			field: fieldConflict.field,
			source: choice as "backlog" | "jira" | "manual",
			value: resolvedValue,
		});
	}

	// Show preview
	console.log(chalk.bold.green("\n━━━ PREVIEW ━━━\n"));
	displayResolutionPreview(resolutions);

	// Confirm changes
	const confirmed = await confirm({
		message: "Apply these resolutions?",
		default: true,
	});

	if (!confirmed) {
		throw new Error("Conflict resolution cancelled by user");
	}

	// Ask about saving preference
	const savePreference = await confirm({
		message: "Save this strategy as default for future conflicts?",
		default: false,
	});

	return {
		resolutions,
		savePreference,
	};
}

/**
 * Display field values in a comparison format
 */
function displayFieldComparison(fieldConflict: FieldConflict): void {
	const maxWidth = 70;

	console.log(chalk.gray("Base (last sync):"));
	console.log(
		chalk.white(
			`  ${truncate(formatValue(fieldConflict.baseValue), maxWidth)}`,
		),
	);
	console.log();

	console.log(chalk.green("Backlog (current):"));
	console.log(
		chalk.green(
			`  ${truncate(formatValue(fieldConflict.backlogValue), maxWidth)}`,
		),
	);
	console.log();

	console.log(chalk.blue("Jira (current):"));
	console.log(
		chalk.blue(
			`  ${truncate(formatValue(fieldConflict.jiraValue), maxWidth)}`,
		),
	);
	console.log();
}

/**
 * Display preview of resolved values
 */
function displayResolutionPreview(resolutions: ResolutionChoice[]): void {
	for (const resolution of resolutions) {
		const sourceIcon =
			resolution.source === "backlog"
				? chalk.green("✓ Backlog")
				: resolution.source === "jira"
					? chalk.blue("✓ Jira")
					: chalk.yellow("✎ Manual");

		console.log(
			chalk.bold(resolution.field) +
				chalk.gray(": ") +
				sourceIcon +
				chalk.gray(" → ") +
				formatValue(resolution.value),
		);
	}
	console.log();
}

/**
 * Format a value for display
 */
function formatValue(value: unknown): string {
	if (value === null || value === undefined) {
		return chalk.dim("(empty)");
	}

	if (Array.isArray(value)) {
		return value.length > 0 ? value.join(", ") : chalk.dim("(empty)");
	}

	if (typeof value === "object") {
		return JSON.stringify(value, null, 2);
	}

	const str = String(value);
	// Show first line for multiline strings
	const firstLine = str.split("\n")[0];
	return str.includes("\n") ? `${firstLine}...` : str;
}

/**
 * Truncate text to max width
 */
function truncate(text: string, maxWidth: number): string {
	if (text.length <= maxWidth) {
		return text;
	}
	return text.substring(0, maxWidth - 3) + "...";
}
