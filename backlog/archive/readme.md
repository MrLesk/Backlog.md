# Archive

Tasks that are no longer relevant.
They may have been completed, superseded, or deemed unnecessary.
They are kept here for reference or historical purposes.
They are not actively tracked or managed.

## ID Reuse

Archived tasks act as a **soft delete** for ID purposes. When you archive a task, its ID becomes available for reuse by new tasks. This behavior is by design:

- **Active tasks** (`backlog/tasks/`) - IDs are reserved
- **Completed tasks** (`backlog/completed/`) - IDs are reserved
- **Archived tasks** (`backlog/archive/tasks/`) - IDs can be reused

For example, if you archive TASK-1 through TASK-5, the next new task will be assigned TASK-1 (not TASK-6).

This allows you to clean up your ID space when tasks become obsolete without permanently consuming ID numbers.
