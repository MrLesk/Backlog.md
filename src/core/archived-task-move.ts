import { copyFile, lstat, mkdir, open, readlink, realpath, symlink, unlink } from "node:fs/promises";
import { basename, dirname, isAbsolute, join, relative, resolve, sep } from "node:path";
import { buildGlobPattern } from "../utils/prefix-config.ts";
import type { Core } from "./backlog.ts";
import { findLocalDuplicateTaskIds, installFileNoReplace } from "./duplicate-task-repair.ts";

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
	/**
	 * Folders with files to move that are links to a directory outside the backlog directory. The
	 * move takes the files out of that directory, so whoever confirms it is shown where it is.
	 * `realDirectory` is absolute.
	 */
	linkedSources: Array<{ directory: string; realDirectory: string }>;
	/**
	 * Set when there are files to move and the archive folder resolves to a directory
	 * outside the backlog directory: the move puts the files into that directory.
	 */
	linkedDestination?: { directory: string; realDirectory: string };
}

function projectPath(core: Core, path: string): string {
	return relative(core.filesystem.rootDir, path).split(sep).join("/");
}

function isOutside(directory: string, path: string): boolean {
	const fromDirectory = relative(directory, path);
	return fromDirectory === ".." || fromDirectory.startsWith(`..${sep}`) || isAbsolute(fromDirectory);
}

/** Resolve a future folder through its nearest existing ancestor without creating anything. */
async function resolveDestinationDirectory(directory: string): Promise<string> {
	try {
		return await realpath(directory);
	} catch (error) {
		if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
		const parent = dirname(directory);
		if (parent === directory) throw error;
		return join(await resolveDestinationDirectory(parent), basename(directory));
	}
}

/**
 * List the archived task files that live outside the archive folder. Nothing is changed.
 *
 * The directories come from the same list every archived-task reader uses, so a folder that is
 * only a link to the archive folder is not a second place to move files from. Each source's real
 * directory is the one that reader resolved; the destination may not exist yet.
 */
export async function previewArchivedTaskMove(core: Core): Promise<ArchivedTaskMovePlan> {
	const archiveDirectory = core.filesystem.archiveTasksDir;
	const config = await core.filesystem.loadConfig();
	const pattern = buildGlobPattern((config?.prefixes?.task ?? "task").toLowerCase());
	const plan: ArchivedTaskMovePlan = {
		archiveDirectory: projectPath(core, archiveDirectory),
		moves: [],
		blocked: [],
		linkedSources: [],
	};
	const realBacklogDirectory = await realpath(core.filesystem.backlogDir);

	for (const { directory, realDirectory } of await core.filesystem.getArchivedTaskLocations()) {
		if (directory === archiveDirectory) continue;
		const movesBefore = plan.moves.length;
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
		if (plan.moves.length > movesBefore && isOutside(realBacklogDirectory, realDirectory)) {
			plan.linkedSources.push({ directory: projectPath(core, directory), realDirectory });
		}
	}
	if (plan.moves.length > 0) {
		const realDirectory = await resolveDestinationDirectory(archiveDirectory);
		if (isOutside(realBacklogDirectory, realDirectory)) {
			plan.linkedDestination = { directory: plan.archiveDirectory, realDirectory };
		}
	}
	return plan;
}

/**
 * `link` answers with one of these when the filesystem has no hard links or the folders are on two
 * filesystems. EPERM is in the list because that is how FAT and some network filesystems say "no
 * hard links"; when it is a real permission problem, the copy fails for the same reason.
 */
const HARD_LINK_UNAVAILABLE = new Set(["EXDEV", "EPERM", "ENOTSUP", "EOPNOTSUPP"]);

/** The file operations a move is made of. A test passes its own to stand in for one that fails. */
export interface MoveFileOperations {
	link: (sourcePath: string, targetPath: string) => Promise<void>;
	copyFile: (sourcePath: string, targetPath: string) => Promise<void>;
	unlink: (path: string) => Promise<void>;
}

/**
 * Move one record file to another folder without ever replacing a file that is already there. It
 * fails with EEXIST when the target name is taken. Tasks and documents move between their own
 * folder and the archive through this function, and so do the task files that `doctor` moves out
 * of a leftover folder.
 *
 * Demotion is not a move: it rewrites the task into a new draft file.
 *
 * A title change does not come here either. A task file keeps its name, and the file of a draft,
 * document or decision is renamed by `writeRecordFile` in `src/file-system/operations.ts`: a new
 * name that differs only in letter case is the same file where the file system ignores letter case,
 * and this function would refuse it as taken.
 *
 * The record is one file before the move and one file after it, also when the move fails: the
 * target is created first, under a name that was free, and the source is removed last. If anything
 * fails in between, the target is removed again and the source is still the record. Two files for
 * one record would make every read of its ID ambiguous, so if the target cannot be removed either,
 * the error names it as the file to delete by hand.
 *
 * A regular file is hard-linked under its new name. Where a hard link is not possible, the name is
 * claimed with an empty file first and the content is copied into it. A symbolic link is recreated
 * rather than followed, so the record stays a link to the same file; a relative link is rewritten,
 * because the path it stores is resolved from the directory the link itself lives in.
 */
export async function moveWithoutReplacing(
	sourcePath: string,
	targetPath: string,
	operations: Partial<MoveFileOperations> = {},
): Promise<void> {
	const files: MoveFileOperations = { link: installFileNoReplace, copyFile, unlink, ...operations };
	const source = await lstat(sourcePath);
	let contentMissing = false;

	// Each of these creates the target or fails with EEXIST because the name is taken.
	if (source.isSymbolicLink()) {
		const linkTarget = await readlink(sourcePath);
		const sourceDirectory = await realpath(dirname(sourcePath));
		const targetDirectory = await realpath(dirname(targetPath));
		await symlink(
			isAbsolute(linkTarget) ? linkTarget : relative(targetDirectory, resolve(sourceDirectory, linkTarget)),
			targetPath,
		);
	} else {
		try {
			await files.link(sourcePath, targetPath);
		} catch (error) {
			if (!HARD_LINK_UNAVAILABLE.has((error as NodeJS.ErrnoException).code ?? "")) throw error;
			// Writable even for a read-only source, so the copy can fill it; copyFile then gives it the source's mode.
			await (await open(targetPath, "wx", (source.mode & 0o777) | 0o200)).close();
			contentMissing = true;
		}
	}

	// The target exists and this call created it, so the name is this call's own to remove.
	try {
		if (contentMissing) await files.copyFile(sourcePath, targetPath);
		await files.unlink(sourcePath);
	} catch (error) {
		// The failure above is the one to report. If the target cannot be removed either, two files
		// are left for one record, so the report also names the target as the file to delete.
		try {
			await files.unlink(targetPath);
		} catch {
			const reason = error instanceof Error ? error.message : String(error);
			throw new Error(
				`${reason}\nThe second file this move created at ${targetPath} could not be removed. Delete that file by hand.`,
				{ cause: error },
			);
		}
		throw error;
	}
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
		const moved: ArchivedTaskMovePlan = { ...plan, moves: [] };
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
