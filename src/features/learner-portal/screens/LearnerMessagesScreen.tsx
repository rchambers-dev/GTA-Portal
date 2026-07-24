"use client";

import { useEffect, useMemo, useState } from "react";
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
  const [draft, setDraft] = useState("");

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
    setDraft("");
    markThreadRead(threadId);
  }

  function startWithContact(contactId: string) {
    const thread = ensureThreadWithContact(contactId);
    openThread(thread.threadId);
  }

  function handleSend() {
    if (!activeThreadId || !draft.trim()) return;
    sendMessage(activeThreadId, draft);
    setDraft("");
  }

  return (
    <LearnerPageShell
      title="Messages"
      description="Chat with your mentor, tutor, employer contact, or GTA Support. Each conversation has its own privacy rules."
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
                  <span className={styles.avatar}>{contact.initials}</span>
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
                    data-active={thread.threadId === activeThreadId ? "true" : "false"}
                    onClick={() => openThread(thread.threadId)}
                  >
                    <span className={styles.sideMeta}>
                      <strong>{thread.title}</strong>
                      <span>
                        {channelLabel(thread.channelType)} · {formatTime(thread.lastMessageAt)}
                      </span>
                    </span>
                    {thread.unreadForLearner > 0 ? (
                      <span className={styles.badge}>{thread.unreadForLearner}</span>
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
                <div>
                  <h2>{activeThread.title}</h2>
                  <p className={styles.privacy}>{activeThread.privacyNote}</p>
                </div>
                <span className={styles.channelChip}>
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
                        className={mine ? styles.bubbleMine : styles.bubbleTheirs}
                      >
                        {!mine ? <span className={styles.sender}>{m.senderName}</span> : null}
                        <p>{m.body}</p>
                        <time dateTime={m.sentAt}>{formatTime(m.sentAt)}</time>
                      </div>
                    );
                  })
                )}
              </div>
              <form
                className={styles.composer}
                onSubmit={(e) => {
                  e.preventDefault();
                  handleSend();
                }}
              >
                <input
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  placeholder="Write a message…"
                  aria-label="Message"
                />
                <button type="submit" disabled={!draft.trim()}>
                  Send
                </button>
              </form>
            </>
          )}
        </section>
      </div>
    </LearnerPageShell>
  );
}
