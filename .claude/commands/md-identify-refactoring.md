# Identify Refactoring

Analyzes completed tasks with a specific label to find refactoring opportunities.

## Parameters
- `label_name`: The label to filter by

## Prompt

Analyze all completed tasks with the `{{.label_name}}` label. Look for patterns in the implementation notes of these tasks that suggest technical debt or areas for refactoring. If you find any, create a new draft task titled "Refactor [Area]" and summarize your findings in the description.