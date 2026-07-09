import { link, rename, unlink } from "node:fs/promises";
import { basename, dirname, join, relative, resolve, sep } from "node:path";
import { EntityType, type Task } from "../types/index.ts";
import { type DuplicateGroup, detectDuplicateTaskIds } from "../utils/duplicate-detection.ts";
import { extractAnyPrefix, generateNextId, generateNextSubtaskId, idForFilename } from "../utils/prefix-config.ts";
import { canonicalTaskId } from "../utils/task-path.ts";
import type { Core } from "./backlog.ts";
import { type BranchTaskStateEntry, loadLocalBranchTasks, loadRemoteTasks } from "./task-loader.ts";

export type DuplicateTaskLocation = "active" | "completed";

export interface DuplicateRepairChange {
	sourcePath: string;
	targetPath: string;
	oldId: string;
	newId: string;
	title: string;
	location: DuplicateTaskLocation;
	sourceHash: string;
}

export interface DuplicateReferenceReview {
	path: string;
	line: number;
	text: string;
	ids: string[];
}

export interface CrossBranchDuplicateLocation {
	branch: string;
	path: string;
	state: "active" | "completed";
}

export interface CrossBranchDuplicateFinding {
	id: string;
	locations: CrossBranchDuplicateLocation[];
}

export interface DuplicateRepairPlan {
	groups: DuplicateGroup[];
	crossBranchFindings: CrossBranchDuplicateFinding[];
	changes: DuplicateRepairChange[];
	references: DuplicateReferenceReview[];
	referenceScanComplete: boolean;
	blockedReasons: string[];
	repairable: boolean;
	fingerprint: string;
}

export interface DuplicateRepairResult {
	repairedFiles: number;
	changes: DuplicateRepairChange[];
	references: DuplicateReferenceReview[];
	remainingGroups: DuplicateGroup[];
}

function normalizeRelativePath(rootDir: string, path: string): string {
	return relative(rootDir, path).split(sep).join("/");
}

function sha256(value: string): string {
	return new Bun.CryptoHasher("sha256").update(value).digest("hex");
}

function withLocation(task: Task, location: DuplicateTaskLocation, rootDir: string): Task {
	return {
		...task,
		filePath: task.filePath ? normalizeRelativePath(rootDir, task.filePath) : undefined,
		source: location === "completed" ? "completed" : "local",
	};
}

export async function findLocalDuplicateTaskIds(core: Core): Promise<DuplicateGroup[]> {
	const [activeTasks, completedTasks] = await Promise.all([
		core.filesystem.listTasks(),
		core.filesystem.listCompletedTasks(),
	]);
	return detectDuplicateTaskIds([
		...activeTasks.map((task) => withLocation(task, "active", core.filesystem.rootDir)),
		...completedTasks.map((task) => withLocation(task, "completed", core.filesystem.rootDir)),
	]);
}

function logicalBranchTaskPath(path: string, id: string): string {
	const filename = basename(path).toLowerCase();
	const prefix = extractAnyPrefix(id);
	if (!prefix) return filename;
	return filename.replace(new RegExp(`^${prefix}-(\\d+(?:\\.\\d+)*)`, "i"), canonicalTaskId(id).toLowerCase());
}

