import {
  AgentScopeRuntimeWebUI,
  IAgentScopeRuntimeWebUIOptions,
  type IAgentScopeRuntimeWebUIRef,
} from "@agentscope-ai/chat";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button, Modal, Result, Tooltip, message } from "antd";
import { ExclamationCircleOutlined, SettingOutlined } from "@ant-design/icons";
import { SparkCopyLine, SparkAttachmentLine } from "@agentscope-ai/icons";
import { useTranslation } from "react-i18next";
import { useLocation, useNavigate } from "react-router-dom";
import sessionApi from "./sessionApi";
import defaultConfig, { getDefaultConfig } from "./OptionsPanel/defaultConfig";
import { chatApi } from "../../api/modules/chat";
import { getApiUrl } from "../../api/config";
import { buildAuthHeaders } from "../../api/authHeaders";
import { providerApi } from "../../api/modules/provider";
import type {
  ProviderInfo,
  ModelInfo,
  ChatSpec,
  JobDeleteResponse,
} from "../../api/types";
import ModelSelector from "./ModelSelector";
import { useTheme } from "../../contexts/ThemeContext";
import { useAgentStore } from "../../stores/agentStore";
import { useChatAnywhereInput } from "@agentscope-ai/chat";
import styles from "./index.module.less";
import { IconButton } from "@agentscope-ai/design";
import ChatHeaderTitle from "./components/ChatHeaderTitle";
import ResumeResponseCard from "./components/ResumeResponseCard";
import JobDetailPanel from "./components/JobDetailPanel";
import ChatSessionInitializer from "./components/ChatSessionInitializer";
import {
  CHAT_WORKSPACE_UPDATED_EVENT,
  INSERT_CHAT_REFERENCE_EVENT,
  OPEN_JOB_DETAIL_PANEL_EVENT,
  buildChatPayload,
  type ChatCandidateDetails,
  type ChatDetailPanelView,
  getChatJobDetails,
  type ChatJobContext,
  type ChatJobDetails,
  type InsertChatReferenceDetail,
  type JobDetailTabKey,
  type OpenJobDetailPanelDetail,
  type ChatWorkspaceUpdateDetail,
} from "./chatWorkspace";
import {
  toDisplayUrl,
  copyText,
  extractCopyableText,
  buildModelError,
  normalizeContentUrls,
  extractUserMessageText,
  type CopyableResponse,
  type RuntimeLoadingBridgeApi,
} from "./utils";

const CHAT_ATTACHMENT_MAX_MB = 10;
const JOB_CONTEXT_INJECTED_STORAGE_PREFIX = "copaw_job_context_injected_";

interface SessionInfo {
  session_id?: string;
  user_id?: string;
  channel?: string;
}

interface CustomWindow extends Window {
  currentSessionId?: string;
  currentUserId?: string;
  currentChannel?: string;
}

declare const window: CustomWindow;

interface CommandSuggestion {
  command: string;
  value: string;
  description: string;
}

