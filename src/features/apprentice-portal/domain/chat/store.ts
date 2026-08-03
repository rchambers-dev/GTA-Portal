import {
  privacyNoteForChannel,
  privacyNoteForGroup,
  type ChatContact,
  type ChatMessage,
  type ChatSendPayload,
  type ChatThread,
} from "./types";

const APPRENTICE_ID = "live-apprentice";
const MENTOR_ID = "contact-mentor";
const TUTOR_ID = "contact-tutor";

/** Signed-in chat identity — shared Messages page switches this per workspace. */
export const CHAT_SELF_APPRENTICE = "contact-apprentice";
export const CHAT_SELF_EMPLOYER = "contact-employer";
export const CHAT_SELF_ADMIN = "contact-admin";

let selfContactId = CHAT_SELF_APPRENTICE;

export function setChatSelfContactId(contactId: string): void {
  selfContactId = contactId;
}

export function getChatSelfContactId(): string {
  return selfContactId;
}

function selfContact(): ChatContact {
  return getContact(selfContactId) ?? APPRENTICE;
}

const APPRENTICE: ChatContact = {
  contactId: CHAT_SELF_APPRENTICE,
  name: "Apprentice",
  initials: "AP",
  role: "apprentice",
  roleLabel: "Apprentice",
  defaultChannel: "direct",
};

export const CHAT_CONTACTS: ChatContact[] = [
  APPRENTICE,
  {
    contactId: MENTOR_ID,
    name: "Progress mentor",
    initials: "PM",
    role: "mentor",
    roleLabel: "Progress mentor",
    organisation: "GTA Doncaster",
    defaultChannel: "direct",
  },
  {
    contactId: TUTOR_ID,
    name: "Tutor",
    initials: "TU",
    role: "tutor",
    roleLabel: "Tutor",
    organisation: "GTA Doncaster",
    defaultChannel: "direct",
  },
  {
    contactId: CHAT_SELF_EMPLOYER,
    name: "Employer contact",
    initials: "EM",
    role: "employer",
    roleLabel: "Employer contact",
    organisation: "Employer",
    defaultChannel: "employer",
  },
  {
    contactId: CHAT_SELF_ADMIN,
    name: "Administrator",
    initials: "AD",
    role: "support",
    roleLabel: "Administrator",
    organisation: "GTA Doncaster",
    defaultChannel: "direct",
  },
  {
    contactId: "contact-support-gta",
    name: "GTA Support",
    initials: "GS",
    role: "support",
    roleLabel: "Support desk",
    organisation: "GTA Doncaster",
    defaultChannel: "support",
  },
  {
    contactId: "contact-safeguarding-dsl",
    name: "Safeguarding",
    initials: "SG",
    role: "safeguarding",
    roleLabel: "Designated Safeguarding Lead",
    organisation: "GTA Doncaster",
    defaultChannel: "safeguarding",
  },
];

/** Replace demo contact labels with the signed-in apprentice's live people. */
export function syncChatContactsFromProfile(profile: {
  displayName: string;
  initials: string;
  mentorName: string;
  tutorName: string;
  employerContact: string;
  employerName: string;
}): void {
  const apprentice = CHAT_CONTACTS.find((c) => c.contactId === CHAT_SELF_APPRENTICE);
  if (apprentice) {
    apprentice.name = profile.displayName;
    apprentice.initials = profile.initials;
  }
  const mentor = CHAT_CONTACTS.find((c) => c.contactId === MENTOR_ID);
  if (mentor) mentor.name = profile.mentorName;
  const tutor = CHAT_CONTACTS.find((c) => c.contactId === TUTOR_ID);
  if (tutor) tutor.name = profile.tutorName;
  const employer = CHAT_CONTACTS.find((c) => c.contactId === CHAT_SELF_EMPLOYER);
  if (employer) {
    employer.name = profile.employerContact;
    employer.organisation = profile.employerName;
  }
}

let THREADS: ChatThread[] = [];

export function contactsForApprentice(): ChatContact[] {
  return contactsForViewer(CHAT_SELF_APPRENTICE);
}

/** People the signed-in viewer can message (excludes self). */
export function contactsForViewer(viewerId = getChatSelfContactId()): ChatContact[] {
  return CHAT_CONTACTS.filter((c) => c.contactId !== viewerId);
}

export function getContact(contactId: string): ChatContact | undefined {
  return CHAT_CONTACTS.find((c) => c.contactId === contactId);
}

export function listThreads(): ChatThread[] {
  return listThreadsForViewer(getChatSelfContactId());
}

/** Threads the signed-in viewer belongs to. */
export function listThreadsForViewer(
  viewerId = getChatSelfContactId(),
): ChatThread[] {
  return [...THREADS]
    .filter((t) => t.participantIds.includes(viewerId))
    .sort((a, b) => b.lastMessageAt.localeCompare(a.lastMessageAt));
}

