---
id: BACK-469
title: Add terminalStatuses to config get/set CLI commands
status: Done
assignee:
  - '@claude'
created_date: '2026-05-06 22:14'
updated_date: '2026-05-06 22:34'
labels:
  - bugfix
dependencies:
  - BACK-465
ordinal: 106000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The terminalStatuses config key was introduced in BACK-465 but not registered in the config get/set switch statements in src/cli.ts. Users cannot read or write this value via CLI.\n\nFiles to fix:\n- src/cli.ts: config get switch (~line 3452) — add case 'terminalStatuses'\n- src/cli.ts: config set switch (~line 3643) — add case 'terminalStatuses' (comma-separated string input → string[])
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 config get terminalStatuses returns the value from backlog.config.yml
- [x] #2 config set terminalStatuses 'Done,Closed' persists the array to config
- [x] #3 config get terminalStatuses prints empty/nothing when key not set
- [x] #4 Available keys error message updated to include terminalStatuses
- [x] #5 bun test: no new failures
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
3 Dateien geändert, 2 Bugs entdeckt:

| Datei | Änderung |
|-------|----------|
| src/cli.ts | config get + config set: Case terminalStatuses, beide Available-keys-Meldungen |
| src/file-system/operations.ts | serializeConfig: terminal_statuses-Zeile fehlte; saveConfig: [] → undefined Normalisierung |
| src/test/config-commands.test.ts | 4 neue Tests (set+get, leerer Default, Array-Roundtrip, Fehlerfall) |

Bugs entdeckt während Implementierung:
- serializeConfig schrieb terminal_statuses nicht in YAML zurück (fehlende Zeile im lines-Array)
- saveConfig cached leeres Array [] statt es zu undefined zu normalisieren → Roundtrip lieferte [] statt undefined

Bekannte Einschränkung: config set terminalStatuses "" nicht möglich (CLI verlangt pflicht-Argument) — zum Löschen Config-Datei direkt editieren.
<!-- SECTION:NOTES:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->
