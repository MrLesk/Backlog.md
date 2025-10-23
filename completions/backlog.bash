#!/usr/bin/env bash
# Bash completion script for backlog CLI
#
# NOTE: This script is embedded in the backlog binary and installed automatically
# via 'backlog completion install'. This file serves as reference documentation.
#
# Installation:
#   - Recommended: backlog completion install --shell bash
#   - Manual: Copy to /etc/bash_completion.d/backlog
#   - Or source directly in ~/.bashrc: source /path/to/backlog.bash
#
# Requirements:
#   - Bash 4.x or 5.x
#   - bash-completion package (optional but recommended)

# Main completion function for backlog CLI
_backlog() {
	# Initialize completion variables using bash-completion helper if available
	# Falls back to manual initialization if bash-completion is not installed
	local cur prev words cword
	if declare -F _init_completion >/dev/null 2>&1; then
		_init_completion || return
	else
		# Manual initialization fallback
		COMPREPLY=()
		cur="${COMP_WORDS[COMP_CWORD]}"
		prev="${COMP_WORDS[COMP_CWORD-1]}"
		words=("${COMP_WORDS[@]}")
		cword=$COMP_CWORD
	fi

	# Get the full command line and cursor position
	local line="${COMP_LINE}"
	local point="${COMP_POINT}"

	# Call the CLI's internal completion command
	# This delegates all completion logic to the TypeScript implementation
	# Output format: one completion per line
	local completions
	completions=$(backlog completion __complete "$line" "$point" 2>/dev/null)

	# Check if the completion command failed
	if [[ $? -ne 0 ]]; then
		# Silent failure - completion should never break the shell
		return 0
	fi

	# Generate completion replies using compgen
	# -W: wordlist - splits completions by whitespace
	# --: end of options
	# "$cur": current word being completed
	COMPREPLY=( $(compgen -W "$completions" -- "$cur") )

	# Return success
	return 0
}

# Register the completion function for the 'backlog' command
# -F: use function for completion
# _backlog: name of the completion function
# backlog: command to complete
complete -F _backlog backlog
