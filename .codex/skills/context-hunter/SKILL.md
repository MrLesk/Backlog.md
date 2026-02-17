---
name: context-hunter
description: MUST run before any code implementation task. Classifies complexity, discovers local conventions, finds reusable patterns, and prevents blind coding. Invoke this skill before writing or modifying code.
---

# Context Hunter

Before writing code, run a focused discovery loop.
Do not load everything. Find the right files.

## Complexity Gate

Classify task complexity first:

- `L0 (trivial)`: typos, renames, copy-only edits, obvious single-line fixes with no behavior change.
- `L1 (moderate)`: behavior changes in one bounded area.
- `L2 (high-risk)`: cross-module changes, data semantics, refactors, architecture-impacting work.

Output by level:
- `L0`: no context brief, proceed directly.
- `L1`: write a micro-brief.
- `L2`: write a full context brief.

Re-evaluate level during discovery and implementation.
If new evidence shows higher complexity than initially classified, upgrade the level and apply the stricter workflow.

## Core Behavior

Act like a senior engineer who asks the next useful question:
1. **Assess completeness**: Check whether the request omits expected concerns seen in analogous code.
2. **Discover selectively**: Read the minimum set of relevant files.
3. **Validate assumptions**: Confirm with tests/config/history.
4. **Synthesize**: Capture findings before coding for `L1/L2`.

## Discovery Workflow (Before Coding)

### 1) Assess Request Completeness

Ask: "What is likely missing?"

Examples:
- Similar endpoints include auth/validation. Is that expected here?
- This area uses soft-delete semantics. Should this operation follow that?
- Similar flows emit telemetry/error states. Should this change do the same?
- Existing module boundaries suggest a different placement. Is current request still correct?

### 2) Run Targeted Discovery

Prioritize these in order:
1. Find analogous implementations and copy their structure.
2. Trace data flow for similar features end-to-end.
3. Identify reusable utilities before creating new helpers.
4. Inspect nearby tests to infer team priorities and edge cases.
5. Read recent commits in the same area for current direction.

Portable discovery actions:
- Search for feature/domain terms in relevant directories.
- Enumerate nearby files in the affected area.
- Inspect recent change history for touched paths.
- Run targeted validation first, then broader project checks as needed.

### 3) Probe for Silent Knowledge

Look for implicit rules encoded in code:
- Soft-delete, audit, or historical retention patterns (for data-touching changes).
- Naming conventions (`userId` vs `user_id`) and file placement norms.
- Existing design system choices (for this repo: Nuxt + Vue + Tailwind 4.1 patterns).
- “Dead but dangerous” APIs/functions that exist but are no longer preferred.

### 4) Confidence-Based Stop Rule

Stop discovery when confidence is high enough to predict likely review feedback.
If you cannot anticipate reviewer concerns yet, keep looking.

### 5) Produce Scaled Discovery Output

For `L1`, write a micro-brief:
- Closest analog and chosen pattern.
- Main risk or ambiguity.

For `L2`, write a full context brief:
- Analogous files reviewed (with paths).
- Patterns to follow (state/data/error handling/naming).
- Reusable utilities/components/composables identified.
- Risks and unknowns.

For `L1/L2`, keep an internal discovery log:
- Files checked.
- Patterns inferred.
- Decisions made from evidence.
- Naming evidence for new identifiers (`new name -> analog paths -> extracted pattern`).

## Clarification Policy

- Prefer fewer questions.
- Ask only when the answer would change implementation approach.
- If convention is clear, proceed silently.
- Escalate only genuine ambiguity/conflict or product-level tradeoffs.

## During Implementation

Changes should look native to the codebase:
- Reuse existing abstractions first.
- Match existing module boundaries and naming.
- Follow established error-handling and testing style.
- Prefer consistency over novelty.

Naming derivation rule:
- Do not invent names from general priors.
- For each new identifier family (file/function/variable/class/route), derive naming from closest local analogs.
- Use at least 2 analogous examples when available before finalizing a new naming pattern.
- If no analog exists, introduce the new term explicitly and record it as a no-analog exception.

If requirements conflict with discovered conventions:
- Flag the conflict explicitly.
- Propose 1-2 alternatives aligned with existing patterns.
- Ask for decision when tradeoffs are product/architecture-level.

## Verification

After coding:
- Run targeted validation for changed area first.
- Run broader checks appropriate for risk (`typecheck`, lint/check, tests as needed).
- Confirm no new pattern drift was introduced.

## Checklist

`L0`:
- [ ] Confirmed change is truly trivial and safe to execute without full discovery.

`L1/L2`:
- [ ] Classified complexity (`L0/L1/L2`) before discovery
- [ ] Studied analogous features in the codebase
- [ ] Checked for reusable utilities
- [ ] Reviewed test patterns for similar functionality
- [ ] Assessed request completeness before implementation
- [ ] Identified at least one silent convention/risk
- [ ] Produced the required artifact for the chosen level
- [ ] Kept an internal discovery log for `L1/L2`
- [ ] All new names were derived from codebase analogs, or marked as intentional no-analog exceptions
- [ ] Verified final approach matches existing patterns
