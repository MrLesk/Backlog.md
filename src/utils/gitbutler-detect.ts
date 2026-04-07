import { GitButlerOperations } from "../git/gitbutler.ts";

/**
 * Check if GitButler is available in the project
 */
export async function isGitButlerAvailable(projectRoot: string): Promise<boolean> {
	return GitButlerOperations.isAvailable(projectRoot);
}
