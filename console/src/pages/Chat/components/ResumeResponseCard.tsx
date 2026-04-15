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
  type JobCardPayload,
  isResumeCardPayload,
  normalizeResumeCardPayload,
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
import { notifyJobPipelineUpdated, openJobDetailPanel } from "../chatWorkspace";
import styles from "./resumeCards.module.less";

type ResumeResponseCardProps = {
  data: IAgentScopeRuntimeResponse;
  isLast?: boolean;
};

type OrderedMessageBlock =
  | {
      type: "message";
      message: IAgentScopeRuntimeMessage;
    }
  | {
      type: "jobCards";
      cards: JobCardPayload[];
    }
  | {
      type: "resumeCards";
      cards: ResumeCardPayload[];
    }
  | {
      type: "pending";
      kind: "job" | "resume";
      count: number;
    };

type TextSegment =
  | {
      type: "text";
      text: string;
    }
  | {
      type: "jobCards";
      cards: JobCardPayload[];
    }
  | {
      type: "resumeCards";
      cards: ResumeCardPayload[];
    }
  | {
      type: "pending";
      kind: "job" | "resume";
    };

function normalizeVisibleText(text: string): string {
  return text.replace(/\n{3,}/g, "\n\n").trim();
}

function applyCardTypeHint(
  value: unknown,
  cardTypeHint?: "job_card" | "resume_card",
): unknown {
  if (!cardTypeHint || !value || typeof value !== "object") {
    return value;
  }

  const payload = value as Record<string, unknown>;
  if (typeof payload.type === "string" || typeof payload.card_type === "string") {
    return value;
  }

  return {
    ...payload,
    type: cardTypeHint,
  };
}

function parseCardSegmentsFromValue(
  value: unknown,
  cardTypeHint?: "job_card" | "resume_card",
): Array<Extract<TextSegment, { type: "jobCards" | "resumeCards" }>> {
  const segments: Array<
    Extract<TextSegment, { type: "jobCards" | "resumeCards" }>
  > = [];

  const appendCardValue = (cardValue: unknown) => {
    const hintedCardValue = applyCardTypeHint(cardValue, cardTypeHint);

    if (isJobCardPayload(hintedCardValue)) {
      const normalized = normalizeJobCardPayload(hintedCardValue);
      const lastSegment = segments[segments.length - 1];
      if (lastSegment?.type === "jobCards") {
        lastSegment.cards.push(normalized);
      } else {
        segments.push({ type: "jobCards", cards: [normalized] });
      }
      return;
    }

    if (isResumeCardPayload(hintedCardValue)) {
      const normalized = normalizeResumeCardPayload(hintedCardValue);
      const lastSegment = segments[segments.length - 1];
      if (lastSegment?.type === "resumeCards") {
        lastSegment.cards.push(normalized);
      } else {
        segments.push({ type: "resumeCards", cards: [normalized] });
      }
    }
  };

  if (Array.isArray(value)) {
    value.forEach(appendCardValue);
    return segments;
  }

  appendCardValue(value);
  return segments;
}

function detectTrailingPendingSegment(text: string): {
  text: string;
  pendingKind: "job" | "resume" | null;
} {
  const jobPending = hidePendingJobCardBlock(text);
  const resumePending = hidePendingResumeCardBlock(text);
  const pendingCandidates = [
    jobPending.pending
      ? {
          kind: "job" as const,
          remainingText: jobPending.remainingText,
        }
      : null,
    resumePending.pending
      ? {
          kind: "resume" as const,
          remainingText: resumePending.remainingText,
        }
      : null,
  ].filter(Boolean) as Array<{
    kind: "job" | "resume";
    remainingText: string;
  }>;

  if (pendingCandidates.length === 0) {
    return {
      text: normalizeVisibleText(text),
      pendingKind: null,
    };
  }

  pendingCandidates.sort(
    (left, right) => left.remainingText.length - right.remainingText.length,
  );
  const selected = pendingCandidates[0];
  return {
    text: normalizeVisibleText(selected.remainingText),
    pendingKind: selected.kind,
  };
}

