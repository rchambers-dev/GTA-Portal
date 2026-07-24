export type ChatChannelType = "direct" | "employer" | "support";

export type ChatContactRole =
  | "mentor"
  | "tutor"
  | "employer"
  | "support"
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

export type ChatMessage = {
  messageId: string;
  threadId: string;
  senderId: string;
  senderName: string;
  body: string;
  sentAt: string;
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

export function privacyNoteForChannel(channel: ChatChannelType): string {
  switch (channel) {
    case "direct":
      return "Only you and this person can read this conversation.";
    case "employer":
      return "You, your employer contact, and your progress mentor can read this conversation.";
    case "support":
      return "Only you and the GTA Support team can read this. Your mentor cannot see the contents.";
  }
}
