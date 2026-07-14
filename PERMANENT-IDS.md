# Permanent IDs

A task ID should mean one thing forever. In upstream Backlog.md it doesn't — and the way it
breaks is quiet, which is what makes it worth fixing.

## The problem

**Archiving frees an ID for reuse.** This is deliberate upstream, and it's even documented in
the source:

```ts
// src/core/backlog.ts
/**
 * Note: Archived tasks are intentionally excluded - archived IDs can be reused.
 * This makes archive act as a soft delete for ID purposes.
 */
```

The allocator hands out `max(existing IDs) + 1`, scanning `tasks/` and `completed/` but not
`archive/`. So archiving the highest-numbered task returns its number to the pool, and the next
`task create` hands the same ID to a different piece of work.

Nothing warns you. On the board that produced this patch, `task-29` had been issued to **three**
different tasks — two sitting in `archive/`, one live — because each was archived while it held the
top ID. Seven IDs were duplicated in total. Every `Refs: task-29` in that repo's git history is now
ambiguous, and `backlog task 29` resolves to whichever file the glob happens to hit.

**Drafts are a second, independent ID space.** A draft is born `draft-7` from its own counter, and
promoting it *mints a brand-new task ID* — `draft-7` becomes `task-42`. The number you referenced
while the idea was still a draft doesn't survive contact with the board, so a draft can never be
cited durably. Worse, the draft counter can't see the task counter, so the two drift independently.

## What this fork changes

An ID is issued **at most once for the life of a project**.

| | upstream | this fork |
|---|---|---|
| A draft's ID | `draft-7`, from a separate counter | `task-7`, from the task pool |
| Promoting a draft | renumbers it (`draft-7` → `task-42`) | keeps it (`task-7` stays `task-7`) |
| Demoting a task | renumbers it | keeps it |
| Archiving a task | frees the ID for reuse | ID stays reserved, forever |
| Archiving a draft | frees the ID for reuse | ID stays reserved, forever |

Concretely: the ID pool is the union of active, completed, **archived** and **draft** IDs, and
promotion/demotion move a file between folders without touching its ID.

## What this fork does *not* change

This is the important half, because these are the behaviours people rely on:

- **Drafts stay off the kanban board.** They still live in `backlog/drafts/` and still appear in
  their own Drafts section, exactly as before. Only their *number* changes.
- **Archiving still hides an item.** `archive/` works as it always did; it just no longer recycles
  the number.
- **"Mark as completed" is untouched.** Items still move to `completed/`, still leave the board,
  and their IDs were already counted.
- **Custom task prefixes still work.** A project with `task_prefix: "JIRA"` gets `JIRA-N` drafts out
  of the `JIRA-N` pool. Drafts follow the configured task prefix, since drafts and tasks must share
  one prefix or the pool silently splits in two.

## Migrating an existing board

Two things need doing once:

1. **Rename draft files.** `backlog/drafts/draft-N - Title.md` becomes `task-M - Title.md`, where
   `M` is a fresh ID above your current maximum, and the `id:` frontmatter changes to match
   (`DRAFT-N` → `TASK-M`). A draft cannot keep its old number, because that number probably belongs
   to a task already.
2. **Resolve any duplicate IDs you already have.** Look for the same `task-N` in more than one of
   `tasks/`, `completed/`, `archive/tasks/`. Upstream ships `backlog doctor --fix` for duplicates,
   but note it only scans `tasks/` and `completed/` — it will *not* see an archive-induced duplicate,
   which is the kind this bug creates. Those you must resolve by hand.

After migration, no further action is needed: the invariant holds by construction, because nothing
that removes an item from the board also removes its ID from the pool.

## Tests

`src/test/permanent-ids.test.ts` locks the invariants: drafts allocate from the task pool, promotion
and demotion preserve the ID, archived tasks *and* archived drafts stay reserved, an unpromoted draft
occupies its number, and drafts follow a custom task prefix.

One of those tests earns its place. An early version of this patch wrote draft files as
`draft-task-2 - Title.md` — the `draft-` prefix was being prepended to an ID that already said
`task-2`. It typechecked, and every unit test passed; `listDrafts()` simply returned nothing and the
Drafts section went quiet. Only a **round trip** catches that class of bug, so
`stores a draft as task-N and loads it back by that ID` asserts the filename on disk, then the list,
then the load, then the promote.

## Known gap (pre-existing, not introduced here)

`Core.demoteTask()` moves a task into `drafts/` without rewriting its `status`, so a demoted item can
sit in the drafts folder still marked `To Do`. That behaviour predates this patch and is left alone —
it's a status bug, not an ID bug, and it deserves its own fix.
