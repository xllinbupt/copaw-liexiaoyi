# -*- coding: utf-8 -*-
"""Pipeline models for recruitment jobs."""
from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Literal
from uuid import uuid4

from pydantic import BaseModel, Field

PipelineSystemStage = Literal[
    "lead",
    "active",
    "interview",
    "offer",
    "closed",
]
PipelineSourceType = Literal[
    "inbound",
    "outbound",
    "referral",
    "talent_pool",
    "manual",
]
RecruiterInterest = Literal["strong_yes", "yes", "unsure", "no"]
CandidateInterest = Literal["yes", "unknown", "no", "no_response"]
PipelineOutcome = Literal[
    "unknown",
    "hired",
    "rejected_by_recruiter",
    "rejected_by_candidate",
    "no_response",
    "talent_pool",
    "job_closed",
]
PipelineAddedBy = Literal["user", "agent", "system"]
PipelineEntryStatus = Literal["active", "closed"]
PipelineActivityType = Literal["added", "stage_changed", "updated"]


class CandidateProfile(BaseModel):
    """Global candidate profile shared across jobs."""

    id: str = Field(default_factory=lambda: str(uuid4()))
    source_platform: str = ""
    source_candidate_key: str = ""
    name: str
    gender: str = ""
    age: int | str | None = None
    school: str = ""
    education_experience: str = ""
    current_title: str = ""
    current_company: str = ""
    latest_work_experience: str = ""
    city: str = ""
    years_experience: int | str | None = None
    education: str = ""
    current_salary: str = ""
    expected_salary: str = ""
    resume_snapshot: dict[str, Any] = Field(default_factory=dict)
    resume_detail_url: str = ""
    avatar_url: str = ""
    created_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc),
    )
    updated_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc),
    )


class PipelineStageDefinition(BaseModel):
    """Display stage definition for recruitment pipeline."""

    id: str = Field(default_factory=lambda: str(uuid4()))
    name: str
    system_stage: PipelineSystemStage
    color: str = ""
    sort_order: int = 0
    is_default: bool = False
    is_archived: bool = False
    created_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc),
    )
    updated_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc),
    )


class PipelineEntry(BaseModel):
    """Candidate-to-job pipeline relation."""

    id: str = Field(default_factory=lambda: str(uuid4()))
    job_id: str
    candidate_id: str
    current_stage_id: str
    system_stage: PipelineSystemStage
    source_type: PipelineSourceType = "manual"
    recruiter_interest: RecruiterInterest = "unsure"
    candidate_interest: CandidateInterest = "unknown"
    outcome: PipelineOutcome = "unknown"
    status: PipelineEntryStatus = "active"
    added_by: PipelineAddedBy = "user"
    owner_user_id: str = ""
    source_chat_id: str = ""
    source_session_id: str = ""
    source_resume_id: str = ""
    summary: str = ""
    latest_activity_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc),
    )
    created_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc),
    )
    updated_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc),
    )


class PipelineActivity(BaseModel):
    """Activity record for a pipeline relation."""

    id: str = Field(default_factory=lambda: str(uuid4()))
    pipeline_entry_id: str
    action_type: PipelineActivityType
    from_stage_id: str = ""
    to_stage_id: str = ""
    actor_type: PipelineAddedBy = "system"
    note: str = ""
    payload: dict[str, Any] = Field(default_factory=dict)
    created_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc),
    )


class CandidatesFile(BaseModel):
    version: int = 1
    candidates: list[CandidateProfile] = Field(default_factory=list)


class PipelineStagesFile(BaseModel):
    version: int = 1
    stages: list[PipelineStageDefinition] = Field(default_factory=list)


class PipelineEntriesFile(BaseModel):
    version: int = 1
    entries: list[PipelineEntry] = Field(default_factory=list)


class PipelineActivitiesFile(BaseModel):
    version: int = 1
    activities: list[PipelineActivity] = Field(default_factory=list)


class CandidateProfileInput(BaseModel):
    """Payload used to create or update a candidate profile."""

    id: str | None = None
    source_platform: str = ""
    source_candidate_key: str = ""
    name: str
    gender: str = ""
    age: int | str | None = None
    school: str = ""
    education_experience: str = ""
    current_title: str = ""
    current_company: str = ""
    latest_work_experience: str = ""
    city: str = ""
    years_experience: int | str | None = None
    education: str = ""
    current_salary: str = ""
    expected_salary: str = ""
    resume_snapshot: dict[str, Any] = Field(default_factory=dict)
    resume_detail_url: str = ""
    avatar_url: str = ""


class AddPipelineCandidateRequest(BaseModel):
    """Add a candidate to a job pipeline."""

    candidate: CandidateProfileInput
    stage: PipelineSystemStage = "lead"
    source_type: PipelineSourceType = "manual"
    recruiter_interest: RecruiterInterest = "unsure"
    candidate_interest: CandidateInterest = "unknown"
    summary: str = ""
    added_by: PipelineAddedBy = "user"
    owner_user_id: str = ""
    source_chat_id: str = ""
    source_session_id: str = ""
    source_resume_id: str = ""


class UpdatePipelineEntryStageRequest(BaseModel):
    """Update the current stage for a pipeline entry."""

    stage_id: str
    note: str = ""
    actor_type: PipelineAddedBy = "user"


class UpdatePipelineEntryAssessmentRequest(BaseModel):
    """Update recruiter-side assessment for a pipeline entry."""

    recruiter_interest: RecruiterInterest
    note: str = ""
    actor_type: PipelineAddedBy = "user"


class PipelineEntryView(PipelineEntry):
    """Pipeline entry enriched with candidate and stage metadata."""

    candidate: CandidateProfile
    current_stage: PipelineStageDefinition


class PipelineEntryMutationResult(BaseModel):
    """Mutation result when creating or updating a pipeline entry."""

    created: bool = False
    entry: PipelineEntryView


class JobPipelineView(BaseModel):
    """Pipeline board response for a specific job."""

    job_id: str
    stages: list[PipelineStageDefinition] = Field(default_factory=list)
    entries: list[PipelineEntryView] = Field(default_factory=list)
