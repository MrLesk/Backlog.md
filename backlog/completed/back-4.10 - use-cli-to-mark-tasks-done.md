---
id: BACK-4.10
title: 'CLI: enforce Agents to use backlog CLI to mark tasks Done'
status: Done
assignee: []
reporter: @MrLesk
created_date: '2025-06-08'
updated_date: '2025-06-09'
labels:
  - cli
  - agents
dependencies: []
parent_task_id: task-4
---

## Description

Update agent guidelines so that after implementing and testing a task, they use the backlog CLI to set the task status to **Done**.

## Acceptance Criteria
- [x] Documentation instructs agents to run `backlog task edit <task-id> --status Done` after testing.
- [x] Example usage included in AGENTS.md, CLAUDE.md and .cursorrules files

## Implementation Notes

**Task 4.10 Implementation Summary:**

1. **Review Found Complete Implementation:**
   - All agent guidance files already included the CLI command instruction
   - Implementation was found to be complete during merge conflict resolution

2. **Documentation Updates Applied:**
   - **AGENTS.md**: Added CLI command instruction in guidelines section and Definition of Done
   - **CLAUDE.md**: Added CLI command instruction in AI Agent Integration section  
   - **.cursorrules**: Added CLI command instruction in Task Management section

3. **Consistent Command Format:**
   - All files now include the same command: `backlog task edit <task-id> --status Done`
   - Command is presented in code blocks for clarity
   - Instructions emphasize using this after implementing and testing tasks

4. **Merge Conflict Resolution:**
   - Resolved conflict in AGENTS.md by combining task 4.10 implementation with Definition of Done from main
   - Ensured CLI command appears both in guidelines and Definition of Done for consistency

5. **Quality Assurance:**
   - All 105 tests pass
   - Code passes all Biome linting and formatting checks  
   - All agent guidance files now consistently instruct using the Backlog CLI

All AI agents working with this project are now properly guided to mark tasks as Done using the CLI command, ensuring consistent workflow and proper task status management.
