# -*- coding: utf-8 -*-
"""External recruitment platform account and job link models."""
from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Literal
from uuid import uuid4

from pydantic import BaseModel, Field

PlatformAccountStatus = Literal[
    "active",
    "auth_expired",
    "revoked",
    "disabled",
]
ExternalJobRelationType = Literal["imported", "published", "linked"]
ExternalJobLinkStatus = Literal["active", "unlinked", "invalid"]
ExternalJobSyncStatus = Literal["idle", "success", "failed"]
SourceOfTruth = Literal[
    "independent",
    "external_preferred",
    "local_preferred",
]


class RecruitPlatformAccount(BaseModel):
    """Connected enterprise account for an external recruitment platform."""

    id: str = Field(default_factory=lambda: str(uuid4()))
    platform: str
    account_key: str
    account_name: str = ""
    tenant_key: str = ""
    status: PlatformAccountStatus = "active"
    capabilities: list[str] = Field(default_factory=list)
    credential_ref: str = ""
    metadata: dict[str, Any] = Field(default_factory=dict)
    created_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc),
    )
    updated_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc),
    )


class ExternalJobLink(BaseModel):
    """Relation between a CoPaw job and an external platform job."""

    id: str = Field(default_factory=lambda: str(uuid4()))
    job_id: str
    platform_account_id: str
    platform: str
    external_job_id: str
    external_job_code: str = ""
    external_job_title: str = ""
    external_job_url: str = ""
    external_status: str = ""
    relation_type: ExternalJobRelationType = "linked"
    status: ExternalJobLinkStatus = "active"
    source_of_truth: SourceOfTruth = "independent"
    sync_status: ExternalJobSyncStatus = "idle"
    remote_snapshot: dict[str, Any] = Field(default_factory=dict)
    publish_payload_snapshot: dict[str, Any] = Field(default_factory=dict)
    last_pulled_at: datetime | None = None
    last_pushed_at: datetime | None = None
    remote_updated_at: datetime | None = None
    last_error: str = ""
    metadata: dict[str, Any] = Field(default_factory=dict)
    created_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc),
    )
    updated_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc),
    )


class RecruitPlatformAccountsFile(BaseModel):
    version: int = 1
    accounts: list[RecruitPlatformAccount] = Field(default_factory=list)


class ExternalJobLinksFile(BaseModel):
    version: int = 1
    links: list[ExternalJobLink] = Field(default_factory=list)


class ExternalJobLinkView(ExternalJobLink):
    """External link enriched with account metadata for UI display."""

    account_name: str = ""
    account_status: PlatformAccountStatus | str = "active"

