import { AsyncLocalStorage } from "node:async_hooks";

/**
 * Per-request commit context. Lets the web server attribute a commit to the
 * authenticated end-user (e.g. forwarded by oauth2-proxy) without threading an
 * author argument through every core method. Backed by AsyncLocalStorage, so it
 * is isolated per async context (concurrency-safe across simultaneous requests).
 */
export interface CommitContext {
	/** Git author string, e.g. `Jane Doe <jane@example.com>`. */
	author?: string;
}

export const commitContext = new AsyncLocalStorage<CommitContext>();

/** Run `fn` with the given commit author bound to the current async context. */
export function runWithCommitAuthor<T>(author: string | undefined, fn: () => T): T {
	return author ? commitContext.run({ author }, fn) : fn();
}

/** Extra `git commit` args (`--author`) for the current context, or none. */
export function commitAuthorArgs(): string[] {
	const author = commitContext.getStore()?.author;
	return author ? ["--author", author] : [];
}
