"""Claude CLI adapter — drives the REAL ``claude`` CLI in a terminal (PTY).

It launches the actual ``claude`` binary a customer would run, inside a
pseudo-terminal, types ``/aidlc ...`` like a user, reads the rendered screen,
answers approval-gate menus by keystroke, and detects completion from the
on-disk ``aidlc-docs/aidlc-state.md`` state — exactly the journey the
framework's own ``tests/e2e`` tui-drive tests exercise.

This measures the genuine customer terminal experience (permission modals, the
AskUserQuestion widget render, the Stop-hook forwarding loop). It is the Claude
counterpart to the ``kiro-cli`` adapter — both drive the real vendor CLI.

Requires: the ``claude`` CLI on PATH, ``bun`` (framework tools/hooks run via
``bun .claude/tools/*.ts``), and a POSIX PTY (pexpect — not supported on Windows).
"""

from __future__ import annotations

import json
import logging
import os
import shutil
import sys
import time

from cli_harness.adapter import AdapterConfig, AdapterResult, CLIAdapter
from cli_harness.adapters._aidlc_state import (
    find_aidlc_docs,
    has_generated_code,
    state_status_completed,
    vision_intent,
)
from cli_harness.adapters._pty_terminal import PtyTerminal
from cli_harness.normalizer import normalize_output
from cli_harness.prompt_template import render_v2_prompt

logger = logging.getLogger(__name__)

_CLAUDE_CLI = "claude"


def _log(msg: str) -> None:
    print(f"  [claude-cli] {msg}", file=sys.stderr, flush=True)


