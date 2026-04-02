# -*- coding: utf-8 -*-
"""Minimal job creation helpers bound to chat context."""
from __future__ import annotations

from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from ...constant import WORKING_DIR
from ..runner.models import ChatSpec
from ..runner.repo.json_repo import JsonChatRepository
from ..runner.session import SafeJSONSession
from .models import (
    BindJobToChatRequest,
    CreateJobFromChatRequest,
    DeleteJobResult,
    JobSpec,
)
from .paths import get_recruitment_jobs_path
from .repo.json_repo import JsonJobRepository

DEFAULT_JOB_STATUS = "未开始"
WORKSPACES_DIR = "workspaces"


class JobChatNotFoundError(RuntimeError):
    """Raised when the source chat cannot be found."""


class JobAlreadyBoundError(RuntimeError):
    """Raised when the chat is already bound to a job."""


class JobChatNotBoundError(RuntimeError):
    """Raised when the chat is not yet bound to any job."""


class JobNotFoundError(RuntimeError):
    """Raised when the target job cannot be found."""


class JobAmbiguousError(RuntimeError):
    """Raised when the target job name resolves to multiple jobs."""


def _read_string(value: Any) -> str | None:
    if isinstance(value, str):
        trimmed = value.strip()
        if trimmed:
            return trimmed
    return None


def _job_meta_from_meta(meta: dict[str, Any] | None) -> dict[str, Any] | None:
    if not isinstance(meta, dict):
        return None
    job = meta.get("job")
    if isinstance(job, dict):
        return job
    return None


def job_binding_from_chat(chat: ChatSpec) -> dict[str, str] | None:
    """Return normalized job binding info if the chat already owns one."""
    meta = chat.meta if isinstance(chat.meta, dict) else {}
    job_meta = _job_meta_from_meta(meta) or {}
    job_id = (
        _read_string(meta.get("job_id"))
        or _read_string(meta.get("jobId"))
        or _read_string(job_meta.get("id"))
        or _read_string(job_meta.get("job_id"))
        or _read_string(job_meta.get("jobId"))
    )
    job_name = (
        _read_string(meta.get("job_name"))
        or _read_string(meta.get("jobName"))
        or _read_string(job_meta.get("name"))
        or _read_string(job_meta.get("job_name"))
        or _read_string(job_meta.get("jobName"))
        or _read_string(job_meta.get("title"))
    )
    if not job_id and not job_name:
        return None
    return {
        "job_id": job_id or "",
        "job_name": job_name or "",
    }

def _isoformat_utc(value: datetime) -> str:
    return value.isoformat().replace("+00:00", "Z")


def _apply_job_binding(chat: ChatSpec, job: JobSpec, *, now: datetime) -> ChatSpec:
    meta = dict(chat.meta or {})
    meta["job"] = {
        "id": job.id,
        "name": job.name,
        "description": job.description,
        "requirements": job.requirements,
        "status": job.status,
        "pending_feedback_count": job.pending_feedback_count,
        "created_at": _isoformat_utc(job.created_at),
        "updated_at": _isoformat_utc(job.updated_at),
    }
    meta["job_id"] = job.id
    meta["job_name"] = job.name
    meta["job_status"] = job.status
    meta["pending_feedback_count"] = job.pending_feedback_count

    chat.meta = meta
    chat.updated_at = now
    return chat


async def _resolve_job(
    jobs_repo: JsonJobRepository,
    *,
    job_id: str | None = None,
    job_name: str | None = None,
) -> JobSpec:
    if job_id:
        job = await jobs_repo.get_job(job_id)
        if job is None:
            raise JobNotFoundError(f"未找到职位：{job_id}")
        return job

    normalized_name = _read_string(job_name)
    if not normalized_name:
        raise ValueError("缺少职位标识，无法完成绑定")

    jobs = await jobs_repo.list_jobs()
    matches = [job for job in jobs if job.name.strip() == normalized_name]
    if not matches:
        raise JobNotFoundError(f"未找到职位：{normalized_name}")
    if len(matches) > 1:
        raise JobAmbiguousError(f"存在多个同名职位：{normalized_name}")
    return matches[0]


async def create_job_from_chat(
    workspace_dir: str | Path,
    request: CreateJobFromChatRequest,
) -> tuple[JobSpec, ChatSpec]:
    """Create a job and bind it to the current chat exactly once."""
    workspace_dir = Path(workspace_dir).expanduser()
    job_name = request.name.strip()
    if not job_name:
        raise ValueError("职位名称不能为空")
    chats_repo = JsonChatRepository(workspace_dir / "chats.json")
    jobs_repo = JsonJobRepository(get_recruitment_jobs_path())

    chat = await chats_repo.get_chat_by_id(
        session_id=request.session_id,
        user_id=request.user_id,
        channel=request.channel,
    )
    if chat is None:
        raise JobChatNotFoundError(
            "当前对话不存在，无法在该对话下创建职位",
        )

    existing_binding = job_binding_from_chat(chat)
    if existing_binding is not None:
        bound_name = existing_binding["job_name"] or existing_binding["job_id"]
        raise JobAlreadyBoundError(
            f"当前对话已绑定职位：{bound_name}",
        )

    now = datetime.now(timezone.utc)
    job = JobSpec(
        name=job_name,
        description=request.description.strip(),
        requirements=request.requirements.strip(),
        status=DEFAULT_JOB_STATUS,
        pending_feedback_count=0,
        source_session_id=request.session_id,
        source_user_id=request.user_id,
        source_channel=request.channel,
        created_at=now,
        updated_at=now,
    )
    await jobs_repo.upsert_job(job)

    chat = _apply_job_binding(chat, job, now=now)
    await chats_repo.upsert_chat(chat)
    return job, chat


