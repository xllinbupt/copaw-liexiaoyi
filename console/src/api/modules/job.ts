import { request } from "../request";
import type { JobSpec } from "../types";

export const jobApi = {
  listJobs: () => request<JobSpec[]>("/jobs"),

  getJob: (jobId: string) =>
    request<JobSpec>(`/jobs/${encodeURIComponent(jobId)}`),
};
