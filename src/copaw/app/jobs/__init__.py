# -*- coding: utf-8 -*-
"""Minimal recruitment job helpers."""

from .models import (
    BindJobToChatRequest,
    CreateJobFromChatRequest,
    DeleteJobResult,
    JobSpec,
    JobsFile,
)
from .pipeline_models import (
    AddPipelineCandidateRequest,
    CandidateProfile,
    CandidateProfileInput,
    JobPipelineView,
    PipelineActivity,
    PipelineEntry,
    PipelineEntryMutationResult,
    PipelineEntryView,
    PipelineStageDefinition,
    UpdatePipelineEntryAssessmentRequest,
    UpdatePipelineEntryStageRequest,
)
from .pipeline_service import (
    add_candidate_to_job_pipeline,
    list_job_pipeline,
    update_pipeline_entry_assessment,
    update_pipeline_entry_stage,
)
from .service import (
    JobAmbiguousError,
    JobAlreadyBoundError,
    JobChatNotFoundError,
    JobNotFoundError,
    bind_job_to_chat,
    create_job_from_chat,
    delete_job,
    get_job,
    job_binding_from_chat,
    list_jobs,
)

__all__ = [
    "BindJobToChatRequest",
    "CreateJobFromChatRequest",
    "DeleteJobResult",
    "JobSpec",
    "JobsFile",
    "AddPipelineCandidateRequest",
    "CandidateProfile",
    "CandidateProfileInput",
    "JobPipelineView",
    "PipelineActivity",
    "PipelineEntry",
    "PipelineEntryMutationResult",
    "PipelineEntryView",
    "PipelineStageDefinition",
    "UpdatePipelineEntryAssessmentRequest",
    "UpdatePipelineEntryStageRequest",
    "JobAmbiguousError",
    "JobAlreadyBoundError",
    "JobChatNotFoundError",
    "JobNotFoundError",
    "bind_job_to_chat",
    "create_job_from_chat",
    "delete_job",
    "list_jobs",
    "get_job",
    "job_binding_from_chat",
    "add_candidate_to_job_pipeline",
    "list_job_pipeline",
    "update_pipeline_entry_assessment",
    "update_pipeline_entry_stage",
]
