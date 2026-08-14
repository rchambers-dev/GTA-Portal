import { beforeEach, describe, expect, it, vi } from "vitest";
import { buildEffectiveSession } from "@/lib/permissions/effective-permissions";
import type { PortalAccount } from "@/lib/portal/types";

const getEffectiveSession = vi.fn();
const loadApprenticeLearningJourney = vi.fn();
const listSessionDeliveryRecords = vi.fn();
const signOffSessionDelivered = vi.fn();
const createEnrolmentBlockUnlock = vi.fn();
const listEnrolmentBlockUnlocks = vi.fn();
const loadPublishedDeliveryCatalogue = vi.fn();

vi.mock("@/adapters/standalone", () => ({
  getStandalonePorts: () => ({
    auth: { getEffectiveSession: () => getEffectiveSession() },
  }),
}));

vi.mock("@/adapters/supabase/client", () => ({
  createSupabaseAdminClient: vi.fn(() => ({ __client: true })),
}));

vi.mock("@/features/programme-delivery/domain/apprentice-learning-repository", () => ({
  loadApprenticeLearningJourney: (...args: unknown[]) =>
    loadApprenticeLearningJourney(...args),
}));

vi.mock("@/features/programme-delivery/domain/session-delivery-repository", () => ({
  listSessionDeliveryRecords: (...args: unknown[]) =>
    listSessionDeliveryRecords(...args),
  signOffSessionDelivered: (...args: unknown[]) =>
    signOffSessionDelivered(...args),
}));

vi.mock("@/features/programme-delivery/domain/block-unlock-overrides-repository", () => ({
  createEnrolmentBlockUnlock: (...args: unknown[]) =>
    createEnrolmentBlockUnlock(...args),
  listEnrolmentBlockUnlocks: (...args: unknown[]) =>
    listEnrolmentBlockUnlocks(...args),
}));

