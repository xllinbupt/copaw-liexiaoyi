import { request } from "../request";
import type {
  AddPipelineCandidateRequest,
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

  getJobPipeline: (jobId: string) =>
    request<JobPipelineView>(`/jobs/${encodeURIComponent(jobId)}/pipeline`),

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
