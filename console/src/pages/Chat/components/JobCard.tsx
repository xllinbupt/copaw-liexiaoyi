import { useMemo } from "react";
import { openJobDetailPanel, type ChatJobDetails } from "../chatWorkspace";
import { normalizeJobCardPayload, type JobCardPayload } from "../utils";
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
    .slice(0, 2);
}

function summarizeText(value: string): string {
  return value.replace(/\s+/g, " ").trim();
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
  const descriptionSummary = summarizeText(description);
  const requirementLines = splitRequirementLines(requirements);
  const requirementsSummary = requirementLines.length
    ? requirementLines.join("；")
    : summarizeText(requirements);
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

      {city || salaryRange ? (
        <div className={styles.jobCardMetaRow}>
          {city ? <span className={styles.jobCardMetaItem}>{city}</span> : null}
          {salaryRange ? (
            <span className={styles.jobCardMetaItem}>{salaryRange}</span>
          ) : null}
        </div>
      ) : null}

      {descriptionSummary || requirementsSummary ? (
        <div className={styles.jobCardBody}>
          {descriptionSummary ? (
            <div className={styles.jobCardSummaryRow}>
              <div className={styles.jobCardSummaryLabel}>描述</div>
              <div className={styles.jobCardSummaryText}>{descriptionSummary}</div>
            </div>
          ) : null}
          {requirementsSummary ? (
            <div className={styles.jobCardSummaryRow}>
              <div className={styles.jobCardSummaryLabel}>要求</div>
              <div className={styles.jobCardSummaryText}>{requirementsSummary}</div>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
