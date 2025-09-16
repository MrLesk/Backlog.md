#!/bin/bash

# Backlog.md MCP Development Setup Script
# Creates a self-contained, workspace-isolated MCP development environment

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Helper functions
log_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

log_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

log_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

log_error() {
    echo -e "${RED}❌ $1${NC}"
}

log_step() {
    echo -e "${BLUE}🔧 $1${NC}"
}

# Check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Generate workspace ID
generate_workspace_id() {
    if command_exists uuidgen; then
        uuidgen | tr '[:upper:]' '[:lower:]' | head -c 8
    else
        # Fallback: use timestamp + random
        echo "$(date +%s)$(( RANDOM % 1000 ))" | head -c 8
    fi
}

# Find available port for workspace isolation
find_available_port() {
    local start_port=8080
    local max_attempts=50

    for ((port = start_port; port < start_port + max_attempts; port++)); do
        if ! netstat -tuln 2>/dev/null | grep -q ":${port} " && ! lsof -Pi :${port} >/dev/null 2>&1; then
            echo "$port"
            return
        fi
    done

    # Fallback: use random port in higher range
    echo $((9000 + RANDOM % 1000))
}

# Check if workspace is already initialized
is_workspace_initialized() {
    [[ -f ".mcp.json" && -f ".env.mcp" && -f "MCP_DEV_README.md" ]]
}

# Detect Claude environment (CLI vs Desktop)
detect_claude_environment() {
    local mode=""

    # Check for Claude CLI
    if command_exists claude; then
        # Check if Claude Desktop is also present
        if [[ -f "/Applications/Claude.app/Contents/MacOS/Claude" ]] || [[ -n "${CLAUDE_DESKTOP}" ]]; then
            mode="desktop"
        else
            mode="cli"
        fi
    elif [[ -f "/Applications/Claude.app/Contents/MacOS/Claude" ]] || command_exists claude-desktop || command_exists code; then
        mode="desktop"
    else
        mode="unknown"
    fi

    echo "$mode"
}

# Setup MCP for Claude CLI
setup_claude_cli() {
    local workspace_id="$1"
    local workspace_dir="$2"

    log_step "Configuring MCP for Claude CLI..."

    # Remove existing server if it exists
    if claude mcp list 2>/dev/null | grep -q "backlog-md-dev-${workspace_id}"; then
        log_info "Removing existing MCP server..."
        claude mcp remove "backlog-md-dev-${workspace_id}" 2>/dev/null || true
    fi

    # Add MCP server via Claude CLI
    if claude mcp add "backlog-md-dev-${workspace_id}" \
        bun run "${workspace_dir}/src/mcp-stdio-server.ts" \
        --scope project \
        -e "BACKLOG_PROJECT_ROOT=${workspace_dir}" \
        -e "BACKLOG_MCP_DEBUG=true" \
        -e "BACKLOG_MCP_WORKSPACE_ID=${workspace_id}" \
        -e "BACKLOG_MCP_LOG_LEVEL=debug" \
        -e "BACKLOG_MCP_ISOLATED=true" \
        -e "BACKLOG_MCP_DEV_MODE=true"; then
        log_success "MCP server registered with Claude CLI"
        return 0
    else
        log_error "Failed to register MCP server with Claude CLI"
        return 1
    fi
}

# Setup MCP for Claude Desktop
setup_claude_desktop() {
    local workspace_id="$1"
    local workspace_dir="$2"

    log_step "Configuring MCP for Claude Desktop..."

    # Check if we have a desktop template
    if [[ -f ".mcp.desktop.template.json" ]]; then
        # Use template with workspace ID substitution
        sed "s/{{WORKSPACE_ID}}/${workspace_id}/g" .mcp.desktop.template.json > .mcp.json
        log_info "Used desktop template with workspace ID substitution"
    elif [[ -f ".mcp.dev.template.json" ]]; then
        # Use development template (legacy)
        sed "s/{{WORKSPACE_ID}}/${workspace_id}/g" .mcp.dev.template.json > .mcp.json
        log_info "Used development template with workspace ID substitution"
    else
        # Fallback to manual creation with workspaceFolder variables
        cat > .mcp.json << EOF
{
    "mcpServers": {
        "backlog-md-dev-${workspace_id}": {
            "command": "bun",
            "args": [
                "run",
                "\${workspaceFolder}/src/mcp-stdio-server.ts"
            ],
            "env": {
                "BACKLOG_PROJECT_ROOT": "\${workspaceFolder}",
                "BACKLOG_MCP_DEBUG": "true",
                "BACKLOG_MCP_WORKSPACE_ID": "${workspace_id}",
                "BACKLOG_MCP_LOG_LEVEL": "debug",
                "BACKLOG_MCP_ISOLATED": "true",
                "BACKLOG_MCP_DEV_MODE": "true"
            }
        }
    }
}
EOF
        log_info "Created MCP configuration manually for Claude Desktop"
    fi

    log_success "MCP configuration created for Claude Desktop (.mcp.json)"
    return 0
}

