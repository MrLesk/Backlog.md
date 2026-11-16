---
id: BACK-802
title: Allow explicit browser hostnames with remote access warnings
status: Done
assignee:
  - '@codex'
created_date: '2026-11-16T18:23:00Z'
updated_date: '2026-11-16T19:01:00Z'
labels:
  - browser
  - configuration
  - security
dependencies: []
references:
  - https://github.com/MrLesk/Backlog.md/issues/810
  - https://github.com/MrLesk/Backlog.md/pull/826
  - src/server/index.ts
  - src/cli.ts
  - src/commands/advanced-config-wizard.ts
  - src/web/components/Settings.tsx
modified_files:
  - src/test/config-commands.test.ts
  - src/test/server-hostname.test.ts
  - src/utils/browser-host.ts
  - src/types/index.ts
  - src/constants/index.ts
  - src/core/init.ts
  - src/file-system/operations.ts
  - src/server/index.ts
  - src/cli.ts
  - src/commands/advanced-config-wizard.ts
  - src/web/components/RemoteAccessWarning.tsx
  - src/web/components/Settings.tsx
  - src/web/components/InitializationScreen.tsx
  - src/web/lib/api.ts
  - src/test/enhanced-init.test.ts
  - src/test/cli-browser-port.test.ts
  - src/test/browser-host.test.ts
  - README.md
  - ADVANCED-CONFIG.md
  - CLI-INSTRUCTIONS.md
  - backlog/docs/doc-003 - Running-Backlog-Browser-as-a-Service.md
  - src/test/server-port.test.ts
  - src/test/web-initialization-cursor.test.tsx
type: feature
ordinal: 407000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Backlog browser is local-only after issue #810 and BACK-560. Alex now approved allowing a user to choose a saved listening hostname in configuration, browser Settings, and advanced init, with a --host override for one run. This replaces the earlier ban on a host override while preserving local-only defaults. The example is a user intentionally starting backlog browser --host 0.0.0.0 so other devices can reach the project, after a clear terminal warning explains that Backlog exposes an unauthenticated read/write API which changes local project files. No authentication system, HTTPS configuration, or multi-user hosting is part of this feature.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 New projects created by backlog init default the browser hostname to 127.0.0.1. Advanced init can change it, and existing projects with no hostname setting still bind locally.
- [x] #2 The saved hostname can be read and changed through backlog config commands, the interactive configuration wizard, and browser Settings, with consistent validation. Changes apply on the next browser server start.
- [x] #3 backlog browser --host <hostname> overrides the saved hostname for that run without changing it. Without an override or saved value, the server uses 127.0.0.1.
- [x] #4 Server binding and port availability checks use the selected host, and startup output and automatic browser opening provide an appropriate usable URL, including wildcard and IPv6 addresses.
- [x] #5 Before accepting remote connections, a non-loopback server start prints a prominent terminal warning explaining the lack of authentication and transport encryption, local file read/write access, and command execution through status-change configuration with the server account permissions. The warning appears on every such start, including --no-open and non-interactive runs.
- [x] #6 Browser Settings and advanced init warn when selecting a host that permits remote access. Saving settings does not change the running server binding.
- [x] #7 CLI help and public documentation explain local-only defaults, the saved setting, override precedence, restart behavior, and the risks of enabling remote access.
- [x] #8 Focused tests and live checks prove defaults, persistence and overrides, host-aware port selection and URLs, remote-access warnings, and unchanged --no-open behavior.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bun run check:types passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Add defaultHostname alongside defaultPort in the shared configuration contract, with default_hostname in YAML. Init writes 127.0.0.1 for a new project; re-init preserves an existing choice, and missing values retain the same local-only default. Reuse one hostname validation rule across config read/write, CLI config commands, advanced init/config prompts, and the browser config API.
2. Add the hostname to the existing Web UI Settings section and advanced Web UI prompts. Explain remote-access risk when a non-loopback choice is made and state that saved host changes apply on the next server start; do not rebind a running server.
3. Add backlog browser --host <hostname> with precedence CLI override > saved defaultHostname > 127.0.0.1. Resolve the effective binding consistently for port probing, server startup and usable displayed/opened URLs, including hostname, wildcard and IPv6 inputs. Never persist a one-run override.
4. Print a prominent WARNING: INSECURE REMOTE ACCESS block to stderr before a binding can accept remote connections, on every such start including --no-open and non-interactive runs. Identify the listening host and explain unauthenticated read/write access, unencrypted HTTP, writes to local files and the ability to execute commands through status-change configuration using the server account permissions. Preserve normal local-only output without this warning.
5. Extend the existing config/init, server hostname/port, browser command, and relevant UI tests for accepted behavior. Prove the changed contracts fail before implementation where practical. Perform live isolated-project checks of local-only defaults, explicit network binding, warning order, settings persistence/restart behavior, and --no-open; inspect the rendered Settings control.
6. Update CLI help, README, CLI instructions and the browser-service guide through its product command. Run affected focused tests, bun run check:types, bun run check, build/browser verification, and any broader tests required by failures or shared changes. Preserve the serial DOM-test pass.
7. After focused checks, obtain the cold simplicity review, perform specification and quality reviews, then obtain the separate full-context complexity review required for this material cross-surface behavior change. Apply in-scope findings, record criterion evidence, then finalize and publish the task branch PR. Do not merge or release.
Plan review point: this deliberately changes the previous loopback-only public contract. Alex has approved saved settings plus --host and the 127.0.0.1 init default; present the researched plan and the newly identified command-execution risk before implementation.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Discovery: the original loopback-only decision is BACK-560 / PR #826. Existing implementation uses one BROWSER_HOST constant for net port probing, Bun serving and URLs. Configuration is owned by BacklogConfig, DEFAULT_INIT_CONFIG, FileSystem parse/save, shared initializeProject, CLI config commands and advanced wizard; browser Settings persists through /api/config and does not restart the listener. Current API config writes accept onStatusChange; Core.updateTask invokes the configured callback on a status change, and executeStatusCallback launches sh -c with process.env and the project working directory. This establishes a command-execution risk beyond Backlog file edits when exposing the existing API. No remote exploit was run and no production code has changed. The new task was reallocated by the CLI after loading the existing contributor branch so it does not reuse BACK-801.

