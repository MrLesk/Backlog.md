import { DECISION_ID_PREFIX_RE, DEFAULT_FILE_PREFIXES, DOC_ID_PREFIX_RE } from "../constants/index.ts";
import type { Core } from "../core/backlog.ts";

/**
 * Generate the next available document ID by checking all branches and local documents
 * @param core Core instance for filesystem and git operations
 * @returns Promise<string> Next available document ID (e.g., "doc-001")
 */
export async function generateNextDocId(core: Core): Promise<string> {
	const config = await core.filesystem.loadConfig();
	// Load local documents
	const docs = await core.filesystem.listDocuments();
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
					const match = file.match(/doc-(\d+)/i);
					return match ? `${DEFAULT_FILE_PREFIXES.DOC}${match[1]}` : null;
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

	// Add local document IDs
	for (const doc of docs) {
		allIds.push(doc.id);
	}

	// Find the highest numeric ID
	let max = 0;
	for (const id of allIds) {
		const match = id.match(DOC_ID_PREFIX_RE);
		if (match) {
			max = Math.max(max, Number.parseInt(match[1] || "0", 10));
		}
	}

	const nextIdNumber = max + 1;
	const padding = config?.zeroPaddedIds;

	if (padding && typeof padding === "number" && padding > 0) {
		const paddedId = String(nextIdNumber).padStart(padding, "0");
		return `${DEFAULT_FILE_PREFIXES.DOC}${paddedId}`;
	}

	return `${DEFAULT_FILE_PREFIXES.DOC}${nextIdNumber}`;
}

/**
 * Generate the next available decision ID by checking all branches and local decisions
 * @param core Core instance for filesystem and git operations
 * @returns Promise<string> Next available decision ID (e.g., "decision-001")
 */
export async function generateNextDecisionId(core: Core): Promise<string> {
	const config = await core.filesystem.loadConfig();
	// Load local decisions
	const decisions = await core.filesystem.listDecisions();
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
					const match = file.match(/decision-(\d+)/i);
					return match ? `${DEFAULT_FILE_PREFIXES.DECISION}${match[1]}` : null;
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

	// Add local decision IDs
	for (const decision of decisions) {
		allIds.push(decision.id);
	}

	// Find the highest numeric ID
	const max = allIds
		.map((id) => id.match(DECISION_ID_PREFIX_RE))
		.filter((match): match is RegExpMatchArray => match !== null)
		.map((match) => Number.parseInt(match[1] || "0", 10))
		.reduce((a, b) => Math.max(a, b), 0);

	const nextIdNumber = max + 1;
	const padding = config?.zeroPaddedIds;

	const paddedId =
		padding && typeof padding === "number" && padding > 0
			? String(nextIdNumber).padStart(padding, "0")
			: String(nextIdNumber);

	return `${DEFAULT_FILE_PREFIXES.DECISION}${paddedId}`;
}
