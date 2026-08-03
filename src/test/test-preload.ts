// Git identity is runner configuration, not part of individual test behavior.
// Keeping it here avoids two subprocesses for every temporary repository.
process.env.GIT_AUTHOR_NAME = "Test User";
process.env.GIT_AUTHOR_EMAIL = "test@example.com";
process.env.GIT_COMMITTER_NAME = "Test User";
process.env.GIT_COMMITTER_EMAIL = "test@example.com";

await import("./react-dom-preload.ts");
