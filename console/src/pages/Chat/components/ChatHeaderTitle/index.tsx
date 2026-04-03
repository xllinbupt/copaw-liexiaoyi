import React from "react";
import { RightOutlined } from "@ant-design/icons";
import type { ChatSpec } from "../../../../api/types";
import { getChatJobContext } from "../../chatWorkspace";
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
