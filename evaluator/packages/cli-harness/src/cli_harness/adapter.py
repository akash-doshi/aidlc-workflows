"""Abstract adapter interface for CLI-based automation."""

from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from pathlib import Path


@dataclass
class AdapterConfig:
    """Configuration for a CLI adapter run."""

    vision_path: Path
    output_dir: Path
    rules_path: Path
    tech_env_path: Path | None = None
    prompt_template: str | None = None
    model: str | None = None
    aws_profile: str | None = None
    aws_region: str | None = None
    scorer_model: str = "us.anthropic.claude-sonnet-4-5-20250929-v1:0"
    timeout_seconds: int = 7200  # 2 hours max
    # Path to the .kiro/ distribution directory (e.g. dist/kiro/.kiro). When set,
    # the kiro adapter copies it into the workspace so Kiro picks up the `/aidlc`
    # skill, agents, hooks, and tools natively and drives the forwarding loop.
    kiro_dist_path: Path | None = None
    # Path to the claude .claude/ distribution directory (e.g. dist/claude/.claude).
    # When set, the claude adapter copies it into the workspace and drives the
    # `/aidlc` skill instead of the v1 monolith prompt.
    claude_dist_path: Path | None = None
    # Path to the codex distribution directory (e.g. dist/codex). When set, the
    # codex adapter copies its .codex/ + .agents/ + AGENTS.md into the workspace,
    # git-inits it, writes a scratch CODEX_HOME, and drives the `/aidlc` skill
    # via `codex exec`.
    codex_dist_path: Path | None = None
    # Scope passed to the `/aidlc` skill (e.g. "mvp", "poc", "feature"), shared by
    # both the claude-cli and kiro-cli adapters (the two harnesses now share one
    # `/aidlc` contract). Controls how many of the 32 stages run.
    scope: str = "mvp"
    # When True, pass `--test-run` so the engine auto-approves gates and the
    # workflow runs fully autonomously. Shared by both adapters.
    test_run: bool = True


@dataclass
class AdapterResult:
    """Result from a CLI adapter run."""

    success: bool
    output_dir: Path
    aidlc_docs_dir: Path | None = None
    workspace_dir: Path | None = None
    error: str | None = None
    elapsed_seconds: float = 0.0
    token_estimate: int | None = None
    extra: dict = field(default_factory=dict)


class CLIAdapter(ABC):
    """Abstract base for CLI-specific automation adapters."""

    @property
    @abstractmethod
    def name(self) -> str:
        """Human-readable CLI tool name (e.g., 'kiro-cli')."""
        ...

    @abstractmethod
    def check_prerequisites(self) -> tuple[bool, str]:
        """Verify the CLI tool is installed, configured, and accessible.

        Returns:
            (ok, message) — True with a success message, or False with
            a description of what's missing.
        """
        ...

    @abstractmethod
    def run(self, config: AdapterConfig) -> AdapterResult:
        """Execute the AIDLC process through the CLI tool and capture outputs.

        The implementation should:
        1. Set up a clean workspace with vision.md, tech-env.md, and rules
        2. Launch the CLI tool or connect to a running instance
        3. Send the AIDLC prompt to the CLI tool
        4. Monitor for completion (all AIDLC phases done)
        5. Extract aidlc-docs/ and workspace/ from the output
        6. Generate run-meta.yaml with timing and adapter info
        """
        ...
