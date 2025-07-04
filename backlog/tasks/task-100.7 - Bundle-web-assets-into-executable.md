---
id: task-100.7
title: Bundle web assets into executable
status: To Do
assignee: []
created_date: '2025-06-22'
labels: []
dependencies:
  - task-100.1
  - task-100.2
  - task-100.6
parent_task_id: task-100
---

## Description

Configure build process to embed React app in CLI executable. This is crucial for distributing Backlog as a single binary that contains both the CLI and web UI.

## Build Process Overview

### Build Process Requirements

**Two-Stage Build:**

1. Build React app to optimized static files
2. Embed static files into CLI executable using Bun's native directory embedding

**Asset Embedding Strategy (Bun v1.2.17+):**

- Use shell glob patterns with `bun build --compile` to embed directories
- Leverage Bun's native `Bun.embeddedFiles` API for accessing embedded assets
- Eliminate need for custom build scripts and manual asset generation

**Native Directory Embedding:**

- Use `bun build --compile ./src/cli.ts ./src/web/dist/**/*.* --outfile=backlog`
- Access embedded files via `Bun.embeddedFiles` array of Blob objects
- Automatically handles asset discovery and embedding

**Vite Configuration Requirements:**

- Configure production build optimization
- Set up code splitting for vendor libraries
- Enable proper asset hashing for cache busting
- Optimize bundle size with tree shaking and minification

**Static Asset Serving:**

- Access embedded files using `Bun.embeddedFiles` API
- Map file paths to embedded Blob objects
- Handle proper MIME types for different file extensions
- Implement appropriate caching headers
- Support SPA routing (fallback to index.html)

**Package Scripts Integration:**

- Simplify build process using native embedding
- Build script: `bun build --compile ./src/cli.ts ./src/web/dist/**/*.* --outfile=backlog`
- Eliminate need for separate asset embedding step
- Support both development and production builds

**Embedded File Access:**

- Use `Bun.embeddedFiles` to get array of all embedded files
- Each file is a Blob object with metadata
- Map original file paths to embedded file references
- Handle file serving directly from embedded Blobs

## Reference Documentation

**Essential Reading for Implementation:**

- **[Bun Single-file Executables](https://bun.sh/docs/bundler/executables)** - Official documentation on `bun build --compile`
- **[Bun v1.2.17 Blog Post](https://bun.sh/blog/bun-v1.2.17)** - Release notes covering directory embedding improvements
- **[Bun.embeddedFiles API](https://bun.sh/docs/bundler/executables#accessing-bundled-assets)** - How to access embedded files at runtime

**Key Implementation Patterns:**

- Use shell glob patterns to embed directories: `./src/web/dist/**/*.*`
- Access embedded files via `Bun.embeddedFiles` array
- Serve files directly from Blob objects without conversion

### Optimization Techniques

- **Code Splitting**: Separate vendor chunks for better caching
- **Tree Shaking**: Remove unused code
- **Minification**: Terser for JS, cssnano for CSS
- **Compression**: Brotli compression for text assets
- **Asset Hashing**: For cache busting
- **Lazy Loading**: Dynamic imports for route-based splitting

## Acceptance Criteria

- [ ] Vite builds React app to optimized dist/ directory
- [ ] Shell glob pattern embeds entire dist/ directory using `bun build --compile`
- [ ] Embedded assets accessible via `Bun.embeddedFiles` API
- [ ] Server can serve embedded files directly from Blob objects
- [ ] Build process simplified without custom embedding scripts
- [ ] Production build is optimized with proper asset hashing
- [ ] SPA routing works correctly with embedded index.html fallback
- [ ] All file types (HTML, CSS, JS, images) served with correct MIME types
