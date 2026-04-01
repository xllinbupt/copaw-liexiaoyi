# -*- coding: utf-8 -*-
"""Minimal job creation helpers bound to chat context."""
from __future__ import annotations

from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from ...constant import WORKING_DIR
from ..runner.models import ChatSpec
from ..runner.repo.json_repo import JsonChatRepository
from .models import BindJobToChatRequest, CreateJobFromChatRequest, JobSpec
from .repo.json_repo import JsonJobRepository

DEFAULT_JOB_STATUS = "未开始"
GLOBAL_RECRUITMENT_JOBS_FILE = "recruitment_jobs.json"


class JobChatNotFoundError(RuntimeError):
    """Raised when the source chat cannot be found."""


class JobAlreadyBoundError(RuntimeError):
    """Raised when the chat is already bound to a job."""


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


def get_recruitment_jobs_path() -> Path:
    """Return dedicated storage for global recruitment jobs."""
    return (WORKING_DIR / GLOBAL_RECRUITMENT_JOBS_FILE).expanduser()


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


async def list_jobs() -> list[JobSpec]:
    """List global jobs shared across agents."""
    jobs_repo = JsonJobRepository(get_recruitment_jobs_path())
    return await jobs_repo.list_jobs()


async def get_job(job_id: str) -> JobSpec | None:
    """Get a single global job by ID."""
    jobs_repo = JsonJobRepository(get_recruitment_jobs_path())
    return await jobs_repo.get_job(job_id)
