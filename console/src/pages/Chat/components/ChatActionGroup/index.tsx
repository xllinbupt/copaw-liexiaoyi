import React, { useState } from "react";
import { IconButton } from "@agentscope-ai/design";
import { SparkHistoryLine, SparkNewChatFill } from "@agentscope-ai/icons";
import { useTranslation } from "react-i18next";
import { Flex, Tooltip } from "antd";
import ChatSessionDrawer from "../ChatSessionDrawer";

interface ChatActionGroupProps {
  onCreateChat?: () => void;
  showHistory?: boolean;
}

const ChatActionGroup: React.FC<ChatActionGroupProps> = ({
  onCreateChat,
  showHistory = false,
}) => {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);

  return (
    <Flex gap={8} align="center">
      <Tooltip title={t("chat.newChatTooltip")} mouseEnterDelay={0.5}>
        <IconButton
          bordered={false}
          icon={<SparkNewChatFill />}
          onClick={() => onCreateChat?.()}
        />
      </Tooltip>
      {showHistory ? (
        <>
          <Tooltip title={t("chat.chatHistoryTooltip")} mouseEnterDelay={0.5}>
            <IconButton
              bordered={false}
              icon={<SparkHistoryLine />}
              onClick={() => setOpen(true)}
            />
          </Tooltip>
          <ChatSessionDrawer open={open} onClose={() => setOpen(false)} />
        </>
      ) : null}
    </Flex>
  );
};

export default ChatActionGroup;
