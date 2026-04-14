import { Bubble } from "@agentscope-ai/chat";
import { useEffect, useMemo, useState } from "react";
import { Avatar, Button, Checkbox, Flex, message } from "antd";
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
import { useLocation } from "react-router-dom";
import { jobApi } from "../../../api/modules/job";
import {
  hidePendingJobCardBlock,
  hidePendingResumeCardBlock,
  isJobCardPayload,
  normalizeJobCardPayload,
  parseJobCardsFromText,
  type JobCardPayload,
  isResumeCardPayload,
  normalizeResumeCardPayload,
  parseResumeCardsFromText,
  type ResumeCardPayload,
} from "../utils";
import JobCard from "./JobCard";
import ResumeCandidateCard from "./ResumeCandidateCard";
import {
  buildAddPipelineCandidatePayload,
  formatBatchPipelineResult,
  getCurrentChatForPipeline,
  getJobDetailsOrThrow,
} from "./resumePipeline";
import {
  notifyJobPipelineUpdated,
  openJobDetailPanel,
} from "../chatWorkspace";
import styles from "./resumeCards.module.less";

type ResumeResponseCardProps = {
  data: IAgentScopeRuntimeResponse;
  isLast?: boolean;
};

type SplitMessageResult = {
  visibleMessage: IAgentScopeRuntimeMessage | null;
  jobCards: JobCardPayload[];
  cards: ResumeCardPayload[];
  pendingJobCards: number;
  pendingResumeCards: number;
};

function CardLoadingPlaceholder(props: {
  kind: "job" | "resume";
}) {
  return (
    <div className={styles.cardLoading} aria-hidden>
      <div className={styles.cardLoadingHeader}>
        <span className={styles.cardLoadingLabel}>
          {props.kind === "job" ? "职位卡片生成中" : "简历卡片生成中"}
        </span>
        <span className={styles.cardLoadingChip} />
      </div>
      <div className={styles.cardLoadingTitle} />
      <div className={styles.cardLoadingMeta} />
      <div className={styles.cardLoadingRow} />
      <div className={styles.cardLoadingRowShort} />
    </div>
  );
}

function splitResumeCards(
  message: IAgentScopeRuntimeMessage,
): SplitMessageResult {
  if (!Array.isArray(message.content) || message.content.length === 0) {
    return {
      visibleMessage: message,
      jobCards: [],
      cards: [],
      pendingJobCards: 0,
      pendingResumeCards: 0,
    };
  }

  const jobCards: JobCardPayload[] = [];
  const cards: ResumeCardPayload[] = [];
  const content: IContent[] = [];
  let pendingJobCards = 0;
  let pendingResumeCards = 0;

  message.content.forEach((item) => {
    if (item?.type === AgentScopeRuntimeContentType.DATA) {
      const data = (item as any).data;
      if (isJobCardPayload(data)) {
        jobCards.push(normalizeJobCardPayload(data));
        return;
      }
      if (isResumeCardPayload(data)) {
        cards.push(normalizeResumeCardPayload(data));
        return;
      }
    }

    if ((item as { type?: string })?.type === "job_card" && isJobCardPayload(item)) {
      jobCards.push(normalizeJobCardPayload(item as JobCardPayload));
      return;
    }

    if ((item as { type?: string })?.type === "resume_card" && isResumeCardPayload(item)) {
      cards.push(normalizeResumeCardPayload(item as ResumeCardPayload));
      return;
    }

    if ((item as { type?: string; text?: string }).type === "text") {
      const textItem = item as { type: string; text?: string };
      const parsedJobs = parseJobCardsFromText(textItem.text);
      if (parsedJobs.cards.length > 0) {
        jobCards.push(...parsedJobs.cards);
      }

      const pendingJobs = hidePendingJobCardBlock(parsedJobs.remainingText);
      if (pendingJobs.pending) {
        pendingJobCards += 1;
      }

      const parsedResumes = parseResumeCardsFromText(pendingJobs.remainingText);
      if (parsedResumes.cards.length > 0) {
        cards.push(...parsedResumes.cards);
      }

      const pendingResumes = hidePendingResumeCardBlock(
        parsedResumes.remainingText,
      );
      if (pendingResumes.pending) {
        pendingResumeCards += 1;
      }

      if (
        parsedJobs.cards.length > 0 ||
        parsedResumes.cards.length > 0 ||
        pendingJobs.pending ||
        pendingResumes.pending
      ) {
        if (!pendingResumes.remainingText) {
          return;
        }
        content.push({
          ...(item as IContent),
          text: pendingResumes.remainingText,
        } as IContent);
        return;
      }
    }

    content.push(item);
  });

  return {
    visibleMessage: content.length > 0 ? { ...message, content } : null,
    jobCards,
    cards,
    pendingJobCards,
    pendingResumeCards,
  };
}

function getResumeCardKey(card: ResumeCardPayload, index: number): string {
  return (
    card.candidate_id ||
    card.resume_detail_url ||
    card.detail_url ||
    `${index}`
  );
}

