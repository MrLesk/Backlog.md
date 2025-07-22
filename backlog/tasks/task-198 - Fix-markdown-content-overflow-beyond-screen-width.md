---
id: task-198
title: Fix markdown content overflow beyond screen width
status: Done
assignee: []
created_date: '2025-07-21'
labels: []
dependencies: []
---

## Description

Markdown tables and long content extend beyond viewport causing horizontal scrolling, breaking responsive design. This affects documentation and decision pages with wide tables.

## Acceptance Criteria

- [x] Tables fit within screen width with proper text wrapping
- [x] Long text content breaks appropriately at screen edges
- [x] No horizontal scrolling required for normal content
- [x] Tables remain readable on mobile devices

## Implementation Notes

Fixed by replacing max-w-none with max-w-full in prose containers and adding overflow-x-auto. Added comprehensive CSS rules for responsive tables including max-width constraints, word-break properties, and proper table cell sizing. Modified DecisionDetail.tsx and DocumentationDetail.tsx components, plus added responsive table styles to source.css.
