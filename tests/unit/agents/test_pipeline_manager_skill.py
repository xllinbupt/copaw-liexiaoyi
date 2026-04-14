# -*- coding: utf-8 -*-
"""Tests for protected builtin recruiting skills."""

from pathlib import Path

import pytest

from copaw import constant
from copaw.agents.skills_manager import (
    SkillPoolService,
    SkillService,
    import_builtin_skills,
    reconcile_pool_manifest,
    reconcile_workspace_manifest,
    update_single_builtin,
)
from copaw.app.migration import DEFAULT_AGENT_FIRST_RUN_SKILL_NAMES
from copaw.app.migration import _sync_default_agent_prompt_rules
from copaw.config.config import AgentProfileConfig


@pytest.mark.parametrize(
    "skill_name",
    [
        "job_creator",
        "job_intake_consultant",
        "liepin_job_manage",
        "pipeline_manager",
        "resume_search",
    ],
)
def test_recruiting_builtins_import_as_protected_builtin(
    monkeypatch,
    tmp_path: Path,
    skill_name: str,
):
    monkeypatch.setattr(constant, "WORKING_DIR", str(tmp_path))

    result = import_builtin_skills([skill_name])

    assert result["imported"] == [skill_name]
    manifest = reconcile_pool_manifest()
    entry = manifest["skills"][skill_name]
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


@pytest.mark.parametrize(
    "skill_name",
    [
        "job_creator",
        "job_intake_consultant",
        "liepin_job_manage",
        "pipeline_manager",
        "resume_search",
    ],
)
def test_protected_builtin_skill_keeps_builtin_source_after_local_edits(
    monkeypatch,
    tmp_path: Path,
    skill_name: str,
):
    monkeypatch.setattr(constant, "WORKING_DIR", str(tmp_path))

    import_builtin_skills([skill_name])
    workspace_dir = tmp_path / "workspaces" / "default"
    workspace_dir.mkdir(parents=True, exist_ok=True)

    result = SkillPoolService().download_to_workspace(skill_name, workspace_dir)

    assert result["success"] is True

    skill_md = workspace_dir / "skills" / skill_name / "SKILL.md"
    skill_md.write_text(
        skill_md.read_text(encoding="utf-8") + "\n<!-- local edit -->\n",
        encoding="utf-8",
    )

    manifest = reconcile_workspace_manifest(workspace_dir)
    entry = manifest["skills"][skill_name]
    assert entry["source"] == "builtin"
    assert entry["protected"] is True
    assert entry["sync_to_pool"]["status"] == "conflict"


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


def test_default_agent_first_run_skills_include_recruiting_builtins():
    assert "liepin_job_manage" in DEFAULT_AGENT_FIRST_RUN_SKILL_NAMES
    assert "resume_search" in DEFAULT_AGENT_FIRST_RUN_SKILL_NAMES
