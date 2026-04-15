import { useMemo, useState, type ReactNode } from "react";
import { Button, Drawer, Empty, Tag, message } from "antd";
import { LinkOutlined, MessageOutlined, PlusOutlined } from "@ant-design/icons";
import { useLocation } from "react-router-dom";
import { jobApi } from "../../../api/modules/job";
import {
  normalizeResumeCardPayload,
  type ResumeCardPayload,
} from "../utils";
import {
  notifyJobPipelineUpdated,
  openJobDetailPanel,
  insertChatReference,
} from "../chatWorkspace";
import {
  buildAddPipelineCandidatePayload,
  getCurrentChatForPipeline,
  getJobDetailsOrThrow,
} from "./resumePipeline";
import styles from "./resumeCards.module.less";

type ResumeCandidateCardProps = {
  card: ResumeCardPayload;
  index: number;
  selectionControl?: ReactNode;
};

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

type EducationExperienceItem = Exclude<
  NonNullable<ResumeCardPayload["education_experiences"]>[number],
  string
>;

function getInitials(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return "LP";
  return trimmed.slice(0, 2).toUpperCase();
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

function formatEducationPeriod(item: EducationExperienceItem): string {
  return normalizePeriodValue(item.period?.trim());
}

function normalizeEducationEntries(
  value: ResumeCardPayload["education_experiences"],
): TimelineEntry[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      if (typeof item === "string") {
        return { fallback: item.trim() };
      }

      const company = item.school?.trim() || "";
      const title = item.degree?.trim() || "";
      const summary = item.major?.trim() || "";
      const period = formatEducationPeriod(item);

      return {
        company,
        title,
        period,
        summary,
        fallback: [company, title, summary, period].filter(Boolean).join(" | "),
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
  return item.summary ? [header, item.summary].filter(Boolean).join(" | ") : (header || item.fallback || "");
}

function buildCandidateReferenceText(params: {
  name: string;
  candidateId: string;
}) {
  return params.candidateId
    ? `@候选人 ${params.name}（ID：${params.candidateId}）`
    : `@候选人 ${params.name}`;
}

export default function ResumeCandidateCard(
  props: ResumeCandidateCardProps,
) {
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const [addingToPipeline, setAddingToPipeline] = useState(false);
  const card = useMemo(() => normalizeResumeCardPayload(props.card), [props.card]);
  const chatId = useMemo(() => {
    const match = location.pathname.match(/^\/chat\/(.+)$/);
    return match?.[1] || "";
  }, [location.pathname]);

  const name =
    card.candidate_name || card.name || `候选人 ${String(props.index + 1)}`;
  const gender = card.gender || card.sex || "";
  const age = card.age ? `${String(card.age)}岁` : "";
  const title = card.current_title || "";
  const company = card.current_company || card.company || "";
  const detailUrl = card.resume_detail_url || card.detail_url || "";
  const tags = (Array.isArray(card.tags) ? card.tags : []).filter(Boolean);
  const highlights = (Array.isArray(card.highlights) ? card.highlights : [])
    .filter(Boolean)
    .slice(0, 3);
  const metaLine = [
    gender,
    age,
    card.years_experience ? `${String(card.years_experience)}年工作经验` : "",
    card.city || card.location || "",
  ].filter(Boolean);
  const salaryLine = [
    card.expected_salary ? `期望薪资 ${card.expected_salary}` : "",
  ].filter(Boolean);
  const educationTimeline = normalizeEducationEntries(card.education_experiences);
  const educationText =
    educationTimeline[0]?.fallback ||
    [educationTimeline[0]?.company, educationTimeline[0]?.title, educationTimeline[0]?.period]
      .filter(Boolean)
      .join(" | ") ||
    card.education ||
    "";
  const educationSummary: TimelineEntry[] =
    educationTimeline.length > 0
      ? educationTimeline.slice(0, 2)
      : card.education
        ? [{ fallback: card.education }]
        : [];
  const workTimeline = normalizeTimelineEntries(card.work_experiences);
  const latestWorkExperience = getLatestWorkExperienceSummary(workTimeline[0]);
  const workSummary: TimelineEntry[] =
    workTimeline.length > 0
      ? workTimeline.slice(0, 3)
      : highlights.map((item) => ({ fallback: item } as TimelineEntry));
  const reasonText = card.match_reason || card.summary || "";
  const updateLabel = card.updated_at || "";
  const sourceCandidateKey =
    (typeof card.resIdEncode === "string" && card.resIdEncode.trim()) ||
    (typeof card.resumeIdEncode === "string" && card.resumeIdEncode.trim()) ||
    (typeof card.candidate_id === "string" && card.candidate_id.trim()) ||
    "";

  const openCardDetail = () => {
    if (detailUrl) {
      window.open(detailUrl, "_blank", "noopener,noreferrer");
      return;
    }
    setOpen(true);
  };

  const handleInsertReference = (event: {
    preventDefault: () => void;
    stopPropagation: () => void;
  }) => {
    event.preventDefault();
    event.stopPropagation();

    insertChatReference(
      buildCandidateReferenceText({
        name,
        candidateId: sourceCandidateKey,
      }),
    );
    message.success("已把候选人卡片引用插入输入框");
  };

  const handleAddToPipeline = async (event: {
    preventDefault: () => void;
    stopPropagation: () => void;
  }) => {
    event.preventDefault();
    event.stopPropagation();

    if (!chatId) {
      message.warning("请先进入一个具体聊天，再把候选人加入 Pipeline");
      return;
    }

    setAddingToPipeline(true);
    try {
      const currentChat = await getCurrentChatForPipeline(chatId);
      if (!currentChat) {
        message.warning("没有找到当前聊天，请刷新后重试");
        return;
      }

      const jobDetails = getJobDetailsOrThrow(currentChat);

      const result = await jobApi.addPipelineCandidate(
        jobDetails.jobId,
        buildAddPipelineCandidatePayload(card, currentChat),
      );

      notifyJobPipelineUpdated(jobDetails.jobId);
      openJobDetailPanel(jobDetails);
      message.success(
        result.created
          ? `已加入 ${jobDetails.jobName} 的 Pipeline`
          : "该候选人已经在这个职位的 Pipeline 里了",
      );
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "加入 Pipeline 失败";
      message.error(
        errorMessage,
      );
    } finally {
      setAddingToPipeline(false);
    }
  };

  const renderTimelineEntry = (item: TimelineEntry, idx: number) => {
    const fallback = item.fallback || "";
    const showHeader = Boolean(item.company || item.title || item.period);
    const showTitle = Boolean(item.title);
    const showSummary = Boolean(item.summary);
    const showFallback = !showHeader && !showTitle && !showSummary && fallback;

    return (
      <div
        key={`${name}-${item.company || item.title || item.period || fallback}-${idx}`}
        className={styles.resumeTimelineItem}
      >
        <div className={styles.resumeTimelineMarker} />
        <div className={styles.resumeTimelineContent}>
          {showHeader ? (
            <div className={styles.resumeTimelineHeader}>
              {item.company || fallback ? (
                <div className={styles.resumeTimelineCompany}>
                  {item.company || fallback}
                </div>
              ) : null}
              {(item.company || fallback) && item.title ? (
                <div className={styles.resumeTimelineDivider}>|</div>
              ) : null}
              {item.title ? (
                <div className={styles.resumeTimelineTitle}>{item.title}</div>
              ) : null}
              {(item.period && ((item.company || fallback) || item.title)) ? (
                <div className={styles.resumeTimelineDivider}>|</div>
              ) : null}
              {item.period ? (
                <div className={styles.resumeTimelinePeriod}>{item.period}</div>
              ) : null}
            </div>
          ) : null}
          {showSummary ? (
            <div className={styles.resumeTimelineSecondary}>{item.summary}</div>
          ) : null}
          {showFallback ? (
            <div className={styles.resumeTimelineFallback}>{fallback}</div>
          ) : null}
        </div>
      </div>
    );
  };

  return (
    <>
      <div
        className={styles.resumeCard}
        onClick={openCardDetail}
        role="button"
        tabIndex={0}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            openCardDetail();
          }
        }}
      >
        <div className={styles.resumeCardShell}>
          <div className={styles.resumeCardLeft}>
            <div className={styles.resumeCardIdentity}>
              <div className={styles.resumeCardAvatar}>
                {card.avatar_url ? (
                  <img src={card.avatar_url} alt={name} />
                ) : (
                  <span>{getInitials(name)}</span>
                )}
              </div>
              <div className={styles.resumeCardNameBlock}>
                <div className={styles.resumeCardTopRow}>
                  {props.selectionControl ? (
                    <div
                      className={styles.resumeCardSelection}
                      onClick={(event) => event.stopPropagation()}
                      onKeyDown={(event) => event.stopPropagation()}
                    >
                      {props.selectionControl}
                    </div>
                  ) : null}
                  <div className={styles.resumeCardName}>{name}</div>
                </div>
                <div className={styles.resumeCardHeadline}>
                  {[title, company].filter(Boolean).join(" | ")}
                </div>
                {metaLine.length > 0 ? (
                  <div className={styles.resumeMetaLine}>
                    {metaLine.map((item) => (
                      <span key={`${name}-${item}`} className={styles.resumeMetaItem}>
                        {item}
                      </span>
                    ))}
                  </div>
                ) : null}
                {salaryLine.length > 0 ? (
                  <div className={styles.resumeSalaryLine}>
                    {salaryLine.map((item) => (
                      <span key={`${name}-${item}`} className={styles.resumeSalaryItem}>
                        {item}
                      </span>
                    ))}
                  </div>
                ) : null}
                {updateLabel ? (
                  <div className={styles.resumeUpdateBadge}>{updateLabel}</div>
                ) : null}
              </div>
            </div>
          </div>

          <div className={styles.resumeCardRight}>
            <div className={styles.resumeTimeline}>
              {workSummary.map(renderTimelineEntry)}
            </div>
            {educationSummary.length > 0 ? (
              <div className={styles.resumeTimeline}>
                {educationSummary.map(renderTimelineEntry)}
              </div>
            ) : null}
          </div>
        </div>

        {tags.length > 0 ? (
          <div className={styles.resumeBottomTags}>
            {tags.map((tag) => (
              <Tag key={`${name}-${tag}`} color="orange">
                {tag}
              </Tag>
            ))}
          </div>
        ) : null}

        <div className={styles.resumeCardFooter}>
          {reasonText ? (
            <div className={styles.resumeCardReasonBar}>
              <span className={styles.resumeCardReasonLabel}>推荐理由</span>
              <span className={styles.resumeCardReasonText}>{reasonText}</span>
            </div>
          ) : (
            <div />
          )}

          <div className={styles.resumeCardActions}>
            <Button
              size="small"
              icon={<MessageOutlined />}
              onClick={handleInsertReference}
            >
              引用
            </Button>
            <Button
              size="small"
              icon={<PlusOutlined />}
              loading={addingToPipeline}
              onClick={(event) => {
                void handleAddToPipeline(event);
              }}
            >
              加入职位
            </Button>
          </div>
        </div>
      </div>

      <Drawer
        open={open}
        onClose={() => setOpen(false)}
        title={name}
        width={960}
        placement="right"
        extra={[
          <Button key="close" onClick={() => setOpen(false)}>
            关闭
          </Button>,
          <Button
            key="open"
            type="primary"
            icon={<LinkOutlined />}
            disabled={!detailUrl}
            onClick={() => {
              if (detailUrl) {
                window.open(detailUrl, "_blank", "noopener,noreferrer");
              }
            }}
          >
            新标签打开
          </Button>,
        ]}
        destroyOnHidden
      >
        <div className={styles.resumeDetailPanel}>
          <div className={styles.resumeDetailPrimary}>
            <div className={styles.resumeDetailHeader}>
              <div className={styles.resumeDetailTitleBlock}>
                <div className={styles.resumeDetailName}>{name}</div>
                <div className={styles.resumeDetailHeadline}>
                  {[title, company].filter(Boolean).join(" | ") || "暂无当前职位信息"}
                </div>
              </div>
              {detailUrl ? (
                <Button
                  type="link"
                  icon={<LinkOutlined />}
                  onClick={() => {
                    window.open(detailUrl, "_blank", "noopener,noreferrer");
                  }}
                >
                  查看原始简历 URL
                </Button>
              ) : null}
            </div>

            <div className={styles.resumeDetailGrid}>
              <div className={styles.resumeDetailItem}>
                <div className={styles.resumeDetailLabel}>基础信息</div>
                <div className={styles.resumeDetailValue}>
                  {metaLine.length > 0 ? metaLine.join(" · ") : "暂无"}
                </div>
              </div>
              <div className={styles.resumeDetailItem}>
                <div className={styles.resumeDetailLabel}>期望薪资</div>
                <div className={styles.resumeDetailValue}>
                  {card.expected_salary || "暂无"}
                </div>
              </div>
              <div className={styles.resumeDetailItem}>
                <div className={styles.resumeDetailLabel}>学校 / 教育</div>
                <div className={styles.resumeDetailValue}>{educationText || "暂无"}</div>
              </div>
              <div className={styles.resumeDetailItem}>
                <div className={styles.resumeDetailLabel}>最近更新</div>
                <div className={styles.resumeDetailValue}>{updateLabel || "暂无"}</div>
              </div>
            </div>

            {reasonText ? (
              <section className={styles.resumeDetailSection}>
                <div className={styles.resumeDetailSectionTitle}>推荐理由</div>
                <div className={styles.resumeDetailSectionBody}>{reasonText}</div>
              </section>
            ) : null}

            {latestWorkExperience ? (
              <section className={styles.resumeDetailSection}>
                <div className={styles.resumeDetailSectionTitle}>最新工作经历</div>
                <div className={styles.resumeDetailSectionBody}>{latestWorkExperience}</div>
              </section>
            ) : null}

            {workSummary.length > 0 ? (
              <section className={styles.resumeDetailSection}>
                <div className={styles.resumeDetailSectionTitle}>工作经历摘要</div>
                <div className={styles.resumeDetailTimeline}>
                  {workSummary.map(renderTimelineEntry)}
                </div>
              </section>
            ) : null}

            {tags.length > 0 ? (
              <section className={styles.resumeDetailSection}>
                <div className={styles.resumeDetailSectionTitle}>标签</div>
                <div className={styles.resumeDetailTags}>
                  {tags.map((tag) => (
                    <Tag key={`${name}-detail-${tag}`} color="orange">
                      {tag}
                    </Tag>
                  ))}
                </div>
              </section>
            ) : null}

            <section className={styles.resumeDetailSection}>
              <div className={styles.resumeDetailSectionTitle}>原始链接</div>
              {detailUrl ? (
                <a
                  className={styles.resumeDetailLink}
                  href={detailUrl}
                  target="_blank"
                  rel="noreferrer"
                >
                  {detailUrl}
                </a>
              ) : (
                <Empty description="当前卡片未附带原始简历链接" />
              )}
            </section>
          </div>
        </div>
      </Drawer>
    </>
  );
}
