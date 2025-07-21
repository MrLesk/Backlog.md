# Capture Feature Request

Creates a new draft task for a feature request.

## Parameters
- `feature_description`: Description of the feature
- `user_rationale`: Rationale for the feature

## Prompt

Capture the following feature request as a draft using the `backlog task create` command with the `--draft` flag.

**Feature:** "{{.feature_description}}"
**Rationale:** "{{.user_rationale}}"

Include the user's rationale in the description field (`-d`).