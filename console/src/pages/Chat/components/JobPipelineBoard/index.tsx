import {
  useEffect,
  useMemo,
  useState,
  type DragEvent,
  type ThHTMLAttributes,
} from "react";
import {
  Button,
  Empty,
  Segmented,
  Select,
  Spin,
  Table,
  Tag,
  message,
  type TableProps,
} from "antd";
import {
  AppstoreOutlined,
  BarsOutlined,
  ReloadOutlined,
} from "@ant-design/icons";
import { jobApi } from "../../../../api/modules/job";
import type {
  JobPipelineView,
  PipelineEntryView,
  PipelineStageDefinition,
  RecruiterInterest,
} from "../../../../api/types";
import type { ChatCandidateDetails, ChatJobDetails } from "../../chatWorkspace";
import {
  JOB_PIPELINE_UPDATED_EVENT,
  notifyJobPipelineUpdated,
  type JobPipelineUpdatedDetail,
} from "../../chatWorkspace";
import styles from "./index.module.less";

interface JobPipelineBoardProps {
  jobId: string;
  job: ChatJobDetails;
  onOpenCandidate: (candidate: ChatCandidateDetails) => void;
}

type PipelineViewMode = "board" | "table";
type PipelineTableColumnKey =
  | "candidate"
  | "current_stage"
  | "latest_work_experience"
  | "age"
  | "education_experience"
  | "source_type"
  | "recruiter_interest"
  | "candidate_interest"
  | "summary"
  | "latest_activity_at";

type ColumnWidths = Record<PipelineTableColumnKey, number>;

interface ResizableHeaderCellProps
  extends ThHTMLAttributes<HTMLTableCellElement> {
  width?: number;
  minWidth?: number;
  onResize?: (deltaX: number) => void;
}

const DEFAULT_COLUMN_WIDTHS: ColumnWidths = {
  candidate: 180,
  current_stage: 148,
  latest_work_experience: 260,
  age: 96,
  education_experience: 220,
  source_type: 110,
  recruiter_interest: 132,
  candidate_interest: 132,
  summary: 320,
  latest_activity_at: 120,
};

const MIN_COLUMN_WIDTHS: ColumnWidths = {
  candidate: 148,
  current_stage: 132,
  latest_work_experience: 220,
  age: 80,
  education_experience: 180,
  source_type: 96,
  recruiter_interest: 120,
  candidate_interest: 120,
  summary: 240,
  latest_activity_at: 116,
};

const TABLE_WIDTH_STORAGE_KEY = "copaw-job-pipeline-table-widths";

const SOURCE_TYPE_LABELS: Record<string, string> = {
  inbound: "主动投递",
  outbound: "主动搜寻",
  referral: "内推推荐",
  talent_pool: "人才库",
  manual: "手动录入",
};

const RECRUITER_INTEREST_LABELS: Record<string, string> = {
  strong_yes: "很合适",
  yes: "合适",
  unsure: "待评估",
  no: "淘汰",
};

const RECRUITER_INTEREST_OPTIONS = (
  [
    ["strong_yes", "很合适"],
    ["yes", "合适"],
    ["unsure", "待评估"],
    ["no", "淘汰"],
  ] as const
).map(([value, label]) => ({ value, label }));

const CANDIDATE_INTEREST_LABELS: Record<string, string> = {
  yes: "候选人有意向",
  unknown: "意向待确认",
  no: "候选人无意向",
  no_response: "候选人未回复",
};

