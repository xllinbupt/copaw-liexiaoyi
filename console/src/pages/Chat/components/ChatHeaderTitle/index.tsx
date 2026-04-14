import React, { useEffect, useMemo, useState } from "react";
import { RightOutlined } from "@ant-design/icons";
import { jobApi } from "../../../../api/modules/job";
import type { ChatSpec } from "../../../../api/types";
import {
  getChatJobContext,
  JOB_PIPELINE_UPDATED_EVENT,
  type JobPipelineUpdatedDetail,
} from "../../chatWorkspace";
import {
  getPipelineTabStats,
  getVisiblePipelineStatItems,
  type PipelineTabStats,
} from "../pipelineStats";
import styles from "./index.module.less";

interface ChatHeaderTitleProps {
  currentChat?: ChatSpec | null;
  onJobClick?: () => void;
}

const ChatHeaderTitle: React.FC<ChatHeaderTitleProps> = ({
  currentChat,
  onJobClick,
}) => {
  const chatName = currentChat?.name || "New Chat";
  const jobContext = currentChat ? getChatJobContext(currentChat) : null;
  const [pipelineStats, setPipelineStats] = useState<PipelineTabStats>({
    lead: 0,
    active: 0,
    interviewing: 0,
  });
  const visiblePipelineStats = useMemo(
    () => getVisiblePipelineStatItems(pipelineStats),
    [pipelineStats],
  );

  useEffect(() => {
    const jobId = jobContext?.jobId;
    if (!jobId) {
      setPipelineStats({ lead: 0, active: 0, interviewing: 0 });
      return;
    }

    let disposed = false;

    const loadPipelineStats = async () => {
      try {
        const board = await jobApi.getJobPipeline(jobId);
        if (!disposed) {
          setPipelineStats(getPipelineTabStats(board));
        }
      } catch {
        if (!disposed) {
          setPipelineStats({ lead: 0, active: 0, interviewing: 0 });
        }
      }
    };

    void loadPipelineStats();

    const handlePipelineUpdated = (event: Event) => {
      const customEvent = event as CustomEvent<JobPipelineUpdatedDetail>;
      if (customEvent.detail?.jobId !== jobId) return;
      void loadPipelineStats();
    };

    window.addEventListener(
      JOB_PIPELINE_UPDATED_EVENT,
      handlePipelineUpdated as EventListener,
    );

    return () => {
      disposed = true;
      window.removeEventListener(
        JOB_PIPELINE_UPDATED_EVENT,
        handlePipelineUpdated as EventListener,
      );
    };
  }, [jobContext?.jobId]);

  return (
    <div className={styles.headerContent}>
      <span className={styles.chatName}>{chatName}</span>
      <div className={styles.chatMeta}>
        {jobContext ? (
          <>
            <button
              type="button"
              className={styles.jobNameButton}
              onClick={onJobClick}
              title={`查看职位详情：${jobContext.jobName}`}
            >
              <span className={styles.jobName}>{jobContext.jobName}</span>
              <RightOutlined className={styles.jobNameIcon} />
            </button>
            {visiblePipelineStats.length ? (
              <span className={styles.pipelineStatsInline}>
                {visiblePipelineStats.map((item) => (
                  <span
                    key={item.key}
                    className={`${styles.pipelineStatChip} ${styles[`pipelineStatChip${item.key.charAt(0).toUpperCase()}${item.key.slice(1)}`]}`}
                  >
                    {item.label} {item.value}
                  </span>
                ))}
              </span>
            ) : null}
            {jobContext.pendingFeedbackCount > 0 ? (
              <span className={styles.metaTag}>
                待反馈 {jobContext.pendingFeedbackCount}
              </span>
            ) : null}
          </>
        ) : (
          <span className={styles.unassignedText}>未关联职位</span>
        )}
      </div>
    </div>
  );
};

export default ChatHeaderTitle;