function parseTextSegments(text: string | undefined): TextSegment[] {
  const sourceText = text || "";
  if (!sourceText) return [];

  const segments: TextSegment[] = [];
  const fencePattern = /```([a-zA-Z0-9_-]+)?[ \t]*\n?([\s\S]*?)```/gi;
  let cursor = 0;
  let matchedCardFence = false;
  let match: RegExpExecArray | null;

  const appendVisibleText = (value: string) => {
    const normalized = normalizeVisibleText(value);
    if (!normalized) return;
    const lastSegment = segments[segments.length - 1];
    if (lastSegment?.type === "text") {
      lastSegment.text = normalizeVisibleText(
        `${lastSegment.text}\n\n${normalized}`,
      );
      return;
    }
    segments.push({ type: "text", text: normalized });
  };

  const appendCardSegments = (
    nextSegments: Array<
      Extract<TextSegment, { type: "jobCards" | "resumeCards" }>
    >,
  ) => {
    nextSegments.forEach((segment) => {
      const lastSegment = segments[segments.length - 1];
      if (segment.type === "jobCards") {
        if (lastSegment?.type === "jobCards") {
          lastSegment.cards.push(...segment.cards);
        } else {
          segments.push(segment);
        }
        return;
      }

      if (lastSegment?.type === "resumeCards") {
        lastSegment.cards.push(...segment.cards);
      } else {
        segments.push(segment);
      }
    });
  };

  while ((match = fencePattern.exec(sourceText)) !== null) {
    const fullMatch = match[0];
    const fenceLanguage = String(match[1] || "")
      .trim()
      .toLowerCase();
    const jsonText = String(match[2] || "").trim();
    const cardTypeHint =
      fenceLanguage === "job_card" || fenceLanguage === "resume_card"
        ? fenceLanguage
        : undefined;
    let parsedSegments: Array<
      Extract<TextSegment, { type: "jobCards" | "resumeCards" }>
    > = [];

    try {
      parsedSegments = parseCardSegmentsFromValue(
        JSON.parse(jsonText),
        cardTypeHint,
      );
    } catch {
      parsedSegments = [];
    }

    if (parsedSegments.length === 0) {
      appendVisibleText(
        sourceText.slice(cursor, match.index + fullMatch.length),
      );
      cursor = match.index + fullMatch.length;
      continue;
    }

    matchedCardFence = true;
    appendVisibleText(sourceText.slice(cursor, match.index));
    appendCardSegments(parsedSegments);
    cursor = match.index + fullMatch.length;
  }

  const trailingText = sourceText.slice(cursor);

  if (!matchedCardFence) {
    try {
      const parsedSegments = parseCardSegmentsFromValue(
        JSON.parse(sourceText.trim()),
      );
      if (parsedSegments.length > 0) {
        appendCardSegments(parsedSegments);
        return segments;
      }
    } catch {
      // ignore invalid raw JSON
    }
  }

  const pendingTail = detectTrailingPendingSegment(trailingText);
  appendVisibleText(pendingTail.text);
  if (pendingTail.pendingKind) {
    segments.push({ type: "pending", kind: pendingTail.pendingKind });
  }

  return segments;
}

