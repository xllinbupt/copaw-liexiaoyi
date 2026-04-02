# -*- coding: utf-8 -*-
"""Tests for recruitment pipeline services."""
from __future__ import annotations

from datetime import datetime, timezone
from pathlib import Path

import pytest

from copaw.app.jobs import paths as job_paths
from copaw.app.jobs.models import JobSpec
from copaw.app.jobs.pipeline_models import (
    AddPipelineCandidateRequest,
    CandidateProfileInput,
    UpdatePipelineEntryAssessmentRequest,
    UpdatePipelineEntryStageRequest,
)
from copaw.app.jobs.pipeline_service import (
    add_candidate_to_job_pipeline,
    list_job_pipeline,
    update_pipeline_entry_assessment,
    update_pipeline_entry_stage,
)
from copaw.app.jobs.repo.json_repo import JsonJobRepository
from copaw.app.jobs.repo.pipeline_json_repo import (
    JsonCandidateRepository,
    JsonPipelineActivityRepository,
    JsonPipelineEntryRepository,
)
from copaw.app.jobs import service as jobs_service
from copaw.app.jobs.service import delete_job


def _build_job(job_id: str) -> JobSpec:
    now = datetime.now(timezone.utc)
    return JobSpec(
        id=job_id,
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


@pytest.mark.asyncio
async def test_add_candidate_to_pipeline_creates_default_stages(
    monkeypatch: pytest.MonkeyPatch,
    tmp_path: Path,
) -> None:
    monkeypatch.setattr(job_paths, "WORKING_DIR", tmp_path)

    jobs_repo = JsonJobRepository(tmp_path / "recruitment_jobs.json")
    await jobs_repo.upsert_job(_build_job("job-1"))

    result = await add_candidate_to_job_pipeline(
        "job-1",
        AddPipelineCandidateRequest(
            candidate=CandidateProfileInput(
                name="张三",
                source_platform="duolie",
                source_candidate_key="resume-001",
                age=28,
                school="北京大学",
                education_experience="北京大学 | 计算机科学 | 本科",
                current_title="产品经理",
                current_company="某科技公司",
                latest_work_experience="某科技公司 | 产品经理 | 2022.03-至今 | 负责 AI 产品规划",
                city="北京",
                expected_salary="30k-40k",
                resume_snapshot={"source": "resume_card"},
            ),
            source_type="outbound",
            added_by="agent",
            summary="JD 匹配度高",
            source_resume_id="resume-001",
        ),
    )

    assert result.created is True
    assert result.entry.system_stage == "lead"
    assert result.entry.current_stage.name == "线索"
    assert result.entry.candidate.name == "张三"
    assert result.entry.candidate.school == "北京大学"
    assert result.entry.candidate.education_experience == "北京大学 | 计算机科学 | 本科"
    assert result.entry.candidate.latest_work_experience.startswith("某科技公司")

    pipeline = await list_job_pipeline("job-1")
    assert [stage.system_stage for stage in pipeline.stages] == [
        "lead",
        "active",
        "interview",
        "offer",
        "closed",
    ]
    assert len(pipeline.entries) == 1
    assert pipeline.entries[0].candidate.expected_salary == "30k-40k"


@pytest.mark.asyncio
async def test_add_candidate_to_pipeline_deduplicates_and_updates_stage(
    monkeypatch: pytest.MonkeyPatch,
    tmp_path: Path,
) -> None:
    monkeypatch.setattr(job_paths, "WORKING_DIR", tmp_path)

    jobs_repo = JsonJobRepository(tmp_path / "recruitment_jobs.json")
    await jobs_repo.upsert_job(_build_job("job-1"))

    request = AddPipelineCandidateRequest(
        candidate=CandidateProfileInput(
            name="李四",
            source_platform="duolie",
            source_candidate_key="resume-002",
            current_title="后端工程师",
            current_company="某互联网公司",
        ),
        source_type="outbound",
        added_by="agent",
        summary="技术背景合适",
        source_resume_id="resume-002",
    )

    first = await add_candidate_to_job_pipeline("job-1", request)
    second = await add_candidate_to_job_pipeline("job-1", request)

    assert first.created is True
    assert second.created is False
    assert first.entry.id == second.entry.id

    pipeline = await list_job_pipeline("job-1")
    active_stage = next(
        stage
        for stage in pipeline.stages
        if stage.system_stage == "active"
    )

    updated = await update_pipeline_entry_stage(
        "job-1",
        first.entry.id,
        UpdatePipelineEntryStageRequest(
            stage_id=active_stage.id,
            note="已开始联系候选人",
            actor_type="agent",
        ),
    )

    assert updated.created is False
    assert updated.entry.current_stage.id == active_stage.id
    assert updated.entry.system_stage == "active"

    activities_repo = JsonPipelineActivityRepository(
        tmp_path / "recruitment_pipeline_activities.json",
    )
    activities = await activities_repo.list_activities()
    assert [activity.action_type for activity in activities] == [
        "added",
        "stage_changed",
    ]


@pytest.mark.asyncio
async def test_update_pipeline_entry_assessment(
    monkeypatch: pytest.MonkeyPatch,
    tmp_path: Path,
) -> None:
    monkeypatch.setattr(job_paths, "WORKING_DIR", tmp_path)

    jobs_repo = JsonJobRepository(tmp_path / "recruitment_jobs.json")
    await jobs_repo.upsert_job(_build_job("job-1"))

    created = await add_candidate_to_job_pipeline(
        "job-1",
        AddPipelineCandidateRequest(
            candidate=CandidateProfileInput(
                name="赵六",
                source_platform="duolie",
                source_candidate_key="resume-009",
                current_title="高级产品经理",
            ),
            source_type="outbound",
            added_by="agent",
            summary="先加入 pipeline",
            source_resume_id="resume-009",
        ),
    )

    updated = await update_pipeline_entry_assessment(
        "job-1",
        created.entry.id,
        UpdatePipelineEntryAssessmentRequest(
            recruiter_interest="strong_yes",
            note="业务匹配度很高",
            actor_type="user",
        ),
    )

    assert updated.created is False
    assert updated.entry.recruiter_interest == "strong_yes"

    activities_repo = JsonPipelineActivityRepository(
        tmp_path / "recruitment_pipeline_activities.json",
    )
    activities = await activities_repo.list_activities()
    assert [activity.action_type for activity in activities] == [
        "added",
        "updated",
    ]
    assert activities[-1].payload["field"] == "recruiter_interest"
    assert activities[-1].payload["to"] == "strong_yes"


@pytest.mark.asyncio
async def test_delete_job_removes_related_pipeline_records(
    monkeypatch: pytest.MonkeyPatch,
    tmp_path: Path,
) -> None:
    monkeypatch.setattr(job_paths, "WORKING_DIR", tmp_path)
    monkeypatch.setattr(jobs_service, "WORKING_DIR", tmp_path)

    jobs_repo = JsonJobRepository(tmp_path / "recruitment_jobs.json")
    await jobs_repo.upsert_job(_build_job("job-1"))

    added = await add_candidate_to_job_pipeline(
        "job-1",
        AddPipelineCandidateRequest(
            candidate=CandidateProfileInput(
                name="王五",
                source_platform="duolie",
                source_candidate_key="resume-003",
                current_title="算法工程师",
            ),
            source_type="outbound",
            added_by="agent",
            summary="搜索结果加入职位",
            source_resume_id="resume-003",
        ),
    )

    result = await delete_job("job-1")

    assert result.deleted is True

    entries_repo = JsonPipelineEntryRepository(
        tmp_path / "recruitment_pipeline_entries.json",
    )
    activities_repo = JsonPipelineActivityRepository(
        tmp_path / "recruitment_pipeline_activities.json",
    )
    candidates_repo = JsonCandidateRepository(
        tmp_path / "recruitment_candidates.json",
    )

    assert await entries_repo.list_entries_by_job("job-1") == []
    assert await activities_repo.list_activities() == []
    candidates = await candidates_repo.list_candidates()
    assert [candidate.id for candidate in candidates] == [added.entry.candidate.id]
