import { beforeEach, describe, expect, it, vi } from "vitest";
import { buildEffectiveSession } from "@/lib/permissions/effective-permissions";
import type { PortalAccount } from "@/lib/portal/types";

const getEffectiveSession = vi.fn();
const listProgrammeSessionsForVersion = vi.fn();
const updateProgrammeSessionAuthoring = vi.fn();
const listProgrammeResourcesForVersion = vi.fn();
const listResourceAttachmentsForVersion = vi.fn();
const upsertProgrammeResources = vi.fn();
const upsertResourceAttachments = vi.fn();
const deleteResourceAttachment = vi.fn();
const loadResourceExtractText = vi.fn();
const extractCandidateActivities = vi.fn();

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
              data: {
                id: "res-1",
                title: "Week 11 lesson plan",
                filename: "Autocare_L2_Week_011_Lesson_Plan_v4.4.docx",
                source_path: "",
                evidence_resource_id: "res_lp",
                extract_path: "extracts/w011.txt",
                metadata: {},
              },
              error: null,
            }),
          }),
        }),
      }),
    }),
  })),
}));

vi.mock("@/features/programme-definition/domain/programme-sessions-repository", () => ({
  listProgrammeSessionsForVersion: (...args: unknown[]) =>
    listProgrammeSessionsForVersion(...args),
  updateProgrammeSessionAuthoring: (...args: unknown[]) =>
    updateProgrammeSessionAuthoring(...args),
}));

vi.mock("@/features/programme-definition/domain/programme-resources-repository", () => ({
  listProgrammeResourcesForVersion: (...args: unknown[]) =>
    listProgrammeResourcesForVersion(...args),
  listResourceAttachmentsForVersion: (...args: unknown[]) =>
    listResourceAttachmentsForVersion(...args),
  upsertProgrammeResources: (...args: unknown[]) =>
    upsertProgrammeResources(...args),
  upsertResourceAttachments: (...args: unknown[]) =>
    upsertResourceAttachments(...args),
  deleteResourceAttachment: (...args: unknown[]) =>
    deleteResourceAttachment(...args),
  placeUnplacedAttachmentOnSession: vi.fn(),
}));

vi.mock("@/features/programme-definition/domain/resource-extract", () => ({
  loadResourceExtractText: (...args: unknown[]) =>
    loadResourceExtractText(...args),
  extractCandidateActivities: (...args: unknown[]) =>
    extractCandidateActivities(...args),
}));

function account(input: {
  workspace: PortalAccount["workspace"];
  permissions: string[];
  baseRole?: string;
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
    linkedApprenticeId:
      input.workspace === "apprentice" ? "ea587505-487a-4b81-aeec-963cda86e47d" : null,
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
      "messages.view",
      "ai.use",
      "lifecycle.kanban.view",
    ],
  }),
  [],
);

const apprenticeSession = buildEffectiveSession(
  account({
    workspace: "apprentice",
    baseRole: "Apprentice",
    permissions: ["apprentice.workspace.own", "apprentice.modules.view"],
  }),
  [],
);

