export type ChatChannelType = "direct" | "employer" | "support" | "safeguarding";

export type ChatContactRole =
  | "mentor"
  | "tutor"
  | "employer"
  | "support"
  | "safeguarding"
  | "apprentice";

export type ChatContact = {
  contactId: string;
  name: string;
  initials: string;
  role: ChatContactRole;
  roleLabel: string;
  organisation?: string;
  /** Channel created when starting a chat with this contact */
  defaultChannel: ChatChannelType;
};

export type ChatGifAttachment = {
  type: "gif";
  url: string;
  previewUrl: string;
  title: string;
};

export type ChatImageAttachment = {
  type: "image";
  url: string;
  name: string;
};

export type ChatFileAttachment = {
  type: "file";
  name: string;
  sizeLabel: string;
};

/** Deep link into a portal screen / approval item. */
export type ChatPortalLinkAttachment = {
  type: "portal_link";
  href: string;
  title: string;
  detail: string;
  actionLabel: string;
  area: string;
};

export type ChatContactCardAttachment = {
  type: "contact";
  name: string;
  initials: string;
  roleLabel: string;
  organisation?: string;
};

export type ChatPollAttachment = {
  type: "poll";
  question: string;
  options: string[];
};

export type ChatEventAttachment = {
  type: "event";
  title: string;
  when: string;
  location?: string;
};

export type ChatAttachment =
  | ChatGifAttachment
  | ChatImageAttachment
  | ChatFileAttachment
  | ChatPortalLinkAttachment
  | ChatContactCardAttachment
  | ChatPollAttachment
  | ChatEventAttachment;

export type ChatMessage = {
  messageId: string;
  threadId: string;
  senderId: string;
  senderName: string;
  body: string;
  sentAt: string;
  /** Set when the sender edits the message. */
  editedAt?: string;
  attachment?: ChatAttachment;
};

export type ChatThread = {
  threadId: string;
  learnerId: string;
  channelType: ChatChannelType;
  title: string;
  participantIds: string[];
  privacyNote: string;
  lastMessageAt: string;
  unreadForLearner: number;
  messages: ChatMessage[];
};

export type ChatSendPayload = {
  body?: string;
  attachment?: ChatAttachment;
};

export function privacyNoteForChannel(channel: ChatChannelType): string {
  switch (channel) {
    case "direct":
      return "Only you and this person can read this conversation.";
    case "employer":
      return "You, your employer contact, and your progress mentor can read this conversation.";
    case "support":
      return "Only you and the GTA Support team can read this. Your mentor cannot see the contents.";
    case "safeguarding":
      return "Only you and the GTA Safeguarding team can read this. Your mentor and tutor cannot see the contents.";
  }
}
