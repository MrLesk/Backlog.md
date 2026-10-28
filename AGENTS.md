# Read This First

At the beginning of each conversation, read [MANIFESTO.md](MANIFESTO.md) in the
repository root before doing anything else. It is the project's constitution: who
Backlog.md serves, its core loop, source of truth, surface hierarchy, interface posture,
design principles, boundaries, and risks. All architecture and product decisions must
align with it.

If a request appears to conflict with the manifesto, or would materially change a
principle in it, surface the conflict and ask Alex rather than silently proceeding. Do
not edit the manifesto as a side effect of implementation; changes to it require an
explicit product decision.

## Repository facts

Read the relevant repository files before claiming how commands, scripts, configuration, dependencies, or paths work.
Use [package.json](package.json), [biome.json](biome.json), and the current workflows for implementation facts. Report stale
instructions when they disagree with those facts. Current code does not override approved requirements, public contracts,
or the manifesto.

## Working agreement and scope

- Treat the explicit request and accepted task as the scope. Background, examples, and future plans explain the work but
  do not authorize additions. Investigation, review, and design requests authorize analysis, not implementation.
- Distinguish verified facts, assumptions, recommendations, and Alex's decisions. If the requested solution does not fit
  the evidence or product, explain the problem and recommend a better approach.
- Identify the actor, entry point, and expected result before changing behavior. For fixes and internal refactors,
  restore or preserve supported behavior; no new product example is needed.
- Make routine implementation choices within approved scope. Ask when a missing decision would materially change the
  result or scope. Respect requested plan reviews and the manifesto's review points; do not ask again for approval
  already given. Pause only the affected work while waiting.
- Every addition, including tests and documentation, must serve the requested outcome, an acceptance criterion, a
  documented contract, an approved example, a named invariant, or a reproduced failure. Do not add support, fallback,
  recovery, hardening, compatibility machinery, or extension points beyond that scope; propose them separately.
- If you misread the request, stop affected work, explain what you assumed and changed, and resolve the interpretation.
- Lead updates with the outcome, blocker, or decision needed. Report verified results, unchecked work, and limitations
  plainly. Keep cleanup within the task.

## Design for a junior developer

Design and write for a junior developer who knows the language but is new to this project and has not seen the
conversation. From the code and project documentation, they should find where a change belongs, follow the flow from
entry point to result, and identify who owns each responsibility. Describe the final system and its reasons.

Build the smallest complete implementation that produces the requested result. Keep the concrete information and
behavior the supported flow needs. Prefer clear names, explicit contracts, one source of truth, and related behavior
kept together. Fit the existing visual and architectural design, and find the owning domain before adding files, layers,
or dependencies.

Reuse a shared implementation when concerns have the same meaning. Keep validation, defaults, parse-error handling,
locking, and mutation semantics consistent across similar stores and interfaces unless an approved distinction requires
otherwise. Do not force unrelated concerns into one helper. Keep APIs small, omit unused methods, and export helpers only
when the supported flow needs them.

Remove obsolete code, duplicated state, and indirection made unnecessary by the task. Make correct use clear from the
structure, without hidden conventions or coordination across unrelated files. Do not reduce line count at the expense of
readability or add abstractions for possible future needs.

## Product and public contracts

- Humans and agents use the same product model. Keep a complete human path and human-readable guidance.
- The shared product model and CLI define the canonical workflow. The TUI and browser use the same semantics; MCP is an
  optional adapter. A feature must not exist only through MCP or assume that users have an agent.
- Treat Backlog.md as a shipped CLI/MCP binary used from other repositories, where users and agents cannot inspect this
  source tree. Document conventions needed by external agents in CLI help or CLI instructions, and in MCP where applicable.
- Evaluate compatibility against documented CLI behavior, MCP tools/resources and schemas, configuration, help, and
  shipped instructions. Internal TypeScript exports are implementation details unless public docs explicitly promise
  them; their existence alone does not justify compatibility shims.
- Task state remains human-readable Markdown. Use product commands for semantic mutations, preserve supported data
  behavior, and follow the manifesto's identity, review, and recovery rules. Those existing requirements are in scope;
  do not treat them as speculative safeguards.

## UI descriptions

