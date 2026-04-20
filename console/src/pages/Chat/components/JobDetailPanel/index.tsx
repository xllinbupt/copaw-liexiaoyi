import {
  CloseOutlined,
  DeleteOutlined,
  LinkOutlined,
  LeftOutlined,
} from "@ant-design/icons";
import { Button, Empty, Modal, Spin, Tabs, Tag, message } from "antd";
import { useEffect, useMemo, useRef, useState } from "react";
import { jobApi } from "../../../../api/modules/job";
import type {
  ExternalJobLinkView,
  JobDeleteResponse,
  JobPipelineView,
  JobSpec,
} from "../../../../api/types";
import { JOB_PIPELINE_UPDATED_EVENT } from "../../chatWorkspace";
import type {
  ChatCandidateDetails,
  ChatDetailPanelView,
  ChatJobDetails,
  JobDetailTabKey,
  JobPipelineUpdatedDetail,
} from "../../chatWorkspace";
import CandidateDetailPanel from "../CandidateDetailPanel";
import JobPipelineBoard from "../JobPipelineBoard";
import styles from "./index.module.less";

const PANEL_WIDTH_STORAGE_KEY = "copaw-chat-job-panel-width";
const DEFAULT_PANEL_WIDTH = 420;
const MIN_PANEL_WIDTH = 320;
const PANEL_MAX_OFFSET = 120;
const CHAT_COLLAPSE_THRESHOLD = 160;
const CHAT_REVEAL_WIDTH = 360;

interface JobDetailPanelProps {
  open: boolean;
  view: ChatDetailPanelView | null;
  canGoBack: boolean;
  onBack: () => void;
  onClose: () => void;
  onJobTabChange: (tab: JobDetailTabKey) => void;
  onOpenJob: (job: ChatJobDetails) => void;
  onOpenCandidate: (candidate: ChatCandidateDetails) => void;
  onCoverChatChange: (covered: boolean) => void;
  onDeleted?: (result: JobDeleteResponse) => void;
}

function getMaxPanelWidth(layoutWidth?: number) {
  if (typeof window === "undefined" && !layoutWidth) {
    return DEFAULT_PANEL_WIDTH;
  }
  const availableWidth = layoutWidth ?? window.innerWidth;
  return Math.max(MIN_PANEL_WIDTH, availableWidth - PANEL_MAX_OFFSET);
}

function clampPanelWidth(width: number, layoutWidth?: number) {
  return Math.min(
    getMaxPanelWidth(layoutWidth),
    Math.max(MIN_PANEL_WIDTH, width),
  );
}

