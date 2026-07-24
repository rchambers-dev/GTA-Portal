"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  contactsForLearner,
  ensureThreadWithContact as ensureThreadInStore,
  getThread,
  listThreads,
  markThreadRead as markReadInStore,
  sendMessage as sendInStore,
  unreadTotal,
} from "../domain/chat/store";
import type {
  ChatContact,
  ChatMessage,
  ChatPortalLinkAttachment,
  ChatSendPayload,
  ChatThread,
} from "../domain/chat/types";

type LearnerChatContextValue = {
  contacts: ChatContact[];
  threads: ChatThread[];
  unread: number;
  pendingShare: ChatPortalLinkAttachment | null;
  /** Incrementing signal — dock opens when this changes. */
  openDockSignal: number;
  refresh: () => void;
  markThreadRead: (threadId: string) => void;
  sendMessage: (
    threadId: string,
    payload: string | ChatSendPayload,
  ) => ChatMessage | null;
  ensureThreadWithContact: (contactId: string) => ChatThread;
  getThreadById: (threadId: string) => ChatThread | undefined;
  queueShare: (link: ChatPortalLinkAttachment) => void;
  clearPendingShare: () => void;
  requestOpenDock: () => void;
};

const LearnerChatContext = createContext<LearnerChatContextValue | null>(null);

export function LearnerChatProvider({ children }: { children: ReactNode }) {
  const [version, setVersion] = useState(0);
  const [pendingShare, setPendingShare] =
    useState<ChatPortalLinkAttachment | null>(null);
  const [openDockSignal, setOpenDockSignal] = useState(0);

  const refresh = useCallback(() => {
    setVersion((v) => v + 1);
  }, []);

  const markThreadRead = useCallback((threadId: string) => {
    const thread = getThread(threadId);
    if (!thread || thread.unreadForLearner === 0) return;
    markReadInStore(threadId);
    setVersion((v) => v + 1);
  }, []);

  const sendMessage = useCallback(
    (threadId: string, payload: string | ChatSendPayload) => {
      const msg = sendInStore(threadId, payload);
      if (msg) setVersion((v) => v + 1);
      return msg;
    },
    [],
  );

  const ensureThreadWithContact = useCallback((contactId: string) => {
    const thread = ensureThreadInStore(contactId);
    setVersion((v) => v + 1);
    return thread;
  }, []);

  const getThreadById = useCallback(
    (threadId: string) => getThread(threadId),
    [],
  );

  const queueShare = useCallback((link: ChatPortalLinkAttachment) => {
    setPendingShare(link);
  }, []);

  const clearPendingShare = useCallback(() => {
    setPendingShare(null);
  }, []);

  const requestOpenDock = useCallback(() => {
    setOpenDockSignal((n) => n + 1);
  }, []);

  const value = useMemo<LearnerChatContextValue>(() => {
    void version;
    return {
      contacts: contactsForLearner(),
      threads: listThreads(),
      unread: unreadTotal(),
      pendingShare,
      openDockSignal,
      refresh,
      markThreadRead,
      sendMessage,
      ensureThreadWithContact,
      getThreadById,
      queueShare,
      clearPendingShare,
      requestOpenDock,
    };
  }, [
    version,
    pendingShare,
    openDockSignal,
    refresh,
    markThreadRead,
    sendMessage,
    ensureThreadWithContact,
    getThreadById,
    queueShare,
    clearPendingShare,
    requestOpenDock,
  ]);

  return (
    <LearnerChatContext.Provider value={value}>
      {children}
    </LearnerChatContext.Provider>
  );
}

export function useLearnerChat(): LearnerChatContextValue {
  const ctx = useContext(LearnerChatContext);
  if (!ctx) {
    throw new Error("useLearnerChat must be used within LearnerChatProvider");
  }
  return ctx;
}
