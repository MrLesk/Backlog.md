# Review round 16 - 2026-05-27

**Verdict:** APPROVE

## Findings

No blocking findings.

## Verification I performed

- Read the requested touched files in full: `src/utils/board-config-merge.ts`, `src/test/board-config-merge.test.ts`, `src/test/web-task-card-fields.test.tsx`, and `src/web/components/Settings.tsx`.
- Re-read `src/web/components/TaskCard.tsx` against the new render tests. The assertions are keyed to current production structure: milestone uses `title="Milestone: ..."`, the priority accent is on `div.border-l-4`, the priority badge labels are `High` / `Med` / `Low`, and the footer row is the `border-t` + `flex items-center justify-between` element.
- Grepped for residual inline board merge logic (`nextBoard`, `mergeBoardWith*`, reset/default call sites). I found no leftover `nextBoard` manipulation; both Settings sections now emit through `mergeBoardWithColumns` / `mergeBoardWithCard`.
- Checked the `BoardConfig` type. It currently contains only `columns` and `card`, so the merge helpers' whitelist behavior is consistent with the present contract.
- `bunx.cmd tsc --noEmit` passed.
- Ran the requested focused suite 5 times via `bun.cmd test ...`. Distribution: 5/5 passed, 0 failures. Each run reported `129 pass, 6 skip, 0 fail` and `Ran 135 tests across 13 files`. The prompt's `135 pass + 6 skipped` expectation appears to count skipped tests differently; Bun's total of 135 includes the 6 skipped tests.
- I did not perform the optional mutation/revert check because the review was explicitly read-only.

## Notes

- The new render coverage is materially better than round 15. It would catch the important regressions called out there: missing milestone guard, wrong hidden-field wiring for the configured slots, and accidental hiding of always-on title/branch/priority-border chrome.
- The footer-collapse assertion is still class-signature based rather than a semantic/test-id selector. A future unrelated `div.border-t.flex...justify-between` inside TaskCard could false-pass that one assertion, but there is no such competing element today and this is not worth blocking convergence.
- `mergeBoardWithCard(prev, { hide: [] })` preserves the explicit empty hide list by design/comment, while Settings normalizes the empty case to `undefined` before calling it. Since the helper documents that callers should normalize first, and the parser/save path already collapses `card.hide: []`, I do not consider this a current footgun.
- Settings reset button visibility still derives from rendered state (`rows` customization for columns, `hidden.size` for card fields), and the refactor does not change when those controls appear. `columns: []` hide-all remains preserved through card edits and through column emits.
- I saw the existing Windows shell warnings/skips in the status callback tests, but no Windows filesystem flake and nothing attributable to the new TaskCard tests.
