#!/usr/bin/env bash

# Parse arguments
DEBUG=false
TEST_MODE=false
PROMPT=""
OUTPUT_FILE=""

show_help() {
	cat <<EOF
Usage: ask-gemini -p "prompt" [OPTIONS]

Sends a prompt to gemini and outputs the response.

Options:
  -p, --prompt TEXT    The prompt to send to gemini (required)
  --debug             Enable debug output and status messages
  --test              Test mode - echo prompt instead of calling gemini (free)
  -o, --output FILE   Save output to file (optional)

File References:
  Use @ to reference files/directories relative to script location:
  @docs/          Include all files in docs directory
  @README.md      Include specific file

Examples:
  ask-gemini -p "What is 2+2?"
  ask-gemini -p "Explain @src/main.ts" -o response.md
  ask-gemini -p "Review @docs/ and summarize" --debug
  ask-gemini -p "test prompt" --test

The script sends the prompt to gemini using the -p flag.
By default, output goes to stdout only.
If -o FILE is specified, output is saved to that file as well.
EOF
}

while [[ $# -gt 0 ]]; do
	case $1 in
		-p|--prompt)
			PROMPT="$2"
			shift 2
			;;
		--debug)
			DEBUG=true
			shift
			;;
		--test)
			TEST_MODE=true
			shift
			;;
		-o|--output)
			OUTPUT_FILE="$2"
			shift 2
			;;
		-h|--help)
			show_help
			exit 0
			;;
		*)
			echo "Error: Unknown option '$1'" >&2
			echo "Use --help for usage information" >&2
			exit 1
			;;
	esac
done

# Check if prompt is provided
if [ -z "$PROMPT" ]; then
	echo "Error: No prompt provided" >&2
	echo "Usage: ask-gemini -p \"your prompt\" [OPTIONS]" >&2
	echo "Use --help for full usage information" >&2
	exit 1
fi

# Color codes for debug output
if [ "$DEBUG" = true ]; then
	RED='\033[0;31m'
	GREEN='\033[0;32m'
	YELLOW='\033[1;33m'
	NC='\033[0m'
else
	RED=''
	GREEN=''
	YELLOW=''
	NC=''
fi

# Check if gemini command exists (skip in test mode)
if [ "$TEST_MODE" = false ]; then
	if ! command -v gemini &> /dev/null; then
		if [ "$DEBUG" = true ]; then
			echo -e "${RED}Error: gemini command not found${NC}" >&2
			echo "Please ensure gemini CLI is installed and in your PATH" >&2
		else
			echo "Error: gemini command not found" >&2
		fi
		exit 1
	fi
fi

# Build gemini command (only in non-test mode)
if [ "$TEST_MODE" = false ]; then
	GEMINI_CMD="gemini"
	if [ "$DEBUG" = true ]; then
		GEMINI_CMD="$GEMINI_CMD --debug"
		echo -e "${GREEN}Starting Gemini query...${NC}" >&2
		echo -e "${YELLOW}Prompt: ${PROMPT:0:100}...${NC}" >&2
		if [ -n "$OUTPUT_FILE" ]; then
			echo -e "${YELLOW}Output will be saved to: ${OUTPUT_FILE}${NC}" >&2
		fi
	fi
else
	if [ "$DEBUG" = true ]; then
		echo -e "${GREEN}[TEST MODE] Starting test...${NC}" >&2
		echo -e "${YELLOW}Prompt: ${PROMPT:0:100}...${NC}" >&2
		if [ -n "$OUTPUT_FILE" ]; then
			echo -e "${YELLOW}Output will be saved to: ${OUTPUT_FILE}${NC}" >&2
		fi
	fi
fi

# Process the prompt
if [ "$TEST_MODE" = true ]; then
	# Test mode - just echo the prompt
	if [ "$DEBUG" = true ]; then
		echo -e "${YELLOW}[TEST MODE] Echoing prompt instead of calling gemini${NC}" >&2
	fi

	if [ -n "$OUTPUT_FILE" ]; then
		# Output to both console and file
		echo "$PROMPT" | tee "$OUTPUT_FILE"
		EXIT_STATUS=0
	else
		# Output to console only
		echo "$PROMPT"
		EXIT_STATUS=0
	fi
else
	# Real mode - call gemini with prompt
	if [ -n "$OUTPUT_FILE" ]; then
		# Output to both console and file
		$GEMINI_CMD -p "$PROMPT" 2>&1 | tee "$OUTPUT_FILE"
		EXIT_STATUS=${PIPESTATUS[0]}
	else
		# Output to console only
		$GEMINI_CMD -p "$PROMPT" 2>&1
		EXIT_STATUS=$?
	fi
fi

# Check exit status (only show in debug mode)
if [ "$DEBUG" = true ]; then
	if [ $EXIT_STATUS -eq 0 ]; then
		echo -e "\n${GREEN}✓ Query completed successfully${NC}" >&2
		if [ -n "$OUTPUT_FILE" ]; then
			echo -e "${GREEN}✓ Output saved to: ${OUTPUT_FILE}${NC}" >&2
		fi
	else
		echo -e "\n${RED}✗ Query failed with error${NC}" >&2
		exit 1
	fi
fi

exit $EXIT_STATUS