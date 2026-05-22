SMOKE TEST PROMPT — no real work.

This is a no-op stand-in for the reviewer agent. Do **not** read the task body, do **not** run `git diff`, do **not** modify any files, do **not** add review findings to the task.

Steps (exactly these):

1. Wait roughly 5 seconds before doing anything else. Use whatever blocking tool is convenient — `Bash sleep 5` on POSIX, `Bash` with `powershell -Command Start-Sleep 5` on Windows, or any single blocking MCP call.
2. Use the Backlog.md MCP `task_edit` tool to set the status of the task whose ID is appended below to `Human Review`.
3. Print a single line and exit: `review-test-agent done: <TASK_ID> -> Human Review`.

That's it. No other tool calls, no extra output.

## Context appended below this prompt

```
Task: <TASK_ID> — <TASK_TITLE>
Status: <OLD_STATUS> -> In Review
```
