---
id: BACK-802
title: Allow explicit browser hostnames with remote access warnings
status: Done
assignee:
  - '@codex'
created_date: '2026-11-16T18:23:00Z'
updated_date: '2026-11-16T20:28:00Z'
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
  - src/test/server-init.test.ts
type: feature
ordinal: 407000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Keep browser startup local by default while allowing an expert user to deliberately choose --host after reading browser command help, or edit browser_hostname manually. Routine onboarding, Settings, configuration-key listings and user documentation must not promote remote access, because the existing unauthenticated API can change files and run status-change commands. New init writes 127.0.0.1 without an editable control; re-init preserves a manually configured value. The example is backlog browser with a manually configured remote host, optionally overridden by --host: only the final effective listening address decides whether the strong warning appears. Authentication, HTTPS and shared-hosting support remain outside scope.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 New projects created by backlog init save browser_hostname as 127.0.0.1 without a hostname prompt, control or advertised init option. Re-init preserves an existing manually configured hostname.
- [x] #2 A manually written browser_hostname is validated and preserved by configuration reads and writes. backlog browser --host overrides it for one run without saving; a missing value defaults to 127.0.0.1.
- [x] #3 Settings, browser init, the interactive configuration wizard, config key help and config list do not offer or advertise the hostname setting. Editing other Settings preserves a manually configured hostname.
- [x] #4 backlog browser --help shows --host alongside a prominent full warning covering unauthenticated data/configuration changes, local file and credential exposure, status-command execution and unencrypted HTTP.
- [x] #5 The warning is checked once at shared server startup after configuration and the CLI override select the effective listening address. A saved remote host warns without --host; a local override of a saved remote host does not warn; a remote override of a local host warns. Remote starts warn before serving, including --no-open and non-interactive runs.
- [x] #6 Binding, port checks, displayed/opened URLs, IPv4/IPv6 handling and --no-open remain consistent with the final effective address.
- [x] #7 README, configuration reference, CLI instructions and service guide do not advertise custom hostnames or --host. Their description of default local-only access remains accurate.
- [x] #8 Focused tests and compiled help/startup checks verify the reduced discovery surfaces, fixed init default, manual persistence, effective-host precedence and warning behavior.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bun run check:types passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Remove hostname controls and plumbing from CLI/browser init, the configuration wizard and browser Settings; delete the unused UI warning component. Keep the shared fixed init default and preserve manually configured values on re-init. Remove config get/set/list/help exposure while retaining strict file parsing/serialization and runtime validation.
2. Remove the feature's promotional documentation and examples. Describe default local behavior accurately without naming an override or manual setting. Preserve the task record as implementation history.
3. Keep the startup pipeline configuration -> --host override -> resolved effective listening address -> central warning -> listen. Reuse the full warning block in backlog browser --help, adjacent to the explicit --host option, without advertising the hidden config key.
4. Replace obsolete tests for removed UI/init/config controls with focused tests for fixed init defaults and manual persistence. Exercise saved-remote/no-flag, saved-remote/local-override and saved-local/remote-override startup behavior. Run types, Biome, affected tests, build/native smoke and inspect shipped help and documentation mentions.
5. Perform own scope/quality review and a narrow follow-up review of the changed discovery boundary and regressions, reusing the completed cold/context reviews. Finalize the task, commit/push to the existing feature branch, and update PR #1212 around the final scope. Do not merge or release.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Discovery: the original loopback-only decision is BACK-560 / PR #826. Existing implementation uses one BROWSER_HOST constant for net port probing, Bun serving and URLs. Configuration is owned by BacklogConfig, DEFAULT_INIT_CONFIG, FileSystem parse/save, shared initializeProject, CLI config commands and advanced wizard; browser Settings persists through /api/config and does not restart the listener. Current API config writes accept onStatusChange; Core.updateTask invokes the configured callback on a status change, and executeStatusCallback launches sh -c with process.env and the project working directory. This establishes a command-execution risk beyond Backlog file edits when exposing the existing API. No remote exploit was run and no production code has changed. The new task was reallocated by the CLI after loading the existing contributor branch so it does not reuse BACK-801.

Alex approved implementation in chat on 2026-11-16, including local-only defaults, saved hostname, one-run --host override and strong remote-access warning. Four expected regression failures were observed before implementation. Current focused checks: 121 tests pass across hostname input, server startup/port selection, CLI browser, config commands, and init; types and Biome pass; native build succeeds. Shared warning copy covers unauthenticated changes, status-change command execution, file/credential exposure and unencrypted HTTP. Cold simplicity review is running; live UI and broader verification are in progress.

Cold simplicity review completed. Applied its reproduced init-flow fix: a discarded advanced hostname no longer blocks default browser initialization; a focused DOM regression failed before the fix and passes after. Removed the redundant baseConfig hostname normalization and renamed the server resolver to resolveBrowserListeningAddress. Own specification/quality review traced config/init/Settings -> saved hostname -> one-run precedence -> single resolved binding address -> host-aware port probe and warning before Bun.serve; defaults, restart semantics and no-open remain consistent. Native live proof: init wrote 127.0.0.1; Settings showed remote warning, rejected a URL, saved localhost and retained it after reload; the running listener stayed loopback. A compiled --host 0.0.0.0 process warned before startup, answered via loopback and the available LAN address, preserved the saved value and exited 0 on SIGTERM. Browser screenshot: /tmp/backlog802-warning.jpg. The broad suite has an unrelated existing CLI document archive PTY assertion failure (rendered word spacing); it reproduces unchanged on origin/main 52b4ea3b in an isolated baseline worktree with its own baseline bundle. No assertions were weakened or unrelated tests changed.

