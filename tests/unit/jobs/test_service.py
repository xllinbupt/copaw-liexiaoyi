# -*- coding: utf-8 -*-
"""Tests for minimal job creation bound to chat context."""
import json
from pathlib import Path

import pytest

from copaw.app.jobs.models import BindJobToChatRequest, CreateJobFromChatRequest
from copaw.app.jobs import service as jobs_service
from copaw.app.jobs.service import (
    JobAlreadyBoundError,
    JobAmbiguousError,
    bind_job_to_chat,
    create_job_from_chat,
)


def _write_workspace_files(workspace_dir: Path, *, meta: dict | None = None) -> None:
    workspace_dir.mkdir(parents=True, exist_ok=True)
    chats = {
        "version": 1,
        "chats": [
            {
                "id": "chat-1",
                "name": "测试 chat",
                "session_id": "session-1",
                "user_id": "user-1",
                "channel": "console",
                "created_at": "2026-04-01T00:00:00Z",
                "updated_at": "2026-04-01T00:00:00Z",
                "meta": meta or {},
                "status": "idle",
            }
        ],
    }
    (workspace_dir / "chats.json").write_text(
        json.dumps(chats, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )


def _write_jobs_file(jobs_path: Path, jobs: list[dict]) -> None:
    jobs_path.parent.mkdir(parents=True, exist_ok=True)
    jobs_path.write_text(
        json.dumps({"version": 1, "jobs": jobs}, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )


@pytest.mark.asyncio
async def test_create_job_from_chat_binds_current_chat(tmp_path: Path, monkeypatch):
    """A new job should be created and bound to the source chat."""
    workspace_dir = tmp_path / "workspace"
    jobs_path = tmp_path / "global" / "recruitment_jobs.json"
    monkeypatch.setattr(
        jobs_service,
        "get_recruitment_jobs_path",
        lambda: jobs_path,
    )
    _write_workspace_files(workspace_dir)

    request = CreateJobFromChatRequest(
        session_id="session-1",
        user_id="user-1",
        channel="console",
        name="AI 产品经理",
        description="负责 AI 产品规划",
        requirements="有 3 年以上产品经验",
    )

    job, chat = await create_job_from_chat(workspace_dir, request)

    assert job.name == "AI 产品经理"
    assert chat.meta["job_id"] == job.id
    assert chat.meta["job_name"] == "AI 产品经理"
    assert chat.meta["job"]["description"] == "负责 AI 产品规划"
    assert chat.meta["job"]["requirements"] == "有 3 年以上产品经验"
    assert chat.meta["job_status"] == "未开始"
    assert chat.meta["pending_feedback_count"] == 0

    jobs_payload = json.loads(jobs_path.read_text())
    assert len(jobs_payload["jobs"]) == 1
    assert jobs_payload["jobs"][0]["id"] == job.id


@pytest.mark.asyncio
async def test_create_job_from_chat_rejects_already_bound_chat(
    tmp_path: Path,
    monkeypatch,
):
    """An already-bound chat must not create another job."""
    workspace_dir = tmp_path / "workspace"
    jobs_path = tmp_path / "global" / "recruitment_jobs.json"
    monkeypatch.setattr(
        jobs_service,
        "get_recruitment_jobs_path",
        lambda: jobs_path,
    )
    _write_workspace_files(
        workspace_dir,
        meta={
            "job_id": "existing-job",
            "job_name": "已有关联职位",
            "job": {
                "id": "existing-job",
                "name": "已有关联职位",
            },
        },
    )

    request = CreateJobFromChatRequest(
        session_id="session-1",
        user_id="user-1",
        channel="console",
        name="新职位",
        description="",
        requirements="",
    )

    with pytest.raises(JobAlreadyBoundError):
        await create_job_from_chat(workspace_dir, request)

    assert not jobs_path.exists()


@pytest.mark.asyncio
async def test_bind_job_to_chat_binds_existing_job_by_id(
    tmp_path: Path,
    monkeypatch,
):
    """An unbound chat can be attached to an existing global job."""
    workspace_dir = tmp_path / "workspace"
    jobs_path = tmp_path / "global" / "recruitment_jobs.json"
    monkeypatch.setattr(
        jobs_service,
        "get_recruitment_jobs_path",
        lambda: jobs_path,
    )
    _write_workspace_files(workspace_dir)
    _write_jobs_file(
        jobs_path,
        [
            {
                "id": "job-1",
                "name": "AI 产品经理",
                "description": "负责 AI 产品规划",
                "requirements": "有 Agent 产品经验",
                "status": "进行中",
                "pending_feedback_count": 2,
                "source_session_id": "session-source",
                "source_user_id": "user-source",
                "source_channel": "console",
                "created_at": "2026-04-01T00:00:00Z",
                "updated_at": "2026-04-01T01:00:00Z",
            }
        ],
    )

    request = BindJobToChatRequest(
        session_id="session-1",
        user_id="user-1",
        channel="console",
        job_id="job-1",
    )

    job, chat = await bind_job_to_chat(workspace_dir, request)

    assert job.id == "job-1"
    assert chat.meta["job_id"] == "job-1"
    assert chat.meta["job_name"] == "AI 产品经理"
    assert chat.meta["job"]["description"] == "负责 AI 产品规划"
    assert chat.meta["job"]["requirements"] == "有 Agent 产品经验"
    assert chat.meta["job_status"] == "进行中"
    assert chat.meta["pending_feedback_count"] == 2


@pytest.mark.asyncio
async def test_bind_job_to_chat_rejects_ambiguous_job_name(
    tmp_path: Path,
    monkeypatch,
):
    """Binding by name should fail when multiple jobs share the same name."""
    workspace_dir = tmp_path / "workspace"
    jobs_path = tmp_path / "global" / "recruitment_jobs.json"
    monkeypatch.setattr(
        jobs_service,
        "get_recruitment_jobs_path",
        lambda: jobs_path,
    )
    _write_workspace_files(workspace_dir)
    _write_jobs_file(
        jobs_path,
        [
            {
                "id": "job-1",
                "name": "AI 产品经理",
                "description": "方向 A",
                "requirements": "",
                "status": "未开始",
                "pending_feedback_count": 0,
                "source_session_id": "session-a",
                "source_user_id": "user-a",
                "source_channel": "console",
                "created_at": "2026-04-01T00:00:00Z",
                "updated_at": "2026-04-01T00:00:00Z",
            },
            {
                "id": "job-2",
                "name": "AI 产品经理",
                "description": "方向 B",
                "requirements": "",
                "status": "进行中",
                "pending_feedback_count": 1,
                "source_session_id": "session-b",
                "source_user_id": "user-b",
                "source_channel": "console",
                "created_at": "2026-04-01T00:10:00Z",
                "updated_at": "2026-04-01T00:10:00Z",
            },
        ],
    )

    request = BindJobToChatRequest(
        session_id="session-1",
        user_id="user-1",
        channel="console",
        job_name="AI 产品经理",
    )

    with pytest.raises(JobAmbiguousError):
        await bind_job_to_chat(workspace_dir, request)
