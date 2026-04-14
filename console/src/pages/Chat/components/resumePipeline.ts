import { chatApi } from "../../../api/modules/chat";
import type {
  AddPipelineCandidateRequest,
  BatchPipelineEntryMutationResult,
  ChatSpec,
} from "../../../api/types";
import type { ResumeCardPayload } from "../utils";
import {
  getChatJobDetails,
  type ChatJobDetails,
} from "../chatWorkspace";

function normalizeEducationEntries(
  value: ResumeCardPayload["education_experiences"],
): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      if (typeof item === "string") return item.trim();
      return [
        item.school?.trim(),
        item.major?.trim(),
        item.degree?.trim(),
        item.period?.trim(),
      ]
        .filter(Boolean)
        .join(" | ");
    })
    .filter(Boolean);
}

function getPrimarySchool(
  value: ResumeCardPayload["education_experiences"],
): string {
  if (!Array.isArray(value)) return "";
  for (const item of value) {
    if (typeof item !== "string" && item.school?.trim()) {
      return item.school.trim();
    }
  }
  return "";
}

type TimelineEntry = {
  company?: string;
  title?: string;
  period?: string;
  summary?: string;
  fallback?: string;
};

type WorkExperienceItem = Exclude<
  NonNullable<ResumeCardPayload["work_experiences"]>[number],
  string
>;

function normalizePeriodValue(value: string | undefined): string {
  if (!value) return "";
  const trimmed = value.trim();
  if (!trimmed) return "";
  return trimmed
    .replace(/[年/]/g, ".")
    .replace(/[月]/g, "")
    .replace(/[–—~～至]+/g, "-")
    .replace(/\s+/g, "")
    .replace(/(\d{4})\.(\d{1})(?!\d)/g, "$1.$2");
}

function normalizePeriodPoint(value: string | undefined): string {
  if (!value) return "";
  const normalized = normalizePeriodValue(value);
  if (!normalized) return "";

  const yearMonthMatch = normalized.match(/^(\d{4})\.(\d{1,2})$/);
  if (yearMonthMatch) {
    return `${yearMonthMatch[1]}.${String(Number(yearMonthMatch[2]))}`;
  }

  const yearMatch = normalized.match(/^(\d{4})$/);
  if (yearMatch) {
    return yearMatch[1];
  }

  return normalized;
}

function formatWorkPeriod(item: WorkExperienceItem): string {
  const explicitPeriod = normalizePeriodValue(item.period?.trim());
  if (explicitPeriod) return explicitPeriod;

  const start = normalizePeriodPoint(
    item.start_date ||
      item.start_time ||
      item.start ||
      item.from,
  );
  const endRaw =
    item.end_date || item.end_time || item.end || item.to;
  const end =
    item.is_current || item.current || item.to_present || item.present
      ? "至今"
      : normalizePeriodPoint(endRaw);

  if (start && end) return `${start}-${end}`;
  if (start) return `${start}-至今`;
  if (end) return end;
  return "";
}

function normalizeTimelineEntries(
  value: ResumeCardPayload["work_experiences"],
): TimelineEntry[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      if (typeof item === "string") {
        return { fallback: item.trim() };
      }

      const company = item.company?.trim() || "";
      const title = item.title?.trim() || "";
      const summary = item.summary?.trim() || "";
      const period = formatWorkPeriod(item);

      return {
        company,
        title,
        period,
        summary,
        fallback: [company, title, summary].filter(Boolean).join(" | "),
      };
    })
    .filter(
      (item) =>
        item.company || item.title || item.period || item.summary || item.fallback,
    );
}

function getLatestWorkExperienceSummary(item?: TimelineEntry): string {
  if (!item) return "";
  const header = [item.company, item.title, item.period].filter(Boolean).join(" | ");
  return item.summary
    ? [header, item.summary].filter(Boolean).join(" | ")
    : (header || item.fallback || "");
}

