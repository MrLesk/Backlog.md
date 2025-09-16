---
id: task-265.26
title: Add decision record creation tool
status: To Do
assignee: []
created_date: '2025-09-16T17:23:42.541Z'
labels:
  - mcp
  - tools
  - decisions
  - adr
  - enhancement
dependencies:
  - task-265.22
parent_task_id: task-265
priority: medium
---

## Description

Implement MCP tool for creating Architecture Decision Records (ADRs) and other project decisions, enabling agents to document important project choices and their rationale.

## Overview
The CLI supports decision creation (`decision create <title>`) but this functionality is missing from the MCP server. Decision records are crucial for documenting architectural choices, process decisions, and other important project determinations that agents may need to create.

## Tool to Implement

### decision_create
- **Purpose**: Create Architecture Decision Records (ADRs) or general project decisions
- **Parameters**:
  - title (required): Decision title/summary
  - context (optional): Background context for the decision
  - options (optional): Array of options considered
  - decision (optional): The chosen option and rationale
  - consequences (optional): Expected consequences of the decision
  - status (optional): Decision status (proposed, accepted, deprecated, superseded)
  - tags (optional): Categorization tags
- **Returns**: Created decision ID and file path
- **Format**: Creates structured decision documents following ADR format

## Implementation Details

### ADR Template Structure
```markdown
---
id: decision-001
title: [Decision Title]
status: proposed|accepted|deprecated|superseded
date: YYYY-MM-DD
tags: [architecture, process, tooling]
---

# [Decision Title]

## Status
[proposed | accepted | deprecated | superseded]

## Context
[What is the issue that we're seeing that is motivating this decision or change?]

## Options Considered
1. Option A - [Description and pros/cons]
2. Option B - [Description and pros/cons]
3. Option C - [Description and pros/cons]

## Decision
[What is the change that we're proposing or have agreed to implement?]

## Consequences
[What becomes easier or more difficult to do and any risks introduced by this change?]
```

### File Structure
```
/src/mcp/tools/decision-tools.ts
/src/mcp/tools/decision-handlers.ts
/src/mcp/__tests__/unit/decision-tools.test.ts
```

### Schema Validation
```typescript
{
  type: "object",
  properties: {
    title: { type: "string", minLength: 1, maxLength: 200 },
    context: { type: "string", maxLength: 5000 },
    options: { 
      type: "array", 
      items: { type: "string", maxLength: 1000 },
      maxItems: 10
    },
    decision: { type: "string", maxLength: 5000 },
    consequences: { type: "string", maxLength: 5000 },
    status: { 
      type: "string", 
      enum: ["proposed", "accepted", "deprecated", "superseded"] 
    },
    tags: { 
      type: "array", 
      items: { type: "string", maxLength: 50 },
      maxItems: 10 
    }
  },
  required: ["title"]
}
```

### Core Integration
- Use existing filesystem operations for decision creation
- Follow established file naming and structure conventions
- Generate sequential decision IDs (decision-001, decision-002, etc.)
- Store in `/decisions` directory with proper metadata

### Use Cases for Agents
- Document architectural decisions during development
- Record process changes and rationale
- Create decision templates for team review
- Maintain decision history and evolution

## Testing Requirements
- Test decision creation with minimal and full parameters
- Test proper ADR format generation
- Test file naming and ID generation
- Test validation of input parameters
- Test integration with filesystem operations
- Verify proper markdown structure and frontmatter

## Overview
The CLI supports decision creation (`decision create <title>`) but this functionality is missing from the MCP server. Decision records are crucial for documenting architectural choices, process decisions, and other important project determinations that agents may need to create.

## Tool to Implement

### decision_create
- **Purpose**: Create Architecture Decision Records (ADRs) or general project decisions
- **Parameters**:
  - title (required): Decision title/summary
  - context (optional): Background context for the decision
  - options (optional): Array of options considered
  - decision (optional): The chosen option and rationale
  - consequences (optional): Expected consequences of the decision
  - status (optional): Decision status (proposed, accepted, deprecated, superseded)
  - tags (optional): Categorization tags
- **Returns**: Created decision ID and file path
- **Format**: Creates structured decision documents following ADR format

## Implementation Details

### ADR Template Structure
```markdown
---
id: decision-001
title: [Decision Title]
status: proposed|accepted|deprecated|superseded
date: YYYY-MM-DD
tags: [architecture, process, tooling]
---

# [Decision Title]

## Status
[proposed | accepted | deprecated | superseded]

## Context
[What is the issue that we're seeing that is motivating this decision or change?]

## Options Considered
1. Option A - [Description and pros/cons]
2. Option B - [Description and pros/cons]
3. Option C - [Description and pros/cons]

## Decision
[What is the change that we're proposing or have agreed to implement?]

## Consequences
[What becomes easier or more difficult to do and any risks introduced by this change?]
```

### File Structure
```
/src/mcp/tools/decision-tools.ts
/src/mcp/tools/decision-handlers.ts
/src/mcp/__tests__/unit/decision-tools.test.ts
```

### Schema Validation
```typescript
{
  type: "object",
  properties: {
    title: { type: "string", minLength: 1, maxLength: 200 },
    context: { type: "string", maxLength: 5000 },
    options: { 
      type: "array", 
      items: { type: "string", maxLength: 1000 },
      maxItems: 10
    },
    decision: { type: "string", maxLength: 5000 },
    consequences: { type: "string", maxLength: 5000 },
    status: { 
      type: "string", 
      enum: ["proposed", "accepted", "deprecated", "superseded"] 
    },
    tags: { 
      type: "array", 
      items: { type: "string", maxLength: 50 },
      maxItems: 10 
    }
  },
  required: ["title"]
}
```

### Core Integration
- Use existing filesystem operations for decision creation
- Follow established file naming and structure conventions
- Generate sequential decision IDs (decision-001, decision-002, etc.)
- Store in `/decisions` directory with proper metadata

### Use Cases for Agents
- Document architectural decisions during development
- Record process changes and rationale
- Create decision templates for team review
- Maintain decision history and evolution

## Testing Requirements
- Test decision creation with minimal and full parameters
- Test proper ADR format generation
- Test file naming and ID generation
- Test validation of input parameters
- Test integration with filesystem operations
- Verify proper markdown structure and frontmatter

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 decision_create generates properly structured ADR documents
- [ ] #2 Decisions follow standard ADR template format with frontmatter
- [ ] #3 Sequential ID generation for decisions (decision-001, etc.)
- [ ] #4 Support for all ADR sections (context, options, decision, consequences)
- [ ] #5 Proper file storage in /decisions directory
- [ ] #6 Validation ensures required fields and proper structure
- [ ] #7 Comprehensive test coverage for decision creation scenarios
<!-- AC:END -->
