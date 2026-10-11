import { link, lstat, mkdir, readlink, realpath, symlink, unlink } from "node:fs/promises";
import { dirname, isAbsolute, join, relative, resolve, sep } from "node:path";
import { buildGlobPattern } from "../utils/prefix-config.ts";
import type { Core } from "./backlog.ts";
import { findLocalDuplicateTaskIds } from "./duplicate-task-repair.ts";

/**
 * Archived task files stored outside the archive folder and what moving them into it would do.
 * Paths are project-relative.
 */
export interface ArchivedTaskMovePlan {
	/** The folder archiving writes to. */
	archiveDirectory: string;
	/** Files that can be moved, each to the same file name in the archive folder. */
	moves: Array<{ sourcePath: string; targetPath: string }>;
	/** Files that stay where they are because the archive folder already has a file with that name. */
	blocked: string[];
}

function projectPath(core: Core, path: string): string {
	return relative(core.filesystem.rootDir, path).split(sep).join("/");
}

/**
 * List the archived task files that live outside the archive folder. Nothing is changed.
 *
 * The directories come from the same list every archived-task reader uses, so a folder that is
 * only a link to the archive folder is not a second place to move files from.
 */
export async function previewArchivedTaskMove(core: Core): Promise<ArchivedTaskMovePlan> {
	const archiveDirectory = core.filesystem.archiveTasksDir;
	const config = await core.filesystem.loadConfig();
	const pattern = buildGlobPattern((config?.prefixes?.task ?? "task").toLowerCase());
	const plan: ArchivedTaskMovePlan = { archiveDirectory: projectPath(core, archiveDirectory), moves: [], blocked: [] };

	for (const directory of await core.filesystem.getArchivedTaskDirs()) {
		if (directory === archiveDirectory) continue;
		const files = await Array.fromAsync(new Bun.Glob(pattern).scan({ cwd: directory, followSymlinks: true }));
		for (const file of files.sort((left, right) => left.localeCompare(right))) {
			const sourcePath = projectPath(core, join(directory, file));
			const targetPath = join(archiveDirectory, file);
			// lstat, not exists(): a dangling link at the target is still a file that must not be replaced.
			const targetTaken = await lstat(targetPath).then(
				() => true,
				() => false,
			);
			if (targetTaken) plan.blocked.push(sourcePath);
			else plan.moves.push({ sourcePath, targetPath: projectPath(core, targetPath) });
		}
	}
	return plan;
}

/**
 * Move one file to a new directory without ever replacing a file that is already there: both
 * `link` and `symlink` fail when the target name is taken.
 *
 * A symbolic link is recreated rather than followed, so the task stays a link to the same file.
 * A relative link is rewritten, because the path it stores is resolved from the directory the
 * link itself lives in.
 */
async function moveWithoutReplacing(sourcePath: string, targetPath: string): Promise<void> {
	if ((await lstat(sourcePath)).isSymbolicLink()) {
		const linkTarget = await readlink(sourcePath);
		const sourceDirectory = await realpath(dirname(sourcePath));
		const targetDirectory = await realpath(dirname(targetPath));
		await symlink(
			isAbsolute(linkTarget) ? linkTarget : relative(targetDirectory, resolve(sourceDirectory, linkTarget)),
			targetPath,
		);
	} else {
		await link(sourcePath, targetPath);
	}
	await unlink(sourcePath);
}

/**
 * Move every archived task file that lives outside the archive folder into it, keeping file names
 * and IDs. Returns what was moved and what was left in place.
 *
 * Refused while two records claim one task ID: which record keeps a contested ID depends on the
 * folder each is stored in, so the collision has to be repaired before the folders are merged.
 */
export async function moveArchivedTasks(core: Core): Promise<ArchivedTaskMovePlan> {
	return await core.withCreateLock(async () => {
		if ((await findLocalDuplicateTaskIds(core)).length > 0) {
			throw new Error("Repair the duplicate task IDs before moving archived tasks into the archive folder.");
		}
		const plan = await previewArchivedTaskMove(core);
		const moved: ArchivedTaskMovePlan = { archiveDirectory: plan.archiveDirectory, moves: [], blocked: plan.blocked };
		if (plan.moves.length === 0) return moved;

		await mkdir(core.filesystem.archiveTasksDir, { recursive: true });
		for (const move of plan.moves) {
			try {
				await moveWithoutReplacing(
					join(core.filesystem.rootDir, move.sourcePath),
					join(core.filesystem.rootDir, move.targetPath),
				);
				moved.moves.push(move);
			} catch (error) {
				// Another writer claimed the name after the preview; the file stays where it was.
				if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
				moved.blocked.push(move.sourcePath);
			}
		}
		return moved;
	});
}