Final evidence: 123 focused tests pass across 8 files (including IPv6 and the discarded advanced-setting regression); types, Biome, native build, compiled product smoke, and git diff --check pass. Full CI runner preserved its separate DOM pass: 3345 non-DOM tests pass, 13 skip, 1 existing document-archive PTY spacing assertion fails; all 409 DOM tests pass. The same PTY assertion fails with identical missing spaces on unchanged origin/main 52b4ea3b and a separately built baseline CLI, so it is not introduced by this task. Advanced configuration wizard was exercised with 0.0.0.0: it emitted the strong warning and returned the chosen hostname. Native/UI verification and screenshot are recorded above. Cold simplicity review and the separate full-context complexity review are complete; all in-scope findings are applied and the final review found no blockers or worthwhile additional simplification. Documentation links and command spellings were checked against current files and shipped help. Temporary QA listeners and the isolated baseline worktree were cleaned up. No merge or release.

Alex narrowed the approved scope after reviewing the remote-access risk: no editable hostname in init, Settings or configuration wizard; no promotion in docs or configuration-key inventories. Keep 127.0.0.1 written automatically during new init and manual file configuration support. Browser help is the only deliberate discovery surface and must display a large warning next to --host. Runtime warning belongs after configuration and CLI override resolve the effective address, regardless of which input enabled remote access. The existing backend pipeline already implements that order; strengthen end-to-end precedence proof while subtracting discovery surfaces.

Revised implementation is verified: hostname controls and all associated init/Settings/wizard plumbing were removed; the unused UI warning component was deleted. Config get/set/list/help no longer advertise the key, and user documentation has no custom hostname or --host mentions. Init still writes default_hostname: 127.0.0.1 automatically and re-init preserves manually configured values. The existing central startup pipeline is unchanged: configuration -> override -> resolved address -> one warning -> serve. Added a red/green init API test proving an init hostname override cannot replace the fixed local default. All 125 affected tests pass; types/Biome/native build/compiled smoke pass. Compiled manual checks confirmed init omits hostname from its prompts/summary/help, browser help shows the complete warning next to --host, and all three saved/override warning combinations behave correctly without changing configuration. Settings, browser init, wizard and their existing DOM test now match the original main versions exactly. Own specification/quality review confirms no stale UI control, docs promotion or separate flag-only warning remains. A narrow follow-up review checks only the revised discovery boundary and regressions; earlier cold and complexity reviews remain applicable to unchanged runtime logic.

Final revised-scope review is complete with no blocking findings. Verified defaults are saved silently, all GUI/init/wizard/config-list exposure is removed, and browser help alone carries --host plus the full warning. Native compiled checks exercised all three final-host warning cases and confirmed no configuration mutation. All 125 focused tests, types, Biome, native build, compiled smoke and git diff --check pass. No new full-suite rerun was needed for the reduced discovery surfaces; prior full-suite evidence and its unchanged-main PTY failure remain recorded above. The prior PR head had all 19 GitHub checks passing. The revised head will run fresh CI after push. Earlier Settings screenshots show the superseded UI; the hostname control and UI warning component have now been removed. No review thread was silently resolved, and no merge or release was performed.

Naming clarification: configuration properties describe their actual meaning; initialization defaults live in DEFAULT_INIT_CONFIG. The new, unreleased hostname field is browserHostname / browser_hostname rather than defaultHostname / default_hostname. No alias for the earlier PR spelling is needed. Existing shipped default_* settings are outside this feature's rename. This naming change does not alter the reduced discovery boundary or the effective-host warning pipeline.

Final naming verification: browserHostname/browser_hostname is used consistently in the model, initial defaults, parser/serializer, server, CLI and tests. No old hostname spelling remains in source and no compatibility alias was introduced for the unreleased PR name. DEFAULT_INIT_CONFIG provides the value rather than prefixing the configured property with default. All 125 focused tests, types, Biome, native build/smoke and compiled init/help/precedence checks pass again after the rename. Product docs contain neither the old/new setting names nor --host examples. Own review of the mechanical rename found no stale reference or behavioral change; earlier independent reviews remain valid.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
The saved browser setting is browserHostname in the configuration model and browser_hostname in YAML; its initial value is supplied by DEFAULT_INIT_CONFIG. New init writes 127.0.0.1 without exposing a control, and re-init preserves a manual value. Routine init/config UI, Settings, config key inventories and user docs do not advertise remote access. browser --help is the discovery surface for --host and displays the full warning. Shared startup reads configuration, applies an override, resolves the final address, then warns once before serving if remote access is enabled. Verified 125 focused tests, types, Biome, native build/smoke, compiled help and all three saved/override warning cases. Earlier independent reviews and the narrow follow-up found no blockers. The existing unauthenticated API risk remains; no authentication or HTTPS was added.
<!-- SECTION:FINAL_SUMMARY:END -->
