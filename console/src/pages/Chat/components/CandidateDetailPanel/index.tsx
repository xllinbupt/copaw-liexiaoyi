import { Button, Empty, Segmented, Spin, Tag, message } from "antd";
import { useEffect, useMemo, useState } from "react";
import { jobApi } from "../../../../api/modules/job";
import type {
  CandidatePipelineActivityView,
  CandidatePipelineDetailView,
  PipelineEntryView,
} from "../../../../api/types";
import type {
  ChatCandidateDetails,
  ChatJobDetails,
} from "../../chatWorkspace";
import styles from "./index.module.less";

interface CandidateDetailPanelProps {
  candidate: ChatCandidateDetails;
  onOpenJob: (job: ChatJobDetails) => void;
}

type ActivityFilterMode = "current" | "all";

const SOURCE_TYPE_LABELS: Record<string, string> = {
  inbound: "主动投递",
  outbound: "主动搜寻",
  referral: "内推推荐",
  talent_pool: "人才库",
  manual: "手动录入",
};

const RECRUITER_INTEREST_LABELS: Record<string, string> = {
  strong_yes: "很合适",
  yes: "合适",
  unsure: "待评估",
  no: "淘汰",
};

const CANDIDATE_INTEREST_LABELS: Record<string, string> = {
  yes: "候选人有意向",
  unknown: "意向待确认",
  no: "候选人无意向",
  no_response: "候选人未回复",
};

const ACTOR_LABELS: Record<string, string> = {
  agent: "Agent",
  user: "人工",
  system: "系统",
};

