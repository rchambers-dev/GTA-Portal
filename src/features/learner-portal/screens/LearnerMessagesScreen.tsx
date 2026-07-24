"use client";

import { useEffect, useMemo, useState } from "react";
import { ChatComposer } from "../components/ChatComposer";
import { ChatMessageBody } from "../components/ChatMessageBody";
import { LearnerPageShell } from "../components/LearnerPageShell";
import { useLearnerChat } from "../components/LearnerChatProvider";
import type { ChatChannelType } from "../domain/chat/types";
import styles from "./LearnerMessagesScreen.module.css";

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

function initialsFromTitle(title: string): string {
  const parts = title.split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] ?? ""}${parts[1][0] ?? ""}`.toUpperCase();
}

export function LearnerMessagesScreen() {
  const {
    contacts,
    threads,
    markThreadRead,
    sendMessage,
    ensureThreadWithContact,
    getThreadById,
  } = useLearnerChat();

  const [activeThreadId, setActiveThreadId] = useState<string | null>(
    () => threads[0]?.threadId ?? null,
  );
  const [showContacts, setShowContacts] = useState(false);

  const activeThread = useMemo(() => {
    if (!activeThreadId) return undefined;
    return (
      getThreadById(activeThreadId) ??
      threads.find((t) => t.threadId === activeThreadId)
    );
  }, [activeThreadId, getThreadById, threads]);

  useEffect(() => {
    if (activeThreadId) markThreadRead(activeThreadId);
  }, [activeThreadId, markThreadRead]);

  function openThread(threadId: string) {
    setActiveThreadId(threadId);
    setShowContacts(false);
    markThreadRead(threadId);
  }

  function startWithContact(contactId: string) {
    const thread = ensureThreadWithContact(contactId);
    openThread(thread.threadId);
  }

  return (
    <LearnerPageShell
      title="Messages"
      description="Chat with your mentor, tutor, employer contact, or GTA Support. Each conversation has its own privacy rules."
      fill
      actions={
        <button
          type="button"
          className={styles.primaryBtn}
          onClick={() => setShowContacts((v) => !v)}
        >
          {showContacts ? "Back to chats" : "New message"}
        </button>
      }
    >
      <div className={styles.layout}>
        <aside className={styles.sidebar}>
          <div className={styles.sideHead}>
            <strong>{showContacts ? "New chat" : "Chats"}</strong>
            <span>
              {showContacts
                ? `${contacts.length} people`
                : `${threads.length} conversations`}
            </span>
          </div>
          {showContacts ? (
            <div className={styles.sideList}>
              <p className={styles.sideHint}>People in your programme scope</p>
              {contacts.map((contact) => (
                <button
                  key={contact.contactId}
                  type="button"
                  className={styles.sideRow}
                  onClick={() => startWithContact(contact.contactId)}
                >
                  <span className={styles.avatar} data-tone="navy">
                    {contact.initials}
                  </span>
                  <span className={styles.sideMeta}>
                    <strong>{contact.name}</strong>
                    <span>
                      {contact.roleLabel}
                      {contact.organisation ? ` · ${contact.organisation}` : ""}
                    </span>
                  </span>
                </button>
              ))}
            </div>
          ) : (
            <div className={styles.sideList}>
              {threads.length === 0 ? (
                <p className={styles.empty}>No conversations yet.</p>
              ) : (
                threads.map((thread) => (
                  <button
                    key={thread.threadId}
                    type="button"
                    className={styles.sideRow}
                    data-active={
                      thread.threadId === activeThreadId ? "true" : "false"
                    }
                    onClick={() => openThread(thread.threadId)}
                  >
                    <span
                      className={styles.avatar}
                      data-tone={thread.channelType}
                    >
                      {initialsFromTitle(thread.title)}
                    </span>
                    <span className={styles.sideMeta}>
                      <strong>{thread.title}</strong>
                      <span>
                        {channelLabel(thread.channelType)} ·{" "}
                        {formatTime(thread.lastMessageAt)}
                      </span>
                    </span>
                    {thread.unreadForLearner > 0 ? (
                      <span className={styles.badge}>
                        {thread.unreadForLearner}
                      </span>
                    ) : null}
                  </button>
                ))
              )}
            </div>
          )}
        </aside>

        <section className={styles.threadPane}>
          {!activeThread ? (
            <div className={styles.emptyState}>
              <h2>Select a conversation</h2>
              <p>Or start a new message with someone in your scope.</p>
            </div>
          ) : (
            <>
              <header className={styles.threadHeader}>
                <div className={styles.threadHeaderMain}>
                  <span
                    className={styles.avatarLarge}
                    data-tone={activeThread.channelType}
                  >
                    {initialsFromTitle(activeThread.title)}
                  </span>
                  <div>
                    <h2>{activeThread.title}</h2>
                    <p className={styles.privacy}>{activeThread.privacyNote}</p>
                  </div>
                </div>
                <span
                  className={styles.channelChip}
                  data-tone={activeThread.channelType}
                >
                  {channelLabel(activeThread.channelType)}
                </span>
              </header>
              <div className={styles.messages}>
                {activeThread.messages.length === 0 ? (
                  <p className={styles.empty}>No messages yet. Say hello.</p>
                ) : (
                  activeThread.messages.map((m) => {
                    const mine = m.senderId === "contact-alex";
                    return (
                      <div
                        key={m.messageId}
                        className={
                          mine ? styles.messageRowMine : styles.messageRowTheirs
                        }
                      >
                        {!mine ? (
                          <span className={styles.bubbleAvatar} aria-hidden>
                            {initialsFromTitle(m.senderName)}
                          </span>
                        ) : null}
                        <div
                          className={
                            mine ? styles.bubbleMine : styles.bubbleTheirs
                          }
                        >
                          {!mine ? (
                            <span className={styles.sender}>{m.senderName}</span>
                          ) : null}
                          <ChatMessageBody message={m} mine={mine} />
                          <time dateTime={m.sentAt}>{formatTime(m.sentAt)}</time>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
              <ChatComposer
                onSend={(payload) => {
                  if (!activeThreadId) return;
                  sendMessage(activeThreadId, payload);
                }}
              />
            </>
          )}
        </section>
      </div>
    </LearnerPageShell>
  );
}