function ResumeCardGroup(props: {
  itemId: string;
  cards: ResumeCardPayload[];
}) {
  const location = useLocation();
  const [selectedKeys, setSelectedKeys] = useState<string[]>([]);
  const [batchAdding, setBatchAdding] = useState(false);
  const cardKeys = useMemo(
    () => props.cards.map((card, index) => getResumeCardKey(card, index)),
    [props.cards],
  );
  const chatId = useMemo(() => {
    const match = location.pathname.match(/^\/chat\/(.+)$/);
    return match?.[1] || "";
  }, [location.pathname]);

  useEffect(() => {
    setSelectedKeys(cardKeys);
  }, [cardKeys]);

  const allSelected =
    cardKeys.length > 0 && selectedKeys.length === cardKeys.length;

  const toggleCard = (key: string, checked: boolean) => {
    setSelectedKeys((prev) => {
      if (checked) {
        return prev.includes(key) ? prev : [...prev, key];
      }
      return prev.filter((item) => item !== key);
    });
  };

  const handleBatchAdd = async () => {
    if (!chatId) {
      message.warning("请先进入一个具体聊天，再把候选人加入 Pipeline");
      return;
    }
    if (selectedKeys.length === 0) {
      message.warning("请先选择至少一位候选人");
      return;
    }

    setBatchAdding(true);
    try {
      const currentChat = await getCurrentChatForPipeline(chatId);
      if (!currentChat) {
        message.warning("没有找到当前聊天，请刷新后重试");
        return;
      }

      const jobDetails = getJobDetailsOrThrow(currentChat);
      const selectedCards = props.cards.filter((card, index) =>
        selectedKeys.includes(getResumeCardKey(card, index)),
      );

      const result = await jobApi.batchAddPipelineCandidates(jobDetails.jobId, {
        requests: selectedCards.map((card) =>
          buildAddPipelineCandidatePayload(card, currentChat),
        ),
      });

      notifyJobPipelineUpdated(jobDetails.jobId);
      openJobDetailPanel(jobDetails);
      message.success(formatBatchPipelineResult(result, jobDetails.jobName));
    } catch (error) {
      const errorMessage =
        error instanceof globalThis.Error
          ? error.message
          : "批量加入 Pipeline 失败";
      message.error(
        errorMessage,
      );
    } finally {
      setBatchAdding(false);
    }
  };

  return (
    <>
      {props.cards.length > 1 ? (
        <div className={styles.resumeBatchToolbar}>
          <div className={styles.resumeBatchSelection}>
            <Checkbox
              checked={allSelected}
              indeterminate={
                selectedKeys.length > 0 && selectedKeys.length < cardKeys.length
              }
              onChange={(event) =>
                setSelectedKeys(event.target.checked ? cardKeys : [])
              }
            >
              全选
            </Checkbox>
            <span className={styles.resumeBatchSummary}>
              已选 {selectedKeys.length} / {cardKeys.length}
            </span>
          </div>
          <Button
            size="small"
            type="primary"
            disabled={selectedKeys.length === 0}
            loading={batchAdding}
            onClick={() => {
              void handleBatchAdd();
            }}
          >
            批量加入 Pipeline
          </Button>
        </div>
      ) : null}
      <div className={styles.resumeCardList}>
        {props.cards.map((card, index) => {
          const key = getResumeCardKey(card, index);
          return (
            <ResumeCandidateCard
              key={key || `${props.itemId}-${index}`}
              card={card}
              index={index}
              selectionControl={
                props.cards.length > 1 ? (
                  <Checkbox
                    checked={selectedKeys.includes(key)}
                    onChange={(event) => toggleCard(key, event.target.checked)}
                  />
                ) : undefined
              }
            />
          );
        })}
      </div>
    </>
  );
}

export default function ResumeResponseCard(props: ResumeResponseCardProps) {
  const avatar = useChatAnywhereOptions((value) => value.welcome?.avatar);
  const nick = useChatAnywhereOptions((value) => value.welcome?.nick);
  const isGenerating = AgentScopeRuntimeResponseBuilder.maybeGenerating(props.data);

  const messages = useMemo(() => {
    return AgentScopeRuntimeResponseBuilder.mergeToolMessages(props.data.output);
  }, [props.data.output]);

  if (!messages?.length && isGenerating) {
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
            const {
              visibleMessage,
              jobCards,
              cards,
              pendingJobCards,
              pendingResumeCards,
            } = splitResumeCards(item);
            return (
              <div key={item.id}>
                {visibleMessage ? <Message data={visibleMessage} /> : null}
                {jobCards.length > 0 ? (
                  <div className={styles.resumeCardList}>
                    {jobCards.map((card, index) => (
                      <JobCard
                        key={card.job_id || card.id || `${item.id}-job-${index}`}
                        card={card}
                        index={index}
                      />
                    ))}
                  </div>
                ) : null}
                {isGenerating && pendingJobCards > 0 ? (
                  <div className={styles.resumeCardList}>
                    {Array.from({ length: pendingJobCards }).map((_, index) => (
                      <CardLoadingPlaceholder
                        key={`${item.id}-job-loading-${index}`}
                        kind="job"
                      />
                    ))}
                  </div>
                ) : null}
                {cards.length > 0 ? (
                  <ResumeCardGroup itemId={item.id} cards={cards} />
                ) : null}
                {isGenerating && pendingResumeCards > 0 ? (
                  <div className={styles.resumeCardList}>
                    {Array.from({ length: pendingResumeCards }).map((_, index) => (
                      <CardLoadingPlaceholder
                        key={`${item.id}-resume-loading-${index}`}
                        kind="resume"
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
