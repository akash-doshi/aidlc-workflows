"""Claude Code adapter — drives AIDLC workflows via the claude-agent-sdk.

Uses the Python claude-agent-sdk (pip install claude-agent-sdk) for programmatic
headless execution with a Bedrock-backed human simulator at approval gates.

## v2 agentic execution (default when claude_dist_path is set)

When ``AdapterConfig.claude_dist_path`` points to the claude
distribution (``dist/claude/.claude``), the adapter:

1. Copies the entire ``.claude/`` tree into the workspace so Claude Code picks up
   the ``aidlc`` skill, agents, hooks, tools, and settings natively. Requires
   ``bun`` on PATH — the framework's tools and hooks run via ``bun .claude/tools/*.ts``.
2. Writes a ``.claude/settings.local.json`` overriding ``AWS_REGION`` to the run's
   region (the shipped settings.json pins us-east-1).
3. Drives the ``/aidlc <intent> --scope <scope> --test-run`` skill, which runs a
   self-directed forwarding loop over the 32-stage workflow.
4. Intercepts ``AskUserQuestion`` tool calls via ``can_use_tool`` and routes them
   to the Bedrock human simulator (rarely fires under ``--test-run``).
5. Detects completion by reading ``aidlc-docs/aidlc-state.md`` for
   ``- **Status**: Completed``.

## v1 legacy execution (when claude_dist_path is not set)

Falls back to the original approach: copies AIDLC rules as a flat ``aidlc-rules/``
directory and sends a monolithic EXECUTOR_SYSTEM_PROMPT.
"""

from __future__ import annotations

import asyncio
import json
import logging
import shutil
import sys
import time
from pathlib import Path

from cli_harness.adapter import AdapterConfig, AdapterResult, CLIAdapter
from cli_harness.adapters._aidlc_state import (
    find_aidlc_docs,
    has_generated_code,
    state_status_completed,
    vision_intent,
    workflow_not_done,
)
from cli_harness.human_analog import generate_human_response
from cli_harness.normalizer import normalize_output
from cli_harness.prompt_template import render_prompt, render_v2_prompt

logger = logging.getLogger(__name__)

_CLAUDE_CLI = "claude"


def _log(msg: str) -> None:
    print(f"  [claude-code] {msg}", file=sys.stderr, flush=True)


