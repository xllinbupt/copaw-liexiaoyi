import React, { useEffect, useMemo, useState } from "react";
import {
  Button,
  Empty,
  Input,
  InputRef,
  Spin,
  Tooltip,
} from "antd";
import {
  FolderOpenOutlined,
  FolderOutlined,
  MessageOutlined,
  PlusOutlined,
  SearchOutlined,
  DownOutlined,
  RightOutlined,
  EditOutlined,
  DeleteOutlined,
} from "@ant-design/icons";
import { useTranslation } from "react-i18next";
import type { ChatSpec, JobSpec } from "../../../../api/types";
import {
  ChatJobContext,
  ChatJobGroup,
  buildChatWorkspaceGroups,
  formatChatTime,
} from "../../chatWorkspace";
import styles from "./index.module.less";

interface ChatWorkspaceSidebarProps {
  chats: ChatSpec[];
  jobs: JobSpec[];
  currentChatId?: string;
  loading?: boolean;
  onSelectChat: (chatId: string) => void;
  onCreateChat: (job?: ChatJobContext | null) => void;
  onRenameChat: (chat: ChatSpec, nextName: string) => Promise<void> | void;
  onDeleteChat: (chat: ChatSpec) => Promise<void> | void;
}

function normalizeText(value: string): string {
  return value.trim().toLowerCase();
}

