import { ALEX_PROFILE } from "../mock-learner";
import {
  privacyNoteForChannel,
  type ChatContact,
  type ChatMessage,
  type ChatThread,
} from "./types";

const LEARNER_ID = ALEX_PROFILE.learnerId;
const APPRENTICE: ChatContact = {
  contactId: "contact-alex",
  name: ALEX_PROFILE.displayName,
  initials: ALEX_PROFILE.initials,
  role: "apprentice",
  roleLabel: "You",
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
    contactId: "contact-employer-priya",
    name: ALEX_PROFILE.employerContact,
    initials: "PS",
    role: "employer",
    roleLabel: "Employer contact",
    organisation: ALEX_PROFILE.employerName,
    defaultChannel: "employer",
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
    learnerId: LEARNER_ID,
    channelType: "direct",
    title: ALEX_PROFILE.mentorName,
    participantIds: ["contact-alex", ALEX_PROFILE.mentorId],
    privacyNote: privacyNoteForChannel("direct"),
    lastMessageAt: "2026-07-21T14:20:00Z",
    unreadForLearner: 1,
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
    learnerId: LEARNER_ID,
    channelType: "direct",
    title: ALEX_PROFILE.tutorName,
    participantIds: ["contact-alex", ALEX_PROFILE.tutorId],
    privacyNote: privacyNoteForChannel("direct"),
    lastMessageAt: "2026-07-18T16:05:00Z",
    unreadForLearner: 0,
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
    learnerId: LEARNER_ID,
    channelType: "employer",
    title: `${ALEX_PROFILE.employerContact} · ${ALEX_PROFILE.employerName}`,
    participantIds: [
      "contact-alex",
      "contact-employer-priya",
      ALEX_PROFILE.mentorId,
    ],
    privacyNote: privacyNoteForChannel("employer"),
    lastMessageAt: "2026-07-19T10:30:00Z",
    unreadForLearner: 2,
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
    ],
  },
  {
    threadId: "thread-support",
    learnerId: LEARNER_ID,
    channelType: "support",
    title: "GTA Support",
    participantIds: ["contact-alex", "contact-support-gta"],
    privacyNote: privacyNoteForChannel("support"),
    lastMessageAt: "2026-07-05T12:00:00Z",
    unreadForLearner: 0,
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
];

export function contactsForLearner(): ChatContact[] {
  return CHAT_CONTACTS.filter((c) => c.role !== "apprentice");
}

export function getContact(contactId: string): ChatContact | undefined {
  return CHAT_CONTACTS.find((c) => c.contactId === contactId);
}

export function listThreads(): ChatThread[] {
  return [...THREADS].sort((a, b) =>
    b.lastMessageAt.localeCompare(a.lastMessageAt),
  );
}

export function getThread(threadId: string): ChatThread | undefined {
  return THREADS.find((t) => t.threadId === threadId);
}

export function unreadTotal(): number {
  return THREADS.reduce((sum, t) => sum + t.unreadForLearner, 0);
}

export function markThreadRead(threadId: string): void {
  THREADS = THREADS.map((t) =>
    t.threadId === threadId ? { ...t, unreadForLearner: 0 } : t,
  );
}

export function sendMessage(threadId: string, body: string): ChatMessage | null {
  const text = body.trim();
  if (!text) return null;
  const thread = THREADS.find((t) => t.threadId === threadId);
  if (!thread) return null;

  const message: ChatMessage = {
    messageId: `msg-${Date.now().toString(36)}`,
    threadId,
    senderId: "contact-alex",
    senderName: ALEX_PROFILE.displayName,
    body: text,
    sentAt: new Date().toISOString(),
  };

  THREADS = THREADS.map((t) =>
    t.threadId === threadId
      ? {
          ...t,
          messages: [...t.messages, message],
          lastMessageAt: message.sentAt,
          unreadForLearner: 0,
        }
      : t,
  );

  return message;
}

export function ensureThreadWithContact(contactId: string): ChatThread {
  const contact = getContact(contactId);
  if (!contact) throw new Error(`Unknown contact ${contactId}`);

  const existing = THREADS.find(
    (t) =>
      t.participantIds.includes(contactId) &&
      t.channelType === contact.defaultChannel,
  );
  if (existing) return existing;

  const participantIds =
    contact.defaultChannel === "employer"
      ? ["contact-alex", contactId, ALEX_PROFILE.mentorId]
      : ["contact-alex", contactId];

  const thread: ChatThread = {
    threadId: `thread-new-${contactId}`,
    learnerId: LEARNER_ID,
    channelType: contact.defaultChannel,
    title:
      contact.defaultChannel === "employer"
        ? `${contact.name} · ${contact.organisation ?? "Employer"}`
        : contact.name,
    participantIds,
    privacyNote: privacyNoteForChannel(contact.defaultChannel),
    lastMessageAt: new Date().toISOString(),
    unreadForLearner: 0,
    messages: [],
  };

  THREADS = [thread, ...THREADS];
  return thread;
}
