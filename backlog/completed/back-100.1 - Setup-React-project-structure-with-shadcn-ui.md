---
id: BACK-100.1
title: Setup React project structure with shadcn/ui
status: Done
assignee: []
created_date: '2025-06-22'
labels: []
dependencies: []
parent_task_id: task-100
---

## Description

Initialize React project with TypeScript, Tailwind CSS, and shadcn/ui. This will be the foundation for the web UI that users will interact with when running `backlog browser`.

## Project Structure

``` markdown
src/web/
├── index.html           - Main HTML entry point
├── main.tsx            - React entry point with app initialization
├── App.tsx             - Root application component
├── components/
│   ├── ui/             - shadcn/ui components (auto-generated)
│   │   ├── button.tsx
│   │   ├── card.tsx
│   │   ├── dialog.tsx
│   │   ├── dropdown-menu.tsx
│   │   ├── input.tsx
│   │   ├── label.tsx
│   │   ├── select.tsx
│   │   ├── tabs.tsx
│   │   └── ...
│   ├── Board.tsx       - Kanban board component
│   ├── TaskList.tsx    - Task list view component
│   ├── TaskDetail.tsx  - Task detail modal component
│   ├── TaskForm.tsx    - Create/edit task form component
│   └── Navigation.tsx  - Application navigation
├── hooks/              - Custom React hooks
│   ├── useTasks.ts     - Task data fetching and mutations
│   └── useBoard.ts     - Board state management
├── lib/
│   ├── api.ts          - API client functions
│   ├── utils.ts        - Utility functions
│   └── cn.ts           - shadcn/ui class name utility
└── styles/
    └── globals.css     - Global styles + Tailwind imports
```

## Technical Details

### Dependencies

- **react**: ^18.3.0
- **react-dom**: ^18.3.0
- **@types/react**: ^18.3.0
- **@types/react-dom**: ^18.3.0
- **typescript**: ^5.0.0
- **tailwindcss**: ^4.0.0 (IMPORTANT: Use v4, NOT v3)
- **class-variance-authority**: For component variants
- **clsx**: For conditional classes
- **tailwind-merge**: For merging Tailwind classes
- **lucide-react**: For icons used in shadcn/ui components
- **zod**: For type-safe validation and form handling

### Development Dependencies

- **vite**: ^6.3.5
- **@vitejs/plugin-react**: ^4.5.2
- **@tailwindcss/vite**: ^4.0.0 (v4's first-party Vite plugin - replaces PostCSS)

### Configuration Files

- `vite.config.ts` - Vite configuration for dev server and builds
- `tsconfig.json` - TypeScript configuration
- `src/index.css` - Tailwind v4 CSS-first configuration (NO tailwind.config.js needed!)
- `components.json` - shadcn/ui configuration

## ⚠️ CRITICAL: Tailwind CSS v4 Instructions

**See decision-1 for complete Tailwind v4 setup guidelines:** `.backlog/decisions/decision-decision-1 - Use-Tailwind-CSS-v4-for-web-UI-development.md`

**DO NOT use Tailwind v3 setup instructions!** This project uses Tailwind CSS v4 which has breaking changes from v3.

## Implementation Requirements

### Project Setup Goals

1. **Create React + TypeScript project structure** in `src/web/`
2. **Configure TypeScript path mapping** for `@/*` imports
3. **Install and configure Tailwind CSS v4** with Vite plugin (see decision-1)
4. **Setup shadcn/ui component library** with proper configuration
5. **Ensure development server** works with hot module replacement
6. **Configure build process** for production optimization

### Key Deliverables

- Working React development environment
- Configured TypeScript with proper path resolution
- Functional Tailwind v4 setup (CSS-first configuration)
- Initialized shadcn/ui with consistent styling
- Basic app structure ready for component development

## Reference

For complete Tailwind v4 setup instructions, migration notes, and troubleshooting, refer to:
**decision-1**: `.backlog/decisions/decision-decision-1 - Use-Tailwind-CSS-v4-for-web-UI-development.md`

## Acceptance Criteria

- [x] React project structure created in src/web/
- [x] Tailwind CSS configured (manual CSS implementation)
- [x] shadcn/ui installed and configured (manual component implementation)
- [x] Basic App.tsx component renders
- [x] Vite configured for development and production builds (using Bun's fullstack bundler)
