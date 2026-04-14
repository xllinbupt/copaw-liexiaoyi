import { request } from "../request";
import type {
  AddPipelineCandidateRequest,
  BatchAddPipelineCandidatesRequest,
  BatchPipelineEntryMutationResult,
  CandidatePipelineDetailView,
  ExternalJobLinkView,
  JobDeleteResponse,
  JobPipelineView,
  JobSpec,
  PipelineEntryMutationResult,
  UpdatePipelineEntryAssessmentRequest,
  UpdatePipelineEntryStageRequest,
} from "../types";

export const jobApi = {
  listJobs: () => request<JobSpec[]>("/jobs"),

  getJob: (jobId: string) =>
    request<JobSpec>(`/jobs/${encodeURIComponent(jobId)}`),

  getJobExternalLinks: (jobId: string) =>
    request<ExternalJobLinkView[]>(
      `/jobs/${encodeURIComponent(jobId)}/external-links`,
    ),

  unlinkJobExternalLink: (jobId: string, linkId: string) =>
    request<void>(
      `/jobs/${encodeURIComponent(jobId)}/external-links/${encodeURIComponent(
        linkId,
      )}`,
      {
        method: "DELETE",
      },
    ),

  getJobPipeline: (jobId: string) =>
    request<JobPipelineView>(`/jobs/${encodeURIComponent(jobId)}/pipeline`),

  getPipelineCandidateDetail: (candidateId: string) =>
    request<CandidatePipelineDetailView>(
      `/jobs/pipeline/candidates/${encodeURIComponent(candidateId)}`,
    ),

  addPipelineCandidate: (
    jobId: string,
    payload: AddPipelineCandidateRequest,
  ) =>
    request<PipelineEntryMutationResult>(
      `/jobs/${encodeURIComponent(jobId)}/pipeline/entries`,
      {
        method: "POST",
        body: JSON.stringify(payload),
      },
    ),

  batchAddPipelineCandidates: (
    jobId: string,
    payload: BatchAddPipelineCandidatesRequest,
  ) =>
    request<BatchPipelineEntryMutationResult>(
      `/jobs/${encodeURIComponent(jobId)}/pipeline/entries/batch`,
      {
        method: "POST",
        body: JSON.stringify(payload),
      },
    ),

  updatePipelineEntryStage: (
    jobId: string,
    entryId: string,
    payload: UpdatePipelineEntryStageRequest,
  ) =>
    request<PipelineEntryMutationResult>(
      `/jobs/${encodeURIComponent(jobId)}/pipeline/entries/${encodeURIComponent(
        entryId,
      )}/stage`,
      {
        method: "PATCH",
        body: JSON.stringify(payload),
      },
    ),

  updatePipelineEntryAssessment: (
    jobId: string,
    entryId: string,
    payload: UpdatePipelineEntryAssessmentRequest,
  ) =>
    request<PipelineEntryMutationResult>(
      `/jobs/${encodeURIComponent(jobId)}/pipeline/entries/${encodeURIComponent(
        entryId,
      )}/assessment`,
      {
        method: "PATCH",
        body: JSON.stringify(payload),
      },
    ),

  deleteJob: (jobId: string) =>
    request<JobDeleteResponse>(`/jobs/${encodeURIComponent(jobId)}`, {
      method: "DELETE",
    }),
};
