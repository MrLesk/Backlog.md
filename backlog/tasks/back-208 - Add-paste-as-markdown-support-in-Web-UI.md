---
id: BACK-208
title: Add paste-as-markdown support in Web UI
status: Done
assignee:
  - '@kimi'
created_date: '2025-07-26'
labels:
  - web-ui
  - enhancement
  - markdown
dependencies: []
priority: medium
---

## Description

Implement automatic conversion of rich text content to markdown when pasting into task and document editors, allowing users to seamlessly paste content from Word, Google Docs, web pages, and other sources while maintaining proper markdown formatting.

**Phase 1 (Done):** Text, tables, lists, bold/italic/underline, links.
**Phase 2 (Done):** Images — extract and save to `backlog/assets`, generate `![alt](/assets/...)` links.

## Acceptance Criteria

- [x] #1 Rich text content pasted into task edit fields is automatically converted to markdown
- [x] #2 Rich text content pasted into document edit pages is automatically converted to markdown
- [x] #3 Code blocks maintain proper formatting and syntax highlighting indicators
- [x] #4 Lists (ordered and unordered) are correctly converted to markdown syntax
- [x] #5 Links and formatting (bold, italic) are preserved in markdown format
- [x] #6 Tables are converted to markdown table syntax
- [x] #7 Smart paste detection only converts when rich text is detected (plain text pastes normally)
- [x] #8 Conversion works across major browsers (Chrome, Firefox, Safari, Edge)
- [x] #9 Users can still paste plain text without conversion when needed
- [x] #10 All existing paste functionality remains intact for non-rich text content

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->

### Phase 1 — Text, Tables, Lists, Formatting

**Architecture**
- `PasteAwareMDEditor` — wrapper around `@uiw/react-md-editor` that intercepts `onPaste` on the underlying `<textarea>`.
- `handlePasteAsMarkdown` — core paste handler: detects rich-text HTML on clipboard, cleans Word garbage, converts to Markdown via Turndown, inserts at caret.

**Key files**
- `src/web/utils/paste-as-markdown.ts` — conversion engine
- `src/web/components/PasteAwareMDEditor.tsx` — wrapper component
- `src/web/components/TaskDetailsModal.tsx` — 4 editors replaced (Description, Plan, Implementation Notes, Final Summary)
- `src/web/components/DocumentationDetail.tsx` — 1 editor replaced

