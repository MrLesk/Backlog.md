#!/usr/bin/env bash
# Backlog.md status-change dispatcher (POSIX shell)
#
# Set in backlog.config.yml:
#   shell: "sh"               # or "bash" / "auto"
#   onStatusChange: '"$PWD/backlog/prompts/dispatch.sh"'
#
# Env vars injected by Backlog.md: TASK_ID, OLD_STATUS, NEW_STATUS, TASK_TITLE.
# Picks the prompt file matching $NEW_STATUS, reads the per-task agent/reviewAgent
# field from the task frontmatter, and launches the right CLI in the background.

set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]:-$0}")" && pwd)"
prompts_dir="$script_dir"
project_root="$(cd "$script_dir/../.." && pwd)"

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
log_dir="$prompts_dir/logs"
mkdir -p "$log_dir"
timestamp="$(date +%Y%m%d-%H%M%S-%3N)"
sanitize() { printf '%s' "$1" | tr -c 'A-Za-z0-9._-' '_'; }
safe_task_id="$(sanitize "${TASK_ID:-unknown}")"
safe_status="$(sanitize "${NEW_STATUS:-unknown}")"
log_file="$log_dir/$timestamp-$$-$safe_task_id-$safe_status.log"
prompt_path="$log_file.prompt"
printf '%s' "$full_prompt" > "$prompt_path"

# Dry-run mode: do everything except spawn the agent.
if [ "${BACKLOG_DISPATCH_DRY_RUN:-}" = "1" ]; then
    exit 0
fi

# ── Agent resolution ─────────────────────────────────────────────────────────
#
# Priority: per-task frontmatter field > BACKLOG_DEFAULT_AGENT env var > "claude"
#
# For "In Review", prefers reviewAgent: from the task, falls back to agent:,
# then to the default. This lets coder and reviewer be different agents per task
# without touching dispatcher code.
#
task_agent=""
task_review_agent=""
task_file="$(find "$project_root/backlog/tasks" -name "*${TASK_ID:-}*" 2>/dev/null | head -1)"
if [ -n "$task_file" ] && [ -f "$task_file" ]; then
    task_agent="$(grep -m1 '^agent:' "$task_file" 2>/dev/null | sed "s/^agent:[[:space:]]*//" | tr -d "'\"")"
    task_review_agent="$(grep -m1 '^reviewAgent:' "$task_file" 2>/dev/null | sed "s/^reviewAgent:[[:space:]]*//" | tr -d "'\"")"
fi

# Tasks without an `agent:` field are human tasks — do not dispatch an
# agent for them. The only exception is "Human Review" which fires the
# ready.md notifier regardless (it just logs a summary, not implementation
# work). The notifier uses whatever agent IS on the task, or falls back
# to claude as a lightweight runner.
if [ -z "$task_agent" ] && [ "${NEW_STATUS:-}" != "Human Review" ]; then
    exit 0
fi

case "${NEW_STATUS:-}" in
    "In Review")
        # Prefer the dedicated reviewer agent; fall back to the coder agent.
        if [ -n "$task_review_agent" ]; then
            agent_name="$task_review_agent"
        else
            agent_name="$task_agent"
        fi
        ;;
    "Human Review")
        # Notifier: use coder agent if set, otherwise claude.
        agent_name="${task_agent:-claude}"
        ;;
    *)
        agent_name="$task_agent"
        ;;
esac

echo "dispatch.sh: task=${TASK_ID:-?} status=${NEW_STATUS:-?} agent=$agent_name"

# ── Per-agent launch ─────────────────────────────────────────────────────────
#
# All three supported agents accept a prompt via stdin or positional arg.
# Detach with nohup + & + disown so the hook returns immediately.
#
(
    cd "$project_root"
    case "$agent_name" in
        claude)
            nohup claude -p --dangerously-skip-permissions \
                < "$prompt_path" > "$log_file" 2> "$log_file.err" &
            ;;
        codex)
            # Codex needs the prompt as a positional arg; rejects stdin redirect.
            nohup codex --yolo "$full_prompt" \
                > "$log_file" 2> "$log_file.err" &
            ;;
        opencode)
            nohup opencode -p "$full_prompt" --yes \
                > "$log_file" 2> "$log_file.err" &
            ;;
        *)
            # Treat as an absolute or relative path; assume claude-compatible stdin.
            nohup "$agent_name" -p --dangerously-skip-permissions \
                < "$prompt_path" > "$log_file" 2> "$log_file.err" &
            ;;
    esac
    disown
) > /dev/null 2>&1
