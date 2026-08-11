/**
 * Controlled programme sessions (gta_programme_sessions).
 * SESSION = planned SOW learning event (S1). calendar_week ≠ planned session (H3).
 */

export type ProgrammeSessionRecord = {
  id: string;
  programmeVersionId: string;
  spineItemId: string | null;
  sessionKey: string;
  sequence: number;
  calendarWeek: number;
  sessionIndexInWeek: number;
  title: string;
  topic: string;
  foundationSkillCode: string | null;
  plannedOtjHours: number | null;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
};
