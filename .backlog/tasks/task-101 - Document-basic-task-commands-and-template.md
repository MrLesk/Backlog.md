---
id: task-101
title: Document basic Backlog.md CLI commands and required task sections
status: To Do
assignee: []
labels:
  - documentation
  - agents
dependencies: []
---

## Description

Update the agent instructions so that new contributors only learn the three
essential commands for working with tasks: **create**, **edit** and **view**.
The documentation should clearly list the options for these commands and
stress that every task file must contain a description, acceptance criteria and
an implementation plan. Guidance should focus on defining goals and expectations
without describing implementation details.

## Acceptance Criteria

- [ ] AGENTS file lists `backlog task create`, `backlog task edit` and
      `backlog task view` with their available options
- [ ] Instructions state that each task must include a description,
      acceptance criteria and an implementation plan
- [ ] Guidelines emphasize writing the **what** rather than the **how**
- [ ] Agents are reminded that tasks are implemented by others and should be
      small enough for a single PR, using subtasks for bigger features

## Implementation Plan

1. Review the current AGENTS documentation and related guidelines
2. Add a concise section describing the create, edit and view commands with all
   supported options
3. Document the mandatory task sections: description, acceptance criteria and
   implementation plan
4. Include a note that tasks should focus on goals and expectations, leaving the
   implementation details to other agents
5. Suggest using subtasks to break down large objectives so that each pull
   request remains small and focused
