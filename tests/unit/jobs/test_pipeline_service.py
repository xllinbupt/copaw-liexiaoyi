# -*- coding: utf-8 -*-
"""Tests for recruitment pipeline services."""
from __future__ import annotations

import asyncio
from datetime import datetime, timezone
from pathlib import Path

import pytest

from copaw.app.jobs import paths as job_paths
from copaw.app.jobs.models import JobSpec
from copaw.app.jobs.pipeline_models import (
    AddPipelineCandidateRequest,
    BatchPipelineEntryMutationResult,
    CandidateProfileInput,
    UpdatePipelineEntryAssessmentRequest,
    UpdatePipelineEntryStageRequest,
)
from copaw.app.jobs.pipeline_service import (
    add_candidate_to_job_pipeline,
    add_candidates_to_job_pipeline,
    get_candidate_pipeline_detail,
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
                source_platform="liexiaoxia",
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
            source_platform="liexiaoxia",
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
async def test_add_candidate_to_pipeline_deduplicates_by_source_resume_id(
    monkeypatch: pytest.MonkeyPatch,
    tmp_path: Path,
) -> None:
    monkeypatch.setattr(job_paths, "WORKING_DIR", tmp_path)

    jobs_repo = JsonJobRepository(tmp_path / "recruitment_jobs.json")
    await jobs_repo.upsert_job(_build_job("job-1"))

    request = AddPipelineCandidateRequest(
        candidate=CandidateProfileInput(
            name="李四",
            source_platform="liexiaoxia",
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
    assert first.entry.candidate.id == second.entry.candidate.id
    assert second.entry.source_resume_id == "resume-002"

    pipeline = await list_job_pipeline("job-1")
    assert len(pipeline.entries) == 1
    assert pipeline.entries[0].source_resume_id == "resume-002"
    assert pipeline.entries[0].candidate.source_candidate_key == "resume-002"


@pytest.mark.asyncio
async def test_add_candidate_to_pipeline_serializes_concurrent_requests(
    monkeypatch: pytest.MonkeyPatch,
    tmp_path: Path,
) -> None:
    monkeypatch.setattr(job_paths, "WORKING_DIR", tmp_path)

    jobs_repo = JsonJobRepository(tmp_path / "recruitment_jobs.json")
    await jobs_repo.upsert_job(_build_job("job-1"))

    async def add_candidate(index: int) -> str:
        result = await add_candidate_to_job_pipeline(
            "job-1",
            AddPipelineCandidateRequest(
                candidate=CandidateProfileInput(
                    name=f"候选人{index}",
                    source_platform="liexiaoxia",
                    source_candidate_key=f"resume-{index:03d}",
                    current_title="AI 产品经理",
                    current_company=f"公司{index}",
                ),
                source_type="outbound",
                added_by="agent",
                summary=f"并发加入 {index}",
                source_resume_id=f"resume-{index:03d}",
            ),
        )
        assert result.created is True
        return result.entry.candidate.id

    candidate_ids = await asyncio.gather(
        add_candidate(1),
        add_candidate(2),
        add_candidate(3),
    )

    candidates_repo = JsonCandidateRepository(
        tmp_path / "recruitment_candidates.json",
    )
    entries_repo = JsonPipelineEntryRepository(
        tmp_path / "recruitment_pipeline_entries.json",
    )

    candidates = await candidates_repo.list_candidates()
    entries = await entries_repo.list_entries_by_job("job-1")

    assert sorted(candidate.id for candidate in candidates) == sorted(candidate_ids)
    assert len(entries) == 3


@pytest.mark.asyncio
async def test_add_candidates_to_pipeline_supports_batch_requests(
    monkeypatch: pytest.MonkeyPatch,
    tmp_path: Path,
) -> None:
    monkeypatch.setattr(job_paths, "WORKING_DIR", tmp_path)

    jobs_repo = JsonJobRepository(tmp_path / "recruitment_jobs.json")
    await jobs_repo.upsert_job(_build_job("job-1"))

    result = await add_candidates_to_job_pipeline(
        "job-1",
        [
            AddPipelineCandidateRequest(
                candidate=CandidateProfileInput(
                    name="批量候选人A",
                    source_platform="liexiaoxia",
                    source_candidate_key="batch-a",
                    current_title="AI 产品经理",
                ),
                source_type="outbound",
                added_by="agent",
                summary="第一位",
                source_resume_id="batch-a",
            ),
            AddPipelineCandidateRequest(
                candidate=CandidateProfileInput(
                    name="批量候选人A",
                    source_platform="liexiaoxia",
                    source_candidate_key="batch-a",
                    current_title="AI 产品经理",
                ),
                source_type="outbound",
                added_by="agent",
                summary="重复候选人",
                source_resume_id="batch-a",
            ),
            AddPipelineCandidateRequest(
                candidate=CandidateProfileInput(
                    name="批量候选人B",
                    source_platform="liexiaoxia",
                    source_candidate_key="batch-b",
                    current_title="Agent 产品经理",
                ),
                source_type="outbound",
                added_by="agent",
                summary="第二位",
                source_resume_id="batch-b",
            ),
        ],
    )

    assert isinstance(result, BatchPipelineEntryMutationResult)
    assert result.total == 3
    assert result.created_count == 2
    assert result.existing_count == 1

    entries_repo = JsonPipelineEntryRepository(
        tmp_path / "recruitment_pipeline_entries.json",
    )
    entries = await entries_repo.list_entries_by_job("job-1")
    assert len(entries) == 2


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
                source_platform="liexiaoxia",
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
async def test_update_pipeline_entry_assessment_marks_closed_when_rejected(
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
                name="钱七",
                source_platform="liexiaoxia",
                source_candidate_key="resume-010",
                current_title="产品经理",
            ),
            source_type="outbound",
            added_by="agent",
            summary="先加入 pipeline",
            source_resume_id="resume-010",
        ),
    )

    updated = await update_pipeline_entry_assessment(
        "job-1",
        created.entry.id,
        UpdatePipelineEntryAssessmentRequest(
            recruiter_interest="no",
            actor_type="user",
        ),
    )

    assert updated.created is False
    assert updated.entry.recruiter_interest == "no"
    assert updated.entry.current_stage.id == "closed"
    assert updated.entry.current_stage.name == "已归档"
    assert updated.entry.system_stage == "closed"

    activities_repo = JsonPipelineActivityRepository(
        tmp_path / "recruitment_pipeline_activities.json",
    )
    activities = await activities_repo.list_activities()
    assert [activity.action_type for activity in activities] == [
        "added",
        "updated",
        "stage_changed",
    ]
    assert activities[-1].payload["from_stage_id"] == "lead"
    assert activities[-1].payload["to_stage_id"] == "closed"
    assert activities[-1].payload["reason"] == "recruiter_interest_no"


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
                source_platform="liexiaoxia",
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


@pytest.mark.asyncio
async def test_get_candidate_pipeline_detail_aggregates_cross_job_history(
    monkeypatch: pytest.MonkeyPatch,
    tmp_path: Path,
) -> None:
    monkeypatch.setattr(job_paths, "WORKING_DIR", tmp_path)

    jobs_repo = JsonJobRepository(tmp_path / "recruitment_jobs.json")
    await jobs_repo.upsert_job(_build_job("job-1"))
    await jobs_repo.upsert_job(
        _build_job("job-2").model_copy(
            update={
                "id": "job-2",
                "name": "增长产品经理",
            }
        )
    )

    request = AddPipelineCandidateRequest(
        candidate=CandidateProfileInput(
            name="周七",
            source_platform="liexiaoxia",
            source_candidate_key="resume-777",
            current_title="高级产品经理",
            current_company="某平台公司",
        ),
        source_type="outbound",
        added_by="agent",
        summary="先加入 pipeline",
        source_resume_id="resume-777",
    )

    first = await add_candidate_to_job_pipeline("job-1", request)
    second = await add_candidate_to_job_pipeline("job-2", request)

    pipeline = await list_job_pipeline("job-1")
    active_stage = next(
        stage
        for stage in pipeline.stages
        if stage.system_stage == "active"
    )

    await update_pipeline_entry_stage(
        "job-1",
        first.entry.id,
        UpdatePipelineEntryStageRequest(
            stage_id=active_stage.id,
            note="已开始联系",
            actor_type="user",
        ),
    )
    await update_pipeline_entry_assessment(
        "job-2",
        second.entry.id,
        UpdatePipelineEntryAssessmentRequest(
            recruiter_interest="yes",
            note="先继续观察",
            actor_type="agent",
        ),
    )

    detail = await get_candidate_pipeline_detail(first.entry.candidate.id)

    assert detail.candidate.name == "周七"
    assert [entry.job_id for entry in detail.entries] == ["job-2", "job-1"]
    assert {entry.job_name for entry in detail.entries} == {
        "AI 产品经理",
        "增长产品经理",
    }
    assert len(detail.activities) == 4
    assert {activity.job_id for activity in detail.activities} == {
        "job-1",
        "job-2",
    }
    assert detail.activities[0].candidate_id == first.entry.candidate.id
    assert any(
        activity.to_stage_name == "推进中"
        for activity in detail.activities
        if activity.action_type == "stage_changed"
    )
