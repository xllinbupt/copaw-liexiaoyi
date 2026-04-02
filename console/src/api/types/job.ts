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

export interface JobPipelineView {
  job_id: string;
  stages: PipelineStageDefinition[];
  entries: PipelineEntryView[];
}

export interface PipelineEntryMutationResult {
  created: boolean;
  entry: PipelineEntryView;
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
