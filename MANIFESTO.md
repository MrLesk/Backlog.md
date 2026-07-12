# The Backlog.md Manifesto

Backlog.md is a Markdown-native task manager for humans and AI agents. It makes work
explicit before, during, and after execution by keeping scope, plans, acceptance
criteria, notes, and outcomes in durable plain-text files.

The central idea is simple: work is easier to steer when its intent is readable before
implementation, its progress is visible while it happens, and its outcome remains in
the repository afterwards. Agents can accelerate the loop, but human understanding and
judgment remain the point of the system.

## The First Users

**Humans and agents are both first-class users.** Backlog.md must remain useful without
an AI agent, and agent workflows must operate on the same task model that humans can
inspect and control.

Consequences:

- A person can create, inspect, update, organize, diagnose, and repair work without an agent.
- Product copy and recovery guidance must make sense to humans; it must not assume an agent is present.
- Automation is optional. It may reduce toil, but it must not become a prerequisite for using the product safely.
- Agent integrations expose existing product capabilities; they do not define the product by themselves.
- Humans must be able to review what an agent intends to do before consequential work begins.

## The Core Loop

```text
capture intent -> review scope -> plan -> review -> execute -> verify -> preserve the record
```

- **Capture intent:** describe a bounded piece of work with enough context to understand why it matters.
- **Review scope:** refine descriptions and acceptance criteria before implementation makes misunderstandings expensive.
- **Plan:** research the current system and record the intended approach close to execution time.
- **Review the plan:** let a human steer architecture, behavior, and tradeoffs before code changes.
- **Execute:** complete one understandable unit of work at a time.
- **Verify:** test the actual behavior and compare it with the accepted scope.
- **Preserve the record:** keep the completed task with its reasoning and outcome as durable project history.

Humans may perform every step themselves. Agents are collaborators in the loop, not a
separate mode with a different source of truth.

## The Source of Truth

Task state lives in human-readable Markdown. The files must remain understandable with
ordinary tools and useful without a hosted service.

- Markdown is the durable substrate.
- Product commands perform semantic mutations so metadata and relationships stay consistent.
- Git is optional, but when present it provides reviewable evidence and history.
- Ordering and serialization should be deterministic so diffs explain meaningful changes.
- No account, hosted backend, or telemetry is required for the core workflow.
- Internal source-code APIs are implementation details, not a supported integration surface.

## Surface Hierarchy

The product has several interfaces, but they must express one coherent model.

1. **The CLI is canonical.** It defines the complete, scriptable workflow for humans and agents.
2. **CLI instructions are the canonical agent workflow.** They are the default way to teach an agent how to use Backlog.md.
3. **The TUI and browser are human-facing views over the same semantics.** They should make common work clear and pleasant without inventing incompatible behavior.
4. **MCP is a legacy, optional adapter.** It may remain useful for clients that prefer it, but features must not be designed MCP-first or exist only through MCP.

New capabilities begin in the shared product model and canonical CLI workflow. Other
surfaces adopt them deliberately. A convenience surface must not silently weaken
validation, safety, or meaning.

## Interface Posture

The browser is **desktop-first with best-effort mobile behavior**. It is not desktop-only.

- Desktop is the primary design and release-review environment.
- Preserve responsive and narrow-screen behavior and avoid regressions.
- Do not intentionally remove or degrade mobile behavior.
- Full desktop/mobile feature and visual parity is not a default commitment.
- Mobile-specific polish should not displace the core desktop workflow without a deliberate product decision.

The TUI and browser should be more than technically functional. Important information
must be legible, controls must fit their context, keyboard and focus behavior must be
sound, and dangerous actions must be understandable before they run.

## Design Principles

1. **Human-readable first.** A task, diagnostic, or repair report should explain itself to a person without requiring source-code knowledge or an AI prompt.
2. **One model for humans and agents.** Do not create agent-only meanings, hidden conventions, or recovery paths.
3. **Local-first ownership.** Users own their files and can work without a service or account.
4. **Review before consequence.** Specifications, plans, destructive actions, and automated repairs need an understandable review point proportional to their risk.
5. **Fail closed when identity is ambiguous.** Never guess which task a read or mutation should target.
6. **Deterministic and reversible where possible.** Prefer preview, explicit confirmation, atomic writes, and useful recovery evidence.
7. **Stable, human-friendly identity.** Task IDs remain readable and incrementally numeric; collision prevention must not replace them with opaque random identifiers.
8. **Surface consistency.** Validation, defaults, filtering, and mutation semantics should agree across interfaces unless there is a deliberate reason to differ.
9. **Small reviewable units.** Work should be scoped so a human can understand the intent, implementation, and diff.
10. **Simplicity earns trust.** Prefer one shared implementation and a small public surface over layers, aliases, or compatibility machinery without a proven need.

## Boundaries

Backlog.md is not:

- an agent-only orchestration system;
- a hosted project-management service that owns user data;
- a JavaScript or TypeScript library API for external consumers;
- an MCP-first product;
- a mobile-first web application;
- a substitute for human product and engineering judgment.

These boundaries do not prohibit useful integrations or incidental capabilities. They
keep the center of gravity clear.

## Risks, Named Honestly

1. **Agent tunnel vision.** Optimizing only for automated workflows can make ordinary human use confusing or impossible. Mitigation: require a complete human path and human-readable copy.
2. **Surface drift.** CLI, TUI, browser, and adapters can acquire different meanings. Mitigation: one shared model, canonical CLI semantics, and cross-surface verification.
3. **Plain-text corruption.** Friendly files are still structured state. Mitigation: semantic commands, validation, atomic writes, ambiguity checks, and deterministic serialization.
4. **Automation outrunning review.** Agents can create more work and code than a human can responsibly inspect. Mitigation: small units and explicit review checkpoints.
5. **Complexity creep.** Every workflow can justify another layer or public API. Mitigation: simplicity-first design and a clear product boundary.
6. **Interface neglect.** A correct feature can still be unusable. Mitigation: rendered and interactive UX review, not tests alone.

## The Questions That Guide Product Changes

- Is the workflow understandable and usable without an agent?
- Is the behavior complete in the canonical CLI and shared model before adapters?
- Does it preserve local ownership, readable state, and reviewable evidence?
- Does it fail safely when identity or intent is ambiguous?
- Do the human interfaces communicate the feature clearly in their primary environments?
- Is the added complexity justified by an immediate user need?

If a proposed change conflicts with this manifesto, surface the conflict and ask for a
product decision. Do not silently reinterpret the manifesto or change product direction
as an implementation detail.
