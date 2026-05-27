# Review round 15 — 2026-05-27

**Verdict:** CHANGES REQUESTED

## Findings

### important — Card visibility behavior has no render-level regression coverage
- **Location:** src/web/components/TaskCard.tsx:130
- **Issue:** The implementation's core user-facing behavior lives in JSX conditionals (`hiddenFields.has("id")`, `"priority"`, `"milestone"`, `"labels"`, `"createdDate"`, `"assignee"`), but the test suite only covers config parse/resolve helpers. A regression in the actual card slots would pass the current requested suite. For example, removing the milestone `hiddenFields.has("milestone")` guard, wiring `createdDate` to the wrong field name, or accidentally hiding the title/branch chrome would not be caught. This is too central to Task #5 to leave as manual review only.
- **Suggested fix:** Add a small render-level test using existing deps (`react-dom/server` is enough; no new testing library required). Cover at least: default render with no milestone emits no milestone wrapper; a task with a milestone renders it; `hiddenFields={new Set(["milestone"])}` suppresses it; each existing slot can be hidden independently; title/branch banner/priority border remain present when all configurable fields are hidden.

### nit — Settings card-field state transitions are still only manually verified
- **Location:** src/web/components/Settings.tsx:841
- **Issue:** The cross-section preservation logic appears correct by trace, but it is embedded inside React component closures and has no unit coverage. This is the exact kind of logic Task #4 already had trouble with: columns and card config are sibling fields, and either section can accidentally wipe the other.
- **Suggested fix:** Extract the tiny pure transition helpers behind `BoardColumnsSection.emit` / `CardFieldsSection.emit` and test: card toggle preserves `board.columns`; column edit preserves `board.card`; clearing both returns `undefined`; clearing only card preserves explicit `columns: []`.

## Verification I performed

- Read `context.md` Task #5 and the touched files requested: types, config parser/serializer, resolver, TaskCard/TaskColumn/Board/BoardPage/App plumbing, Settings, and the two test files.
- `bunx tsc --noEmit` was blocked by PowerShell execution policy for `bunx.ps1`; reran equivalent command as `bunx.cmd tsc --noEmit` and it passed.
- Ran the requested focused suite 5 times via `bun.cmd test ...` because `bun.ps1` is also blocked by execution policy. Distribution: 5/5 passed, 0 failures. Each clean run reported `106 pass, 6 skip, 0 fail` across `112` tests, not the prompt's `112 pass + 6 skipped`.
- I did not perform the optional source-revert mutation because the review was requested as read-only. By inspection, removing a TaskCard hide guard would not be caught by the current tests.

## Notes

- Slot order in `TaskCard.tsx` matches the approved map: header id/priority, title chrome, milestone, labels, footer date/assignee. Title, branch banner/tooltip, priority border, and drag visuals are not reachable through `hiddenFields`.
- Tasks without a milestone do not get an extra wrapper or spacing; the milestone `mt-2` exists only inside the conditional render.
- Header/footer collapse behavior traces correctly for the edge cases called out in the prompt, including placeholder spans when only the right slot is shown.
- Parser behavior is conservative: unknown/case-variant card fields are ignored, duplicates are deduped, and empty/null/no-op card config collapses to default. Serializer quoting is consistent with the board column serializer.
- I did not see a runtime flicker issue from the App fallback: initial loading uses the empty hidden set, and the real config update re-renders through normal React state.