export async function getCurrentChatForPipeline(
  chatId: string,
): Promise<ChatSpec | null> {
  const chats = await chatApi.listChats({
    user_id: "default",
    channel: "console",
  });
  return chats.find((chat) => chat.id === chatId) || null;
}

export function buildAddPipelineCandidatePayload(
  card: ResumeCardPayload,
  currentChat: ChatSpec,
): AddPipelineCandidateRequest {
  const name = card.candidate_name || card.name || "未命名候选人";
  const gender = card.gender || card.sex || "";
  const title = card.current_title || "";
  const company = card.current_company || card.company || "";
  const detailUrl = card.resume_detail_url || card.detail_url || "";
  const tags = (Array.isArray(card.tags) ? card.tags : []).filter(Boolean);
  const highlights = (Array.isArray(card.highlights) ? card.highlights : [])
    .filter(Boolean)
    .slice(0, 3);
  const educationEntries = normalizeEducationEntries(card.education_experiences);
  const primarySchool = getPrimarySchool(card.education_experiences);
  const educationText = educationEntries[0] || card.education || "暂无教育信息";
  const workTimeline = normalizeTimelineEntries(card.work_experiences);
  const latestWorkExperience = getLatestWorkExperienceSummary(workTimeline[0]);
  const reasonText = card.match_reason || card.summary || "";
  const sourceCandidateKey =
    (typeof card.resIdEncode === "string" && card.resIdEncode.trim()) ||
    (typeof card.resumeIdEncode === "string" && card.resumeIdEncode.trim()) ||
    (typeof card.candidate_id === "string" && card.candidate_id.trim()) ||
    "";
  const sourcePlatform =
    (typeof card.source_platform === "string" && card.source_platform.trim()) ||
    (typeof card.source === "string" && card.source.trim()) ||
    "";

  return {
    candidate: {
      source_platform: sourcePlatform,
      source_candidate_key: sourceCandidateKey,
      name,
      gender,
      age: card.age,
      school: primarySchool,
      education_experience: educationText,
      current_title: title,
      current_company: company,
      latest_work_experience: latestWorkExperience,
      city: card.city || card.location || "",
      years_experience: card.years_experience,
      education: card.education || educationText,
      current_salary: card.current_salary || "",
      expected_salary: card.expected_salary || "",
      resume_detail_url: detailUrl,
      avatar_url: card.avatar_url || "",
      resume_snapshot: {
        candidate_name: name,
        current_title: title,
        current_company: company,
        city: card.city || card.location || "",
        years_experience: card.years_experience,
        education: card.education || educationText,
        expected_salary: card.expected_salary || "",
        match_reason: reasonText,
        summary: card.summary || "",
        tags,
        highlights,
      },
    },
    stage: "lead",
    source_type: "outbound",
    recruiter_interest: "unsure",
    candidate_interest: "unknown",
    summary: reasonText,
    added_by: "agent",
    source_chat_id: currentChat.id,
    source_session_id: currentChat.session_id,
    source_resume_id: sourceCandidateKey,
  };
}

export function formatBatchPipelineResult(
  result: BatchPipelineEntryMutationResult,
  jobName: string,
): string {
  if (result.created_count === result.total) {
    return `已将 ${result.created_count} 位候选人加入 ${jobName} 的 Pipeline`;
  }
  if (result.created_count === 0) {
    return `选中的 ${result.total} 位候选人都已在 ${jobName} 的 Pipeline 里了`;
  }
  return `已加入 ${result.created_count} 位候选人，另有 ${result.existing_count} 位已在 ${jobName} 的 Pipeline 里`;
}

export function getJobDetailsOrThrow(
  currentChat: ChatSpec,
): ChatJobDetails & { jobId: string } {
  const jobDetails = getChatJobDetails(currentChat);
  if (!jobDetails?.jobId) {
    throw new Error("当前聊天还没有绑定职位，请先绑定职位");
  }
  return {
    ...jobDetails,
    jobId: jobDetails.jobId,
  };
}
