import { beforeEach, describe, expect, it, vi } from "vitest";
import { buildEffectiveSession } from "@/lib/permissions/effective-permissions";
import type { PortalAccount } from "@/lib/portal/types";
import { LEARNER_TUTOR_ONLY_RESOURCE_ERROR } from "@/features/programme-delivery/domain/learner-resource-access";
import { LEARNER_SESSION_LOCKED_ERROR } from "@/features/programme-definition/domain/learner-facing-content";

const getEffectiveSession = vi.fn();
const loadApprenticeLearningJourney = vi.fn();
const listProgrammeResourcesForVersion = vi.fn();
const listResourceAttachmentsForVersion = vi.fn();
const getResourceBinary = vi.fn();
const readResourceBinaryBytes = vi.fn();

vi.mock("@/adapters/standalone", () => ({
  getStandalonePorts: () => ({
    auth: { getEffectiveSession: () => getEffectiveSession() },
  }),
}));

vi.mock("@/adapters/supabase/client", () => ({
  createSupabaseAdminClient: vi.fn(() => ({
    from: () => ({
      select: () => ({
        eq: () => ({
          eq: () => ({
            maybeSingle: async () => ({
              data: { id: "res-tutor", filename: "Features of Hybrid Vehicles.ppt" },
              error: null,
            }),
          }),
        }),
      }),
    }),
  })),
}));

vi.mock("@/features/programme-delivery/domain/apprentice-learning-repository", () => ({
  loadApprenticeLearningJourney: (...args: unknown[]) =>
    loadApprenticeLearningJourney(...args),
}));

vi.mock("@/features/programme-definition/domain/programme-resources-repository", () => ({
  listProgrammeResourcesForVersion: (...args: unknown[]) =>
    listProgrammeResourcesForVersion(...args),
  listResourceAttachmentsForVersion: (...args: unknown[]) =>
    listResourceAttachmentsForVersion(...args),
}));

vi.mock("@/features/programme-definition/domain/programme-resource-binaries-repository", () => ({
  getResourceBinary: (...args: unknown[]) => getResourceBinary(...args),
}));

vi.mock("@/features/programme-definition/domain/resource-binary-storage", () => ({
  readResourceBinaryBytes: (...args: unknown[]) => readResourceBinaryBytes(...args),
}));

function account(input: {
  workspace: PortalAccount["workspace"];
  permissions: string[];
  baseRole?: string;
  linkedApprenticeId?: string | null;
}): PortalAccount {
  return {
    id: input.workspace === "apprentice" ? "apprentice-1" : "staff-1",
    name: "Test",
    initials: "T",
    email: "test@example.invalid",
    baseRole: input.baseRole || "Staff",
    responsibilities: [],
    workspace: input.workspace,
    permissions: input.permissions,
    linkedApprenticeId: input.linkedApprenticeId ?? null,
  };
}

const tutorSession = buildEffectiveSession(
  account({
    workspace: "staff",
    baseRole: "Tutor",
    permissions: ["staff.workspace.view", "modules.deliver"],
  }),
  [],
);

const apprenticeSession = buildEffectiveSession(
  account({
    workspace: "apprentice",
    baseRole: "Apprentice",
    permissions: ["apprentice.workspace.own", "apprentice.modules.view"],
    linkedApprenticeId: "ea587505-487a-4b81-aeec-963cda86e47d",
  }),
  [],
);

const otherApprenticeSession = buildEffectiveSession(
  account({
    workspace: "apprentice",
    baseRole: "Apprentice",
    permissions: ["apprentice.workspace.own", "apprentice.modules.view"],
    linkedApprenticeId: "other-apprentice-id",
  }),
  [],
);

const tutorResource = {
  id: "res-tutor",
  title: "Features of Hybrid Vehicles",
  filename: "Features of Hybrid Vehicles.ppt",
};

const learnerResource = {
  id: "res-learner",
  title: "TEST learner presentation — Hybrid awareness (SAFE DEMO)",
  filename: "TEST_W003_learner_presentation.pptx",
};

const binary = {
  id: "bin-1",
  resourceId: "res-tutor",
  programmeVersionId: "pv",
  originalFilename: "Features of Hybrid Vehicles.ppt",
  mimeType: "application/vnd.ms-powerpoint",
  sizeBytes: 12,
  sha256: "abc",
  storageBucket: "local-uploads",
  storagePath: "pv/res-tutor/file.ppt",
  sourceArchive: "zip",
  sourcePath: "G02/Features of Hybrid Vehicles.ppt",
  sourceGroupCode: "G02",
  sourceGroupFolder: "G02 Electric Hybrid Awareness",
  versionReview: "SAME",
  metadata: {},
  createdAt: "",
  updatedAt: "",
};

