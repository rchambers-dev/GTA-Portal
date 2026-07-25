"use client";

import { useEffect, useState } from "react";
import { ChatMessageBody } from "./ChatMessageBody";
import type { ChatMessage } from "../domain/chat/types";
import styles from "./ChatMessageItem.module.css";

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

export function ChatMessageItem({
  message,
  mine,
  compact = false,
  onEdit,
  onDelete,
}: {
  message: ChatMessage;
  mine: boolean;
  compact?: boolean;
  onEdit?: (messageId: string, body: string) => void;
  onDelete?: (messageId: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(message.body);
  const canManage = mine && Boolean(onEdit || onDelete);
  const canEditText = mine && Boolean(onEdit);

  useEffect(() => {
    if (!editing) setDraft(message.body);
  }, [message.body, editing]);

  function saveEdit() {
    const next = draft.trim();
    if (!next && !message.attachment) return;
    if (next === message.body.trim()) {
      setEditing(false);
      return;
    }
    onEdit?.(message.messageId, next);
    setEditing(false);
  }

  function cancelEdit() {
    setDraft(message.body);
    setEditing(false);
  }

  function confirmDelete() {
    if (!onDelete) return;
    const ok = window.confirm("Delete this message? This cannot be undone.");
    if (ok) onDelete(message.messageId);
  }

  const rowClass = mine
    ? compact
      ? styles.rowMineCompact
      : styles.rowMine
    : compact
      ? styles.rowTheirsCompact
      : styles.rowTheirs;
  const bubbleClass = mine ? styles.bubbleMine : styles.bubbleTheirs;

  return (
    <div className={rowClass} data-editing={editing ? "true" : undefined}>
      {!mine && !compact ? (
        <span className={styles.avatar} aria-hidden>
          {initialsFromTitle(message.senderName)}
        </span>
      ) : null}
      <div className={bubbleClass}>
        {!mine ? <span className={styles.sender}>{message.senderName}</span> : null}

        {editing ? (
          <div className={styles.editBox}>
            <textarea
              className={styles.editInput}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              rows={Math.min(6, Math.max(2, draft.split("\n").length))}
              aria-label="Edit message"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === "Escape") {
                  e.preventDefault();
                  cancelEdit();
                }
                if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
                  e.preventDefault();
                  saveEdit();
                }
              }}
            />
            <div className={styles.editActions}>
              <button type="button" className={styles.editCancel} onClick={cancelEdit}>
                Cancel
              </button>
              <button
                type="button"
                className={styles.editSave}
                onClick={saveEdit}
                disabled={!draft.trim() && !message.attachment}
              >
                Save
              </button>
            </div>
          </div>
        ) : (
          <ChatMessageBody message={message} mine={mine} />
        )}

        <div className={styles.metaRow}>
          <time dateTime={message.sentAt}>
            {formatTime(message.sentAt)}
            {message.editedAt ? " · Edited" : ""}
          </time>
          {canManage && !editing ? (
            <span className={styles.actions}>
              {canEditText ? (
                <button
                  type="button"
                  className={styles.actionBtn}
                  onClick={() => {
                    setDraft(message.body);
                    setEditing(true);
                  }}
                >
                  Edit
                </button>
              ) : null}
              {onDelete ? (
                <button
                  type="button"
                  className={styles.actionBtn}
                  data-tone="danger"
                  onClick={confirmDelete}
                >
                  Delete
                </button>
              ) : null}
            </span>
          ) : null}
        </div>
      </div>
    </div>
  );
}