export async function findCrossBranchDuplicateTaskIds(core: Core): Promise<CrossBranchDuplicateFinding[]> {
	const config = await core.filesystem.loadConfig();
	if (config?.checkActiveBranches === false) return [];
	const [activeTasks, completedTasks, currentBranch] = await Promise.all([
		core.filesystem.listTasks(),
		core.filesystem.listCompletedTasks(),
		core.gitOps.getCurrentBranch(),
	]);
	const stateEntries: BranchTaskStateEntry[] = [];
	await Promise.all([
		loadLocalBranchTasks(
			core.gitOps,
			config,
			undefined,
			activeTasks,
			stateEntries,
			true,
			core.filesystem.backlogDirName,
		),
		loadRemoteTasks(core.gitOps, config, undefined, activeTasks, stateEntries, true, core.filesystem.backlogDirName),
	]);

	const current = currentBranch ?? "current";
	for (const task of activeTasks) {
		if (!task.filePath) continue;
		stateEntries.push({
			id: task.id,
			type: "task",
			branch: current,
			path: normalizeRelativePath(core.filesystem.rootDir, task.filePath),
			lastModified: task.updatedDate ? new Date(task.updatedDate) : new Date(0),
		});
	}
	for (const task of completedTasks) {
		if (!task.filePath) continue;
		stateEntries.push({
			id: task.id,
			type: "completed",
			branch: current,
			path: normalizeRelativePath(core.filesystem.rootDir, task.filePath),
			lastModified: task.updatedDate ? new Date(task.updatedDate) : new Date(0),
		});
	}

	const byId = new Map<string, BranchTaskStateEntry[]>();
	for (const entry of stateEntries) {
		if (entry.type !== "task" && entry.type !== "completed") continue;
		const id = canonicalTaskId(entry.id);
		const entries = byId.get(id) ?? [];
		entries.push(entry);
		byId.set(id, entries);
	}

	const findings: CrossBranchDuplicateFinding[] = [];
	for (const [id, entries] of byId) {
		const logicalPaths = new Set(entries.map((entry) => logicalBranchTaskPath(entry.path, entry.id)));
		const branches = new Set(entries.map((entry) => entry.branch));
		if (logicalPaths.size < 2 || branches.size < 2) continue;
		const locations = entries
			.map((entry) => ({
				branch: entry.branch,
				path: entry.path.split(sep).join("/"),
				state: entry.type === "completed" ? ("completed" as const) : ("active" as const),
			}))
			.sort((left, right) => `${left.branch}:${left.path}`.localeCompare(`${right.branch}:${right.path}`));
		findings.push({ id, locations });
	}
	return findings.sort((left, right) => left.id.localeCompare(right.id, undefined, { numeric: true }));
}

function getTaskLocation(task: Task): DuplicateTaskLocation {
	return task.source === "completed" ? "completed" : "active";
}

function matchesConfiguredPadding(taskId: string, zeroPaddedIds?: number): boolean {
	const body = taskId.replace(/^[A-Za-z]+-/, "");
	const segments = body.split(".");
	if (!segments.every((segment) => /^\d+$/.test(segment))) return false;
	if (zeroPaddedIds && zeroPaddedIds > 0) {
		return segments.every((segment, index) => segment.length === (index === 0 ? zeroPaddedIds : 2));
	}
	return segments.every((segment) => segment === String(Number.parseInt(segment, 10)));
}

function sortGroupTasks(tasks: Task[], zeroPaddedIds?: number): Task[] {
	return [...tasks].sort((left, right) => {
		const locationOrder =
			getTaskLocation(left) === getTaskLocation(right) ? 0 : getTaskLocation(left) === "active" ? -1 : 1;
		if (locationOrder !== 0) return locationOrder;
		const leftMatchesPadding = matchesConfiguredPadding(left.id, zeroPaddedIds);
		const rightMatchesPadding = matchesConfiguredPadding(right.id, zeroPaddedIds);
		if (leftMatchesPadding !== rightMatchesPadding) return leftMatchesPadding ? -1 : 1;
		return (left.filePath ?? left.title).localeCompare(right.filePath ?? right.title);
	});
}

function validateGroupParent(group: DuplicateGroup): { parentId?: string; blockedReasons: string[] } {
	const parentSeparator = group.id.lastIndexOf(".");
	if (parentSeparator < 0) return { blockedReasons: [] };

	const expectedParentId = group.id.slice(0, parentSeparator);
	const blockedReasons: string[] = [];
	let parentId: string | undefined;
	for (const task of group.tasks) {
		const taskPath = task.filePath ?? task.title;
		if (!task.parentTaskId) {
			blockedReasons.push(`${taskPath}: subtask ${task.id} has no parent_task_id; automatic repair is blocked.`);
			continue;
		}
		if (canonicalTaskId(task.parentTaskId) !== expectedParentId) {
			blockedReasons.push(
				`${taskPath}: subtask ${task.id} has parent_task_id ${task.parentTaskId}, expected ${expectedParentId}; automatic repair is blocked.`,
			);
			continue;
		}
		parentId ??= task.parentTaskId;
	}
	return { parentId, blockedReasons };
}

async function allocateRepairId(
	core: Core,
	parentId: string | undefined,
	existingIds: string[],
	plannedIds: string[],
	taskPrefix: string,
	zeroPaddedIds?: number,
): Promise<string> {
	const generatedId = await core.generateNextId(EntityType.Task, parentId);
	if (!plannedIds.some((plannedId) => canonicalTaskId(plannedId) === canonicalTaskId(generatedId))) {
		return generatedId;
	}

	const ids = [...existingIds, ...plannedIds];
	if (!parentId) return generateNextId(ids, taskPrefix, zeroPaddedIds);
	const generatedParent = generatedId.slice(0, generatedId.lastIndexOf("."));
	return generateNextSubtaskId(ids, generatedParent, taskPrefix, zeroPaddedIds);
}