function openSessionView(id: string) {
  return {
    id,
    sessionKey: "W003",
    title: "Hybrid",
    codesLine: "W003",
    foundationSkillCode: "FS03",
    calendarWeek: 3,
    status: "available",
    statusLabel: "Available",
    releasedAt: "2026-08-14T10:00:00.000Z",
    learningInformation: "copy",
    activityPractice: "activity",
    hasApprovedLearning: true,
    materials: [],
    reviewLearning: true,
    openable: true,
  };
}

function lockedSessionView(id: string) {
  return { ...openSessionView(id), openable: false, status: "coming_up" };
}

function journey(
  sessions: unknown[],
  unlocked = true,
) {
  return {
    programmeVersionId: "pv",
    isTest: true,
    blocks: [
      {
        spineItemId: "b1",
        title: "Block 1",
        displayTitle: "Block 1",
        displayOrdinal: 1,
        weekStart: 1,
        weekEnd: 10,
        plannedOtjHours: 45,
        unlocked,
        sessions,
        tasks: [],
      },
    ],
  };
}

function att(resourceId: string, audience: "TUTOR_ONLY" | "LEARNER_VISIBLE") {
  return {
    id: `a-${resourceId}`,
    programmeVersionId: "pv",
    resourceId,
    sessionId: "sess-w003",
    spineItemId: "b1",
    role: audience === "LEARNER_VISIBLE" ? "LEARNER_LEARNING" : "TUTOR_DELIVERY",
    audience,
    sortOrder: 10,
    metadata: {},
    createdAt: "",
    updatedAt: "",
  };
}

