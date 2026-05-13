"""
PreToolUse hook: block Read/Write/Edit/Bash on files inside configured
backlog directories and redirect to MCP tools or CLI commands.

Config discovery order:
  1. .backlog-guard YAML at git root (dirs: list of relative paths)
  2. Walk CWD upward looking for .backlog-guard
  3. Auto-detect: walk CWD upward looking for backlog/config.yml
  4. Nothing found -> exit 0 (not a backlog project, no false positives)
"""
import json
import os
import re
import shlex
import subprocess
import sys
from pathlib import Path

import yaml


# -- Config discovery ---------------------------------------------------------

def _find_config_file() -> Path | None:
    """Walk up from CWD to git root looking for .backlog-guard."""
    try:
        git_root = subprocess.check_output(
            ["git", "rev-parse", "--show-toplevel"],
            stderr=subprocess.DEVNULL,
            text=True,
        ).strip()
        candidate = Path(git_root) / ".backlog-guard"
        if candidate.exists():
            return candidate
    except Exception:
        pass
    p = Path.cwd()
    for _ in range(4):
        candidate = p / ".backlog-guard"
        if candidate.exists():
            return candidate
        parent = p.parent
        if parent == p:
            break
        p = parent
    return None


def _resolve_protected_dirs() -> list[Path]:
    config_file = _find_config_file()
    if config_file:
        with open(config_file) as f:
            data = yaml.safe_load(f) or {}
        raw_dirs = data.get("dirs", [])
        root = config_file.parent
        return [(root / d).resolve() for d in raw_dirs if d]

    # Auto-detect fallback: walk up looking for backlog/config.yml
    candidate = Path.cwd()
    for _ in range(4):
        if (candidate / "backlog" / "config.yml").exists():
            return [(candidate / "backlog").resolve()]
        parent = candidate.parent
        if parent == candidate:
            break
        candidate = parent
    return []


PROTECTED = _resolve_protected_dirs()

if not PROTECTED:
    sys.exit(0)  # Not a backlog project -- bail cleanly, no false positives


# -- Hook context from env vars set by guard.sh -------------------------------

tool = os.environ.get("HOOK_TOOL", "")
fp   = os.environ.get("HOOK_FP", "")
cmd  = os.environ.get("HOOK_CMD", "")
try:
    tool_input = json.loads(os.environ.get("HOOK_INPUT", "{}"))
except json.JSONDecodeError:
    tool_input = {}


# -- Path helpers -------------------------------------------------------------

def is_protected(path_str: str) -> Path | None:
    """Return the matching protected dir if path_str is inside one, else None."""
    if not path_str:
        return None
    try:
        p = Path(path_str)
        if not p.is_absolute():
            p = Path.cwd() / p
        p = p.resolve()
    except Exception:
        return None
    for d in PROTECTED:
        try:
            p.relative_to(d)
            return d
        except ValueError:
            pass
    return None


def extract_task_id(path_str: str) -> str | None:
    m = re.search(r"back-(\d+)", Path(path_str).name, re.IGNORECASE)
    return f"BACK-{m.group(1)}" if m else None


def classify_path(path_str: str) -> str:
    for part in Path(path_str).parts:
        if part == "tasks":      return "task"
        if part == "completed":  return "task"
        if part == "drafts":     return "task"
        if part == "docs":       return "doc"
        if part == "decisions":  return "decision"
        if part == "milestones": return "milestone"
    if "config" in Path(path_str).name:
        return "config"
    return "other"


# -- Bash command analysis ----------------------------------------------------

READ_CMDS = {"cat", "head", "tail", "less", "more", "bat"}
GREP_CMDS = {"grep", "egrep", "fgrep"}
OPTS_WITH_VALUE = {
    "-e", "-f", "-m", "-A", "-B", "-C", "-d",
    "--include", "--exclude", "--include-from", "--exclude-from",
}


def bash_targets_protected(seg: str) -> str | None:
    """Return the first protected path found in the first pipeline segment."""
    try:
        tokens = shlex.split(seg)
    except ValueError:
        tokens = seg.split()
    if not tokens:
        return None

    cmd_name = os.path.basename(re.sub(r"^[&;\s]+", "", tokens[0]))

    if cmd_name in READ_CMDS:
        for t in tokens[1:]:
            if not t.startswith("-") and is_protected(t):
                return t

    elif cmd_name in GREP_CMDS:
        # positional[0] = pattern, rest = file args -- only file args are checked
        positional, i = [], 1
        while i < len(tokens):
            t = tokens[i]
            if t.startswith("-") and t in OPTS_WITH_VALUE:
                i += 2
                continue
            elif not t.startswith("-"):
                positional.append(t)
            i += 1
        for farg in positional[1:]:
            if is_protected(farg):
                return farg

    elif cmd_name == "find":
        # Block if the search root is a protected directory
        for t in tokens[1:]:
            if t.startswith("-"):
                break
            if is_protected(t):
                return t

    return None