Do not add subtitles, helper text, or descriptive copy beneath headings, labels, cards, or settings by default. Prefer
one concise, self-explanatory heading or label. Only add supporting copy when explicitly requested or necessary to prevent
misunderstanding or error, and never use it to restate the heading.

## Commands and verification

| Command | Purpose |
| --- | --- |
| `bun install` | Install dependencies. |
| `bun run check:types` | Check TypeScript with Bun's built-in checker. |
| `bun run check` | Run Biome formatting, lint, and import checks without writing changes. |
| `bun run test` | Run the Bun test suite with the configured timeout. |
| `bun test --timeout=10000 <filename>` | Run a focused test file. |
| `bun run build` | Build the CLI. |
| `bun run cli` | Run the CLI from source. |
| `bun run cli config list` | List configuration values. |
| `bun run cli config get <key>` | Read a configuration value. |
| `bun run cli config set <key> <value>` | Change a configuration value with validation. |

Follow the task's Definition of Done: check types when TypeScript changes, run Biome when formatting or linting is
affected, and run the full or focused tests it requires. These are separate checks; `bun run check` does not run types or
tests. Repeat affected checks after fixes. Once checks pass, broaden or repeat them only for new changes, failures, or
unresolved concerns.

The [CI workflow](.github/workflows/ci.yml) also runs packaging, platform, and interactive TUI checks; reproduce relevant
checks locally when changing those areas. The [CI test runner](scripts/run-ci-tests.ts) separates parallel tests from the
serial DOM pass; preserve that distinction when changing test execution.

Follow [biome.json](biome.json) for formatting and lint rules: tabs and double quotes for supported source files, with
configured overrides. The pre-commit hook runs the `lint-staged` rules in [package.json](package.json), which can rewrite
matching staged files. Review the staged diff before committing and check the final commit diff for unexpected changes
before pushing.

For documentation and instruction edits, verify changed links and commands against the repository and run checks required
by the task's Definition of Done. Test shipped help or instruction output when it proves a supported contract; do not freeze
incidental wording or inventory documentation.

## Tests

Test domain rules, public contracts, and observable behavior. Before adding or extending a test, inspect existing coverage
and identify the supported rule, the concrete wrong result it would catch, and the smallest missing check. Prefer
extending relevant coverage over duplicating it across layers. Zero new tests is valid when existing checks prove the
requested result.

Use isolated fixtures and temporary directories, with cleanup, rather than the repository's live backlog. Avoid assertions
that merely repeat fixture data, private implementation details, or decorative wording. Exact values are appropriate when
a documented command or protocol requires them. For a bug fix, show the regression test failing before the fix and passing
after it when practical.

Investigate failures before rerunning. Do not weaken assertions, narrow scenarios, increase timeouts, or add retries just
to get a pass. If a test passes alone but fails in the suite, investigate isolation and shared state. Ask only when a
missing decision blocks the supported fix; continue evidence-based debugging within scope.

## Review and completion

The agent performs its own specification and quality reviews. Compare the result with the task's acceptance criteria,
Definition of Done, manifesto, and documented behavior. Trace the changed flow as a junior developer and ask:

- Can I find where a similar change belongs and follow the data and control flow?
- Do names and contracts explain ownership and correct use?
- What could I misunderstand or accidentally break?
- What code, state, or indirection can be removed without changing required behavior?

Apply reasonable review findings within approved scope without asking Alex, and rerun affected checks. Ask only when
applying a finding would change the approved scope. Prefer clearer structure over comments that explain hidden conventions.

For substantial domain or architecture changes, or when explicitly requested, obtain one cold simplicity review after
focused checks. Give that reviewer the task, diff, and repository without conversation history; ask it to explain the
flow and identify removable complexity. Apply in-scope findings, then perform the specification and quality reviews.
Finally, obtain one separate complexity review with the full conversation context. Small fixes, small behavior-preserving
refactors, and documentation changes use the agent's own review unless external review is explicitly requested.

Reviews must not invent requirements, support commitments, or speculative edge cases. A finding blocks completion only
when it identifies an unmet accepted requirement, Definition of Done item, manifesto rule, documented public contract, or
reproduced failure in the supported flow. Keep other improvements as optional follow-ups. Limit re-review to original
findings and regressions from their fixes; do not turn each round into a new general audit.