class ClaudeCodeAdapter(CLIAdapter):
    """Adapter for Claude Code using the claude-agent-sdk.

    Uses the Python SDK for programmatic headless execution, routing
    AskUserQuestion gates to the Bedrock human simulator.
    """

    def __init__(self, verbose: bool = False):
        self.verbose = verbose

    @property
    def name(self) -> str:
        return "claude-code"

    def check_prerequisites(self) -> tuple[bool, str]:
        """Verify that claude-agent-sdk and bun are installed.

        bun is required because the claude-code framework's tools and hooks
        run via ``bun .claude/tools/*.ts``.
        """
        try:
            import claude_agent_sdk  # noqa: F401
        except ImportError:
            return False, ("claude-agent-sdk not found. Install it: pip install claude-agent-sdk")
        if shutil.which("bun") is None:
            return False, (
                "bun not found on PATH — required by the claude-code framework "
                "tools/hooks. Install with `curl -fsSL https://bun.sh/install | bash` "
                "and ensure bun's bin is on the non-interactive shell PATH (~/.zshenv)."
            )
        return True, "claude-agent-sdk and bun are installed"

    def run(self, config: AdapterConfig) -> AdapterResult:
        """Execute the full AIDLC workflow through the claude-agent-sdk."""
        ok, msg = self.check_prerequisites()
        if not ok:
            return AdapterResult(
                success=False,
                output_dir=config.output_dir,
                error=f"Prerequisites not met: {msg}",
            )

        return asyncio.run(self._run_async(config))

    def _is_workflow_complete(self, workspace: Path) -> bool:
        """True only when aidlc-state.md shows Status: Completed AND code exists.

        The generated-code check is language-agnostic (any first-party source
        file), so non-Python scopes are detected correctly.
        """
        return state_status_completed(workspace) and has_generated_code(workspace)

    async def _run_async(self, config: AdapterConfig) -> AdapterResult:
        from claude_agent_sdk import ClaudeAgentOptions, ClaudeSDKClient
        from claude_agent_sdk.types import (
            AssistantMessage,
            PermissionResultAllow,
            ResultMessage,
            TextBlock,
        )

        start_time = time.monotonic()
        config.output_dir.mkdir(parents=True, exist_ok=True)
        workspace = config.output_dir / "workspace"
        workspace.mkdir(exist_ok=True)
        _log(f"Workspace: {workspace}")

        try:
            # Copy input documents
            shutil.copy2(config.vision_path, workspace / "vision.md")
            _log(f"Copied vision: {config.vision_path}")
            if config.tech_env_path and config.tech_env_path.is_file():
                shutil.copy2(config.tech_env_path, workspace / "tech-env.md")
                _log(f"Copied tech-env: {config.tech_env_path}")

            is_v2 = config.claude_dist_path is not None

            if is_v2:
                claude_dst = workspace / ".claude"
                if claude_dst.exists():
                    shutil.rmtree(claude_dst)
                shutil.copytree(config.claude_dist_path, claude_dst)
                _log(f"Installed .claude/ from {config.claude_dist_path}")

                # Override the dist's hardcoded AWS_REGION (us-east-1) via the
                # framework-sanctioned settings.local.json channel, so Bedrock
                # calls hit the region the run is configured for.
                if config.aws_region:
                    local_settings = claude_dst / "settings.local.json"
                    local_settings.write_text(
                        json.dumps({"env": {"AWS_REGION": config.aws_region}}, indent=2),
                        encoding="utf-8",
                    )
                    _log(f"Wrote settings.local.json (AWS_REGION={config.aws_region})")

                # Derive a one-line intent from the vision title for the /aidlc invocation.
                vision_content = config.vision_path.read_text(encoding="utf-8")
                intent = vision_intent(vision_content)
                initial_prompt = config.prompt_template or render_v2_prompt(
                    intent, scope=config.scope, test_run=config.test_run
                )
                _log(f"Using /aidlc skill (scope={config.scope}, test_run={config.test_run})")
            else:
                rules_dir = workspace / "aidlc-rules"
                rules_dir.mkdir(parents=True, exist_ok=True)
                rules_path = config.rules_path
                if rules_path.is_dir():
                    for rule_file in sorted(rules_path.rglob("*.md")):
                        rel = rule_file.relative_to(rules_path)
                        dst = rules_dir / rel
                        dst.parent.mkdir(parents=True, exist_ok=True)
                        shutil.copy2(rule_file, dst)
                    _log(f"Copied rules ({sum(1 for _ in rules_dir.rglob('*.md'))} files)")
                else:
                    shutil.copy2(rules_path, rules_dir / rules_path.name)
                initial_prompt = config.prompt_template or render_prompt()

            # Human simulator callback for AskUserQuestion tool calls
            vision_path = config.vision_path
            tech_env_path = config.tech_env_path
            aws_profile = config.aws_profile
            aws_region = config.aws_region
            scorer_model = config.scorer_model

            async def can_use_tool(
                tool_name: str, input_data: dict, _context
            ) -> PermissionResultAllow:
                if tool_name == "AskUserQuestion":
                    questions = input_data.get("questions", [])
                    _log(f"Human gate: {len(questions)} question(s) — calling simulator")
                    question_text = "\n".join(
                        f"Q: {q.get('question', '')} Options: {[o.get('label', '') for o in q.get('options', [])]}"  # noqa: E501
                        for q in questions
                    )
                    loop = asyncio.get_event_loop()
                    response = await loop.run_in_executor(
                        None,
                        lambda: generate_human_response(
                            turn_output=question_text,
                            vision_path=vision_path,
                            tech_env_path=tech_env_path,
                            aws_profile=aws_profile,
                            aws_region=aws_region,
                            model_id=scorer_model,
                        ),
                    )
                    _log(f"  simulator: {response[:80]!r}")
                    answers: dict[str, str] = {}
                    for q in questions:
                        qtext = q.get("question", "")
                        options = q.get("options", [])
                        if not options:
                            answers[qtext] = response
                            continue
                        matched = next(
                            (
                                opt.get("label", "")
                                for opt in options
                                if opt.get("label", "").lower() in response.lower()
                            ),
                            None,
                        )
                        answers[qtext] = matched or options[0].get("label", response)
                    return PermissionResultAllow(updated_input={**input_data, "answers": answers})
                return PermissionResultAllow(updated_input=input_data)

            setting_sources = ["project"] if is_v2 else []
            sdk_options = ClaudeAgentOptions(
                cwd=str(workspace),
                permission_mode="bypassPermissions",
                can_use_tool=can_use_tool,
                max_turns=500,
                setting_sources=setting_sources,
            )
            if config.model:
                sdk_options.model = config.model

            _log(f"Starting claude-agent-sdk (v2={is_v2})")
            log_path = config.output_dir / "claude-session.log"
            _log(f"Session log: {log_path}")

            total_input_tokens = 0
            total_output_tokens = 0
            total_cost_usd = 0.0
            num_turns = 0
            session_id = ""
            final_subtype = ""
            resume_turn = 0
            max_resume_turns = 20  # safety cap on resume loop

            with open(log_path, "w", encoding="utf-8") as log_file:
                async with ClaudeSDKClient(options=sdk_options) as client:
                    current_prompt: str = initial_prompt

                    while resume_turn < max_resume_turns:
                        resume_turn += 1
                        _log(f"Turn {resume_turn}: sending prompt ({len(current_prompt)} chars)")

                        await client.query(current_prompt)
                        turn_text_parts: list[str] = []

                        async for message in client.receive_response():
                            if isinstance(message, AssistantMessage):
                                for block in message.content:
                                    if isinstance(block, TextBlock):
                                        if self.verbose:
                                            sys.stderr.write(block.text)
                                            sys.stderr.flush()
                                        log_file.write(block.text)
                                        log_file.flush()
                                        turn_text_parts.append(block.text)
                                if message.usage:
                                    total_input_tokens += message.usage.get("input_tokens", 0)
                                    total_output_tokens += message.usage.get("output_tokens", 0)

                            elif isinstance(message, ResultMessage):
                                final_subtype = message.subtype or ""
                                session_id = message.session_id or ""
                                num_turns += message.num_turns or 0
                                total_cost_usd += message.total_cost_usd or 0.0
                                log_file.write(
                                    f"\n[Turn {resume_turn} ResultMessage subtype={final_subtype}"
                                    f" turns={message.num_turns}]\n"
                                )
                                log_file.flush()
                                _log(
                                    f"Turn {resume_turn} result: {final_subtype} "
                                    f"({message.num_turns} turns, ${total_cost_usd:.4f})"
                                )
                                break

                        # --- Completion detection ---

                        # 1. Hard check: aidlc-state.md Status: Completed + code exists
                        if self._is_workflow_complete(workspace):
                            _log(
                                "Workflow complete (aidlc-state.md Status: Completed + code detected)"  # noqa: E501
                            )
                            break

                        # 2. SDK error or safety stop
                        if final_subtype not in ("success", ""):
                            _log(f"SDK returned non-success subtype={final_subtype!r} — stopping")
                            break

                        # 3. Agent wrote questions/plans and is waiting — resume with simulator
                        turn_text = "".join(turn_text_parts)
                        waiting_signals = [
                            "please provide your answers",
                            "what do you think",
                            "awaiting your",
                            "your approval",
                            "ready to proceed",
                            "approve / request changes",
                            "approval gate",
                            "approve or request changes",
                        ]
                        is_waiting = any(sig in turn_text.lower() for sig in waiting_signals)

                        if is_waiting:
                            _log("Agent waiting for human input — calling simulator")
                            loop = asyncio.get_event_loop()
                            sim_response = await loop.run_in_executor(
                                None,
                                lambda: generate_human_response(
                                    turn_output=turn_text[-3000:],
                                    vision_path=vision_path,
                                    tech_env_path=tech_env_path,
                                    aws_profile=aws_profile,
                                    aws_region=aws_region,
                                    model_id=scorer_model,
                                ),
                            )
                            _log(f"  simulator: {sim_response[:80]!r}")
                            current_prompt = sim_response
                            continue

                        # 4. State incomplete but agent didn't ask — nudge to continue.
                        # Read the markdown state fields rather than a JSON stages array.
                        pending, detail = workflow_not_done(workspace)
                        if pending:
                            nudge = (
                                f"Continue the /aidlc workflow. The workflow is not yet complete "
                                f"(next: {detail}). Run the forwarding loop until the engine reports done."  # noqa: E501
                            )
                            _log(f"Nudging: next stage = {detail!r}")
                            current_prompt = nudge
                            continue

                        # 5. No state, no waiting signal — agent may have finished
                        # cleanly or stopped unexpectedly. Stop the resume loop.
                        _log("No pending stages detected — stopping")
                        break

            elapsed_seconds = time.monotonic() - start_time

            # List workspace for debugging
            _log("Workspace contents:")
            for item in sorted(workspace.iterdir()):
                _log(f"  {item.name}/" if item.is_dir() else f"  {item.name}")

            # Locate and extract aidlc-docs
            src_docs = find_aidlc_docs(workspace)
            dst_docs = config.output_dir / "aidlc-docs"
            if src_docs is not None:
                if dst_docs.exists():
                    shutil.rmtree(dst_docs)
                shutil.copytree(src_docs, dst_docs)
                _log(f"Extracted aidlc-docs: {src_docs} → {dst_docs}")

            # Write run metadata
            token_usage = {
                "input_tokens": total_input_tokens,
                "output_tokens": total_output_tokens,
                "total_tokens": total_input_tokens + total_output_tokens,
                "total_cost_usd": total_cost_usd,
                "num_turns": num_turns,
                "model": config.model or "",
                "session_id": session_id,
            }
            normalize_output(
                source_dir=workspace,
                output_dir=config.output_dir,
                adapter_name=self.name,
                elapsed_seconds=elapsed_seconds,
                token_usage=token_usage,
            )

            has_docs = dst_docs.is_dir() and any(dst_docs.iterdir())
            success = final_subtype == "success" and has_docs

            if success:
                return AdapterResult(
                    success=True,
                    output_dir=config.output_dir,
                    aidlc_docs_dir=dst_docs,
                    workspace_dir=workspace,
                    elapsed_seconds=elapsed_seconds,
                    extra=token_usage,
                )

            error_detail = (
                f"claude-code subtype={final_subtype!r}, no aidlc-docs produced."
                if not has_docs
                else f"claude-code subtype={final_subtype!r}, aidlc-docs may be incomplete."
            )
            return AdapterResult(
                success=has_docs,
                output_dir=config.output_dir,
                aidlc_docs_dir=dst_docs if has_docs else None,
                workspace_dir=workspace,
                error=error_detail if not has_docs else None,
                elapsed_seconds=elapsed_seconds,
                extra=token_usage,
            )

        except Exception as exc:
            elapsed_seconds = time.monotonic() - start_time
            logger.exception("claude-code adapter run failed")
            return AdapterResult(
                success=False,
                output_dir=config.output_dir,
                workspace_dir=workspace if workspace.exists() else None,
                error=f"claude-code adapter error: {exc}",
                elapsed_seconds=elapsed_seconds,
            )
