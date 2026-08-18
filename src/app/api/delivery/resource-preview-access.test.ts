import { beforeEach, describe, expect, it, vi } from "vitest";
import { buildEffectiveSession } from "@/lib/permissions/effective-permissions";
import type { PortalAccount } from "@/lib/portal/types";
import { LEARNER_TUTOR_ONLY_RESOURCE_ERROR } from "@/features/programme-delivery/domain/learner-resource-access";
import { LEARNER_SESSION_LOCKED_ERROR } from "@/features/programme-definition/domain/learner-facing-content";

const getEffectiveSession = vi.fn();
const loadApprenticeLearningJourney = vi.fn();
const listProgrammeResourcesForVersion = vi.fn();
const listResourceAttachmentsForVersion = vi.fn();
const listSessionReviewReleases = vi.fn();
const getResourceBinary = vi.fn();
const getResourcePreview = vi.fn();
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
              data: { id: "res-tutor", title: "Features of Hybrid Vehicles", filename: "Features of Hybrid Vehicles.ppt" },
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

vi.mock("@/features/programme-delivery/domain/session-review-release-repository", () => ({
  listSessionReviewReleases: (...args: unknown[]) =>
    listSessionReviewReleases(...args),
}));

vi.mock("@/features/programme-definition/domain/programme-resource-binaries-repository", () => ({
  getResourceBinary: (...args: unknown[]) => getResourceBinary(...args),
}));

vi.mock("@/features/programme-definition/domain/programme-resource-previews-repository", () => ({
  getResourcePreview: (...args: unknown[]) => getResourcePreview(...args),
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
  filename: "TEST_W003_learner_presentation_SAFE_DEMO.pptx",
};

const binary = {
  id: "bin-1",
  resourceId: "res-learner",
  programmeVersionId: "pv",
  originalFilename: learnerResource.filename,
  mimeType: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  sizeBytes: 12,
  sha256: "abc",
  storageBucket: "gta-programme-resource-binaries",
  storagePath: "pv/res-learner/file.pptx",
  sourceArchive: "SAFE DEMO",
  sourcePath: "",
  sourceGroupCode: "",
  sourceGroupFolder: "",
  versionReview: "SAME",
  metadata: {},
  createdAt: "",
  updatedAt: "",
};

const previewRecord = {
  id: "prev-1",
  resourceId: "res-learner",
  binaryId: "bin-1",
  programmeVersionId: "pv",
  previewType: "slide_images",
  status: "ready",
  generatedFromBinaryHash: "abc",
  storageBucket: "gta-programme-resource-binaries",
  slideCount: 2,
  failureReason: "",
  manifest: {
    slides: [
      {
        index: 1,
        storagePath: "previews/pv/res-learner/abc/slide-001.png",
        mimeType: "image/png",
        text: ["Hybrid awareness"],
      },
    ],
  },
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
    reviewMaterials: [],
    reviewLearning: true,
    openable: true,
  };
}

function lockedSessionView(id: string) {
  return { ...openSessionView(id), openable: false, status: "coming_up" };
}

function journey(sessions: unknown[], unlocked = true) {
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
    learnerReleaseTiming:
      audience === "LEARNER_VISIBLE" ? "WITH_SESSION" : null,
    sortOrder: 10,
    metadata: {},
    createdAt: "",
    updatedAt: "",
  };
}

