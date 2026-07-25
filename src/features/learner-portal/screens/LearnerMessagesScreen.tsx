"use client";

import { useEffect, useMemo, useState } from "react";
import { ChatComposer } from "../components/ChatComposer";
import { ChatMessageItem } from "../components/ChatMessageItem";
import { LearnerPageShell } from "../components/LearnerPageShell";
import { useLearnerChat } from "../components/LearnerChatProvider";
import { defaultGroupTitle } from "../domain/chat/store";
import type { ChatChannelType, ChatContact, ChatThread } from "../domain/chat/types";
import styles from "./LearnerMessagesScreen.module.css";

type SideMode = "chats" | "contacts" | "new-group" | "add-people";

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
    case "sticker":
      return "Sticker";
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

function AvatarStack({
  contacts,
  fallbackTitle,
  large = false,
}: {
  contacts: ChatContact[];
  fallbackTitle: string;
  large?: boolean;
}) {
  const shown = contacts.slice(0, 3);
  if (shown.length <= 1) {
    return (
      <span
        className={large ? styles.avatarLarge : styles.avatar}
        data-tone="group"
      >
        {shown[0]?.initials ?? initialsFromTitle(fallbackTitle)}
      </span>
    );
  }
  return (
    <span
      className={large ? styles.avatarStackLarge : styles.avatarStack}
      aria-hidden
    >
      {shown.map((contact, index) => (
        <span
          key={contact.contactId}
          className={styles.avatarStackItem}
          style={{ zIndex: shown.length - index }}
        >
          {contact.initials}
        </span>
      ))}
    </span>
  );
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
    createGroupThread,
    addParticipantsToThread,
    getContactById,
    getThreadById,
  } = useLearnerChat();

  const [activeThreadId, setActiveThreadId] = useState<string | null>(
    () => threads[0]?.threadId ?? null,
  );
  const [sideMode, setSideMode] = useState<SideMode>("chats");
  const [search, setSearch] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [groupTitle, setGroupTitle] = useState("");

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

  const activeOtherContacts = useMemo(() => {
    if (!activeThread) return [];
    return activeThread.participantIds
      .filter((id) => id !== "contact-alex")
      .map((id) => getContactById(id))
      .filter((c): c is ChatContact => Boolean(c));
  }, [activeThread, getContactById]);

  const addableContacts = useMemo(() => {
    if (!activeThread) return contacts;
    const inThread = new Set(activeThread.participantIds);
    return contacts.filter((c) => !inThread.has(c.contactId));
  }, [activeThread, contacts]);

  useEffect(() => {
    if (activeThreadId) markThreadRead(activeThreadId);
  }, [activeThreadId, markThreadRead]);

  function openThread(threadId: string) {
    setActiveThreadId(threadId);
    setSideMode("chats");
    setSelectedIds([]);
    setGroupTitle("");
    setSearch("");
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

  function beginNewGroup() {
    setSideMode("new-group");
    setSelectedIds([]);
    setGroupTitle("");
    setSearch("");
  }

  function beginAddPeople() {
    setSideMode("add-people");
    setSelectedIds([]);
    setSearch("");
  }

  function createGroup() {
    if (selectedIds.length === 0) return;
    const thread = createGroupThread(
      selectedIds,
      groupTitle.trim() || undefined,
    );
    openThread(thread.threadId);
  }

  function confirmAddPeople() {
    if (!activeThreadId || selectedIds.length === 0) return;
    const thread = addParticipantsToThread(activeThreadId, selectedIds);
    if (thread) openThread(thread.threadId);
  }

  function threadAvatar(thread: ChatThread) {
    if (thread.channelType !== "group") {
      return (
        <span className={styles.avatar} data-tone={thread.channelType}>
          {initialsFromTitle(thread.title)}
        </span>
      );
    }
    const people = thread.participantIds
      .filter((id) => id !== "contact-alex")
      .map((id) => getContactById(id))
      .filter((c): c is ChatContact => Boolean(c));
    return (
      <AvatarStack contacts={people} fallbackTitle={thread.title} />
    );
  }

  const sideTitle =
    sideMode === "contacts"
      ? "New chat"
      : sideMode === "new-group"
        ? "New group"
        : sideMode === "add-people"
          ? "Add people"
          : "Chats";

  const sideCount =
    sideMode === "chats"
      ? `${threads.length} conversations`
      : sideMode === "add-people"
        ? `${addableContacts.length} available`
        : `${contacts.length} people`;

  const pickerContacts =
    sideMode === "add-people"
      ? addableContacts.filter((contact) => {
          if (!query) return true;
          return (
            contact.name.toLowerCase().includes(query) ||
            contact.roleLabel.toLowerCase().includes(query) ||
            (contact.organisation ?? "").toLowerCase().includes(query)
          );
        })
      : visibleContacts;

  return (
    <LearnerPageShell
      title="Messages"
      description="Message one person, or start a group with teachers and others in your scope."
      fill
      compactHeader
    >
      <div className={styles.layout}>
        <aside className={styles.sidebar}>
          <div className={styles.sideHead}>
            <div className={styles.sideHeadText}>
              <strong>{sideTitle}</strong>
              <span>{sideCount}</span>
            </div>
            <div className={styles.sideHeadActions}>
              {sideMode === "chats" ? (
                <>
                  <button
                    type="button"
                    className={styles.newChatBtn}
                    onClick={() => {
                      setSideMode("contacts");
                      setSearch("");
                    }}
                  >
                    New message
                  </button>
                  <button
                    type="button"
                    className={styles.newGroupBtn}
                    onClick={beginNewGroup}
                  >
                    New group
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  className={styles.newChatBtn}
                  onClick={() => {
                    setSideMode("chats");
                    setSelectedIds([]);
                    setGroupTitle("");
                    setSearch("");
                  }}
                >
                  Back to chats
                </button>
              )}
            </div>
            <div className={styles.sideSearch}>
              <span className={styles.sideSearchIcon} aria-hidden>
                🔍
              </span>
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={
                  sideMode === "chats" ? "Search chats" : "Search people"
                }
                aria-label={
                  sideMode === "chats" ? "Search chats" : "Search people"
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

          {sideMode === "chats" ? (
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
                    {threadAvatar(thread)}
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
          ) : sideMode === "contacts" ? (
            <div className={styles.sideList}>
              <p className={styles.sideHint}>
                Message one person, or{" "}
                <button
                  type="button"
                  className={styles.textBtn}
                  onClick={beginNewGroup}
                >
                  start a group
                </button>
                .
              </p>
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
              <p className={styles.sideHint}>
                {sideMode === "new-group"
                  ? "Select teachers or anyone in your scope, then create the group."
                  : "Add more people to this group chat."}
              </p>
              {sideMode === "new-group" ? (
                <label className={styles.groupTitleField}>
                  <span>Group name (optional)</span>
                  <input
                    type="text"
                    value={groupTitle}
                    onChange={(e) => setGroupTitle(e.target.value)}
                    placeholder={
                      selectedIds.length
                        ? defaultGroupTitle(["contact-alex", ...selectedIds])
                        : "e.g. College catch-up"
                    }
                  />
                </label>
              ) : null}
              {pickerContacts.length === 0 ? (
                <p className={styles.empty}>
                  {sideMode === "add-people"
                    ? "Everyone in your scope is already in this group."
                    : `No people match “${search.trim()}”.`}
                </p>
              ) : (
                pickerContacts.map((contact) => {
                  const checked = selectedIds.includes(contact.contactId);
                  return (
                    <button
                      key={contact.contactId}
                      type="button"
                      className={styles.sideRow}
                      data-selected={checked ? "true" : "false"}
                      onClick={() => toggleSelected(contact.contactId)}
                      aria-pressed={checked}
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
                      <span
                        className={styles.checkMark}
                        data-on={checked ? "true" : "false"}
                        aria-hidden
                      >
                        {checked ? "✓" : ""}
                      </span>
                    </button>
                  );
                })
              )}
              <div className={styles.groupActions}>
                <button
                  type="button"
                  className={styles.primarySideBtn}
                  disabled={selectedIds.length === 0}
                  onClick={
                    sideMode === "new-group" ? createGroup : confirmAddPeople
                  }
                >
                  {sideMode === "new-group"
                    ? `Create group${selectedIds.length ? ` (${selectedIds.length})` : ""}`
                    : `Add${selectedIds.length ? ` (${selectedIds.length})` : ""}`}
                </button>
              </div>
            </div>
          )}
        </aside>

        <section className={styles.threadPane}>
          {!activeThread ? (
            <div className={styles.emptyState}>
              <h2>Select a conversation</h2>
              <p>Or start a new message / group with people in your scope.</p>
            </div>
          ) : (
            <>
              <header className={styles.threadHeader}>
                <div className={styles.threadHeaderMain}>
                  {activeThread.channelType === "group" ? (
                    <AvatarStack
                      contacts={activeOtherContacts}
                      fallbackTitle={activeThread.title}
                      large
                    />
                  ) : (
                    <span
                      className={styles.avatarLarge}
                      data-tone={activeThread.channelType}
                    >
                      {initialsFromTitle(activeThread.title)}
                    </span>
                  )}
                  <div>
                    <h2>{activeThread.title}</h2>
                    <p className={styles.privacy}>{activeThread.privacyNote}</p>
                    {activeThread.channelType === "group" ? (
                      <p className={styles.membersLine}>
                        {activeOtherContacts.map((c) => c.name).join(", ")}
                      </p>
                    ) : null}
                  </div>
                </div>
                <div className={styles.threadHeaderEnd}>
                  {activeThread.channelType === "group" ? (
                    <button
                      type="button"
                      className={styles.addPeopleBtn}
                      onClick={beginAddPeople}
                    >
                      Add people
                    </button>
                  ) : null}
                  <span
                    className={styles.channelChip}
                    data-tone={activeThread.channelType}
                  >
                    {channelLabel(activeThread.channelType)}
                  </span>
                </div>
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
