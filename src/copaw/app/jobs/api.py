# -*- coding: utf-8 -*-
"""Global recruitment jobs API."""
from __future__ import annotations

from fastapi import APIRouter, HTTPException

from .models import DeleteJobResult, JobSpec
from .pipeline_models import (
    AddPipelineCandidateRequest,
    CandidatePipelineDetailView,
    JobPipelineView,
    PipelineEntryMutationResult,
    UpdatePipelineEntryAssessmentRequest,
    UpdatePipelineEntryStageRequest,
)
from .pipeline_service import (
    add_candidate_to_job_pipeline,
    get_candidate_pipeline_detail,
    list_job_pipeline,
    update_pipeline_entry_assessment,
    update_pipeline_entry_stage,
)
from .service import JobNotFoundError, delete_job, get_job, list_jobs


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


@router.delete("/{job_id}", response_model=DeleteJobResult)
async def delete_job_endpoint(job_id: str) -> DeleteJobResult:
    """Delete a job plus all related chat/session records."""
    try:
        return await delete_job(job_id)
    except JobNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.get("/{job_id}/pipeline", response_model=JobPipelineView)
async def get_job_pipeline_endpoint(job_id: str) -> JobPipelineView:
    """Return the pipeline board data for a job."""
    try:
        return await list_job_pipeline(job_id)
    except JobNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.get(
    "/pipeline/candidates/{candidate_id}",
    response_model=CandidatePipelineDetailView,
)
async def get_candidate_pipeline_detail_endpoint(
    candidate_id: str,
) -> CandidatePipelineDetailView:
    """Return the candidate detail view with cross-job timeline."""
    try:
        return await get_candidate_pipeline_detail(candidate_id)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.post(
    "/{job_id}/pipeline/entries",
    response_model=PipelineEntryMutationResult,
)
async def add_pipeline_candidate_endpoint(
    job_id: str,
    request: AddPipelineCandidateRequest,
) -> PipelineEntryMutationResult:
    """Add a candidate to a job pipeline."""
    try:
        return await add_candidate_to_job_pipeline(job_id, request)
    except JobNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.patch(
    "/{job_id}/pipeline/entries/{entry_id}/stage",
    response_model=PipelineEntryMutationResult,
)
async def update_pipeline_entry_stage_endpoint(
    job_id: str,
    entry_id: str,
    request: UpdatePipelineEntryStageRequest,
) -> PipelineEntryMutationResult:
    """Move a pipeline entry to a different stage."""
    try:
        return await update_pipeline_entry_stage(job_id, entry_id, request)
    except JobNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.patch(
    "/{job_id}/pipeline/entries/{entry_id}/assessment",
    response_model=PipelineEntryMutationResult,
)
async def update_pipeline_entry_assessment_endpoint(
    job_id: str,
    entry_id: str,
    request: UpdatePipelineEntryAssessmentRequest,
) -> PipelineEntryMutationResult:
    """Update recruiter-side assessment for a pipeline entry."""
    try:
        return await update_pipeline_entry_assessment(job_id, entry_id, request)
    except JobNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