export function getThread(threadId: string): ChatThread | undefined {
  return THREADS.find((t) => t.threadId === threadId);
}

export function unreadTotal(): number {
  const self = getChatSelfContactId();
  if (self === CHAT_SELF_APPRENTICE) {
    return listThreadsForViewer(self).reduce(
      (sum, t) => sum + t.unreadForApprentice,
      0,
    );
  }
  // Employer / other roles: treat a thread as unread when the last message isn't yours.
  return listThreadsForViewer(self).reduce((sum, t) => {
    const last = t.messages[t.messages.length - 1];
    if (last && last.senderId !== self) return sum + 1;
    return sum;
  }, 0);
}

export function markThreadRead(threadId: string): void {
  THREADS = THREADS.map((t) =>
    t.threadId === threadId ? { ...t, unreadForApprentice: 0 } : t,
  );
}

export function sendMessage(
  threadId: string,
  payload: string | ChatSendPayload,
): ChatMessage | null {
  const next: ChatSendPayload =
    typeof payload === "string" ? { body: payload } : payload;
  const text = (next.body ?? "").trim();
  const attachment = next.attachment;
  if (!text && !attachment) return null;

  const thread = THREADS.find((t) => t.threadId === threadId);
  if (!thread) return null;

  const me = selfContact();
  const message: ChatMessage = {
    messageId: `msg-${Date.now().toString(36)}`,
    threadId,
    senderId: me.contactId,
    senderName: me.name,
    body: text,
    sentAt: new Date().toISOString(),
    ...(attachment ? { attachment } : {}),
  };

  THREADS = THREADS.map((t) =>
    t.threadId === threadId
      ? {
          ...t,
          messages: [...t.messages, message],
          lastMessageAt: message.sentAt,
          unreadForApprentice:
            me.contactId === CHAT_SELF_APPRENTICE ? 0 : t.unreadForApprentice,
        }
      : t,
  );

  return message;
}

export function editMessage(
  threadId: string,
  messageId: string,
  body: string,
): ChatMessage | null {
  const text = body.trim();
  const thread = THREADS.find((t) => t.threadId === threadId);
  if (!thread) return null;

  const me = getChatSelfContactId();
  const existing = thread.messages.find((m) => m.messageId === messageId);
  if (!existing || existing.senderId !== me) return null;
  if (!text && !existing.attachment) return null;
  if (text === existing.body) return existing;

  const editedAt = new Date().toISOString();
  let updated: ChatMessage | null = null;

  THREADS = THREADS.map((t) => {
    if (t.threadId !== threadId) return t;
    const messages = t.messages.map((m) => {
      if (m.messageId !== messageId) return m;
      updated = { ...m, body: text, editedAt };
      return updated;
    });
    const last = messages[messages.length - 1];
    return {
      ...t,
      messages,
      lastMessageAt: last?.sentAt ?? t.lastMessageAt,
    };
  });

  return updated;
}

export function deleteMessage(threadId: string, messageId: string): boolean {
  const thread = THREADS.find((t) => t.threadId === threadId);
  if (!thread) return false;

  const me = getChatSelfContactId();
  const existing = thread.messages.find((m) => m.messageId === messageId);
  if (!existing || existing.senderId !== me) return false;

  THREADS = THREADS.map((t) => {
    if (t.threadId !== threadId) return t;
    const messages = t.messages.filter((m) => m.messageId !== messageId);
    const last = messages[messages.length - 1];
    return {
      ...t,
      messages,
      lastMessageAt: last?.sentAt ?? t.lastMessageAt,
    };
  });

  return true;
}

export function ensureThreadWithContact(contactId: string): ChatThread {
  const contact = getContact(contactId);
  if (!contact) throw new Error(`Unknown contact ${contactId}`);

  const self = getChatSelfContactId();
  const existing = THREADS.find(
    (t) =>
      t.participantIds.includes(contactId) &&
      t.participantIds.includes(self) &&
      t.channelType === contact.defaultChannel,
  );
  if (existing) return existing;

  const participantIds =
    contact.defaultChannel === "employer"
      ? Array.from(
          new Set([
            CHAT_SELF_APPRENTICE,
            CHAT_SELF_EMPLOYER,
            MENTOR_ID,
            self,
            contactId,
          ]),
        )
      : Array.from(new Set([self, contactId]));

  const thread: ChatThread = {
    threadId: `thread-new-${contactId}-${Date.now().toString(36)}`,
    apprenticeId: APPRENTICE_ID,
    channelType: contact.defaultChannel,
    title:
      contact.defaultChannel === "employer"
        ? `${getContact(CHAT_SELF_EMPLOYER)?.name ?? contact.name} · ${
            getContact(CHAT_SELF_EMPLOYER)?.organisation ??
            contact.organisation ??
            "Employer"
          }`
        : contact.name,
    participantIds,
    privacyNote: privacyNoteForChannel(contact.defaultChannel),
    lastMessageAt: new Date().toISOString(),
    unreadForApprentice: 0,
    messages: [],
  };

  THREADS = [thread, ...THREADS];
  return thread;
}

