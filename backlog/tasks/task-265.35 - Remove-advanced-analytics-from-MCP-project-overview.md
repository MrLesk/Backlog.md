---
id: task-265.35
title: Remove advanced analytics from MCP project overview
status: Done
assignee:
  - '@agent-claude'
created_date: '2025-09-23 14:02'
updated_date: '2025-09-23 15:58'
labels:
  - mcp
  - architecture
  - feature-removal
dependencies: []
parent_task_id: task-265
priority: high
---

## Description

Remove unauthorized advanced analytics features from MCP project overview that CLI overview command does not provide.

Issue: MCP project overview handler has extensive analytics features (velocity, trends, quality metrics) that the CLI overview command does not have. This violates MCP wrapper principle.

Features to Remove:
1. Velocity calculations and trends
2. Quality metrics analysis
3. Advanced timeframe analysis
4. Team performance metrics
5. Any analytics beyond basic task counts

Files to Modify:
- src/mcp/tools/project-overview-handlers.ts
- src/mcp/tools/project-overview-tool.ts

Keep Only:
- Basic task statistics that CLI overview shows
- Simple task counts by status
- Basic project health metrics

Acceptance Criteria:
- MCP project overview provides same data as CLI overview command
- No advanced analytics features remain
- Response format simplified to match CLI capabilities
## Implementation Plan

Synthesized Implementation Plan

Phase 1: Analysis and Preparation
1. Compare CLI vs MCP Features - Read src/cli/commands/overview.ts to identify authorized features, Read src/core/project-overview.ts to understand Core API methods, Document exact feature parity requirements
2. Audit Current MCP Implementation - Analyze src/mcp/tools/project-overview-handlers.ts for unauthorized features, Identify all advanced analytics to be removed, Map dependencies that may become orphaned

Phase 2: Feature Removal (Backend Architecture Recommendations)  
3. Remove Unauthorized Analytics - Strip velocity calculations and trends, Remove quality metrics analysis, Eliminate advanced timeframe analysis, Remove team performance metrics, Remove recommendation engine integration, Remove sophisticated caching infrastructure, Remove security filtering and audit logging
4. Core API Integration - Replace custom analytics with Core API calls, Use core.getTaskStatistics() exclusively, Ensure no reimplementation of Core functionality

Phase 3: Schema and Interface Updates (Code Review Recommendations)
5. Simplify Tool Schema - Update src/mcp/tools/project-overview-tool.ts schema, Remove parameters not supported by CLI overview, Align exactly with CLI command parameters  
6. Type System Cleanup - Update type definitions to match CLI capabilities, Remove complex analytics types, Use TaskStatistics interface from core

Phase 4: Implementation and Testing
7. Implement Simplified Handler - Rewrite handler to only provide CLI-equivalent features, Keep only: statusCounts, priorityCounts, completionPercentage, draftCount, recentActivity, projectHealth, Remove all advanced features identified in audits
8. Feature Parity Testing - Add automated tests comparing MCP output with CLI output, Verify MCP response is strict subset of CLI capabilities, Test error handling and validation

Phase 5: Quality Assurance  
9. Dependency Cleanup - Remove orphaned utility files if no longer needed, Update imports and dependencies, Clean up test files for removed features
10. Final Validation - Run complete test suite, Verify architectural compliance, Check no advanced analytics remain, Confirm feature parity with CLI overview

Acceptance Criteria Implementation: MCP project overview provides same data as CLI overview command, No advanced analytics features remain, Response format simplified to match CLI capabilities

Critical Constraints: Must use Core APIs only (no custom implementations), No features beyond CLI scope, Maintain pure wrapper architecture, All operations through Core filesystem abstraction


## Implementation Notes

Implementation Summary: Successfully removed unauthorized advanced analytics features from MCP project overview to restore CLI feature parity. Changed handlers to use Core API loadAllTasksForStatistics() and getTaskStatistics() exclusively. Removed complex schema, caching, security filtering, audit logging. Simplified tool to match CLI overview command exactly. All unauthorized features removed: velocity, quality, team, capacity, trends, recommendations, insights. MCP now provides strict subset of CLI capabilities as required by architecture.
