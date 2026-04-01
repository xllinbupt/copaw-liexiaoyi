import { CloseOutlined, LeftOutlined } from "@ant-design/icons";
import { Button, Empty, Spin, Tabs } from "antd";
import { useEffect, useMemo, useRef, useState } from "react";
import { jobApi } from "../../../../api/modules/job";
import type { JobSpec } from "../../../../api/types";
import type { ChatJobDetails } from "../../chatWorkspace";
import styles from "./index.module.less";

const PANEL_WIDTH_STORAGE_KEY = "copaw-chat-job-panel-width";
const DEFAULT_PANEL_WIDTH = 420;
const MIN_PANEL_WIDTH = 320;
const PANEL_MAX_OFFSET = 120;
const CHAT_COLLAPSE_THRESHOLD = 160;
const CHAT_REVEAL_WIDTH = 360;

interface JobDetailPanelProps {
  open: boolean;
  job: ChatJobDetails | null;
  onClose: () => void;
  onCoverChatChange: (covered: boolean) => void;
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

export default function JobDetailPanel({
  open,
  job,
  onClose,
  onCoverChatChange,
}: JobDetailPanelProps) {
  const [panelWidth, setPanelWidth] = useState<number>(() => {
    if (typeof window === "undefined") return DEFAULT_PANEL_WIDTH;
    const raw = window.localStorage.getItem(PANEL_WIDTH_STORAGE_KEY);
    const parsed = raw ? Number(raw) : NaN;
    return Number.isFinite(parsed)
      ? clampPanelWidth(parsed)
      : DEFAULT_PANEL_WIDTH;
  });
  const [isResizing, setIsResizing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [jobDetail, setJobDetail] = useState<JobSpec | null>(null);
  const [coverChat, setCoverChat] = useState(false);
  const [layoutWidth, setLayoutWidth] = useState(0);
  const panelRef = useRef<HTMLElement | null>(null);
  const resizeStartXRef = useRef(0);
  const resizeStartWidthRef = useRef(panelWidth);

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
    if (!open || !job?.jobId) {
      setLoading(false);
      setJobDetail(null);
      return;
    }

    let cancelled = false;
    setLoading(true);

    jobApi
      .getJob(job.jobId)
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
  }, [open, job?.jobId]);

  useEffect(() => {
    if (!isResizing) return;

    const handleMouseMove = (event: MouseEvent) => {
      const delta = resizeStartXRef.current - event.clientX;
      setPanelWidth(
        clampPanelWidth(resizeStartWidthRef.current + delta, layoutWidth),
      );
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);

    return () => {
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isResizing]);

  const detail = useMemo(() => {
    if (!job) return null;
    return {
      name: jobDetail?.name || job.jobName,
      description: jobDetail?.description || job.description || "",
      requirements: jobDetail?.requirements || job.requirements || "",
      createdAt: jobDetail?.created_at || null,
      updatedAt: jobDetail?.updated_at || null,
    };
  }, [job, jobDetail]);

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

  return (
    <aside
      ref={panelRef}
      className={styles.panel}
      style={{ width: effectivePanelWidth }}
    >
      <div
        className={styles.resizeHandle}
        onMouseDown={(event) => {
          resizeStartXRef.current = event.clientX;
          resizeStartWidthRef.current =
            coverChat && layoutWidth > 0 ? layoutWidth : panelWidth;
          if (coverChat) {
            setCoverChat(false);
            onCoverChatChange(false);
          }
          setIsResizing(true);
        }}
        aria-hidden
      />

      <div className={styles.panelInner}>
        <div className={styles.header}>
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
                  clampPanelWidth(layoutWidth - CHAT_REVEAL_WIDTH, layoutWidth),
                );
              }}
            >
              展开聊天
            </Button>
          ) : null}
          <div className={styles.headerMain}>
            <div className={styles.headerEyebrow}>职位详情</div>
            <div className={styles.headerTitle}>{detail?.name || "未关联职位"}</div>
          </div>
          <Button
            type="text"
            icon={<CloseOutlined />}
            onClick={onClose}
            aria-label="关闭职位详情"
          />
        </div>

        {!detail ? (
          <div className={styles.emptyWrap}>
            <Empty description="当前聊天未关联职位" />
          </div>
        ) : (
          <>
            <div className={styles.content}>
              {loading ? (
                <div className={styles.loadingWrap}>
                  <Spin />
                </div>
              ) : (
                <Tabs
                  className={styles.tabs}
                  items={[
                    {
                      key: "detail",
                      label: "详情",
                      children: (
                        <div className={styles.tabContent}>
                          <section className={styles.detailSection}>
                            <div className={styles.detailSectionTitle}>
                              职位描述
                            </div>
                            <div className={styles.detailText}>
                              {detail.description || "暂未填写职位描述"}
                            </div>
                          </section>

                          <section className={styles.detailSection}>
                            <div className={styles.detailSectionTitle}>
                              职位要求
                            </div>
                            <div className={styles.detailText}>
                              {detail.requirements || "暂未填写职位要求"}
                            </div>
                          </section>

                          <section className={styles.detailSection}>
                            <div className={styles.detailSectionTitle}>
                              更新时间
                            </div>
                            <div className={styles.metaList}>
                              <div className={styles.metaRow}>
                                <span className={styles.metaKey}>创建时间</span>
                                <span className={styles.metaValue}>
                                  {formatDateTime(detail.createdAt)}
                                </span>
                              </div>
                              <div className={styles.metaRow}>
                                <span className={styles.metaKey}>最近更新</span>
                                <span className={styles.metaValue}>
                                  {formatDateTime(detail.updatedAt)}
                                </span>
                              </div>
                            </div>
                          </section>
                        </div>
                      ),
                    },
                    {
                      key: "pipeline",
                      label: "Pipeline",
                      children: (
                        <div className={styles.placeholderWrap}>
                          <Empty
                            image={Empty.PRESENTED_IMAGE_SIMPLE}
                            description="Pipeline 面板预留中"
                          />
                        </div>
                      ),
                    },
                  ]}
                />
              )}
            </div>
          </>
        )}
      </div>
    </aside>
  );
}
