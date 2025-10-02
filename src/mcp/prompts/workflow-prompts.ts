import type { McpServer } from "../server.ts";
import type { GetPromptResult, McpPromptHandler } from "../types.ts";

interface TaskCreationArgs {
	projectContext?: string;
	userRequirement?: string;
}

interface SprintPlanningArgs {
	boardState?: string;
	capacity?: string;
	priorities?: string;
}

interface CodeReviewArgs {
	taskId?: string;
	prUrl?: string;
	changes?: string;
}

interface DailyStandupArgs {
	date?: string;
	assignee?: string;
}

export const taskCreationPrompt: McpPromptHandler = {
	name: "task_creation_workflow",
	description: "Guided task creation with context gathering and structured output",
	arguments: [
		{
			name: "projectContext",
			description: "Current project state, goals, and technical context",
			required: false,
		},
		{
			name: "userRequirement",
			description: "User requirement, feature request, or problem description",
			required: true,
		},
	],
	handler: async (args: Record<string, unknown>): Promise<GetPromptResult> => {
		const { projectContext, userRequirement } = args as TaskCreationArgs;

		if (!userRequirement) {
			throw new Error("userRequirement is required for task creation workflow");
		}

		return {
			description: "Task creation workflow template with context analysis",
			messages: [
				{
					role: "user",
					content: {
						type: "text",
						text: `You are a task creation specialist for backlog.md projects. Create a comprehensive task following these steps:

**Context Analysis:**
${projectContext ? `Project Context: ${projectContext}` : "No project context provided - analyze the repository structure and recent commits to understand the project."}

User Requirement: ${userRequirement}

**Task Creation Process:**

1. **Title Generation**: Create a concise, action-oriented title (max 60 characters)
   - Use imperative mood (e.g., "Add", "Fix", "Implement", "Update")
   - Be specific about what will be accomplished

2. **Description Writing**: Write a clear description including:
   - What needs to be built/fixed/changed
   - Why this change is needed
   - Any relevant technical details or constraints

3. **Acceptance Criteria**: Create specific, testable criteria:
   - Use format: "- [ ] Criterion description"
   - Make each criterion atomic and measurable
   - Include both functional and non-functional requirements

4. **Labels Assignment**: Suggest relevant labels:
   - Technical labels: frontend, backend, api, ui, database, etc.
   - Priority labels: high, medium, low
   - Type labels: feature, bug, enhancement, refactor, docs, test

5. **Implementation Guidance**: Provide:
   - Key files that may need modification
   - Dependencies or prerequisites
   - Potential challenges or considerations

**Output Format:**
Provide the task in this exact format:

\`\`\`
Title: [Generated title]

Description:
[Detailed description]

Acceptance Criteria:
- [ ] [Criterion 1]
- [ ] [Criterion 2]
- [ ] [Criterion N]

Labels: [comma-separated labels]

Implementation Notes:
- Key files: [list of files]
- Dependencies: [any dependencies]
- Considerations: [technical considerations]
\`\`\`

Focus on creating a task that is clear, actionable, and follows backlog.md best practices.`,
					},
				},
			],
		};
	},
};

