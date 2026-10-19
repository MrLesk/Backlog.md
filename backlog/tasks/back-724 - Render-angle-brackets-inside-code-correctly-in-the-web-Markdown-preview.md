---
id: BACK-724
title: Render angle brackets inside code correctly in the web Markdown preview
status: Done
assignee:
  - '@claude'
created_date: '2026-10-11 10:43'
updated_date: '2026-10-11 11:20'
labels:
  - bug
dependencies: []
references:
  - 'https://github.com/MrLesk/Backlog.md/issues/1062'
  - src/web/components/MermaidMarkdown.tsx
  - src/test/mermaid-markdown.test.tsx
modified_files:
  - src/web/components/MermaidMarkdown.tsx
  - src/test/mermaid-markdown.test.tsx
  - src/web/utils/mermaid.ts
  - src/test/mermaid.test.ts
type: bug
ordinal: 342000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
In the browser, a `<` followed by a letter inside an inline code span or a fenced code block is displayed as the literal text `&lt;`, so `<repo>` written in code shows up as `&lt;repo>`. Placeholders and command metavariables such as `<id>` or `<path>` are normally written in code, so usage and reference text in task descriptions and documents is affected, while the same text in prose displays correctly. Reported on 1.51.0 and confirmed on 1.53.0 in a web task description (issue #1062).

The follow-up comment on the issue that confirms the bug on 1.53.0 has the reproduction with a table of affected and unaffected inputs, and notes that writing the entity or a backslash escape in the source does not help. It traces the cause to a step that rewrites `<` in the raw Markdown before rendering, code included. Treat that as a lead to verify, not as the required fix.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 In the web Markdown preview, `<` and `>` inside an inline code span display as the literal characters, so a code span containing `<repo>` displays `<repo>`.
- [x] #2 `<` and `>` inside a fenced code block display as the literal characters.
- [x] #3 Angle brackets in prose, such as `<repo>` or `a < b and c > d`, display as they do today.
- [x] #4 Autolinks such as `<https://example.com>` and `<user@example.com>` still render as links.
- [x] #5 HTML sanitizing keeps working as today: raw HTML in the Markdown source that is sanitized today is still sanitized.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Root cause (verified): `sanitizeMarkdownSource` in `src/web/components/MermaidMarkdown.tsx` rewrites every `<` followed by a letter to `&lt;` in the raw Markdown string before parsing. It was added in BACK-377 because the preview library always runs rehype-raw, which turns raw HTML into real elements (the `Result<List<MenuItem>>` crash), and it is also the only thing that keeps raw HTML in Markdown inert. The rewrite is blind to Markdown structure: prose decodes the entity back to `<`, code does not, so code shows `&lt;`.
2. Fix once in the shared preview (`MermaidMarkdown`, used by task details, documents and decisions): delete the string rewrite and its two autolink regexes, and instead switch HTML syntax off in the Markdown parser with one small remark plugin (micromark `disable: htmlFlow, htmlText`). The real parser then decides what is code, an autolink or text; no raw HTML node is produced, so nothing reaches rehype-raw and every `<` is rendered as text by React.
3. Rejected: skipping code with a regex (hand-rolled tokenizer), decoding `&lt;` again inside code nodes (second escaping path), and escaping parser-identified HTML nodes (HTML blocks would swallow Markdown on lines that start with a tag such as `<title>`).
4. Tests in `src/test/mermaid-markdown.test.tsx`, asserted on the rendered DOM: inline code, fenced code (plain and highlighted), prose, autolinks, and unsafe HTML (script, event handler, iframe, HTML block) staying inert text.
5. Verify with the scoped test file, `bunx tsc --noEmit`, `bun run check .`, and a real browser run of the web UI before and after.
6. Behavior differences to report for review: closing tags, HTML comments and declarations in prose now display as written instead of being silently dropped; backslash-escaped `\<` now renders as `<`.

7. Added during implementation: the old rewrite also kept tag starts away from Mermaid, which renders HTML in diagram labels. Keep diagrams and their protection unchanged by escaping `<`+letter in `renderMermaidIn` (`src/web/utils/mermaid.ts`) right before the text is handed to Mermaid, with a test in `src/test/mermaid.test.ts`.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Root cause: `sanitizeMarkdownSource` in `src/web/components/MermaidMarkdown.tsx` (added in BACK-377) rewrote every `<` followed by a letter to `&lt;` in the raw Markdown string before parsing. Prose decodes the entity back to `<`; inline code, fenced code and indented code never decode entities, so they showed `&lt;`. The rewrite existed because the preview library always runs rehype-raw, which turns HTML the parser reports into real elements: that caused the `Result<List<MenuItem>>` crash and would otherwise let HTML in Markdown files render.

Change: the string rewrite and its two autolink regexes are gone. `treatHtmlAsText`, a small remark plugin in the same file, switches HTML syntax off in the Markdown parser (micromark `disable` for `htmlFlow` and `htmlText`). The real parser now decides what is code, an autolink or text, no HTML node is ever produced, and React renders every `<` as text. This is the single place that keeps HTML in Markdown inert; the fix is in the shared preview, so task details, documents and decisions all get it.

Mermaid: fenced `mermaid` blocks are drawn by Mermaid from the code text, and Mermaid renders HTML found in labels (sanitized by its strict mode). Before this change the rewrite also stopped tag starts from reaching Mermaid. To keep diagrams and their protection exactly as before, `renderMermaidIn` in `src/web/utils/mermaid.ts` now hands Mermaid the diagram text with `<`+letter as `&lt;`. Checked in a browser against 1.53.0: labels are identical before and after. Known limit carried over from before, now documented in the code: Mermaid syntax with a letter right after `<` (`<<interface>>`, `<<choice>>`, `<br/>`) does not reach Mermaid intact. Handing Mermaid the text as written would fix that but makes Mermaid render sanitized HTML (img, links, forms) in labels and hides `<id>`-style placeholders there; that needs a product decision and is not part of this task.

Visible differences from 1.53.0 outside code, for review: closing tags (`</repo>`), HTML comments (`<!-- note -->`), declarations and processing instructions in prose now display as written; before they were silently dropped from the page. A backslash-escaped `\<` in prose now displays `<` instead of `&lt;`. Opening tags, comparisons and autolinks display as before.

Verification: new DOM-level tests in `src/test/mermaid-markdown.test.tsx` (inline code, fenced code plain and highlighted, prose, autolinks, unsafe HTML) and one in `src/test/mermaid.test.ts`. The code tests fail on the old component; the unsafe-HTML and BACK-377 crash tests fail when the plugin is removed. Scoped tests, `bunx tsc --noEmit` and `bun run check .` pass. Also compared 1.53.0 with this branch in a real browser (document view and task details, dev server and minified production build) using a fixture with script, event-handler, javascript: link, iframe and Mermaid probes: code shows literal brackets, no unsafe element or handler attribute exists, no probe ran.

Backlog structural markers (`<!-- SECTION:... -->`, `<!-- AC:BEGIN -->`) are not affected by comments now showing: the web views pass only the extracted task fields and the document or decision body to the preview. Checked against the API payloads of a task that has a description, plan, notes, final summary and a comment: the file holds the markers, the fields shown in the preview hold none.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Angle brackets inside inline code and code blocks in the web Markdown preview now display as written: `<repo>` in code shows `<repo>` instead of `&lt;repo>` (issue #1062).

The cause was a rewrite of the raw Markdown string that turned every `<` followed by a letter into `&lt;` before parsing, added in BACK-377 to stop tag-like text from being rendered as HTML. Prose decodes that entity, code does not. The rewrite is removed. `treatHtmlAsText`, a small remark plugin in `src/web/components/MermaidMarkdown.tsx`, switches HTML syntax off in the Markdown parser instead, so the parser decides what is code, an autolink or text, and tag-like text is always text. The fix is in the shared preview, so task details, documents and decisions all get it.

Security: with HTML syntax off the parser never reports HTML, so nothing in a Markdown file reaches the preview library as HTML and React renders it as text. The test "shows HTML in Markdown as inert text instead of rendering it" fails if the plugin is removed. Mermaid diagrams keep the escaping they had in 1.53.0, now applied in `renderMermaidIn` right before the text is handed to Mermaid.

Behavior changes: HTML comments, closing tags, declarations and processing instructions written in prose now display as written where 1.53.0 dropped them silently, and a backslash-escaped `\<` shows `<`. Mermaid is unchanged, including its existing limits (`<<interface>>` class diagrams fail, `<br/>` shows literally).

Verification: `bun test --timeout=10000 src/test/mermaid-markdown.test.tsx` (21 pass), `bun test --timeout=10000 src/test/mermaid.test.ts` (4 pass), `bunx tsc --noEmit` and `bun run check .` clean. Compared 1.53.0 with this branch in a browser on the same project (document view and task details, dev server and minified build): code shows literal brackets, prose and autolinks are unchanged, no unsafe element or event-handler attribute is created.
<!-- SECTION:FINAL_SUMMARY:END -->
