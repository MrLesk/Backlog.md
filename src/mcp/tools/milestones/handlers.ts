import type { Milestone, Task } from "../../../types/index.ts";
import { McpError } from "../../errors/mcp-errors.ts";
import type { McpServer } from "../../server.ts";
import type { CallToolResult } from "../../types.ts";
import {
	buildMilestoneMatchKeys,
	keySetsIntersect,
	milestoneKey,
	normalizeMilestoneName,
	resolveMilestoneStorageValue,
} from "../../utils/milestone-resolution.ts";

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

export type MilestoneArchiveArgs = {
	name: string;
};

function collectArchivedMilestoneKeys(archivedMilestones: Milestone[], activeMilestones: Milestone[]): string[] {
	const keys = new Set<string>();
	const activeTitleKeys = new Set(activeMilestones.map((milestone) => milestoneKey(milestone.title)).filter(Boolean));

	for (const milestone of archivedMilestones) {
		const idKey = milestoneKey(milestone.id);
		if (idKey) {
			keys.add(idKey);
		}
		const titleKey = milestoneKey(milestone.title);
		if (titleKey && !activeTitleKeys.has(titleKey)) {
			keys.add(titleKey);
		}
	}

	return Array.from(keys);
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

	private async listArchivedMilestones(): Promise<Milestone[]> {
		return await this.core.filesystem.listArchivedMilestones();
	}

	private async listKnownMilestones(): Promise<Milestone[]> {
		const [fileMilestones, archivedMilestones] = await Promise.all([
			this.listFileMilestones(),
			this.listArchivedMilestones(),
		]);
		return [...fileMilestones, ...archivedMilestones];
	}

	async listMilestones(): Promise<CallToolResult> {
		// Get file-based milestones
		const fileMilestones = await this.listFileMilestones();
		const fileMilestoneKeys = new Set<string>();
		for (const milestone of fileMilestones) {
			fileMilestoneKeys.add(milestoneKey(milestone.id));
			fileMilestoneKeys.add(milestoneKey(milestone.title));
		}

		const archivedMilestones = await this.listArchivedMilestones();
		const archivedKeys = new Set<string>(collectArchivedMilestoneKeys(archivedMilestones, fileMilestones));

		// Get milestones discovered from tasks
		const tasks = await this.listLocalTasks();
		const discoveredByKey = new Map<string, string>();
		for (const task of tasks) {
			const normalized = normalizeMilestoneName(task.milestone ?? "");
			if (!normalized) continue;
			const key = milestoneKey(normalized);
			if (archivedKeys.has(key)) continue;
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
		blocks.push(
			"Hint: use milestone_add to create milestone files, milestone_rename / milestone_remove to manage, milestone_archive to archive.",
		);

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

		const knownMilestones = await this.listKnownMilestones();
		const fromKeys = buildMilestoneMatchKeys(fromName, knownMilestones);
		const targetMilestone = resolveMilestoneStorageValue(toName, knownMilestones);

		// For now, renaming just updates tasks - milestone files would need separate rename logic
		// This maintains the core task reassignment functionality
		const shouldUpdateTasks = args.updateTasks ?? true;
		let updatedTaskIds: string[] = [];

		if (shouldUpdateTasks) {
			const tasks = await this.listLocalTasks();
			const matches = tasks.filter((task) => fromKeys.has(milestoneKey(task.milestone ?? "")));
			for (const task of matches) {
				await this.core.editTask(task.id, { milestone: targetMilestone });
				updatedTaskIds.push(task.id);
			}
			updatedTaskIds = updatedTaskIds.sort((a, b) => a.localeCompare(b));
		}

		const targetSummary = targetMilestone === toName ? `"${toName}"` : `"${toName}" (stored as "${targetMilestone}")`;
		const summaryLines: string[] = [`Renamed milestone "${fromName}" → ${targetSummary}.`];
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

		const knownMilestones = await this.listKnownMilestones();
		const removeKeys = buildMilestoneMatchKeys(name, knownMilestones);
		const taskHandling = args.taskHandling ?? "clear";
		const reassignTo = normalizeMilestoneName(args.reassignTo ?? "");
		const reassignedMilestone =
			taskHandling === "reassign" ? resolveMilestoneStorageValue(reassignTo, knownMilestones) : "";

		if (taskHandling === "reassign") {
			if (!reassignTo) {
				throw new McpError("reassignTo is required when taskHandling is reassign.", "VALIDATION_ERROR");
			}
			const reassignKeys = buildMilestoneMatchKeys(reassignTo, knownMilestones);
			if (keySetsIntersect(reassignKeys, removeKeys)) {
				throw new McpError("reassignTo must be different from the removed milestone.", "VALIDATION_ERROR");
			}
		}

		let updatedTaskIds: string[] = [];
		if (taskHandling !== "keep") {
			const tasks = await this.listLocalTasks();
			const matches = tasks.filter((task) => removeKeys.has(milestoneKey(task.milestone ?? "")));
			for (const task of matches) {
				await this.core.editTask(task.id, { milestone: taskHandling === "reassign" ? reassignedMilestone : null });
				updatedTaskIds.push(task.id);
			}
			updatedTaskIds = updatedTaskIds.sort((a, b) => a.localeCompare(b));
		}

		const summaryLines: string[] = [`Removed milestone "${name}".`];
		if (taskHandling === "keep") {
			summaryLines.push("Kept task milestone values unchanged (taskHandling=keep).");
		} else if (taskHandling === "reassign") {
			const targetSummary =
				reassignedMilestone === reassignTo ? `"${reassignTo}"` : `"${reassignTo}" (stored as "${reassignedMilestone}")`;
			summaryLines.push(
				`Reassigned ${updatedTaskIds.length} local task${updatedTaskIds.length === 1 ? "" : "s"} to ${targetSummary}: ${formatTaskIdList(updatedTaskIds)}`,
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

	async archiveMilestone(args: MilestoneArchiveArgs): Promise<CallToolResult> {
		const name = normalizeMilestoneName(args.name);
		if (!name) {
			throw new McpError("Milestone name cannot be empty.", "VALIDATION_ERROR");
		}

		const result = await this.core.archiveMilestone(name);
		if (!result.success) {
			throw new McpError(`Milestone not found: "${name}"`, "NOT_FOUND");
		}

		const label = result.milestone?.title ?? name;
		const id = result.milestone?.id;

		return {
			content: [
				{
					type: "text",
					text: `Archived milestone "${label}"${id ? ` (${id})` : ""}.`,
				},
			],
		};
	}
}
