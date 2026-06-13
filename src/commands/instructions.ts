import type { Command } from "commander";
import {
	getInstructionGuideByKey,
	INSTRUCTION_GUIDE_KEYS,
	INSTRUCTION_GUIDES,
	type InstructionGuideKey,
	type WorkflowGuideDefinition,
} from "../mcp/workflow-guides.ts";
import { addHelpSchema, choiceType, renderConfiguredTaskIds } from "./help-schema.ts";

type InstructionsOptions = {
	list?: boolean;
};

function isInstructionGuideKey(value: string): value is InstructionGuideKey {
	return (INSTRUCTION_GUIDE_KEYS as readonly string[]).includes(value);
}

function guideCommand(guide: WorkflowGuideDefinition): string {
	return `backlog instructions ${guide.key}`;
}

function quoteCommand(command: string): string {
	return `'${command}'`;
}

function commandLine(command: string, description: string): string {
	return `  ${quoteCommand(command).padEnd(42)} ${description}`;
}

export function formatInstructionGuideIndex(): string {
	const lines: string[] = [
		"Backlog.md instructions",
		"",
		"Start here:",
		commandLine("backlog instructions overview", "Required first read before answering any user request"),
		commandLine("backlog <command> --help", "Show options, fields, and examples"),
		"",
		"Guides:",
	];

	for (const guide of INSTRUCTION_GUIDES) {
		lines.push(`  ${guide.key}`);
		lines.push(`    ${quoteCommand(guideCommand(guide))}`);
		lines.push(`      -> ${guide.description}`);
	}
	lines.push("");
	return lines.join("\n");
}

export function formatInstructionGuideMarkdown(markdown: string): string {
	const rendered = renderConfiguredTaskIds(markdown);
	return rendered.endsWith("\n") ? rendered : `${rendered}\n`;
}

export function registerInstructionsCommand(program: Command): void {
	addHelpSchema(program.command("instructions [guide]"), {
		reads: "Backlog.md workflow guides",
		required: [],
		optional: [
			{ name: "guide", type: choiceType(INSTRUCTION_GUIDE_KEYS), description: "Workflow guide to print" },
			{ name: "--list", type: "Boolean", description: "List available instruction guides" },
		],
		output: "Guide index, or markdown guide text when a guide is selected",
		examples: ["backlog instructions", "backlog instructions overview", "backlog instructions task-execution"],
	})
		.description("show Backlog.md workflow instructions")
		.option("--list", "list available instruction guides")
		.action((guide: string | undefined, options: InstructionsOptions) => {
			if (options.list || guide === undefined) {
				process.stdout.write(formatInstructionGuideIndex());
				return;
			}

			if (!isInstructionGuideKey(guide)) {
				console.error(`Unknown instruction guide: ${guide}`);
				console.error(`Valid guides: ${INSTRUCTION_GUIDE_KEYS.join(", ")}`);
				console.error("Run `backlog instructions` to see available guides.");
				process.exit(1);
			}

			const selectedGuide = getInstructionGuideByKey(guide);
			if (!selectedGuide) {
				console.error(`Instruction guide is not available: ${guide}`);
				process.exit(1);
			}

			process.stdout.write(formatInstructionGuideMarkdown(selectedGuide.resourceText));
		});
}
