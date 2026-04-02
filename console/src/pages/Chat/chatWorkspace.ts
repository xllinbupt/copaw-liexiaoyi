import type { ChatSpec, JobSpec } from "../../api/types";

const DEFAULT_USER_ID = "default";
const DEFAULT_CHANNEL = "console";
const DEFAULT_SESSION_NAME = "New Chat";
export const CHAT_WORKSPACE_UPDATED_EVENT = "copaw-chat-workspace-updated";
export const OPEN_JOB_DETAIL_PANEL_EVENT = "copaw-open-job-detail-panel";
export const JOB_PIPELINE_UPDATED_EVENT = "copaw-job-pipeline-updated";

type UnknownRecord = Record<string, unknown>;

export interface ChatJobContext {
  key: string;
  jobId: string | null;
  jobName: string;
  jobStatus: string | null;
  pendingFeedbackCount: number;
}

export interface ChatJobDetails extends ChatJobContext {
  description: string | null;
  requirements: string | null;
}

export interface ChatJobGroup extends ChatJobContext {
  chats: ChatSpec[];
}

export interface ChatCandidateDetails {
  candidateId: string;
  candidateName: string;
  job?: ChatJobDetails | null;
}

export type ChatDetailPanelView =
  | {
      type: "job";
      job: ChatJobDetails;
    }
  | {
      type: "candidate";
      candidate: ChatCandidateDetails;
    };

export interface ChatWorkspaceUpdateDetail {
  refreshRuntime?: boolean;
}

export interface OpenJobDetailPanelDetail {
  job: ChatJobDetails;
}

export interface JobPipelineUpdatedDetail {
  jobId: string;
}

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function readNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

function getJobMeta(meta?: Record<string, unknown>): UnknownRecord | null {
  if (!meta) return null;
  const jobMeta = meta.job;
  return isRecord(jobMeta) ? jobMeta : null;
}

export function getChatJobContext(chat: ChatSpec): ChatJobContext | null {
  const meta = chat.meta || {};
  const jobMeta = getJobMeta(meta);
  const jobId =
    readString(chat.job_id) ??
    readString(meta.job_id) ??
    readString(meta.jobId) ??
    readString(jobMeta?.id) ??
    readString(jobMeta?.job_id) ??
    readString(jobMeta?.jobId);
  const jobName =
    readString(chat.job_name) ??
    readString(meta.job_name) ??
    readString(meta.jobName) ??
    readString(jobMeta?.name) ??
    readString(jobMeta?.job_name) ??
    readString(jobMeta?.jobName) ??
    readString(jobMeta?.title);
  const jobStatus =
    readString(chat.job_status) ??
    readString(meta.job_status) ??
    readString(meta.jobStatus) ??
    readString(jobMeta?.status) ??
    readString(jobMeta?.job_status) ??
    readString(jobMeta?.jobStatus);
  const pendingFeedbackCount =
    readNumber(chat.pending_feedback_count) ??
    readNumber(meta.pending_feedback_count) ??
    readNumber(meta.pendingFeedbackCount) ??
    readNumber(jobMeta?.pending_feedback_count) ??
    readNumber(jobMeta?.pendingFeedbackCount) ??
    0;

  if (!jobId && !jobName) return null;

  return {
    key: jobId || `job-name:${jobName}`,
    jobId,
    jobName: jobName || "未命名职位",
    jobStatus,
    pendingFeedbackCount,
  };
}

export function getChatJobDetails(chat: ChatSpec): ChatJobDetails | null {
  const context = getChatJobContext(chat);
  if (!context) return null;

  const meta = chat.meta || {};
  const jobMeta = getJobMeta(meta);

  return {
    ...context,
    description:
      readString(jobMeta?.description) ??
      readString(meta.job_description) ??
      readString(meta.jobDescription),
    requirements:
      readString(jobMeta?.requirements) ??
      readString(meta.job_requirements) ??
      readString(meta.jobRequirements),
  };
}

function getJobSortTime(job: JobSpec): number {
  const raw = job.updated_at || job.created_at;
  const timestamp = raw ? new Date(raw).getTime() : 0;
  return Number.isNaN(timestamp) ? 0 : timestamp;
}

function getJobContext(job: JobSpec): ChatJobContext {
  return {
    key: job.id,
    jobId: job.id,
    jobName: job.name || "未命名职位",
    jobStatus: readString(job.status) ?? null,
    pendingFeedbackCount: readNumber(job.pending_feedback_count) ?? 0,
  };
}

