import { Bubble } from "@agentscope-ai/chat";
import { useMemo } from "react";
import { Avatar, Flex } from "antd";
import AgentScopeRuntimeResponseBuilder from "@agentscope-ai/chat/lib/AgentScopeRuntimeWebUI/core/AgentScopeRuntime/Response/Builder";
import Actions from "@agentscope-ai/chat/lib/AgentScopeRuntimeWebUI/core/AgentScopeRuntime/Response/Actions";
import Error from "@agentscope-ai/chat/lib/AgentScopeRuntimeWebUI/core/AgentScopeRuntime/Response/Error";
import Message from "@agentscope-ai/chat/lib/AgentScopeRuntimeWebUI/core/AgentScopeRuntime/Response/Message";
import Reasoning from "@agentscope-ai/chat/lib/AgentScopeRuntimeWebUI/core/AgentScopeRuntime/Response/Reasoning";
import Tool from "@agentscope-ai/chat/lib/AgentScopeRuntimeWebUI/core/AgentScopeRuntime/Response/Tool";
import {
  AgentScopeRuntimeContentType,
  AgentScopeRuntimeMessageType,
  type IContent,
  type IAgentScopeRuntimeMessage,
  type IAgentScopeRuntimeResponse,
} from "@agentscope-ai/chat/lib/AgentScopeRuntimeWebUI/core/AgentScopeRuntime/types";
import { useChatAnywhereOptions } from "@agentscope-ai/chat/lib/AgentScopeRuntimeWebUI/core/Context/ChatAnywhereOptionsContext";
import {
  isResumeCardPayload,
  normalizeResumeCardPayload,
  parseResumeCardsFromText,
  type ResumeCardPayload,
} from "../utils";
import ResumeCandidateCard from "./ResumeCandidateCard";
import styles from "./resumeCards.module.less";

type ResumeResponseCardProps = {
  data: IAgentScopeRuntimeResponse;
  isLast?: boolean;
};

type SplitMessageResult = {
  visibleMessage: IAgentScopeRuntimeMessage | null;
  cards: ResumeCardPayload[];
};

function splitResumeCards(
  message: IAgentScopeRuntimeMessage,
): SplitMessageResult {
  if (!Array.isArray(message.content) || message.content.length === 0) {
    return { visibleMessage: message, cards: [] };
  }

  const cards: ResumeCardPayload[] = [];
  const content: IContent[] = [];

  message.content.forEach((item) => {
    if (item?.type === AgentScopeRuntimeContentType.DATA) {
      const data = (item as any).data;
      if (isResumeCardPayload(data)) {
        cards.push(normalizeResumeCardPayload(data));
        return;
      }
    }

    if ((item as { type?: string })?.type === "resume_card" && isResumeCardPayload(item)) {
      cards.push(normalizeResumeCardPayload(item as ResumeCardPayload));
      return;
    }

    if ((item as { type?: string; text?: string }).type === "text") {
      const textItem = item as { type: string; text?: string };
      const parsed = parseResumeCardsFromText(textItem.text);
      if (parsed.cards.length > 0) {
        cards.push(...parsed.cards);
        if (!parsed.remainingText) {
          return;
        }
        content.push({ ...(item as IContent), text: parsed.remainingText } as IContent);
        return;
      }
    }

    content.push(item);
  });

  return {
    visibleMessage: content.length > 0 ? { ...message, content } : null,
    cards,
  };
}

export default function ResumeResponseCard(props: ResumeResponseCardProps) {
  const avatar = useChatAnywhereOptions((value) => value.welcome?.avatar);
  const nick = useChatAnywhereOptions((value) => value.welcome?.nick);

  const messages = useMemo(() => {
    return AgentScopeRuntimeResponseBuilder.mergeToolMessages(props.data.output);
  }, [props.data.output]);

  if (
    !messages?.length &&
    AgentScopeRuntimeResponseBuilder.maybeGenerating(props.data)
  ) {
    return <Bubble.Spin />;
  }

  return (
    <>
      {avatar ? (
        <Flex align="center" gap={8}>
          <Avatar src={avatar} />
          {nick ? <span>{nick as string}</span> : null}
        </Flex>
      ) : null}

      {messages.map((item) => {
        switch (item.type) {
          case AgentScopeRuntimeMessageType.MESSAGE: {
            const { visibleMessage, cards } = splitResumeCards(item);
            return (
              <div key={item.id}>
                {visibleMessage ? <Message data={visibleMessage} /> : null}
                {cards.length > 0 ? (
                  <div className={styles.resumeCardList}>
                    {cards.map((card, index) => (
                      <ResumeCandidateCard
                        key={
                          card.candidate_id ||
                          card.resume_detail_url ||
                          `${item.id}-${index}`
                        }
                        card={card}
                        index={index}
                      />
                    ))}
                  </div>
                ) : null}
              </div>
            );
          }
          case AgentScopeRuntimeMessageType.PLUGIN_CALL:
          case AgentScopeRuntimeMessageType.PLUGIN_CALL_OUTPUT:
          case AgentScopeRuntimeMessageType.MCP_CALL:
          case AgentScopeRuntimeMessageType.MCP_CALL_OUTPUT:
            return <Tool key={item.id} data={item} />;
          case AgentScopeRuntimeMessageType.MCP_APPROVAL_REQUEST:
            return <Tool key={item.id} data={item} isApproval={true} />;
          case AgentScopeRuntimeMessageType.REASONING:
            return <Reasoning key={item.id} data={item} />;
          case AgentScopeRuntimeMessageType.ERROR:
            return <Error key={item.id} data={item} />;
          case AgentScopeRuntimeMessageType.HEARTBEAT:
            return null;
          default:
            console.warn(`[WIP] Unknown message type: ${item.type}`);
            return null;
        }
      })}

      {props.data.error ? <Error data={props.data.error} /> : null}
      <Actions {...props} />
    </>
  );
}