**Word HTML cleaning (`cleanHtml`)**
1. Remove noise tags (`<style>`, `<meta>`, `<link>`, `<script>`)
2. **Convert `mso-list` paragraphs to `<ul>/<li>`** — Word encodes bullet lists as `<p style="mso-list:...">` with conditional-comment wrappers (`<![if !supportLists]>`). Detected *before* inline styles are wiped, grouped into clusters, and replaced with real `<ul>` elements. Word's `mso-list:Ignore` spans are stripped so Turndown can add its own `-` bullets.
3. Remove all `class` attributes
4. Convert inline styles to semantic tags (`font-weight:bold` → `<strong>`, `italic` → `<em>`, `underline` → `<u>`, `line-through` → `<s>`) with duplicate-wrap guards
5. Remove `style` attributes
6. Remove `<o:p>`, `<img>` (phase 1), empty elements
7. Flatten lists inside table cells to `<p>` paragraphs (Markdown tables can't nest block elements); unordered lists lose the dash prefix, ordered lists keep `1. ` prefix
8. Recursively unwrap non-inline elements inside table cells, append `<br>` for paragraph breaks, collapse whitespace, trim trailing `<br>`s
9. Convert first-row `<td>` to `<th>` so `turndown-plugin-gfm` recognises the table heading

**Turndown configuration**
- `turndown` + `turndown-plugin-gfm` for GFM tables, strikethrough, task lists
- Custom rule `keepBr` — forces `<br>` to raw HTML (`<br>`) instead of Turndown's default `  \n` which breaks Markdown table rows
- Remove `style`, `meta`, `link`, `script`

**Post-processing**
- Move whitespace inside bold/italic markers to the outside (`**  text **` → ` **text** `)
- Ensure space after bold/italic closers when they touch plain text (`**text**word` → `**text** word`)
- Ensure ordered-list markers are followed by a space (`1.item` → `1. item`)

**Smart paste detection**
- If clipboard has no HTML, fall through to native paste
- If cleaned HTML converts to Markdown structurally identical to plain text, fall through (avoids converting simple text)

**Dependencies added**
- `turndown` 7.2.4
- `turndown-plugin-gfm` 1.0.2
- `@types/turndown`

### Phase 2 — Images (Done)

**Design: Temp folder + promote on save**

Goal: avoid accumulating orphaned images in `assets/` when users paste images but don't save.

**Paste flow (screenshot tools)**
1. User pastes screenshot (`image/png` on clipboard, no HTML)
2. `PasteAwareMDEditor` intercepts, reads `clipboardData.items`
3. `POST /api/upload?temp=1` — backend saves to `backlog/assets/.temp/{uuid}.png`
4. Returns `/assets/.temp/{uuid}.png`
5. Insert Markdown: `![image](/assets/.temp/{uuid}.png)`
6. Preview works via existing `/assets/*` route

**Paste flow (Word / web pages with `<img>`)**
1. `handlePasteAsMarkdown` no longer strips `<img>` tags
2. For each `<img>` in the HTML:
   - If `src` is a `data:` URI, extract base64 and upload via JSON
   - If `src` is an HTTP(S) URL, backend downloads and uploads it
   - If `src` is `file://` or unrecognised, remove the `<img>`
3. After upload, replace `src` with `/assets/.temp/{uuid}.png`
4. Turndown emits `![alt](/assets/.temp/{uuid}.png)`

**Save flow (promote)**
1. User clicks "Save" in task/doc editor
2. Frontend scans Markdown for `/assets/.temp/` references
3. `POST /api/assets/promote { urls: ["/assets/.temp/xxx.png", ...] }`
4. Backend moves each file from `.temp/` to `paste/`
5. Returns URL mapping: `{ "/assets/.temp/xxx.png": "/assets/paste/xxx.png" }`
6. Frontend replaces URLs in Markdown, then calls normal save API (`PUT /api/tasks/:id` etc.)

**Why not base64 inline?**
- Base64 bloats size by ~33%
- Large screenshots (2~5 MB original → 2.7~6.7 MB base64) cause severe textarea lag in MDEditor
- Markdown files become unwieldy for version control

**Cleanup**
- Server startup runs `cleanupTempAssets()` asynchronously (non-blocking)
- Deletes `.temp/` files older than **30 minutes**
- Safe: per-file try/catch, never blocks server start

**Backend routes**
- `POST /api/upload?temp=1` — save file (multipart/form-data or JSON with `url`/`dataUri`), return `/assets/.temp/{filename}`
- `POST /api/assets/promote` — move `.temp/` → `paste/`, return URL map

**Security considerations for remote URL download**
- Protocol whitelist: only `http:` and `https:` URLs are accepted; reject `file:`, `ftp:`, `data:`, etc.
- Host blacklist: block `localhost`, `127.0.0.1`, `::1`, and private IP ranges (`10.x.x.x`, `172.16-31.x.x`, `192.168.x.x`) to mitigate SSRF against local services
- Redirect limit: cap redirects at 3 hops to prevent redirect chains to internal addresses
- Content-Type validation: verify the response `Content-Type` starts with `image/` before saving
- Size limit: abort download if response body exceeds 20 MB to prevent disk exhaustion
- Timeout: 30s fetch timeout so stalled requests don't hold connections open

**Core API**
- `src/core/assets.ts` — `AssetManager` class handles all asset operations:
  - `uploadFile(file, isTemp?)` — multipart upload
  - `uploadFromDataUri(dataUri, isTemp?)` — base64 decode + upload
  - `uploadFromUrl(url, isTemp?)` — safe remote download + upload
  - `promote(urls)` — move `.temp/` → `paste/`
  - `cleanup(options?)` — delete stale temp files
  - `downloadImage(url)` — SSRF-safe image fetch (protocol whitelist, private-IP blacklist, redirect limit, content-type & size validation)
- `ClientError` — thrown for client-input mistakes (invalid data URI, failed download, empty file, etc.); server maps this to HTTP 400
- `src/core/backlog.ts` — `Core.assets` exposes the manager; server handlers delegate to it

**Frontend changes**
- `PasteAwareMDEditor`: intercept image paste (screenshot & HTML `<img>`), call upload API
- `TaskDetailsModal` / `DocumentationDetail`: pre-save promote step before `PUT`
- `paste-as-markdown.ts`: async `handlePasteAsMarkdown` with optional `ImageUploader` callback

### Bugfixes (2026-05-09)

**Excel table paste not converted to Markdown**
- Root cause: Excel wraps tables in `<colgroup><col>...</colgroup>`. Turndown GFM table rule does not recognise tables that contain `<colgroup>`, so the raw HTML was preserved instead of being converted to `| col1 | col2 |`.
- Fix: `cleanHtml` now strips `<colgroup>` and `<col>` tags before conversion.
- File: `src/web/utils/paste-as-markdown.ts`

**Excel paste loses screenshot image**
- Root cause: Excel puts the selected range on the clipboard as both `text/html` (table) and `image/png` (screenshot). The previous code only handled one or the other; when HTML was present the standalone image blob was ignored.
- Fix: `handlePasteAsMarkdown` now returns the Markdown `string | null` instead of `boolean`. `PasteAwareMDEditor` receives the markdown, appends any standalone image blob (`\n\n![image](url)`), and inserts both at the caret in one shot.
- Files: `src/web/utils/paste-as-markdown.ts`, `src/web/components/PasteAwareMDEditor.tsx`

**Word `file://` image references**
- Investigated but reverted. Word copies images as `file:///C:/Users/...` local paths. Browser cannot read them, and backend `file://` access was rejected for security reasons. Current behaviour: `file://` `<img>` tags are silently removed. Users can paste screenshots directly (Win+Shift+S) which work as `image/png` blobs.

<!-- SECTION:NOTES:END -->