function renderSuggestionLabel(command: string, description: string) {
  return (
    <div className={styles.suggestionLabel}>
      <span className={styles.suggestionCommand}>{command}</span>
      <span className={styles.suggestionDescription}>{description}</span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DEFAULT_USER_ID = "default";
const DEFAULT_CHANNEL = "console";

// ---------------------------------------------------------------------------
// Custom hooks
// ---------------------------------------------------------------------------

/** Handle IME composition events to prevent premature Enter key submission. */
function useIMEComposition(isChatActive: () => boolean) {
  const isComposingRef = useRef(false);

  useEffect(() => {
    const handleCompositionStart = () => {
      if (!isChatActive()) return;
      isComposingRef.current = true;
    };

    const handleCompositionEnd = () => {
      if (!isChatActive()) return;
      // Use a slightly longer delay for Safari on macOS, which fires keydown
      // after compositionend within the same event loop tick.
      setTimeout(() => {
        isComposingRef.current = false;
      }, 200);
    };

    const suppressImeEnter = (e: KeyboardEvent) => {
      if (!isChatActive()) return;
      const target = e.target as HTMLElement;
      if (target?.tagName === "TEXTAREA" && e.key === "Enter" && !e.shiftKey) {
        // e.isComposing is the standard flag; isComposingRef covers the
        // post-compositionend grace period needed by Safari.
        if (isComposingRef.current || (e as any).isComposing) {
          e.stopPropagation();
          e.stopImmediatePropagation();
          e.preventDefault();
          return false;
        }
      }
    };

    document.addEventListener("compositionstart", handleCompositionStart, true);
    document.addEventListener("compositionend", handleCompositionEnd, true);
    // Listen on both keydown (Safari) and keypress (legacy) in capture phase.
    document.addEventListener("keydown", suppressImeEnter, true);
    document.addEventListener("keypress", suppressImeEnter, true);

    return () => {
      document.removeEventListener(
        "compositionstart",
        handleCompositionStart,
        true,
      );
      document.removeEventListener(
        "compositionend",
        handleCompositionEnd,
        true,
      );
      document.removeEventListener("keydown", suppressImeEnter, true);
      document.removeEventListener("keypress", suppressImeEnter, true);
    };
  }, [isChatActive]);

  return isComposingRef;
}

/** Fetch and track multimodal capabilities for the active model. */
function useMultimodalCapabilities(
  refreshKey: number,
  locationPathname: string,
  isChatActive: () => boolean,
  selectedAgent: string,
) {
  const [multimodalCaps, setMultimodalCaps] = useState<{
    supportsMultimodal: boolean;
    supportsImage: boolean;
    supportsVideo: boolean;
  }>({ supportsMultimodal: false, supportsImage: false, supportsVideo: false });

  const fetchMultimodalCaps = useCallback(async () => {
    try {
      const [providers, activeModels] = await Promise.all([
        providerApi.listProviders(),
        providerApi.getActiveModels({
          scope: "effective",
          agent_id: selectedAgent,
        }),
      ]);
      const activeProviderId = activeModels?.active_llm?.provider_id;
      const activeModelId = activeModels?.active_llm?.model;
      if (!activeProviderId || !activeModelId) {
        setMultimodalCaps({
          supportsMultimodal: false,
          supportsImage: false,
          supportsVideo: false,
        });
        return;
      }
      const provider = (providers as ProviderInfo[]).find(
        (p) => p.id === activeProviderId,
      );
      if (!provider) {
        setMultimodalCaps({
          supportsMultimodal: false,
          supportsImage: false,
          supportsVideo: false,
        });
        return;
      }
      const allModels: ModelInfo[] = [
        ...(provider.models ?? []),
        ...(provider.extra_models ?? []),
      ];
      const model = allModels.find((m) => m.id === activeModelId);
      setMultimodalCaps({
        supportsMultimodal: model?.supports_multimodal ?? false,
        supportsImage: model?.supports_image ?? false,
        supportsVideo: model?.supports_video ?? false,
      });
    } catch {
      setMultimodalCaps({
        supportsMultimodal: false,
        supportsImage: false,
        supportsVideo: false,
      });
    }
  }, [selectedAgent]);

  // Fetch caps on mount and whenever refreshKey changes
  useEffect(() => {
    fetchMultimodalCaps();
  }, [fetchMultimodalCaps, refreshKey]);

  // Also poll caps when navigating back to chat
  useEffect(() => {
    if (isChatActive()) {
      fetchMultimodalCaps();
    }
  }, [locationPathname, fetchMultimodalCaps, isChatActive]);

  // Listen for model-switched event from ModelSelector
  useEffect(() => {
    const handler = () => {
      fetchMultimodalCaps();
    };
    window.addEventListener("model-switched", handler);
    return () => window.removeEventListener("model-switched", handler);
  }, [fetchMultimodalCaps]);

  return multimodalCaps;
}

function RuntimeLoadingBridge({
  bridgeRef,
}: {
  bridgeRef: { current: RuntimeLoadingBridgeApi | null };
}) {
  const { setLoading, getLoading } = useChatAnywhereInput(
    (value) =>
      ({
        setLoading: value.setLoading,
        getLoading: value.getLoading,
      }) as RuntimeLoadingBridgeApi,
  );

  useEffect(() => {
    if (!setLoading || !getLoading) {
      bridgeRef.current = null;
      return;
    }

    bridgeRef.current = {
      setLoading,
      getLoading,
    };

    return () => {
      if (bridgeRef.current?.setLoading === setLoading) {
        bridgeRef.current = null;
      }
    };
  }, [getLoading, setLoading, bridgeRef]);

  return null;
}

export default function ChatPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const { isDark } = useTheme();
  const chatId = useMemo(() => {
    const match = location.pathname.match(/^\/chat\/(.+)$/);
    return match?.[1];
  }, [location.pathname]);
  const [showModelPrompt, setShowModelPrompt] = useState(false);
  const [jobDetailPanelCoversChat, setJobDetailPanelCoversChat] =
    useState(false);
  const [detailPanelStack, setDetailPanelStack] = useState<
    ChatDetailPanelView[]
  >([]);
  const { selectedAgent } = useAgentStore();
  const [refreshKey, setRefreshKey] = useState(0);
  const [chatSpecs, setChatSpecs] = useState<ChatSpec[]>([]);
  const [currentChatHasHistory, setCurrentChatHasHistory] = useState<
    boolean | null
  >(null);
  const runtimeLoadingBridgeRef = useRef<RuntimeLoadingBridgeApi | null>(null);

  const isChatActiveRef = useRef(false);
  isChatActiveRef.current =
    location.pathname === "/" || location.pathname.startsWith("/chat");

  const isChatActive = useCallback(() => isChatActiveRef.current, []);

  // Use custom hooks for better separation of concerns
  const isComposingRef = useIMEComposition(isChatActive);
  const multimodalCaps = useMultimodalCapabilities(
    refreshKey,
    location.pathname,
    isChatActive,
    selectedAgent,
  );

  const lastSessionIdRef = useRef<string | null>(null);
  /** Tracks the stale auto-selected session ID that was skipped on init, so we can suppress its late-arriving onSessionSelected callback. */
  const staleAutoSelectedIdRef = useRef<string | null>(null);
  const chatIdRef = useRef(chatId);
  const navigateRef = useRef(navigate);
  const chatRef = useRef<IAgentScopeRuntimeWebUIRef>(null);
  chatIdRef.current = chatId;
  navigateRef.current = navigate;
  const currentChat = useMemo(
    () => chatSpecs.find((chat) => chat.id === chatId) ?? null,
    [chatSpecs, chatId],
  );
  const currentChatJobDetails = useMemo(
    () => (currentChat ? getChatJobDetails(currentChat) : null),
    [currentChat],
  );
  const activeDetailPanelView = detailPanelStack[detailPanelStack.length - 1] ?? null;
  const jobDetailPanelOpen = detailPanelStack.length > 0;

  const openJobDetailPanel = useCallback((job: ChatJobDetails) => {
    setDetailPanelStack((currentStack) => {
      const nextView: ChatDetailPanelView = { type: "job", job, tab: "pipeline" };
      const currentView = currentStack[currentStack.length - 1];
      if (
        currentView?.type === "job" &&
        currentView.job.jobId &&
        currentView.job.jobId === job.jobId
      ) {
        return [
          ...currentStack.slice(0, -1),
          {
            ...currentView,
            job,
            tab: currentView.tab ?? "pipeline",
          },
        ];
      }
      return [...currentStack, nextView];
    });
  }, []);

  const handleJobDetailTabChange = useCallback((tab: JobDetailTabKey) => {
    setDetailPanelStack((currentStack) => {
      const currentView = currentStack[currentStack.length - 1];
      if (!currentView || currentView.type !== "job" || currentView.tab === tab) {
        return currentStack;
      }
      return [
        ...currentStack.slice(0, -1),
        {
          ...currentView,
          tab,
        },
      ];
    });
  }, []);

  const openCandidateDetailPanel = useCallback(
    (candidate: ChatCandidateDetails) => {
      setDetailPanelStack((currentStack) => {
        const nextView: ChatDetailPanelView = {
          type: "candidate",
          candidate,
        };
        const currentView = currentStack[currentStack.length - 1];
        if (
          currentView?.type === "candidate" &&
          currentView.candidate.candidateId === candidate.candidateId &&
          currentView.candidate.job?.jobId === candidate.job?.jobId
        ) {
          return currentStack;
        }
        return [...currentStack, nextView];
      });
    },
    [],
  );

  const closeJobDetailPanel = useCallback(() => {
    setDetailPanelStack([]);
  }, []);

  const handleDetailPanelBack = useCallback(() => {
    setDetailPanelStack((currentStack) => currentStack.slice(0, -1));
  }, []);

  const insertReferenceIntoComposer = useCallback((text: string) => {
    const textarea = document.querySelector(
      '[class*="chat-anywhere-input"] textarea',
    ) as HTMLTextAreaElement | null;
    if (!textarea) return false;

    const nativeSetter = Object.getOwnPropertyDescriptor(
      HTMLTextAreaElement.prototype,
      "value",
    )?.set;
    const currentValue = textarea.value || "";
    const hasSelection =
      typeof textarea.selectionStart === "number" &&
      typeof textarea.selectionEnd === "number";
    const selectionStart = hasSelection
      ? (textarea.selectionStart ?? currentValue.length)
      : currentValue.length;
    const selectionEnd = hasSelection
      ? (textarea.selectionEnd ?? currentValue.length)
      : currentValue.length;
    const prefix =
      currentValue && !currentValue.endsWith("\n") ? "\n\n" : currentValue ? "\n" : "";
    const nextText = `${prefix}${text.trim()}`;
    const nextValue =
      currentValue.slice(0, selectionStart) +
      nextText +
      currentValue.slice(selectionEnd);

    if (nativeSetter) {
      nativeSetter.call(textarea, nextValue);
    } else {
      textarea.value = nextValue;
    }

    textarea.dispatchEvent(new Event("input", { bubbles: true }));
    const cursor = selectionStart + nextText.length;
    textarea.focus();
    textarea.setSelectionRange(cursor, cursor);
    return true;
  }, []);

  useEffect(() => {
    setDetailPanelStack([]);
  }, [chatId]);

  // Tell sessionApi which session to put first in getSessionList, so the library's
  // useMount auto-selects the correct session without an extra getSession round-trip.
  if (chatId && sessionApi.preferredChatId !== chatId) {
    sessionApi.preferredChatId = chatId;
  }

  // Register session API event callbacks for URL synchronization

  const loadChatSpecs = useCallback(async (options?: { silent?: boolean }) => {
    try {
      const chats = await chatApi.listChats();
      setChatSpecs(chats);
      return chats;
    } catch (error) {
      if (!options?.silent) {
        message.error(error instanceof Error ? error.message : "加载聊天列表失败");
      }
      return [];
    }
  }, [selectedAgent]);

  useEffect(() => {
    void loadChatSpecs();
  }, [loadChatSpecs, location.pathname, selectedAgent]);

  useEffect(() => {
    if (!isChatActiveRef.current) return;

    const intervalId = window.setInterval(() => {
      void loadChatSpecs({ silent: true });
    }, 4000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [loadChatSpecs, location.pathname, selectedAgent]);

  useEffect(() => {
    let cancelled = false;

    if (!currentChat?.id) {
      setCurrentChatHasHistory(null);
      return () => {
        cancelled = true;
      };
    }

    const checkCurrentChatHistory = async () => {
      try {
        const history = await chatApi.getChat(currentChat.id);
        if (!cancelled) {
          setCurrentChatHasHistory((history.messages?.length ?? 0) > 0);
        }
      } catch {
        if (!cancelled) {
          setCurrentChatHasHistory(null);
        }
      }
    };

    void checkCurrentChatHistory();

    return () => {
      cancelled = true;
    };
  }, [currentChat?.id, refreshKey]);

  useEffect(() => {
    const handleWorkspaceUpdated = (
      event: Event,
    ) => {
      const customEvent = event as CustomEvent<ChatWorkspaceUpdateDetail>;
      void loadChatSpecs();
      if (customEvent.detail?.refreshRuntime) {
        setRefreshKey((prev) => prev + 1);
      }
    };

    window.addEventListener(
      CHAT_WORKSPACE_UPDATED_EVENT,
      handleWorkspaceUpdated as EventListener,
    );
    return () => {
      window.removeEventListener(
        CHAT_WORKSPACE_UPDATED_EVENT,
        handleWorkspaceUpdated as EventListener,
      );
    };
  }, [loadChatSpecs]);

  useEffect(() => {
    const handleOpenJobDetail = (event: Event) => {
      const customEvent = event as CustomEvent<OpenJobDetailPanelDetail>;
      const nextJob = customEvent.detail?.job;
      if (!nextJob) return;
      setDetailPanelStack([{ type: "job", job: nextJob, tab: "pipeline" }]);
    };

    window.addEventListener(
      OPEN_JOB_DETAIL_PANEL_EVENT,
      handleOpenJobDetail as EventListener,
    );
    return () => {
      window.removeEventListener(
        OPEN_JOB_DETAIL_PANEL_EVENT,
        handleOpenJobDetail as EventListener,
      );
    };
  }, []);

  useEffect(() => {
    const handleInsertReference = (event: Event) => {
      const customEvent = event as CustomEvent<InsertChatReferenceDetail>;
      const text = customEvent.detail?.text?.trim();
      if (!text) return;
      if (!insertReferenceIntoComposer(text)) {
        message.warning("没有找到当前聊天输入框，请先激活聊天输入区");
      }
    };

    window.addEventListener(
      INSERT_CHAT_REFERENCE_EVENT,
      handleInsertReference as EventListener,
    );
    return () => {
      window.removeEventListener(
        INSERT_CHAT_REFERENCE_EVENT,
        handleInsertReference as EventListener,
      );
    };
  }, [insertReferenceIntoComposer]);

  const refreshRuntimeSessions = useCallback(() => {
    setRefreshKey((prev) => prev + 1);
  }, []);

  const handleJobDeleted = useCallback(
    async (result: JobDeleteResponse) => {
      closeJobDetailPanel();
      setJobDetailPanelCoversChat(false);
      await loadChatSpecs({ silent: true });
      refreshRuntimeSessions();

      if (chatId && result.deleted_chat_ids.includes(chatId)) {
        navigate("/");
      }
    },
    [
      chatId,
      closeJobDetailPanel,
      loadChatSpecs,
      navigate,
      refreshRuntimeSessions,
    ],
  );

  const handleCreateChat = useCallback(
    async (job?: ChatJobContext | null) => {
      try {
        const created = await chatApi.createChat(buildChatPayload(job));
        await loadChatSpecs();
        refreshRuntimeSessions();
        navigate(`/chat/${created.id}`);
      } catch (error) {
        message.error(error instanceof Error ? error.message : "创建聊天失败");
      }
    },
    [loadChatSpecs, navigate, refreshRuntimeSessions],
  );

  useEffect(() => {
    sessionApi.onSessionIdResolved = (realId) => {
      if (!isChatActiveRef.current) return;
      // Update URL when realId is resolved, regardless of current chatId
      // (chatId may be undefined if URL was cleared in onSessionCreated)
      lastSessionIdRef.current = realId;
      navigateRef.current(`/chat/${realId}`, { replace: true });
    };

    sessionApi.onSessionRemoved = (removedId) => {
      if (!isChatActiveRef.current) return;
      // Clear URL when current session is removed
      // Check if removed session matches current session (by realId or sessionId)
      const currentRealId = sessionApi.getRealIdForSession(
        chatIdRef.current || "",
      );
      if (chatIdRef.current === removedId || currentRealId === removedId) {
        lastSessionIdRef.current = null;
        navigateRef.current("/chat", { replace: true });
      }
    };

    sessionApi.onSessionSelected = (
      sessionId: string | null | undefined,
      realId: string | null,
    ) => {
      if (!isChatActiveRef.current) return;
      // Update URL when session is selected and different from current
      const targetId = realId || sessionId;
      if (!targetId) return;

      // If a preferred chatId from the URL exists and no navigation has happened yet,
      // skip the library's initial auto-selection (always first session).
      // ChatSessionInitializer will apply the correct selection afterward.
      if (
        chatIdRef.current &&
        lastSessionIdRef.current === null &&
        targetId !== chatIdRef.current
      ) {
        lastSessionIdRef.current = targetId;
        // Record the stale ID so its delayed getSession callback is also suppressed.
        staleAutoSelectedIdRef.current = targetId;
        return;
      }

      // Suppress the stale getSession callback that arrives after the correct session loads.
      if (
        staleAutoSelectedIdRef.current &&
        staleAutoSelectedIdRef.current === targetId
      ) {
        staleAutoSelectedIdRef.current = null;
        return;
      }

      if (targetId !== lastSessionIdRef.current) {
        lastSessionIdRef.current = targetId;
        navigateRef.current(`/chat/${targetId}`, { replace: true });
      }
    };

    sessionApi.onSessionCreated = () => {
      if (!isChatActiveRef.current) return;
      // Clear URL when creating new session, wait for realId resolution to update
      lastSessionIdRef.current = null;
      navigateRef.current("/chat", { replace: true });
    };

    return () => {
      sessionApi.onSessionIdResolved = null;
      sessionApi.onSessionRemoved = null;
      sessionApi.onSessionSelected = null;
      sessionApi.onSessionCreated = null;
    };
  }, []);

  // Setup multimodal capabilities tracking via custom hook

  // Refresh chat when selectedAgent changes
  const prevSelectedAgentRef = useRef(selectedAgent);
  useEffect(() => {
    // Only refresh if selectedAgent actually changed (not initial mount)
    if (
      prevSelectedAgentRef.current !== selectedAgent &&
      prevSelectedAgentRef.current !== undefined
    ) {
      // Force re-render by updating refresh key
      setRefreshKey((prev) => prev + 1);
    }
    prevSelectedAgentRef.current = selectedAgent;
  }, [selectedAgent]);

  const copyResponse = useCallback(
    async (response: CopyableResponse) => {
      try {
        await copyText(extractCopyableText(response));
        message.success(t("common.copied"));
      } catch {
        message.error(t("common.copyFailed"));
      }
    },
    [t],
  );

  const customFetch = useCallback(
    async (data: {
      input?: Array<Record<string, unknown>>;
      biz_params?: Record<string, unknown>;
      signal?: AbortSignal;
    }): Promise<Response> => {
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
        ...buildAuthHeaders(),
      };

      try {
        const activeModels = await providerApi.getActiveModels({
          scope: "effective",
          agent_id: selectedAgent,
        });
        if (
          !activeModels?.active_llm?.provider_id ||
          !activeModels?.active_llm?.model
        ) {
          setShowModelPrompt(true);
          return buildModelError();
        }
      } catch {
        setShowModelPrompt(true);
        return buildModelError();
      }

      const { input = [], biz_params } = data;
      const session: SessionInfo = input[input.length - 1]?.session || {};
      const lastInput = input.slice(-1);
      const lastMsg = lastInput[0];
      const rewrittenInput =
        lastMsg?.content && Array.isArray(lastMsg.content)
          ? [
              {
                ...lastMsg,
                content: lastMsg.content.map(normalizeContentUrls),
              },
            ]
          : lastInput;
      const shouldInjectJobContext =
        !!currentChat?.id &&
        !!currentChatJobDetails &&
        currentChatHasHistory === false &&
        !sessionStorage.getItem(
          `${JOB_CONTEXT_INJECTED_STORAGE_PREFIX}${currentChat.id}`,
        );
      const initialJobContextInput = shouldInjectJobContext
        ? [
            {
              role: "system",
              type: "message",
              content: [
                {
                  type: "text",
                  text: [
                    "当前 chat 已经绑定职位。以下职位上下文已由 Console chat 元数据确认，请直接作为本轮对话的默认上下文继续推进。",
                    "如果需要校验职位或继续做 Pipeline 操作，请优先使用官方职位 / Pipeline 脚本；不要因为当前工作区下的 `jobs.json` 为空，就判断“当前 chat 未绑定职位”。",
                    `职位 ID：${currentChatJobDetails.jobId || "未提供"}`,
                    `职位名称：${currentChatJobDetails.jobName}`,
                    currentChatJobDetails.description
                      ? `职位描述：${currentChatJobDetails.description}`
                      : "",
                    currentChatJobDetails.requirements
                      ? `职位要求：${currentChatJobDetails.requirements}`
                      : "",
                  ]
                    .filter(Boolean)
                    .join("\n"),
                },
              ],
            },
          ]
        : [];

      const requestBody = {
        input: [...initialJobContextInput, ...rewrittenInput],
        session_id: window.currentSessionId || session?.session_id || "",
        user_id: window.currentUserId || session?.user_id || DEFAULT_USER_ID,
        channel: window.currentChannel || session?.channel || DEFAULT_CHANNEL,
        stream: true,
        ...biz_params,
      };

      if (shouldInjectJobContext) {
        sessionStorage.setItem(
          `${JOB_CONTEXT_INJECTED_STORAGE_PREFIX}${currentChat.id}`,
          "1",
        );
      }

      const backendChatId =
        sessionApi.getRealIdForSession(requestBody.session_id) ??
        chatIdRef.current ??
        requestBody.session_id;
      if (backendChatId) {
        const userText = rewrittenInput
          .filter((m: any) => m.role === "user")
          .map(extractUserMessageText)
          .join("\n")
          .trim();
        if (userText) {
          sessionApi.setLastUserMessage(backendChatId, userText);
        }
      }

      const response = await fetch(getApiUrl("/console/chat"), {
        method: "POST",
        headers,
        body: JSON.stringify(requestBody),
        signal: data.signal,
      });

      return response;
    },
    [currentChat, currentChatHasHistory, currentChatJobDetails, selectedAgent],
  );

  const handleFileUpload = useCallback(
    async (options: {
      file: File;
      onSuccess: (body: { url?: string; thumbUrl?: string }) => void;
      onError?: (e: Error) => void;
      onProgress?: (e: { percent?: number }) => void;
    }) => {
      const { file, onSuccess, onError, onProgress } = options;
      try {
        // Warn when model has no multimodal support
        if (!multimodalCaps.supportsMultimodal) {
          message.warning(t("chat.attachments.multimodalWarning"));
        } else if (
          multimodalCaps.supportsImage &&
          !multimodalCaps.supportsVideo &&
          !file.type.startsWith("image/")
        ) {
          // Warn (not block) when only image is supported
          message.warning(t("chat.attachments.imageOnlyWarning"));
        }
        const sizeMb = file.size / 1024 / 1024;
        const isWithinLimit = sizeMb < CHAT_ATTACHMENT_MAX_MB;

        if (!isWithinLimit) {
          message.error(
            t("chat.attachments.fileSizeExceeded", {
              limit: CHAT_ATTACHMENT_MAX_MB,
              size: sizeMb.toFixed(2),
            }),
          );
          onError?.(new Error(`File size exceeds ${CHAT_ATTACHMENT_MAX_MB}MB`));
          return;
        }

        const res = await chatApi.uploadFile(file);
        onProgress?.({ percent: 100 });
        onSuccess({ url: chatApi.filePreviewUrl(res.url) });
      } catch (e) {
        onError?.(e instanceof Error ? e : new Error(String(e)));
      }
    },
    [multimodalCaps, t],
  );

  const options = useMemo(() => {
    const i18nConfig = getDefaultConfig(t);
    const commandSuggestions: CommandSuggestion[] = [
      {
        command: "/clear",
        value: "clear",
        description: t("chat.commands.clear.description"),
      },
      {
        command: "/compact",
        value: "compact",
        description: t("chat.commands.compact.description"),
      },
      {
        command: "/approve",
        value: "approve",
        description: t("chat.commands.approve.description"),
      },
      {
        command: "/deny",
        value: "deny",
        description: t("chat.commands.deny.description"),
      },
    ];

    const handleBeforeSubmit = async () => {
      if (isComposingRef.current) return false;
      return true;
    };

    return {
      ...i18nConfig,
      theme: {
        ...defaultConfig.theme,
        darkMode: isDark,
        leftHeader: {
          ...defaultConfig.theme.leftHeader,
        },
        rightHeader: (
          <>
            <ChatSessionInitializer />
            <RuntimeLoadingBridge bridgeRef={runtimeLoadingBridgeRef} />
            <ChatHeaderTitle
              currentChat={currentChat}
              onJobClick={() => {
                if (currentChatJobDetails) {
                  setDetailPanelStack([
                    { type: "job", job: currentChatJobDetails, tab: "pipeline" },
                  ]);
                }
              }}
            />
            <span style={{ flex: 1 }} />
            <ModelSelector />
          </>
        ),
      },
      welcome: {
        ...i18nConfig.welcome,
        nick: "猎小侠",
        avatar:
          "https://gw.alicdn.com/imgextra/i2/O1CN01pyXzjQ1EL1PuZMlSd_!!6000000000334-2-tps-288-288.png",
      },
      sender: {
        ...(i18nConfig as any)?.sender,
        beforeSubmit: handleBeforeSubmit,
        allowSpeech: true,
        attachments: {
          trigger: function (props: any) {
            const tooltipKey = multimodalCaps.supportsMultimodal
              ? multimodalCaps.supportsImage && !multimodalCaps.supportsVideo
                ? "chat.attachments.tooltipImageOnly"
                : "chat.attachments.tooltip"
              : "chat.attachments.tooltipNoMultimodal";
            return (
              <Tooltip title={t(tooltipKey, { limit: CHAT_ATTACHMENT_MAX_MB })}>
                <IconButton
                  disabled={props?.disabled}
                  icon={<SparkAttachmentLine />}
                  bordered={false}
                />
              </Tooltip>
            );
          },
          accept: "*/*",
          customRequest: handleFileUpload,
        },
        placeholder: t("chat.inputPlaceholder"),
        suggestions: commandSuggestions.map((item) => ({
          label: renderSuggestionLabel(item.command, item.description),
          value: item.value,
        })),
      },
      session: {
        multiple: true,
        hideBuiltInSessionList: true,
        api: sessionApi,
      },
      cards: {
        AgentScopeRuntimeResponseCard: ResumeResponseCard,
      },
      api: {
        ...defaultConfig.api,
        fetch: customFetch,
        replaceMediaURL: (url: string) => {
          return toDisplayUrl(url);
        },
        cancel(data: { session_id: string }) {
          const chatId =
            sessionApi.getRealIdForSession(data.session_id) ?? data.session_id;
          if (chatId) {
            chatApi.stopChat(chatId).catch((err) => {
              console.error("Failed to stop chat:", err);
            });
          }
        },
        async reconnect(data: { session_id: string; signal?: AbortSignal }) {
          const headers: Record<string, string> = {
            "Content-Type": "application/json",
            ...buildAuthHeaders(),
          };

          return fetch(getApiUrl("/console/chat"), {
            method: "POST",
            headers,
            body: JSON.stringify({
              reconnect: true,
              session_id: window.currentSessionId || data.session_id,
              user_id: window.currentUserId || DEFAULT_USER_ID,
              channel: window.currentChannel || DEFAULT_CHANNEL,
            }),
            signal: data.signal,
          });
        },
      },
      actions: {
        list: [
          {
            icon: (
              <span title={t("common.copy")}>
                <SparkCopyLine />
              </span>
            ),
            onClick: ({ data }: { data: CopyableResponse }) => {
              void copyResponse(data);
            },
          },
        ],
        replace: true,
      },
    } as unknown as IAgentScopeRuntimeWebUIOptions;
  }, [
    currentChat,
    customFetch,
    copyResponse,
    handleCreateChat,
    handleFileUpload,
    t,
    isDark,
    multimodalCaps,
  ]);

  return (
    <div className={styles.chatWorkspaceLayout}>
      <div
        className={`${styles.chatMainPanel} ${
          jobDetailPanelCoversChat ? styles.chatMainPanelCollapsed : ""
        }`}
      >
        <div className={styles.chatMessagesArea}>
          <AgentScopeRuntimeWebUI
            ref={chatRef}
            key={`${refreshKey}:${chatId || "new"}`}
            options={options}
          />
        </div>
      </div>

      <JobDetailPanel
        open={jobDetailPanelOpen}
        view={activeDetailPanelView}
        canGoBack={detailPanelStack.length > 1}
        onBack={handleDetailPanelBack}
        onClose={closeJobDetailPanel}
        onJobTabChange={handleJobDetailTabChange}
        onOpenJob={openJobDetailPanel}
        onOpenCandidate={openCandidateDetailPanel}
        onCoverChatChange={setJobDetailPanelCoversChat}
        onDeleted={handleJobDeleted}
      />

      <Modal
        open={showModelPrompt}
        closable={false}
        footer={null}
        width={480}
        styles={{
          content: isDark
            ? { background: "#1f1f1f", boxShadow: "0 8px 32px rgba(0,0,0,0.5)" }
            : undefined,
        }}
      >
        <Result
          icon={<ExclamationCircleOutlined style={{ color: "#faad14" }} />}
          title={
            <span
              style={{ color: isDark ? "rgba(255,255,255,0.88)" : undefined }}
            >
              {t("modelConfig.promptTitle")}
            </span>
          }
          subTitle={
            <span
              style={{ color: isDark ? "rgba(255,255,255,0.55)" : undefined }}
            >
              {t("modelConfig.promptMessage")}
            </span>
          }
          extra={[
            <Button key="skip" onClick={() => setShowModelPrompt(false)}>
              {t("modelConfig.skipButton")}
            </Button>,
            <Button
              key="configure"
              type="primary"
              icon={<SettingOutlined />}
              onClick={() => {
                setShowModelPrompt(false);
                navigate("/models");
              }}
            >
              {t("modelConfig.configureButton")}
            </Button>,
          ]}
        />
      </Modal>
    </div>
  );
}
