---
id: BACK-475
title: Add Word (.docx) upload to enable image extraction for pasted Word content
status: Done
assignee: 
  - Kimi
created_date: '2026-05-11 20:05'
updated_date: '2026-05-11 21:37'
labels:
  - web-ui
  - enhancement
  - markdown
  - editor
dependencies: []
priority: medium
ordinal: 24000
---

## Description

Allow the Web UI rich-text editor to directly upload Word documents (`.docx`), automatically convert their content to Markdown format, and import it into the editor. If the Word document contains images, they should be extracted and uploaded to the temporary file directory, with corresponding image references inserted into the Markdown.

### Background

The existing editor already supports pasting rich text and automatically converting it to Markdown (BACK-208), but users still need a way to directly upload `.docx` files. This feature should reuse the existing image upload and temporary file management mechanisms (`backlog/assets/.temp/` and the promote flow) to maintain architectural consistency.

### Expected Behavior

1. Add an "Upload Word Document" entry to the editor toolbar or drag-and-drop area.
2. After the user selects a `.docx` file, the frontend sends it to the backend for parsing.
3. The backend extracts the text content from the document and converts it to Markdown format.
4. The backend extracts embedded images from the document, saves them to the `backlog/assets/.temp/` directory, and returns temporary URLs.
5. The frontend inserts the Markdown content and image references into the editor.
6. When the user saves, the existing `promote` flow migrates images from `.temp/` to the permanent directory.

## Acceptance Criteria

- [x] #1 Support uploading `.docx` files via file picker or drag-and-drop.
- [x] #2 Word document text content (paragraphs, headings, lists, tables, bold/italic/underline, etc.) is correctly converted to Markdown.
- [x] #3 Embedded images in Word documents are extracted and uploaded to `backlog/assets/.temp/`, generating temporary URLs.
- [x] #4 Images in the converted Markdown are inserted at the correct position in the form `![alt](/assets/.temp/{uuid}.png)`.
- [x] #5 Large files (>20MB) or malformed documents give clear error messages.
- [x] #6 New dedicated API `POST /api/docx/convert` handles `.docx` parsing.
- [x] #7 When the user clicks save, temporary images go through the existing `POST /api/assets/promote` flow to be promoted.
- [x] #8 Does not break the existing paste-as-Markdown functionality (BACK-208).

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->

### Technical Approach Reference

**Backend Parsing**
- Optional libraries: `mammoth` (convert `.docx` to HTML, then reuse existing Turndown logic) or `docx-to-markdown` class libraries.
- Recommended: `mammoth` first converts `.docx` → HTML, then reuses the `cleanHtml` + Turndown chain from `src/web/utils/paste-as-markdown.ts` to ensure consistency with paste behavior.
- `mammoth` supports image conversion callbacks: embedded images can be exported as buffers, then reused with `AssetManager.uploadFromDataUri` or `uploadFile` to write to `.temp/`.

**Frontend Interaction**
- Add an "Upload Word" button / drag-and-drop area in `PasteAwareMDEditor` or the editor toolbar.
- Show progress or loading state during upload.
- After parsing is complete, insert Markdown into the editor's current cursor position in one go (or replace current content; interaction to be confirmed).

**API Design**
```
POST /api/docx/convert
Content-Type: multipart/form-data

file: <.docx file>

Response:
{
  "markdown": "# Title\n\nParagraph...",
  "images": [
    { "tempUrl": "/assets/.temp/uuid1.png", "alt": "image1" }
  ]
}
```

**Image Handling**
- Reuse `AssetManager` from `src/core/assets.ts`.
- Each extracted image is saved via `uploadFile(buffer, { isTemp: true })`.
- The returned `tempUrl` is embedded in Markdown, and subsequent promote logic is identical to BACK-208.

**Error Handling**
- Non-`.docx` extension → 400.
- Parsing failure / corrupted file → 400 with readable error message.
- Single image exceeds size limit → skip the image and warn in the response, or fail entirely (strategy to be determined).

### Post-Completion Fixes (2026-05-11)

**Table normalization in docx upload**
- Problem: Uploading `.docx` files with complex tables (nested paragraphs, lists, bold text inside cells) produced raw `<table>` HTML instead of GFM Markdown tables.
- Root cause: Backend `docx-converter.ts` sent mammoth HTML directly to Turndown without the `cleanHtml` preprocessing that the paste path already had.
- Fix: Backend now returns raw HTML (`{ html, images, messages }`); frontend `PasteAwareMDEditor.handleDocxUpload` calls `cleanHtml` + Turndown in the browser, reusing the exact same pipeline as paste-as-markdown. This ensures tables are flattened (block elements unwrapped, lists prefixed, first row promoted to `<th>`) before conversion.

**Image preservation in docx upload**
- Problem: `cleanHtml` removed empty `<p>/<span>/<div>` elements. A `<p>` containing only an `<img>` has no `textContent`, so it was stripped and images disappeared from the output.
- Fix: `cleanHtml` gained a `keepMedia` option. `handleDocxUpload` passes `{ keepMedia: true }` so server-side extracted images (already uploaded to `.temp/`) are preserved. The paste path keeps the default behaviour (invalid local images are still filtered out by the existing upload/replace logic in `handlePasteAsMarkdown`).

**HTML cleanup unified on the frontend**
- Problem: The backend `docx-converter.ts` performed Turndown conversion directly on mammoth HTML, while the frontend paste path ran `cleanHtml` first. This caused divergent output — complex tables worked for paste but not for file upload.
- Fix: `docx-converter.ts` now returns raw mammoth HTML (`{ html, images, messages }`). The frontend (`PasteAwareMDEditor.handleDocxUpload`) calls `cleanHtml` + Turndown in the browser, using the exact same pipeline as `handlePasteAsMarkdown`. This guarantees paste and upload produce identical Markdown.

<!-- SECTION:NOTES:END -->

## Definition of Done

<!-- DOD:BEGIN -->
- [x] #1 `bunx tsc --noEmit` passes when TypeScript touched.
- [x] #2 `bun run check .` passes when formatting/linting touched.
- [x] #3 `bun test` (or scoped test) passes.
- [x] #4 Manual test: upload a Word document with images, confirm Markdown rendering and image promote work correctly.
<!-- DOD:END -->
