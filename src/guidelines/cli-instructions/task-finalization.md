## Task Finalization Guide

Use this guide when implementation is complete and you are ready to hand off the task.

### Finalization Workflow

1. Review the task and identify the evidence needed for each acceptance criterion:
   - `backlog task view {{TASK_ID:123}} --plain`
2. Run objective verification before checking acceptance criteria. Use automated tests, command output, scripted UI checks, or explicit manual verification of the behavior. For UI or interactive work, exercise the behavior through a browser, DOM script, test runner, or documented manual interaction result. Do not check acceptance criteria from code presence, grep output, or implementation intent alone.
3. Check only the acceptance criteria that the verification evidence proves:
   - `backlog task edit {{TASK_ID:123}} --check-ac 1`
4. Verify Definition of Done items:
   - `backlog task edit {{TASK_ID:123}} --check-dod 1`
5. Run relevant automated checks and note results.
6. Update implementation notes if important context changed:
   - `backlog task edit {{TASK_ID:123}} --append-notes "Validation passed: bun test ..."`
7. Write a concise final summary that names the verification evidence:
   - `backlog task edit {{TASK_ID:123}} --final-summary "Changed X, verified with Y."`
8. Mark the task with the configured terminal status:
   - Inspect accepted statuses if needed: `backlog task edit {{TASK_ID:123}} --help`
   - `backlog task edit {{TASK_ID:123}} -s "<terminal status>"`

Tasks in the terminal status stay there until periodic cleanup moves them to completed. Do not archive completed work.

### Definition of Done Checklist

Confirm:

- The implementation plan exists and matches the final solution.
- Acceptance criteria are checked only after objective verification evidence proves the behavior.
- Definition of Done items are checked.
- The task uses the configured terminal status.
- Relevant tests or checks pass.
- Documentation/configuration updates are complete when required.
- Implementation notes contain useful decisions or validation results.
- Final summary explains what changed, why, and how it was verified.

### Comments, Notes, and Final Summary

- Comments are for discussion and review questions.
- Implementation Notes are for progress, decisions, blockers, and validation details.
- Final Summary is the concise completion summary.

Commands:

```bash
backlog task edit {{TASK_ID:123}} --comment "Ready for review" --comment-author @your-name
backlog task edit {{TASK_ID:123}} --append-notes "Chose approach A because ..."
backlog task edit {{TASK_ID:123}} --final-summary "Implemented ..., verified with ..."
```

### Follow-up Work

Do not create or start follow-up tasks without user approval. If follow-up work is needed, describe it and ask the user how to proceed.