async def bind_job_to_chat(
    workspace_dir: str | Path,
    request: BindJobToChatRequest,
) -> tuple[JobSpec, ChatSpec]:
    """Bind an existing job to the current chat exactly once."""
    workspace_dir = Path(workspace_dir).expanduser()
    chats_repo = JsonChatRepository(workspace_dir / "chats.json")
    jobs_repo = JsonJobRepository(get_recruitment_jobs_path())

    chat = await chats_repo.get_chat_by_id(
        session_id=request.session_id,
        user_id=request.user_id,
        channel=request.channel,
    )
    if chat is None:
        raise JobChatNotFoundError("当前对话不存在，无法绑定职位")

    existing_binding = job_binding_from_chat(chat)
    if existing_binding is not None:
        bound_name = existing_binding["job_name"] or existing_binding["job_id"]
        raise JobAlreadyBoundError(f"当前对话已绑定职位：{bound_name}")

    job = await _resolve_job(
        jobs_repo,
        job_id=_read_string(request.job_id),
        job_name=_read_string(request.job_name),
    )
    now = datetime.now(timezone.utc)
    chat = _apply_job_binding(chat, job, now=now)
    await chats_repo.upsert_chat(chat)
    return job, chat


async def get_bound_job_for_chat(
    workspace_dir: str | Path,
    *,
    session_id: str,
    user_id: str,
    channel: str,
) -> tuple[JobSpec, ChatSpec]:
    """Return the job currently bound to the target chat."""
    workspace_dir = Path(workspace_dir).expanduser()
    chats_repo = JsonChatRepository(workspace_dir / "chats.json")
    jobs_repo = JsonJobRepository(get_recruitment_jobs_path())

    chat = await chats_repo.get_chat_by_id(
        session_id=session_id,
        user_id=user_id,
        channel=channel,
    )
    if chat is None:
        raise JobChatNotFoundError("当前对话不存在，无法读取绑定职位")

    binding = job_binding_from_chat(chat)
    if binding is None:
        raise JobChatNotBoundError("当前对话还没有绑定职位")

    job = await _resolve_job(
        jobs_repo,
        job_id=_read_string(binding.get("job_id")),
        job_name=_read_string(binding.get("job_name")),
    )
    return job, chat


def _chat_belongs_to_job(chat: ChatSpec, job: JobSpec) -> bool:
    binding = job_binding_from_chat(chat)
    if binding is None:
        return False
    if binding["job_id"]:
        return binding["job_id"] == job.id
    return binding["job_name"] == job.name


def _iter_active_workspace_dirs() -> list[Path]:
    root = (WORKING_DIR / WORKSPACES_DIR).expanduser()
    if not root.exists():
        return []

    workspace_dirs: list[Path] = []
    for child in root.iterdir():
        if not child.is_dir():
            continue
        if ".backup-" in child.name:
            continue
        workspace_dirs.append(child)
    return workspace_dirs


async def delete_job(job_id: str) -> DeleteJobResult:
    """Delete a job plus all bound chat specs and session files."""
    from .pipeline_service import delete_job_pipeline_records

    jobs_repo = JsonJobRepository(get_recruitment_jobs_path())
    job = await jobs_repo.get_job(job_id)
    if job is None:
        raise JobNotFoundError(f"未找到职位：{job_id}")

    deleted_chat_ids: list[str] = []
    deleted_session_count = 0

    for workspace_dir in _iter_active_workspace_dirs():
        chats_repo = JsonChatRepository(workspace_dir / "chats.json")
        chats = await chats_repo.list_chats()
        related_chats = [chat for chat in chats if _chat_belongs_to_job(chat, job)]
        if not related_chats:
            continue

        related_chat_ids = [chat.id for chat in related_chats]
        await chats_repo.delete_chats(related_chat_ids)
        deleted_chat_ids.extend(related_chat_ids)

        session_store = SafeJSONSession(save_dir=str(workspace_dir / "sessions"))
        for chat in related_chats:
            deleted_session_count += int(
                await session_store.delete_session_state(
                    chat.session_id,
                    user_id=chat.user_id,
                )
            )

    await delete_job_pipeline_records(job_id)

    deleted = await jobs_repo.delete_job(job_id)
    if not deleted:
        raise JobNotFoundError(f"未找到职位：{job_id}")

    return DeleteJobResult(
        deleted=True,
        job_id=job_id,
        deleted_chat_ids=deleted_chat_ids,
        deleted_chat_count=len(deleted_chat_ids),
        deleted_session_count=deleted_session_count,
    )


async def list_jobs() -> list[JobSpec]:
    """List global jobs shared across agents."""
    jobs_repo = JsonJobRepository(get_recruitment_jobs_path())
    return await jobs_repo.list_jobs()


async def get_job(job_id: str) -> JobSpec | None:
    """Get a single global job by ID."""
    jobs_repo = JsonJobRepository(get_recruitment_jobs_path())
    return await jobs_repo.get_job(job_id)