# Main setup function
main() {
    echo -e "${GREEN}🚀 Backlog.md MCP Development Setup${NC}"
    echo "=================================================="
    echo

    # Check if we're in the right directory
    if [[ ! -f "package.json" ]] || [[ ! -d "src/mcp" ]]; then
        log_error "This doesn't appear to be the Backlog.md project root directory."
        log_error "Please run this script from the project root."
        exit 1
    fi

    # Check if workspace is already initialized
    if is_workspace_initialized; then
        log_warning "Workspace already appears to be initialized."
        echo -e "${YELLOW}Found existing files:${NC}"
        [[ -f ".mcp.json" ]] && echo "  • .mcp.json"
        [[ -f ".env.mcp" ]] && echo "  • .env.mcp"
        [[ -f "MCP_DEV_README.md" ]] && echo "  • MCP_DEV_README.md"
        echo

        read -p "Do you want to continue and overwrite these files? (y/N): " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            log_info "Setup cancelled. Use existing configuration or remove files to start fresh."
            exit 0
        fi
        log_info "Proceeding with re-initialization..."
        echo
    fi

    # Step 1: Check prerequisites
    log_step "Checking prerequisites..."

    if ! command_exists bun; then
        log_error "Bun is required but not installed."
        log_info "Install with: curl -fsSL https://bun.sh/install | bash"
        exit 1
    fi

    if ! command_exists node; then
        log_warning "Node.js not found. Bun should handle this, but some tools may require Node."
    fi

    log_success "Prerequisites check passed"
    echo

    # Step 2: Install dependencies
    log_step "Installing dependencies..."
    if ! bun install; then
        log_error "Failed to install dependencies"
        exit 1
    fi
    log_success "Dependencies installed successfully"
    echo

    # Step 3: Generate workspace configuration
    log_step "Setting up workspace isolation..."

    WORKSPACE_ID=$(generate_workspace_id)
    WORKSPACE_DIR="$(pwd)"
    AVAILABLE_PORT=$(find_available_port)

    log_info "Generated workspace ID: ${WORKSPACE_ID}"
    log_info "Allocated port: ${AVAILABLE_PORT}"

    # Create .env.mcp for workspace-specific environment variables
    cat > .env.mcp << EOF
# Backlog.md MCP Development Environment
# Generated on $(date)

# Workspace identification
BACKLOG_MCP_WORKSPACE_ID=${WORKSPACE_ID}
BACKLOG_PROJECT_ROOT=${WORKSPACE_DIR}

# Debug settings
BACKLOG_MCP_DEBUG=true
BACKLOG_MCP_LOG_LEVEL=debug

# Port allocation for HTTP transport (if needed in future)
BACKLOG_MCP_PORT=${AVAILABLE_PORT}
BACKLOG_MCP_PORT_BASE=8080
BACKLOG_MCP_PORT_RANGE=50

# Isolation settings
BACKLOG_MCP_ISOLATED=true
BACKLOG_MCP_DEV_MODE=true

# Performance settings
BACKLOG_MCP_TIMEOUT=30000
BACKLOG_MCP_MAX_REQUESTS_PER_MINUTE=100
EOF

    log_success "Workspace environment created (.env.mcp)"
    echo

    # Step 4: Detect Claude environment and create MCP configuration
    CLAUDE_MODE=$(detect_claude_environment)

    # Allow command line override
    if [[ "$1" == "--cli" ]]; then
        CLAUDE_MODE="cli"
    elif [[ "$1" == "--desktop" ]]; then
        CLAUDE_MODE="desktop"
    fi

    log_info "Detected Claude environment: ${CLAUDE_MODE}"

    case "${CLAUDE_MODE}" in
        "cli")
            if setup_claude_cli "${WORKSPACE_ID}" "${WORKSPACE_DIR}"; then
                log_info "MCP configured for Claude CLI"
            else
                log_error "Failed to configure MCP for Claude CLI"
                exit 1
            fi
            ;;
        "desktop")
            if setup_claude_desktop "${WORKSPACE_ID}" "${WORKSPACE_DIR}"; then
                log_info "MCP configured for Claude Desktop"
            else
                log_error "Failed to configure MCP for Claude Desktop"
                exit 1
            fi
            ;;
        "unknown")
            log_warning "Could not detect Claude environment"
            echo "Please specify mode:"
            echo "  --cli     : Configure for Claude CLI"
            echo "  --desktop : Configure for Claude Desktop"
            exit 1
            ;;
    esac
    echo

    # Step 5: Test MCP server startup
    log_step "Testing MCP server startup..."

    # Start server in background for a few seconds to test
    timeout 5s bun run src/mcp-stdio-server.ts 2>/tmp/mcp-test-${WORKSPACE_ID}.log || true

    if grep -q "MCP server started" /tmp/mcp-test-${WORKSPACE_ID}.log 2>/dev/null; then
        log_success "MCP server startup test passed"
    else
        log_warning "MCP server startup test inconclusive (this may be normal)"
        log_info "Check logs manually: bun run src/mcp-stdio-server.ts"
    fi

    # Clean up test log
    rm -f /tmp/mcp-test-${WORKSPACE_ID}.log
    echo

    # Step 6: Create quick reference
    cat > MCP_DEV_README.md << EOF
