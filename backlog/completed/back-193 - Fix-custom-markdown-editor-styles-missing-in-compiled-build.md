---
id: BACK-193
title: Fix custom markdown editor styles missing in compiled build
status: Done
assignee:
  - '@kiro'
created_date: '2025-07-15'
updated_date: '2025-07-15'
labels:
  - bug
  - css
  - build
dependencies: []
---

## Description

Custom markdown editor dark theme styles were working correctly in development mode but were missing when running the compiled binary build. The MDEditor component was showing default dark colors instead of the custom blue-dark theme overrides defined in the CSS.

## Acceptance Criteria

- [x] Custom markdown editor styles apply correctly in compiled build
- [x] Dark theme colors match the custom blue-dark theme
- [x] Styles work consistently between development and production builds
- [x] CSS compilation process preserves custom component styles

## Implementation Plan

1. Investigate why styles work in development but not in compiled build
2. Identify CSS specificity and load order issues between custom styles and MDEditor defaults
3. Move custom markdown styles from @layer components to @layer utilities for higher precedence
4. Add !important declarations to ensure custom styles override MDEditor defaults
5. Clean up unnecessary @source directives that were causing warnings
6. Test both development and compiled builds to ensure consistency

## Implementation Notes

The root cause was a CSS cascade and specificity issue. In development mode, the custom CSS was loading after the MDEditor's default CSS, allowing the overrides to work. However, in the compiled build, the MDEditor's CSS was being bundled and loaded after the custom styles, causing the defaults to override the custom theme.

**Solution implemented:**
1. Moved custom markdown editor styles from `@layer components` to `@layer utilities` in `src/web/styles/source.css`
2. Added `!important` declarations to all CSS custom properties to ensure they override MDEditor defaults
3. Increased selector specificity by adding additional selectors like `div[data-color-mode*="dark"]`
4. Removed unnecessary `@source` directives that were causing build warnings
5. Cleaned up duplicate styles and maintained proper CSS organization

**Files modified:**
- `src/web/styles/source.css` - Moved markdown editor styles to utilities layer with higher specificity

The fix ensures that custom markdown editor styles have higher precedence than the MDEditor's default styles in both development and compiled builds, providing a consistent user experience across all deployment modes.
