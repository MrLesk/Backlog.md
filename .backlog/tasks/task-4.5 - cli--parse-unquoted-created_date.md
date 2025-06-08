---
id: task-4.5
title: "CLI: Parse unquoted created_date"
status: "To Do"
assignee: ""
reporter: "@MrLesk"
created_date: 2025-06-08
labels: ["cli", "command"]
milestone: "M1 - CLI"
dependencies: ["task-4.4"]
---

## Description

Support unquoted `created_date` values in task frontmatter. Accept multiple date formats:

- `created_date: 2025-06-08`
- `created_date: '2025-06-08'`
- `created_date: 08-06-25`
- `created_date: 08/06/25`
- `created_date: 08.06.25`

Allow configuration of the expected `date_format` in `.backlog/config.yml` with default `yyyy-mm-dd`.

## Acceptance Criteria

- [ ] Unquoted dates are parsed correctly when viewing tasks.
- [ ] `date_format` option is documented in `config.yml`.
