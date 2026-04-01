import React from "react";
import type { ChatSpec } from "../../../../api/types";
import { getChatJobContext } from "../../chatWorkspace";
import styles from "./index.module.less";

interface ChatHeaderTitleProps {
  currentChat?: ChatSpec | null;
}

const ChatHeaderTitle: React.FC<ChatHeaderTitleProps> = ({ currentChat }) => {
  const chatName = currentChat?.name || "New Chat";
  const jobContext = currentChat ? getChatJobContext(currentChat) : null;

  return (
    <div className={styles.headerContent}>
      <span className={styles.chatName}>{chatName}</span>
      <div className={styles.chatMeta}>
        {jobContext ? (
          <>
            <span className={styles.jobName}>{jobContext.jobName}</span>
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
