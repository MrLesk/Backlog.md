---
id: BACK-488
title: Fix wiki pasted images not moved to paste directory on save
status: Done
assignee:
  - '@kimi'
created_date: '2026-05-24 23:59'
updated_date: '2026-05-24 16:07'
labels:
  - bug
  - wiki
  - web-ui
  - image-handling
dependencies: []
references:
  - backlog/tasks/back-208 - Add-paste-as-markdown-support-in-Web-UI.md
priority: medium
---

## Description

When editing a wiki page in the Web UI and pasting an image, the image is uploaded to the `.temp/` directory. However, upon saving the wiki page, the pasted image is **not** migrated to the `paste/` directory (or equivalent permanent storage) like it is for tasks and documents. This results in broken image links once the `.temp/` directory is cleaned up.

### Expected Behavior

Pasted images in wiki pages should be handled consistently with tasks and documents: on save, images referenced from `.temp/` should be moved to a permanent location (e.g., `backlog/paste/` or `backlog/wiki/paste/`) and the markdown references should be updated accordingly.

### Actual Behavior

Images remain in `.temp/` after saving the wiki page. When `.temp/` is cleaned or the session ends, the images are lost and the wiki page shows broken image links.

## References

- [[back-208]] — `Add paste-as-markdown support in Web UI` 中设计了 temp → paste 的图片迁移机制（见 Implementation Notes 中 Phase 2 — Images 的 Save flow (promote) 部分），但 wiki 页面保存时未复用该逻辑。

## Acceptance Criteria

<!-- AC:BEGIN -->
- [x] #1 Identify where task/document save handles `.temp/` → `paste/` image migration
- [x] #2 Reuse or adapt the same migration logic for wiki page saves
- [x] #3 Ensure pasted images in wiki pages are moved to a permanent directory on save
- [x] #4 Ensure markdown image references are updated after migration
- [x] #5 Verify `.temp/` cleanup does not break wiki images
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
### Code Changes

- **Modified file**: `src/web/components/WikiDetail.tsx`
  - Added `extractTempImageUrls` and `replaceTempImageUrls` helper functions (lines 303–314), matching the existing implementations in `TaskDetailsModal.tsx` and `DocumentationDetail.tsx`.
  - Updated `handleSave` (lines 316–337) to promote temporary images before calling `apiClient.updateWikiPage`:
    1. Extract `/assets/.temp/…` URLs from `editContent`.
    2. If any exist, call `apiClient.promoteAssets(tempUrls)` to move them to `paste/`.
    3. Replace temp URLs with promoted URLs in the content.
    4. Update `editContent` state so the editor reflects the permanent URLs.
    5. Proceed with the normal wiki save API call.

### Behavior Notes

- Wiki pages already used `PasteAwareMDEditor`, so image pasting into `.temp/` worked correctly. The only missing piece was the **save-time promotion step**, which tasks and documents already had.
- No backend changes were required; the existing `/api/assets/promote` endpoint and `AssetManager.promote()` method handle wiki images the same way.
<!-- SECTION:NOTES:END -->

## Definition of Done

<!-- DOD:BEGIN -->
- [x] #1 biome format passes (stdin check on modified file)
- [x] #2 biome lint passes (no errors on modified file)
- [x] #3 bun test passes (no regressions; frontend change not covered by existing CLI/backend test suite)
<!-- DOD:END -->
