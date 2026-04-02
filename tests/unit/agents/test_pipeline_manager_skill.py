# -*- coding: utf-8 -*-
"""Tests for the protected builtin pipeline manager skill."""

from pathlib import Path

from copaw import constant
from copaw.agents.skills_manager import (
    SkillPoolService,
    SkillService,
    import_builtin_skills,
    reconcile_pool_manifest,
    reconcile_workspace_manifest,
    update_single_builtin,
)
from copaw.app.migration import _sync_default_agent_prompt_rules
from copaw.config.config import AgentProfileConfig


def test_pipeline_manager_imports_as_protected_builtin(
    monkeypatch,
    tmp_path: Path,
):
    monkeypatch.setattr(constant, "WORKING_DIR", str(tmp_path))

    result = import_builtin_skills(["pipeline_manager"])

    assert result["imported"] == ["pipeline_manager"]
    manifest = reconcile_pool_manifest()
    entry = manifest["skills"]["pipeline_manager"]
    assert entry["source"] == "builtin"
    assert entry["protected"] is True


def test_pipeline_manager_cannot_be_deleted_from_workspace(
    monkeypatch,
    tmp_path: Path,
):
    monkeypatch.setattr(constant, "WORKING_DIR", str(tmp_path))

    import_builtin_skills(["pipeline_manager"])
    workspace_dir = tmp_path / "workspaces" / "default"
    workspace_dir.mkdir(parents=True, exist_ok=True)

    result = SkillPoolService().download_to_workspace(
        "pipeline_manager",
        workspace_dir,
    )

    assert result["success"] is True
    manifest = reconcile_workspace_manifest(workspace_dir)
    entry = manifest["skills"]["pipeline_manager"]
    assert entry["protected"] is True

    service = SkillService(workspace_dir)
    assert service.disable_skill("pipeline_manager")["success"] is True
    assert service.delete_skill("pipeline_manager") is False


def test_update_single_builtin_preserves_protected_flag(
    monkeypatch,
    tmp_path: Path,
):
    monkeypatch.setattr(constant, "WORKING_DIR", str(tmp_path))

    import_builtin_skills(["pipeline_manager"])
    updated = update_single_builtin("pipeline_manager")

    assert updated["source"] == "builtin"
    assert updated["protected"] is True
    manifest = reconcile_pool_manifest()
    assert manifest["skills"]["pipeline_manager"]["protected"] is True


def test_default_agent_prompt_rules_sync_latest_agents_md(tmp_path: Path):
    workspace_dir = tmp_path / "default"
    workspace_dir.mkdir(parents=True, exist_ok=True)
    (workspace_dir / "AGENTS.md").write_text("old rules", encoding="utf-8")

    _sync_default_agent_prompt_rules(
        workspace_dir,
        AgentProfileConfig(
            id="default",
            name="猎小侠",
            description="default agent",
            language="zh",
        ),
    )

    synced = (workspace_dir / "AGENTS.md").read_text(encoding="utf-8")
    assert "pipeline_manager" in synced