function otherParticipantNames(participantIds: string[]): string[] {
  const self = getChatSelfContactId();
  return participantIds
    .filter((id) => id !== self)
    .map((id) => getContact(id)?.name)
    .filter((name): name is string => Boolean(name));
}

export function defaultGroupTitle(participantIds: string[]): string {
  const names = otherParticipantNames(participantIds);
  if (names.length === 0) return "Group chat";
  if (names.length === 1) return names[0];
  if (names.length === 2) return `${names[0]} & ${names[1]}`;
  return `${names[0]}, ${names[1]} +${names.length - 2}`;
}

/**
 * Create a group chat with the signed-in viewer plus at least one other person.
 * Pass 2+ others for a typical multi-teacher / team group.
 */
export function createGroupThread(
  participantIds: string[],
  title?: string,
): ChatThread {
  const self = getChatSelfContactId();
  const me = selfContact();
  const others = [
    ...new Set(
      participantIds.filter(
        (id) => id !== self && Boolean(getContact(id)),
      ),
    ),
  ];
  if (others.length < 1) {
    throw new Error("Add at least one person to start a group chat.");
  }

  const allIds = [self, ...others];
  const sortedKey = [...others].sort().join("|");
  const existing = THREADS.find((t) => {
    if (t.channelType !== "group") return false;
    if (!t.participantIds.includes(self)) return false;
    const key = t.participantIds
      .filter((id) => id !== self)
      .sort()
      .join("|");
    return key === sortedKey;
  });
  if (existing) return existing;

  const resolvedTitle = (title ?? "").trim() || defaultGroupTitle(allIds);
  const now = new Date().toISOString();
  const threadId = `thread-group-${Date.now().toString(36)}`;
  const thread: ChatThread = {
    threadId,
    apprenticeId: APPRENTICE_ID,
    channelType: "group",
    title: resolvedTitle,
    participantIds: allIds,
    privacyNote: privacyNoteForGroup(otherParticipantNames(allIds)),
    lastMessageAt: now,
    unreadForApprentice: 0,
    messages: [
      {
        messageId: `sys-${Date.now().toString(36)}`,
        threadId,
        senderId: me.contactId,
        senderName: me.name,
        body: `Group created with ${otherParticipantNames(allIds).join(", ")}.`,
        sentAt: now,
      },
    ],
  };

  THREADS = [thread, ...THREADS];
  return thread;
}

/** Add people to an existing group chat. */
export function addParticipantsToThread(
  threadId: string,
  contactIds: string[],
): ChatThread | null {
  const thread = THREADS.find((t) => t.threadId === threadId);
  if (!thread || thread.channelType !== "group") return null;

  const self = getChatSelfContactId();
  const me = selfContact();
  const additions = [
    ...new Set(
      contactIds.filter(
        (id) =>
          id !== self &&
          Boolean(getContact(id)) &&
          !thread.participantIds.includes(id),
      ),
    ),
  ];
  if (additions.length === 0) return thread;

  const nextIds = [...thread.participantIds, ...additions];
  const addedNames = additions
    .map((id) => getContact(id)?.name)
    .filter((name): name is string => Boolean(name));
  const now = new Date().toISOString();
  const notice: ChatMessage = {
    messageId: `sys-${Date.now().toString(36)}`,
    threadId,
    senderId: me.contactId,
    senderName: me.name,
    body: `Added ${addedNames.join(", ")} to the group.`,
    sentAt: now,
  };

  let updated: ChatThread | null = null;
  THREADS = THREADS.map((t) => {
    if (t.threadId !== threadId) return t;
    updated = {
      ...t,
      participantIds: nextIds,
      privacyNote: privacyNoteForGroup(otherParticipantNames(nextIds)),
      lastMessageAt: now,
      messages: [...t.messages, notice],
    };
    return updated;
  });

  return updated;
}

export function renameGroupThread(
  threadId: string,
  title: string,
): ChatThread | null {
  const next = title.trim();
  if (!next) return null;
  const thread = THREADS.find((t) => t.threadId === threadId);
  if (!thread || thread.channelType !== "group") return null;

  let updated: ChatThread | null = null;
  THREADS = THREADS.map((t) => {
    if (t.threadId !== threadId) return t;
    updated = { ...t, title: next };
    return updated;
  });
  return updated;
}
