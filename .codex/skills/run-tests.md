---
description: Run bun test with --only-failures and return only failures + summary. Isolates test output from main context.
context: fork
model: haiku
---

Run this command in the project root:

```bash
bun test --only-failures 2>&1
```

Return the complete output verbatim. It is already minimal:
- If all pass: ~3-line summary only (e.g. "2000 pass, 0 fail, Ran 2000 tests across 150 files [Xs]")
- If failures: only failing test blocks + summary

Do not add commentary, do not truncate, do not summarize. Return the raw output exactly as produced.