function ResizableHeaderCell(props: ResizableHeaderCellProps) {
  const { width, minWidth, onResize, children, className, style, ...restProps } =
    props;

  const handleMouseDown = (event: React.MouseEvent<HTMLSpanElement>) => {
    if (!onResize) return;
    event.preventDefault();
    event.stopPropagation();

    const startX = event.clientX;
    const previousCursor = document.body.style.cursor;
    const previousSelect = document.body.style.userSelect;

    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";

    const handleMouseMove = (moveEvent: MouseEvent) => {
      onResize(moveEvent.clientX - startX);
    };

    const handleMouseUp = () => {
      document.body.style.cursor = previousCursor;
      document.body.style.userSelect = previousSelect;
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
  };

  return (
    <th
      {...restProps}
      className={`${className ?? ""} ${styles.resizableHeaderCell}`.trim()}
      style={{
        ...style,
        width,
        minWidth: minWidth ?? width,
      }}
    >
      <div className={styles.resizableHeaderInner}>
        <span>{children}</span>
        {onResize ? (
          <span
            role="presentation"
            className={styles.resizeHandle}
            onMouseDown={handleMouseDown}
          />
        ) : null}
      </div>
    </th>
  );
}

function formatRelativeTime(raw?: string | null): string {
  if (!raw) return "刚刚更新";
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return "刚刚更新";

  const diff = Date.now() - date.getTime();
  const minute = 60 * 1000;
  const hour = 60 * minute;
  const day = 24 * hour;

  if (diff < hour) {
    return `${Math.max(1, Math.floor(diff / minute))} 分钟前更新`;
  }
  if (diff < day) {
    return `${Math.max(1, Math.floor(diff / hour))} 小时前更新`;
  }
  return `${Math.max(1, Math.floor(diff / day))} 天前更新`;
}

function getSummary(entry: PipelineEntryView): string {
  const summary = entry.summary?.trim();
  if (summary) return summary;

  const resumeSummary = entry.candidate.resume_snapshot?.summary;
  if (typeof resumeSummary === "string" && resumeSummary.trim()) {
    return resumeSummary.trim();
  }

  const matchReason = entry.candidate.resume_snapshot?.match_reason;
  if (typeof matchReason === "string" && matchReason.trim()) {
    return matchReason.trim();
  }

  return "还没有补充推荐摘要，可以在推进时继续沉淀。";
}

function getAgeLabel(value: PipelineEntryView["candidate"]["age"]): string {
  if (value === null || value === undefined || value === "") return "";
  const normalized = String(value).trim();
  if (!normalized) return "";
  return normalized.endsWith("岁") ? normalized : `${normalized}岁`;
}

function getGenderLabel(
  value: PipelineEntryView["candidate"]["gender"],
): string {
  if (!value) return "";
  const normalized = String(value).trim();
  if (!normalized) return "";
  if (normalized === "male") return "男";
  if (normalized === "female") return "女";
  return normalized;
}

function getEducationText(entry: PipelineEntryView): string {
  return (
    entry.candidate.education_experience?.trim() ||
    entry.candidate.education?.trim() ||
    ""
  );
}

function getLatestWorkText(entry: PipelineEntryView): string {
  return (
    entry.candidate.latest_work_experience?.trim() ||
    [entry.candidate.current_company, entry.candidate.current_title]
      .filter(Boolean)
      .join(" | ")
  );
}

function buildColumnEntries(
  entries: PipelineEntryView[],
  stageId: string,
): PipelineEntryView[] {
  return entries.filter((entry) => entry.current_stage_id === stageId);
}

export default function JobPipelineBoard(props: JobPipelineBoardProps) {
  const [loading, setLoading] = useState(true);
  const [board, setBoard] = useState<JobPipelineView | null>(null);
  const [updatingEntryId, setUpdatingEntryId] = useState<string | null>(null);
  const [updatingAssessmentEntryId, setUpdatingAssessmentEntryId] =
    useState<string | null>(null);
  const [draggingEntryId, setDraggingEntryId] = useState<string | null>(null);
  const [dragOverStageId, setDragOverStageId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<PipelineViewMode>("board");
  const [columnWidths, setColumnWidths] =
    useState<ColumnWidths>(DEFAULT_COLUMN_WIDTHS);

  const openCandidateDetail = (entry: PipelineEntryView) => {
    props.onOpenCandidate({
      candidateId: entry.candidate.id,
      candidateName: entry.candidate.name,
      job: props.job,
    });
  };

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem(TABLE_WIDTH_STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as Partial<ColumnWidths>;
      setColumnWidths({
        ...DEFAULT_COLUMN_WIDTHS,
        ...parsed,
      });
    } catch {
      setColumnWidths(DEFAULT_COLUMN_WIDTHS);
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(
      TABLE_WIDTH_STORAGE_KEY,
      JSON.stringify(columnWidths),
    );
  }, [columnWidths]);

  useEffect(() => {
    let cancelled = false;

    const fetchBoard = async () => {
      setLoading(true);
      try {
        const data = await jobApi.getJobPipeline(props.jobId);
        if (!cancelled) {
          setBoard(data);
        }
      } catch (error) {
        if (!cancelled) {
          setBoard(null);
          message.error(
            error instanceof Error ? error.message : "加载 Pipeline 失败",
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void fetchBoard();

    const handlePipelineUpdated = (event: Event) => {
      const customEvent = event as CustomEvent<JobPipelineUpdatedDetail>;
      if (customEvent.detail?.jobId !== props.jobId) return;
      void fetchBoard();
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
  }, [props.jobId]);

  const stages = board?.stages ?? [];
  const entries = board?.entries ?? [];
  const countsByStage = useMemo(
    () =>
      new Map(
        stages.map((stage) => [
          stage.id,
          buildColumnEntries(entries, stage.id).length,
        ]),
      ),
    [entries, stages],
  );

  const summaryText = useMemo(() => {
    if (!entries.length) {
      return "还没有候选人进入这个职位的 Pipeline。";
    }
    const stageBits = stages
      .map((stage) => `${stage.name} ${countsByStage.get(stage.id) ?? 0}`)
      .join(" · ");
    return `共 ${entries.length} 位候选人，${stageBits}`;
  }, [countsByStage, entries.length, stages]);

  const tableColumns = useMemo<
    NonNullable<TableProps<PipelineEntryView>["columns"]>
  >(
    () => [
      {
        title: "候选人",
        dataIndex: "candidate",
        key: "candidate",
        width: columnWidths.candidate,
        onHeaderCell: () => ({
          width: columnWidths.candidate,
          minWidth: MIN_COLUMN_WIDTHS.candidate,
          onResize: (deltaX: number) => {
            setColumnWidths((current) => ({
              ...current,
              candidate: Math.max(
                MIN_COLUMN_WIDTHS.candidate,
                columnWidths.candidate + deltaX,
              ),
            }));
          },
        }),
        render: (_, entry) => (
          <div className={styles.tableCandidate}>
            <button
              type="button"
              className={styles.candidateTrigger}
              onClick={() => openCandidateDetail(entry)}
            >
              {entry.candidate.name}
            </button>
          </div>
        ),
      },
      {
        title: "当前节点",
        dataIndex: "current_stage",
        key: "current_stage",
        width: columnWidths.current_stage,
        onHeaderCell: () => ({
          width: columnWidths.current_stage,
          minWidth: MIN_COLUMN_WIDTHS.current_stage,
          onResize: (deltaX: number) => {
            setColumnWidths((current) => ({
              ...current,
              current_stage: Math.max(
                MIN_COLUMN_WIDTHS.current_stage,
                columnWidths.current_stage + deltaX,
              ),
            }));
          },
        }),
        render: (_, entry) => (
          <Select
            size="small"
            className={styles.entryStageSelect}
            value={entry.current_stage_id}
            loading={updatingEntryId === entry.id}
            onChange={(value) => {
              void handleStageChange(entry, value);
            }}
            options={stages.map((item: PipelineStageDefinition) => ({
              label: item.name,
              value: item.id,
            }))}
          />
        ),
      },
      {
        title: "最新工作经历",
        dataIndex: "latest_work_experience",
        key: "latest_work_experience",
        width: columnWidths.latest_work_experience,
        onHeaderCell: () => ({
          width: columnWidths.latest_work_experience,
          minWidth: MIN_COLUMN_WIDTHS.latest_work_experience,
          onResize: (deltaX: number) => {
            setColumnWidths((current) => ({
              ...current,
              latest_work_experience: Math.max(
                MIN_COLUMN_WIDTHS.latest_work_experience,
                columnWidths.latest_work_experience + deltaX,
              ),
            }));
          },
        }),
        render: (_, entry) => (
          <div className={styles.tableSummary}>
            {getLatestWorkText(entry) || "暂无最近工作经历"}
          </div>
        ),
      },
      {
        title: "年龄",
        dataIndex: "age",
        key: "age",
        width: columnWidths.age,
        onHeaderCell: () => ({
          width: columnWidths.age,
          minWidth: MIN_COLUMN_WIDTHS.age,
          onResize: (deltaX: number) => {
            setColumnWidths((current) => ({
              ...current,
              age: Math.max(
                MIN_COLUMN_WIDTHS.age,
                columnWidths.age + deltaX,
              ),
            }));
          },
        }),
        render: (_, entry) => (
          <span className={styles.tableCellMuted}>
            {getAgeLabel(entry.candidate.age) || "-"}
          </span>
        ),
      },
      {
        title: "学校 / 教育",
        dataIndex: "education_experience",
        key: "education_experience",
        width: columnWidths.education_experience,
        onHeaderCell: () => ({
          width: columnWidths.education_experience,
          minWidth: MIN_COLUMN_WIDTHS.education_experience,
          onResize: (deltaX: number) => {
            setColumnWidths((current) => ({
              ...current,
              education_experience: Math.max(
                MIN_COLUMN_WIDTHS.education_experience,
                columnWidths.education_experience + deltaX,
              ),
            }));
          },
        }),
        render: (_, entry) => (
          <div className={styles.tableEducation}>
            <div>{entry.candidate.school || "-"}</div>
            <div className={styles.tableCandidateMeta}>
              {getEducationText(entry) || "暂无教育经历"}
            </div>
          </div>
        ),
      },
      {
        title: "来源",
        dataIndex: "source_type",
        key: "source_type",
        width: columnWidths.source_type,
        onHeaderCell: () => ({
          width: columnWidths.source_type,
          minWidth: MIN_COLUMN_WIDTHS.source_type,
          onResize: (deltaX: number) => {
            setColumnWidths((current) => ({
              ...current,
              source_type: Math.max(
                MIN_COLUMN_WIDTHS.source_type,
                columnWidths.source_type + deltaX,
              ),
            }));
          },
        }),
        render: (value: PipelineEntryView["source_type"]) =>
          SOURCE_TYPE_LABELS[value] || value,
      },
      {
        title: "匹配度",
        dataIndex: "recruiter_interest",
        key: "recruiter_interest",
        width: columnWidths.recruiter_interest,
        onHeaderCell: () => ({
          width: columnWidths.recruiter_interest,
          minWidth: MIN_COLUMN_WIDTHS.recruiter_interest,
          onResize: (deltaX: number) => {
            setColumnWidths((current) => ({
              ...current,
              recruiter_interest: Math.max(
                MIN_COLUMN_WIDTHS.recruiter_interest,
                columnWidths.recruiter_interest + deltaX,
              ),
            }));
          },
        }),
        render: (_, entry) => (
          <Select
            size="small"
            className={styles.entryStageSelect}
            value={entry.recruiter_interest}
            loading={updatingAssessmentEntryId === entry.id}
            onChange={(value) => {
              void handleRecruiterInterestChange(entry, value);
            }}
            options={RECRUITER_INTEREST_OPTIONS}
          />
        ),
      },
      {
        title: "候选人意向",
        dataIndex: "candidate_interest",
        key: "candidate_interest",
        width: columnWidths.candidate_interest,
        onHeaderCell: () => ({
          width: columnWidths.candidate_interest,
          minWidth: MIN_COLUMN_WIDTHS.candidate_interest,
          onResize: (deltaX: number) => {
            setColumnWidths((current) => ({
              ...current,
              candidate_interest: Math.max(
                MIN_COLUMN_WIDTHS.candidate_interest,
                columnWidths.candidate_interest + deltaX,
              ),
            }));
          },
        }),
        render: (value: PipelineEntryView["candidate_interest"]) =>
          CANDIDATE_INTEREST_LABELS[value] || value,
      },
      {
        title: "推荐摘要",
        dataIndex: "summary",
        key: "summary",
        width: columnWidths.summary,
        onHeaderCell: () => ({
          width: columnWidths.summary,
          minWidth: MIN_COLUMN_WIDTHS.summary,
          onResize: (deltaX: number) => {
            setColumnWidths((current) => ({
              ...current,
              summary: Math.max(
                MIN_COLUMN_WIDTHS.summary,
                columnWidths.summary + deltaX,
              ),
            }));
          },
        }),
        render: (_, entry) => (
          <div className={styles.tableSummary}>{getSummary(entry)}</div>
        ),
      },
      {
        title: "最近更新",
        dataIndex: "latest_activity_at",
        key: "latest_activity_at",
        width: columnWidths.latest_activity_at,
        onHeaderCell: () => ({
          width: columnWidths.latest_activity_at,
          minWidth: MIN_COLUMN_WIDTHS.latest_activity_at,
          onResize: (deltaX: number) => {
            setColumnWidths((current) => ({
              ...current,
              latest_activity_at: Math.max(
                MIN_COLUMN_WIDTHS.latest_activity_at,
                columnWidths.latest_activity_at + deltaX,
              ),
            }));
          },
        }),
        render: (_, entry) => (
          <span className={styles.tableCellMuted}>
            {formatRelativeTime(entry.latest_activity_at)}
          </span>
        ),
      },
    ],
    [columnWidths, stages, updatingAssessmentEntryId, updatingEntryId],
  );

  const handleStageChange = async (
    entry: PipelineEntryView,
    nextStageId: string,
  ) => {
    if (!board || nextStageId === entry.current_stage_id) return;

    setUpdatingEntryId(entry.id);
    try {
      const result = await jobApi.updatePipelineEntryStage(
        props.jobId,
        entry.id,
        {
          stage_id: nextStageId,
          actor_type: "user",
        },
      );
      setBoard((currentBoard) => {
        if (!currentBoard) return currentBoard;
        return {
          ...currentBoard,
          entries: currentBoard.entries.map((currentEntry) =>
            currentEntry.id === entry.id ? result.entry : currentEntry,
          ),
        };
      });
      notifyJobPipelineUpdated(props.jobId);
      message.success(
        `已将 ${entry.candidate.name} 移动到 ${result.entry.current_stage.name}`,
      );
    } catch (error) {
      message.error(
        error instanceof Error ? error.message : "更新 Pipeline 阶段失败",
      );
    } finally {
      setUpdatingEntryId(null);
    }
  };

  const handleRecruiterInterestChange = async (
    entry: PipelineEntryView,
    nextInterest: RecruiterInterest,
  ) => {
    if (!board || nextInterest === entry.recruiter_interest) return;

    setUpdatingAssessmentEntryId(entry.id);
    try {
      const result = await jobApi.updatePipelineEntryAssessment(
        props.jobId,
        entry.id,
        {
          recruiter_interest: nextInterest,
          actor_type: "user",
        },
      );
      setBoard((currentBoard) => {
        if (!currentBoard) return currentBoard;
        return {
          ...currentBoard,
          entries: currentBoard.entries.map((currentEntry) =>
            currentEntry.id === entry.id ? result.entry : currentEntry,
          ),
        };
      });
      notifyJobPipelineUpdated(props.jobId);
      message.success(
        `已将 ${entry.candidate.name} 标记为 ${RECRUITER_INTEREST_LABELS[nextInterest]}`,
      );
    } catch (error) {
      message.error(
        error instanceof Error ? error.message : "更新匹配度失败",
      );
    } finally {
      setUpdatingAssessmentEntryId(null);
    }
  };

  const handleEntryDragStart = (
    event: DragEvent<HTMLElement>,
    entry: PipelineEntryView,
  ) => {
    setDraggingEntryId(entry.id);
    setDragOverStageId(entry.current_stage_id);
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", entry.id);
  };

  const handleEntryDragEnd = () => {
    setDraggingEntryId(null);
    setDragOverStageId(null);
  };

  const handleColumnDragOver = (
    event: DragEvent<HTMLElement>,
    stageId: string,
  ) => {
    if (!draggingEntryId) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
    setDragOverStageId(stageId);
  };

  const handleColumnDrop = async (
    event: DragEvent<HTMLElement>,
    stageId: string,
  ) => {
    event.preventDefault();
    const entryId =
      event.dataTransfer.getData("text/plain") || draggingEntryId;
    setDragOverStageId(null);
    setDraggingEntryId(null);
    if (!entryId) return;

    const targetEntry = entries.find((entry) => entry.id === entryId);
    if (!targetEntry || targetEntry.current_stage_id === stageId) {
      return;
    }
    await handleStageChange(targetEntry, stageId);
  };

  if (loading) {
    return (
      <div className={styles.loadingWrap}>
        <Spin />
      </div>
    );
  }

  if (!board) {
    return (
      <div className={styles.emptyWrap}>
        <Empty description="暂时无法加载 Pipeline" />
      </div>
    );
  }

  return (
    <div className={styles.boardWrap}>
      <div className={styles.summaryBar}>
        <div className={styles.summaryText}>{summaryText}</div>
        <div className={styles.summaryActions}>
          <Segmented
            size="small"
            className={styles.viewToggle}
            value={viewMode}
            options={[
              {
                label: (
                  <span className={styles.viewToggleLabel}>
                    <AppstoreOutlined />
                    看板
                  </span>
                ),
                value: "board",
              },
              {
                label: (
                  <span className={styles.viewToggleLabel}>
                    <BarsOutlined />
                    表格
                  </span>
                ),
                value: "table",
              },
            ]}
            onChange={(value) => {
              setViewMode(value as PipelineViewMode);
            }}
          />
          <Button
            type="text"
            size="small"
            icon={<ReloadOutlined />}
            onClick={() => notifyJobPipelineUpdated(props.jobId)}
          >
            刷新
          </Button>
        </div>
      </div>

      {!entries.length ? (
        <div className={styles.emptyWrap}>
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description="先从简历卡片把候选人加入这个职位的 Pipeline"
          />
        </div>
      ) : viewMode === "table" ? (
        <div className={styles.tableWrap}>
          <Table<PipelineEntryView>
            rowKey="id"
            size="small"
            pagination={false}
            components={{
              header: {
                cell: ResizableHeaderCell,
              },
            }}
            columns={tableColumns}
            dataSource={entries}
            scroll={{
              x:
                Object.values(columnWidths).reduce(
                  (total, width) => total + width,
                  0,
                ) + 24,
            }}
          />
        </div>
      ) : (
        <div className={styles.boardScroller}>
          <div className={styles.boardGrid}>
            {stages.map((stage) => {
              const stageEntries = buildColumnEntries(entries, stage.id);
              const isDropActive =
                dragOverStageId === stage.id &&
                !!draggingEntryId &&
                stageEntries.every((entry) => entry.id !== draggingEntryId);
              return (
                <section
                  key={stage.id}
                  className={`${styles.column} ${
                    isDropActive ? styles.columnDropActive : ""
                  }`}
                >
                  <div className={styles.columnHeader}>
                    <div className={styles.columnTitle}>{stage.name}</div>
                    <div className={styles.columnCount}>
                      {countsByStage.get(stage.id) ?? 0}
                    </div>
                  </div>

                  <div
                    className={styles.columnBody}
                    onDragOver={(event) => {
                      handleColumnDragOver(event, stage.id);
                    }}
                    onDrop={(event) => {
                      void handleColumnDrop(event, stage.id);
                    }}
                  >
                    {stageEntries.length === 0 ? (
                      <div className={styles.emptyColumn}>
                        {draggingEntryId
                          ? "拖到这里，移动到这个阶段"
                          : "这个阶段还没有候选人"}
                      </div>
                    ) : (
                      stageEntries.map((entry) => (
                        <article
                          key={entry.id}
                          className={`${styles.entryCard} ${
                            draggingEntryId === entry.id
                              ? styles.entryCardDragging
                              : ""
                          }`}
                          draggable={updatingEntryId !== entry.id}
                          onDragStart={(event) => {
                            handleEntryDragStart(event, entry);
                          }}
                          onDragEnd={handleEntryDragEnd}
                        >
                          <div className={styles.entryHeader}>
                            <div>
                              <div className={styles.entryName}>
                                <button
                                  type="button"
                                  className={styles.candidateTrigger}
                                  onClick={() => openCandidateDetail(entry)}
                                >
                                  {entry.candidate.name}
                                </button>
                              </div>
                              <div className={styles.entryFacts}>
                                {[
                                  getGenderLabel(entry.candidate.gender),
                                  getAgeLabel(entry.candidate.age),
                                  entry.candidate.school,
                                ]
                                  .filter(Boolean)
                                  .join(" · ") || "暂无基础信息"}
                              </div>
                              <div className={styles.entryEducation}>
                                {getEducationText(entry) || "暂无教育经历"}
                              </div>
                              <div className={styles.entryLatestWork}>
                                {getLatestWorkText(entry) || "暂无最近工作经历"}
                              </div>
                            </div>
                            <div className={styles.entryFieldsRow}>
                              <div className={styles.entryField}>
                                <div className={styles.entryFieldLabel}>节点</div>
                                <Select
                                  size="small"
                                  className={styles.entryStageSelect}
                                  value={entry.current_stage_id}
                                  loading={updatingEntryId === entry.id}
                                  onChange={(value) => {
                                    void handleStageChange(entry, value);
                                  }}
                                  options={stages.map((item: PipelineStageDefinition) => ({
                                    label: item.name,
                                    value: item.id,
                                  }))}
                                />
                              </div>
                              <div className={styles.entryField}>
                                <div className={styles.entryFieldLabel}>匹配度</div>
                                <Select
                                  size="small"
                                  className={styles.entryAssessmentSelect}
                                  value={entry.recruiter_interest}
                                  loading={updatingAssessmentEntryId === entry.id}
                                  onChange={(value) => {
                                    void handleRecruiterInterestChange(entry, value);
                                  }}
                                  options={RECRUITER_INTEREST_OPTIONS}
                                />
                              </div>
                            </div>
                          </div>

                          <div className={styles.entryTags}>
                            <Tag>
                              {SOURCE_TYPE_LABELS[entry.source_type] ||
                                entry.source_type}
                            </Tag>
                            <Tag>
                              {CANDIDATE_INTEREST_LABELS[
                                entry.candidate_interest
                              ] || entry.candidate_interest}
                            </Tag>
                          </div>

                          <div className={styles.entrySummary}>
                            {getSummary(entry)}
                          </div>

                          <div className={styles.entryFooter}>
                            <div className={styles.entryFooterLeft}>
                              <div className={styles.entryTime}>
                                {formatRelativeTime(entry.latest_activity_at)}
                              </div>
                            </div>
                          </div>
                        </article>
                      ))
                    )}
                  </div>
                </section>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
