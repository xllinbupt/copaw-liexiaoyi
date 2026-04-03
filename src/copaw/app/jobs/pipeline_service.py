# -*- coding: utf-8 -*-
"""Pipeline services for recruitment jobs."""
from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from .paths import (
    get_pipeline_activities_path,
    get_pipeline_candidates_path,
    get_pipeline_entries_path,
    get_pipeline_stages_path,
    get_recruitment_jobs_path,
)
from .pipeline_models import (
    AddPipelineCandidateRequest,
    CandidatePipelineActivityView,
    CandidatePipelineDetailView,
    CandidateProfile,
    CandidateProfileInput,
    JobPipelineView,
    PipelineActivity,
    PipelineEntry,
    PipelineEntryMutationResult,
    PipelineEntryView,
    PipelineStageDefinition,
    PipelineSystemStage,
    UpdatePipelineEntryAssessmentRequest,
    UpdatePipelineEntryStageRequest,
)
from .repo.json_repo import JsonJobRepository
from .repo.pipeline_json_repo import (
    JsonCandidateRepository,
    JsonPipelineActivityRepository,
    JsonPipelineEntryRepository,
    JsonPipelineStageRepository,
)
from .service import JobNotFoundError

DEFAULT_PIPELINE_STAGES: list[dict[str, Any]] = [
    {
        "id": "lead",
        "name": "线索",
        "system_stage": "lead",
        "color": "gold",
        "sort_order": 0,
    },
    {
        "id": "active",
        "name": "推进中",
        "system_stage": "active",
        "color": "blue",
        "sort_order": 1,
    },
    {
        "id": "interview",
        "name": "面试中",
        "system_stage": "interview",
        "color": "purple",
        "sort_order": 2,
    },
    {
        "id": "offer",
        "name": "Offer 中",
        "system_stage": "offer",
        "color": "orange",
        "sort_order": 3,
    },
    {
        "id": "closed",
        "name": "已归档",
        "system_stage": "closed",
        "color": "default",
        "sort_order": 4,
    },
]


def _trimmed(value: Any) -> str:
    if isinstance(value, str):
        return value.strip()
    return ""


async def _ensure_job_exists(job_id: str) -> None:
    jobs_repo = JsonJobRepository(get_recruitment_jobs_path())
    job = await jobs_repo.get_job(job_id)
    if job is None:
        raise JobNotFoundError(f"未找到职位：{job_id}")


async def _get_jobs_by_id() -> dict[str, Any]:
    jobs_repo = JsonJobRepository(get_recruitment_jobs_path())
    jobs = await jobs_repo.list_jobs()
    return {job.id: job for job in jobs}


async def _ensure_default_stages() -> list[PipelineStageDefinition]:
    stages_repo = JsonPipelineStageRepository(get_pipeline_stages_path())
    stages = await stages_repo.list_stages()
    if not stages:
        now = datetime.now(timezone.utc)
        stages = [
            PipelineStageDefinition(
                id=spec["id"],
                name=spec["name"],
                system_stage=spec["system_stage"],
                color=spec["color"],
                sort_order=spec["sort_order"],
                is_default=True,
                created_at=now,
                updated_at=now,
            )
            for spec in DEFAULT_PIPELINE_STAGES
        ]
        await stages_repo.replace_stages(stages)
    return sorted(
        [stage for stage in stages if not stage.is_archived],
        key=lambda stage: stage.sort_order,
    )


def _find_stage(
    stages: list[PipelineStageDefinition],
    *,
    stage_id: str | None = None,
    system_stage: PipelineSystemStage | None = None,
) -> PipelineStageDefinition:
    for stage in stages:
        if stage_id and stage.id == stage_id:
            return stage
        if system_stage and stage.system_stage == system_stage:
            return stage
    target = stage_id or system_stage or "unknown"
    raise ValueError(f"未找到 pipeline 阶段：{target}")