function formatDateTime(raw?: string | null) {
  if (!raw) return "刚刚";
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return "刚刚";
  return date.toLocaleString("zh-CN", {
    hour12: false,
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getAgeLabel(value: string | number | null | undefined): string {
  if (value === null || value === undefined || value === "") return "";
  const normalized = String(value).trim();
  if (!normalized) return "";
  return normalized.endsWith("岁") ? normalized : `${normalized}岁`;
}

function getGenderLabel(value?: string | null): string {
  if (!value) return "";
  const normalized = value.trim();
  if (!normalized) return "";
  if (normalized === "male") return "男";
  if (normalized === "female") return "女";
  return normalized;
}

function buildJobContext(
  entry: PipelineEntryView,
  fallbackJob?: ChatJobDetails | null,
): ChatJobDetails {
  if (fallbackJob?.jobId === entry.job_id) {
    return fallbackJob;
  }
  return {
    key: entry.job_id,
    jobId: entry.job_id,
    jobName: entry.job_name || "未命名职位",
    jobStatus: null,
    pendingFeedbackCount: 0,
    description: null,
    requirements: null,
  };
}

function formatActivityTitle(activity: CandidatePipelineActivityView): string {
  const actor = ACTOR_LABELS[activity.actor_type] || "系统";
  if (activity.action_type === "added") {
    return `${actor}将候选人加入职位 Pipeline`;
  }
  if (activity.action_type === "stage_changed") {
    return `${actor}将节点从 ${activity.from_stage_name || "未知节点"} 调整为 ${
      activity.to_stage_name || "未知节点"
    }`;
  }

  const field = String(activity.payload?.field || "");
  if (field === "recruiter_interest") {
    return `${actor}将匹配度从 ${
      RECRUITER_INTEREST_LABELS[String(activity.payload?.from || "")] || "未设置"
    } 调整为 ${
      RECRUITER_INTEREST_LABELS[String(activity.payload?.to || "")] || "未设置"
    }`;
  }
  if (field === "candidate_interest") {
    return `${actor}更新候选人意向为 ${
      CANDIDATE_INTEREST_LABELS[String(activity.payload?.to || "")] || "未设置"
    }`;
  }
  return `${actor}更新了候选人跟进记录`;
}

export default function CandidateDetailPanel({
  candidate,
  onOpenJob,
}: CandidateDetailPanelProps) {
  const [loading, setLoading] = useState(true);
  const [detail, setDetail] = useState<CandidatePipelineDetailView | null>(null);
  const [filterMode, setFilterMode] = useState<ActivityFilterMode>(
    candidate.job?.jobId ? "current" : "all",
  );

  useEffect(() => {
    setFilterMode(candidate.job?.jobId ? "current" : "all");
  }, [candidate.job?.jobId, candidate.candidateId]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    jobApi
      .getPipelineCandidateDetail(candidate.candidateId)
      .then((data) => {
        if (!cancelled) {
          setDetail(data);
        }
      })
      .catch((error) => {
        if (!cancelled) {
          setDetail(null);
          message.error(
            error instanceof Error ? error.message : "加载候选人详情失败",
          );
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [candidate.candidateId]);

  const filteredActivities = useMemo(() => {
    if (!detail) return [];
    if (filterMode !== "current" || !candidate.job?.jobId) {
      return detail.activities;
    }
    return detail.activities.filter(
      (activity) => activity.job_id === candidate.job?.jobId,
    );
  }, [candidate.job?.jobId, detail, filterMode]);

  if (loading) {
    return (
      <div className={styles.loadingWrap}>
        <Spin />
      </div>
    );
  }

  if (!detail) {
    return (
      <div className={styles.emptyWrap}>
        <Empty description="暂时无法加载候选人详情" />
      </div>
    );
  }

  const profile = detail.candidate;
  const primaryFacts = [
    getGenderLabel(profile.gender),
    getAgeLabel(profile.age),
    profile.city?.trim(),
    profile.school?.trim(),
  ].filter(Boolean);

  return (
    <div className={styles.panelContent}>
      <section className={styles.profileSection}>
        <div className={styles.profileHeader}>
          <div>
            <div className={styles.profileName}>{profile.name || candidate.candidateName}</div>
            <div className={styles.profileFacts}>
              {primaryFacts.join(" · ") || "暂未补充基础信息"}
            </div>
          </div>
          {profile.expected_salary ? (
            <Tag className={styles.profileTag}>{profile.expected_salary}</Tag>
          ) : null}
        </div>
        <div className={styles.profileMeta}>
          <div className={styles.metaRow}>
            <span className={styles.metaLabel}>教育经历</span>
            <span className={styles.metaValue}>
              {profile.education_experience?.trim() ||
                profile.education?.trim() ||
                "暂未补充"}
            </span>
          </div>
          <div className={styles.metaRow}>
            <span className={styles.metaLabel}>最近工作</span>
            <span className={styles.metaValue}>
              {profile.latest_work_experience?.trim() ||
                [profile.current_company, profile.current_title]
                  .filter(Boolean)
                  .join(" | ") ||
                "暂未补充"}
            </span>
          </div>
        </div>
      </section>

      <section className={styles.section}>
        <div className={styles.sectionTitle}>相关职位</div>
        <div className={styles.jobList}>
          {detail.entries.length ? (
            detail.entries.map((entry) => (
              <button
                key={entry.id}
                type="button"
                className={styles.jobCard}
                onClick={() => onOpenJob(buildJobContext(entry, candidate.job))}
              >
                <div className={styles.jobCardHeader}>
                  <span className={styles.jobCardName}>
                    {entry.job_name || "未命名职位"}
                  </span>
                  <Tag>{entry.current_stage.name}</Tag>
                </div>
                <div className={styles.jobCardMeta}>
                  <span>
                    {SOURCE_TYPE_LABELS[entry.source_type] || entry.source_type}
                  </span>
                  <span>
                    {RECRUITER_INTEREST_LABELS[entry.recruiter_interest] ||
                      entry.recruiter_interest}
                  </span>
                  <span>
                    {CANDIDATE_INTEREST_LABELS[entry.candidate_interest] ||
                      entry.candidate_interest}
                  </span>
                </div>
                <div className={styles.jobCardSummary}>
                  {entry.summary?.trim() || "还没有补充推荐摘要"}
                </div>
              </button>
            ))
          ) : (
            <div className={styles.emptyInline}>该候选人还没有关联职位</div>
          )}
        </div>
      </section>

      <section className={styles.section}>
        <div className={styles.sectionHeader}>
          <div className={styles.sectionTitle}>跟进记录</div>
          {candidate.job?.jobId ? (
            <Segmented
              size="small"
              value={filterMode}
              options={[
                { label: "当前职位", value: "current" },
                { label: "全部职位", value: "all" },
              ]}
              onChange={(value) => {
                setFilterMode(value as ActivityFilterMode);
              }}
            />
          ) : null}
        </div>

        {filteredActivities.length ? (
          <div className={styles.timeline}>
            {filteredActivities.map((activity) => (
              <div key={activity.id} className={styles.timelineItem}>
                <div className={styles.timelineMarker} />
                <div className={styles.timelineContent}>
                  <div className={styles.timelineTopRow}>
                    <div className={styles.timelineTitle}>
                      {formatActivityTitle(activity)}
                    </div>
                    <div className={styles.timelineTime}>
                      {formatDateTime(activity.created_at)}
                    </div>
                  </div>
                  {activity.job_id ? (
                    <Button
                      type="link"
                      className={styles.timelineJobLink}
                      onClick={() =>
                        onOpenJob({
                          key: activity.job_id || activity.id,
                          jobId: activity.job_id || null,
                          jobName: activity.job_name || "未命名职位",
                          jobStatus: null,
                          pendingFeedbackCount: 0,
                          description: null,
                          requirements: null,
                        })
                      }
                    >
                      {activity.job_name || "查看相关职位"}
                    </Button>
                  ) : null}
                  {activity.note ? (
                    <div className={styles.timelineNote}>{activity.note}</div>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className={styles.emptyInline}>
            {filterMode === "current"
              ? "当前职位下还没有跟进记录"
              : "还没有候选人跟进记录"}
          </div>
        )}
      </section>
    </div>
  );
}
