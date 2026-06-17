"""Tests for the shared AIDLC harness state helpers and adapter conformance.

Covers the contract both the claude-cli and kiro-cli adapters now share:
markdown `aidlc-docs/aidlc-state.md` completion + language-agnostic code detection.
"""

from __future__ import annotations

from pathlib import Path

from cli_harness.adapters._aidlc_state import (
    find_aidlc_docs,
    has_generated_code,
    read_state_field,
    state_status_completed,
    vision_intent,
    workflow_not_done,
)

_STATE_COMPLETED = """\
# AIDLC State

## Current Status
- **Lifecycle Phase**: CONSTRUCTION
- **Current Stage**: build-and-test
- **Next Stage**: none
- **Status**: Completed
- **Last Updated**: 2026-01-01T00:00:00Z
"""

_STATE_RUNNING = """\
# AIDLC State

## Current Status
- **Lifecycle Phase**: CONSTRUCTION
- **Current Stage**: code-generation
- **Next Stage**: build-and-test
- **In Progress**: code-generation
- **Status**: Running
"""


def _write_state(workspace: Path, content: str) -> None:
    docs = workspace / "aidlc-docs"
    docs.mkdir(parents=True, exist_ok=True)
    (docs / "aidlc-state.md").write_text(content, encoding="utf-8")


class TestStateStatusCompleted:
    def test_completed(self, tmp_path: Path):
        _write_state(tmp_path, _STATE_COMPLETED)
        assert state_status_completed(tmp_path) is True

    def test_running(self, tmp_path: Path):
        _write_state(tmp_path, _STATE_RUNNING)
        assert state_status_completed(tmp_path) is False

    def test_no_state_file(self, tmp_path: Path):
        assert state_status_completed(tmp_path) is False


class TestReadStateField:
    def test_reads_fields(self, tmp_path: Path):
        _write_state(tmp_path, _STATE_RUNNING)
        assert read_state_field(tmp_path, "Next Stage") == "build-and-test"
        assert read_state_field(tmp_path, "In Progress") == "code-generation"
        assert read_state_field(tmp_path, "Status") == "Running"

    def test_missing_field(self, tmp_path: Path):
        _write_state(tmp_path, _STATE_COMPLETED)
        assert read_state_field(tmp_path, "Nonexistent Field") is None


class TestWorkflowNotDone:
    def test_running_has_pending(self, tmp_path: Path):
        _write_state(tmp_path, _STATE_RUNNING)
        pending, detail = workflow_not_done(tmp_path)
        assert pending is True
        assert detail == "build-and-test"

    def test_completed_no_pending(self, tmp_path: Path):
        _write_state(tmp_path, _STATE_COMPLETED)
        pending, _ = workflow_not_done(tmp_path)
        assert pending is False

    def test_no_state_no_pending(self, tmp_path: Path):
        pending, detail = workflow_not_done(tmp_path)
        assert pending is False
        assert detail is None


class TestHasGeneratedCode:
    def test_python_detected(self, tmp_path: Path):
        (tmp_path / "app.py").write_text("print('hi')")
        assert has_generated_code(tmp_path) is True

    def test_typescript_detected(self, tmp_path: Path):
        (tmp_path / "src").mkdir()
        (tmp_path / "src" / "index.ts").write_text("export const x = 1;")
        assert has_generated_code(tmp_path) is True

    def test_ignores_harness_and_venv(self, tmp_path: Path):
        for sub in (".venv", ".claude", ".kiro", "node_modules"):
            d = tmp_path / sub
            d.mkdir()
            (d / "vendored.py").write_text("x = 1")
        assert has_generated_code(tmp_path) is False

    def test_docs_only_no_code(self, tmp_path: Path):
        _write_state(tmp_path, _STATE_COMPLETED)
        (tmp_path / "aidlc-docs" / "requirements.md").write_text("# reqs")
        assert has_generated_code(tmp_path) is False


class TestVisionIntent:
    def test_uses_h1(self):
        assert vision_intent("# Scientific Calculator API\n\nDetails...") == (
            "Scientific Calculator API"
        )

    def test_falls_back_to_first_line(self):
        assert vision_intent("Build a todo app\nmore text") == "Build a todo app"

    def test_empty(self):
        assert vision_intent("   \n\n") == "Build the project described in vision.md"


class TestFindAidlcDocs:
    def test_root_level(self, tmp_path: Path):
        _write_state(tmp_path, _STATE_COMPLETED)
        assert find_aidlc_docs(tmp_path) == tmp_path / "aidlc-docs"

    def test_empty_scaffold_ignored(self, tmp_path: Path):
        (tmp_path / "aidlc-docs").mkdir()  # no .md inside
        assert find_aidlc_docs(tmp_path) is None