# -- Decide whether to block --------------------------------------------------

block        = False
blocked_path = fp
matched_dir: Path | None = None

if tool in ("Read", "Edit", "Write"):
    matched_dir = is_protected(fp)
    if matched_dir:
        block = True
elif tool == "Grep":
    grep_path = tool_input.get("path", "")
    matched_dir = is_protected(grep_path)
    if matched_dir:
        block = True
        blocked_path = grep_path
elif tool == "Bash":
    first_seg = cmd.split("|")[0]
    hit = bash_targets_protected(first_seg)
    if hit:
        block = True
        blocked_path = hit
        matched_dir = is_protected(hit)

if not block:
    sys.exit(0)


# -- Build a directed, concrete stop message ----------------------------------

kind    = classify_path(blocked_path)
task_id = extract_task_id(blocked_path) if kind == "task" else None
op      = tool if tool in ("Read", "Edit", "Write") else "Read"


def _task_suggestions(op: str, tid: str | None) -> str:
    id_arg = tid or "BACK-NNN"
    if op == "Read":
        return (
            f'MCP:  mcp__backlog__task_view(id="{id_arg}")\n'
            f"CLI:  backlog task {id_arg}"
        )
    elif op == "Write" and tid is None:
        return (
            'MCP:  mcp__backlog__task_create(title="...", description="...")\n'
            'CLI:  backlog task create "Title" -d "..."'
        )
    else:
        return (
            f'MCP:  mcp__backlog__task_edit(id="{id_arg}", plan="...", notes="...")\n'
            f'CLI:  backlog task edit {id_arg} --plan "..." --append-notes "..."'
        )


def _doc_suggestions(op: str) -> str:
    name = Path(blocked_path).name
    if op == "Read":
        return (
            f'MCP:  mcp__backlog__document_view(path="{name}")\n'
            f"CLI:  backlog doc {name}"
        )
    elif op == "Write" and not Path(blocked_path).exists():
        return (
            f'MCP:  mcp__backlog__document_create(title="...", content="...")\n'
            f'CLI:  backlog doc create "Title"'
        )
    else:
        return (
            f'MCP:  mcp__backlog__document_update(path="{name}", content="...")\n'
            f"CLI:  backlog doc update {name}"
        )


def _generic_suggestions() -> str:
    if kind == "milestone":
        return "MCP:  mcp__backlog__milestone_list()\nCLI:  backlog milestones"
    if kind == "config":
        return "CLI:  backlog config list\nCLI:  backlog config get <key>"
    if kind == "decision":
        return (
            'MCP:  mcp__backlog__task_search(query="<keyword>")  '
            'or  mcp__backlog__document_view(path="<name>")\n'
            'CLI:  backlog search "<keyword>"'
        )
    return (
        'MCP:  mcp__backlog__task_list()  or  mcp__backlog__task_search(query="...")\n'
        'CLI:  backlog task list  or  backlog search "..."'
    )


def _grep_suggestions(pattern: str) -> str:
    if kind == "doc":
        return (
            f'MCP:  mcp__backlog__document_search(query="{pattern}")\n'
            f'CLI:  backlog search "{pattern}"'
        )
    elif kind in ("task", "other"):
        return (
            f'MCP:  mcp__backlog__task_search(query="{pattern}")\n'
            f'CLI:  backlog search "{pattern}"'
        )
    return (
        f'MCP:  mcp__backlog__task_search(query="{pattern}")'
        f'  or  mcp__backlog__document_search(query="{pattern}")\n'
        f'CLI:  backlog search "{pattern}"'
    )


if tool == "Grep":
    grep_pattern = tool_input.get("pattern", "...")
    suggestion = _grep_suggestions(grep_pattern)
elif kind == "task":
    suggestion = _task_suggestions(op, task_id)
elif kind == "doc":
    suggestion = _doc_suggestions(op)
else:
    suggestion = _generic_suggestions()

config_src = _find_config_file() or "auto-detected"

if tool == "Grep":
    header = "BACKLOG GUARD -- Grep on backlog directory is forbidden."
elif task_id:
    header = f"BACKLOG GUARD -- {tool} on task file ({task_id}) is forbidden."
else:
    header = f"BACKLOG GUARD -- {tool} on backlog directory is forbidden."

short_reason = (
    f"⛔ {header}\n"
    f"All backlog data access must go through MCP tools or the backlog CLI.\n"
    f"Target: {blocked_path}"
)

context = (
    f"USE ONE OF THESE INSTEAD:\n"
    f"{suggestion}\n\n"
    f"Protected directory: {matched_dir}\n"
    f"Config: {config_src}"
)

print(json.dumps({
    "hookSpecificOutput": {
        "hookEventName": "PreToolUse",
        "permissionDecision": "deny",
        "permissionDecisionReason": short_reason,
        "additionalContext": context,
    }
}))
