---
id: task-4.6
title: "CLI: Add empty assignee array field for new tasks"
status: "Done"
assignee: []
reporter: "@MrLesk"
created_date: 2025-06-08
updated_date: 2025-06-08
labels: ["cli", "command"]
milestone: "M1 - CLI"
dependencies: ["task-4.1"]
parent_task_id: task-4
---

## Description

Ensure every task created via the CLI includes an empty `assignee` array in its frontmatter. Investigate the current parsing and serialization logic which uses a single string value. If assignees are not handled as an array, update the code to support `string[]`.

## Acceptance Criteria

- [x] New tasks contain `assignee: []` by default.
- [x] Parsing and serialization read and write the assignee field as an array.
- [x] Documentation provides instructions to migrate existing logic if needed.
