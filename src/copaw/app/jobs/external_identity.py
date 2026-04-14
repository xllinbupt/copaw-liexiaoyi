# -*- coding: utf-8 -*-
"""Identity helpers for external recruitment jobs."""
from __future__ import annotations

from hashlib import sha1
from typing import Any

DEFAULT_LIEPIN_ACCOUNT_KEY = "liepin-enterprise-default"
LIST_SNAPSHOT_IDENTITY_SOURCE = "list_snapshot"
RAW_EJOB_IDENTITY_SOURCE = "ejob_id"


def _normalize_text(value: Any) -> str:
    if not isinstance(value, str):
        return ""
    return " ".join(value.strip().lower().split())


def build_liepin_listing_external_job_id(
    *,
    job: dict[str, Any],
    account_key: str = DEFAULT_LIEPIN_ACCOUNT_KEY,
) -> str:
    """Build a stable fallback external-job id from a list snapshot.

    The enterprise job-list API does not always expose a raw `ejobId`.
    We derive a deterministic id from the account key plus the stable fields
    returned by the list endpoint so that CoPaw can still persist a relation.
    """

    signature = "|".join(
        [
            "liepin",
            _normalize_text(account_key),
            _normalize_text(job.get("ejobTitle")),
            _normalize_text(job.get("dqName")),
            _normalize_text(job.get("salaryShow")),
            _normalize_text(job.get("refreshTime")),
            _normalize_text(job.get("ejobTypeName")),
            _normalize_text(job.get("ejobSubTypeName")),
        ]
    )
    digest = sha1(signature.encode("utf-8")).hexdigest()[:16]
    return f"liepin:list:{digest}"


def resolve_liepin_external_job_id(
    *,
    job: dict[str, Any],
    account_key: str = DEFAULT_LIEPIN_ACCOUNT_KEY,
) -> tuple[str, str]:
    """Prefer the raw `ejobId` from the API; fall back to a stable list id."""

    raw_ejob_id = job.get("ejobId")
    if isinstance(raw_ejob_id, int):
        return str(raw_ejob_id), RAW_EJOB_IDENTITY_SOURCE
    if isinstance(raw_ejob_id, str):
        normalized = raw_ejob_id.strip()
        if normalized:
            return normalized, RAW_EJOB_IDENTITY_SOURCE
    return (
        build_liepin_listing_external_job_id(
            job=job,
            account_key=account_key,
        ),
        LIST_SNAPSHOT_IDENTITY_SOURCE,
    )
