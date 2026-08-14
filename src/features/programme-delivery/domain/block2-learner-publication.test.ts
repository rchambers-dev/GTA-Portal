import { describe, expect, it } from "vitest";
import type { ProgrammeSessionRecord } from "@/features/programme-definition/domain/programme-sessions";
import approvedCopy from "@/features/programme-definition/data/block2-approved-learner-copy.json";
import {
  LEARNER_BLOCK_LOCKED,
  LEARNER_CONTENT_PENDING,
} from "@/features/programme-definition/domain/learner-facing-content";
import {
  BLOCK2_SESSION_IS_NOT_TASK,
  CONTROLLED_TASK_AVAILABILITY_LABEL,
  comingUpTaskRow,
  resolveApprenticeSessionAccess,
  sessionCompletionCompletesTask,
  type ApprenticeLearningBlock,
} from "./apprentice-learning";
import { isDeliveryBlockUnlocked } from "./delivery-unlock";
import type { DeliveryBlockView } from "./published-delivery-catalogue";
import {
  includesTutorLessonPlan,
  toLearnerSessionView,
} from "./learner-session-view";
import {
  assertNoTutorOnlyLeak,
  filterLearnerVisibleAttachments,
  learnerVisibleResourcesForSession,
} from "./learner-session-materials";
import type {
  ProgrammeResourceAttachmentRecord,
  ProgrammeResourceRecord,
} from "@/features/programme-definition/domain/programme-resources";
import { assignSessionLaneStatuses } from "./session-lane";

const BLOCK2_KEYS = [
  "W011",
  "W012",
  "W013",
  "W014",
  "W015",
  "W016",
  "W017",
  "W018",
  "W019",
  "W020",
] as const;

const CANDIDATE_LEAK = "CANDIDATE FROM SOURCE — stay professional under pressure";

function block2Session(
  key: (typeof BLOCK2_KEYS)[number],
  status: "candidate_for_review" | "approved_published",
): ProgrammeSessionRecord {
  const copy = approvedCopy[key];
  const week = Number(key.slice(1));
  return {
    id: `sess-${key.toLowerCase()}`,
    programmeVersionId: "pv",
    spineItemId: "b2",
    sessionKey: key,
    sequence: week,
    calendarWeek: week,
    sessionIndexInWeek: 1,
    title:
      key === "W013"
        ? "Engine Repairs"
        : key === "W017"
          ? "Advanced Brake Diagnostics"
          : key === "W018"
            ? "Wheel Alignment - Advanced"
            : copy.summary,
    topic: copy.summary,
    foundationSkillCode: null,
    plannedOtjHours: null,
    publishStatus: "published",
    learningObjectivesReview: {
      status: "candidate_for_review",
      lessonAims: ["Internal source aim — must not leak"],
      byTheEnd: ["Hidden candidate aim"],
      sourceLabel: copy.sourceLabel,
    },
    learnerFacingContent: {
      status,
      candidate: {
        summary: "Candidate only",
        learningContent: CANDIDATE_LEAK,
        activityPractice: "Candidate activity — Task 3/4/5 must not leak",
        sourceLabel: copy.sourceLabel,
      },
      approved:
        status === "approved_published"
          ? {
              ...copy,
              approvedAt: "2026-08-13T20:00:00.000Z",
              approvedByName: "Curriculum owner",
            }
          : null,
    },
    metadata: { note: "internal authoring" },
    createdAt: "",
    updatedAt: "",
  };
}

const block1: DeliveryBlockView = {
  spineItemId: "b1",
  title: "Block 1",
  sequence: 1,
  displayOrdinal: 1,
  plannedOtjHours: 45,
  weekStart: 1,
  weekEnd: 10,
};
const block2: DeliveryBlockView = {
  spineItemId: "b2",
  title: "Block 2",
  sequence: 2,
  displayOrdinal: 2,
  plannedOtjHours: 45,
  weekStart: 11,
  weekEnd: 20,
};
const block3: DeliveryBlockView = {
  spineItemId: "b3",
  title: "Block 3",
  sequence: 3,
  displayOrdinal: 3,
  plannedOtjHours: 45,
  weekStart: 21,
  weekEnd: 30,
};

