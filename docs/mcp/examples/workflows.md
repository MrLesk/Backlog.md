# MCP Workflow Examples

This document provides practical examples of using the Backlog.md MCP server with Claude Code for common development workflows.

## Getting Started Examples

### Basic Task Creation

**Prompt:**
```
Create a new task for implementing user authentication with the following requirements:
- Support for email/password login
- Password reset functionality
- Session management
- High priority, assign to the backend team
```

**Claude's Actions:**
1. Uses `task_create` tool with structured data
2. Sets appropriate labels (`backend`, `authentication`, `security`)
3. Creates acceptance criteria
4. Returns task ID for reference

**Result:**
```
✅ Created task-347: "Implement user authentication system"
- Priority: High
- Assigned to: backend-team
- Labels: backend, authentication, security
- Acceptance criteria: 4 items defined
```

### Checking Project Status

**Prompt:**
```
Show me the current status of our project. What tasks are in progress and what's coming up next?
```

**Claude's Actions:**
1. Uses `board_view` tool to get kanban state
2. Uses `task_list` with status filters
3. Analyzes task distribution and identifies blockers

**Result:**
```
📊 Project Status Overview:

In Progress (3 tasks):
- task-342: Database migration (john.doe)
- task-345: API rate limiting (jane.smith)
- task-346: Frontend routing (bob.wilson)

Up Next (5 tasks):
- task-347: User authentication (High priority)
- task-348: Email notifications (Medium)
- task-349: File upload feature (Medium)

⚠️ Potential blockers:
- task-342 has been in progress for 5 days
```

## Development Workflows

### Bug Triage Workflow

**Scenario:** A user reports a critical bug

**Prompt:**
```
A user reported that they can't log in after changing their password. The error message says "Invalid credentials" even with the correct password. This is affecting multiple users. Help me create appropriate tasks for this.
```

**Claude's Workflow:**
1. **Analysis**: Identifies this as a critical authentication bug
2. **Task Creation**: Creates main bug fix task
3. **Related Tasks**: Suggests investigation and testing tasks
4. **Priority Assignment**: Sets as high priority with urgent labels

**Generated Tasks:**
```
🐛 task-350: "Fix login failure after password change" (Critical)
- Labels: bug, authentication, critical, urgent
- Assignee: backend-team
- Acceptance Criteria:
  - Users can log in immediately after password change
  - No false "Invalid credentials" errors
  - Password reset flow works correctly
  - Security audit confirms no vulnerabilities

🔍 task-351: "Investigate password change authentication flow"
- Labels: investigation, backend
- Parent: task-350
- Description: Debug the authentication flow to identify root cause

🧪 task-352: "Add automated tests for password change flow"
- Labels: testing, automation
- Dependencies: task-350
- Description: Prevent regression of this critical functionality
```

### Feature Planning Workflow

**Prompt:**
```
We want to add real-time notifications to our application. Users should see notifications for:
- New messages
- Task assignments
- System alerts
- Friend requests

Break this down into implementable tasks and estimate complexity.
```

**Claude's Planning Process:**
1. **Feature Breakdown**: Analyzes requirements and identifies components
2. **Technical Considerations**: Identifies WebSocket, database, and UI needs
3. **Task Sequencing**: Orders tasks by dependencies
4. **Complexity Estimation**: Provides story point estimates

**Generated Task Breakdown:**
```
🚀 Epic: Real-time Notifications System

Backend Tasks:
📊 task-353: "Design notification system architecture" (5 pts)
- Labels: backend, architecture, design
- Description: Define WebSocket strategy, data models, and API endpoints

🔧 task-354: "Implement notification database schema" (3 pts)
- Labels: backend, database
- Dependencies: task-353

🌐 task-355: "Build WebSocket notification service" (8 pts)
- Labels: backend, websockets, realtime
- Dependencies: task-354

📡 task-356: "Create notification REST API endpoints" (5 pts)
- Labels: backend, api
- Dependencies: task-354

Frontend Tasks:
🎨 task-357: "Design notification UI components" (3 pts)
- Labels: frontend, ui, design

💻 task-358: "Implement WebSocket client connection" (5 pts)
- Labels: frontend, websockets
- Dependencies: task-355

🔔 task-359: "Build notification display components" (5 pts)
- Labels: frontend, components
- Dependencies: task-357, task-358

Integration & Testing:
🧪 task-360: "Add notification integration tests" (3 pts)
- Labels: testing, integration
- Dependencies: task-356, task-359

🚀 task-361: "Deploy and monitor notification system" (2 pts)
- Labels: deployment, monitoring
- Dependencies: task-360

📈 Total Estimated Effort: 39 story points (approximately 2-3 sprints)
```