Alex approved implementation in chat on 2026-11-16, including local-only defaults, saved hostname, one-run --host override and strong remote-access warning. Four expected regression failures were observed before implementation. Current focused checks: 121 tests pass across hostname input, server startup/port selection, CLI browser, config commands, and init; types and Biome pass; native build succeeds. Shared warning copy covers unauthenticated changes, status-change command execution, file/credential exposure and unencrypted HTTP. Cold simplicity review is running; live UI and broader verification are in progress.

Cold simplicity review completed. Applied its reproduced init-flow fix: a discarded advanced hostname no longer blocks default browser initialization; a focused DOM regression failed before the fix and passes after. Removed the redundant baseConfig hostname normalization and renamed the server resolver to resolveBrowserListeningAddress. Own specification/quality review traced config/init/Settings -> saved hostname -> one-run precedence -> single resolved binding address -> host-aware port probe and warning before Bun.serve; defaults, restart semantics and no-open remain consistent. Native live proof: init wrote 127.0.0.1; Settings showed remote warning, rejected a URL, saved localhost and retained it after reload; the running listener stayed loopback. A compiled --host 0.0.0.0 process warned before startup, answered via loopback and the available LAN address, preserved the saved value and exited 0 on SIGTERM. Browser screenshot: /tmp/backlog802-warning.jpg. The broad suite has an unrelated existing CLI document archive PTY assertion failure (rendered word spacing); it reproduces unchanged on origin/main 52b4ea3b in an isolated baseline worktree with its own baseline bundle. No assertions were weakened or unrelated tests changed.

Final evidence: 123 focused tests pass across 8 files (including IPv6 and the discarded advanced-setting regression); types, Biome, native build, compiled product smoke, and git diff --check pass. Full CI runner preserved its separate DOM pass: 3345 non-DOM tests pass, 13 skip, 1 existing document-archive PTY spacing assertion fails; all 409 DOM tests pass. The same PTY assertion fails with identical missing spaces on unchanged origin/main 52b4ea3b and a separately built baseline CLI, so it is not introduced by this task. Advanced configuration wizard was exercised with 0.0.0.0: it emitted the strong warning and returned the chosen hostname. Native/UI verification and screenshot are recorded above. Cold simplicity review and the separate full-context complexity review are complete; all in-scope findings are applied and the final review found no blockers or worthwhile additional simplification. Documentation links and command spellings were checked against current files and shipped help. Temporary QA listeners and the isolated baseline worktree were cleaned up. No merge or release.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Added defaultHostname/default_hostname across config commands, Settings and advanced init, with 127.0.0.1 as the saved new-project default and fallback for older projects. backlog browser --host overrides the saved value for one run; host resolution, port probing, binding and browser URLs agree. Remote listeners warn before serving about unauthenticated file/config changes, status-command execution and unencrypted HTTP; Settings/init show the same risk. Saved changes require restart. Verified 123 focused tests, types, Biome, native build/smoke, live UI/LAN checks and both required reviews. The full suite has one existing document-archive PTY spacing failure, reproduced unchanged on origin/main; all 409 DOM tests pass.
<!-- SECTION:FINAL_SUMMARY:END -->