function getChatSortTime(chat: ChatSpec): number {
  const raw = chat.updated_at || chat.created_at;
  const timestamp = raw ? new Date(raw).getTime() : 0;
  return Number.isNaN(timestamp) ? 0 : timestamp;
}

export function buildChatWorkspaceGroups(
  chats: ChatSpec[],
  jobs: JobSpec[],
): {
  unassignedChats: ChatSpec[];
  jobGroups: ChatJobGroup[];
} {
  const sortedChats = [...chats].sort(
    (a, b) => getChatSortTime(b) - getChatSortTime(a),
  );
  const unassignedChats: ChatSpec[] = [];
  const jobGroupsMap = new Map<string, ChatJobGroup>();
  const jobSortMap = new Map<string, number>();

  jobs.forEach((job) => {
    const context = getJobContext(job);
    jobGroupsMap.set(context.key, {
      ...context,
      chats: [],
    });
    jobSortMap.set(context.key, getJobSortTime(job));
  });

  sortedChats.forEach((chat) => {
    const job = getChatJobContext(chat);
    if (!job) {
      unassignedChats.push(chat);
      return;
    }

    const existing = jobGroupsMap.get(job.key);
    if (existing) {
      existing.chats.push(chat);
      if (!existing.jobStatus && job.jobStatus) existing.jobStatus = job.jobStatus;
      existing.pendingFeedbackCount = Math.max(
        existing.pendingFeedbackCount,
        job.pendingFeedbackCount,
      );
      jobSortMap.set(
        job.key,
        Math.max(jobSortMap.get(job.key) ?? 0, getChatSortTime(chat)),
      );
      return;
    }

    jobGroupsMap.set(job.key, {
      ...job,
      chats: [chat],
    });
    jobSortMap.set(job.key, getChatSortTime(chat));
  });

  const jobGroups = [...jobGroupsMap.values()].sort((a, b) => {
    const latestA = jobSortMap.get(a.key) ?? 0;
    const latestB = jobSortMap.get(b.key) ?? 0;
    return latestB - latestA;
  });

  return {
    unassignedChats,
    jobGroups,
  };
}

export function formatChatTime(raw: string | null | undefined): string {
  if (!raw) return "";
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return "";

  const now = Date.now();
  const diff = now - date.getTime();
  const minute = 60 * 1000;
  const hour = 60 * minute;
  const day = 24 * hour;

  if (diff < hour) {
    return `${Math.max(1, Math.floor(diff / minute))} 分钟前`;
  }
  if (diff < day) {
    return `${Math.max(1, Math.floor(diff / hour))} 小时前`;
  }
  if (diff < 7 * day) {
    return `${Math.max(1, Math.floor(diff / day))} 天前`;
  }

  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function buildChatPayload(job?: ChatJobContext | null): Partial<ChatSpec> {
  const timestamp = Date.now();
  const sessionId = `${DEFAULT_CHANNEL}:${DEFAULT_USER_ID}:${timestamp}`;

  if (!job) {
    return {
      name: DEFAULT_SESSION_NAME,
      session_id: sessionId,
      user_id: DEFAULT_USER_ID,
      channel: DEFAULT_CHANNEL,
      meta: {},
    };
  }

  return {
    name: DEFAULT_SESSION_NAME,
    session_id: sessionId,
    user_id: DEFAULT_USER_ID,
    channel: DEFAULT_CHANNEL,
    meta: {
      job: {
        id: job.jobId,
        name: job.jobName,
        status: job.jobStatus,
        pending_feedback_count: job.pendingFeedbackCount,
      },
      job_id: job.jobId,
      job_name: job.jobName,
      job_status: job.jobStatus,
      pending_feedback_count: job.pendingFeedbackCount,
    },
  };
}

export function notifyChatWorkspaceUpdated(
  detail: ChatWorkspaceUpdateDetail = {},
): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent<ChatWorkspaceUpdateDetail>(CHAT_WORKSPACE_UPDATED_EVENT, {
      detail,
    }),
  );
}

export function openJobDetailPanel(job: ChatJobDetails): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent<OpenJobDetailPanelDetail>(OPEN_JOB_DETAIL_PANEL_EVENT, {
      detail: { job },
    }),
  );
}

export function notifyJobPipelineUpdated(jobId: string): void {
  if (typeof window === "undefined" || !jobId) return;
  window.dispatchEvent(
    new CustomEvent<JobPipelineUpdatedDetail>(JOB_PIPELINE_UPDATED_EVENT, {
      detail: { jobId },
    }),
  );
}
