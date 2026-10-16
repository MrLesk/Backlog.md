---
type: C4 Component
title: Settings and setup
status: stable
groma:
  id: settings-and-setup
  parent: web-ui
  code:
    - scanner: react
      file: src/web/components/Settings.tsx
    - scanner: typescript
      file: src/web/components/Settings.tsx
      symbol: Settings
    - scanner: react
      file: src/web/components/InitializationScreen.tsx
    - scanner: typescript
      file: src/web/components/InitializationScreen.tsx
      symbol: InitializationScreen
  group: Pages
description: Edit project settings, or initialize a project from the browser
---

The settings page edits the project config, such as the project name, Definition of Done defaults, Git and Web UI options. When the server runs in a folder with no project, the setup screen collects the same choices as `backlog init` and initializes it.

## Relationships

| Source | Target | Description | Technology |
| --- | --- | --- | --- |
| [src/web/components/Settings.tsx](../../../../../../src/web/components/Settings.tsx) | [src/web/lib/api.ts](../../../../../../src/web/lib/api.ts) | Saves project settings | In-process call |
| [src/web/components/InitializationScreen.tsx](../../../../../../src/web/components/InitializationScreen.tsx) | [src/web/App.tsx](../../../../../../src/web/App.tsx) | Reports the project is ready | React props |

## Derived relationships

| Source | Target | Description | Technology |
| --- | --- | --- | --- |
| [src/web/components/InitializationScreen.tsx](../../../../../../src/web/components/InitializationScreen.tsx) | [src/web/App.tsx](../../../../../../src/web/App.tsx) | Invokes supplied callback: onInitialized | react |
