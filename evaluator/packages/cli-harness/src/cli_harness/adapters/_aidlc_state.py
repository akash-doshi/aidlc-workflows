"""Shared AIDLC harness helpers for the CLI adapters.

The Claude Code and Kiro harnesses now share one contract (the ``/aidlc`` skill,
a forwarding loop over ``bun .{claude,kiro}/tools/aidlc-orchestrate.ts``, and
markdown workflow state at ``aidlc-docs/aidlc-state.md``). These helpers encode
that shared contract so both adapters stay in lock-step.

State-file field format mirrors the framework's own ``getField`` regex in
``tools/aidlc-lib.ts``: ``- **Field**: value``.
"""

from __future__ import annotations

import re
from pathlib import Path

# Completion signal: the state file's Status field set to "Completed".
_STATE_STATUS_RE = re.compile(r"^- \*\*Status\*\*:[ \t]*Completed\s*$", re.MULTILINE)
_STATE_FIELD_RE_TEMPLATE = r"^- \*\*{field}\*\*:[ \t]*(.*)$"

# Generated source extensions across the languages AIDLC may emit (Python,
# TypeScript/JS, Go, Java, Rust, etc.). Used for a language-agnostic
# "did the workflow actually produce code?" check.
_SOURCE_EXTS = {
    ".py",
    ".ts",
    ".tsx",
    ".js",
    ".jsx",
    ".go",
    ".java",
    ".rs",
    ".rb",
    ".cs",
    ".kt",
    ".swift",
    ".cpp",
    ".c",
    ".h",
}
_SKIP_PATH_PARTS = (".venv", "__pycache__", ".cache", ".claude", ".kiro", "node_modules")


def state_status_completed(workspace: Path) -> bool:
    """Return True if any aidlc-state.md under the workspace shows Status: Completed."""
    for state_file in workspace.rglob("aidlc-state.md"):
        try:
            content = state_file.read_text(encoding="utf-8")
        except OSError:
            continue
        if _STATE_STATUS_RE.search(content):
            return True
    return False


def read_state_field(workspace: Path, field: str) -> str | None:
    """Read a single ``- **Field**: value`` from aidlc-state.md, or None."""
    pattern = re.compile(_STATE_FIELD_RE_TEMPLATE.format(field=re.escape(field)), re.MULTILINE)
    for state_file in workspace.rglob("aidlc-state.md"):
        try:
            content = state_file.read_text(encoding="utf-8")
        except OSError:
            continue
        m = pattern.search(content)
        if m:
            return m.group(1).strip()
    return None


def has_generated_code(workspace: Path) -> bool:
    """Return True if the workspace contains generated application source.

    Language-agnostic: any first-party source file (excluding the harness dist,
    venvs, and vendored deps) counts.
    """
    for f in workspace.rglob("*"):
        if not f.is_file() or f.suffix not in _SOURCE_EXTS:
            continue
        if any(part in _SKIP_PATH_PARTS for part in f.parts):
            continue
        return True
    return False


def vision_intent(vision_content: str) -> str:
    """Derive a one-line intent for the ``/aidlc`` invocation from the vision doc.

    Uses the first markdown H1 title if present, else the first non-empty line.
    The full vision.md is read by the agent separately — this is just the
    scope-detection seed passed to ``/aidlc``.
    """
    for line in vision_content.splitlines():
        stripped = line.strip()
        if stripped.startswith("# "):
            return stripped[2:].strip()
    for line in vision_content.splitlines():
        if line.strip():
            return line.strip()
    return "Build the project described in vision.md"


def find_aidlc_docs(workspace: Path) -> Path | None:
    """Find the aidlc-docs/ directory (written at the workspace root).

    Checks ``workspace/aidlc-docs`` first, then one level deep under non-dotted
    subdirectories. Requires at least one markdown artifact so an empty scaffold
    isn't mistaken for real output.
    """
    direct = workspace / "aidlc-docs"
    if direct.is_dir() and any(direct.rglob("*.md")):
        return direct
    for child in sorted(workspace.iterdir()):
        if child.is_dir() and not child.name.startswith("."):
            candidate = child / "aidlc-docs"
            if candidate.is_dir() and any(candidate.rglob("*.md")):
                return candidate
    return None


def workflow_not_done(workspace: Path) -> tuple[bool, str | None]:
    """Inspect markdown state to decide whether the workflow still has work.

    Returns (has_pending_work, detail) where detail is the next/in-progress
    stage name for a nudge message. has_pending_work is False when there is no
    state file or the remaining-stage fields are empty/none.
    """
    next_stage = read_state_field(workspace, "Next Stage")
    in_progress = read_state_field(workspace, "In Progress")
    if next_stage is None and in_progress is None:
        return False, None
    not_done = (next_stage or "").lower() not in ("", "none") or (
        in_progress or ""
    ).lower() not in ("", "none")
    if not_done:
        return True, (next_stage or in_progress or "the next stage")
    return False, None
