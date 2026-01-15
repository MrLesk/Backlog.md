---
name: context-hunter
description: Discover codebase patterns, conventions, and unwritten rules before making changes. Use when implementing features, fixing bugs, or refactoring code.
---

# Context Hunter

Before writing code, investigate how similar problems are already solved in this codebase.

## Before Implementation

### Discover Existing Patterns

1. **Find analogous features**: Search for code that solves similar problems. Study it before proposing your approach.
2. **Trace data flow**: How does similar data move through the system? Note caching, validation, and error handling patterns.
3. **Identify utilities**: Search for existing helpers before creating new ones.

### Detect Unwritten Conventions

Look for implicit rules encoded in the codebase:

- **Schema patterns**: `deleted_at` columns indicate soft-deletion. Audit columns indicate tracking requirements.
- **Naming patterns**: Note consistency in `user_id` vs `userId` vs `userID`.
- **Test patterns**: What's tested thoroughly reveals team priorities.

### Verify Assumptions

- Run the test suite to understand current state
- Check linter and formatter configs
- Read recent commits in affected areas
- Examine database schemas for constraints

## During Implementation

### Match Existing Code

Your changes should be indistinguishable from existing code:

- Use the same patterns, abstractions, and utilities
- Follow the same error handling approach
- Respect module boundaries
- Match naming conventions exactly

### Surface Concerns

When you discover conflicts between requirements and existing patterns:

- Ask clarifying questions before proceeding
- Flag risks you've identified
- Offer alternatives that align with codebase conventions

## Checklist

Before proposing changes, confirm:

- [ ] Studied analogous features in the codebase
- [ ] Checked for reusable utilities
- [ ] Reviewed test patterns for similar functionality
- [ ] Noted naming and schema conventions
- [ ] Verified approach matches existing patterns
