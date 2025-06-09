---
id: task-6.2
title: 'CLI: GitHub Actions for Build & Publish'
status: Done
assignee: []
reporter: '@MrLesk'
created_date: '2025-06-09'
updated_date: '2025-06-09'
labels:
  - ci
dependencies: []
parent_task_id: task-6
---

## Description

Set up continuous integration for the CLI. Use GitHub Actions to build the project with Bun, run tests, and publish the package to npm (and by extension Yarn) when a release tag is pushed.

## Acceptance Criteria

- [x] Workflow builds the CLI with `bun build` and runs tests
- [x] Publishing step deploys to npm using `NODE_AUTH_TOKEN`
- [x] Trigger on version tags like `v*.*.*`
- [x] Documentation updated with release instructions

## Implementation Notes

**GitHub Actions Workflow (.github/workflows/ci.yml):**
- Created comprehensive CI/CD pipeline with name "Build and Publish"
- **Triggers**: Main branch pushes, pull requests, and version tags matching `v*.*.*` pattern
- **Environment**: Runs on `ubuntu-latest` with Bun runtime setup via `oven-sh/setup-bun@v1`
- **Build Process**: Executes `bun install`, `bun run build`, and `bun test` in sequence
- **Publishing**: Conditional publishing to npm only when tags are pushed (`startsWith(github.ref, 'refs/tags/')`)

**Build & Test Pipeline:**
- **Dependencies**: `bun install` installs all project dependencies
- **Build**: `bun run build` executes complex build script creating both Node.js bundle and compiled binary
- **Testing**: `bun test` runs entire test suite (122+ tests) to ensure quality before publishing
- **Build Artifacts**: Creates `cli/index.js` (Node.js entry point) and `cli/backlog` (standalone binary)

**NPM Publishing Configuration:**
- Uses `npm publish --access public` for publishing to npm registry
- Authenticates via `NODE_AUTH_TOKEN` environment variable from GitHub secrets
- Package configured with `"name": "backlog.md"` and proper `bin` entry pointing to `./cli/index.js`
- Version controlled via `package.json` version field (currently 0.1.0)

**Documentation & Release Process (readme.md:245-257):**
- Added comprehensive "Release" section with step-by-step instructions
- **Process**: Update version in package.json → Commit changes → Create git tag → Push tag
- **Automation**: Git tag push automatically triggers GitHub Actions workflow
- **Security**: Workflow uses repository `NODE_AUTH_TOKEN` secret for secure npm publishing

**Quality Assurance:**
- Workflow validates build process before any publishing attempt
- All tests must pass before package publication
- Conditional publishing prevents accidental releases from non-tag pushes
- Multi-trigger setup enables CI validation on PRs and main branch changes

**Future Considerations:**
- Workflow ready for production use with proper security practices
- Supports semantic versioning via git tags (v1.0.0, v2.1.3, etc.)
- Can be enhanced with version consistency validation and artifact retention if needed

The implementation provides a complete automated CI/CD pipeline that builds, tests, and publishes the Backlog.md CLI package to npm whenever a version tag is pushed, ensuring quality releases with minimal manual intervention.
