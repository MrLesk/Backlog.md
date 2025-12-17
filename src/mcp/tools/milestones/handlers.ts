import type { Milestone, Task } from "../../../types/index.ts";
import { McpError } from "../../errors/mcp-errors.ts";
import type { McpServer } from "../../server.ts";
import type { CallToolResult } from "../../types.ts";

export type MilestoneAddArgs = {
	name: string;
	description?: string;
};

export type MilestoneRenameArgs = {
	from: string;
	to: string;
	updateTasks?: boolean;
};

export type MilestoneRemoveArgs = {
	name: string;
	taskHandling?: "clear" | "keep" | "reassign";
	reassignTo?: string;
};

function normalizeMilestoneName(name: string): string {
	return name.trim();
}

function milestoneKey(name: string): string {
	return normalizeMilestoneName(name).toLowerCase();
}

function formatListBlock(title: string, items: string[]): string {
	if (items.length === 0) {
		return `${title}\n  (none)`;
	}
	return `${title}\n${items.map((item) => `  - ${item}`).join("\n")}`;
}

function formatTaskIdList(taskIds: string[], limit = 20): string {
	if (taskIds.length === 0) return "";
	const shown = taskIds.slice(0, limit);
	const suffix = taskIds.length > limit ? ` (and ${taskIds.length - limit} more)` : "";
	return `${shown.join(", ")}${suffix}`;
}

export class MilestoneHandlers {
	constructor(private readonly core: McpServer) {}

	private async listLocalTasks(): Promise<Task[]> {
		return await this.core.queryTasks({ includeCrossBranch: false });
	}

	private async listFileMilestones(): Promise<Milestone[]> {
		return await this.core.filesystem.listMilestones();
	}

	async listMilestones(): Promise<CallToolResult> {
		// Get file-based milestones
		const fileMilestones = await this.listFileMilestones();
		const fileMilestoneKeys = new Set(fileMilestones.map((m) => milestoneKey(m.title)));

		// Get milestones discovered from tasks
		const tasks = await this.listLocalTasks();
		const discoveredByKey = new Map<string, string>();
		for (const task of tasks) {
			const normalized = normalizeMilestoneName(task.milestone ?? "");
			if (!normalized) continue;
			const key = milestoneKey(normalized);
			if (!discoveredByKey.has(key)) {
				discoveredByKey.set(key, normalized);
			}
		}

		const unconfigured = Array.from(discoveredByKey.entries())
			.filter(([key]) => !fileMilestoneKeys.has(key))
			.map(([, value]) => value)
			.sort((a, b) => a.localeCompare(b));

		const blocks: string[] = [];
		const milestoneLines = fileMilestones.map((m) => `${m.id}: ${m.title}`);
		blocks.push(formatListBlock(`Milestones (${fileMilestones.length}):`, milestoneLines));
		blocks.push(formatListBlock(`Milestones found on tasks without files (${unconfigured.length}):`, unconfigured));
		blocks.push("Hint: use milestone_add to create milestone files, milestone_rename / milestone_remove to manage.");

		return {
			content: [
				{
					type: "text",
					text: blocks.join("\n\n"),
				},
			],
		};
	}

	async addMilestone(args: MilestoneAddArgs): Promise<CallToolResult> {
		const name = normalizeMilestoneName(args.name);
		if (!name) {
			throw new McpError("Milestone name cannot be empty.", "VALIDATION_ERROR");
		}

		// Check for duplicates in existing milestone files
		const existing = await this.listFileMilestones();
		const nameKey = milestoneKey(name);
		const duplicate = existing.find((m) => milestoneKey(m.title) === nameKey);
		if (duplicate) {
			throw new McpError(`Milestone already exists: "${duplicate.title}" (${duplicate.id})`, "VALIDATION_ERROR");
		}

		// Create milestone file
		const milestone = await this.core.filesystem.createMilestone(name, args.description);

		return {
			content: [
				{
					type: "text",
					text: `Created milestone "${milestone.title}" (${milestone.id}).`,
				},
			],
		};
	}

