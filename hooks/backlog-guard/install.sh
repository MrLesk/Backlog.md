#!/usr/bin/env bash
# install.sh — Install backlog-guard for Claude Code and/or OpenCode.
# Run from any directory inside the target project (auto-discovers git root).
set -euo pipefail

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; CYAN='\033[0;36m'; NC='\033[0m'
info()  { echo -e "${CYAN}::${NC} $1"; }
ok()    { echo -e "${GREEN}ok${NC} $1"; }
warn()  { echo -e "${YELLOW}warn${NC} $1"; }
err()   { echo -e "${RED}error${NC} $1"; }

# -- Locate project root ------------------------------------------------------

GIT_ROOT=""
if git rev-parse --show-toplevel &>/dev/null; then
  GIT_ROOT="$(git rev-parse --show-toplevel)"
else
  # Walk up for backlog/config.yml
  p="$PWD"
  for _ in 0 1 2 3; do
    if [[ -f "$p/backlog/config.yml" ]]; then GIT_ROOT="$p"; break; fi
    p="$(dirname "$p")"
  done
fi

if [[ -z "$GIT_ROOT" ]]; then
  err "Cannot find project root (no git repo or backlog/config.yml found)."
  info "Run this script from within a Backlog.md project."
  exit 1
fi

info "Project root: $GIT_ROOT"

# -- Step 1: Detect/Create .backlog-guard -------------------------------------

