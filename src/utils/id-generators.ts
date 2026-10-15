import { basename } from "node:path";
import type { Core } from "../index.ts";
import { extractIdFromFilename, generateNextId } from "./prefix-config.ts";

/**
 * The IDs that local record files occupy: the ID stored in each record's frontmatter and the ID
 * each file claims through its name. A file whose frontmatter could not be read
 * (`unreadableFiles`) still reserves the number in its name.
 */
function occupiedLocalIds(
	records: Array<{ id: string; path?: string }>,
	unreadableFiles: string[],
	prefix: string,
): string[] {
	const filePaths = [...records.map((record) => record.path ?? ""), ...unreadableFiles];
	const idsFromFileNames = filePaths
		.map((filePath) => extractIdFromFilename(basename(filePath), prefix))
		.filter((id): id is string => id !== null);
	return [...records.map((record) => record.id), ...idsFromFileNames];
}

/**
 * Generate the next available document ID by checking all branches and local documents
 * @param core Core instance for filesystem and git operations
 * @returns Promise<string> Next available document ID (e.g., "doc-001")
 */
export async function generateNextDocId(core: Core): Promise<string> {
	const config = await core.filesystem.loadConfig();
	// Load local documents
	const unreadableFiles: string[] = [];
	const docs = await core.filesystem.listDocuments(unreadableFiles);
	const allIds: string[] = [];

	try {
		const backlogDir = core.filesystem.backlogDirName;

		// Skip remote operations if disabled
		if (config?.remoteOperations === false) {
			if (process.env.DEBUG) {
				console.log("Remote operations disabled - generating ID from local documents only");
			}
		} else {
			await core.gitOps.fetch();
		}

		const branches = await core.gitOps.listAllBranches();

		// Load files from all branches in parallel
		const branchFilePromises = branches.map(async (branch) => {
			const files = await core.gitOps.listFilesInTree(branch, `${backlogDir}/docs`);
			return files
				.map((file) => {
					const match = file.match(/doc-(\d+)/);
					return match ? `doc-${match[1]}` : null;
				})
				.filter((id): id is string => id !== null);
		});

		const branchResults = await Promise.all(branchFilePromises);
		for (const branchIds of branchResults) {
			allIds.push(...branchIds);
		}
	} catch (error) {
		// Suppress errors for offline mode or other git issues
		if (process.env.DEBUG) {
			console.error("Could not fetch remote document IDs:", error);
		}
	}

	allIds.push(...occupiedLocalIds(docs, unreadableFiles, "doc"));

	return generateNextId(allIds, "doc", config?.zeroPaddedIds).toLowerCase();
}

/**
 * Generate the next available decision ID by checking all branches and local decisions
 * @param core Core instance for filesystem and git operations
 * @returns Promise<string> Next available decision ID (e.g., "decision-001")
 */
export async function generateNextDecisionId(core: Core): Promise<string> {
	const config = await core.filesystem.loadConfig();
	// Load local decisions
	const unreadableFiles: string[] = [];
	const decisions = await core.filesystem.listDecisions(unreadableFiles);
	const allIds: string[] = [];

	try {
		const backlogDir = core.filesystem.backlogDirName;

		// Skip remote operations if disabled
		if (config?.remoteOperations === false) {
			if (process.env.DEBUG) {
				console.log("Remote operations disabled - generating ID from local decisions only");
			}
		} else {
			await core.gitOps.fetch();
		}

		const branches = await core.gitOps.listAllBranches();

		// Load files from all branches in parallel
		const branchFilePromises = branches.map(async (branch) => {
			const files = await core.gitOps.listFilesInTree(branch, `${backlogDir}/decisions`);
			return files
				.map((file) => {
					const match = file.match(/decision-(\d+)/);
					return match ? `decision-${match[1]}` : null;
				})
				.filter((id): id is string => id !== null);
		});

		const branchResults = await Promise.all(branchFilePromises);
		for (const branchIds of branchResults) {
			allIds.push(...branchIds);
		}
	} catch (error) {
		// Suppress errors for offline mode or other git issues
		if (process.env.DEBUG) {
			console.error("Could not fetch remote decision IDs:", error);
		}
	}

	allIds.push(...occupiedLocalIds(decisions, unreadableFiles, "decision"));

	return generateNextId(allIds, "decision", config?.zeroPaddedIds).toLowerCase();
}
