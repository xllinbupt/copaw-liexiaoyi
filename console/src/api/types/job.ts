export interface JobSpec {
  id: string;
  name: string;
  description: string;
  requirements: string;
  status?: string;
  pending_feedback_count?: number;
  created_at: string | null;
  updated_at: string | null;
}

export interface JobDeleteResponse {
  deleted: boolean;
  job_id: string;
  deleted_chat_ids: string[];
  deleted_chat_count: number;
  deleted_session_count: number;
}

export interface ExternalJobLinkView {
  id: string;
  job_id: string;
  platform_account_id: string;
  platform: string;
  external_job_id: string;
  external_job_code?: string;
  external_job_title?: string;
  external_job_url?: string;
  external_status?: string;
  relation_type: "imported" | "published" | "linked";
  status: "active" | "unlinked" | "invalid";
  source_of_truth:
    | "independent"
    | "external_preferred"
    | "local_preferred";
  sync_status: "idle" | "success" | "failed";
  remote_snapshot?: Record<string, unknown>;
  publish_payload_snapshot?: Record<string, unknown>;
  last_pulled_at?: string | null;
  last_pushed_at?: string | null;
  remote_updated_at?: string | null;
  last_error?: string;
  metadata?: Record<string, unknown>;
  created_at: string | null;
  updated_at: string | null;
  account_name?: string;
  account_status?: string;
}

export type PipelineSystemStage =
  | "lead"
  | "active"
  | "interview"
  | "offer"
  | "closed";

export type PipelineSourceType =
  | "inbound"
  | "outbound"
  | "referral"
  | "talent_pool"
  | "manual";

export type RecruiterInterest = "strong_yes" | "yes" | "unsure" | "no";

export type CandidateInterest = "yes" | "unknown" | "no" | "no_response";

export type PipelineOutcome =
  | "unknown"
  | "hired"
  | "rejected_by_recruiter"
  | "rejected_by_candidate"
  | "no_response"
  | "talent_pool"
  | "job_closed";

export type PipelineAddedBy = "user" | "agent" | "system";

export interface CandidateProfile {
  id: string;
  source_platform: string;
  source_candidate_key: string;
  name: string;
  gender?: string;
  age?: number | string | null;
  school?: string;
  education_experience?: string;
  current_title?: string;
  current_company?: string;
  latest_work_experience?: string;
  city?: string;
  years_experience?: number | string | null;
  education?: string;
  current_salary?: string;
  expected_salary?: string;
  resume_snapshot?: Record<string, unknown>;
  resume_detail_url?: string;
  avatar_url?: string;
  created_at: string | null;
  updated_at: string | null;
}

export interface CandidateProfileInput {
  id?: string | null;
  source_platform?: string;
  source_candidate_key?: string;
  name: string;
  gender?: string;
  age?: number | string | null;
  school?: string;
  education_experience?: string;
  current_title?: string;
  current_company?: string;
  latest_work_experience?: string;
  city?: string;
  years_experience?: number | string | null;
  education?: string;
  current_salary?: string;
  expected_salary?: string;
  resume_snapshot?: Record<string, unknown>;
  resume_detail_url?: string;
  avatar_url?: string;
}

export interface PipelineStageDefinition {
  id: string;
  name: string;
  system_stage: PipelineSystemStage;
  color?: string;
  sort_order: number;
  is_default?: boolean;
  is_archived?: boolean;
  created_at: string | null;
  updated_at: string | null;
}

export interface PipelineEntryView {
  id: string;
  job_id: string;
  job_name?: string;
  candidate_id: string;
  current_stage_id: string;
  system_stage: PipelineSystemStage;
  source_type: PipelineSourceType;
  recruiter_interest: RecruiterInterest;
  candidate_interest: CandidateInterest;
  outcome: PipelineOutcome;
  status: string;
  added_by: PipelineAddedBy;
  owner_user_id?: string;
  source_chat_id?: string;
  source_session_id?: string;
  source_resume_id?: string;
  summary?: string;
  latest_activity_at: string | null;
  created_at: string | null;
  updated_at: string | null;
  candidate: CandidateProfile;
  current_stage: PipelineStageDefinition;
}

export interface CandidatePipelineActivityView {
  id: string;
  pipeline_entry_id: string;
  candidate_id: string;
  job_id?: string;
  job_name?: string;
  action_type: "added" | "stage_changed" | "updated";
  from_stage_id?: string;
  from_stage_name?: string;
  to_stage_id?: string;
  to_stage_name?: string;
  actor_type: PipelineAddedBy;
  note?: string;
  payload?: Record<string, unknown>;
  created_at: string | null;
}

export interface CandidatePipelineDetailView {
  candidate: CandidateProfile;
  entries: PipelineEntryView[];
  activities: CandidatePipelineActivityView[];
}

export interface JobPipelineView {
  job_id: string;
  stages: PipelineStageDefinition[];
  entries: PipelineEntryView[];
}

export interface PipelineEntryMutationResult {
  created: boolean;
  entry: PipelineEntryView;
}

export interface BatchPipelineEntryMutationResult {
  total: number;
  created_count: number;
  existing_count: number;
  results: PipelineEntryMutationResult[];
}

export interface AddPipelineCandidateRequest {
  candidate: CandidateProfileInput;
  stage?: PipelineSystemStage;
  source_type?: PipelineSourceType;
  recruiter_interest?: RecruiterInterest;
  candidate_interest?: CandidateInterest;
  summary?: string;
  added_by?: PipelineAddedBy;
  owner_user_id?: string;
  source_chat_id?: string;
  source_session_id?: string;
  source_resume_id?: string;
}

export interface BatchAddPipelineCandidatesRequest {
  requests: AddPipelineCandidateRequest[];
}

export interface UpdatePipelineEntryStageRequest {
  stage_id: string;
  note?: string;
  actor_type?: PipelineAddedBy;
}

export interface UpdatePipelineEntryAssessmentRequest {
  recruiter_interest: RecruiterInterest;
  note?: string;
  actor_type?: PipelineAddedBy;
}
