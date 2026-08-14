import { describe, expect, it } from "vitest";
import {
  assertNoTutorOnlyLeak,
  filterLearnerVisibleAttachments,
  learnerVisibleResourcesForSession,
} from "./learner-session-materials";
import type {
  ProgrammeResourceAttachmentRecord,
  ProgrammeResourceRecord,
} from "@/features/programme-definition/domain/programme-resources";

const tutorAtt: ProgrammeResourceAttachmentRecord = {
  id: "a1",
  programmeVersionId: "pv",
  resourceId: "r-tutor",
  sessionId: "s1",
  spineItemId: "b1",
  role: "TUTOR_DELIVERY",
  audience: "TUTOR_ONLY",
  sortOrder: 1,
  metadata: {},
  createdAt: "",
  updatedAt: "",
};

const learnerAtt: ProgrammeResourceAttachmentRecord = {
  id: "a2",
  programmeVersionId: "pv",
  resourceId: "r-learn",
  sessionId: "s1",
  spineItemId: "b1",
  role: "LEARNER_LEARNING",
  audience: "LEARNER_VISIBLE",
  sortOrder: 2,
  metadata: {},
  createdAt: "",
  updatedAt: "",
};

const resources: ProgrammeResourceRecord[] = [
  {
    id: "r-tutor",
    programmeVersionId: "pv",
    resourceKey: "tutor",
    title: "FS01 lesson plan",
    filename: "lp.docx",
    sourcePath: "",
    evidenceResourceId: "",
    extractPath: "",
    metadata: {},
    createdAt: "",
    updatedAt: "",
  },
  {
    id: "r-learn",
    programmeVersionId: "pv",
    resourceKey: "learn",
    title: "TEST learner fixture",
    filename: "handout.txt",
    sourcePath: "",
    evidenceResourceId: "",
    extractPath: "",
    metadata: {},
    createdAt: "",
    updatedAt: "",
  },
];

describe("learner session materials filter", () => {
  it("excludes tutor-only attachments", () => {
    const visible = filterLearnerVisibleAttachments([tutorAtt, learnerAtt]);
    expect(visible).toHaveLength(1);
    expect(visible[0]!.resourceId).toBe("r-learn");
    expect(assertNoTutorOnlyLeak(visible).ok).toBe(true);
  });

  it("never returns FS tutor lesson plan for learner session view", () => {
    const list = learnerVisibleResourcesForSession({
      attachments: [tutorAtt, learnerAtt],
      resources,
      sessionId: "s1",
    });
    expect(list.map((r) => r.id)).toEqual(["r-learn"]);
    expect(list.some((r) => r.title.includes("lesson plan"))).toBe(false);
  });

  it("never returns a tutor-only teaching PowerPoint to the learner session", () => {
    const pptAtt: ProgrammeResourceAttachmentRecord = {
      ...tutorAtt,
      id: "a-ppt",
      resourceId: "r-ppt",
    };
    const pptResource: ProgrammeResourceRecord = {
      ...resources[0]!,
      id: "r-ppt",
      resourceKey: "res_lm_b956dd2a0014_1",
      title: "Features of Hybrid Vehicles",
      filename: "Features of Hybrid Vehicles.ppt",
    };
    const list = learnerVisibleResourcesForSession({
      attachments: [pptAtt, learnerAtt],
      resources: [...resources, pptResource],
      sessionId: "s1",
    });
    expect(list.map((r) => r.id)).toEqual(["r-learn"]);
    expect(list.some((r) => /\.ppt$/i.test(r.filename))).toBe(false);
    expect(assertNoTutorOnlyLeak([pptAtt]).ok).toBe(false);
  });

  it("returns a LEARNER_VISIBLE PowerPoint for the learner session", () => {
    const pptAtt: ProgrammeResourceAttachmentRecord = {
      ...learnerAtt,
      id: "a-ppt-learn",
      resourceId: "r-ppt-learn",
      role: "LEARNER_LEARNING",
      audience: "LEARNER_VISIBLE",
    };
    const pptResource: ProgrammeResourceRecord = {
      ...resources[1]!,
      id: "r-ppt-learn",
      resourceKey: "test_w003_learner_pptx",
      title: "TEST learner presentation — Hybrid awareness (SAFE DEMO)",
      filename: "TEST_W003_learner_presentation.pptx",
    };
    const list = learnerVisibleResourcesForSession({
      attachments: [tutorAtt, pptAtt],
      resources: [...resources, pptResource],
      sessionId: "s1",
    });
    expect(list.map((r) => r.id)).toEqual(["r-ppt-learn"]);
    expect(list[0]?.filename).toMatch(/\.pptx$/i);
  });
});
