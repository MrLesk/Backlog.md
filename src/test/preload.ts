// Test preload (registered in bunfig.toml).
//
// This fork's `backlog init` ships a default onStatusChange hook, so every
// test project that initializes would otherwise spawn a dispatcher subprocess
// on each status transition. Disable the hook globally for the suite; the
// dedicated hook tests (status-callback.test.ts) re-enable it locally.
if (process.env.BACKLOG_DISABLE_STATUS_HOOKS === undefined) {
	process.env.BACKLOG_DISABLE_STATUS_HOOKS = "1";
}
