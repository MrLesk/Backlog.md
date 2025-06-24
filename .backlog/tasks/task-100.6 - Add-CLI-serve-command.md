---
id: task-100.6
title: Add CLI serve command
status: Done
assignee: []
created_date: '2025-06-22'
updated_date: '2025-06-24'
labels: []
dependencies:
  - task-100.2
parent_task_id: task-100
---

## Description

Integrate web server into CLI with new serve command. This will provide users with a simple way to start the web interface from the command line.

## Implementation Details

### CLI Command Requirements

**Command Structure:**

- Add `serve` command to existing CLI in `src/cli.ts`
- Support port configuration option (default: 3000)
- Support host binding option (default: localhost)
- Support browser auto-open option (default: true)

### Command Implementation Requirements

**Core Functionality:**

- Validate Backlog project exists before starting server
- Create and configure BacklogServer instance
- Handle port configuration and fallback
- Provide clear startup messaging
- Support graceful shutdown on Ctrl+C/SIGTERM

**User Experience:**

- Show clear messaging during server startup
- Display actual URL when port differs from requested
- Optionally open browser automatically
- Handle startup errors gracefully

### Browser Integration Requirements

**Cross-Platform Support:**

- Detect platform (macOS, Windows, Linux)
- Use appropriate browser opening command for each platform
- Handle cases where browser opening fails gracefully
- Fallback to showing URL in console if automatic opening fails

### Error Handling

- **Port already in use**: Automatically try next available port (3001, 3002, etc.)
- **No available ports**: Show clear error after trying 10 ports
- **Permission denied**: Suggest using higher port number (>1024)
- **Network issues**: Clear error messages with troubleshooting tips
- **Missing dependencies**: Check for required build artifacts

### Expected User Experience

**Successful Startup:**

- Clear "Starting server..." message
- Port fallback notification if needed
- Server URL with emoji for visibility
- Browser opens automatically (unless disabled)

**Error Cases:**

- Project not initialized: Clear message to run `backlog init`
- No available ports: Error after trying 10 sequential ports
- Permission issues: Helpful suggestions for resolution

### Development Mode

When `NODE_ENV=development`, the server will:

- Provide detailed error messages
- Enable source maps
- Show helpful debugging information

### Production Mode

In production, the server will:

- Serve optimized, minified assets
- Enable caching headers
- Compress responses
- Hide detailed error messages

## Acceptance Criteria

- [x] `backlog serve` starts the web server
- [x] --port option configures starting port
- [x] Automatically finds next available port if requested port is busy
- [x] Shows clear message when using different port than requested
- [x] --open option opens browser automatically with correct URL
- [x] --host option configures binding address
- [x] Server stops gracefully on Ctrl+C
- [x] Clear error message when no ports are available after 10 attempts

## Implementation Notes

Successfully implemented Task 100.6 by integrating the BacklogServer into the CLI with a comprehensive serve command.

### Core Implementation

**CLI Integration**: Added `serve` command to `src/cli.ts` with full integration of the existing BacklogServer class from Task 100.2.

**Command Structure**: Implemented complete command structure with:
- `-p, --port <port>` option (default: 3000)
- `-h, --host <host>` option (default: localhost)  
- `--no-open` flag to disable automatic browser opening
- Comprehensive help documentation

### Key Features Implemented

#### 1. Project Validation
- Validates that current directory contains a valid Backlog project before starting server
- Clear error messaging directing users to run `backlog init` if project not found
- Graceful exit with proper error codes

#### 2. Port Management & Configuration  
- Port validation (1-65535 range) with clear error messages
- Integration with BacklogServer's automatic port failover system
- User notification when different port is used than requested
- Proper error handling for permission issues (ports < 1024)

#### 3. Cross-Platform Browser Opening
- **macOS**: Uses `open` command
- **Windows**: Uses `cmd /c start` command  
- **Linux/Others**: Uses `xdg-open` command
- Graceful fallback when browser opening fails
- Clear instructions to manually open URL if automatic opening fails

#### 4. Graceful Shutdown Handling
- SIGINT (Ctrl+C) and SIGTERM signal handling
- Proper server cleanup before process exit
- Clear shutdown messaging for user feedback

#### 5. Error Handling & User Experience  
- Comprehensive error handling with emoji-enhanced messaging
- Helpful suggestions for common issues (permissions, port conflicts)
- Clear status updates during server startup
- Professional error messages with actionable guidance

#### 6. Server Lifecycle Management
- Proper server start/stop lifecycle using BacklogServer
- Development mode support via NODE_ENV environment variable
- Keep-alive process management to maintain server running
- Integration with existing Core class validation

### Technical Integration

**BacklogServer Integration**: Leverages all features from Task 100.2:
- Automatic port failover (tries up to 10 ports)
- Static file serving and API endpoint routing
- Health check endpoints and error handling
- Configuration management

**Process Management**: 
- Detached browser process spawning with proper cleanup
- Signal handling for graceful shutdown
- Proper error propagation and exit codes

### User Experience

**Startup Flow**:
1. 🚀 Starting Backlog.md server...
2. ✅ Server running at http://localhost:3000
3. 🌐 Opening browser...
4. Press Ctrl+C to stop the server

**Error Scenarios**:
- Project validation errors with clear next steps
- Port validation with range information  
- Permission errors with helpful suggestions
- Browser opening fallbacks with manual instructions

### Testing & Verification

The implementation has been tested with:
- Command help functionality (`backlog serve --help`)
- Integration with existing server test suite (all tests passing)
- Command structure validation
- Option parsing and validation

### Ready for Integration

The serve command is fully implemented and ready for:
- Task 100.7: Asset bundling integration  
- Task 100.8: Documentation and examples
- Production use with embedded assets

### Files Modified

- `src/cli.ts` - Added serve command, browser opening, and server integration (130+ lines added)
- Integration maintains existing CLI architecture and patterns
- Full compatibility with existing BacklogServer implementation

The CLI serve command provides a production-ready interface for starting the Backlog.md web server with excellent user experience, comprehensive error handling, and cross-platform compatibility.
