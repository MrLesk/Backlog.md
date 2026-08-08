// Git identity is runner configuration, not part of individual test behavior.
// Keeping it here avoids two subprocesses for every temporary repository.
process.env.GIT_AUTHOR_NAME = "Test User";
process.env.GIT_AUTHOR_EMAIL = "test@example.com";
process.env.GIT_COMMITTER_NAME = "Test User";
process.env.GIT_COMMITTER_EMAIL = "test@example.com";

// The react-dom/jsdom preload is skipped for CI passes whose test files never
// touch the DOM. Importing jsdom re-runs per isolated realm and its
// jsdom -> undici -> node:assert chain constructs process.stderr, which inside
// `bun test --parallel` workers on Linux can die with an uncatchable
// "EEXIST: file already exists, epoll_ctl" that fails whole unrelated test
// files (BACK-585). scripts/run-ci-tests.ts sets the variable for those passes.
if (!process.env.BACKLOG_TEST_SKIP_DOM_PRELOAD) {
	await import("./react-dom-preload.ts");
}
