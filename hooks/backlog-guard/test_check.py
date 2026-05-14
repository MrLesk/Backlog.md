"""
Tests for backlog-guard check.py.

Run with: python -m pytest hooks/backlog-guard/test_check.py -v
Requires: pyyaml (pip install pyyaml), pytest
"""
import json
import os
import subprocess
import sys
from pathlib import Path

import pytest

GUARD = Path(__file__).parent / "guard.sh"


def _run_hook(
    tool: str,
    file_path: str = "",
    command: str = "",
    cwd: Path | None = None,
    extra_env: dict | None = None,
) -> tuple[int, dict | None]:
    """Invoke guard.sh and return (returncode, parsed_json_or_None)."""
    payload: dict = {"tool_name": tool, "tool_input": {}}
    if file_path:
        payload["tool_input"]["file_path"] = file_path
    if command:
        payload["tool_input"]["command"] = command

    env = os.environ.copy()
    # Strip any inherited BACKLOG_GUARD_DIRS so tests control config via files
    env.pop("BACKLOG_GUARD_DIRS", None)
    if extra_env:
        env.update(extra_env)

    result = subprocess.run(
        ["bash", str(GUARD)],
        input=json.dumps(payload),
        capture_output=True,
        text=True,
        env=env,
        cwd=str(cwd) if cwd else str(Path(__file__).parent),
    )
    out = result.stdout.strip()
    parsed = json.loads(out) if out else None
    return result.returncode, parsed


def _is_denied(parsed: dict | None) -> bool:
    if not parsed:
        return False
    return (
        parsed.get("hookSpecificOutput", {}).get("permissionDecision") == "deny"
    )


def _denial_reason(parsed: dict | None) -> str:
    if not parsed:
        return ""
    return parsed.get("hookSpecificOutput", {}).get("permissionDecisionReason", "")


def _denial_context(parsed: dict | None) -> str:
    if not parsed:
        return ""
    return parsed.get("hookSpecificOutput", {}).get("additionalContext", "")


# -- Fixtures -----------------------------------------------------------------


@pytest.fixture()
def backlog_tree(tmp_path: Path) -> Path:
    """Create a minimal backlog project tree with a .backlog-guard config."""
    backlog = tmp_path / "backlog"
    (backlog / "tasks").mkdir(parents=True)
    (backlog / "docs").mkdir()
    (backlog / "config.yml").write_text("project: test\n")
    (tmp_path / ".backlog-guard").write_text("dirs:\n  - backlog/\n")
    return tmp_path


@pytest.fixture()
def task_file(backlog_tree: Path) -> Path:
    f = backlog_tree / "backlog" / "tasks" / "back-123 - My Feature.md"
    f.write_text("# Task\n## Status\nIn Progress\n")
    return f


@pytest.fixture()
def doc_file(backlog_tree: Path) -> Path:
    f = backlog_tree / "backlog" / "docs" / "architecture.md"
    f.write_text("# Architecture\n")
    return f


# -- Tests --------------------------------------------------------------------


def test_read_task_file_is_blocked(backlog_tree: Path, task_file: Path) -> None:
    """Read on a task file must be denied with BACK-123 in the reason."""
    _, parsed = _run_hook("Read", file_path=str(task_file), cwd=backlog_tree)
    assert _is_denied(parsed), "Expected deny for Read on task file"
    reason = _denial_reason(parsed)
    assert "BACK-123" in reason, f"Task ID missing from reason: {reason}"
    context = _denial_context(parsed)
    assert "mcp__backlog__task_view" in context, f"MCP suggestion missing: {context}"
    assert "backlog task BACK-123" in context, f"CLI suggestion missing: {context}"


def test_read_outside_backlog_is_allowed(backlog_tree: Path) -> None:
    """Read on a file outside the protected directory must not be blocked."""
    src = backlog_tree / "src" / "main.ts"
    src.parent.mkdir()
    src.write_text("const x = 1;\n")
    _, parsed = _run_hook("Read", file_path=str(src), cwd=backlog_tree)
    assert not _is_denied(parsed), "Should NOT deny Read on src/main.ts"


def test_bash_cat_task_is_blocked(backlog_tree: Path, task_file: Path) -> None:
    """Bash cat on a task file must be denied."""
    _, parsed = _run_hook(
        "Bash", command=f"cat {task_file}", cwd=backlog_tree
    )
    assert _is_denied(parsed), "Expected deny for Bash cat on task file"


def test_edit_doc_file_is_blocked(backlog_tree: Path, doc_file: Path) -> None:
    """Edit on a doc file must be denied with document_update suggestion."""
    _, parsed = _run_hook("Edit", file_path=str(doc_file), cwd=backlog_tree)
    assert _is_denied(parsed), "Expected deny for Edit on doc file"
    context = _denial_context(parsed)
    assert "mcp__backlog__document_update" in context, f"Doc MCP suggestion missing: {context}"


def test_bash_pipeline_grep_is_not_blocked(backlog_tree: Path, task_file: Path) -> None:
    """grep on stdin (pipeline) must never be blocked — only file-arg grep is."""
    cmd = f"cat something.txt | grep {task_file.name}"
    _, parsed = _run_hook("Bash", command=cmd, cwd=backlog_tree)
    assert not _is_denied(parsed), "Pipeline grep should NOT be denied"


