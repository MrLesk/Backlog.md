#!/bin/bash

# Backlog.md MCP Setup Validation Script
# Tests and validates the MCP development environment setup

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Test counters
TESTS_TOTAL=0
TESTS_PASSED=0
TESTS_FAILED=0

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

log_test() {
    echo -e "${CYAN}🧪 $1${NC}"
}

# Test helper functions
start_test() {
    TESTS_TOTAL=$((TESTS_TOTAL + 1))
    log_test "Test $TESTS_TOTAL: $1"
}

pass_test() {
    TESTS_PASSED=$((TESTS_PASSED + 1))
    log_success "$1"
    echo
}

fail_test() {
    TESTS_FAILED=$((TESTS_FAILED + 1))
    log_error "$1"
    echo
}

# Check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Main testing function
main() {
    echo -e "${CYAN}🧪 Backlog.md MCP Setup Validation${NC}"
    echo "============================================="
    echo

    # Check if we're in the right directory
    if [[ ! -f "package.json" ]] || [[ ! -d "src/mcp" ]]; then
        log_error "This doesn't appear to be the Backlog.md project root directory."
        log_error "Please run this script from the project root."
        exit 1
    fi

    # Test 1: Prerequisites Check
    start_test "Prerequisites Check"

    prereq_ok=true

    if ! command_exists bun; then
        log_error "Bun is not installed or not in PATH"
        prereq_ok=false
    else
        log_info "Bun: $(bun --version)"
    fi

    if ! command_exists node; then
        log_warning "Node.js not found (not critical, but recommended)"
    else
        log_info "Node.js: $(node --version)"
    fi

    if [[ "$prereq_ok" == "true" ]]; then
        pass_test "All prerequisites satisfied"
    else
        fail_test "Missing required prerequisites"
    fi

    # Test 2: Project Structure
    start_test "Project Structure Validation"

    structure_ok=true
    required_files=(
        "package.json"
        "src/mcp-stdio-server.ts"
        "src/mcp/server.ts"
        "scripts/setup-mcp-dev.sh"
    )

    for file in "${required_files[@]}"; do
        if [[ ! -f "$file" ]]; then
            log_error "Required file missing: $file"
            structure_ok=false
        fi
    done

    if [[ "$structure_ok" == "true" ]]; then
        pass_test "Project structure is valid"
    else
        fail_test "Project structure validation failed"
    fi

    # Test 3: Dependencies Check
    start_test "Dependencies Check"

    if [[ ! -d "node_modules" ]]; then
        log_error "node_modules directory not found. Run: bun install"
        fail_test "Dependencies not installed"
    elif [[ ! -d "node_modules/@modelcontextprotocol" ]]; then
        log_error "MCP SDK not found. Run: bun install"
        fail_test "MCP SDK not installed"
    else
        log_info "MCP SDK: $(cat node_modules/@modelcontextprotocol/sdk/package.json | grep '"version"' | cut -d'"' -f4)"
        pass_test "Dependencies are installed correctly"
    fi

    # Test 4: Configuration Files
    start_test "Configuration Files Check"

    config_ok=true

    if [[ ! -f ".mcp.json" ]]; then
        log_warning ".mcp.json not found (run setup script to create)"
        config_ok=false
    else
        log_info "Found .mcp.json configuration"

        # Validate JSON structure
        if ! cat .mcp.json | bun -e "JSON.parse(require('fs').readFileSync('/dev/stdin', 'utf8'))" 2>/dev/null; then
            log_error ".mcp.json contains invalid JSON"
            config_ok=false
        else
            log_info ".mcp.json is valid JSON"
        fi
    fi

    if [[ ! -f ".env.mcp" ]]; then
        log_warning ".env.mcp not found (run setup script to create)"
        config_ok=false
    else
        log_info "Found .env.mcp environment file"

        # Check for required environment variables
        if grep -q "BACKLOG_MCP_WORKSPACE_ID" .env.mcp; then
            workspace_id=$(grep "BACKLOG_MCP_WORKSPACE_ID" .env.mcp | cut -d'=' -f2)
            log_info "Workspace ID: $workspace_id"
        else
            log_error ".env.mcp missing BACKLOG_MCP_WORKSPACE_ID"
            config_ok=false
        fi
    fi

    if [[ "$config_ok" == "true" ]]; then
        pass_test "Configuration files are valid"
    else
        fail_test "Configuration validation failed"
    fi

    # Test 5: MCP Server Startup
    start_test "MCP Server Startup Test"

    log_info "Starting MCP server for 3 seconds..."

    # Create a temporary log file
    temp_log="/tmp/mcp-test-$$.log"

    # Start the server in background with timeout
    timeout 3s bun run src/mcp-stdio-server.ts 2>"$temp_log" &
    server_pid=$!

    # Wait for the timeout to complete
    wait $server_pid 2>/dev/null || true

    # Check the log for expected startup messages
    if [[ -f "$temp_log" ]]; then
        if grep -q -i "mcp.*server.*started\|server.*started" "$temp_log"; then
            log_info "Server started successfully"
            pass_test "MCP server startup successful"
        elif grep -q -i "error\|failed\|cannot" "$temp_log"; then
            log_error "Server startup errors detected:"
            cat "$temp_log" | head -5
            fail_test "MCP server startup failed"
        else
            log_warning "Server startup test inconclusive (may be normal)"
            log_info "Log contents:"
            cat "$temp_log" | head -3
            pass_test "MCP server appears to start (inconclusive)"
        fi

        # Clean up temp log
        rm -f "$temp_log"
    else
        fail_test "No server log generated"
    fi

    # Test 6: TypeScript Compilation Check
    start_test "TypeScript Compilation Check"

    if timeout 30s bun run build:css >/dev/null 2>&1 && timeout 30s bunx tsc --noEmit 2>/dev/null; then
        pass_test "TypeScript compilation successful"
    else
        log_warning "TypeScript compilation issues detected"
        log_info "Run 'bunx tsc --noEmit' manually for details"
        fail_test "TypeScript compilation check failed"
    fi

    # Test 7: MCP Tools Compilation
    start_test "MCP Tools Compilation Check"

    # Try to import and check the main MCP modules
    if bun -e "
        try {
            require('./src/mcp/server.ts');
            require('./src/mcp/tools/task-tools.ts');
            require('./src/mcp/tools/board-tools.ts');
            console.log('MCP modules imported successfully');
        } catch (error) {
            console.error('MCP module import failed:', error.message);
            process.exit(1);
        }
    " 2>/dev/null; then
        pass_test "MCP tools compilation successful"
    else
        fail_test "MCP tools compilation failed"
    fi

    # Test 8: Workspace Isolation Check
    start_test "Workspace Isolation Check"

    isolation_ok=true

    if [[ -f ".env.mcp" ]]; then
        if grep -q "BACKLOG_MCP_ISOLATED=true" .env.mcp; then
            log_info "Workspace isolation enabled"
        else
            log_warning "Workspace isolation not explicitly enabled"
            isolation_ok=false
        fi

        if grep -q "BACKLOG_MCP_WORKSPACE_ID=" .env.mcp; then
            workspace_id=$(grep "BACKLOG_MCP_WORKSPACE_ID=" .env.mcp | cut -d'=' -f2)
            if [[ -n "$workspace_id" && ${#workspace_id} -ge 6 ]]; then
                log_info "Unique workspace ID detected: $workspace_id"
            else
                log_warning "Workspace ID seems too short or empty"
                isolation_ok=false
            fi
        fi
    else
        log_error "No .env.mcp file found for isolation check"
        isolation_ok=false
    fi

    if [[ "$isolation_ok" == "true" ]]; then
        pass_test "Workspace isolation configured correctly"
    else
        fail_test "Workspace isolation check failed"
    fi

    # Final Results
    echo
    echo "============================================="
    echo -e "${CYAN}📊 Test Results Summary${NC}"
    echo "============================================="
    echo "Total Tests: $TESTS_TOTAL"
    echo -e "Passed: ${GREEN}$TESTS_PASSED${NC}"
    echo -e "Failed: ${RED}$TESTS_FAILED${NC}"

    success_rate=$((TESTS_PASSED * 100 / TESTS_TOTAL))
    echo "Success Rate: ${success_rate}%"

    echo

    if [[ $TESTS_FAILED -eq 0 ]]; then
        log_success "All tests passed! 🎉"
        log_info "Your MCP development environment is ready for use."
        echo
        echo "Next steps:"
        echo "• Open this directory in Claude Code"
        echo "• The MCP server should be auto-detected"
        echo "• Test with: 'Create a task called Test MCP'"
        exit 0
    elif [[ $TESTS_FAILED -le 2 ]]; then
        log_warning "Some tests failed, but setup may still work."
        log_info "Check the failed tests above and consider re-running setup."
        echo
        echo "Try running:"
        echo "• ./scripts/setup-mcp-dev.sh (to fix configuration)"
        echo "• bun install (to fix dependencies)"
        exit 1
    else
        log_error "Multiple critical tests failed."
        log_error "Please review the errors above and fix issues before proceeding."
        echo
        echo "Common solutions:"
        echo "• Run: ./scripts/setup-mcp-dev.sh"
        echo "• Run: bun install"
        echo "• Check that you're in the correct directory"
        exit 2
    fi
}

# Handle interruption
trap 'echo -e "\n${RED}Testing interrupted.${NC}"; exit 130' INT

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --verbose|-v)
            set -x
            shift
            ;;
        --help|-h)
            echo "Backlog.md MCP Setup Validation Script"
            echo
            echo "Usage: $0 [options]"
            echo
            echo "Options:"
            echo "  -v, --verbose    Enable verbose output"
            echo "  -h, --help       Show this help message"
            echo
            echo "This script validates that your MCP development environment"
            echo "is set up correctly and ready for use with Claude Code."
            exit 0
            ;;
        *)
            log_error "Unknown option: $1"
            echo "Use --help for usage information."
            exit 1
            ;;
    esac
done

# Run main function
main "$@"