def _merge_candidate(
    existing: CandidateProfile | None,
    candidate_input: CandidateProfileInput,
    *,
    now: datetime,
) -> CandidateProfile:
    resume_snapshot = (
        dict(existing.resume_snapshot)
        if existing is not None
        else {}
    )
    resume_snapshot.update(candidate_input.resume_snapshot or {})

    payload: dict[str, Any] = {
        "source_platform": _trimmed(candidate_input.source_platform)
        or (existing.source_platform if existing else ""),
        "source_candidate_key": _trimmed(candidate_input.source_candidate_key)
        or (existing.source_candidate_key if existing else ""),
        "name": _trimmed(candidate_input.name)
        or (existing.name if existing else "未命名候选人"),
        "gender": _trimmed(candidate_input.gender)
        or (existing.gender if existing else ""),
        "age": (
            candidate_input.age
            if candidate_input.age not in ("", None)
            else (existing.age if existing else None)
        ),
        "school": _trimmed(candidate_input.school)
        or (existing.school if existing else ""),
        "education_experience": _trimmed(candidate_input.education_experience)
        or (existing.education_experience if existing else ""),
        "current_title": _trimmed(candidate_input.current_title)
        or (existing.current_title if existing else ""),
        "current_company": _trimmed(candidate_input.current_company)
        or (existing.current_company if existing else ""),
        "latest_work_experience": _trimmed(candidate_input.latest_work_experience)
        or (existing.latest_work_experience if existing else ""),
        "city": _trimmed(candidate_input.city) or (existing.city if existing else ""),
        "years_experience": (
            candidate_input.years_experience
            if candidate_input.years_experience not in ("", None)
            else (existing.years_experience if existing else None)
        ),
        "education": _trimmed(candidate_input.education)
        or (existing.education if existing else ""),
        "current_salary": _trimmed(candidate_input.current_salary)
        or (existing.current_salary if existing else ""),
        "expected_salary": _trimmed(candidate_input.expected_salary)
        or (existing.expected_salary if existing else ""),
        "resume_snapshot": resume_snapshot,
        "resume_detail_url": _trimmed(candidate_input.resume_detail_url)
        or (existing.resume_detail_url if existing else ""),
        "avatar_url": _trimmed(candidate_input.avatar_url)
        or (existing.avatar_url if existing else ""),
        "created_at": existing.created_at if existing else now,
        "updated_at": now,
    }
    candidate_id = _trimmed(candidate_input.id) or (existing.id if existing else "")
    if candidate_id:
        payload["id"] = candidate_id

    return CandidateProfile(**payload)


async def _upsert_candidate(
    candidate_input: CandidateProfileInput,
) -> CandidateProfile:
    now = datetime.now(timezone.utc)
    candidates_repo = JsonCandidateRepository(get_pipeline_candidates_path())

    existing = None
    candidate_id = _trimmed(candidate_input.id)
    if candidate_id:
        existing = await candidates_repo.get_candidate(candidate_id)

    if existing is None:
        existing = await candidates_repo.find_by_source(
            _trimmed(candidate_input.source_platform),
            _trimmed(candidate_input.source_candidate_key),
        )

    candidate = _merge_candidate(existing, candidate_input, now=now)
    await candidates_repo.upsert_candidate(candidate)
    return candidate


def _build_entry_view(
    entry: PipelineEntry,
    *,
    candidates_by_id: dict[str, CandidateProfile],
    stages_by_id: dict[str, PipelineStageDefinition],
    job_name: str = "",
) -> PipelineEntryView:
    candidate = candidates_by_id.get(entry.candidate_id)
    if candidate is None:
        raise ValueError(f"候选人不存在：{entry.candidate_id}")
    stage = stages_by_id.get(entry.current_stage_id)
    if stage is None:
        raise ValueError(f"阶段不存在：{entry.current_stage_id}")
    return PipelineEntryView(
        **entry.model_dump(),
        job_name=job_name,
        candidate=candidate,
        current_stage=stage,
    )