function formatDateTime(raw?: string | null) {
  if (!raw) return "暂未记录";
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return "暂未记录";
  return date.toLocaleString("zh-CN", {
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatPlatformLabel(platform?: string) {
  const normalized = (platform || "").trim().toLowerCase();
  if (!normalized) return "企业版";
  if (normalized === "liepin") return "猎聘企业版";
  return normalized;
}

function resolveExternalJobJumpUrl(link: ExternalJobLinkView) {
  const directUrl = (link.external_job_url || "").trim();
  if (directUrl) return directUrl;

  const snapshot = link.remote_snapshot;
  if (snapshot && typeof snapshot === "object") {
    for (const key of ["urlPc", "ejobPcUrl", "pcUrl", "jobUrl", "url"]) {
      const pcUrl = snapshot[key];
      if (typeof pcUrl === "string" && pcUrl.trim()) {
        return pcUrl.trim();
      }
    }
  }

  const normalizedPlatform = (link.platform || "").trim().toLowerCase();
  if (normalizedPlatform === "liepin") {
    return "https://vip.liepin.com/";
  }

  return "";
}

function openExternalJobLink(url: string) {
  window.open(url, "_blank", "noopener,noreferrer");
}

export default function JobDetailPanel({
  open,
  view,
  canGoBack,
  onBack,
  onClose,
  onJobTabChange,
  onOpenJob,
  onOpenCandidate,
  onCoverChatChange,
  onDeleted,
}: JobDetailPanelProps) {
  const [panelWidth, setPanelWidth] = useState<number>(() => {
    if (typeof window === "undefined") return DEFAULT_PANEL_WIDTH;
    const raw = window.localStorage.getItem(PANEL_WIDTH_STORAGE_KEY);
    const parsed = raw ? Number(raw) : NaN;
    return Number.isFinite(parsed)
      ? clampPanelWidth(parsed)
      : DEFAULT_PANEL_WIDTH;
  });
  const [loading, setLoading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [unlinkingLinkId, setUnlinkingLinkId] = useState<string | null>(null);
  const [jobDetail, setJobDetail] = useState<JobSpec | null>(null);
  const [externalLinks, setExternalLinks] = useState<ExternalJobLinkView[]>([]);
  const [pipelineSnapshot, setPipelineSnapshot] = useState<JobPipelineView | null>(
    null,
  );
  const [pipelineLoaded, setPipelineLoaded] = useState(false);
  const [coverChat, setCoverChat] = useState(false);
  const [layoutWidth, setLayoutWidth] = useState(0);
  const panelRef = useRef<HTMLElement | null>(null);
  const resizeStartXRef = useRef(0);
  const resizeStartWidthRef = useRef(panelWidth);
  const resizeCleanupRef = useRef<(() => void) | null>(null);

  const activeJob = view?.type === "job" ? view.job : null;
  const activeCandidate = view?.type === "candidate" ? view.candidate : null;
  const currentJobTab = view?.type === "job" ? view.tab : undefined;
  const resolvedDefaultJobTab: JobDetailTabKey =
    (pipelineSnapshot?.entries?.length ?? 0) > 0 ? "pipeline" : "detail";
  const isResolvingDefaultJobTab =
    view?.type === "job" &&
    !currentJobTab &&
    Boolean(activeJob?.jobId) &&
    !pipelineLoaded;
  const activeJobTab =
    view?.type === "job" ? currentJobTab ?? resolvedDefaultJobTab : "detail";

  const fetchExternalLinks = async (jobId: string) => {
    try {
      const data = await jobApi.getJobExternalLinks(jobId);
      setExternalLinks(data);
    } catch {
      setExternalLinks([]);
    }
  };

  const handleResizeStart = (clientX: number) => {
    resizeCleanupRef.current?.();
    resizeStartXRef.current = clientX;

    if (coverChat && layoutWidth > 0) {
      const initialWidth = clampPanelWidth(
        layoutWidth - CHAT_REVEAL_WIDTH,
        layoutWidth,
      );
      resizeStartWidthRef.current = initialWidth;
      setPanelWidth(initialWidth);
      setCoverChat(false);
      onCoverChatChange(false);
    } else {
      resizeStartWidthRef.current = panelWidth;
    }

    const previousCursor = document.body.style.cursor;
    const previousUserSelect = document.body.style.userSelect;

    const handleMouseMove = (event: MouseEvent) => {
      const delta = resizeStartXRef.current - event.clientX;
      setPanelWidth(
        clampPanelWidth(resizeStartWidthRef.current + delta, layoutWidth),
      );
    };

    const cleanup = () => {
      document.body.style.cursor = previousCursor;
      document.body.style.userSelect = previousUserSelect;
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
      resizeCleanupRef.current = null;
    };

    const handleMouseUp = () => {
      cleanup();
    };

    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    resizeCleanupRef.current = cleanup;
  };

  useEffect(() => {
    if (!open) {
      setCoverChat(false);
      onCoverChatChange(false);
    }
  }, [open, onCoverChatChange]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(PANEL_WIDTH_STORAGE_KEY, String(panelWidth));
  }, [panelWidth]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const handleResize = () => {
      setPanelWidth((currentWidth) => clampPanelWidth(currentWidth, layoutWidth));
    };

    window.addEventListener("resize", handleResize);
    return () => {
      window.removeEventListener("resize", handleResize);
    };
  }, [layoutWidth]);

  useEffect(() => {
    const panelElement = panelRef.current;
    const layoutElement = panelElement?.parentElement;
    if (!layoutElement) return;

    const syncLayoutWidth = () => {
      const nextWidth = layoutElement.clientWidth;
      setLayoutWidth(nextWidth);
      setPanelWidth((currentWidth) => clampPanelWidth(currentWidth, nextWidth));
    };

    syncLayoutWidth();

    const observer = new ResizeObserver(syncLayoutWidth);
    observer.observe(layoutElement);
    return () => {
      observer.disconnect();
    };
  }, [open]);

  useEffect(() => {
    if (!open || !activeJob?.jobId) {
      setLoading(false);
      setJobDetail(null);
      return;
    }

    let cancelled = false;
    setLoading(true);

    jobApi
      .getJob(activeJob.jobId)
      .then((data) => {
        if (!cancelled) {
          setJobDetail(data);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setJobDetail(null);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [activeJob?.jobId, open]);

  useEffect(() => {
    const jobId = activeJob?.jobId;
    if (!open || !jobId) {
      setExternalLinks([]);
      return;
    }

    let cancelled = false;

    fetchExternalLinks(jobId).catch(() => {
      if (!cancelled) {
        setExternalLinks([]);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [activeJob?.jobId, open]);

  useEffect(() => {
    const jobId = activeJob?.jobId;
    if (!open || !jobId) {
      setPipelineSnapshot(null);
      setPipelineLoaded(false);
      return;
    }

    let cancelled = false;
    setPipelineLoaded(false);

    const fetchPipelineSnapshot = async () => {
      try {
        const data = await jobApi.getJobPipeline(jobId);
        if (!cancelled) {
          setPipelineSnapshot(data);
          setPipelineLoaded(true);
        }
      } catch {
        if (!cancelled) {
          setPipelineSnapshot(null);
          setPipelineLoaded(true);
        }
      }
    };

    void fetchPipelineSnapshot();

    const handlePipelineUpdated = (event: Event) => {
      const customEvent = event as CustomEvent<JobPipelineUpdatedDetail>;
      if (customEvent.detail?.jobId !== jobId) return;
      void fetchPipelineSnapshot();
    };

    window.addEventListener(
      JOB_PIPELINE_UPDATED_EVENT,
      handlePipelineUpdated as EventListener,
    );

    return () => {
      cancelled = true;
      window.removeEventListener(
        JOB_PIPELINE_UPDATED_EVENT,
        handlePipelineUpdated as EventListener,
      );
    };
  }, [activeJob?.jobId, open]);

  useEffect(() => {
    if (
      view?.type !== "job" ||
      currentJobTab ||
      !activeJob?.jobId ||
      !pipelineLoaded
    ) {
      return;
    }
    onJobTabChange(resolvedDefaultJobTab);
  }, [
    activeJob?.jobId,
    onJobTabChange,
    pipelineLoaded,
    resolvedDefaultJobTab,
    currentJobTab,
    view?.type,
  ]);

  useEffect(() => {
    return () => {
      resizeCleanupRef.current?.();
    };
  }, []);

  const jobDetailView = useMemo(() => {
    if (!activeJob) return null;
    return {
      name: jobDetail?.name || activeJob.jobName,
      description: jobDetail?.description || activeJob.description || "",
      requirements: jobDetail?.requirements || activeJob.requirements || "",
      createdAt: jobDetail?.created_at || null,
      updatedAt: jobDetail?.updated_at || null,
    };
  }, [activeJob, jobDetail]);

  const activeExternalLinks = useMemo(
    () => externalLinks.filter((link) => link.status === "active"),
    [externalLinks],
  );

  const headerTitle = useMemo(() => {
    if (view?.type === "candidate") {
      return activeCandidate?.candidateName || "候选人详情";
    }
    return jobDetailView?.name || "未关联职位";
  }, [activeCandidate?.candidateName, jobDetailView?.name, view?.type]);

  const remainingChatWidth =
    layoutWidth > 0 ? Math.max(0, layoutWidth - panelWidth) : 0;
  const effectivePanelWidth =
    coverChat && layoutWidth > 0 ? layoutWidth : panelWidth;

  useEffect(() => {
    if (!open || coverChat || !layoutWidth) return;
    if (remainingChatWidth > CHAT_COLLAPSE_THRESHOLD) return;
    setCoverChat(true);
    onCoverChatChange(true);
  }, [
    coverChat,
    layoutWidth,
    onCoverChatChange,
    open,
    remainingChatWidth,
  ]);

  if (!open) return null;

  const handleDelete = () => {
    if (!activeJob?.jobId) return;

    Modal.confirm({
      title: "确认删除这个职位？",
      content:
        "删除操作会把该职位下所有记录全部清除，包括沟通内容与聊天记录。删除后无法恢复，请谨慎操作。",
      okText: "确认删除",
      cancelText: "取消",
      okButtonProps: { danger: true },
      centered: true,
      onOk: async () => {
        setDeleting(true);
        try {
          const result = await jobApi.deleteJob(activeJob.jobId as string);
          message.success(
            `职位已删除，同时清除了 ${result.deleted_chat_count} 条相关记录`,
          );
          onDeleted?.(result);
        } catch (error) {
          const errorMessage =
            error instanceof Error ? error.message : "删除职位失败";
          message.error(errorMessage);
          throw error;
        } finally {
          setDeleting(false);
        }
      },
    });
  };

  const handleUnlinkExternalLink = (link: ExternalJobLinkView) => {
    if (!activeJob?.jobId) return;

    Modal.confirm({
      title: "确认解除企业版关联？",
      content:
        "解除后，这个 Talora 职位将不再关联当前企业版职位，之后可以重新绑定其他职位。",
      okText: "解除关联",
      cancelText: "取消",
      okButtonProps: { danger: true },
      centered: true,
      onOk: async () => {
        setUnlinkingLinkId(link.id);
        try {
          await jobApi.unlinkJobExternalLink(activeJob.jobId as string, link.id);
          await fetchExternalLinks(activeJob.jobId as string);
          message.success("企业版职位关联已解除");
        } catch (error) {
          const errorMessage =
            error instanceof Error ? error.message : "解除企业版关联失败";
          message.error(errorMessage);
          throw error;
        } finally {
          setUnlinkingLinkId(null);
        }
      },
    });
  };

  return (
    <aside
      ref={panelRef}
      className={styles.panel}
      style={{ width: effectivePanelWidth }}
    >
      <div
        className={`${styles.resizeHandle} ${
          coverChat ? styles.resizeHandleCovered : ""
        }`}
        onMouseDown={(event) => {
          event.preventDefault();
          handleResizeStart(event.clientX);
        }}
        aria-hidden
      />

      <div className={styles.panelInner}>
        <div className={styles.header}>
          <div className={styles.headerLeft}>
            {coverChat ? (
              <Button
                className={styles.revealChatButton}
                icon={<LeftOutlined />}
                onClick={() => {
                  setCoverChat(false);
                  onCoverChatChange(false);
                  if (!layoutWidth) {
                    setPanelWidth(DEFAULT_PANEL_WIDTH);
                    return;
                  }
                  setPanelWidth(
                    clampPanelWidth(
                      layoutWidth - CHAT_REVEAL_WIDTH,
                      layoutWidth,
                    ),
                  );
                }}
              >
                展开聊天
              </Button>
            ) : null}
            {canGoBack ? (
              <Button
                type="text"
                icon={<LeftOutlined />}
                className={styles.backButton}
                onClick={onBack}
              >
                返回
              </Button>
            ) : null}
          </div>
          <div className={styles.headerMain}>
            <div className={styles.headerTitle}>{headerTitle}</div>
          </div>
          <div className={styles.headerActions}>
            {view?.type === "job" && activeJob?.jobId ? (
              <Button
                type="text"
                danger
                icon={<DeleteOutlined />}
                onClick={handleDelete}
                loading={deleting}
              >
                删除职位
              </Button>
            ) : null}
            <Button
              type="text"
              icon={<CloseOutlined />}
              onClick={onClose}
              aria-label="关闭详情"
            />
          </div>
        </div>

        <div className={styles.content}>
          {view?.type === "candidate" && activeCandidate ? (
            <CandidateDetailPanel
              candidate={activeCandidate}
              onOpenJob={onOpenJob}
            />
          ) : !jobDetailView || !activeJob ? (
            <div className={styles.emptyWrap}>
              <Empty description="当前聊天未关联职位" />
            </div>
          ) : loading || isResolvingDefaultJobTab ? (
            <div className={styles.loadingWrap}>
              <Spin />
            </div>
          ) : (
            <Tabs
              className={styles.tabs}
              activeKey={activeJobTab}
              onChange={(key) => {
                onJobTabChange(key as JobDetailTabKey);
              }}
              items={[
                {
                  key: "detail",
                  label: "详情",
                  children: (
                    <div className={styles.tabContent}>
                      <section className={styles.detailSection}>
                        <div className={styles.detailSectionTitle}>企业版关联</div>
                        {activeExternalLinks.length > 0 ? (
                          <div className={styles.externalLinksWrap}>
                            {activeExternalLinks.map((link) => {
                              const platformLabel = formatPlatformLabel(
                                link.platform,
                              );
                              const jumpUrl = resolveExternalJobJumpUrl(link);
                              const jumpLabel =
                                link.external_job_title ||
                                link.external_job_code ||
                                link.external_job_id;
                              return (
                                <div
                                  key={link.id}
                                  className={`${styles.externalLinkCard} ${
                                    jumpUrl ? styles.externalLinkCardClickable : ""
                                  }`}
                                  role={jumpUrl ? "link" : undefined}
                                  tabIndex={jumpUrl ? 0 : undefined}
                                  onClick={
                                    jumpUrl
                                      ? () => {
                                          openExternalJobLink(jumpUrl);
                                        }
                                      : undefined
                                  }
                                  onKeyDown={
                                    jumpUrl
                                      ? (event) => {
                                          if (
                                            event.key === "Enter" ||
                                            event.key === " "
                                          ) {
                                            event.preventDefault();
                                            openExternalJobLink(jumpUrl);
                                          }
                                        }
                                      : undefined
                                  }
                                >
                                  <div className={styles.externalLinkHeader}>
                                    <div className={styles.externalLinkTitle}>
                                      <Tag color="blue">{platformLabel}</Tag>
                                    </div>
                                    <div className={styles.externalLinkActions}>
                                      {jumpUrl ? (
                                        <Button
                                          type="link"
                                          size="small"
                                          icon={<LinkOutlined />}
                                          className={styles.externalLinkButton}
                                          onClick={(event) => {
                                            event.stopPropagation();
                                            openExternalJobLink(jumpUrl);
                                          }}
                                        >
                                          去企业版
                                        </Button>
                                      ) : null}
                                      <Button
                                        type="link"
                                        size="small"
                                        danger
                                        className={styles.externalLinkDangerButton}
                                        loading={unlinkingLinkId === link.id}
                                        onClick={(event) => {
                                          event.stopPropagation();
                                          handleUnlinkExternalLink(link);
                                        }}
                                      >
                                        解除关联
                                      </Button>
                                    </div>
                                  </div>
                                  <div className={styles.externalLinkMeta}>
                                    <div className={styles.externalLinkName}>
                                      {jumpLabel}
                                    </div>
                                    <div className={styles.externalLinkSubmeta}>
                                      {link.account_name
                                        ? `账号：${link.account_name}`
                                        : "账号：未命名"}
                                      {link.external_status
                                        ? ` · 状态：${link.external_status}`
                                        : ""}
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        ) : (
                          <div className={styles.detailHint}>
                            暂未绑定企业版职位
                          </div>
                        )}
                      </section>

                      <section className={styles.detailSection}>
                        <div className={styles.detailSectionTitle}>职位描述</div>
                        <div className={styles.detailText}>
                          {jobDetailView.description || "暂未填写职位描述"}
                        </div>
                      </section>

                      <section className={styles.detailSection}>
                        <div className={styles.detailSectionTitle}>职位要求</div>
                        <div className={styles.detailText}>
                          {jobDetailView.requirements || "暂未填写职位要求"}
                        </div>
                      </section>

                      <section className={styles.detailSection}>
                        <div className={styles.detailSectionTitle}>更新时间</div>
                        <div className={styles.metaList}>
                          <div className={styles.metaRow}>
                            <span className={styles.metaKey}>创建时间</span>
                            <span className={styles.metaValue}>
                              {formatDateTime(jobDetailView.createdAt)}
                            </span>
                          </div>
                          <div className={styles.metaRow}>
                            <span className={styles.metaKey}>最近更新</span>
                            <span className={styles.metaValue}>
                              {formatDateTime(jobDetailView.updatedAt)}
                            </span>
                          </div>
                        </div>
                      </section>
                    </div>
                  ),
                },
                {
                  key: "pipeline",
                  label: "候选人",
                  children: activeJob.jobId ? (
                    <JobPipelineBoard
                      jobId={activeJob.jobId}
                      job={activeJob}
                      onOpenCandidate={onOpenCandidate}
                    />
                  ) : (
                    <div className={styles.placeholderWrap}>
                      <Empty
                        image={Empty.PRESENTED_IMAGE_SIMPLE}
                        description="当前聊天还没有绑定可用职位"
                      />
                    </div>
                  ),
                },
              ]}
            />
          )}
        </div>
      </div>
    </aside>
  );
}
