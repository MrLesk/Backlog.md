#!/usr/bin/env fish
# Fish completion script for backlog CLI
#
# NOTE: This script is embedded in the backlog binary and installed automatically
# via 'backlog completion install'. This file serves as reference documentation.
#
# Installation:
#   - Recommended: backlog completion install --shell fish
#   - Manual: Copy to ~/.config/fish/completions/backlog.fish
#
# Requirements:
#   - Fish 3.x or later

# Helper function to get completions from the CLI
# This delegates all completion logic to the TypeScript implementation
function __backlog_complete
	# Get the current command line and cursor position
	# -cp: get the command line with cursor position preserved
	set -l line (commandline -cp)

	# Calculate the cursor position (length of the line up to cursor)
	# Fish tracks cursor position differently than bash/zsh
	set -l point (string length "$line")

	# Call the CLI's internal completion command
	# Output format: one completion per line
	# Redirect stderr to /dev/null to suppress error messages
	backlog completion __complete "$line" "$point" 2>/dev/null

	# Fish will automatically handle the exit status
	# If the command fails, no completions will be shown
end

# Register completion for the 'backlog' command
# -c: specify the command to complete
# -f: disable file completion (we handle all completions dynamically)
# -a: add completion candidates from the function output
complete -c backlog -f -a '(__backlog_complete)'
