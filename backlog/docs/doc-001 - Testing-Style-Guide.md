---
id: doc-001
title: Testing Style Guide
type: guide
created_date: '2025-07-21'
updated_date: '2026-07-11 09:22'
---
# Testing Style Guide

Tests protect shipped behavior and should fail for the same reasons users would observe. Choose the narrowest test level that proves the contract: focused domain units for shared semantics, and real CLI, MCP, TUI, browser, server, or packaged-binary tests for surface behavior. A test named for a public surface must execute that surface rather than synthesize its output.

## Isolation

- Create a fresh directory with `createUniqueTestDir()` for every test or suite.
- Never use a shared fixed path such as `/tmp/test-project`.
- Do not pre-delete a path returned by `createUniqueTestDir()`; uniqueness is the isolation guarantee.
- Initialize Git only when the behavior under test requires Git.
- Do not read or mutate the repository backlog as fixture data.

```typescript
let testDir: string;

beforeEach(async () => {
  testDir = createUniqueTestDir("feature-name");
  await mkdir(testDir, { recursive: true });
});

afterEach(async () => {
  await safeCleanup(testDir);
});
```

## Cleanup and resource ownership

Cleanup is part of the assertion, not optional housekeeping.

- Do not catch and ignore `safeCleanup()`, `rm()`, server shutdown, client close, watcher stop, unsubscribe, or child-process exit failures.
- Stop watchers, servers, subscriptions, streams, clients, and child processes before removing their directories.
- If a test owns a child process, kill it when needed and await its exit.
- Use `try/finally` around resources acquired inside a test.
- Let test hooks report teardown failures. Bun reports hook failures alongside the test failure, preserving both pieces of evidence.
- A best-effort catch is acceptable only when failure is the behavior being modeled, such as an existence probe returning `false`; make that fallback explicit.

## Timers and asynchronous synchronization

- Synchronize on an observable event, promise, stream message, file state, or process exit.
- Do not add sleeps to make a race less likely.
- Use `withTimeout()` to bound an operation. It clears its timer when the operation resolves or rejects.
- Event waiters must clear timers and unsubscribe on success, error, timeout, and teardown.
- A timeout increase is not a lifecycle fix. Platform-specific values need evidence and a comment naming the platform risk.

```typescript
const result = await withTimeout(operation, "config loading", 5000);
```

## Global state

Tests that change `process.env`, the working directory, console methods, clocks, DOM globals, or module mocks must capture the original value and restore it in `finally` or a test hook. Keep files isolated when they intentionally mutate process-wide state.

## Assertions and surface coverage

- Prefer direct assertions over conditional or vacuous checks.
- Use known fixture data so the expected result is always present.
- Assert subprocess exit codes as well as user-visible output and persisted state.
- Do not assert private object identity or reproduce production formatting in a test helper when observable behavior is available.
- Keep legacy compatibility tests only when the CLI, MCP, configuration, instruction, or file-format contract still promises that behavior.

## Platform coverage

Run portable behavior on every supported CI operating system. Use platform-specific skips only when the operating system cannot provide the underlying capability, and record the retained coverage on supported platforms. Windows resource pressure is handled by CI sharding; it is not a reason to replace CLI execution with Core simulations.

## Verification

Run focused tests first, including repeated stress for lifecycle or concurrency changes. Then run the full suite, typecheck, Biome, and build. Record test counts, runtime, expected skips, and the exact platform-specific evidence used for any exception.
