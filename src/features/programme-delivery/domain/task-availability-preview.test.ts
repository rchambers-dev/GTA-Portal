import { describe, expect, it } from "vitest";
import { previewTaskAvailability } from "./task-availability-preview";
import type { ProgrammeSessionRecord } from "@/features/programme-definition/domain/programme-sessions";

const block1 = {
  spineItemId: "block-1",
  blockOrdinal: 1,
  weekStart: 1,
  title: "Foundation",
};
const block2 = {
  spineItemId: "block-2",
  blockOrdinal: 2,
  weekStart: 11,
  title: "Block 2",
};

const sessions: ProgrammeSessionRecord[] = [
  {
    id: "s-w005",
    programmeVersionId: "pv",
    spineItemId: "block-1",
    sessionKey: "W005",
    sequence: 5,
    calendarWeek: 5,
    sessionIndexInWeek: 1,
    title: "FS05",
    topic: "FS05",
    foundationSkillCode: "FS05",
    plannedOtjHours: null,
    publishStatus: "draft",
    learningObjectivesReview: { status: "empty" },
    learnerFacingContent: { status: "empty", candidate: null, approved: null },
    metadata: {},
    createdAt: "",
    updatedAt: "",
  },
];

describe("previewTaskAvailability", () => {
  it("marks next block not available before weekStart without override (S4)", () => {
    const rows = previewTaskAvailability({
      programmeWeek: 5,
      blocks: [block1, block2],
      sessions,
      tasks: [
        {
          id: "t-b2",
          title: "B2 T1",
          taskNumber: 1,
          blockOrdinal: 2,
          spineItemId: "block-2",
          publishStatus: "draft",
        },
      ],
      links: [],
    });
    expect(rows[0]?.status).toBe("NOT_AVAILABLE");
    expect(rows[0]?.openable).toBe(false);
  });

  it("does not invent auto-unlock from reflection — only manual block override", () => {
    const rows = previewTaskAvailability({
      programmeWeek: 5,
      blocks: [block1, block2],
      sessions,
      tasks: [
        {
          id: "t-b2",
          title: "B2 T1",
          taskNumber: 1,
          blockOrdinal: 2,
          spineItemId: "block-2",
          publishStatus: "published",
        },
      ],
      links: [],
      manuallyUnlockedBlockIds: ["block-2"],
    });
    expect(rows[0]?.openable).toBe(true);
    expect(rows[0]?.status).toBe("AVAILABLE");
  });

  it("keeps task Coming up until earliest session week is reached", () => {
    const rows = previewTaskAvailability({
      programmeWeek: 3,
      blocks: [block1],
      sessions,
      tasks: [
        {
          id: "t1",
          title: "Knowledge",
          taskNumber: 1,
          blockOrdinal: 1,
          spineItemId: "block-1",
          publishStatus: "draft",
          releaseMode: "session",
        },
      ],
      links: [
        {
          id: "l1",
          programmeVersionId: "pv",
          taskId: "t1",
          sessionId: "s-w005",
          linkType: "earliest_available_after",
          createdAt: "",
          updatedAt: "",
        },
      ],
    });
    expect(rows[0]?.status).toBe("COMING_UP");
    expect(rows[0]?.openable).toBe(false);
  });

  it("opens task when earliest session week reached", () => {
    const rows = previewTaskAvailability({
      programmeWeek: 5,
      blocks: [block1],
      sessions,
      tasks: [
        {
          id: "t1",
          title: "Knowledge",
          taskNumber: 1,
          blockOrdinal: 1,
          spineItemId: "block-1",
          publishStatus: "draft",
        },
      ],
      links: [
        {
          id: "l1",
          programmeVersionId: "pv",
          taskId: "t1",
          sessionId: "s-w005",
          linkType: "earliest_available_after",
          createdAt: "",
          updatedAt: "",
        },
      ],
    });
    expect(rows[0]?.status).toBe("AVAILABLE");
    expect(rows[0]?.openable).toBe(true);
  });

  it("null earliest link → available when block open", () => {
    const rows = previewTaskAvailability({
      programmeWeek: 2,
      blocks: [block1],
      sessions,
      tasks: [
        {
          id: "t2",
          title: "Job card",
          taskNumber: 2,
          blockOrdinal: 1,
          spineItemId: "block-1",
          publishStatus: "draft",
        },
      ],
      links: [],
    });
    expect(rows[0]?.openable).toBe(true);
  });
});
