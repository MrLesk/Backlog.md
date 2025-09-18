---
id: task-265.06
title: Create MCP prompts for workflow templates
status: Done
assignee: []
created_date: '2025-09-13 18:52'
updated_date: '2025-09-14 00:50'
labels:
  - mcp
  - prompts
  - workflow
dependencies: []
parent_task_id: task-265
---

## Description

Implement MCP prompts that provide AI agents with structured templates for common backlog.md workflows like task creation, sprint planning, and code reviews.

### Implementation Details

**Prompt Structure (`/src/mcp/prompts/workflow-prompts.ts`):**
```typescript
import { Prompt } from '@modelcontextprotocol/sdk';

export const taskCreationPrompt: Prompt = {
  name: 'task_creation_workflow',
  description: 'Guided task creation with context gathering',
  arguments: [
    { name: 'projectContext', description: 'Current project state and goals' },
    { name: 'userRequirement', description: 'User requirement or feature request' }
  ]
};
```

**Template Workflows:**

**1. Task Creation Prompt:**
```
Given the project context: {projectContext}
And user requirement: {userRequirement}

Create a comprehensive task following backlog.md best practices:

1. Analyze the requirement for:
   - Technical complexity
   - Dependencies on existing tasks
   - Required acceptance criteria
   - Appropriate labels and priority

2. Generate task structure:
   - Clear, actionable title
   - Detailed description with context
   - Specific acceptance criteria (3-5 items)
   - Suggested labels based on project patterns
   - Priority level (high/medium/low)

3. Consider breaking down into sub-tasks if complex
4. Identify potential blockers or dependencies

Use the task_create tool to implement the task.
```

**2. Sprint Planning Prompt:**
```
Based on current board state: {boardState}
And sprint capacity: {sprintCapacity}

Plan an effective sprint:

1. Review current "To Do" tasks
2. Assess task priorities and dependencies
3. Estimate effort and capacity
4. Create task sequences for parallel work
5. Identify potential blockers

Use board_view and sequence_create tools to organize the sprint.
```

**3. Code Review Integration:**
```typescript
export const codeReviewPrompt: Prompt = {
  name: 'code_review_integration',
  description: 'Link code reviews with task progress',
  arguments: [
    { name: 'taskId', description: 'Task being reviewed' },
    { name: 'reviewContext', description: 'Code review details' }
  ]
};
```

**4. Daily Standup Template:**
```
Generate standup report for: {date}

1. Review tasks "In Progress" status
2. Identify completed tasks since last standup
3. Flag any blocked tasks or issues
4. Suggest next priorities

Use task_list tool to gather current status data.
```

**Prompt Integration:**
- Prompts guide agents through multi-step workflows
- Include parameter schemas for structured input
- Reference available MCP tools for execution
- Provide best practice guidance based on backlog.md patterns

**Context-Aware Templates:**
- Include current project state in prompt context
- Reference existing task patterns and naming conventions
- Adapt to project-specific labels and statuses
- Guide agents toward consistent task creation patterns

**Workflow Orchestration:**
- Prompts can chain multiple tool calls
- Guide agents through decision trees
- Provide fallback strategies for common issues
- Include validation steps and error handling

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Task creation prompt with context gathering
- [ ] #2 Sprint planning workflow template
- [ ] #3 Code review integration prompt
- [ ] #4 Daily standup template prompt
- [ ] #5 Prompts include parameter schemas
- [ ] #6 Templates guide agents through best practices
<!-- AC:END -->