# MCP Development Setup - Workspace ${WORKSPACE_ID}

## Quick Start
This workspace is configured for local MCP development with **${CLAUDE_MODE}** mode.

### Files Created
- \`.mcp.json\` - MCP server configuration
- \`.env.mcp\` - Workspace environment variables
- \`MCP_DEV_README.md\` - This file

### Usage (${CLAUDE_MODE^^} Mode)

$(if [[ "${CLAUDE_MODE}" == "cli" ]]; then
echo "1. **Claude CLI Usage**
   \`\`\`bash
   # Start Claude with MCP support
   claude

   # List configured servers
   claude mcp list

   # Remove server if needed
   claude mcp remove backlog-md-dev-${WORKSPACE_ID}
   \`\`\`"
else
echo "1. **Claude Desktop Usage**
   \`\`\`bash
   # Open this directory in Claude Desktop
   # The MCP server will be auto-detected as \"backlog-md-dev-${WORKSPACE_ID}\"
   \`\`\`"
fi)

2. **Manual Testing**
   \`\`\`bash
   # Test server directly
   bun run src/mcp-stdio-server.ts

   # Run validation script
   ./scripts/test-mcp-setup.sh
   \`\`\`

3. **Environment**
   - Workspace ID: \`${WORKSPACE_ID}\`
   - Claude Mode: \`${CLAUDE_MODE}\`
   - Debug mode: Enabled
   - Project root: \`${WORKSPACE_DIR}\`

### Switching Modes
To switch between Claude CLI and Desktop:
\`\`\`bash
# Force CLI mode
./scripts/setup-mcp-dev.sh --cli

# Force Desktop mode
./scripts/setup-mcp-dev.sh --desktop
\`\`\`

### Troubleshooting
- Check \`.env.mcp\` for environment variables
- Verify \`bun install\` completed successfully
- For CLI: Run \`claude mcp list\` to verify server registration
- For Desktop: Ensure Claude Desktop can access this directory
- Run \`./scripts/test-mcp-setup.sh\` for diagnostics

### Multiple Workspaces
Each workspace gets a unique ID to prevent conflicts.
You can have multiple Backlog.md clones running simultaneously.
EOF

    # Final success message
    echo "=================================================="
    log_success "MCP Development Environment Setup Complete!"
    echo
    log_info "Workspace ID: ${WORKSPACE_ID}"
    log_info "Claude Mode: ${CLAUDE_MODE}"
    log_info "Configuration: .mcp.json"
    log_info "Environment: .env.mcp"
    echo
    echo -e "${GREEN}Next Steps (${CLAUDE_MODE^^} Mode):${NC}"
    if [[ "${CLAUDE_MODE}" == "cli" ]]; then
        echo "1. Run: claude"
        echo "2. The MCP server 'backlog-md-dev-${WORKSPACE_ID}' is registered"
        echo "3. Test with: 'Create a task called Test MCP'"
    else
        echo "1. Open this directory in Claude Desktop"
        echo "2. The MCP server will be auto-detected"
        echo "3. Test with: 'Create a task called Test MCP'"
    fi
    echo "4. Test with: './scripts/test-mcp-setup.sh'"
    echo "5. Review: MCP_DEV_README.md"
    echo
    log_info "Happy coding! 🎉"
}

# Handle interruption
trap 'echo -e "\n${RED}Setup interrupted. Partial files may exist.${NC}"; exit 1' INT

# Run main function
main "$@"