class ClaudeCLIAdapter(CLIAdapter):
    """Adapter that drives the real ``claude`` CLI in a PTY (customer fidelity)."""

    def __init__(self, verbose: bool = False):
        self.verbose = verbose

    @property
    def name(self) -> str:
        return "claude-cli"

    def check_prerequisites(self) -> tuple[bool, str]:
        """Verify the ``claude`` CLI, ``bun``, and a POSIX PTY are available."""
        if sys.platform == "win32":
            return False, (
                "claude-cli (PTY) adapter is POSIX-only (uses pexpect). Windows is not supported."
            )
        if shutil.which(_CLAUDE_CLI) is None:
            return False, (
                f"'{_CLAUDE_CLI}' CLI not found on PATH. Install Claude Code "
                "(https://docs.claude.com/en/docs/claude-code)."
            )
        if shutil.which("bun") is None:
            return False, (
                "bun not found on PATH — required by the AIDLC framework's Claude "
                "tools/hooks. Install with `curl -fsSL https://bun.sh/install | bash` "
                "and ensure bun's bin is on the non-interactive shell PATH (~/.zshenv)."
            )
        try:
            import pexpect  # noqa: F401
            import pyte  # noqa: F401
        except ImportError:
            return False, "pexpect and pyte are required (pip install pexpect pyte)."
        return True, "claude CLI, bun, pexpect, and pyte are available"

    def run(self, config: AdapterConfig) -> AdapterResult:
        ok, msg = self.check_prerequisites()
        if not ok:
            return AdapterResult(
                success=False, output_dir=config.output_dir, error=f"Prerequisites not met: {msg}"
            )
        if config.claude_dist_path is None:
            return AdapterResult(
                success=False,
                output_dir=config.output_dir,
                error="claude-cli adapter requires a claude_dist_path (the .claude/ distribution).",
            )

        start_time = time.monotonic()
        config.output_dir.mkdir(parents=True, exist_ok=True)
        workspace = config.output_dir / "workspace"
        workspace.mkdir(exist_ok=True)
        _log(f"Workspace: {workspace}")

        term: PtyTerminal | None = None
        try:
            # Inputs
            shutil.copy2(config.vision_path, workspace / "vision.md")
            _log(f"Copied vision: {config.vision_path}")
            if config.tech_env_path and config.tech_env_path.is_file():
                shutil.copy2(config.tech_env_path, workspace / "tech-env.md")
                _log(f"Copied tech-env: {config.tech_env_path}")

            # Install the .claude/ distribution natively into the workspace.
            claude_dst = workspace / ".claude"
            if claude_dst.exists():
                shutil.rmtree(claude_dst)
            shutil.copytree(config.claude_dist_path, claude_dst)
            _log(f"Installed .claude/ from {config.claude_dist_path}")

            # Override the dist's hardcoded AWS_REGION via settings.local.json.
            if config.aws_region:
                (claude_dst / "settings.local.json").write_text(
                    json.dumps({"env": {"AWS_REGION": config.aws_region}}, indent=2),
                    encoding="utf-8",
                )
                _log(f"Wrote settings.local.json (AWS_REGION={config.aws_region})")

            vision_content = config.vision_path.read_text(encoding="utf-8")
            intent = vision_intent(vision_content)
            has_tech_env = bool(config.tech_env_path and config.tech_env_path.is_file())
            aidlc_cmd = render_v2_prompt(
                intent, scope=config.scope, test_run=config.test_run, tech_env=has_tech_env
            )
            _log(f"/aidlc invocation: {aidlc_cmd!r}")

            # Child env: isolate to project settings + carry AWS region/profile/creds.
            child_env = {**os.environ}
            if config.aws_region:
                child_env["AWS_REGION"] = config.aws_region
                child_env["AWS_DEFAULT_REGION"] = config.aws_region
            if config.aws_profile:
                child_env["AWS_PROFILE"] = config.aws_profile

            # Launch the real `claude` TUI. --setting-sources project isolates the
            # run from user/global settings (mirrors the e2e tui-drive tests);
            # --dangerously-skip-permissions avoids the trust modal in automation.
            cmd = [
                _CLAUDE_CLI,
                "--dangerously-skip-permissions",
                "--setting-sources",
                "project",
            ]
            if config.model:
                cmd += ["--model", config.model]

            log_path = config.output_dir / "claude-cli-session.log"
            _log(f"Session log: {log_path}")

            timeout_remaining = float(config.timeout_seconds)
            with open(log_path, "w", encoding="utf-8") as log_file:
                term = PtyTerminal(
                    cmd,
                    cwd=str(workspace),
                    env=child_env,
                    cols=120,
                    rows=45,
                    logfile=log_file,
                )
                term.start()

                # Clear any startup modals idempotently (trust folder / bypass mode).
                if term.wait_for(r"trust this folder|Do you trust", timeout=30, stable_ms=600):
                    term.send_key("Enter")
                if term.wait_for(r"Bypass Permissions mode", timeout=10, stable_ms=600):
                    term.send_line("2", enter=True)

                # Wait for the input to be genuinely READY before typing. The
                # statusline paints "[AIDLC] ready" (no workflow) or a live phase
                # line once the harness has loaded; require it to be byte-stable so
                # we don't type into a still-painting TUI (which silently drops the
                # keystrokes). Mirrors the e2e tui-drive readiness wait.
                if not term.wait_for(r"\[AIDLC\]|❯", timeout=60, stable_ms=1200):
                    _log("WARNING: input-ready marker not seen; typing anyway")

                # Type the slash command literally (no Enter), let it settle so the
                # TUI registers the full line, then submit Enter as a separate key.
                term.send_line(aidlc_cmd, enter=False)
                time.sleep(1.0)
                term.send_key("Enter")
                _log("Sent /aidlc command — driving forwarding loop")

                # Confirm the command actually submitted: the input box should
                # clear and the workflow should begin (state file appears). If not,
                # retry the submit once (Enter can be swallowed mid-paint).
                started_re = r"IDEATION|INITIALIZATION|Running|aidlc-orchestrate"
                if not term.wait_for(started_re, timeout=45):
                    _log("No workflow start detected — retrying submit (Enter)")
                    term.send_key("Enter")

                def _done() -> bool:
                    return state_status_completed(workspace) and has_generated_code(workspace)

                # Under --test-run the engine auto-approves gates and the Stop hook
                # keeps the loop self-driving; on the rare visible menu, accept the
                # highlighted default. Terminate on the on-disk Completed signal.
                completed = term.drive_until(
                    _done,
                    idle_pattern=None,
                    on_idle=lambda t: t.answer_gate_default(),
                    timeout=timeout_remaining,
                    idle_timeout=min(300.0, timeout_remaining),
                )
                term.close()

            elapsed_seconds = time.monotonic() - start_time
            if completed:
                _log("Workflow complete (aidlc-state.md Status: Completed + code)")
            else:
                _log(f"Stopped without completion signal after {elapsed_seconds:.0f}s")

            _log("Workspace contents:")
            for item in sorted(workspace.iterdir()):
                _log(f"  {item.name}/" if item.is_dir() else f"  {item.name}")

            # Extract aidlc-docs
            src_docs = find_aidlc_docs(workspace)
            dst_docs = config.output_dir / "aidlc-docs"
            if src_docs is not None:
                if dst_docs.exists():
                    shutil.rmtree(dst_docs)
                shutil.copytree(src_docs, dst_docs)
                _log(f"Extracted aidlc-docs: {src_docs} → {dst_docs}")

            normalize_output(
                source_dir=workspace,
                output_dir=config.output_dir,
                adapter_name=self.name,
                elapsed_seconds=elapsed_seconds,
                token_usage={"model": config.model or "", "completed": completed},
            )

            has_docs = dst_docs.is_dir() and any(dst_docs.iterdir())
            if completed and has_docs:
                return AdapterResult(
                    success=True,
                    output_dir=config.output_dir,
                    aidlc_docs_dir=dst_docs,
                    workspace_dir=workspace,
                    elapsed_seconds=elapsed_seconds,
                )

            error_detail = (
                "claude-cli produced no aidlc-docs/"
                if not has_docs
                else "claude-cli did not reach Status: Completed (workflow may be incomplete)."
            )
            return AdapterResult(
                success=has_docs and completed,
                output_dir=config.output_dir,
                aidlc_docs_dir=dst_docs if has_docs else None,
                workspace_dir=workspace,
                error=error_detail,
                elapsed_seconds=elapsed_seconds,
            )

        except Exception as exc:
            elapsed_seconds = time.monotonic() - start_time
            if term is not None:
                term.close()
            logger.exception("claude-cli adapter run failed")
            return AdapterResult(
                success=False,
                output_dir=config.output_dir,
                workspace_dir=workspace if workspace.exists() else None,
                error=f"claude-cli adapter error: {exc}",
                elapsed_seconds=elapsed_seconds,
            )