def test_autodetect_from_cwd_blocks_task(tmp_path: Path) -> None:
    """Without .backlog-guard, auto-detect via backlog/config.yml still blocks."""
    backlog = tmp_path / "backlog"
    (backlog / "tasks").mkdir(parents=True)
    (backlog / "config.yml").write_text("project: auto\n")
    task = backlog / "tasks" / "back-789 - Auto Task.md"
    task.write_text("# Auto\n")
    # No .backlog-guard file — relies on auto-detect
    _, parsed = _run_hook("Read", file_path=str(task), cwd=tmp_path)
    assert _is_denied(parsed), "Auto-detect should block Read on task file"
    assert "BACK-789" in _denial_reason(parsed)


def test_no_protected_dirs_exits_clean(tmp_path: Path) -> None:
    """With no .backlog-guard and no backlog/config.yml, hook exits cleanly."""
    unrelated = tmp_path / "src" / "main.py"
    unrelated.parent.mkdir()
    unrelated.write_text("x = 1\n")
    code, parsed = _run_hook("Read", file_path=str(unrelated), cwd=tmp_path)
    assert parsed is None, "Should produce no output when no backlog detected"
    assert code == 0


def test_config_file_multiple_dirs(tmp_path: Path) -> None:
    """Both directories listed in .backlog-guard must be protected."""
    for d in ("backlog-a", "backlog-b"):
        (tmp_path / d / "tasks").mkdir(parents=True)
        (tmp_path / d / "config.yml").write_text("project: test\n")
    (tmp_path / ".backlog-guard").write_text(
        "dirs:\n  - backlog-a/\n  - backlog-b/\n"
    )
    task_a = tmp_path / "backlog-a" / "tasks" / "back-1 - A.md"
    task_b = tmp_path / "backlog-b" / "tasks" / "back-2 - B.md"
    task_a.write_text("# A\n")
    task_b.write_text("# B\n")

    _, parsed_a = _run_hook("Read", file_path=str(task_a), cwd=tmp_path)
    _, parsed_b = _run_hook("Read", file_path=str(task_b), cwd=tmp_path)
    assert _is_denied(parsed_a), "backlog-a task must be blocked"
    assert _is_denied(parsed_b), "backlog-b task must be blocked"


def test_grep_tool_on_tasks_is_blocked(backlog_tree: Path) -> None:
    """Grep tool with path=backlog/tasks/ must be denied with task_search suggestion."""
    tasks_dir = backlog_tree / "backlog" / "tasks"
    payload = {
        "tool_name": "Grep",
        "tool_input": {"pattern": "status", "path": str(tasks_dir)},
    }
    env = os.environ.copy()
    env.pop("BACKLOG_GUARD_DIRS", None)
    result = subprocess.run(
        ["bash", str(GUARD)],
        input=json.dumps(payload),
        capture_output=True,
        text=True,
        env=env,
        cwd=str(backlog_tree),
    )
    parsed = json.loads(result.stdout.strip()) if result.stdout.strip() else None
    assert _is_denied(parsed), "Grep on backlog/tasks/ must be denied"
    assert "mcp__backlog__task_search" in _denial_context(parsed)


def test_grep_tool_outside_backlog_is_allowed(backlog_tree: Path) -> None:
    """Grep tool with path outside protected dir must not be blocked."""
    src = backlog_tree / "src"
    src.mkdir(exist_ok=True)
    payload = {
        "tool_name": "Grep",
        "tool_input": {"pattern": "status", "path": str(src)},
    }
    env = os.environ.copy()
    env.pop("BACKLOG_GUARD_DIRS", None)
    result = subprocess.run(
        ["bash", str(GUARD)],
        input=json.dumps(payload),
        capture_output=True,
        text=True,
        env=env,
        cwd=str(backlog_tree),
    )
    parsed = json.loads(result.stdout.strip()) if result.stdout.strip() else None
    assert not _is_denied(parsed), "Grep on src/ must NOT be denied"


def test_write_new_task_suggests_create(backlog_tree: Path) -> None:
    """Write to a file without back-NNN in name must suggest task_create."""
    new_file = backlog_tree / "backlog" / "tasks" / "new-task-draft.md"
    _, parsed = _run_hook("Write", file_path=str(new_file), cwd=backlog_tree)
    assert _is_denied(parsed), "Write on new task file must be denied"
    context = _denial_context(parsed)
    assert "mcp__backlog__task_create" in context, f"task_create missing: {context}"


def test_decision_file_is_blocked(backlog_tree: Path) -> None:
    """Read on backlog/decisions/ must be denied with search suggestion."""
    (backlog_tree / "backlog" / "decisions").mkdir(exist_ok=True)
    adr = backlog_tree / "backlog" / "decisions" / "adr-001-use-markdown.md"
    adr.write_text("# ADR 001\n")
    _, parsed = _run_hook("Read", file_path=str(adr), cwd=backlog_tree)
    assert _is_denied(parsed), "Read on decisions file must be denied"
    context = _denial_context(parsed)
    assert "backlog search" in context, f"search suggestion missing: {context}"