BACKLOG_DIRS=()
if [[ -f "$GIT_ROOT/.backlog-guard" ]]; then
  info "Found existing .backlog-guard"
  # Parse dirs
  while IFS= read -r line; do
    d="${line#- }"
    d="${d#"${d%%[![:space:]]*}"}"  # trim leading
    d="${d%"${d##*[![:space:]]}"}"  # trim trailing
    [[ -n "$d" ]] && BACKLOG_DIRS+=("$d")
  done < <(sed -n '/^dirs:/,/^[^ ]/p' "$GIT_ROOT/.backlog-guard" | grep '^\s*- ')
else
  # Auto-detect backlog/ directories
  while IFS= read -r d; do
    BACKLOG_DIRS+=("${d#./}")
  done < <(find "$GIT_ROOT" -maxdepth 2 -name "config.yml" -path "*/backlog/config.yml" -exec dirname {} \; 2>/dev/null || true)

  if [[ ${#BACKLOG_DIRS[@]} -eq 0 ]]; then
    warn "No backlog/ directory auto-detected. Defaulting to 'backlog/'."
    BACKLOG_DIRS=("backlog/")
  fi

  info "Creating .backlog-guard with ${#BACKLOG_DIRS[@]} director${BACKLOG_DIRS[1]:+ies}: ${BACKLOG_DIRS[*]}"
  {
    echo "# backlog-guard — protected directories"
    echo "# Agents must not access these directly; use MCP/CLI instead."
    echo "dirs:"
    for d in "${BACKLOG_DIRS[@]}"; do
      echo "  - ${d%/}/"
    done
  } > "$GIT_ROOT/.backlog-guard"
  ok "Wrote $GIT_ROOT/.backlog-guard"
fi

# -- Step 2: Resolve plugin source paths --------------------------------------

# Try to find compiled JS first, then TS, then fallback
if [[ -f "$DIR/opencode-plugin.js" ]]; then
  OPENCODE_SRC="$DIR/opencode-plugin.js"
elif [[ -f "$DIR/opencode-plugin.ts" ]]; then
  OPENCODE_SRC="$DIR/opencode-plugin.ts"
fi

CLAUDE_SRC="$DIR/guard.sh"

if [[ -z "${OPENCODE_SRC:-}" && ! -f "$CLAUDE_SRC" ]]; then
  err "Cannot find backlog-guard files in $DIR."
  info "Make sure the hook files are present (run dev.sh build first)."
  exit 1
fi

# -- Step 3: Claude Code install ----------------------------------------------

install_claude() {
  local target="$1"
  local label="$2"

  mkdir -p "$(dirname "$target")"

  # Read existing or start fresh
  local existing="{}"
  [[ -f "$target" ]] && existing="$(cat "$target")"

  # Merge hook entry
  if echo "$existing" | jq -e '.hooks.PreToolUse // empty' &>/dev/null; then
    warn "Claude Code hook already exists in $label — check $target manually."
  else
    local hook_entry
    hook_entry="$(cat <<ENDJSON
{
  "matcher": "Read|Edit|Write|Bash|Grep",
  "hooks": [
    {
      "type": "command",
      "command": "$CLAUDE_SRC",
      "timeout": 10,
      "statusMessage": "Backlog Guard: checking access..."
    }
  ]
}
ENDJSON
)"
    local merged
    merged="$(echo "$existing" | jq --argjson hook "$hook_entry" '
      .hooks.PreToolUse += [$hook]
    ' 2>/dev/null)" || merged="$existing"

    echo "$merged" > "$target"
    ok "Claude Code hook added to $label ($target)"
  fi

  # Offer MCP permissions
  local perms=(
    "mcp__backlog__task_view"
    "mcp__backlog__task_list"
    "mcp__backlog__task_create"
    "mcp__backlog__task_edit"
    "mcp__backlog__task_search"
    "mcp__backlog__task_archive"
    "mcp__backlog__task_complete"
    "mcp__backlog__document_view"
    "mcp__backlog__document_list"
    "mcp__backlog__document_create"
    "mcp__backlog__document_update"
    "mcp__backlog__document_search"
    "mcp__backlog__milestone_list"
    "mcp__backlog__milestone_add"
    "mcp__backlog__milestone_rename"
    "mcp__backlog__milestone_remove"
    "mcp__backlog__milestone_archive"
    "mcp__backlog__get_backlog_instructions"
  )

  local needs_perms=()
  for p in "${perms[@]}"; do
    if ! echo "$existing" | jq -e ".permissions.allow // [] | index(\"$p\")" &>/dev/null; then
      needs_perms+=("$p")
    fi
  done

  if [[ ${#needs_perms[@]} -gt 0 ]]; then
    local existing_perms
    existing_perms="$(echo "$existing" | jq '.permissions.allow // []')"
    for p in "${needs_perms[@]}"; do
      existing_perms="$(echo "$existing_perms" | jq --arg p "$p" '. + [$p]')"
    done
    local merged_perms
    merged_perms="$(echo "$existing" | jq --argjson perms "$existing_perms" '.permissions.allow = $perms')"
    echo "$merged_perms" > "$target"
    ok "Added ${#needs_perms[@]} MCP permissions to $label"
  fi
}

info "Claude Code — project-local or global?"
read -rp "Install hook project-local (.claude/settings.local.json)? [Y/n] " ans
if [[ ! "$ans" =~ ^[Nn] ]]; then
  install_claude "$GIT_ROOT/.claude/settings.local.json" "project-local"
else
  info "Install hook globally (~/.claude/settings.json)?"
  read -rp "Add to global settings? [y/N] " ans2
  if [[ "$ans2" =~ ^[Yy] ]]; then
    install_claude "$HOME/.claude/settings.json" "global"
  fi
fi

# -- Step 4: OpenCode install -------------------------------------------------

info "OpenCode — global or per-project?"
read -rp "Symlink plugin to ~/.config/opencode/plugins/? [Y/n] " ans
if [[ ! "$ans" =~ ^[Nn] ]]; then
  mkdir -p "$HOME/.config/opencode/plugins"
  if [[ -n "${OPENCODE_SRC:-}" ]]; then
    ln -sf "$OPENCODE_SRC" "$HOME/.config/opencode/plugins/backlog-guard.js"
    ok "Symlinked $OPENCODE_SRC → ~/.config/opencode/plugins/backlog-guard.js"
  else
    # Compile from TS
    if command -v bun &>/dev/null; then
      bun build "$DIR/opencode-plugin.ts" --outfile "$DIR/opencode-plugin.js" --target=node --format=esm
      ln -sf "$DIR/opencode-plugin.js" "$HOME/.config/opencode/plugins/backlog-guard.js"
      ok "Compiled and symlinked opencode-plugin.js"
    else
      err "Cannot compile opencode-plugin.ts — need bun or a pre-built .js file."
    fi
  fi
else
  info "Add plugin entry to opencode.json?"
  read -rp "Add to $GIT_ROOT/opencode.json? [Y/n] " ans2
  if [[ ! "$ans2" =~ ^[Nn] ]]; then
    local opencode_cfg="$GIT_ROOT/opencode.json"
    if [[ ! -f "$opencode_cfg" ]]; then
      echo '{"$schema":"https://opencode.ai/config.json"}' > "$opencode_cfg"
    fi
    local plugin_path
    if [[ -f "$DIR/opencode-plugin.js" ]]; then
      plugin_path="$(realpath --relative-to="$GIT_ROOT" "$DIR/opencode-plugin.js")"
    elif [[ -f "$DIR/opencode-plugin.ts" ]]; then
      plugin_path="$(realpath --relative-to="$GIT_ROOT" "$DIR/opencode-plugin.ts")"
    else
      plugin_path="./hooks/backlog-guard/opencode-plugin.js"
    fi

    local tmp
    tmp="$(mktemp)"
    jq --arg p "$plugin_path" '.plugin = (.plugin // []) + [$p] | unique' "$opencode_cfg" > "$tmp" && mv "$tmp" "$opencode_cfg"
    ok "Added plugin entry to $opencode_cfg"
  fi
fi

# -- One-liner instructions ---------------------------------------------------

echo ""
info "One-liner install (from repo root):"
echo ""
echo "  Claude Code:"
echo "    /plugin marketplace add ."
echo "    /plugin install backlog-guard@backlog-marketplace"
echo ""
echo "  OpenCode:"
echo '    opencode.json → { "plugin": ["./hooks/backlog-guard/opencode-plugin.js"] }'
echo "    or: npm publish + add to plugin array"
echo ""
echo "  Or from GitHub directly (any project):"
echo "    claude --plugin-dir <path-to-backlog.md>/hooks/backlog-guard"
echo ""

# -- Summary ------------------------------------------------------------------

echo ""
info "Summary"
echo "  Config:   $GIT_ROOT/.backlog-guard"
echo "  Files:    $DIR/"
echo "  Plugin:   $DIR/.claude-plugin/plugin.json"
[[ -f "$CLAUDE_SRC" ]] && echo "  Claude:   $CLAUDE_SRC"
echo ""
info "Reload Claude Code / OpenCode (or start a new session) for changes to take effect."
echo ""
echo "  Quick test:  Read backlog/tasks/back-*.md  (should be blocked)"