vi.mock("@/features/programme-delivery/domain/published-delivery-catalogue", () => ({
  loadPublishedDeliveryCatalogue: (...args: unknown[]) =>
    loadPublishedDeliveryCatalogue(...args),
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

const ownerSession = buildEffectiveSession(
  account({
    workspace: "management",
    baseRole: "Management",
    permissions: ["management.workspace.view", "management.programme.setup"],
  }),
  [],
);

const tutorSession = buildEffectiveSession(
  account({
    workspace: "staff",
    baseRole: "Tutor",
    permissions: [
      "staff.workspace.view",
      "modules.deliver",
      "apprentices.assigned.view",
      "apprentice.workspace.view",
    ],
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

describe("delivery / apprentice permission matrix", () => {
  beforeEach(() => {
    getEffectiveSession.mockReset();
    loadApprenticeLearningJourney.mockReset();
    listSessionDeliveryRecords.mockReset();
    signOffSessionDelivered.mockReset();
    createEnrolmentBlockUnlock.mockReset();
    listEnrolmentBlockUnlocks.mockReset();
    loadPublishedDeliveryCatalogue.mockReset();
    loadApprenticeLearningJourney.mockResolvedValue({
      apprenticeId: "ea587505-487a-4b81-aeec-963cda86e47d",
      programmeVersionId: "pv",
      blocks: [],
    });
    listSessionDeliveryRecords.mockResolvedValue([]);
    listEnrolmentBlockUnlocks.mockResolvedValue([]);
    loadPublishedDeliveryCatalogue.mockResolvedValue({ sessions: [] });
    vi.resetModules();
  });

  it("unauthenticated staff delivery GET is 401", async () => {
    getEffectiveSession.mockResolvedValue(null);
    const { GET } = await import("./block1/route");
    const res = await GET(
      new Request("http://localhost/api/delivery/block1?apprenticeProgrammeId=enr-1"),
    );
    expect(res.status).toBe(401);
  });

  it("unauthenticated catalogue GET is 401", async () => {
    getEffectiveSession.mockResolvedValue(null);
    const { GET } = await import("./catalogue/route");
    const res = await GET(
      new Request("http://localhost/api/delivery/catalogue?programmeVersionId=pv"),
    );
    expect(res.status).toBe(401);
  });

  it("unauthenticated apprentice learning GET is 401", async () => {
    getEffectiveSession.mockResolvedValue(null);
    const { GET } = await import("../apprentice/learning/route");
    const res = await GET();
    expect(res.status).toBe(401);
  });

  it("tutor delivery GET is allowed", async () => {
    getEffectiveSession.mockResolvedValue(tutorSession);
    const { GET } = await import("./block1/route");
    const res = await GET(
      new Request("http://localhost/api/delivery/block1?apprenticeProgrammeId=enr-1"),
    );
    // Enrolment lookup uses supabase stub; 500/404 is past the auth gate.
    expect(res.status).not.toBe(401);
    expect(res.status).not.toBe(403);
  });

  it("apprentice cannot call staff delivery GET", async () => {
    getEffectiveSession.mockResolvedValue(apprenticeSession);
    const { GET } = await import("./block1/route");
    const res = await GET(
      new Request("http://localhost/api/delivery/block1?apprenticeProgrammeId=enr-1"),
    );
    expect(res.status).toBe(403);
  });

  it("apprentice own learning GET is allowed", async () => {
    getEffectiveSession.mockResolvedValue(apprenticeSession);
    const { GET } = await import("../apprentice/learning/route");
    const res = await GET();
    expect(res.status).toBe(200);
    expect(loadApprenticeLearningJourney).toHaveBeenCalledWith(
      expect.anything(),
      "ea587505-487a-4b81-aeec-963cda86e47d",
    );
  });

  it("tutor cannot call apprentice learning GET", async () => {
    getEffectiveSession.mockResolvedValue(tutorSession);
    const { GET } = await import("../apprentice/learning/route");
    const res = await GET();
    expect(res.status).toBe(403);
    expect(loadApprenticeLearningJourney).not.toHaveBeenCalled();
  });

  it("apprentice learning always loads the linked apprentice, never a client id", async () => {
    getEffectiveSession.mockResolvedValue(apprenticeSession);
    const { GET } = await import("../apprentice/learning/route");
    await GET();
    expect(loadApprenticeLearningJourney).toHaveBeenCalledTimes(1);
    expect(loadApprenticeLearningJourney.mock.calls[0][1]).toBe(
      "ea587505-487a-4b81-aeec-963cda86e47d",
    );
  });

  it("tutor cannot create an S4 block unlock", async () => {
    getEffectiveSession.mockResolvedValue(tutorSession);
    const { POST } = await import("./block-unlock/route");
    const res = await POST(
      new Request("http://localhost/api/delivery/block-unlock", {
        method: "POST",
        body: JSON.stringify({
          confirm: true,
          apprenticeProgrammeId: "enr-1",
          spineItemId: "b2",
          reason: "should be denied",
        }),
      }),
    );
    expect(res.status).toBe(403);
    expect(createEnrolmentBlockUnlock).not.toHaveBeenCalled();
  });

  it("curriculum owner can create an S4 block unlock", async () => {
    getEffectiveSession.mockResolvedValue(ownerSession);
    createEnrolmentBlockUnlock.mockResolvedValue({ id: "unlock-1" });
    const { POST } = await import("./block-unlock/route");
    const res = await POST(
      new Request("http://localhost/api/delivery/block-unlock", {
        method: "POST",
        body: JSON.stringify({
          confirm: true,
          apprenticeProgrammeId: "enr-1",
          spineItemId: "b2",
          reason: "authorised test",
        }),
      }),
    );
    expect(res.status).toBe(200);
    expect(createEnrolmentBlockUnlock).toHaveBeenCalled();
  });

  it("tutor session sign-off is allowed (delivery, not authoring)", async () => {
    getEffectiveSession.mockResolvedValue(tutorSession);
    signOffSessionDelivered.mockResolvedValue({ id: "del-1" });
    const { POST } = await import("./session-signoff/route");
    const res = await POST(
      new Request("http://localhost/api/delivery/session-signoff", {
        method: "POST",
        body: JSON.stringify({
          confirm: true,
          programmeVersionId: "pv",
          sessionId: "sess-1",
          apprenticeId: "apprentice-1",
          apprenticeProgrammeId: "enr-1",
        }),
      }),
    );
    expect(res.status).toBe(200);
  });

  it("apprentice cannot sign off a Session", async () => {
    getEffectiveSession.mockResolvedValue(apprenticeSession);
    const { POST } = await import("./session-signoff/route");
    const res = await POST(
      new Request("http://localhost/api/delivery/session-signoff", {
        method: "POST",
        body: JSON.stringify({ confirm: true }),
      }),
    );
    expect(res.status).toBe(403);
    expect(signOffSessionDelivered).not.toHaveBeenCalled();
  });
});
