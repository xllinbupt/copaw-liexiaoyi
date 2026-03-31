import { useMemo, useState } from "react";
import { Button, Empty, Modal, Spin, Tag } from "antd";
import { LinkOutlined } from "@ant-design/icons";
import {
  normalizeResumeCardPayload,
  type ResumeCardPayload,
} from "../utils";
import styles from "./resumeCards.module.less";

type ResumeCandidateCardProps = {
  card: ResumeCardPayload;
  index: number;
};

type TimelineEntry = {
  primary: string;
  secondary?: string;
  period?: string;
};

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
        return { primary: item };
      }

      const company = item.company?.trim() || "";
      const title = item.title?.trim() || "";
      const summary = item.summary?.trim() || "";

      return {
        primary: [company, title].filter(Boolean).join(" | ") || summary,
        secondary:
          [summary].filter(Boolean).join(" ") ||
          [company, title].filter(Boolean).join(" | "),
        period: item.period?.trim() || "",
      };
    })
    .filter((item) => item.primary);
}

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

export default function ResumeCandidateCard(
  props: ResumeCandidateCardProps,
) {
  const [open, setOpen] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const card = useMemo(() => normalizeResumeCardPayload(props.card), [props.card]);

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
    card.current_salary ? `目前薪资 ${card.current_salary}` : "",
  ].filter(Boolean);
  const educationEntries = normalizeEducationEntries(card.education_experiences);
  const educationText = educationEntries[0] || card.education || "暂无教育信息";
  const workTimeline = normalizeTimelineEntries(card.work_experiences);
  const workSummary: TimelineEntry[] =
    workTimeline.length > 0
      ? workTimeline.slice(0, 3)
      : highlights.map((item) => ({ primary: item } as TimelineEntry));
  const reasonText = card.match_reason || card.summary || "";
  const updateLabel = card.updated_at || "";

  const openPreview = () => {
    if (!detailUrl) return;
    setLoaded(false);
    setOpen(true);
  };

  return (
    <>
      <div
        className={`${styles.resumeCard} ${
          !detailUrl ? styles.resumeCardDisabled : ""
        }`}
        onClick={detailUrl ? openPreview : undefined}
        role={detailUrl ? "button" : undefined}
        tabIndex={detailUrl ? 0 : -1}
        onKeyDown={
          detailUrl
            ? (event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  openPreview();
                }
              }
            : undefined
        }
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
                <div className={styles.resumeEducationInline}>{educationText}</div>
                {updateLabel ? (
                  <div className={styles.resumeUpdateBadge}>{updateLabel}</div>
                ) : null}
              </div>
            </div>
          </div>

          <div className={styles.resumeCardRight}>
            <div className={styles.resumeTimeline}>
              {workSummary.map((item, idx) => (
                <div
                  key={`${name}-${item.primary}-${idx}`}
                  className={styles.resumeTimelineItem}
                >
                  <div className={styles.resumeTimelineMarker} />
                  <div className={styles.resumeTimelineContent}>
                    <div className={styles.resumeTimelinePrimary}>{item.primary}</div>
                    {item.secondary &&
                    item.secondary !== item.primary ? (
                      <div className={styles.resumeTimelineSecondary}>
                        {item.secondary}
                      </div>
                    ) : null}
                    {item.period ? (
                      <div className={styles.resumeTimelinePeriod}>{item.period}</div>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
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

        {reasonText ? (
          <div className={styles.resumeCardReasonBar}>
            <span className={styles.resumeCardReasonLabel}>推荐理由</span>
            <span className={styles.resumeCardReasonText}>{reasonText}</span>
          </div>
        ) : null}
      </div>

      <Modal
        open={open}
        onCancel={() => setOpen(false)}
        title={name}
        width={1120}
        footer={[
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
        <div className={styles.resumeModalNotice}>
          当前为站内弹窗预览。如果目标站点不支持内嵌，请使用“新标签打开”。
        </div>

        {detailUrl ? (
          <div className={styles.resumePreviewShell}>
            {!loaded ? (
              <div className={styles.resumePreviewLoading}>
                <Spin tip="正在加载简历详情..." />
              </div>
            ) : null}
            <iframe
              className={styles.resumePreviewFrame}
              src={detailUrl}
              title={`${name} 简历详情`}
              onLoad={() => setLoaded(true)}
            />
          </div>
        ) : (
          <div className={styles.resumePreviewEmpty}>
            <Empty description="暂无可预览的简历详情链接" />
          </div>
        )}
      </Modal>
    </>
  );
}
