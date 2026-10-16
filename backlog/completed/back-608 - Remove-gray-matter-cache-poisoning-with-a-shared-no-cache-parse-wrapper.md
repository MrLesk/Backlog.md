---
id: BACK-608
title: Remove gray-matter cache poisoning with a shared no-cache parse wrapper
status: Done
assignee:
  - '@Claude'
created_date: '2026-08-08 15:56'
updated_date: '2026-08-08 16:22'
labels: []
dependencies: []
ordinal: 247000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
gray-matter caches parse results keyed by input string and hands back the same object, which poisoned parsing twice independently during the Aug 2026 review rounds (worked around locally via an options object in one place and Bun.YAML.parse in another). Introduce one shared frontmatter parse helper that disables the cache and migrate every gray-matter call site to it so the whole defect class is gone.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 A single shared frontmatter parse helper disables the gray-matter cache
- [x] #2 No direct gray-matter usage remains outside the shared helper
- [x] #3 A regression test demonstrates the former cache-poisoning scenario now parses correctly
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Verify the cache mechanism against installed gray-matter 4.0.3: matter(input) caches the file object by content and returns the same data object, so a mutating caller poisons later parses and a malformed file only throws on the first parse. Passing any options object skips both the cache read and the cache write (confirmed empirically: cache stays empty, second parse pristine, malformed input throws every time).
2. Add src/markdown/frontmatter.ts as the only module that imports gray-matter: parseFrontmatter(content) calls matter(content, {}) and returns { data, content }; stringifyFrontmatter(content, data) calls matter.stringify(content, data, {}) so serialization output is byte-identical (verified) while no call path writes to the cache anymore.
3. Migrate every gray-matter call site to the helper: src/markdown/parser.ts (parseMarkdown), src/file-system/operations.ts (parseConfigListValues, parseDefinitionOfDoneFromYaml), src/core/backlog.ts (updateDecisionFromContent dynamic import), src/markdown/serializer.ts (three matter.stringify calls). src/file-system/operations.ts parseAssigneeConfigValue keeps Bun.YAML.parse as-is.
4. Add a regression test in src/test/markdown.test.ts: parse a string with the helper, mutate the returned data and content, parse the identical string again and assert the second result is pristine; plus the same at parseMarkdown/parseTask level so the app-facing path is covered. Verify the test fails when the helper call is reverted to a bare matter() call, then restore.
5. Refresh the two stale test comments (src/test/content-identity.test.ts, src/test/cli-doctor.test.ts) that tell readers fixtures must have distinct bodies to dodge the parse cache.
6. Verify: bunx tsc --noEmit, bun run check ., bun run test (full suite).
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
## What changed

Added src/markdown/frontmatter.ts as the only module that imports gray-matter:
- parseFrontmatter(content) calls matter(content, {}) and returns { data, content }.
- stringifyFrontmatter(content, data) calls matter.stringify(content, data, {}).

Migrated every gray-matter call site to it: src/markdown/parser.ts (parseMarkdown), src/markdown/serializer.ts (serializeTask/serializeDecision/serializeDocument), src/file-system/operations.ts (parseConfigListValues, parseDefinitionOfDoneFromYaml), src/core/backlog.ts (updateDecisionFromContent, which used a dynamic import of gray-matter). parseAssigneeConfigValue keeps Bun.YAML.parse, which was a deliberate choice unrelated to the cache. Also dropped two stale test comments that told readers fixtures need distinct bodies to dodge the parse cache.

## Why

gray-matter 4.0.3 only reads and writes its module-level cache when the options argument is falsy (node_modules/gray-matter/index.js: 'only cache if there are no options passed'). Verified empirically against the installed version: matter(input) twice returns a shared data object, so mutating the first result changed the second (title became the mutated value) and a malformed document threw only on its first parse; matter(input, {}) left matter.cache empty, returned a pristine second parse, and threw on every malformed parse. A shared options object behaves the same as a fresh one, so passing {} per call is enough. Two independent Aug 2026 review rounds hit this defect and worked around it locally (an options object in parser.ts, Bun.YAML.parse in operations.ts); routing all sites through one wrapper removes the whole class instead of patching individual sites, and stops the serializer from writing cache entries that can never be safely read.

## Evidence

- New regression tests in src/test/markdown.test.ts ('frontmatter parse cache'): one mutates parseFrontmatter's returned data (overwrite, extra key, array push) plus content and asserts the next parse of the identical string is pristine; one mutates a parseMarkdown result and asserts parseTask on the same string still sees the real id/title/labels.
- Confirmed the tests catch the old behavior: temporarily changing the helper back to matter(content) failed both new tests (title 'mutated title', injected key, id '') plus the pre-existing malformed-frontmatter test, then restored the fix and they pass.
- Serializer output is unchanged: matter.stringify(body, data) and matter.stringify(body, {...data}, {}) produce byte-identical strings, and the serializer test suites pass.
- bunx tsc --noEmit clean; bun run check . clean (367 files); bun run test green (2062 pass, 6 skip, 0 fail, 2068 tests across 222 files).
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
All frontmatter parsing now goes through one wrapper, src/markdown/frontmatter.ts, which passes an options object to gray-matter so its result cache is never read or written; no direct gray-matter usage remains outside that module. Verified with new regression tests in src/test/markdown.test.ts that mutate a parse result and assert the next parse of identical content is pristine (they fail against the old bare matter() call), plus bunx tsc --noEmit, bun run check ., and a full bun run test run (2062 pass, 0 fail).
<!-- SECTION:FINAL_SUMMARY:END -->