function buildTargetPath(sourcePath: string, oldId: string, newId: string): string | null {
	const filename = basename(sourcePath);
	const prefix = extractAnyPrefix(oldId);
	if (!prefix) return null;
	const match = filename.match(new RegExp(`^${prefix.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}-(\\d+(?:\\.\\d+)*)`, "i"));
	if (!match?.[0] || canonicalTaskId(match[0]) !== canonicalTaskId(oldId)) return null;
	return join(dirname(sourcePath), `${idForFilename(newId)}${filename.slice(match[0].length)}`)
		.split(sep)
		.join("/");
}

function absoluteProjectPath(rootDir: string, projectPath: string): string {
	const absolute = resolve(rootDir, projectPath);
	const rootPrefix = `${resolve(rootDir)}${sep}`;
	if (absolute !== resolve(rootDir) && !absolute.startsWith(rootPrefix)) {
		throw new Error(`Repair path escapes the project root: ${projectPath}`);
	}
	return absolute;
}

function replaceFrontmatterTaskId(content: string, expectedId: string, newId: string): string {
	const delimiters = Array.from(content.matchAll(/^---(?:\r?\n|$)/gm));
	const opening = delimiters[0];
	const closing = delimiters[1];
	if (opening?.index !== 0) {
		throw new Error("Task file has no YAML frontmatter.");
	}
	if (!closing || closing.index === undefined) {
		throw new Error("Task file has unterminated YAML frontmatter.");
	}
	const frontmatterStart = opening[0].length;
	const frontmatter = content.slice(frontmatterStart, closing.index);
	const idLines = Array.from(frontmatter.matchAll(/^id\s*:[^\r\n]*/gm));
	if (idLines.length !== 1) {
		throw new Error(`Task frontmatter must contain exactly one top-level id field; found ${idLines.length}.`);
	}
	const idLine = idLines[0];
	if (!idLine || idLine.index === undefined) throw new Error("Task frontmatter id field could not be located safely.");
	const line = idLine[0];
	const match = line.match(/^(id\s*:\s*)([^#]*?)(\s+#.*)?$/);
	if (!match) throw new Error("Task frontmatter id field could not be updated safely.");
	const rawValue = (match[2] ?? "").trim();
	const quote =
		rawValue.length >= 2 && rawValue[0] === rawValue.at(-1) && /['"]/.test(rawValue[0] ?? "") ? rawValue[0] : "";
	const currentValue = quote ? rawValue.slice(1, -1) : rawValue;
	if (canonicalTaskId(currentValue) !== canonicalTaskId(expectedId)) {
		throw new Error(`Task frontmatter id ${currentValue || "(empty)"} does not match ${expectedId}.`);
	}
	const replacement = `${match[1]}${quote}${newId}${quote}${match[3] ?? ""}`;
	const idStart = frontmatterStart + idLine.index;
	return `${content.slice(0, idStart)}${replacement}${content.slice(idStart + line.length)}`;
}

interface DuplicateReferenceScanResult {
	references: DuplicateReferenceReview[];
	failures: string[];
}

function errorMessage(error: unknown): string {
	return error instanceof Error ? error.message : String(error);
}

async function findReferenceReviews(core: Core, groupIds: string[]): Promise<DuplicateReferenceScanResult> {
	if (groupIds.length === 0) return { references: [], failures: [] };
	const canonicalIds = new Set(groupIds.map(canonicalTaskId));
	let files: string[];
	try {
		files = await Array.fromAsync(
			new Bun.Glob("**/*.md").scan({ cwd: core.filesystem.backlogDir, followSymlinks: true }),
		);
	} catch (error) {
		return {
			references: [],
			failures: [`Reference scan failed under ${core.filesystem.backlogDirName}: ${errorMessage(error)}`],
		};
	}

	const reviews: DuplicateReferenceReview[] = [];
	const failures: string[] = [];
	const tokenPattern = /\b[A-Za-z]+-\d+(?:\.\d+)*\b/g;
	for (const file of files.sort((left, right) => left.localeCompare(right))) {
		const projectPath = normalizeRelativePath(core.filesystem.rootDir, join(core.filesystem.backlogDir, file));
		let content: string;
		try {
			content = await Bun.file(join(core.filesystem.backlogDir, file)).text();
		} catch (error) {
			failures.push(`Reference scan could not read ${projectPath}: ${errorMessage(error)}`);
			continue;
		}
		const lines = content.split(/\r?\n/);
		let inFrontmatter = lines[0] === "---";
		for (let index = 0; index < lines.length; index += 1) {
			const line = lines[index] ?? "";
			if (index > 0 && inFrontmatter && line === "---") {
				inFrontmatter = false;
				continue;
			}
			if (inFrontmatter && /^id\s*:/.test(line)) continue;
			const ids = Array.from(line.matchAll(tokenPattern), (match) => match[0]).filter((id) =>
				canonicalIds.has(canonicalTaskId(id)),
			);
			const uniqueIds = [...new Set(ids.map(canonicalTaskId))];
			if (uniqueIds.length === 0) continue;
			reviews.push({
				path: projectPath,
				line: index + 1,
				text: line.trim().slice(0, 240),
				ids: uniqueIds,
			});
		}
	}
	return { references: reviews, failures };
}

export async function previewDuplicateTaskIdRepair(
	core: Core,
	options: { includeBranches?: boolean } = {},
): Promise<DuplicateRepairPlan> {
	const groups = await findLocalDuplicateTaskIds(core);
	const crossBranchFindings = options.includeBranches ? await findCrossBranchDuplicateTaskIds(core) : [];
	const blockedReasons: string[] = [];
	const changes: DuplicateRepairChange[] = [];
	const [activeTasks, completedTasks, config] = await Promise.all([
		core.filesystem.listTasks(),
		core.filesystem.listCompletedTasks(),
		core.filesystem.loadConfig(),
	]);
	const existingIds = [...activeTasks, ...completedTasks].map((task) => task.id);
	const plannedIds: string[] = [];

	for (const group of groups) {
		const tasks = sortGroupTasks(group.tasks, config?.zeroPaddedIds);
		const parentValidation = validateGroupParent(group);
		if (parentValidation.blockedReasons.length > 0) {
			blockedReasons.push(...parentValidation.blockedReasons);
			continue;
		}
		for (const task of tasks.slice(1)) {
			if (!task.filePath) {
				blockedReasons.push(`${group.id}: ${task.title} has no local file path.`);
				continue;
			}
			const nextId = await allocateRepairId(
				core,
				parentValidation.parentId,
				existingIds,
				plannedIds,
				config?.prefixes?.task ?? "task",
				config?.zeroPaddedIds,
			);
			const targetPath = buildTargetPath(task.filePath, task.id, nextId);
			if (!targetPath) {
				blockedReasons.push(`${task.filePath}: filename and frontmatter ID do not identify the same task.`);
				continue;
			}
			const sourcePath = absoluteProjectPath(core.filesystem.rootDir, task.filePath);
			const targetAbsolutePath = absoluteProjectPath(core.filesystem.rootDir, targetPath);
			const content = await Bun.file(sourcePath)
				.text()
				.catch(() => "");
			if (!content) {
				blockedReasons.push(`${task.filePath}: task file could not be read.`);
				continue;
			}
			try {
				replaceFrontmatterTaskId(content, task.id, nextId);
			} catch (error) {
				blockedReasons.push(`${task.filePath}: ${error instanceof Error ? error.message : String(error)}`);
				continue;
			}
			if (await Bun.file(targetAbsolutePath).exists()) {
				blockedReasons.push(`${targetPath}: target file already exists.`);
				continue;
			}
			changes.push({
				sourcePath: task.filePath,
				targetPath,
				oldId: task.id,
				newId: nextId,
				title: task.title,
				location: getTaskLocation(task),
				sourceHash: sha256(content),
			});
			plannedIds.push(nextId);
		}
	}

	const duplicateFileCount = groups.reduce((total, group) => total + group.tasks.length - 1, 0);
	if (changes.length !== duplicateFileCount) {
		blockedReasons.push(
			`Expected ${duplicateFileCount} duplicate ${duplicateFileCount === 1 ? "file" : "files"} to be repairable, but prepared ${changes.length}.`,
		);
	}
	const targetPaths = changes.map((change) => change.targetPath);
	if (new Set(targetPaths).size !== targetPaths.length) {
		blockedReasons.push("Repair would create duplicate target paths.");
	}

	const referenceScan = await findReferenceReviews(
		core,
		groups.map((group) => group.id),
	);
	blockedReasons.push(...referenceScan.failures);
	const uniqueBlockedReasons = [...new Set(blockedReasons)];
	const fingerprint = sha256(
		JSON.stringify({
			groups: groups.map((group) => ({ id: group.id, paths: group.tasks.map((task) => task.filePath) })),
			changes,
			referenceScan,
		}),
	);
	return {
		groups,
		crossBranchFindings,
		changes,
		references: referenceScan.references,
		referenceScanComplete: referenceScan.failures.length === 0,
		blockedReasons: uniqueBlockedReasons,
		repairable: groups.length > 0 && uniqueBlockedReasons.length === 0,
		fingerprint,
	};
}

async function removeIfPresent(path: string): Promise<void> {
	try {
		await unlink(path);
	} catch (error) {
		if ((error as NodeJS.ErrnoException | undefined)?.code !== "ENOENT") throw error;
	}
}

/** @internal Installs a staged file without replacing an existing destination. */
export async function installFileNoReplace(stagedPath: string, targetPath: string): Promise<void> {
	// Staged and target files share a directory, so a hard link atomically claims
	// the destination name and fails with EEXIST if an external writer won.
	await link(stagedPath, targetPath);
}

export async function applyDuplicateTaskIdRepair(
	core: Core,
	expectedFingerprint: string,
): Promise<DuplicateRepairResult> {
	return await core.withCreateLock(async () => {
		const plan = await previewDuplicateTaskIdRepair(core);
		if (plan.fingerprint !== expectedFingerprint) {
			throw new Error("Duplicate task files changed after the preview. Run 'backlog doctor' again before repairing.");
		}
		if (!plan.repairable) {
			throw new Error(plan.blockedReasons.join("\n") || "No duplicate task IDs are available to repair.");
		}

		const transactionId = `${process.pid}-${Date.now()}`;
		const prepared = await Promise.all(
			plan.changes.map(async (change, index) => {
				const sourcePath = absoluteProjectPath(core.filesystem.rootDir, change.sourcePath);
				const targetPath = absoluteProjectPath(core.filesystem.rootDir, change.targetPath);
				const content = await Bun.file(sourcePath).text();
				if (sha256(content) !== change.sourceHash) {
					throw new Error(`${change.sourcePath} changed after the preview.`);
				}
				if (await Bun.file(targetPath).exists()) {
					throw new Error(`${change.targetPath} now exists; no files were changed.`);
				}
				return {
					...change,
					sourcePath,
					targetPath,
					content: replaceFrontmatterTaskId(content, change.oldId, change.newId),
					stagedPath: `${targetPath}.backlog-doctor-${transactionId}-${index}.tmp`,
					backupPath: `${sourcePath}.backlog-doctor-${transactionId}-${index}.bak`,
				};
			}),
		);

		const staged: string[] = [];
		const backups: Array<{ sourcePath: string; backupPath: string }> = [];
		const installed: string[] = [];
		try {
			for (const item of prepared) {
				await Bun.write(item.stagedPath, item.content);
				staged.push(item.stagedPath);
			}
			for (const item of prepared) {
				await rename(item.sourcePath, item.backupPath);
				backups.push({ sourcePath: item.sourcePath, backupPath: item.backupPath });
			}
			for (const item of prepared) {
				try {
					await installFileNoReplace(item.stagedPath, item.targetPath);
				} catch (error) {
					if ((error as NodeJS.ErrnoException | undefined)?.code === "EEXIST") {
						throw new Error(`${item.targetPath} now exists; no files were changed.`);
					}
					throw error;
				}
				installed.push(item.targetPath);
				await unlink(item.stagedPath);
			}

			const remainingGroups = await findLocalDuplicateTaskIds(core);
			if (remainingGroups.length > 0) {
				throw new Error("Repair verification still found duplicate task IDs.");
			}

			for (const item of backups) await removeIfPresent(item.backupPath).catch(() => {});
			core.disposeSearchService();
			core.disposeContentStore();
			return {
				repairedFiles: plan.changes.length,
				changes: plan.changes,
				references: plan.references,
				remainingGroups,
			};
		} catch (error) {
			for (const path of installed.reverse()) await removeIfPresent(path).catch(() => {});
			for (const item of backups.reverse()) {
				await rename(item.backupPath, item.sourcePath).catch(() => {});
			}
			for (const path of staged) await removeIfPresent(path).catch(() => {});
			throw error;
		}
	});
}
