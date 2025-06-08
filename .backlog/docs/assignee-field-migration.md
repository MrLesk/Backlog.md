# Assignee Field Migration

The `assignee` field in task frontmatter is now an array. New tasks are created with:

```yaml
assignee: []
```

## Updating Existing Tasks

If your tasks use a single string:

```yaml
assignee: "@user"
```

convert it to:

```yaml
assignee:
  - "@user"
```

Tasks without an assignee should explicitly contain `assignee: []`.
