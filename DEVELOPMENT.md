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

## Release

To publish a new version to npm:

1. Update the `version` field in `package.json`.
2. Commit the change and create a git tag matching the version, e.g. `v0.1.0`.
   ```bash
   git tag v<version>
   git push origin v<version>
   ```
3. Push the tag to trigger the GitHub Actions workflow. It will build, test and
   publish the package to npm using the repository `NODE_AUTH_TOKEN` secret.

[← Back to README](README.md)

