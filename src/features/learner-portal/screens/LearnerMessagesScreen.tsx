"use client";

import { useEffect, useMemo, useState } from "react";
import { ChatComposer } from "../components/ChatComposer";
import { ChatMessageItem } from "../components/ChatMessageItem";
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
    case "safeguarding":
      return "Safeguarding";
  }
}

function initialsFromTitle(title: string): string {
  const parts = title.split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] ?? ""}${parts[1][0] ?? ""}`.toUpperCase();
}

function formatShortTime(iso: string): string {
  try {
    const date = new Date(iso);
    const now = new Date();
    const sameDay =
      date.getFullYear() === now.getFullYear() &&
      date.getMonth() === now.getMonth() &&
      date.getDate() === now.getDate();
    if (sameDay) {
      return date.toLocaleTimeString("en-GB", {
        hour: "2-digit",
        minute: "2-digit",
      });
    }
    return date.toLocaleDateString("en-GB", {
      day: "numeric",
      month: "short",
    });
  } catch {
    return iso;
  }
}

function previewForThread(thread: {
  messages: { body: string; attachment?: { type: string } }[];
}): string {
  const last = thread.messages[thread.messages.length - 1];
  if (!last) return "No messages yet";
  const text = last.body.trim();
  if (text) return text;
  switch (last.attachment?.type) {
    case "gif":
      return "GIF";
    case "image":
      return "Photo";
    case "file":
      return "Document";
    case "portal_link":
      return "Portal link";
    case "contact":
      return "Contact";
    case "poll":
      return "Poll";
    case "event":
      return "Event";
    default:
      return "Attachment";
  }
}

export function LearnerMessagesScreen() {
  const {
    contacts,
    threads,
    markThreadRead,
    sendMessage,
    editMessage,
    deleteMessage,
    ensureThreadWithContact,
    getThreadById,
  } = useLearnerChat();

  const [activeThreadId, setActiveThreadId] = useState<string | null>(
    () => threads[0]?.threadId ?? null,
  );
  const [showContacts, setShowContacts] = useState(false);
  const [search, setSearch] = useState("");

  const query = search.trim().toLowerCase();

  const visibleThreads = useMemo(() => {
    if (!query) return threads;
    return threads.filter((thread) =>
      thread.title.toLowerCase().includes(query),
    );
  }, [threads, query]);

  const visibleContacts = useMemo(() => {
    if (!query) return contacts;
    return contacts.filter(
      (contact) =>
        contact.name.toLowerCase().includes(query) ||
        contact.roleLabel.toLowerCase().includes(query) ||
        (contact.organisation ?? "").toLowerCase().includes(query),
    );
  }, [contacts, query]);

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
      description="Mentor, tutor, employer, or GTA Support — each chat has its own privacy rules."
      fill
      compactHeader
    >
      <div className={styles.layout}>
        <aside className={styles.sidebar}>
          <div className={styles.sideHead}>
            <div className={styles.sideHeadText}>
              <strong>{showContacts ? "New chat" : "Chats"}</strong>
              <span>
                {showContacts
                  ? `${contacts.length} people`
                  : `${threads.length} conversations`}
              </span>
            </div>
            <button
              type="button"
              className={styles.newChatBtn}
              onClick={() => setShowContacts((v) => !v)}
            >
              {showContacts ? "Back to chats" : "New message"}
            </button>
            <div className={styles.sideSearch}>
              <span className={styles.sideSearchIcon} aria-hidden>
                🔍
              </span>
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={
                  showContacts ? "Search people" : "Search chats"
                }
                aria-label={
                  showContacts ? "Search people" : "Search chats"
                }
              />
              {search ? (
                <button
                  type="button"
                  className={styles.sideSearchClear}
                  onClick={() => setSearch("")}
                  aria-label="Clear search"
                >
                  ×
                </button>
              ) : null}
            </div>
          </div>
          {showContacts ? (
            <div className={styles.sideList}>
              <p className={styles.sideHint}>People in your programme scope</p>
              {visibleContacts.length === 0 ? (
                <p className={styles.empty}>
                  No people match “{search.trim()}”.
                </p>
              ) : (
                visibleContacts.map((contact) => (
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
                        {contact.organisation
                          ? ` · ${contact.organisation}`
                          : ""}
                      </span>
                    </span>
                  </button>
                ))
              )}
            </div>
          ) : (
            <div className={styles.sideList}>
              {threads.length === 0 ? (
                <p className={styles.empty}>No conversations yet.</p>
              ) : visibleThreads.length === 0 ? (
                <p className={styles.empty}>
                  No chats match “{search.trim()}”.
                </p>
              ) : (
                visibleThreads.map((thread) => (
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
                      <span className={styles.sideMetaTop}>
                        <strong>{thread.title}</strong>
                        <span className={styles.sideTime}>
                          {formatShortTime(thread.lastMessageAt)}
                        </span>
                      </span>
                      <span className={styles.sidePreview}>
                        {previewForThread(thread)}
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
                  activeThread.messages.map((m) => (
                    <ChatMessageItem
                      key={m.messageId}
                      message={m}
                      mine={m.senderId === "contact-alex"}
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