def _build_activity_view(
    activity: PipelineActivity,
    *,
    entry: PipelineEntry | None,
    stages_by_id: dict[str, PipelineStageDefinition],
    jobs_by_id: dict[str, Any],
) -> CandidatePipelineActivityView:
    resolved_job_id = _trimmed(activity.job_id) or _trimmed(
        activity.payload.get("job_id"),
    )
    if not resolved_job_id and entry is not None:
        resolved_job_id = entry.job_id

    resolved_candidate_id = _trimmed(activity.candidate_id) or _trimmed(
        activity.payload.get("candidate_id"),
    )
    if not resolved_candidate_id and entry is not None:
        resolved_candidate_id = entry.candidate_id

    from_stage_id = _trimmed(activity.from_stage_id)
    to_stage_id = _trimmed(activity.to_stage_id)
    from_stage = stages_by_id.get(from_stage_id)
    to_stage = stages_by_id.get(to_stage_id)
    job = jobs_by_id.get(resolved_job_id)

    return CandidatePipelineActivityView(
        id=activity.id,
        pipeline_entry_id=activity.pipeline_entry_id,
        candidate_id=resolved_candidate_id,
        job_id=resolved_job_id,
        job_name=job.name if job is not None else "",
        action_type=activity.action_type,
        from_stage_id=from_stage_id,
        from_stage_name=from_stage.name if from_stage is not None else "",
        to_stage_id=to_stage_id,
        to_stage_name=to_stage.name if to_stage is not None else "",
        actor_type=activity.actor_type,
        note=activity.note,
        payload=activity.payload,
        created_at=activity.created_at,
    )


async def list_job_pipeline(job_id: str) -> JobPipelineView:
    await _ensure_job_exists(job_id)
    stages = await _ensure_default_stages()
    stages_by_id = {stage.id: stage for stage in stages}
    jobs_by_id = await _get_jobs_by_id()

    entries_repo = JsonPipelineEntryRepository(get_pipeline_entries_path())
    candidates_repo = JsonCandidateRepository(get_pipeline_candidates_path())

    entries = await entries_repo.list_entries_by_job(job_id)
    entries = sorted(
        entries,
        key=lambda entry: entry.latest_activity_at,
        reverse=True,
    )

    candidates = await candidates_repo.list_candidates()
    candidates_by_id = {candidate.id: candidate for candidate in candidates}

    entry_views = [
        _build_entry_view(
            entry,
            candidates_by_id=candidates_by_id,
            stages_by_id=stages_by_id,
            job_name=jobs_by_id.get(entry.job_id).name
            if jobs_by_id.get(entry.job_id) is not None
            else "",
        )
        for entry in entries
        if entry.candidate_id in candidates_by_id
        and entry.current_stage_id in stages_by_id
    ]

    return JobPipelineView(
        job_id=job_id,
        stages=stages,
        entries=entry_views,
    )


async def add_candidate_to_job_pipeline(
    job_id: str,
    request: AddPipelineCandidateRequest,
) -> PipelineEntryMutationResult:
    await _ensure_job_exists(job_id)
    stages = await _ensure_default_stages()
    stages_by_id = {stage.id: stage for stage in stages}
    jobs_by_id = await _get_jobs_by_id()
    target_stage = _find_stage(stages, system_stage=request.stage)

    candidate = await _upsert_candidate(request.candidate)
    entries_repo = JsonPipelineEntryRepository(get_pipeline_entries_path())
    activities_repo = JsonPipelineActivityRepository(get_pipeline_activities_path())

    existing_entry = await entries_repo.find_entry(
        job_id=job_id,
        candidate_id=candidate.id,
    )
    if existing_entry is not None:
        return PipelineEntryMutationResult(
            created=False,
            entry=_build_entry_view(
                existing_entry,
                candidates_by_id={candidate.id: candidate},
                stages_by_id=stages_by_id,
                job_name=jobs_by_id.get(job_id).name
                if jobs_by_id.get(job_id) is not None
                else "",
            ),
        )

    now = datetime.now(timezone.utc)
    entry = PipelineEntry(
        job_id=job_id,
        candidate_id=candidate.id,
        current_stage_id=target_stage.id,
        system_stage=target_stage.system_stage,
        source_type=request.source_type,
        recruiter_interest=request.recruiter_interest,
        candidate_interest=request.candidate_interest,
        status="closed" if target_stage.system_stage == "closed" else "active",
        added_by=request.added_by,
        owner_user_id=_trimmed(request.owner_user_id),
        source_chat_id=_trimmed(request.source_chat_id),
        source_session_id=_trimmed(request.source_session_id),
        source_resume_id=_trimmed(request.source_resume_id)
        or _trimmed(candidate.source_candidate_key),
        summary=_trimmed(request.summary),
        latest_activity_at=now,
        created_at=now,
        updated_at=now,
    )
    await entries_repo.upsert_entry(entry)
    await activities_repo.append_activity(
        PipelineActivity(
            pipeline_entry_id=entry.id,
            candidate_id=candidate.id,
            job_id=job_id,
            action_type="added",
            to_stage_id=entry.current_stage_id,
            actor_type=request.added_by,
            note=entry.summary,
            payload={
                "job_id": job_id,
                "candidate_id": candidate.id,
                "source_type": request.source_type,
            },
            created_at=now,
        )
    )

    return PipelineEntryMutationResult(
        created=True,
        entry=_build_entry_view(
            entry,
            candidates_by_id={candidate.id: candidate},
            stages_by_id=stages_by_id,
            job_name=jobs_by_id.get(job_id).name
            if jobs_by_id.get(job_id) is not None
            else "",
        ),
    )