Stop when the requested result is verified, required reviews are complete, and no supported blocking finding remains.
Record evidence for the task's criteria and report what changed, how it was verified, and any remaining limitations.

## Maintainer workflow

- Treat GitHub issues as reports, proposals, or evidence, not implementation specs. Evaluate the requested solution
  against the manifesto, public contracts, and current documented behavior before implementing it.
- Ask Alex about ambiguous product behavior before implementation. PRs should normally link to a scoped issue first;
  a broad feature PR without one needs an issue or discussion before implementation.
- Every PR needs an associated Backlog task, including documentation PRs. Use the Backlog workflow below to search,
  create, assign, plan, and finalize tasks. Assign yourself when picking up work with `-a @your-name`.
- Use the CLI allocator and lock for task IDs; do not manually pick or reserve IDs.
- When acting publicly on Alex's behalf, use neutral maintainer language and identify yourself as `Alex's Agent:` when
  needed. Keep private strategy, roadmap, and status framing out of public issues and PR discussions.

## Git workflow

- Changes confined to `AGENTS.md` need no issue, Backlog task, feature branch, or PR. After review and verification, commit
  and push them directly to `main` with a descriptive commit subject. This is the exception to the task and PR workflow.
- For other work, use a feature branch for the task, such as `tasks/back-123-feature-name`. Inspect current changes before
  editing shared files. Preserve unrelated changes by Alex or other agents; never revert, reformat, or stage them.
- When a task is complete, commit and push its changes to its own branch and create or update its PR without asking for
  approval. Ask Alex before any other commit, push, or merge that places commits on `main`.
- For task work, use the exact task ID and title for both the commit subject and PR title: `BACK-123 - Title of the task`.
- Use `gh` for GitHub work when available.

### PR descriptions

Keep PR descriptions brief and include only what is not obvious from the code. Explain unclear reasons, tradeoffs,
limitations, or dependencies in a few short sentences. Link to detailed validation or documentation instead of copying it.

Do not repeat the diff, list changed files, or report routine passing checks and review steps. Omit template sections
that add no useful context. Keep required issue or task links; if no explanation is needed, those links can be the
whole description.

### Releases

1. Merge the reviewed changes after required CI checks pass and the required approval for the target branch is given.
2. Create and publish a GitHub Release from the merged commit with a new `vMAJOR.MINOR.PATCH` tag.
3. Monitor the Release workflow until platform packages, the npm launcher, and release assets are published. The workflow
   prepares the tagged source and bumps `package.json` automatically.

Do not manually bump the root `package.json` version or start a release with a raw tag push.

<!-- BACKLOG.MD GUIDELINES START -->
<CRITICAL_INSTRUCTION>

## Backlog.md Workflow

This project uses Backlog.md for task and project management.

**Run `backlog instructions overview` once per conversation, before the first action that touches tracked work.** A conversation touches tracked work when it names a task or is about to create, plan, update, or finalize a task. Answering a question, explaining code, debugging, reviewing a change, or committing needs no Backlog command; read the overview at the point such a conversation turns into tracked work.

Use the overview to decide whether to search, read, create, or update Backlog tasks.

Before task lifecycle actions, read the matching detailed guide:
- `backlog instructions task-creation` before creating or splitting tasks
- `backlog instructions task-execution` before planning, changing status or assignee, adding a plan or implementation notes, or implementing task work
- `backlog instructions task-finalization` before checking acceptance criteria, writing final summaries, or moving tasks to terminal statuses

Use `backlog <command> --help` before running unfamiliar commands. Help shows options, fields, and examples.

Do not edit Backlog task, draft, document, decision, or milestone markdown files directly. Use the `backlog` CLI so metadata, relationships, and history stay consistent.

</CRITICAL_INSTRUCTION>
<!-- BACKLOG.MD GUIDELINES END -->

<!-- groma:start -->
## Groma

This project uses Groma. Before you scan, inspect, or curate architecture, or change files for a Backlog task, run `groma agent-instructions` and read the guide it names for that job. When it reports a first scan, ask the user whether they want you to curate the architecture. Do not edit Groma-owned architecture files directly.
<!-- groma:end -->