describe("presentation preview access", () => {
  beforeEach(() => {
    getEffectiveSession.mockReset();
    loadApprenticeLearningJourney.mockReset();
    listProgrammeResourcesForVersion.mockReset();
    listResourceAttachmentsForVersion.mockReset();
    listSessionReviewReleases.mockReset();
    getResourceBinary.mockReset();
    getResourcePreview.mockReset();
    readResourceBinaryBytes.mockReset();
    getResourceBinary.mockResolvedValue(binary);
    getResourcePreview.mockResolvedValue(previewRecord);
    readResourceBinaryBytes.mockResolvedValue(Buffer.from("PNGBYTES"));
    listSessionReviewReleases.mockResolvedValue([]);
    vi.resetModules();
  });

  it("SAFE TEST apprentice can view a learner-visible preview when released and Block is open", async () => {
    getEffectiveSession.mockResolvedValue(apprenticeSession);
    loadApprenticeLearningJourney.mockResolvedValue(
      journey([openSessionView("sess-w003")]),
    );
    listProgrammeResourcesForVersion.mockResolvedValue([learnerResource]);
    listResourceAttachmentsForVersion.mockResolvedValue([
      att("res-learner", "LEARNER_VISIBLE"),
    ]);
    const { GET } = await import(
      "../apprentice/learning/resources/[resourceId]/preview/route"
    );
    const res = await GET(
      new Request(
        "http://localhost/api/apprentice/learning/resources/res-learner/preview",
      ),
      { params: Promise.resolve({ resourceId: "res-learner" }) },
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.preview.slideCount).toBe(2);
    expect(JSON.stringify(body)).not.toMatch(/object\/public/);
  });

  it("SAFE TEST apprentice can load a slide image through the authenticated API", async () => {
    getEffectiveSession.mockResolvedValue(apprenticeSession);
    loadApprenticeLearningJourney.mockResolvedValue(
      journey([openSessionView("sess-w003")]),
    );
    listProgrammeResourcesForVersion.mockResolvedValue([learnerResource]);
    listResourceAttachmentsForVersion.mockResolvedValue([
      att("res-learner", "LEARNER_VISIBLE"),
    ]);
    const { GET } = await import(
      "../apprentice/learning/resources/[resourceId]/preview/slides/[slideIndex]/route"
    );
    const res = await GET(
      new Request(
        "http://localhost/api/apprentice/learning/resources/res-learner/preview/slides/1",
      ),
      { params: Promise.resolve({ resourceId: "res-learner", slideIndex: "1" }) },
    );
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("image/png");
    expect(res.headers.get("cache-control")).toContain("private");
    expect(readResourceBinaryBytes).toHaveBeenCalledWith(
      expect.objectContaining({
        storagePath: "previews/pv/res-learner/abc/slide-001.png",
      }),
    );
  });

  it("apprentice is denied a Tutor only preview even when it exists", async () => {
    getEffectiveSession.mockResolvedValue(apprenticeSession);
    loadApprenticeLearningJourney.mockResolvedValue(
      journey([openSessionView("sess-w003")]),
    );
    listProgrammeResourcesForVersion.mockResolvedValue([tutorResource]);
    listResourceAttachmentsForVersion.mockResolvedValue([
      att("res-tutor", "TUTOR_ONLY"),
    ]);
    getResourceBinary.mockResolvedValue({ ...binary, resourceId: "res-tutor" });
    getResourcePreview.mockResolvedValue({
      ...previewRecord,
      resourceId: "res-tutor",
    });
    const { GET } = await import(
      "../apprentice/learning/resources/[resourceId]/preview/route"
    );
    const res = await GET(
      new Request(
        "http://localhost/api/apprentice/learning/resources/res-tutor/preview",
      ),
      { params: Promise.resolve({ resourceId: "res-tutor" }) },
    );
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toBe(LEARNER_TUTOR_ONLY_RESOURCE_ERROR);
    expect(readResourceBinaryBytes).not.toHaveBeenCalled();
  });

  it("denies preview when the Session is unreleased", async () => {
    getEffectiveSession.mockResolvedValue(apprenticeSession);
    loadApprenticeLearningJourney.mockResolvedValue(
      journey([lockedSessionView("sess-w003")]),
    );
    listProgrammeResourcesForVersion.mockResolvedValue([learnerResource]);
    listResourceAttachmentsForVersion.mockResolvedValue([
      att("res-learner", "LEARNER_VISIBLE"),
    ]);
    const { GET } = await import(
      "../apprentice/learning/resources/[resourceId]/preview/route"
    );
    const res = await GET(
      new Request(
        "http://localhost/api/apprentice/learning/resources/res-learner/preview",
      ),
      { params: Promise.resolve({ resourceId: "res-learner" }) },
    );
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toBe(LEARNER_SESSION_LOCKED_ERROR);
  });

  it("denies preview when the Block is locked", async () => {
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
      "../apprentice/learning/resources/[resourceId]/preview/route"
    );
    const res = await GET(
      new Request(
        "http://localhost/api/apprentice/learning/resources/res-learner/preview",
      ),
      { params: Promise.resolve({ resourceId: "res-learner" }) },
    );
    expect(res.status).toBe(403);
  });

  it("another apprentice cannot view using a different linked record", async () => {
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
      "../apprentice/learning/resources/[resourceId]/preview/route"
    );
    const res = await GET(
      new Request(
        "http://localhost/api/apprentice/learning/resources/res-learner/preview",
      ),
      { params: Promise.resolve({ resourceId: "res-learner" }) },
    );
    expect(res.status).not.toBe(200);
  });

  it("unauthenticated preview requests are denied", async () => {
    getEffectiveSession.mockResolvedValue(null);
    const { GET } = await import("./resources/[resourceId]/preview/route");
    const res = await GET(
      new Request(
        "http://localhost/api/delivery/resources/res-tutor/preview?programmeVersionId=pv",
      ),
      { params: Promise.resolve({ resourceId: "res-tutor" }) },
    );
    expect(res.status).toBe(401);
  });

  it("tutor can open a Tutor only preview on the delivery route", async () => {
    getEffectiveSession.mockResolvedValue(tutorSession);
    getResourceBinary.mockResolvedValue({ ...binary, resourceId: "res-tutor" });
    getResourcePreview.mockResolvedValue({
      ...previewRecord,
      resourceId: "res-tutor",
    });
    const { GET } = await import("./resources/[resourceId]/preview/route");
    const res = await GET(
      new Request(
        "http://localhost/api/delivery/resources/res-tutor/preview?programmeVersionId=pv",
      ),
      { params: Promise.resolve({ resourceId: "res-tutor" }) },
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(JSON.stringify(body)).not.toMatch(/object\/public/);
  });

  it("rejects a preview generated from a different original hash", async () => {
    getEffectiveSession.mockResolvedValue(apprenticeSession);
    loadApprenticeLearningJourney.mockResolvedValue(
      journey([openSessionView("sess-w003")]),
    );
    listProgrammeResourcesForVersion.mockResolvedValue([learnerResource]);
    listResourceAttachmentsForVersion.mockResolvedValue([
      att("res-learner", "LEARNER_VISIBLE"),
    ]);
    getResourcePreview.mockResolvedValue({
      ...previewRecord,
      generatedFromBinaryHash: "old-hash",
    });
    const { GET } = await import(
      "../apprentice/learning/resources/[resourceId]/preview/route"
    );
    const res = await GET(
      new Request(
        "http://localhost/api/apprentice/learning/resources/res-learner/preview",
      ),
      { params: Promise.resolve({ resourceId: "res-learner" }) },
    );
    expect(res.status).toBe(404);
  });
});