async def update_pipeline_entry_stage(
    job_id: str,
    entry_id: str,
    request: UpdatePipelineEntryStageRequest,
) -> PipelineEntryMutationResult:
    await _ensure_job_exists(job_id)
    stages = await _ensure_default_stages()
    stages_by_id = {stage.id: stage for stage in stages}
    target_stage = _find_stage(stages, stage_id=_trimmed(request.stage_id))

    entries_repo = JsonPipelineEntryRepository(get_pipeline_entries_path())
    candidates_repo = JsonCandidateRepository(get_pipeline_candidates_path())
    activities_repo = JsonPipelineActivityRepository(get_pipeline_activities_path())
    jobs_by_id = await _get_jobs_by_id()

    entry = await entries_repo.get_entry(entry_id)
    if entry is None or entry.job_id != job_id:
        raise ValueError(f"未找到 pipeline 记录：{entry_id}")

    now = datetime.now(timezone.utc)
    previous_stage_id = entry.current_stage_id
    entry.current_stage_id = target_stage.id
    entry.system_stage = target_stage.system_stage
    entry.status = "closed" if target_stage.system_stage == "closed" else "active"
    entry.latest_activity_at = now
    entry.updated_at = now
    await entries_repo.upsert_entry(entry)

    await activities_repo.append_activity(
        PipelineActivity(
            pipeline_entry_id=entry.id,
            candidate_id=entry.candidate_id,
            job_id=job_id,
            action_type="stage_changed",
            from_stage_id=previous_stage_id,
            to_stage_id=target_stage.id,
            actor_type=request.actor_type,
            note=_trimmed(request.note),
            payload={
                "job_id": job_id,
                "system_stage": target_stage.system_stage,
            },
            created_at=now,
        )
    )

    candidate = await candidates_repo.get_candidate(entry.candidate_id)
    if candidate is None:
        raise ValueError(f"候选人不存在：{entry.candidate_id}")

    return PipelineEntryMutationResult(
        created=False,
        entry=_build_entry_view(
            entry,
            candidates_by_id={candidate.id: candidate},
            stages_by_id=stages_by_id,
            job_name=jobs_by_id.get(job_id).name
            if jobs_by_id.get(job_id) is not None
            else "",
        ),
    )


