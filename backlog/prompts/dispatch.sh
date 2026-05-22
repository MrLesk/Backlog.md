#!/usr/bin/env bash
# Backlog.md status-change dispatcher (POSIX shell)
#
# Set in backlog.config.yml:
#   shell: "sh"               # or "bash" / "auto"
#   onStatusChange: '"$PWD/backlog/prompts/dispatch.sh"'
#
# Env vars injected by Backlog.md: TASK_ID, OLD_STATUS, NEW_STATUS, TASK_TITLE.
# Picks the prompt file matching $NEW_STATUS, prepends task context, and
# launches `claude -p` in the background so the hook returns immediately.

set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]:-$0}")" && pwd)"
prompts_dir="$script_dir"

# Set BACKLOG_DISPATCH_MODE=test in the env that launches Backlog.md to pick
# the smoke-test prompts (no-op agents that just wait and transition to the
# next status). Anything else uses the real prompts.
if [ "${BACKLOG_DISPATCH_MODE:-}" = "test" ]; then
    suffix=".test.md"
else
    suffix=".md"
fi

case "${NEW_STATUS:-}" in
    "In Progress")  prompt_file="$prompts_dir/code$suffix" ;;
    "In Review")    prompt_file="$prompts_dir/review$suffix" ;;
    "Human Review") prompt_file="$prompts_dir/ready$suffix" ;;
    *) exit 0 ;;  # Status change we don't dispatch on
esac

if [ ! -f "$prompt_file" ]; then
    echo "dispatch.sh: prompt file not found: $prompt_file" >&2
    exit 0
fi

# Build the full prompt: template body + task context.
full_prompt="$(cat "$prompt_file")

---
Task: ${TASK_ID:-?} — ${TASK_TITLE:-?}
Status: ${OLD_STATUS:-?} → ${NEW_STATUS:-?}"

# Per-invocation log file so concurrent hooks don't clobber each other.
# Millisecond timestamp + PID make collisions effectively impossible even when
# the same task transitions twice in the same second.
log_dir="$prompts_dir/logs"
mkdir -p "$log_dir"
timestamp="$(date +%Y%m%d-%H%M%S-%3N)"
sanitize() { printf '%s' "$1" | tr -c 'A-Za-z0-9._-' '_'; }
safe_task_id="$(sanitize "${TASK_ID:-unknown}")"
safe_status="$(sanitize "${NEW_STATUS:-unknown}")"
log_file="$log_dir/$timestamp-$$-$safe_task_id-$safe_status.log"

# Write the prompt sidecar so the artifact is available for inspection even on
# dry-run or when claude isn't on PATH.
prompt_path="$log_file.prompt"
printf '%s' "$full_prompt" > "$prompt_path"

# Dry-run mode: do everything except spawn claude. Used by dispatcher regression
# tests; harmless in production.
if [ "${BACKLOG_DISPATCH_DRY_RUN:-}" = "1" ]; then
    exit 0
fi

# `claude` in headless mode needs --dangerously-skip-permissions to act
# without prompting. Adjust if your trust model differs.
#
# Detach so Backlog.md's hook returns immediately. nohup + & + disown handles
# the case where Backlog.md exits before the agent finishes.
project_root="$(cd "$script_dir/../.." && pwd)"
(
    cd "$project_root"
    nohup claude -p "$full_prompt" --dangerously-skip-permissions \
        > "$log_file" 2> "$log_file.err" &
    disown
) > /dev/null 2>&1
