## Task Finalization Guide

Use this guide when implementation is complete and you are ready to hand off the task.

### Finalization Workflow

1. Verify all acceptance criteria:
   - `backlog task view {{TASK_ID:123}} --plain`
   - `backlog task edit {{TASK_ID:123}} --check-ac 1`
2. Verify Definition of Done items:
   - `backlog task edit {{TASK_ID:123}} --check-dod 1`
3. Run relevant automated checks and note results.
4. Update implementation notes if important context changed:
   - `backlog task edit {{TASK_ID:123}} --append-notes "Validation passed: bun test ..."`
5. Write a concise final summary:
   - `backlog task edit {{TASK_ID:123}} --final-summary "Changed X, verified with Y."`
6. Mark the task Done:
   - `backlog task edit {{TASK_ID:123}} -s Done`

Tasks stay in Done until periodic cleanup moves them to completed. Do not archive completed work.

### Definition of Done Checklist

Confirm:

- The implementation plan exists and matches the final solution.
- Acceptance criteria are checked.
- Definition of Done items are checked.
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
