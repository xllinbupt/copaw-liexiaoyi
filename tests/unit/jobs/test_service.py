# -*- coding: utf-8 -*-
"""Tests for minimal job creation bound to chat context."""
import json
from datetime import datetime, timezone
from pathlib import Path

import pytest

from copaw.app.jobs import paths as job_paths
from copaw.app.jobs import service as jobs_service
from copaw.app.jobs.models import (
    BindJobToChatRequest,
    CreateJobFromChatRequest,
    JobSpec,
)
from copaw.app.jobs.repo.json_repo import JsonJobRepository
from copaw.app.jobs.service import (
    JobAlreadyBoundError,
    JobAmbiguousError,
    bind_job_to_chat,
    create_job_from_chat,
    delete_job,
)
from copaw.app.runner.models import ChatSpec
from copaw.app.runner.repo.json_repo import JsonChatRepository
from copaw.app.runner.session import SafeJSONSession


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


class _FakeStateModule:
    def __init__(self, payload: dict):
        self.payload = payload

    def state_dict(self) -> dict:
        return self.payload


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


@pytest.mark.asyncio
async def test_delete_job_removes_related_chats_and_sessions(
    monkeypatch: pytest.MonkeyPatch,
    tmp_path: Path,
) -> None:
    now = datetime.now(timezone.utc)
    workspace_dir = tmp_path / "workspaces" / "default"
    workspace_dir.mkdir(parents=True, exist_ok=True)

    monkeypatch.setattr(jobs_service, "WORKING_DIR", tmp_path)
    monkeypatch.setattr(job_paths, "WORKING_DIR", tmp_path)

    target_job = JobSpec(
        id="job-delete-1",
        name="AI 产品经理",
        description="负责 AI 产品规划",
        requirements="有 AI 经验",
        status="未开始",
        pending_feedback_count=0,
        source_session_id="console:default:1",
        source_user_id="default",
        source_channel="console",
        created_at=now,
        updated_at=now,
    )
    retained_job = JobSpec(
        id="job-keep-1",
        name="后端工程师",
        description="负责后端服务开发",
        requirements="熟悉 Java",
        status="未开始",
        pending_feedback_count=0,
        source_session_id="console:default:2",
        source_user_id="default",
        source_channel="console",
        created_at=now,
        updated_at=now,
    )

    jobs_repo = JsonJobRepository(tmp_path / "recruitment_jobs.json")
    await jobs_repo.upsert_job(target_job)
    await jobs_repo.upsert_job(retained_job)

    target_chat = ChatSpec(
        id="chat-target",
        name="目标职位聊天",
        session_id="console:default:session-target",
        user_id="default",
        channel="console",
        meta={
            "job": {
                "id": target_job.id,
                "name": target_job.name,
            },
            "job_id": target_job.id,
            "job_name": target_job.name,
        },
        created_at=now,
        updated_at=now,
    )
    retained_chat = ChatSpec(
        id="chat-retained",
        name="保留聊天",
        session_id="console:default:session-retained",
        user_id="default",
        channel="console",
        meta={
            "job": {
                "id": retained_job.id,
                "name": retained_job.name,
            },
            "job_id": retained_job.id,
            "job_name": retained_job.name,
        },
        created_at=now,
        updated_at=now,
    )

    chats_repo = JsonChatRepository(workspace_dir / "chats.json")
    await chats_repo.upsert_chat(target_chat)
    await chats_repo.upsert_chat(retained_chat)

    session_store = SafeJSONSession(save_dir=str(workspace_dir / "sessions"))
    await session_store.save_session_state(
        target_chat.session_id,
        user_id=target_chat.user_id,
        agent=_FakeStateModule({"memory": {"content": ["target"]}}),
    )
    await session_store.save_session_state(
        retained_chat.session_id,
        user_id=retained_chat.user_id,
        agent=_FakeStateModule({"memory": {"content": ["retained"]}}),
    )

    result = await delete_job(target_job.id)

    assert result.deleted is True
    assert result.job_id == target_job.id
    assert result.deleted_chat_ids == [target_chat.id]
    assert result.deleted_chat_count == 1
    assert result.deleted_session_count == 1

    remaining_jobs = await jobs_repo.list_jobs()
    assert [job.id for job in remaining_jobs] == [retained_job.id]

    remaining_chats = await chats_repo.list_chats()
    assert [chat.id for chat in remaining_chats] == [retained_chat.id]

    assert (
        await session_store.get_session_state_dict(
            target_chat.session_id,
            user_id=target_chat.user_id,
        )
    ) == {}
    assert (
        await session_store.get_session_state_dict(
            retained_chat.session_id,
            user_id=retained_chat.user_id,
        )
    ) != {}