describe("original binary access", () => {
  beforeEach(() => {
    getEffectiveSession.mockReset();
    loadApprenticeLearningJourney.mockReset();
    listProgrammeResourcesForVersion.mockReset();
    listResourceAttachmentsForVersion.mockReset();
    getResourceBinary.mockReset();
    readResourceBinaryBytes.mockReset();
    getResourceBinary.mockResolvedValue(binary);
    readResourceBinaryBytes.mockResolvedValue(Buffer.from("PPTBYTES"));
    vi.resetModules();
  });

  it("tutor can retrieve a Tutor only binary", async () => {
    getEffectiveSession.mockResolvedValue(tutorSession);
    const { GET } = await import("./resources/[resourceId]/file/route");
    const res = await GET(
      new Request(
        "http://localhost/api/delivery/resources/res-tutor/file?programmeVersionId=pv",
      ),
      { params: Promise.resolve({ resourceId: "res-tutor" }) },
    );
    expect(res.status).toBe(200);
    expect(res.headers.get("content-disposition")).toMatch(/^attachment;/);
    expect(res.headers.get("cache-control")).toContain("private");
    const bytes = Buffer.from(await res.arrayBuffer());
    expect(bytes.toString()).toBe("PPTBYTES");
  });

  it("apprentice is denied a Tutor only binary even when it exists", async () => {
    getEffectiveSession.mockResolvedValue(apprenticeSession);
    loadApprenticeLearningJourney.mockResolvedValue(
      journey([openSessionView("sess-w003")]),
    );
    listProgrammeResourcesForVersion.mockResolvedValue([tutorResource]);
    listResourceAttachmentsForVersion.mockResolvedValue([
      att("res-tutor", "TUTOR_ONLY"),
    ]);
    const { GET } = await import(
      "../apprentice/learning/resources/[resourceId]/file/route"
    );
    const res = await GET(
      new Request("http://localhost/api/apprentice/learning/resources/res-tutor/file"),
      { params: Promise.resolve({ resourceId: "res-tutor" }) },
    );
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toBe(LEARNER_TUTOR_ONLY_RESOURCE_ERROR);
    expect(readResourceBinaryBytes).not.toHaveBeenCalled();
  });

  it("SAFE TEST apprentice can retrieve a learner-visible binary when released and Block is open", async () => {
    getEffectiveSession.mockResolvedValue(apprenticeSession);
    loadApprenticeLearningJourney.mockResolvedValue({
      ...journey([openSessionView("sess-w003")]),
      isTest: true,
    });
    listProgrammeResourcesForVersion.mockResolvedValue([learnerResource]);
    listResourceAttachmentsForVersion.mockResolvedValue([
      att("res-learner", "LEARNER_VISIBLE"),
    ]);
    getResourceBinary.mockResolvedValue({
      ...binary,
      resourceId: "res-learner",
      originalFilename: learnerResource.filename,
    });
    const { GET } = await import(
      "../apprentice/learning/resources/[resourceId]/file/route"
    );
    const res = await GET(
      new Request(
        "http://localhost/api/apprentice/learning/resources/res-learner/file",
      ),
      { params: Promise.resolve({ resourceId: "res-learner" }) },
    );
    expect(res.status).toBe(200);
    expect(readResourceBinaryBytes).toHaveBeenCalled();
  });

  it("denies a learner-visible binary when the Session is unreleased", async () => {
    getEffectiveSession.mockResolvedValue(apprenticeSession);
    loadApprenticeLearningJourney.mockResolvedValue(
      journey([lockedSessionView("sess-w003")]),
    );
    listProgrammeResourcesForVersion.mockResolvedValue([learnerResource]);
    listResourceAttachmentsForVersion.mockResolvedValue([
      att("res-learner", "LEARNER_VISIBLE"),
    ]);
    const { GET } = await import(
      "../apprentice/learning/resources/[resourceId]/file/route"
    );
    const res = await GET(
      new Request(
        "http://localhost/api/apprentice/learning/resources/res-learner/file",
      ),
      { params: Promise.resolve({ resourceId: "res-learner" }) },
    );
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toBe(LEARNER_SESSION_LOCKED_ERROR);
    expect(readResourceBinaryBytes).not.toHaveBeenCalled();
  });

  it("denies a learner-visible binary when the Block is locked", async () => {
    getEffectiveSession.mockResolvedValue(apprenticeSession);
    loadApprenticeLearningJourney.mockResolvedValue({
      programmeVersionId: "pv",
      isTest: true,
      blocks: [
        {
          spineItemId: "b1",
          title: "Block 1",
          displayTitle: "Block 1",
          displayOrdinal: 1,
          weekStart: 1,
          weekEnd: 10,
          plannedOtjHours: 45,
          unlocked: false,
          sessions: [lockedSessionView("sess-w003")],
          tasks: [],
        },
      ],
    });
    listProgrammeResourcesForVersion.mockResolvedValue([learnerResource]);
    listResourceAttachmentsForVersion.mockResolvedValue([
      att("res-learner", "LEARNER_VISIBLE"),
    ]);
    const { GET } = await import(
      "../apprentice/learning/resources/[resourceId]/file/route"
    );
    const res = await GET(
      new Request(
        "http://localhost/api/apprentice/learning/resources/res-learner/file",
      ),
      { params: Promise.resolve({ resourceId: "res-learner" }) },
    );
    expect(res.status).toBe(403);
    expect(readResourceBinaryBytes).not.toHaveBeenCalled();
  });

  it("another apprentice cannot retrieve using a different linked record", async () => {
    getEffectiveSession.mockResolvedValue(otherApprenticeSession);
    loadApprenticeLearningJourney.mockResolvedValue({
      ...journey([]),
      isTest: false,
    });
    listProgrammeResourcesForVersion.mockResolvedValue([learnerResource]);
    listResourceAttachmentsForVersion.mockResolvedValue([
      att("res-learner", "LEARNER_VISIBLE"),
    ]);
    const { GET } = await import(
      "../apprentice/learning/resources/[resourceId]/file/route"
    );
    const res = await GET(
      new Request(
        "http://localhost/api/apprentice/learning/resources/res-learner/file",
      ),
      { params: Promise.resolve({ resourceId: "res-learner" }) },
    );
    expect(res.status).not.toBe(200);
    expect(readResourceBinaryBytes).not.toHaveBeenCalled();
  });

  it("unauthenticated requests are denied", async () => {
    getEffectiveSession.mockResolvedValue(null);
    const { GET } = await import("./resources/[resourceId]/file/route");
    const res = await GET(
      new Request(
        "http://localhost/api/delivery/resources/res-tutor/file?programmeVersionId=pv",
      ),
      { params: Promise.resolve({ resourceId: "res-tutor" }) },
    );
    expect(res.status).toBe(401);
  });

  it("extract-only resources do not stream a binary", async () => {
    getEffectiveSession.mockResolvedValue(apprenticeSession);
    loadApprenticeLearningJourney.mockResolvedValue(
      journey([openSessionView("sess-w003")]),
    );
    listProgrammeResourcesForVersion.mockResolvedValue([learnerResource]);
    listResourceAttachmentsForVersion.mockResolvedValue([
      att("res-learner", "LEARNER_VISIBLE"),
    ]);
    getResourceBinary.mockResolvedValue(null);
    const { GET } = await import(
      "../apprentice/learning/resources/[resourceId]/file/route"
    );
    const res = await GET(
      new Request(
        "http://localhost/api/apprentice/learning/resources/res-learner/file",
      ),
      { params: Promise.resolve({ resourceId: "res-learner" }) },
    );
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toBe("Original file not currently available");
    expect(readResourceBinaryBytes).not.toHaveBeenCalled();
  });
});