export const sprintPlanningPrompt: McpPromptHandler = {
	name: "sprint_planning_workflow",
	description: "Sprint planning workflow with board state analysis and capacity assessment",
	arguments: [
		{
			name: "boardState",
			description: "Current board state with task counts and status distribution",
			required: false,
		},
		{
			name: "capacity",
			description: "Team capacity and availability for the sprint",
			required: false,
		},
		{
			name: "priorities",
			description: "Business priorities and goals for the upcoming sprint",
			required: false,
		},
	],
	handler: async (args: Record<string, unknown>): Promise<GetPromptResult> => {
		const { boardState, capacity, priorities } = args as SprintPlanningArgs;

		return {
			description: "Sprint planning workflow template with systematic task selection",
			messages: [
				{
					role: "user",
					content: {
						type: "text",
						text: `You are a sprint planning facilitator for backlog.md projects. Guide the team through sprint planning:

**Current State Analysis:**
${boardState ? `Board State: ${boardState}` : "Analyze the current board state - review 'To Do', 'In Progress', and 'Done' columns to understand current workload."}
${capacity ? `Team Capacity: ${capacity}` : "Assess team capacity - consider team size, availability, and velocity from previous sprints."}
${priorities ? `Business Priorities: ${priorities}` : "Identify business priorities - review stakeholder requirements and roadmap goals."}

**Sprint Planning Process:**

1. **Sprint Goal Definition**:
   - Based on priorities, define 1-2 clear sprint goals
   - Ensure goals are specific and measurable
   - Align with overall product objectives

2. **Capacity Planning**:
   - Calculate available person-hours for the sprint
   - Account for meetings, support, and buffer time
   - Consider any planned time off or external commitments

3. **Task Selection Strategy**:
   - Review 'To Do' column for ready tasks
   - Prioritize tasks that support sprint goals
   - Balance feature work, technical debt, and bug fixes
   - Ensure tasks have clear acceptance criteria

4. **Task Sequencing**:
   - Identify dependencies between tasks
   - Plan task order to minimize blocking
   - Consider skill distribution across team members

5. **Risk Assessment**:
   - Identify potential blockers or unknowns
   - Plan mitigation strategies
   - Ensure knowledge sharing for critical tasks

6. **Sprint Commitment**:
   - Select tasks that fit within capacity
   - Leave 20% buffer for unexpected work
   - Confirm team agreement on the plan

**Output Format:**
Create a sprint plan with:

\`\`\`
Sprint Goals:
1. [Primary goal]
2. [Secondary goal if applicable]

Selected Tasks:
- [Task ID] - [Title] (Estimated effort: X hours)
- [Task ID] - [Title] (Estimated effort: X hours)
[Continue for all selected tasks]

Task Sequence:
Week 1: [List of tasks for first week]
Week 2: [List of tasks for second week]

Risk Mitigation:
- [Risk 1]: [Mitigation strategy]
- [Risk 2]: [Mitigation strategy]

Total Estimated Effort: X hours
Available Capacity: Y hours
Buffer: Z hours (Y-X)
\`\`\`

Focus on realistic planning that balances ambition with achievability.`,
					},
				},
			],
		};
	},
};

export const codeReviewPrompt: McpPromptHandler = {
	name: "code_review_workflow",
	description: "Code review integration with task progress tracking",
	arguments: [
		{
			name: "taskId",
			description: "The task ID being implemented",
			required: true,
		},
		{
			name: "prUrl",
			description: "Pull request URL for the implementation",
			required: false,
		},
		{
			name: "changes",
			description: "Summary of changes made in the PR",
			required: false,
		},
	],
	handler: async (args: Record<string, unknown>): Promise<GetPromptResult> => {
		const { taskId, prUrl, changes } = args as CodeReviewArgs;

		if (!taskId) {
			throw new Error("taskId is required for code review workflow");
		}

		return {
			description: "Code review workflow template linking reviews with task progress",
			messages: [
				{
					role: "user",
					content: {
						type: "text",
						text: `You are a code review facilitator for backlog.md projects. Guide the review process:

**Review Context:**
Task: ${taskId}
${prUrl ? `Pull Request: ${prUrl}` : "Pull Request URL not provided - locate the relevant PR for this task."}
${changes ? `Changes Summary: ${changes}` : "Review the PR description and diff to understand the changes made."}

**Code Review Process:**

1. **Task Alignment Check**:
   - Verify the implementation addresses all acceptance criteria
   - Confirm the changes match the task description
   - Check if any criteria are missing or partially implemented

2. **Code Quality Review**:
   - Architecture and design patterns alignment
   - Code readability and maintainability
   - Proper error handling and edge cases
   - Performance considerations
   - Security best practices

3. **Testing Verification**:
   - Unit test coverage for new functionality
   - Integration tests for API changes
   - Manual testing for UI changes
   - Regression testing for existing features

4. **Documentation Assessment**:
   - Code comments for complex logic
   - API documentation updates
   - User-facing documentation updates
   - README updates if needed

5. **Task Progress Update**:
   - Update implementation notes in the task
   - Add any discovered technical debt
   - Note any scope changes or additions

**Review Checklist:**
Generate a customized checklist based on the task and changes:

\`\`\`
Code Review Checklist for ${taskId}:

Task Alignment:
- [ ] All acceptance criteria addressed
- [ ] Implementation matches task description
- [ ] No missing functionality

Code Quality:
- [ ] Follows project coding standards
- [ ] Proper error handling implemented
- [ ] No obvious security issues
- [ ] Performance is acceptable

Testing:
- [ ] Adequate test coverage
- [ ] All tests pass
- [ ] Manual testing completed
- [ ] No regressions introduced

Documentation:
- [ ] Code is well-commented
- [ ] Documentation updated
- [ ] Examples provided where needed

Task Management:
- [ ] Implementation notes updated
- [ ] Task ready for completion
- [ ] Follow-up tasks identified
\`\`\`

**Post-Review Actions:**
1. Update task implementation notes with review findings
2. Create follow-up tasks for any technical debt
3. Mark task as ready for completion once approved
4. Document any lessons learned for future tasks

Focus on maintaining code quality while ensuring task completion.`,
					},
				},
			],
		};
	},
};