## Sprint Planning Examples

### Sprint Planning Session

**Prompt:**
```
Help me plan our next 2-week sprint. We have 3 developers:
- Alice: Full-stack, 40h available, strong in React/Node.js
- Bob: Backend specialist, 35h available, expert in databases
- Carol: Frontend specialist, 40h available, great with UI/UX

We typically handle 25-30 story points per sprint. Focus on the user authentication epic and high-priority bugs.
```

**Claude's Planning Process:**
1. **Capacity Analysis**: Calculates team velocity and availability
2. **Task Assignment**: Matches tasks to developer strengths
3. **Dependency Management**: Ensures logical task ordering
4. **Risk Assessment**: Identifies potential bottlenecks

**Sprint Plan Output:**
```
📅 Sprint 23 Plan (Sep 15 - Sep 29, 2025)

👥 Team Capacity: 115 hours (29 story points estimated)

🎯 Sprint Goals:
1. Complete user authentication system foundation
2. Resolve all critical bugs
3. Improve system reliability and testing

📋 Sprint Backlog:

Alice (Full-stack - 10 story points):
- task-347: Implement user authentication system (8 pts)
- task-352: Add automated tests for password change (3 pts)
- Buffer task: task-359: Build notification components (3 pts)

Bob (Backend - 9 story points):
- task-350: Fix login failure after password change (5 pts)
- task-354: Implement notification database schema (3 pts)
- task-356: Create notification REST API endpoints (3 pts)

Carol (Frontend - 8 story points):
- task-357: Design notification UI components (3 pts)
- task-358: Implement WebSocket client connection (5 pts)
- Buffer task: task-340: Improve dashboard performance (2 pts)

🎯 Sprint Commitment: 27 story points
⚡ Buffer Tasks: 5 additional story points available

⚠️ Risks & Dependencies:
- task-347 blocks several authentication features
- task-350 is critical and may need pair programming
- WebSocket implementation (task-358) is new technology for team

📊 Success Metrics:
- All critical bugs resolved
- Authentication system 80% complete
- Zero production incidents
- Test coverage maintained above 85%
```

## Code Review Integration

### PR Review Workflow

**Prompt:**
```
I just opened PR #456 for the user authentication system. It implements OAuth2 login and password reset functionality. Update the related tasks and help me create a review checklist.
```

**Claude's Actions:**
1. **Task Linking**: Connects PR to related tasks
2. **Status Updates**: Updates task statuses to reflect progress
3. **Review Checklist**: Creates comprehensive review criteria

**Result:**
```
🔗 PR #456 linked to tasks:
- task-347: "Implement user authentication system" → In Review
- task-348: "Add OAuth2 integration" → In Review
- task-349: "Implement password reset flow" → In Review

📝 Code Review Checklist for PR #456:

Security Review:
- [ ] OAuth2 tokens stored securely
- [ ] Password hashing uses bcrypt with proper salt rounds
- [ ] No credentials logged or exposed in error messages
- [ ] JWT tokens have appropriate expiration times
- [ ] Rate limiting implemented for auth endpoints

Functionality:
- [ ] All acceptance criteria met for linked tasks
- [ ] Password reset email template works correctly
- [ ] OAuth2 flow handles errors gracefully
- [ ] Session management works across browser restarts

Code Quality:
- [ ] Unit tests cover all new authentication methods
- [ ] Integration tests validate complete auth flows
- [ ] Code follows established patterns and conventions
- [ ] Error handling is consistent and informative
- [ ] Documentation updated for new endpoints

Database:
- [ ] Migration scripts run cleanly
- [ ] User data model changes are backward compatible
- [ ] Proper indexes added for performance
- [ ] Data validation prevents invalid states
```

