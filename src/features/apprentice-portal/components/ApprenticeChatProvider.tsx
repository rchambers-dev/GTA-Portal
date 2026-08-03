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
  CHAT_SELF_APPRENTICE,
  contactsForViewer,
  ensureThreadWithContact as ensureThreadInStore,
  createGroupThread as createGroupInStore,
  addParticipantsToThread as addParticipantsInStore,
  getContact,
  getThread,
  listThreads,
  markThreadRead as markReadInStore,
  sendMessage as sendInStore,
  editMessage as editInStore,
  deleteMessage as deleteInStore,
  setChatSelfContactId,
  unreadTotal,
} from "../domain/chat/store";
import type {
  ChatContact,
  ChatMessage,
  ChatPortalLinkAttachment,
  ChatSendPayload,
  ChatThread,
} from "../domain/chat/types";

type ApprenticeChatContextValue = {
  selfContactId: string;
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
  editMessage: (
    threadId: string,
    messageId: string,
    body: string,
  ) => ChatMessage | null;
  deleteMessage: (threadId: string, messageId: string) => boolean;
  ensureThreadWithContact: (contactId: string) => ChatThread;
  createGroupThread: (
    participantIds: string[],
    title?: string,
  ) => ChatThread;
  addParticipantsToThread: (
    threadId: string,
    contactIds: string[],
  ) => ChatThread | null;
  getContactById: (contactId: string) => ChatContact | undefined;
  getThreadById: (threadId: string) => ChatThread | undefined;
  queueShare: (link: ChatPortalLinkAttachment) => void;
  clearPendingShare: () => void;
  requestOpenDock: () => void;
};

const ApprenticeChatContext = createContext<ApprenticeChatContextValue | null>(null);

export function ApprenticeChatProvider({
  children,
  selfContactId = CHAT_SELF_APPRENTICE,
}: {
  children: ReactNode;
  /** Signed-in chat identity — apprentice or employer contact id. */
  selfContactId?: string;
}) {
  const [version, setVersion] = useState(0);
  const [pendingShare, setPendingShare] =
    useState<ChatPortalLinkAttachment | null>(null);
  const [openDockSignal, setOpenDockSignal] = useState(0);
  const [prevSelfContactId, setPrevSelfContactId] = useState(selfContactId);

  if (selfContactId !== prevSelfContactId) {
    setPrevSelfContactId(selfContactId);
    setChatSelfContactId(selfContactId);
    setVersion((v) => v + 1);
  }

  const refresh = useCallback(() => {
    setVersion((v) => v + 1);
  }, []);

  const markThreadRead = useCallback((threadId: string) => {
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

  const editMessage = useCallback(
    (threadId: string, messageId: string, body: string) => {
      const msg = editInStore(threadId, messageId, body);
      if (msg) setVersion((v) => v + 1);
      return msg;
    },
    [],
  );

  const deleteMessage = useCallback((threadId: string, messageId: string) => {
    const ok = deleteInStore(threadId, messageId);
    if (ok) setVersion((v) => v + 1);
    return ok;
  }, []);

  const ensureThreadWithContact = useCallback((contactId: string) => {
    const thread = ensureThreadInStore(contactId);
    setVersion((v) => v + 1);
    return thread;
  }, []);

  const createGroupThread = useCallback(
    (participantIds: string[], title?: string) => {
      const thread = createGroupInStore(participantIds, title);
      setVersion((v) => v + 1);
      return thread;
    },
    [],
  );

  const addParticipantsToThread = useCallback(
    (threadId: string, contactIds: string[]) => {
      const thread = addParticipantsInStore(threadId, contactIds);
      if (thread) setVersion((v) => v + 1);
      return thread;
    },
    [],
  );

  const getContactById = useCallback(
    (contactId: string) => getContact(contactId),
    [],
  );

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

  const value = useMemo<ApprenticeChatContextValue>(() => {
    void version;
    setChatSelfContactId(selfContactId);
    return {
      selfContactId,
      contacts: contactsForViewer(selfContactId),
      threads: listThreads(),
      unread: unreadTotal(),
      pendingShare,
      openDockSignal,
      refresh,
      markThreadRead,
      sendMessage,
      editMessage,
      deleteMessage,
      ensureThreadWithContact,
      createGroupThread,
      addParticipantsToThread,
      getContactById,
      getThreadById,
      queueShare,
      clearPendingShare,
      requestOpenDock,
    };
  }, [
    version,
    selfContactId,
    pendingShare,
    openDockSignal,
    refresh,
    markThreadRead,
    sendMessage,
    editMessage,
    deleteMessage,
    ensureThreadWithContact,
    createGroupThread,
    addParticipantsToThread,
    getContactById,
    getThreadById,
    queueShare,
    clearPendingShare,
    requestOpenDock,
  ]);

  return (
    <ApprenticeChatContext.Provider value={value}>
      {children}
    </ApprenticeChatContext.Provider>
  );
}

export function useApprenticeChat(): ApprenticeChatContextValue {
  const ctx = useContext(ApprenticeChatContext);
  if (!ctx) {
    throw new Error("useApprenticeChat must be used within ApprenticeChatProvider");
  }
  return ctx;
}