describe("Block 2 approved learner publication", () => {
  it("returns approved learner copy for W011–W020 and hides candidate/internal fields", () => {
    for (const key of BLOCK2_KEYS) {
      const copy = approvedCopy[key];
      const view = toLearnerSessionView({
        session: block2Session(key, "approved_published"),
        status: "upcoming",
        delivery: null,
        learnerResources: [],
      });
      const json = JSON.stringify(view);
      expect(view.hasApprovedLearning).toBe(true);
      expect(view.title).toBe(copy.summary);
      expect(view.learningInformation).toBe(copy.learningContent);
      expect(view.activityPractice).toBe(copy.activityPractice);
      expect(view.materials).toEqual([]);
      expect(json).not.toMatch(/candidate_for_review/);
      expect(json).not.toMatch(/CANDIDATE FROM SOURCE/);
      expect(json).not.toMatch(/under pressure/i);
      expect(json).not.toMatch(/publishStatus/);
      expect(json).not.toMatch(/authoring/);
      expect(json).not.toMatch(/approvedByName/);
    }
  });

  it("does not expose candidate copy before approval", () => {
    const view = toLearnerSessionView({
      session: block2Session("W011", "candidate_for_review"),
      status: "upcoming",
      delivery: null,
      learnerResources: [],
    });
    expect(view.learningInformation).toBe(LEARNER_CONTENT_PENDING);
    expect(JSON.stringify(view)).not.toMatch(/under pressure/i);
    expect(JSON.stringify(view)).not.toMatch(/CANDIDATE FROM SOURCE/);
  });

  it("applies the reviewed W011–W020 wording/scope corrections", () => {
    const w011 = toLearnerSessionView({
      session: block2Session("W011", "approved_published"),
      status: "upcoming",
      delivery: null,
      learnerResources: [],
    });
    expect(w011.learningInformation).toContain(
      "what the workshop can and cannot do, so expectations stay realistic",
    );
    expect(w011.learningInformation).not.toMatch(/under pressure/i);

    const w012 = toLearnerSessionView({
      session: block2Session("W012", "approved_published"),
      status: "upcoming",
      delivery: null,
      learnerResources: [],
    });
    expect(w012.title).toBe(
      "Electrical system inspection — battery, charging and starting.",
    );
    expect(w012.activityPractice).toMatch(/After your tutor shows how to use the meter/);
    expect(w012.activityPractice).toMatch(/It is not Task 3/);
    expect(w012.activityPractice).not.toMatch(/independent diagnosis/i);

    const w013 = toLearnerSessionView({
      session: block2Session("W013", "approved_published"),
      status: "upcoming",
      delivery: null,
      learnerResources: [],
    });
    expect(w013.title).toBe("Engine components, inspection and fault scenarios.");
    expect(w013.title).not.toBe("Engine Repairs");
    expect(w013.activityPractice).toMatch(
      /You are not carrying out an independent engine repair/,
    );

    const w014 = toLearnerSessionView({
      session: block2Session("W014", "approved_published"),
      status: "upcoming",
      delivery: null,
      learnerResources: [],
    });
    expect(w014.activityPractice).toMatch(/watch your tutor demonstrate/);
    expect(w014.activityPractice).toMatch(/does not complete Task 4/);

    const w016 = toLearnerSessionView({
      session: block2Session("W016", "approved_published"),
      status: "upcoming",
      delivery: null,
      learnerResources: [],
    });
    expect(w016.activityPractice).toMatch(
      /not the Block 2 Employer Job Card \(Task 2\)/,
    );

    const w017 = toLearnerSessionView({
      session: block2Session("W017", "approved_published"),
      status: "upcoming",
      delivery: null,
      learnerResources: [],
    });
    expect(w017.activityPractice).toMatch(/identify ABS components/);
    expect(w017.activityPractice).toMatch(/suggest possible causes/);
    expect(w017.activityPractice).toMatch(/not independent ABS repair/);

    const w018 = toLearnerSessionView({
      session: block2Session("W018", "approved_published"),
      status: "upcoming",
      delivery: null,
      learnerResources: [],
    });
    expect(w018.activityPractice).toMatch(/You will not set alignment independently/);

    const w020 = toLearnerSessionView({
      session: block2Session("W020", "approved_published"),
      status: "upcoming",
      delivery: null,
      learnerResources: [],
    });
    expect(w020.activityPractice).toMatch(/Block Reflection \(Task 5\)/);
    expect(w020.activityPractice).toMatch(
      /Learning Impact Record are separate forms/,
    );
    expect(w020.activityPractice).toMatch(/does not unlock the next Block/);
  });

  it("keeps tutor lesson plans and tutor-only PowerPoints out of apprentice materials", () => {
    const tutorLp: ProgrammeResourceRecord = {
      id: "r-lp",
      programmeVersionId: "pv",
      resourceKey: "res_lp_16fe848ac370",
      title: "Week 11 lesson plan — Customer Service Scenarios (v4.4)",
      filename: "Autocare_L2_Week_011_Lesson_Plan_v4.4.docx",
      sourcePath: "",
      evidenceResourceId: "res_lp_16fe848ac370",
      extractPath: "",
      metadata: {},
      createdAt: "",
      updatedAt: "",
    };
    const tutorPpt: ProgrammeResourceRecord = {
      ...tutorLp,
      id: "r-ppt",
      resourceKey: "ppt-unplaced",
      title: "Unplaced Block 2 teaching PowerPoint",
      filename: "Block2_Teaching.ppt",
    };
    const tutorAtt: ProgrammeResourceAttachmentRecord = {
      id: "a-lp",
      programmeVersionId: "pv",
      resourceId: "r-lp",
      sessionId: "sess-w011",
      spineItemId: "b2",
      role: "TUTOR_DELIVERY",
      audience: "TUTOR_ONLY",
      sortOrder: 10,
      metadata: {},
      createdAt: "",
      updatedAt: "",
    };
    const pptAtt: ProgrammeResourceAttachmentRecord = {
      ...tutorAtt,
      id: "a-ppt",
      resourceId: "r-ppt",
    };

    const visible = filterLearnerVisibleAttachments([tutorAtt, pptAtt]);
    expect(visible).toEqual([]);
    expect(assertNoTutorOnlyLeak([tutorAtt, pptAtt]).ok).toBe(false);

    const learnerResources = learnerVisibleResourcesForSession({
      attachments: [tutorAtt, pptAtt],
      resources: [tutorLp, tutorPpt],
      sessionId: "sess-w011",
    });
    const view = toLearnerSessionView({
      session: block2Session("W011", "approved_published"),
      status: "upcoming",
      delivery: null,
      learnerResources,
    });
    expect(view.materials).toEqual([]);
    expect(includesTutorLessonPlan(view.materials)).toBe(false);
    expect(
      includesTutorLessonPlan([
        { title: tutorLp.title, filename: tutorLp.filename },
        { title: tutorPpt.title, filename: tutorPpt.filename },
      ]),
    ).toBe(true);
  });

  it("does not treat W012/W014/W016/W020 Session completion as Task 3/4/2/5 completion", () => {
    const lane = assignSessionLaneStatuses(
      BLOCK2_KEYS.map((key) => ({ id: `sess-${key.toLowerCase()}`, key })),
      new Set(["sess-w012", "sess-w014", "sess-w016", "sess-w020"]),
    );
    expect(lane.find((r) => r.session.key === "W012")?.status).toBe("completed");
    expect(lane.find((r) => r.session.key === "W014")?.status).toBe("completed");
    expect(lane.find((r) => r.session.key === "W016")?.status).toBe("completed");
    expect(lane.find((r) => r.session.key === "W020")?.status).toBe("completed");

    const tasks = [2, 3, 4, 5].map((taskNumber) =>
      comingUpTaskRow({
        id: `b2-t${taskNumber}`,
        taskKey: `b2-t${taskNumber}`,
        spineItemId: "b2",
        blockOrdinal: 2,
        taskNumber,
        kind: taskNumber === 5 ? "reflection" : "practical",
        title: `Block 2 Task ${taskNumber}`,
      }),
    );
    for (const pair of BLOCK2_SESSION_IS_NOT_TASK) {
      expect(sessionCompletionCompletesTask(pair.sessionKey, pair.taskNumber)).toBe(
        false,
      );
      const task = tasks.find((t) => t.taskNumber === pair.taskNumber);
      expect(task?.availabilityLabel).toBe(CONTROLLED_TASK_AVAILABILITY_LABEL);
      expect(task?.openable).toBe(false);
    }
  });

  it("does not expose approved Block 2 copy while the Block is calendar-locked", () => {
    const sessions = BLOCK2_KEYS.map((key) =>
      toLearnerSessionView({
        session: block2Session(key, "approved_published"),
        status: "upcoming",
        delivery: null,
        learnerResources: [],
        blockUnlocked: false,
      }),
    );
    const block: ApprenticeLearningBlock = {
      spineItemId: "b2",
      title: "Block 2",
      displayTitle: "Block 2",
      displayOrdinal: 2,
      weekStart: 11,
      weekEnd: 20,
      plannedOtjHours: 45,
      unlocked: false,
      sessions,
      tasks: [],
    };
    for (const key of BLOCK2_KEYS) {
      const copy = approvedCopy[key];
      const view = sessions.find((s) => s.sessionKey === key)!;
      expect(view.title).toBe(copy.summary);
      expect(view.openable).toBe(false);
      expect(view.learningInformation).toBe(LEARNER_BLOCK_LOCKED);
      expect(view.learningInformation).not.toBe(copy.learningContent);
      expect(view.activityPractice).not.toBe(copy.activityPractice);
      expect(
        resolveApprenticeSessionAccess([block], view.id).status,
      ).toBe("locked");
    }
  });

  it("does not unlock Block 3 when W020 is complete or Task 5 would be verified (S4)", () => {
    expect(
      isDeliveryBlockUnlocked({
        block: block3,
        blocks: [block1, block2, block3],
        programmeWeek: 3,
      }),
    ).toBe(false);
    expect(
      isDeliveryBlockUnlocked({
        block: block3,
        blocks: [block1, block2, block3],
        programmeWeek: 20,
      }),
    ).toBe(false);
    expect(sessionCompletionCompletesTask("W020", 5)).toBe(false);
  });
});
