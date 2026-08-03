"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChatComposer } from "./ChatComposer";
import { ChatMessageItem } from "./ChatMessageItem";
import { useApprenticeChat } from "./ApprenticeChatProvider";
import type { ChatChannelType, ChatThread } from "../domain/chat/types";
import styles from "./ApprenticeChatDock.module.css";

function channelLabel(type: ChatChannelType): string {
  switch (type) {
    case "direct":
      return "Direct";
    case "employer":
      return "Employer";
    case "support":
      return "Support";
    case "safeguarding":
      return "Safeguarding";
    case "group":
      return "Group";
  }
}

function formatTime(iso: string): string {
  try {
    return new Date(iso).toLocaleString("en-GB", {
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

type PanelView = "list" | "thread" | "contacts" | "group";

export function ApprenticeChatDock() {
  const {
    selfContactId,
    contacts,
    threads,
    unread,
    markThreadRead,
    sendMessage,
    editMessage,
    deleteMessage,
    ensureThreadWithContact,
    createGroupThread,
    getThreadById,
    openDockSignal,
  } = useApprenticeChat();

  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<PanelView>("list");
  const [activeThreadId, setActiveThreadId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [prevOpenDockSignal, setPrevOpenDockSignal] = useState(openDockSignal);

  if (openDockSignal !== prevOpenDockSignal) {
    setPrevOpenDockSignal(openDockSignal);
    if (openDockSignal > 0) {
      setOpen(true);
      if (!activeThreadId && threads[0]) {
        setActiveThreadId(threads[0].threadId);
        setView("thread");
      } else if (activeThreadId) {
        setView("thread");
      }
    }
  }

  // On the full Messages page the dock is redundant and would overlap the
  // composer, so hide it there (shell also skips mounting it).
  const path = (pathname.split("?")[0] ?? pathname).replace(/\/+$/, "");
  const onMessagesPage = path === "/messages" || path.endsWith("/messages");

  const activeThread: ChatThread | undefined = useMemo(() => {
    if (!activeThreadId) return undefined;
    return (
      getThreadById(activeThreadId) ??
      threads.find((t) => t.threadId === activeThreadId)
    );
  }, [activeThreadId, getThreadById, threads]);

  useEffect(() => {
    if (open && activeThreadId) {
      markThreadRead(activeThreadId);
    }
  }, [open, activeThreadId, markThreadRead]);

  function openThread(threadId: string) {
    setActiveThreadId(threadId);
    setView("thread");
    markThreadRead(threadId);
  }

  function startWithContact(contactId: string) {
    const thread = ensureThreadWithContact(contactId);
    openThread(thread.threadId);
  }

  function toggleSelected(contactId: string) {
    setSelectedIds((prev) =>
      prev.includes(contactId)
        ? prev.filter((id) => id !== contactId)
        : [...prev, contactId],
    );
  }

  function createGroup() {
    if (selectedIds.length === 0) return;
    const thread = createGroupThread(selectedIds);
    setSelectedIds([]);
    openThread(thread.threadId);
  }

  function closePanel() {
    setOpen(false);
  }

  function minimiseToBar() {
    setOpen(false);
  }

  if (onMessagesPage) return null;

  return (
    <div className={styles.dock} data-open={open ? "true" : "false"}>
      {open ? (
        <div className={styles.panel} role="dialog" aria-label="Messages">
          <header className={styles.panelHeader}>
            <div className={styles.panelTitleRow}>
              {view === "thread" ? (
                <button
                  type="button"
                  className={styles.iconBtn}
                  onClick={() => setView("list")}
                  aria-label="Back to conversations"
                >
                  ←
                </button>
              ) : null}
              <div className={styles.panelHeading}>
                <strong>
                  {view === "thread" && activeThread
                    ? activeThread.title
                    : view === "contacts"
                      ? "New message"
                      : view === "group"
                        ? "New group"
                        : "Messages"}
                </strong>
                {view === "thread" && activeThread ? (
                  <span className={styles.privacy}>{activeThread.privacyNote}</span>
                ) : null}
              </div>
            </div>
            <div className={styles.panelActions}>
              {view === "list" ? (
                <>
                  <button
                    type="button"
                    className={styles.textBtn}
                    onClick={() => {
                      setSelectedIds([]);
                      setView("contacts");
                    }}
                  >
                    New
                  </button>
                  <button
                    type="button"
                    className={styles.textBtn}
                    onClick={() => {
                      setSelectedIds([]);
                      setView("group");
                    }}
                  >
                    Group
                  </button>
                </>
              ) : null}
              <button
                type="button"
                className={styles.iconBtn}
                onClick={minimiseToBar}
                aria-label="Minimise messages"
              >
                –
              </button>
              <button
                type="button"
                className={styles.iconBtn}
                onClick={closePanel}
                aria-label="Close messages"
              >
                ×
              </button>
            </div>
          </header>

          {view === "list" ? (
            <div className={styles.list}>
              {threads.length === 0 ? (
                <p className={styles.empty}>No conversations yet. Start one with a contact.</p>
              ) : (
                threads.map((thread) => (
                  <button
                    key={thread.threadId}
                    type="button"
                    className={styles.threadRow}
                    data-active={
                      thread.threadId === activeThreadId ? "true" : "false"
                    }
                    onClick={() => openThread(thread.threadId)}
                  >
                    <span className={styles.threadMeta}>
                      <span className={styles.threadTitle}>{thread.title}</span>
                      <span className={styles.threadSub}>
                        {channelLabel(thread.channelType)} · {formatTime(thread.lastMessageAt)}
                      </span>
                    </span>
                    {thread.unreadForApprentice > 0 ? (
                      <span className={styles.badge}>{thread.unreadForApprentice}</span>
                    ) : null}
                  </button>
                ))
              )}
              <Link href="/apprentice/messages" className={styles.fullLink} onClick={closePanel}>
                Open full Messages page
              </Link>
            </div>
          ) : null}

          {view === "contacts" ? (
            <div className={styles.list}>
              <button
                type="button"
                className={styles.textBtn}
                onClick={() => setView("list")}
              >
                ← Back to conversations
              </button>
              <button
                type="button"
                className={styles.textBtn}
                onClick={() => {
                  setSelectedIds([]);
                  setView("group");
                }}
              >
                Start a group instead →
              </button>
              {contacts.map((contact) => (
                <button
                  key={contact.contactId}
                  type="button"
                  className={styles.threadRow}
                  onClick={() => startWithContact(contact.contactId)}
                >
                  <span className={styles.avatar} aria-hidden>
                    {contact.initials}
                  </span>
                  <span className={styles.threadMeta}>
                    <span className={styles.threadTitle}>{contact.name}</span>
                    <span className={styles.threadSub}>
                      {contact.roleLabel}
                      {contact.organisation ? ` · ${contact.organisation}` : ""}
                    </span>
                  </span>
                </button>
              ))}
            </div>
          ) : null}

          {view === "group" ? (
            <div className={styles.list}>
              <button
                type="button"
                className={styles.textBtn}
                onClick={() => {
                  setSelectedIds([]);
                  setView("list");
                }}
              >
                ← Back to conversations
              </button>
              <p className={styles.empty}>
                Select people to include, then create the group.
              </p>
              {contacts.map((contact) => {
                const checked = selectedIds.includes(contact.contactId);
                return (
                  <button
                    key={contact.contactId}
                    type="button"
                    className={styles.threadRow}
                    data-selected={checked ? "true" : "false"}
                    onClick={() => toggleSelected(contact.contactId)}
                    aria-pressed={checked}
                  >
                    <span className={styles.avatar} aria-hidden>
                      {contact.initials}
                    </span>
                    <span className={styles.threadMeta}>
                      <span className={styles.threadTitle}>{contact.name}</span>
                      <span className={styles.threadSub}>
                        {contact.roleLabel}
                        {contact.organisation
                          ? ` · ${contact.organisation}`
                          : ""}
                      </span>
                    </span>
                    <span className={styles.pickMark} aria-hidden>
                      {checked ? "✓" : ""}
                    </span>
                  </button>
                );
              })}
              <button
                type="button"
                className={styles.createGroupBtn}
                disabled={selectedIds.length === 0}
                onClick={createGroup}
              >
                Create group
                {selectedIds.length ? ` (${selectedIds.length})` : ""}
              </button>
            </div>
          ) : null}

          {view === "thread" && activeThread ? (
            <div className={styles.threadView}>
              <div className={styles.messages}>
                {activeThread.messages.length === 0 ? (
                  <p className={styles.empty}>No messages yet. Say hello.</p>
                ) : (
                  activeThread.messages.map((m) => (
                    <ChatMessageItem
                      key={m.messageId}
                      message={m}
                      mine={m.senderId === selfContactId}
                      compact
                      onEdit={(messageId, body) => {
                        if (!activeThreadId) return;
                        editMessage(activeThreadId, messageId, body);
                      }}
                      onDelete={(messageId) => {
                        if (!activeThreadId) return;
                        deleteMessage(activeThreadId, messageId);
                      }}
                    />
                  ))
                )}
              </div>
              <ChatComposer
                compact
                onSend={(payload) => {
                  if (!activeThreadId) return;
                  sendMessage(activeThreadId, payload);
                }}
              />
            </div>
          ) : null}
        </div>
      ) : null}

      <button
        type="button"
        className={styles.bar}
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls="apprentice-chat-panel"
      >
        <span className={styles.barLabel}>Messages</span>
        {unread > 0 ? <span className={styles.badge}>{unread}</span> : null}
      </button>
    </div>
  );
}
