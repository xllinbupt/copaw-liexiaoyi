# -*- coding: utf-8 -*-
"""Global recruitment jobs API."""
from __future__ import annotations

from fastapi import APIRouter, HTTPException

from .models import JobSpec
from .service import get_job, list_jobs


router = APIRouter(prefix="/jobs", tags=["jobs"])


@router.get("", response_model=list[JobSpec])
async def list_jobs_endpoint() -> list[JobSpec]:
    """List all jobs shared across agents."""
    return await list_jobs()


@router.get("/{job_id}", response_model=JobSpec)
async def get_job_endpoint(job_id: str) -> JobSpec:
    """Get a single job by ID."""
    job = await get_job(job_id)
    if job is None:
        raise HTTPException(status_code=404, detail=f"Job not found: {job_id}")
    return job