describe("Programme Builder authoring permission matrix", () => {
  beforeEach(() => {
    getEffectiveSession.mockReset();
    listProgrammeSessionsForVersion.mockReset();
    updateProgrammeSessionAuthoring.mockReset();
    listProgrammeResourcesForVersion.mockReset();
    listResourceAttachmentsForVersion.mockReset();
    upsertProgrammeResources.mockReset();
    upsertResourceAttachments.mockReset();
    deleteResourceAttachment.mockReset();
    loadResourceExtractText.mockReset();
    extractCandidateActivities.mockReset();
    listProgrammeSessionsForVersion.mockResolvedValue([]);
    updateProgrammeSessionAuthoring.mockResolvedValue({ id: "sess-1" });
    listProgrammeResourcesForVersion.mockResolvedValue([]);
    listResourceAttachmentsForVersion.mockResolvedValue([]);
    upsertProgrammeResources.mockResolvedValue([]);
    upsertResourceAttachments.mockResolvedValue([{ id: "att-1" }]);
    deleteResourceAttachment.mockResolvedValue(undefined);
    loadResourceExtractText.mockReturnValue({
      mode: "extract_file",
      text: "Tutor extract",
    });
    extractCandidateActivities.mockReturnValue([]);
    vi.resetModules();
  });

  async function sessions() {
    return import("./sessions/route");
  }
  async function resources() {
    return import("./resources/route");
  }
  async function extract() {
    return import("./resources/extract/route");
  }
  async function spine() {
    return import("./spine/route");
  }
  async function links() {
    return import("../course-builder/task-session-links/route");
  }
  async function versions() {
    return import("./versions/route");
  }
  async function activity() {
    return import("./activity/route");
  }
  async function recommend() {
    return import("./recommend-intent/route");
  }
  async function analysis() {
    return import("./curriculum-analysis/route");
  }
  async function tasks() {
    return import("../course-builder/tasks/route");
  }
  async function importOfficial() {
    return import("./import/route");
  }

  const writeCalls = [
    {
      name: "sessions PATCH",
      call: async () =>
        (await sessions()).PATCH(
          new Request("http://localhost/api/management/programme-definition/sessions", {
            method: "PATCH",
            body: JSON.stringify({
              programmeVersionId: "pv",
              sessionId: "sess-1",
              publishStatus: "published",
              learnerFacingContent: { status: "approved_published" },
            }),
          }),
        ),
    },
    {
      name: "resources PUT attach",
      call: async () =>
        (await resources()).PUT(
          new Request("http://localhost/api/management/programme-definition/resources", {
            method: "PUT",
            body: JSON.stringify({
              programmeVersionId: "pv",
              attachments: [
                {
                  resourceId: "res-1",
                  sessionId: "sess-1",
                  role: "LEARNER_LEARNING",
                  audience: "LEARNER_VISIBLE",
                },
              ],
            }),
          }),
        ),
    },
    {
      name: "resources DELETE",
      call: async () =>
        (await resources()).DELETE(
          new Request(
            "http://localhost/api/management/programme-definition/resources?programmeVersionId=pv&attachmentId=att-1",
            { method: "DELETE" },
          ),
        ),
    },
    {
      name: "spine PUT",
      call: async () =>
        (await spine()).PUT(
          new Request("http://localhost/api/management/programme-definition/spine", {
            method: "PUT",
            body: JSON.stringify({
              programmeId: "p1",
              programmeVersionId: "pv",
              standardCode: "ST0499",
              standardVersionId: "sv1",
              parameters: { expectedOtjHours: 611.5 },
            }),
          }),
        ),
    },
    {
      name: "task-session-links PUT",
      call: async () =>
        (await links()).PUT(
          new Request(
            "http://localhost/api/management/course-builder/task-session-links",
            {
              method: "PUT",
              body: JSON.stringify({
                programmeVersionId: "pv",
                links: [],
              }),
            },
          ),
        ),
    },
    {
      name: "activity POST",
      call: async () =>
        (await activity()).POST(
          new Request("http://localhost/api/management/programme-definition/activity", {
            method: "POST",
            body: JSON.stringify({
              kind: "spine_saved",
              summary: "test",
              standardCode: "ST0499",
            }),
          }),
        ),
    },
    {
      name: "recommend-intent POST",
      call: async () =>
        (await recommend()).POST(
          new Request(
            "http://localhost/api/management/programme-definition/recommend-intent",
            {
              method: "POST",
              body: JSON.stringify({ ksbCode: "K1" }),
            },
          ),
        ),
    },
    {
      name: "curriculum-analysis POST",
      call: async () =>
        (await analysis()).POST(
          new Request(
            "http://localhost/api/management/programme-definition/curriculum-analysis",
            {
              method: "POST",
              body: JSON.stringify({ programmeVersionId: "pv" }),
            },
          ),
        ),
    },
    {
      name: "import POST",
      call: async () =>
        (await importOfficial()).POST(
          new Request("http://localhost/api/management/programme-definition/import", {
            method: "POST",
            body: JSON.stringify({ standardCode: "ST0499" }),
          }),
        ),
    },
    {
      name: "tasks PUT",
      call: async () =>
        (await tasks()).PUT(
          new Request("http://localhost/api/management/course-builder/tasks", {
            method: "PUT",
            body: JSON.stringify({ programmeVersionId: "pv", tasks: [] }),
          }),
        ),
    },
    {
      name: "tasks DELETE",
      call: async () =>
        (await tasks()).DELETE(
          new Request(
            "http://localhost/api/management/course-builder/tasks?programmeVersionId=pv&taskKey=T1",
            { method: "DELETE" },
          ),
        ),
    },
  ];

  const readCalls = [
    {
      name: "sessions GET",
      call: async () =>
        (await sessions()).GET(
          new Request(
            "http://localhost/api/management/programme-definition/sessions?programmeVersionId=pv",
          ),
        ),
    },
    {
      name: "resources GET",
      call: async () =>
        (await resources()).GET(
          new Request(
            "http://localhost/api/management/programme-definition/resources?programmeVersionId=pv",
          ),
        ),
    },
    {
      name: "versions GET",
      call: async () =>
        (await versions()).GET(
          new Request(
            "http://localhost/api/management/programme-definition/versions?standardCode=ST0499",
          ),
        ),
    },
    {
      name: "activity GET",
      call: async () =>
        (await activity()).GET(
          new Request(
            "http://localhost/api/management/programme-definition/activity?standardCode=ST0499",
          ),
        ),
    },
    {
      name: "curriculum-analysis GET",
      call: async () =>
        (await analysis()).GET(
          new Request(
            "http://localhost/api/management/programme-definition/curriculum-analysis?programmeVersionId=pv",
          ),
        ),
    },
    {
      name: "tasks GET",
      call: async () =>
        (await tasks()).GET(
          new Request(
            "http://localhost/api/management/course-builder/tasks?programmeVersionId=pv",
          ),
        ),
    },
    {
      name: "task-session-links GET",
      call: async () =>
        (await links()).GET(
          new Request(
            "http://localhost/api/management/course-builder/task-session-links?programmeVersionId=pv",
          ),
        ),
    },
  ];

  it.each([...readCalls, ...writeCalls])(
    "unauthenticated $name is 401",
    async ({ call }) => {
      getEffectiveSession.mockResolvedValue(null);
      const res = await call();
      expect(res.status).toBe(401);
      expect(updateProgrammeSessionAuthoring).not.toHaveBeenCalled();
      expect(upsertResourceAttachments).not.toHaveBeenCalled();
      expect(deleteResourceAttachment).not.toHaveBeenCalled();
    },
  );

  it.each([...readCalls, ...writeCalls])(
    "SAFE TEST tutor $name is 403",
    async ({ call }) => {
      getEffectiveSession.mockResolvedValue(tutorSession);
      const res = await call();
      expect(res.status).toBe(403);
      expect(updateProgrammeSessionAuthoring).not.toHaveBeenCalled();
      expect(upsertResourceAttachments).not.toHaveBeenCalled();
      expect(deleteResourceAttachment).not.toHaveBeenCalled();
    },
  );

  it.each([...readCalls, ...writeCalls])(
    "apprentice $name is 403",
    async ({ call }) => {
      getEffectiveSession.mockResolvedValue(apprenticeSession);
      const res = await call();
      expect(res.status).toBe(403);
      expect(updateProgrammeSessionAuthoring).not.toHaveBeenCalled();
    },
  );

  it("curriculum owner Programme Builder GET is allowed", async () => {
    getEffectiveSession.mockResolvedValue(ownerSession);
    const res = await (await sessions()).GET(
      new Request(
        "http://localhost/api/management/programme-definition/sessions?programmeVersionId=pv",
      ),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(listProgrammeSessionsForVersion).toHaveBeenCalled();
  });

  it("curriculum owner Session PATCH (approve/publish) is allowed", async () => {
    getEffectiveSession.mockResolvedValue(ownerSession);
    const res = await (
      await sessions()
    ).PATCH(
      new Request("http://localhost/api/management/programme-definition/sessions", {
        method: "PATCH",
        body: JSON.stringify({
          programmeVersionId: "pv",
          sessionId: "sess-1",
          publishStatus: "published",
          learnerFacingContent: { status: "approved_published" },
        }),
      }),
    );
    expect(res.status).toBe(200);
    expect(updateProgrammeSessionAuthoring).toHaveBeenCalled();
  });

  it("curriculum owner resource attach is allowed", async () => {
    getEffectiveSession.mockResolvedValue(ownerSession);
    const res = await (
      await resources()
    ).PUT(
      new Request("http://localhost/api/management/programme-definition/resources", {
        method: "PUT",
        body: JSON.stringify({
          programmeVersionId: "pv",
          attachments: [
            {
              resourceId: "res-1",
              sessionId: "sess-1",
              role: "LEARNER_LEARNING",
              audience: "LEARNER_VISIBLE",
            },
          ],
        }),
      }),
    );
    expect(res.status).toBe(200);
    expect(upsertResourceAttachments).toHaveBeenCalled();
  });

  it("curriculum owner resource remove is allowed", async () => {
    getEffectiveSession.mockResolvedValue(ownerSession);
    const res = await (
      await resources()
    ).DELETE(
      new Request(
        "http://localhost/api/management/programme-definition/resources?programmeVersionId=pv&attachmentId=att-1",
        { method: "DELETE" },
      ),
    );
    expect(res.status).toBe(200);
    expect(deleteResourceAttachment).toHaveBeenCalled();
  });

  it("tutor may load a tutor extract", async () => {
    getEffectiveSession.mockResolvedValue(tutorSession);
    const res = await (
      await extract()
    ).GET(
      new Request(
        "http://localhost/api/management/programme-definition/resources/extract?programmeVersionId=pv&resourceId=res-1",
      ),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.extractText).toBe("Tutor extract");
  });

  it("apprentice cannot load a tutor extract", async () => {
    getEffectiveSession.mockResolvedValue(apprenticeSession);
    const res = await (
      await extract()
    ).GET(
      new Request(
        "http://localhost/api/management/programme-definition/resources/extract?programmeVersionId=pv&resourceId=res-1",
      ),
    );
    expect(res.status).toBe(403);
  });

  it("unauthenticated cannot load a tutor extract", async () => {
    getEffectiveSession.mockResolvedValue(null);
    const res = await (
      await extract()
    ).GET(
      new Request(
        "http://localhost/api/management/programme-definition/resources/extract?programmeVersionId=pv&resourceId=res-1",
      ),
    );
    expect(res.status).toBe(401);
  });
});
