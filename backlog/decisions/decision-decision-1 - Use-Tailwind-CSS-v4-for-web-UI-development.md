---
id: decision-1
title: Use Tailwind CSS v4 for web UI development
date: '2025-06-22'
status: proposed
---
## Context

The web UI implementation for Backlog.md requires a CSS framework. Tailwind CSS v4 was recently released with significant breaking changes from v3. Given that AI agents may have knowledge cutoffs that include Tailwind v3 instructions, we need clear guidance to prevent setup confusion.

## Decision

We will use **Tailwind CSS v4** for all web UI development in this project.

### Key Requirements:
- Use `tailwindcss@next` and `@tailwindcss/vite@next` packages
- CSS-first configuration using `@import "tailwindcss"` syntax
- No `tailwind.config.js` file - configuration goes in CSS using `@theme`
- Use `@tailwindcss/vite` plugin instead of PostCSS setup

### Rationale:
1. **Modern approach**: v4 provides better performance and developer experience
2. **CSS-first**: More intuitive configuration directly in CSS
3. **Future-proofing**: Latest version with ongoing support
4. **Vite integration**: First-party Vite plugin for optimal performance

## Setup Instructions

### Installation
```bash
bun add -D tailwindcss@next @tailwindcss/vite@next
```

### Vite Configuration
```typescript
// vite.config.ts
import tailwindcss from "@tailwindcss/vite"

export default defineConfig({
  plugins: [react(), tailwindcss()]
})
```

### CSS Configuration
```css
/* src/index.css */
@import "tailwindcss";

@theme {
  /* Custom theme configuration */
  --color-primary: #3b82f6;
}
```

### ❌ DON'T DO (Tailwind v3):
```css
@tailwind base;
@tailwind components;
@tailwind utilities;
```

```javascript
// tailwind.config.js
module.exports = {
  content: ['./src/**/*.{js,jsx,ts,tsx}'],
  theme: { extend: {} }
}
```

### ✅ DO THIS (Tailwind v4):
```css
@import "tailwindcss";
@theme {
  --color-primary: #3b82f6;
}
```

## Consequences

### Positive:
- **Better Performance**: v4's Vite plugin provides faster builds
- **Simplified Setup**: No PostCSS configuration needed
- **CSS-first Config**: More intuitive than JavaScript configuration
- **Automatic Content Detection**: No need to manually configure content paths
- **Modern Features**: Built-in container queries, 3D transforms, enhanced gradients

### Negative:
- **Breaking Changes**: Cannot use v3 documentation/examples without adaptation
- **Learning Curve**: Team needs to understand v4-specific syntax
- **Potential Issues**: As a newer version, may have undiscovered edge cases

### Mitigation:
- Clear documentation with v3 vs v4 comparisons
- Reference this decision in all relevant tasks
- Provide specific examples for common use cases

## References

- [Tailwind CSS v4 Blog Post](https://tailwindcss.com/blog/tailwindcss-v4)
- [Tailwind v4 TL;DR Guide](https://gist.github.com/danhollick/d902cf60e37950de36cf8e7c43fa0943)
