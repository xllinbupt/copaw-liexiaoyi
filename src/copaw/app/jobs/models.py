# -*- coding: utf-8 -*-
"""Minimal recruitment job models."""
from __future__ import annotations

from datetime import datetime, timezone
from uuid import uuid4

from pydantic import BaseModel, Field

from ..channels.schema import DEFAULT_CHANNEL


class JobSpec(BaseModel):
    """Minimal recruitment job specification."""

    id: str = Field(
        default_factory=lambda: str(uuid4()),
        description="Job UUID identifier",
    )
    name: str = Field(..., description="Job name")
    description: str = Field(default="", description="Job description")
    requirements: str = Field(default="", description="Job requirements")
    status: str = Field(default="未开始", description="Job status label")
    pending_feedback_count: int = Field(
        default=0,
        description="Pending feedback count",
    )
    source_session_id: str = Field(..., description="Source session identifier")
    source_user_id: str = Field(..., description="Source user identifier")
    source_channel: str = Field(
        default=DEFAULT_CHANNEL,
        description="Source channel",
    )
    created_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc),
        description="Job creation timestamp",
    )
    updated_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc),
        description="Job last update timestamp",
    )


class JobsFile(BaseModel):
    """jobs.json registry file."""

    version: int = 1
    jobs: list[JobSpec] = Field(default_factory=list)


class CreateJobFromChatRequest(BaseModel):
    """Create a job from the current chat context."""

    session_id: str
    user_id: str
    channel: str = DEFAULT_CHANNEL
    name: str
    description: str = ""
    requirements: str = ""


class BindJobToChatRequest(BaseModel):
    """Bind an existing job to the current chat context."""

    session_id: str
    user_id: str
    channel: str = DEFAULT_CHANNEL
    job_id: str | None = None
    job_name: str | None = None


class DeleteJobResult(BaseModel):
    """Delete result for a job and its related chat records."""

    deleted: bool = True
    job_id: str
    deleted_chat_ids: list[str] = Field(default_factory=list)
    deleted_chat_count: int = 0
    deleted_session_count: int = 0
