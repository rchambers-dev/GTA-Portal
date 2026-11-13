export const TUTOR_REVIEW_TITLE = "Apprentice tutor review";

export const TUTOR_REVIEW_INTRO = "Think about your sessions with this tutor over the last four weeks.";

export const RATING_HELP = "Select one rating per statement. Leave blank if you have not experienced it.";

export const RATING_SCALE = [
  { value: 1, label: "Never" },
  { value: 2, label: "Rarely" },
  { value: 3, label: "Sometimes" },
  { value: 4, label: "Often" },
  { value: 5, label: "Always" },
] as const;

export type ReviewQuestionKind = "rating_1_5" | "text";

export type ReviewQuestionTemplate = {
  page: 1 | 2 | 3;
  position: number;
  code: string;
  text: string;
  help: string | null;
  kind: ReviewQuestionKind;
  isConcern: boolean;
};

export const PAGE_HEADINGS: Record<1 | 2 | 3, string | null> = {
  1: null,
  2: "Your teaching experience",
  3: "Your feedback",
};

const RATING = "rating_1_5" as const;
const TEXT = "text" as const;

export const TUTOR_REVIEW_QUESTIONS: ReviewQuestionTemplate[] = [
  { page: 1, position: 1, code: "01", kind: RATING, isConcern: false, help: RATING_HELP, text: "My tutor clearly explains what I need to do before I start a task." },
  { page: 1, position: 2, code: "02", kind: RATING, isConcern: false, help: RATING_HELP, text: "My tutor checks that I understand before moving on to a new topic." },
  { page: 1, position: 3, code: "03", kind: RATING, isConcern: false, help: RATING_HELP, text: "When I do not understand, my tutor explains things another way." },
  { page: 1, position: 4, code: "04", kind: RATING, isConcern: false, help: RATING_HELP, text: "When I ask a question, my tutor responds in a way that encourages me to ask again." },
  { page: 1, position: 5, code: "05", kind: RATING, isConcern: false, help: RATING_HELP, text: "My tutor gives me feedback that explains how to improve my work." },
  { page: 1, position: 6, code: "06", kind: RATING, isConcern: false, help: RATING_HELP, text: "My tutor has the materials we need ready when learning activities start." },
  { page: 2, position: 7, code: "07", kind: RATING, isConcern: false, help: RATING_HELP, text: "My tutor gives me opportunities to take part in learning activities." },
  { page: 2, position: 8, code: "08", kind: RATING, isConcern: false, help: RATING_HELP, text: "My tutor explains how the learning relates to tasks I do at work." },
  { page: 2, position: 9, code: "09", kind: RATING, isConcern: false, help: RATING_HELP, text: "When I can complete a task confidently, my tutor gives me work that develops my skills further." },
  { page: 2, position: 10, code: "10", kind: RATING, isConcern: false, help: RATING_HELP, text: "My tutor treats me respectfully." },
  { page: 2, position: 11, code: "11", kind: RATING, isConcern: false, help: RATING_HELP, text: "My tutor uses lesson time for activities that help me learn." },
  { page: 2, position: 12, code: "12", kind: RATING, isConcern: false, help: RATING_HELP, text: "When my tutor agrees to provide support, they follow through on it." },
  { page: 2, position: 13, code: "13", kind: RATING, isConcern: false, help: RATING_HELP, text: "My tutor explains what we should learn in each session." },
  { page: 2, position: 14, code: "14", kind: RATING, isConcern: false, help: RATING_HELP, text: "When I need help during a task, my tutor gives me support to continue." },
  { page: 2, position: 15, code: "15", kind: RATING, isConcern: false, help: RATING_HELP, text: "When behaviour interrupts learning, my tutor deals with it." },
  { page: 2, position: 16, code: "16", kind: RATING, isConcern: false, help: RATING_HELP, text: "My tutor explains which skills I need to work on next." },
  { page: 3, position: 17, code: "help", kind: TEXT, isConcern: false, help: null, text: "What does your tutor do that helps you learn?" },
  { page: 3, position: 18, code: "change", kind: TEXT, isConcern: false, help: null, text: "What one change would most improve your learning?" },
  {
    page: 3,
    position: 19,
    code: "concern",
    kind: TEXT,
    isConcern: true,
    help: "Describe any unhelpful or unproductive behaviour, anything you feel is inappropriate, and how it affects you or the class.",
    text: "Is there anything your tutor does in class that concerns you?",
  },
];

export const SEEDED_ROUNDS = [
  { label: "December 2026", opensOn: "2026-12-01", closesOn: "2026-12-19" },
  { label: "June 2027", opensOn: "2027-06-07", closesOn: "2027-06-25" },
] as const;
