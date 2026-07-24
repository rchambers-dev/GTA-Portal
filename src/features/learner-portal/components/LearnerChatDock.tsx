"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ChatComposer } from "./ChatComposer";
import { ChatMessageBody } from "./ChatMessageBody";
import { useLearnerChat } from "./LearnerChatProvider";
import type { ChatChannelType, ChatThread } from "../domain/chat/types";
import styles from "./LearnerChatDock.module.css";

function channelLabel(type: ChatChannelType): string {
  switch (type) {
    case "direct":
      return "Direct";
    case "employer":
      return "Employer";
    case "support":
      return "Support";
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

type PanelView = "list" | "thread" | "contacts";

export function LearnerChatDock() {
  const {
    contacts,
    threads,
    unread,
    markThreadRead,
    sendMessage,
    ensureThreadWithContact,
    getThreadById,
    openDockSignal,
  } = useLearnerChat();

  const [open, setOpen] = useState(false);
  const [view, setView] = useState<PanelView>("list");
  const [activeThreadId, setActiveThreadId] = useState<string | null>(null);

  useEffect(() => {
    if (openDockSignal > 0) {
      setOpen(true);
      if (!activeThreadId && threads[0]) {
        setActiveThreadId(threads[0].threadId);
        setView("thread");
      } else if (activeThreadId) {
        setView("thread");
      }
    }
    // Only react to signal bumps — not thread list churn.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openDockSignal]);

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

  function closePanel() {
    setOpen(false);
  }

  function minimiseToBar() {
    setOpen(false);
  }

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
                      : "Messages"}
                </strong>
                {view === "thread" && activeThread ? (
                  <span className={styles.privacy}>{activeThread.privacyNote}</span>
                ) : null}
              </div>
            </div>
            <div className={styles.panelActions}>
              {view === "list" ? (
                <button
                  type="button"
                  className={styles.textBtn}
                  onClick={() => setView("contacts")}
                >
                  New
                </button>
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
                    onClick={() => openThread(thread.threadId)}
                  >
                    <span className={styles.threadMeta}>
                      <span className={styles.threadTitle}>{thread.title}</span>
                      <span className={styles.threadSub}>
                        {channelLabel(thread.channelType)} · {formatTime(thread.lastMessageAt)}
                      </span>
                    </span>
                    {thread.unreadForLearner > 0 ? (
                      <span className={styles.badge}>{thread.unreadForLearner}</span>
                    ) : null}
                  </button>
                ))
              )}
              <Link href="/learner/messages" className={styles.fullLink} onClick={closePanel}>
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

          {view === "thread" && activeThread ? (
            <div className={styles.threadView}>
              <div className={styles.messages}>
                {activeThread.messages.length === 0 ? (
                  <p className={styles.empty}>No messages yet. Say hello.</p>
                ) : (
                  activeThread.messages.map((m) => {
                    const mine = m.senderId === "contact-alex";
                    return (
                      <div
                        key={m.messageId}
                        className={mine ? styles.bubbleMine : styles.bubbleTheirs}
                      >
                        {!mine ? (
                          <span className={styles.sender}>{m.senderName}</span>
                        ) : null}
                        <ChatMessageBody message={m} mine={mine} />
                        <time className={styles.bubbleTime} dateTime={m.sentAt}>
                          {formatTime(m.sentAt)}
                        </time>
                      </div>
                    );
                  })
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
        aria-controls="learner-chat-panel"
      >
        <span className={styles.barLabel}>Messages</span>
        {unread > 0 ? <span className={styles.badge}>{unread}</span> : null}
      </button>
    </div>
  );
}