function ChatRow({
  chat,
  active,
  editing,
  draftName,
  onClick,
  onStartEdit,
  onDraftChange,
  onSubmitEdit,
  onDelete,
}: {
  chat: ChatSpec;
  active: boolean;
  editing: boolean;
  draftName: string;
  onClick: () => void;
  onStartEdit: () => void;
  onDraftChange: (value: string) => void;
  onSubmitEdit: () => void;
  onDelete: () => void;
}) {
  const inputRef = React.useRef<InputRef>(null);

  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  return (
    <div
      className={[styles.chatRow, active ? styles.chatRowActive : ""]
        .filter(Boolean)
        .join(" ")}
      onClick={editing ? undefined : onClick}
    >
      <div className={styles.chatMain}>
        {editing ? (
          <Input
            ref={inputRef}
            value={draftName}
            size="small"
            onChange={(event) => onDraftChange(event.target.value)}
            onPressEnter={onSubmitEdit}
            onBlur={onSubmitEdit}
            onClick={(event) => event.stopPropagation()}
          />
        ) : (
          <div className={styles.chatSummary}>
            <div className={styles.chatName}>{chat.name || "New Chat"}</div>
            <div className={styles.chatTrailing}>
              <div className={styles.chatMeta}>
                {formatChatTime(chat.updated_at || chat.created_at)}
              </div>
              <div className={styles.chatActions}>
                <Tooltip title="重命名" mouseEnterDelay={0.5}>
                  <Button
                    type="text"
                    size="small"
                    icon={<EditOutlined />}
                    onClick={(event) => {
                      event.stopPropagation();
                      onStartEdit();
                    }}
                  />
                </Tooltip>
                <Tooltip title="删除" mouseEnterDelay={0.5}>
                  <Button
                    type="text"
                    size="small"
                    danger
                    icon={<DeleteOutlined />}
                    onClick={(event) => {
                      event.stopPropagation();
                      onDelete();
                    }}
                  />
                </Tooltip>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function JobGroupSection({
  group,
  collapsed,
  currentChatId,
  editingChatId,
  draftName,
  onToggle,
  onCreateChat,
  onSelectChat,
  onStartEdit,
  onDraftChange,
  onSubmitEdit,
  onDeleteChat,
}: {
  group: ChatJobGroup;
  collapsed: boolean;
  currentChatId?: string;
  editingChatId: string | null;
  draftName: string;
  onToggle: () => void;
  onCreateChat: (job: ChatJobContext) => void;
  onSelectChat: (chatId: string) => void;
  onStartEdit: (chat: ChatSpec) => void;
  onDraftChange: (value: string) => void;
  onSubmitEdit: () => void;
  onDeleteChat: (chat: ChatSpec) => void;
}) {
  return (
    <section className={styles.section}>
      <button className={styles.sectionHeader} type="button" onClick={onToggle}>
        <div className={styles.sectionHeaderMain}>
          <span className={styles.sectionFoldIcon}>
            {collapsed ? <RightOutlined /> : <DownOutlined />}
          </span>
          <span className={styles.sectionFolderIcon}>
            {collapsed ? <FolderOutlined /> : <FolderOpenOutlined />}
          </span>
          <span className={styles.sectionTitle}>{group.jobName}</span>
        </div>
        <div className={styles.sectionHeaderMeta}>
          {group.pendingFeedbackCount > 0 ? (
            <span className={styles.pendingTag}>
              待反馈 {group.pendingFeedbackCount}
            </span>
          ) : null}
          <Tooltip title="在该职位下新建 Chat" mouseEnterDelay={0.5}>
            <Button
              type="text"
              size="small"
              icon={<PlusOutlined />}
              onClick={(event) => {
                event.stopPropagation();
                onCreateChat(group);
              }}
            />
          </Tooltip>
        </div>
      </button>

      {!collapsed ? (
        <div className={styles.sectionBody}>
          {group.chats.map((chat) => (
            <ChatRow
              key={chat.id}
              chat={chat}
              active={chat.id === currentChatId}
              editing={editingChatId === chat.id}
              draftName={editingChatId === chat.id ? draftName : ""}
              onClick={() => onSelectChat(chat.id)}
              onStartEdit={() => onStartEdit(chat)}
              onDraftChange={onDraftChange}
              onSubmitEdit={onSubmitEdit}
              onDelete={() => onDeleteChat(chat)}
            />
          ))}
        </div>
      ) : null}
    </section>
  );
}

const ChatWorkspaceSidebar: React.FC<ChatWorkspaceSidebarProps> = ({
  chats,
  jobs,
  currentChatId,
  loading = false,
  onSelectChat,
  onCreateChat,
  onRenameChat,
  onDeleteChat,
}) => {
  const { t } = useTranslation();
  const [query, setQuery] = useState("");
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>(
    {},
  );
  const [editingChatId, setEditingChatId] = useState<string | null>(null);
  const [draftName, setDraftName] = useState("");

  const grouped = useMemo(
    () => buildChatWorkspaceGroups(chats, jobs),
    [chats, jobs],
  );

  useEffect(() => {
    setCollapsedGroups((previous) => {
      const next = { ...previous };
      grouped.jobGroups.forEach((group) => {
        if (!(group.key in next)) next[group.key] = false;
      });
      return next;
    });
  }, [grouped.jobGroups]);

  const normalizedQuery = normalizeText(query);

  const filteredJobGroups = useMemo(() => {
    if (!normalizedQuery) return grouped.jobGroups;

    return grouped.jobGroups
      .map((group) => {
        const groupMatches = normalizeText(group.jobName).includes(normalizedQuery);
        const chatsInGroup = groupMatches
          ? group.chats
          : group.chats.filter((chat) =>
              normalizeText(chat.name || "New Chat").includes(normalizedQuery),
            );

        if (!chatsInGroup.length) return null;
        return {
          ...group,
          chats: chatsInGroup,
        };
      })
      .filter(Boolean) as ChatJobGroup[];
  }, [grouped.jobGroups, normalizedQuery]);

  const filteredUnassignedChats = useMemo(() => {
    if (!normalizedQuery) return grouped.unassignedChats;
    return grouped.unassignedChats.filter((chat) =>
      normalizeText(chat.name || "New Chat").includes(normalizedQuery),
    );
  }, [grouped.unassignedChats, normalizedQuery]);

  const hasChats =
    filteredUnassignedChats.length > 0 || filteredJobGroups.length > 0;

  const startEditing = (chat: ChatSpec) => {
    setEditingChatId(chat.id);
    setDraftName(chat.name || "New Chat");
  };

  const submitEditing = async () => {
    if (!editingChatId) return;
    const chat = chats.find((item) => item.id === editingChatId);
    const nextName = draftName.trim();

    if (!chat || !nextName) {
      setEditingChatId(null);
      setDraftName("");
      return;
    }

    try {
      await onRenameChat(chat, nextName);
      setEditingChatId(null);
      setDraftName("");
    } catch {
      // Keep the editor open so the user can adjust the name after a failed save.
    }
  };

  return (
    <aside className={styles.sidebar}>
      <div className={styles.sidebarHeader}>
        <Button
          icon={<PlusOutlined />}
          onClick={() => onCreateChat()}
          className={styles.createChatButton}
        >
          {t("chat.createNewChat")}
        </Button>
      </div>

      <Input
        allowClear
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        prefix={<SearchOutlined />}
        placeholder={t("chat.workspaceSearchPlaceholder")}
        className={styles.searchInput}
      />

      <div className={styles.sidebarBody}>
        {loading ? (
          <div className={styles.loadingState}>
            <Spin />
          </div>
        ) : null}

        {!loading && !hasChats ? (
          <div className={styles.emptyState}>
            <Empty
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              description={t("chat.workspaceEmpty")}
            />
          </div>
        ) : null}

        {!loading && hasChats ? (
          <>
            <section className={styles.section}>
              <div className={styles.sectionHeaderStatic}>
              <div className={styles.sectionHeaderMain}>
                <span className={styles.sectionFolderIcon}>
                  <MessageOutlined />
                </span>
                <span className={styles.sectionTitle}>
                  {t("chat.unassignedSectionTitle")}
                </span>
              </div>
                <Tooltip title="创建未关联 Chat" mouseEnterDelay={0.5}>
                  <Button
                    type="text"
                    size="small"
                    icon={<PlusOutlined />}
                    onClick={() => onCreateChat()}
                  />
                </Tooltip>
              </div>
              <div className={styles.sectionBody}>
                {filteredUnassignedChats.map((chat) => (
                  <ChatRow
                    key={chat.id}
                    chat={chat}
                    active={chat.id === currentChatId}
                    editing={editingChatId === chat.id}
                    draftName={editingChatId === chat.id ? draftName : ""}
                    onClick={() => onSelectChat(chat.id)}
                    onStartEdit={() => startEditing(chat)}
                    onDraftChange={setDraftName}
                    onSubmitEdit={() => void submitEditing()}
                    onDelete={() => {
                      void onDeleteChat(chat);
                    }}
                  />
                ))}
                {filteredUnassignedChats.length === 0 ? (
                  <div className={styles.sectionHint}>
                    {t("chat.unassignedSectionHint")}
                  </div>
                ) : null}
              </div>
            </section>

            {filteredJobGroups.map((group) => (
              <JobGroupSection
                key={group.key}
                group={group}
                collapsed={Boolean(collapsedGroups[group.key])}
                currentChatId={currentChatId}
                editingChatId={editingChatId}
                draftName={draftName}
                onToggle={() =>
                  setCollapsedGroups((previous) => ({
                    ...previous,
                    [group.key]: !previous[group.key],
                  }))
                }
                onCreateChat={(job) => onCreateChat(job)}
                onSelectChat={onSelectChat}
                onStartEdit={startEditing}
                onDraftChange={setDraftName}
                onSubmitEdit={() => void submitEditing()}
                onDeleteChat={(chat) => {
                  void onDeleteChat(chat);
                }}
              />
            ))}
          </>
        ) : null}
      </div>
    </aside>
  );
};

export default ChatWorkspaceSidebar;