## Daily Standup Support

### Standup Report Generation

**Prompt:**
```
Generate a standup report for today showing what each team member accomplished yesterday, what they're working on today, and any blockers.
```

**Claude's Process:**
1. **Task Analysis**: Reviews recent task updates and assignments
2. **Progress Tracking**: Identifies completed vs. in-progress work
3. **Blocker Detection**: Finds tasks that are overdue or stuck

**Standup Report:**
```
📅 Daily Standup - September 15, 2025

👨‍💻 Alice (alice@company.com):
Yesterday:
✅ Completed task-342: Database migration
✅ Started task-347: User authentication implementation (40% done)

Today:
🔧 Continue task-347: Focus on OAuth2 integration
🎯 Code review for PR #445 (API rate limiting)

Blockers: None

👨‍💻 Bob (bob@company.com):
Yesterday:
✅ Fixed task-350: Login failure after password change
⏳ Made progress on task-354: Notification schema (70% done)

Today:
🔧 Complete task-354: Finish database schema
🚀 Deploy task-350 fix to production

Blockers: None

👩‍💻 Carol (carol@company.com):
Yesterday:
✅ Completed task-357: Notification UI components design
⏳ Started task-358: WebSocket client (30% done)

Today:
🔧 Continue task-358: WebSocket implementation
🐛 Investigate task-360: Dashboard performance issue

Blockers: ⚠️ Waiting for API endpoints (task-356) to test WebSocket integration

🚨 Team Blockers & Risks:
- Carol blocked on WebSocket testing until Bob completes API endpoints
- task-360 dashboard issue may be more complex than estimated
- PR #456 needs security review before merge

📊 Sprint Progress:
- Completed: 12/27 story points (44%)
- In Progress: 8 story points
- Remaining: 7 story points
- On track for sprint goal ✅
```

## Error Handling Examples

### Handling Common Issues

**Scenario 1: Task Creation Fails**

**Prompt:**
```
Create a task for fixing the user registration bug
```

**Error Response:**
```
❌ Task creation failed: Title too vague for productive task management

Let me help you create a more specific task. Could you provide:
1. What specific behavior is incorrect?
2. What should happen instead?
3. How critical is this issue?
4. Are there error messages or logs?

Example: "Fix user registration validation - email field accepts invalid formats, causing database errors"
```

**Scenario 2: Invalid Task Update**

**Prompt:**
```
Update task-999 to mark it as complete
```

**Error Response:**
```
❌ Task not found: task-999

Available actions:
- List recent tasks: "Show me the last 10 tasks"
- Search for tasks: "Find tasks related to [keyword]"
- View board status: "Show current board state"

Would you like me to help you find the correct task?
```

## Advanced Workflow Patterns

### Dependency Management

**Prompt:**
```
We have a complex feature that requires multiple teams. Create tasks for implementing a payment system with proper dependencies.
```

**Generated Dependency Chain:**
```
💳 Payment System Implementation

Foundation (Week 1):
📋 task-400: "Design payment system architecture"
  ↓
🗄️ task-401: "Create payment database schema"
  ↓
🔧 task-402: "Implement core payment models"

Integration (Week 2):
💳 task-403: "Integrate Stripe payment API"
  Depends on: task-402
  ↓
🔒 task-404: "Add payment security validation"
  Depends on: task-403
  ↓
📡 task-405: "Create payment REST endpoints"
  Depends on: task-404

Frontend (Week 2-3):
🎨 task-406: "Design payment UI components"
  Can start in parallel with backend work
  ↓
💻 task-407: "Implement checkout flow"
  Depends on: task-405, task-406
  ↓
📱 task-408: "Add payment confirmation screens"
  Depends on: task-407

Testing & Deploy (Week 3):
🧪 task-409: "Payment integration testing"
  Depends on: task-408
  ↓
🚀 task-410: "Deploy to staging and validate"
  Depends on: task-409

⚡ Critical Path: 400 → 401 → 402 → 403 → 404 → 405 → 407 → 408 → 409 → 410
📅 Estimated Timeline: 3 weeks with parallel frontend work
```

These examples demonstrate how Claude Code with MCP integration can streamline your development workflow, from simple task creation to complex project planning and team coordination.