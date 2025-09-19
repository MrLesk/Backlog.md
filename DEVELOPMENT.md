## Local Development

Run these commands to bootstrap the project:

```bash
bun install
```

Run tests:

```bash
bun test
```

Format and lint:

```bash
npx biome check .
```

For contribution guidelines, see [CONTRIBUTING.md](CONTRIBUTING.md).

## Filesystem-only Mode (No Git)

For local testing without a Git repository, you can initialize a project in filesystem-only mode:

```bash
bun src/cli.ts init "Dev Project" --no-git --defaults
```

This disables cross-branch checks and remote Git operations, and forces `autoCommit: false`. You can still run all core commands (task/doc/decision creation) without Git installed.

## Release

Backlog.md now relies on npm Trusted Publishing with GitHub Actions OIDC. The
release workflow builds binaries, publishes all npm packages, and records
provenance automatically. Follow the steps below to keep the setup healthy.

### Prerequisites

- Choose the release version and ensure your git tag follows the
  `v<major.minor.patch>` pattern. The workflow automatically rewrites
  `package.json` files to match the tag, so you do **not** need to edit the
  version field manually.
- In npm's **Trusted publishers** settings, link the
  `MrLesk/Backlog.md` repository and the `Release multi-platform executables`
  workflow for each package: `backlog.md`,
  `backlog.md-linux-{x64,arm64}`, `backlog.md-darwin-{x64,arm64}`, and
  `backlog.md-windows-x64`.
- Remove the legacy `NODE_AUTH_TOKEN` repository secret. Publishing now uses
  the GitHub-issued OIDC token, so no long-lived npm tokens should remain.
- The workflow activates `npm@latest` (currently 11.6.0 as of 2025-09-18) via
  Corepack to satisfy npm's trusted publishing requirement of version 11.5.1 or
  newer. If npm raises the minimum version again, the latest tag will pick it
  up automatically.

### Publishing steps

1. Commit the version bump and create a matching tag. You can either push the
   tag from your terminal
   ```bash
   git tag v<major.minor.patch>
   git push origin main v<major.minor.patch>
   ```
   or create a GitHub Release in the UI (which creates the tag automatically).
   Both paths trigger the same `Release multi-platform executables` workflow.
2. Monitor the workflow run:
   - `Dry run trusted publish` and `Dry run platform publish` confirm that
     npm accepts the trusted publisher token before any real publish.
   - Publishing uses trusted publishing (no tokens) so npm automatically records
     provenance; no additional CLI flags are required.
3. After the workflow completes, verify provenance on npm by opening each
   package's **Provenance** tab or by running `npm view <package> --json | jq '.dist.provenance'`.

[← Back to README](README.md)
