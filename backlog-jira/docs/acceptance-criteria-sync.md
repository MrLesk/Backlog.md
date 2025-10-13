# Acceptance Criteria Synchronization

## Overview

The backlog-jira plugin supports bidirectional synchronization of acceptance criteria (AC) between Backlog.md tasks and Jira issues. Acceptance criteria are embedded in Jira issue descriptions using markdown checkbox format.

## Format

### In Backlog Tasks

Acceptance criteria in Backlog tasks are stored as structured data:

```markdown
## Acceptance Criteria

- [ ] #1 First criterion
- [x] #2 Second criterion (checked)
- [ ] #3 Third criterion
```

### In Jira Issues

Acceptance criteria are embedded in the issue description after a special section marker:

```markdown
Description text goes here...

Acceptance Criteria:
- [ ] First criterion
- [x] Second criterion (checked)
- [ ] Third criterion
```

## Sync Behavior

### Push (Backlog → Jira)

When pushing a task to Jira:
1. The task's acceptance criteria are formatted as markdown checkboxes
2. Any existing "Acceptance Criteria:" section in the Jira description is removed
3. The formatted AC section is appended to the description
4. Checked/unchecked state is preserved using `[x]` and `[ ]` markers

### Pull (Jira → Backlog)

When pulling a Jira issue to Backlog:
1. The "Acceptance Criteria:" section is extracted from the Jira description
2. All existing AC in the Backlog task are removed
3. New AC are added from the extracted section
4. Checked items are marked with `--check-ac` CLI flag
5. The description is updated without the AC section (AC stored separately)

### Bidirectional Sync

The sync command uses the same logic as push/pull depending on which side changed:
- If only Backlog changed: Push AC to Jira
- If only Jira changed: Pull AC from Jira
- If both changed: Conflict resolution applies (based on strategy)

## Edge Cases

### Multiple AC Sections

If a Jira description contains multiple "Acceptance Criteria:" sections, only the last one is recognized. Previous sections are treated as regular description text.

### AC in Middle of Description

When pushing, any existing AC section (anywhere in the description) is removed before the new one is appended. This ensures AC always appear at the end of the description.

### Empty AC Lists

- Pushing a task with no AC: Jira description contains only the base description
- Pulling an issue with no AC section: No AC operations are performed on the Backlog task
- If AC section exists but is empty: Treated the same as no AC section

### Mixed Case Headers

The AC section header matching is case-insensitive:
- "Acceptance Criteria:"
- "acceptance criteria:"
- "ACCEPTANCE CRITERIA:"

All variations are recognized.

## Implementation Details

### Format Functions

**`formatAcceptanceCriteriaForJira(ac)`**
- Converts AC array to markdown format
- Returns string: `\n\nAcceptance Criteria:\n- [ ] text\n- [x] text`

**`stripAcceptanceCriteriaFromDescription(desc)`**
- Removes AC section from description text
- Uses regex to find and strip the section

**`mergeDescriptionWithAc(desc, ac)`**
- Combines clean description with formatted AC
- Ensures AC always appears at the end

### Sync Strategy

The current implementation uses a **simple replacement strategy**:
1. Compare AC lists between Backlog and Jira
2. If different, remove all Backlog AC
3. Add all AC from Jira
4. Check the appropriate ones

This ensures consistency but may not preserve manual edits during conflicts.

### Future Enhancements

Potential improvements for AC sync:
- **Smart diff/merge**: Match AC by text similarity, preserve edits
- **Conflict resolution**: Interactive UI for AC-level conflicts
- **Custom formatting**: Allow users to customize AC section format
- **Numbering**: Preserve AC numbering from Backlog in Jira

## Examples

### Example 1: Creating a New Jira Issue

**Backlog Task:**
```
Title: Add login feature
Description: Implement user login functionality

Acceptance Criteria:
- [ ] #1 User can login with email and password
- [ ] #2 Login form validates inputs
- [ ] #3 Error messages display for invalid credentials
```

**Resulting Jira Issue:**
```
Summary: Add login feature
Description:
Implement user login functionality

Acceptance Criteria:
- [ ] User can login with email and password
- [ ] Login form validates inputs
- [ ] Error messages display for invalid credentials
```

### Example 2: Updating from Jira

**Jira Issue (after edit):**
```
Description:
Implement user login functionality with 2FA support

Acceptance Criteria:
- [x] User can login with email and password
- [x] Login form validates inputs
- [ ] Error messages display for invalid credentials
- [ ] 2FA code verification works
```

**Backlog Task (after pull):**
```
Description: Implement user login functionality with 2FA support

Acceptance Criteria:
- [x] #1 User can login with email and password
- [x] #2 Login form validates inputs
- [ ] #3 Error messages display for invalid credentials
- [ ] #4 2FA code verification works
```

## Limitations

1. **No partial sync**: AC changes always result in full replacement
2. **Numbering lost**: AC numbers (#1, #2) in Backlog not preserved in Jira
3. **Order dependency**: AC must appear in same order to avoid unnecessary updates
4. **Text-only**: No support for rich formatting in AC text

## Testing

To test AC synchronization:

1. **Create a task with AC**
   ```bash
   backlog task create "Test task" --ac "First criterion" --ac "Second criterion"
   ```

2. **Push to Jira**
   ```bash
   cd backlog-jira
   ./dist/cli.js push task-123
   ```

3. **Verify in Jira**
   - Check that AC appear in description
   - Verify checkbox format

4. **Edit AC in Jira**
   - Change AC text or checked state
   - Add/remove AC

5. **Pull from Jira**
   ```bash
   ./dist/cli.js pull task-123
   ```

6. **Verify in Backlog**
   ```bash
   backlog task task-123
   ```

## Troubleshooting

### AC not appearing in Jira

- Verify the task has AC before pushing
- Check logs for errors during push
- Manually inspect the description field in Jira

### AC not syncing from Jira

- Ensure the section header is exactly "Acceptance Criteria:"
- Check that checkboxes use `- [ ]` or `- [x]` format
- Verify pull command completed without errors

### Duplicate AC

- May occur if AC are manually added both in Backlog and Jira
- Run sync command to reconcile

### Checked state not preserved

- Verify checkbox format: `- [x]` for checked, `- [ ]` for unchecked
- Check logs for AC sync operations during pull