function CardLoadingPlaceholder(props: { kind: "job" | "resume" }) {
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

function splitMessageBlocks(
  message: IAgentScopeRuntimeMessage,
): OrderedMessageBlock[] {
  if (!Array.isArray(message.content) || message.content.length === 0) {
    return [{ type: "message", message }];
  }

  const blocks: OrderedMessageBlock[] = [];
  let visibleContent: IContent[] = [];

  const flushVisibleContent = () => {
    if (visibleContent.length === 0) return;
    blocks.push({
      type: "message",
      message: {
        ...message,
        content: visibleContent,
      },
    });
    visibleContent = [];
  };

  const appendBlock = (block: OrderedMessageBlock) => {
    const lastBlock = blocks[blocks.length - 1];

    if (block.type === "jobCards" && lastBlock?.type === "jobCards") {
      lastBlock.cards.push(...block.cards);
      return;
    }

    if (block.type === "resumeCards" && lastBlock?.type === "resumeCards") {
      lastBlock.cards.push(...block.cards);
      return;
    }

    if (
      block.type === "pending" &&
      lastBlock?.type === "pending" &&
      lastBlock.kind === block.kind
    ) {
      lastBlock.count += block.count;
      return;
    }

    blocks.push(block);
  };

  message.content.forEach((item) => {
    if (item?.type === AgentScopeRuntimeContentType.DATA) {
      const data = (item as IContent & { data?: unknown }).data;
      if (isJobCardPayload(data)) {
        flushVisibleContent();
        appendBlock({
          type: "jobCards",
          cards: [normalizeJobCardPayload(data)],
        });
        return;
      }
      if (isResumeCardPayload(data)) {
        flushVisibleContent();
        appendBlock({
          type: "resumeCards",
          cards: [normalizeResumeCardPayload(data)],
        });
        return;
      }
    }

    if (
      (item as { type?: string }).type === "job_card" &&
      isJobCardPayload(item)
    ) {
      flushVisibleContent();
      appendBlock({
        type: "jobCards",
        cards: [normalizeJobCardPayload(item as JobCardPayload)],
      });
      return;
    }

    if (
      (item as { type?: string }).type === "resume_card" &&
      isResumeCardPayload(item)
    ) {
      flushVisibleContent();
      appendBlock({
        type: "resumeCards",
        cards: [normalizeResumeCardPayload(item as ResumeCardPayload)],
      });
      return;
    }

    if ((item as { type?: string; text?: string }).type === "text") {
      const textSegments = parseTextSegments(
        (item as { type: string; text?: string }).text,
      );

      if (textSegments.length === 0) {
        return;
      }

      textSegments.forEach((segment) => {
        if (segment.type === "text") {
          visibleContent.push({
            ...(item as IContent),
            text: segment.text,
          } as IContent);
          return;
        }

        flushVisibleContent();
        if (segment.type === "jobCards") {
          appendBlock(segment);
          return;
        }
        if (segment.type === "resumeCards") {
          appendBlock(segment);
          return;
        }
        appendBlock({
          type: "pending",
          kind: segment.kind,
          count: 1,
        });
      });
      return;
    }

    visibleContent.push(item);
  });

  flushVisibleContent();
  return blocks;
}

function getResumeCardKey(card: ResumeCardPayload, index: number): string {
  return (
    card.candidate_id || card.resume_detail_url || card.detail_url || `${index}`
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
      message.error(errorMessage);
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
  const isGenerating = AgentScopeRuntimeResponseBuilder.maybeGenerating(
    props.data,
  );

  const messages = useMemo(() => {
    return AgentScopeRuntimeResponseBuilder.mergeToolMessages(
      props.data.output,
    );
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
            const blocks = splitMessageBlocks(item);
            return (
              <div key={item.id}>
                {blocks.map((block, blockIndex) => {
                  if (block.type === "message") {
                    return (
                      <Message
                        key={`${item.id}-message-${blockIndex}`}
                        data={block.message}
                      />
                    );
                  }

                  if (block.type === "jobCards") {
                    return (
                      <div
                        key={`${item.id}-job-cards-${blockIndex}`}
                        className={styles.resumeCardList}
                      >
                        {block.cards.map((card, index) => (
                          <JobCard
                            key={
                              card.job_id ||
                              card.id ||
                              `${item.id}-job-${blockIndex}-${index}`
                            }
                            card={card}
                            index={index}
                          />
                        ))}
                      </div>
                    );
                  }

                  if (block.type === "resumeCards") {
                    return (
                      <ResumeCardGroup
                        key={`${item.id}-resume-cards-${blockIndex}`}
                        itemId={`${item.id}-${blockIndex}`}
                        cards={block.cards}
                      />
                    );
                  }

                  if (!isGenerating) {
                    return null;
                  }

                  return (
                    <div
                      key={`${item.id}-${block.kind}-pending-${blockIndex}`}
                      className={styles.resumeCardList}
                    >
                      {Array.from({ length: block.count }).map((_, index) => (
                        <CardLoadingPlaceholder
                          key={`${item.id}-${block.kind}-loading-${blockIndex}-${index}`}
                          kind={block.kind}
                        />
                      ))}
                    </div>
                  );
                })}
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
