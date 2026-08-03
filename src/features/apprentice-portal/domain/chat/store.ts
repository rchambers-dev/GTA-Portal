import { ALEX_PROFILE } from "../mock-apprentice";
import {
  privacyNoteForChannel,
  privacyNoteForGroup,
  type ChatContact,
  type ChatMessage,
  type ChatSendPayload,
  type ChatThread,
} from "./types";

const APPRENTICE_ID = ALEX_PROFILE.apprenticeId;

/** Signed-in chat identity — shared Messages page switches this per workspace. */
export const CHAT_SELF_APPRENTICE = "contact-alex";
export const CHAT_SELF_EMPLOYER = "contact-employer-priya";
export const CHAT_SELF_ADMIN = "contact-admin-emma";

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
  name: ALEX_PROFILE.displayName,
  initials: ALEX_PROFILE.initials,
  role: "apprentice",
  roleLabel: "Apprentice",
  defaultChannel: "direct",
};

export const CHAT_CONTACTS: ChatContact[] = [
  APPRENTICE,
  {
    contactId: ALEX_PROFILE.mentorId,
    name: ALEX_PROFILE.mentorName,
    initials: "RC",
    role: "mentor",
    roleLabel: "Progress mentor",
    organisation: "GTA Doncaster",
    defaultChannel: "direct",
  },
  {
    contactId: ALEX_PROFILE.tutorId,
    name: ALEX_PROFILE.tutorName,
    initials: "DT",
    role: "tutor",
    roleLabel: "Tutor",
    organisation: "GTA Doncaster",
    defaultChannel: "direct",
  },
  {
    contactId: CHAT_SELF_EMPLOYER,
    name: ALEX_PROFILE.employerContact,
    initials: "PS",
    role: "employer",
    roleLabel: "Employer contact",
    organisation: ALEX_PROFILE.employerName,
    defaultChannel: "employer",
  },
  {
    contactId: CHAT_SELF_ADMIN,
    name: "Emma Clarke",
    initials: "EC",
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

function msg(
  threadId: string,
  id: string,
  senderId: string,
  senderName: string,
  body: string,
  sentAt: string,
): ChatMessage {
  return { messageId: id, threadId, senderId, senderName, body, sentAt };
}

let THREADS: ChatThread[] = [
  {
    threadId: "thread-mentor",
    apprenticeId: APPRENTICE_ID,
    channelType: "direct",
    title: ALEX_PROFILE.mentorName,
    participantIds: ["contact-alex", ALEX_PROFILE.mentorId],
    privacyNote: privacyNoteForChannel("direct"),
    lastMessageAt: "2026-07-21T14:20:00Z",
    unreadForApprentice: 1,
    messages: [
      msg(
        "thread-mentor",
        "m1",
        ALEX_PROFILE.mentorId,
        ALEX_PROFILE.mentorName,
        "Hi Alex — just checking you’re set for college Monday. Let me know if OTJ logging with Priya is still stuck.",
        "2026-07-20T09:10:00Z",
      ),
      msg(
        "thread-mentor",
        "m2",
        "contact-alex",
        ALEX_PROFILE.displayName,
        "Morning Reiss — Priya said she’ll log last week today. Reflective account is nearly done.",
        "2026-07-20T11:45:00Z",
      ),
      msg(
        "thread-mentor",
        "m3",
        ALEX_PROFILE.mentorId,
        ALEX_PROFILE.mentorName,
        "Perfect. Drop me a message when the hours are in and we’ll tick that action off before your August review.",
        "2026-07-21T14:20:00Z",
      ),
    ],
  },
  {
    threadId: "thread-tutor",
    apprenticeId: APPRENTICE_ID,
    channelType: "direct",
    title: ALEX_PROFILE.tutorName,
    participantIds: ["contact-alex", ALEX_PROFILE.tutorId],
    privacyNote: privacyNoteForChannel("direct"),
    lastMessageAt: "2026-07-18T16:05:00Z",
    unreadForApprentice: 0,
    messages: [
      msg(
        "thread-tutor",
        "t1",
        ALEX_PROFILE.tutorId,
        ALEX_PROFILE.tutorName,
        "Alex — bring your inspection sheet Tuesday; we’ll mark the workshop assessment after lunch.",
        "2026-07-18T16:05:00Z",
      ),
      msg(
        "thread-tutor",
        "t2",
        "contact-alex",
        ALEX_PROFILE.displayName,
        "Will do — I’ve got the draft on my phone as well.",
        "2026-07-18T16:22:00Z",
      ),
    ],
  },
  {
    threadId: "thread-employer",
    apprenticeId: APPRENTICE_ID,
    channelType: "employer",
    title: `${ALEX_PROFILE.employerContact} · ${ALEX_PROFILE.employerName}`,
    participantIds: [
      "contact-alex",
      "contact-employer-priya",
      ALEX_PROFILE.mentorId,
    ],
    privacyNote: privacyNoteForChannel("employer"),
    lastMessageAt: "2026-07-19T11:05:00Z",
    unreadForApprentice: 2,
    messages: [
      msg(
        "thread-employer",
        "e1",
        "contact-alex",
        ALEX_PROFILE.displayName,
        "Hi Priya — can we diary the two mentoring slots for last week in the OTJ tracker?",
        "2026-07-19T09:00:00Z",
      ),
      msg(
        "thread-employer",
        "e2",
        "contact-employer-priya",
        ALEX_PROFILE.employerContact,
        "Yes — I’ll add them this afternoon. Sorry they slipped.",
        "2026-07-19T10:30:00Z",
      ),
      {
        messageId: "e3",
        threadId: "thread-employer",
        senderId: "contact-alex",
        senderName: ALEX_PROFILE.displayName,
        body: "Thanks Priya — here’s the catch-up OTJ block ready for you to agree or return.",
        sentAt: "2026-07-19T11:05:00Z",
        attachment: {
          type: "portal_link",
          href: "/employer/otj?otj=otj-5",
          title: "Agree OTJ · Catch-up OTJ block — May to early July",
          detail: "Direct link for employer to agree or return this entry",
          actionLabel: "Agree / return",
          area: "Approvals",
        },
      },
    ],
  },
  {
    threadId: "thread-support",
    apprenticeId: APPRENTICE_ID,
    channelType: "support",
    title: "GTA Support",
    participantIds: ["contact-alex", "contact-support-gta"],
    privacyNote: privacyNoteForChannel("support"),
    lastMessageAt: "2026-07-05T12:00:00Z",
    unreadForApprentice: 0,
    messages: [
      msg(
        "thread-support",
        "s1",
        "contact-alex",
        ALEX_PROFILE.displayName,
        "Hi — just testing how Support chat works. Nothing urgent.",
        "2026-07-05T11:50:00Z",
      ),
      msg(
        "thread-support",
        "s2",
        "contact-support-gta",
        "GTA Support",
        "Thanks Alex. This channel is private from your mentor. Message us anytime you need help.",
        "2026-07-05T12:00:00Z",
      ),
    ],
  },
  {
    threadId: "thread-group-college",
    apprenticeId: APPRENTICE_ID,
    channelType: "group",
    title: "College catch-up",
    participantIds: [
      "contact-alex",
      ALEX_PROFILE.mentorId,
      ALEX_PROFILE.tutorId,
    ],
    privacyNote: privacyNoteForGroup([
      ALEX_PROFILE.mentorName,
      ALEX_PROFILE.tutorName,
    ]),
    lastMessageAt: "2026-07-22T09:40:00Z",
    unreadForApprentice: 1,
    messages: [
      msg(
        "thread-group-college",
        "g1",
        ALEX_PROFILE.mentorId,
        ALEX_PROFILE.mentorName,
        "Quick group so Daniel and I can both see workshop prep for Tuesday.",
        "2026-07-22T09:15:00Z",
      ),
      msg(
        "thread-group-college",
        "g2",
        ALEX_PROFILE.tutorId,
        ALEX_PROFILE.tutorName,
        "Thanks Reiss — Alex, bring the inspection sheet and we’ll mark after lunch.",
        "2026-07-22T09:28:00Z",
      ),
      msg(
        "thread-group-college",
        "g3",
        "contact-alex",
        ALEX_PROFILE.displayName,
        "Got it — sheet is on my phone and printed.",
        "2026-07-22T09:40:00Z",
      ),
    ],
  },
];

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
            ALEX_PROFILE.mentorId,
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
