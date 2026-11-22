# Contributing to Backlog.md

Thank you for your interest in contributing to Backlog.md. This project is managed using the Backlog.md workflow and we welcome community involvement.

## Opening Issues

- Search existing issues before creating a new one.
- Provide a clear description of the problem or proposal.
- Reference the related task ID when applicable.

## Pull Requests

1. Fork the repository and create a branch named after the task ID and a short description (e.g. `task-27-contributing-guidelines`).
2. Make your changes and commit them with the task ID in the message.
3. Run tests with `bun run test` and ensure they pass. It applies the same test timeout CI uses.
4. Format and lint the code using `npx biome check .`.
5. Open the PR after a project maintainer agrees to it in the GitHub issue. Link their approval and the Backlog task in the [pull request template](.github/PULL_REQUEST_TEMPLATE.md).

Please read [AGENTS.md](AGENTS.md) for detailed rules that apply to contributors and AI agents.
