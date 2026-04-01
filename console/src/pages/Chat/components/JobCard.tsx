import { useMemo } from "react";
import { Tag } from "antd";
import {
  openJobDetailPanel,
  type ChatJobDetails,
} from "../chatWorkspace";
import {
  normalizeJobCardPayload,
  type JobCardPayload,
} from "../utils";
import styles from "./resumeCards.module.less";

type JobCardProps = {
  card: JobCardPayload;
  index: number;
};

function splitRequirementLines(value: string): string[] {
  if (!value.trim()) return [];
  return value
    .split(/\n+|[；;]+/)
    .map((item) => item.replace(/^\s*[-*•\d.]+\s*/, "").trim())
    .filter(Boolean)
    .slice(0, 4);
}

function readPendingFeedbackCount(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return 0;
}

export default function JobCard(props: JobCardProps) {
  const card = useMemo(() => normalizeJobCardPayload(props.card), [props.card]);

  const jobId =
    (typeof card.job_id === "string" && card.job_id.trim()) ||
    (typeof card.id === "string" && card.id.trim()) ||
    "";
  const jobName =
    (typeof card.job_name === "string" && card.job_name.trim()) ||
    (typeof card.name === "string" && card.name.trim()) ||
    (typeof card.title === "string" && card.title.trim()) ||
    `职位 ${String(props.index + 1)}`;
  const status =
    (typeof card.status === "string" && card.status.trim()) ||
    (typeof card.job_status === "string" && card.job_status.trim()) ||
    "";
  const city =
    (typeof card.city === "string" && card.city.trim()) ||
    (typeof card.location === "string" && card.location.trim()) ||
    "";
  const salaryRange =
    typeof card.salary_range === "string" ? card.salary_range.trim() : "";
  const description =
    typeof card.description === "string" ? card.description.trim() : "";
  const requirements =
    typeof card.requirements === "string" ? card.requirements.trim() : "";
  const requirementLines = splitRequirementLines(requirements);
  const tags = (Array.isArray(card.tags) ? card.tags : []).filter(Boolean);
  const highlights = (Array.isArray(card.highlights) ? card.highlights : [])
    .filter(Boolean)
    .slice(0, 4);
  const normalizedTags = tags.filter((item): item is string => typeof item === "string");
  const normalizedHighlights = highlights.filter(
    (item): item is string => typeof item === "string",
  );
  const pendingFeedbackCount = readPendingFeedbackCount(card.pending_feedback_count);

  const detail: ChatJobDetails = {
    key: jobId || `job-name:${jobName}`,
    jobId: jobId || null,
    jobName,
    jobStatus: status || null,
    pendingFeedbackCount,
    description: description || null,
    requirements: requirements || null,
  };

  const handleOpen = () => {
    openJobDetailPanel(detail);
  };

  return (
    <div
      className={styles.jobCard}
      role="button"
      tabIndex={0}
      onClick={handleOpen}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          handleOpen();
        }
      }}
    >
      <div className={styles.jobCardHeader}>
        <span className={styles.jobCardLabel}>职位卡片</span>
        {status ? <span className={styles.jobCardStatus}>{status}</span> : null}
      </div>

      <div className={styles.jobCardTitle}>{jobName}</div>

      <div className={styles.jobCardMetaRow}>
        {jobId ? (
          <span className={styles.jobCardMetaItem}>职位 ID {jobId}</span>
        ) : null}
        {city ? <span className={styles.jobCardMetaItem}>{city}</span> : null}
        {salaryRange ? (
          <span className={styles.jobCardMetaItem}>{salaryRange}</span>
        ) : null}
      </div>

      {description ? (
        <div className={styles.jobCardSection}>
          <div className={styles.jobCardSectionLabel}>职位描述</div>
          <div className={styles.jobCardSectionText}>{description}</div>
        </div>
      ) : null}

      {requirementLines.length > 0 || requirements ? (
        <div className={styles.jobCardSection}>
          <div className={styles.jobCardSectionLabel}>职位要求</div>
          {requirementLines.length > 0 ? (
            <div className={styles.jobCardBulletList}>
              {requirementLines.map((item) => (
                <div key={`${jobName}-${item}`} className={styles.jobCardBulletItem}>
                  {item}
                </div>
              ))}
            </div>
          ) : (
            <div className={styles.jobCardSectionText}>{requirements}</div>
          )}
        </div>
      ) : null}

      {normalizedTags.length > 0 || normalizedHighlights.length > 0 ? (
        <div className={styles.jobCardTagRow}>
          {normalizedTags.slice(0, 4).map((tag) => (
            <Tag key={`${jobName}-tag-${tag}`} color="orange">
              {tag}
            </Tag>
          ))}
          {normalizedHighlights.map((item) => (
            <Tag key={`${jobName}-highlight-${item}`}>{item}</Tag>
          ))}
        </div>
      ) : null}
    </div>
  );
}