export const dailyStandupPrompt: McpPromptHandler = {
	name: "daily_standup_workflow",
	description: "Daily standup template for task progress review and blocker identification",
	arguments: [
		{
			name: "date",
			description: "Date for the standup meeting",
			required: false,
		},
		{
			name: "assignee",
			description: "Team member or filter for specific assignee",
			required: false,
		},
	],
	handler: async (args: Record<string, unknown>): Promise<GetPromptResult> => {
		const { date, assignee } = args as DailyStandupArgs;

		return {
			description: "Daily standup workflow template for systematic progress review",
			messages: [
				{
					role: "user",
					content: {
						type: "text",
						text: `You are a standup facilitator for backlog.md projects. Guide the daily standup:

**Standup Context:**
${date ? `Date: ${date}` : `Date: ${new Date().toISOString().split("T")[0]}`}
${assignee ? `Focus: ${assignee}` : "Team-wide standup covering all active work"}

**Standup Process:**

1. **Board State Review**:
   - Check 'In Progress' column for active tasks
   - Identify tasks that should be moved to 'Done'
   - Look for tasks stuck in progress longer than expected

2. **Progress Updates**:
   - For each in-progress task, assess completion percentage
   - Identify work completed since last standup
   - Estimate remaining effort for active tasks

3. **Blocker Identification**:
   - Technical blockers (dependencies, technical challenges)
   - Process blockers (waiting for reviews, approvals)
   - Resource blockers (missing information, access)
   - External blockers (third-party dependencies)

4. **Next Steps Planning**:
   - Identify tasks to be started today
   - Plan handoffs between team members
   - Schedule any needed discussions or reviews

5. **Task Updates**:
   - Move completed tasks to 'Done'
   - Update progress notes on active tasks
   - Create follow-up tasks if needed

**Standup Structure:**

\`\`\`
Daily Standup - ${date ? date : new Date().toISOString().split("T")[0]}

COMPLETED WORK:
Tasks to move to 'Done':
- [Task ID] - [Title] - [Completion notes]

ACTIVE WORK:
In Progress tasks:
- [Task ID] - [Title] - [Progress %] - [Next steps]
- [Task ID] - [Title] - [Progress %] - [Next steps]

BLOCKERS:
- [Blocker description] - [Owner] - [Resolution plan]
- [Blocker description] - [Owner] - [Resolution plan]

TODAY'S PLAN:
Starting today:
- [Task ID] - [Title] - [Assigned to]
- [Task ID] - [Title] - [Assigned to]

FOLLOW-UP ACTIONS:
- [Action item] - [Owner] - [Due date]
- [Action item] - [Owner] - [Due date]
\`\`\`

**Post-Standup Actions:**
1. Update task statuses in backlog
2. Create blocker resolution tasks if needed
3. Schedule follow-up meetings for complex discussions
4. Update task assignees and priorities as needed

Focus on maintaining team alignment and removing impediments to progress.`,
					},
				},
			],
		};
	},
};

export function registerWorkflowPrompts(server: McpServer): void {
	server.addPrompt(taskCreationPrompt);
	server.addPrompt(sprintPlanningPrompt);
	server.addPrompt(codeReviewPrompt);
	server.addPrompt(dailyStandupPrompt);
}
