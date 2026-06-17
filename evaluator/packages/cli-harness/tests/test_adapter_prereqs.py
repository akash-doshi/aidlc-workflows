"""Prerequisite checks for the CLI adapters — both now require bun."""

from __future__ import annotations

import cli_harness.adapters.kiro_cli as kiro_mod
from cli_harness.adapters.kiro_cli import KiroCLIAdapter


class TestKiroPrereqs:
    def test_requires_kiro_cli(self, monkeypatch):
        monkeypatch.setattr(kiro_mod.shutil, "which", lambda cmd: None)
        ok, msg = KiroCLIAdapter().check_prerequisites()
        assert ok is False
        assert "kiro-cli" in msg

    def test_requires_bun_when_kiro_present(self, monkeypatch):
        # kiro-cli present, bun absent → must fail on bun
        monkeypatch.setattr(
            kiro_mod.shutil, "which", lambda cmd: "/usr/bin/kiro-cli" if cmd == "kiro-cli" else None
        )
        ok, msg = KiroCLIAdapter().check_prerequisites()
        assert ok is False
        assert "bun" in msg.lower()

    def test_passes_when_both_present(self, monkeypatch):
        monkeypatch.setattr(kiro_mod.shutil, "which", lambda cmd: f"/usr/bin/{cmd}")
        ok, msg = KiroCLIAdapter().check_prerequisites()
        assert ok is True
        assert "bun" in msg.lower()
