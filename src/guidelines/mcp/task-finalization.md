## Task Finalization Guide

Use this guide when implementation is complete and ready for review.

1. Read the task with `task_view`. Identify evidence for every acceptance criterion and Definition of Done item.
2. Run relevant tests and checks. For UI or interactive work, exercise the behavior through a browser, DOM script, test runner, or documented manual interaction. Code presence, grep output, and implementation intent are not verification evidence.
3. Check only proven items with `task_edit` (`acceptanceCriteriaCheck`, `definitionOfDoneCheck/Uncheck`). Resolve failures before finishing.
4. Confirm the recorded plan matches the final solution (`planSet/planAppend`) and required documentation/configuration updates are complete. Keep useful decisions and validation results in implementation notes (`notesAppend`); use comments for review questions (`commentsAppend`).
5. Write a concise `finalSummary` explaining what changed, why, verification results, and relevant risks or follow-ups. Complete any required user review before marking work finished.
6. Mark verified work Done, or the configured final status, with `task_edit`.

### Task Lifecycle

Leave finished tasks on the board until periodic cleanup. `task_complete` moves them to completed storage while preserving their record and dependency links.

Use `task_archive` only for canceled, duplicate, or invalid work. Archiving removes incoming dependencies and task references.

### Follow-up Work

Do not create or start follow-up tasks without user approval. For subtasks, verify each separately and finish the parent only when all are complete, unless instructed otherwise. Continue to the next subtask only when the user already assigned the full series; otherwise ask first.
