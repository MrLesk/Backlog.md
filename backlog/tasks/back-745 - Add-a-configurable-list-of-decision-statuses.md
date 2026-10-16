---
id: BACK-745
title: Add a configurable list of decision statuses
status: To Do
assignee: []
created_date: '2026-10-11 19:24'
labels:
  - enhancement
dependencies:
  - BACK-734
  - BACK-737
  - BACK-727
references:
  - 'https://github.com/MrLesk/Backlog.md/issues/1090'
  - 'https://github.com/MrLesk/Backlog.md/issues/1065'
type: enhancement
ordinal: 363000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
A project cannot declare which statuses its decisions use. `backlog decision create -s` accepts any text, so a typo such as `-s acepted` is stored and listed as a status of its own with exit 0. The four values the code names (proposed, accepted, rejected, superseded) are not enforced anywhere, and nothing can offer or check the values a project really uses (issue #1090). The reporter keeps decisions whose text lives in another repository and marks them `elsewhere`, because none of the four values means that.

Tasks already have this through the `statuses` list in the project config file. On a default project `backlog task create -s Blocked` fails with "Invalid status: Blocked. Valid statuses are: To Do, In Progress, Done" and exits 1, and `backlog task edit -s Blocked` does the same. A value is matched without regard to letter case or spaces and stored in the configured spelling (`-s INPROGRESS` stores `In Progress`). Command help names the configured values, and the web task editor offers them in a select.

The maintainer's answer on issue #1090 is yes, like task statuses. The project config gets a list of decision statuses that defaults to the current four values. One core rule checks it when a decision is created and whenever its status is changed, so every interface behaves the same, in line with the ruling on issue #1065 that every interface calls the same core function and adds no logic of its own. Issue #1090 suggests the key `decision_statuses`, next to `statuses`.

This is a breaking change for projects that use a status outside the four defaults today: they have to add that value to the list before it can be set again.

The list is read and changed the way the other configured lists are. `statuses`, `labels`, `priorities`, `types` and `projects` are shown by `backlog config get` and `backlog config list` and changed by editing the project config file; `backlog config set` refuses these keys and points to the file.

Settled during plan review, by mirroring what tasks do: what happens to an existing decision whose status is not in the list. It must stay readable and listable; whether it can be saved unchanged is open. For reference, a task with an unlisted status is listed and viewed normally and keeps that status when other fields are edited, while setting the unlisted value explicitly with `-s` is rejected. Also settled there: which status `backlog decision create` without `-s` uses when `proposed` is not in the list.

Depends on BACK-734 and BACK-737 (the single decision create and update path, where the rule belongs) and on BACK-727 (which adds the status edit, `backlog decision edit -s`). The web decision editor that offers the listed values is BACK-740, which builds on this task.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 A project whose config file has no decision status list behaves as if the list were proposed, accepted, rejected and superseded.
- [ ] #2 `backlog decision create -s <value>` accepts only values in the list: an unlisted value exits non-zero with a message that names the valid values, in the form task statuses use ("Invalid status: <value>. Valid statuses are: ..."), and no file is created.
- [ ] #3 `backlog decision edit <id> -s <value>` applies the same rule, and an unlisted value changes no file.
- [ ] #4 Matching follows task statuses: a value is matched without regard to letter case or spaces and is stored in the configured spelling.
- [ ] #5 A value added to the list in the project config file, for example `elsewhere`, can be set on create and on edit and is shown by `backlog decision list`.
- [ ] #6 Over HTTP a decision status that is not in the list is rejected by the same core rule with 400 and a JSON `error` that names the valid values, and no file is changed.
- [ ] #7 The web server exposes the configured decision statuses to the web UI the way `GET /api/statuses` exposes task statuses, so the web decision editor can offer exactly the listed values.
- [ ] #8 `backlog config get` and `backlog config list` show the decision status list, and `backlog config set` treats it the way it treats `statuses`.
- [ ] #9 A decision whose stored status is not in the list still appears in `backlog decision list` and in the web UI; no read fails because of the list.
- [ ] #10 The help and help schema of `backlog decision create` and `backlog decision edit` name the configured values the way `backlog task create --help` does for task statuses and no longer call the status free-form; the configuration reference and the shipped instruction guides (`backlog instructions`) describe the list.
- [ ] #11 Tests cover the default list, a custom list, rejection on create and on edit through the CLI and over HTTP, matching regardless of letter case, and reading a decision with an unlisted status.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 bunx tsc --noEmit passes when TypeScript touched
- [ ] #2 bun run check . passes when formatting/linting touched
- [ ] #3 bun test (or scoped test) passes
<!-- DOD:END -->
