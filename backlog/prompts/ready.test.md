SMOKE TEST PROMPT — no real work.

This is a no-op stand-in for the human-review notifier. Do **not** read the task body, do **not** modify any files, do **not** add notes to the task. There is no further status transition (Human Review is the end of the automated loop).

Steps (exactly these):

1. Wait roughly 5 seconds before doing anything else. Use whatever blocking tool is convenient — `Bash sleep 5` on POSIX, `Bash` with `powershell -Command Start-Sleep 5` on Windows, or any single blocking MCP call.
2. Print a single line and exit: `ready-test-agent done: <TASK_ID> is in Human Review`.

That's it. No status change, no other tool calls, no extra output.

## Context appended below this prompt

```
Task: <TASK_ID> — <TASK_TITLE>
Status: <OLD_STATUS> -> Human Review
```
