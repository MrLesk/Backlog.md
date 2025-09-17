---
id: task-265.26
title: Add decision record creation tool
status: Done
assignee:
  - '@agent-claude'
created_date: '2025-09-16T17:23:42.541Z'
updated_date: '2025-09-17 16:25'
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


## Implementation Plan

## Implementation Plan

### Overview
Implement MCP tool for creating Architecture Decision Records (ADRs) by following the established pattern from document-tools, leveraging existing core decision functionality.

### Step-by-Step Implementation Plan

#### Step 1: Create MCP Decision Tools (src/mcp/tools/decision-tools.ts)
- Define decision_create tool following document-tools pattern
- Create comprehensive JSON schema for decision creation
- Support all ADR fields: title, context, decision, consequences, alternatives, status
- Include proper parameter validation and descriptions

#### Step 2: Create MCP Decision Handlers (src/mcp/tools/decision-handlers.ts)
- Implement DecisionHandlers class following DocumentHandlers pattern
- Add handleDecisionCreate method using existing createDecision core functionality
- Include proper error handling and validation
- Return structured response with decision ID and file path

#### Step 3: Register Tools in MCP Servers
- Add decision tools to CLI server (src/cli.ts)
- Add decision tools to stdio server (src/mcp-stdio-server.ts)
- Follow existing registration patterns

#### Step 4: Comprehensive Test Coverage
- Create src/mcp/__tests__/unit/decision-tools.test.ts
- Follow document-tools test pattern
- Test all acceptance criteria scenarios
- Include error handling and validation tests

#### Step 5: Quality Assurance
- Run all tests, type check, lint check
- Verify integration with existing MCP infrastructure

### Files to Create/Modify
**New Files:**
1. src/mcp/tools/decision-tools.ts - MCP tool definitions
2. src/mcp/tools/decision-handlers.ts - Handler implementation  
3. src/mcp/__tests__/unit/decision-tools.test.ts - Test coverage

**Modified Files:**
1. src/cli.ts - Register decision tools in CLI server
2. src/mcp-stdio-server.ts - Register decision tools in stdio server

### Technical Decisions
- Schema Design: Comprehensive JSON schema with all optional fields
- Error Handling: Follow existing MCP error handling patterns
- ID Generation: Use existing generateNextDecisionId() for sequential numbering
- File Storage: Leverage existing saveDecision() for consistent file management