	async renameMilestone(args: MilestoneRenameArgs): Promise<CallToolResult> {
		const fromName = normalizeMilestoneName(args.from);
		const toName = normalizeMilestoneName(args.to);
		if (!fromName || !toName) {
			throw new McpError("Both 'from' and 'to' milestone names are required.", "VALIDATION_ERROR");
		}

		const fromKey = milestoneKey(fromName);

		// For now, renaming just updates tasks - milestone files would need separate rename logic
		// This maintains the core task reassignment functionality
		const shouldUpdateTasks = args.updateTasks ?? true;
		let updatedTaskIds: string[] = [];

		if (shouldUpdateTasks) {
			const tasks = await this.listLocalTasks();
			const matches = tasks.filter((task) => milestoneKey(task.milestone ?? "") === fromKey);
			for (const task of matches) {
				await this.core.editTask(task.id, { milestone: toName });
				updatedTaskIds.push(task.id);
			}
			updatedTaskIds = updatedTaskIds.sort((a, b) => a.localeCompare(b));
		}

		const summaryLines: string[] = [`Renamed milestone "${fromName}" → "${toName}".`];
		if (shouldUpdateTasks) {
			summaryLines.push(
				`Updated ${updatedTaskIds.length} local task${updatedTaskIds.length === 1 ? "" : "s"}: ${formatTaskIdList(updatedTaskIds)}`,
			);
		} else {
			summaryLines.push("Skipped updating tasks (updateTasks=false).");
		}

		return {
			content: [
				{
					type: "text",
					text: summaryLines.join("\n"),
				},
			],
		};
	}

	async removeMilestone(args: MilestoneRemoveArgs): Promise<CallToolResult> {
		const name = normalizeMilestoneName(args.name);
		if (!name) {
			throw new McpError("Milestone name cannot be empty.", "VALIDATION_ERROR");
		}

		const removeKey = milestoneKey(name);
		const taskHandling = args.taskHandling ?? "clear";
		const reassignTo = normalizeMilestoneName(args.reassignTo ?? "");

		if (taskHandling === "reassign") {
			if (!reassignTo) {
				throw new McpError("reassignTo is required when taskHandling is reassign.", "VALIDATION_ERROR");
			}
			const reassignKey = milestoneKey(reassignTo);
			if (reassignKey === removeKey) {
				throw new McpError("reassignTo must be different from the removed milestone.", "VALIDATION_ERROR");
			}
		}

		let updatedTaskIds: string[] = [];
		if (taskHandling !== "keep") {
			const tasks = await this.listLocalTasks();
			const matches = tasks.filter((task) => milestoneKey(task.milestone ?? "") === removeKey);
			for (const task of matches) {
				await this.core.editTask(task.id, { milestone: taskHandling === "reassign" ? reassignTo : null });
				updatedTaskIds.push(task.id);
			}
			updatedTaskIds = updatedTaskIds.sort((a, b) => a.localeCompare(b));
		}

		const summaryLines: string[] = [`Removed milestone "${name}".`];
		if (taskHandling === "keep") {
			summaryLines.push("Kept task milestone values unchanged (taskHandling=keep).");
		} else if (taskHandling === "reassign") {
			summaryLines.push(
				`Reassigned ${updatedTaskIds.length} local task${updatedTaskIds.length === 1 ? "" : "s"} to "${reassignTo}": ${formatTaskIdList(updatedTaskIds)}`,
			);
		} else {
			summaryLines.push(
				`Cleared milestone for ${updatedTaskIds.length} local task${updatedTaskIds.length === 1 ? "" : "s"}: ${formatTaskIdList(updatedTaskIds)}`,
			);
		}

		return {
			content: [
				{
					type: "text",
					text: summaryLines.join("\n"),
				},
			],
		};
	}
}
