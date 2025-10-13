# Status Mapping Configuration

## Overview

The Backlog-Jira sync system supports flexible status mapping between Backlog and Jira, with support for different Jira workflows and project-specific overrides.

## Configuration Location

Status mappings are defined in `.backlog-jira/config.json` under the `backlog.statusMapping` key.

## Configuration Format

### Basic Configuration

```json
{
  "backlog": {
    "statusMapping": {
      "To Do": ["To Do", "Open", "Backlog", "Todo"],
      "In Progress": ["In Progress", "In Development", "In Review"],
      "Done": ["Done", "Closed", "Resolved", "Complete"]
    }
  }
}
```

**How it works:**
- Keys are Backlog statuses
- Values are arrays of acceptable Jira statuses
- When syncing from Backlog → Jira, the system queries available transitions and picks one that leads to any of the configured statuses
- When syncing from Jira → Backlog, the system maps the Jira status to the corresponding Backlog status

### Project-Specific Overrides

For projects with custom workflows, you can define project-specific mappings:

```json
{
  "backlog": {
    "statusMapping": {
      "To Do": ["To Do", "Open", "Backlog"],
      "In Progress": ["In Progress"],
      "Done": ["Done", "Closed"]
    },
    "projectOverrides": {
      "MYPROJ": {
        "backlogToJira": {
          "To Do": ["Backlog"],
          "In Progress": ["Selected for Development", "In Progress"],
          "Done": ["Done"]
        },
        "jiraToBacklog": {
          "Backlog": "To Do",
          "Selected for Development": "In Progress",
          "In Progress": "In Progress",
          "Done": "Done"
        }
      }
    }
  }
}
```

**Project override structure:**
- `backlogToJira`: Maps Backlog statuses to arrays of acceptable Jira statuses (for push)
- `jiraToBacklog`: Maps individual Jira statuses to Backlog statuses (for pull)
- The project key is extracted from the Jira issue key (e.g., `MYPROJ-123` → `MYPROJ`)

## Common Jira Workflows

### Scrum Workflow

Typical Scrum workflow statuses:
```json
{
  "backlog": {
    "statusMapping": {
      "To Do": ["Backlog", "To Do", "Selected for Development"],
      "In Progress": ["In Progress", "In Review"],
      "Done": ["Done"]
    }
  }
}
```

### Kanban Workflow

Typical Kanban workflow statuses:
```json
{
  "backlog": {
    "statusMapping": {
      "To Do": ["To Do", "Backlog"],
      "In Progress": ["In Progress", "In Review", "In Testing"],
      "Done": ["Done", "Released"]
    }
  }
}
```

### Custom Workflow Example

For a workflow with stages: Open → Analysis → Development → Code Review → Testing → Closed
```json
{
  "backlog": {
    "statusMapping": {
      "To Do": ["Open", "Analysis"],
      "In Progress": ["Development", "Code Review", "Testing"],
      "Done": ["Closed"]
    }
  }
}
```

## How Status Transitions Work

### Push (Backlog → Jira)

When pushing a status change from Backlog to Jira:

1. The system reads the target Backlog status (e.g., "In Progress")
2. Queries available transitions for the Jira issue using `jira_get_transitions`
3. Looks up acceptable Jira statuses from the configuration
4. Finds a transition that leads to one of the acceptable statuses
5. If found, executes the transition with a comment
6. If not found, logs a warning but continues with other field updates

**Example transition comment:**
```
Status updated from Backlog: To Do → In Progress
```

### Pull (Jira → Backlog)

When pulling a status change from Jira to Backlog:

1. The system reads the current Jira status (e.g., "Code Review")
2. Looks up the corresponding Backlog status in the configuration
3. Updates the Backlog task status via CLI

## Error Handling

### No Transition Available

If no valid transition is found, the system logs a warning with available options:

```
No transition found from current status to "In Progress". 
Available: "Start Progress" → "In Progress", "Reopen" → "To Do"
```

### Missing Configuration

If a status is not configured, the system falls back to:
- Default mappings (To Do, In Progress, Done)
- If no default applies, uses the status name as-is

### Workflow Constraints

Some Jira workflows have required fields for transitions. The system does not automatically populate these fields. If a transition fails due to missing required fields, configure those fields in your Jira workflow or handle them separately.

## Best Practices

### 1. List Most Common Statuses First

```json
{
  "To Do": ["To Do", "Open", "Backlog"]  // "To Do" will be preferred
}
```

### 2. Use Project Overrides for Special Cases

Keep the global mapping simple and use project overrides for projects with unique workflows.

### 3. Include Case Variations

The system does case-insensitive matching as a fallback, but it's best to include exact matches:

```json
{
  "In Progress": ["In Progress", "in progress", "IN PROGRESS"]
}
```

### 4. Test Transitions

After configuration, test transitions with `backlog-jira push --dry-run` to see what would happen without actually making changes.

## Debugging

### Enable Debug Logging

Set the log level to debug to see detailed transition matching:

```bash
LOG_LEVEL=debug backlog-jira push task-123
```

This will show:
- Available transitions queried from Jira
- Acceptable statuses from configuration
- Which transition was selected
- Why a transition was or wasn't found

### Check Available Transitions

You can use the Jira MCP tool directly to see available transitions:

```bash
# Using the MCP tool
jira_get_transitions --issue_key PROJ-123
```

## Example Scenarios

### Scenario 1: Simple Three-Status Workflow

**Jira Workflow:** Open → In Progress → Closed

**Configuration:**
```json
{
  "backlog": {
    "statusMapping": {
      "To Do": ["Open"],
      "In Progress": ["In Progress"],
      "Done": ["Closed"]
    }
  }
}
```

### Scenario 2: Multiple Projects with Different Workflows

**Project A:** Standard workflow (To Do, In Progress, Done)
**Project B:** Custom workflow (Backlog, Selected, In Dev, In Review, Released)

**Configuration:**
```json
{
  "backlog": {
    "statusMapping": {
      "To Do": ["To Do", "Open"],
      "In Progress": ["In Progress"],
      "Done": ["Done", "Closed"]
    },
    "projectOverrides": {
      "PROJB": {
        "backlogToJira": {
          "To Do": ["Backlog", "Selected"],
          "In Progress": ["In Dev", "In Review"],
          "Done": ["Released"]
        },
        "jiraToBacklog": {
          "Backlog": "To Do",
          "Selected": "To Do",
          "In Dev": "In Progress",
          "In Review": "In Progress",
          "Released": "Done"
        }
      }
    }
  }
}
```

### Scenario 3: Detailed Development Workflow

**Workflow:** Backlog → Ready → Dev → Review → QA → Staging → Prod → Closed

**Configuration:**
```json
{
  "backlog": {
    "statusMapping": {
      "To Do": ["Backlog", "Ready"],
      "In Progress": ["Dev", "Review", "QA", "Staging"],
      "Done": ["Prod", "Closed"]
    }
  }
}
```

## Migration from Old System

If you're upgrading from an older version with hardcoded status mappings:

1. Run `backlog-jira init` to create the default configuration
2. Customize the `statusMapping` section based on your Jira workflows
3. Test with `--dry-run` before applying changes
4. Remove any custom status mapping code from your local modifications

## Support

For issues or questions about status mapping:

1. Check the logs with `LOG_LEVEL=debug`
2. Verify your configuration with `cat .backlog-jira/config.json`
3. Test transitions manually in Jira to ensure they're available
4. Consult the Jira API documentation for transition requirements