async def update_pipeline_entry_assessment(
    job_id: str,
    entry_id: str,
    request: UpdatePipelineEntryAssessmentRequest,
) -> PipelineEntryMutationResult:
    await _ensure_job_exists(job_id)
    stages = await _ensure_default_stages()
    stages_by_id = {stage.id: stage for stage in stages}

    entries_repo = JsonPipelineEntryRepository(get_pipeline_entries_path())
    candidates_repo = JsonCandidateRepository(get_pipeline_candidates_path())
    activities_repo = JsonPipelineActivityRepository(get_pipeline_activities_path())
    jobs_by_id = await _get_jobs_by_id()

    entry = await entries_repo.get_entry(entry_id)
    if entry is None or entry.job_id != job_id:
        raise ValueError(f"未找到 pipeline 记录：{entry_id}")

    now = datetime.now(timezone.utc)
    previous_interest = entry.recruiter_interest
    previous_stage_id = entry.current_stage_id
    entry.recruiter_interest = request.recruiter_interest
    if request.recruiter_interest == "no":
        closed_stage = stages_by_id.get("closed")
        if closed_stage is not None:
            entry.current_stage_id = closed_stage.id
            entry.system_stage = closed_stage.system_stage
            entry.status = "closed"
    entry.latest_activity_at = now
    entry.updated_at = now
    await entries_repo.upsert_entry(entry)

    await activities_repo.append_activity(
        PipelineActivity(
            pipeline_entry_id=entry.id,
            candidate_id=entry.candidate_id,
            job_id=job_id,
            action_type="updated",
            actor_type=request.actor_type,
            note=_trimmed(request.note),
            payload={
                "job_id": job_id,
                "field": "recruiter_interest",
                "from": previous_interest,
                "to": request.recruiter_interest,
            },
            created_at=now,
        )
    )

    if entry.current_stage_id != previous_stage_id:
        await activities_repo.append_activity(
            PipelineActivity(
                pipeline_entry_id=entry.id,
                candidate_id=entry.candidate_id,
                job_id=job_id,
                action_type="stage_changed",
                actor_type=request.actor_type,
                note="因匹配度更新为淘汰，自动归档",
                payload={
                    "job_id": job_id,
                    "from_stage_id": previous_stage_id,
                    "to_stage_id": entry.current_stage_id,
                    "reason": "recruiter_interest_no",
                },
                created_at=now,
            )
        )

    candidate = await candidates_repo.get_candidate(entry.candidate_id)
    if candidate is None:
        raise ValueError(f"候选人不存在：{entry.candidate_id}")

    return PipelineEntryMutationResult(
        created=False,
        entry=_build_entry_view(
            entry,
            candidates_by_id={candidate.id: candidate},
            stages_by_id=stages_by_id,
            job_name=jobs_by_id.get(job_id).name
            if jobs_by_id.get(job_id) is not None
            else "",
        ),
    )


async def get_candidate_pipeline_detail(
    candidate_id: str,
) -> CandidatePipelineDetailView:
    stages = await _ensure_default_stages()
    stages_by_id = {stage.id: stage for stage in stages}
    jobs_by_id = await _get_jobs_by_id()

    candidates_repo = JsonCandidateRepository(get_pipeline_candidates_path())
    entries_repo = JsonPipelineEntryRepository(get_pipeline_entries_path())
    activities_repo = JsonPipelineActivityRepository(get_pipeline_activities_path())

    candidate = await candidates_repo.get_candidate(candidate_id)
    if candidate is None:
        raise ValueError(f"未找到候选人：{candidate_id}")

    entries = await entries_repo.list_entries_by_candidate(candidate_id)
    entries = sorted(entries, key=lambda item: item.latest_activity_at, reverse=True)
    entry_ids = {entry.id for entry in entries}
    entry_by_id = {entry.id: entry for entry in entries}

    entry_views = [
        _build_entry_view(
            entry,
            candidates_by_id={candidate.id: candidate},
            stages_by_id=stages_by_id,
            job_name=jobs_by_id.get(entry.job_id).name
            if jobs_by_id.get(entry.job_id) is not None
            else "",
        )
        for entry in entries
        if entry.current_stage_id in stages_by_id
    ]

    activities = await activities_repo.list_activities()
    activity_views: list[CandidatePipelineActivityView] = []
    for activity in activities:
        entry = entry_by_id.get(activity.pipeline_entry_id)
        resolved_candidate_id = _trimmed(activity.candidate_id) or _trimmed(
            activity.payload.get("candidate_id"),
        )
        if not resolved_candidate_id and entry is not None:
            resolved_candidate_id = entry.candidate_id
        if resolved_candidate_id != candidate_id and activity.pipeline_entry_id not in entry_ids:
            continue

        activity_views.append(
            _build_activity_view(
                activity,
                entry=entry,
                stages_by_id=stages_by_id,
                jobs_by_id=jobs_by_id,
            )
        )

    activity_views.sort(key=lambda item: item.created_at, reverse=True)
    return CandidatePipelineDetailView(
        candidate=candidate,
        entries=entry_views,
        activities=activity_views,
    )


async def delete_job_pipeline_records(job_id: str) -> tuple[int, int]:
    """Delete all pipeline entries and activities associated with a job."""
    entries_repo = JsonPipelineEntryRepository(get_pipeline_entries_path())
    activities_repo = JsonPipelineActivityRepository(get_pipeline_activities_path())

    deleted_entry_ids = await entries_repo.delete_entries_by_job(job_id)
    deleted_activity_count = await activities_repo.delete_activities_by_entry_ids(
        deleted_entry_ids,
    )
    return len(deleted_entry_ids), deleted_activity_count
