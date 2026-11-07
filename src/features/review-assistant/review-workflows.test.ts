import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { buildEffectiveSession } from "@/lib/permissions/effective-permissions";
import { PERMISSIONS } from "@/lib/permissions/capabilities";
import type { PortalAccount } from "@/lib/portal/types";
import { saveReviewAttachment } from "./attachments";
import { readReviewState, saveReviewState } from "./state-store";
import { filterStateForTutor, mergeTutorReviewUpdates } from "./tutor-caseload";

const getEffectiveSession = vi.fn();

vi.mock("@/adapters/standalone", () => ({
  getStandalonePorts: () => ({
    auth: { getEffectiveSession: () => getEffectiveSession() },
  }),
}));

function account(input: {
  name: string;
  workspace: PortalAccount["workspace"];
  baseRole: string;
  permissions: string[];
}): PortalAccount {
  return {
    id: "person-1",
    name: input.name,
    initials: "P",
    email: "person@example.test",
    baseRole: input.baseRole,
    responsibilities: [],
    workspace: input.workspace,
    permissions: input.permissions,
  };
}

const office = buildEffectiveSession(
  account({
    name: "Office User",
    workspace: "administration",
    baseRole: "Administrator",
    permissions: [PERMISSIONS.ADMIN_RECORDS_MANAGE, PERMISSIONS.REVIEWS_MANAGE],
  }),
  [],
);

const tutor = buildEffectiveSession(
  account({
    name: "Anne-Marie Sanderson",
    workspace: "staff",
    baseRole: "Tutor",
    permissions: [PERMISSIONS.REVIEWS_MANAGE],
  }),
  [],
);

const apprentice = buildEffectiveSession(
  account({
    name: "Learner",
    workspace: "apprentice",
    baseRole: "Apprentice",
    permissions: [PERMISSIONS.ADMIN_RECORDS_MANAGE, PERMISSIONS.REVIEWS_MANAGE],
  }),
  [],
);

let dir = "";

beforeEach(() => {
  dir = mkdtempSync(path.join(tmpdir(), "review-workflows-"));
  process.env.REVIEW_ASSISTANT_STATE_FILE = path.join(dir, "state.json");
  process.env.REVIEW_ASSISTANT_ATTACHMENTS_DIR = path.join(dir, "attachments");
  getEffectiveSession.mockReset();
});

afterEach(() => {
  delete process.env.REVIEW_ASSISTANT_STATE_FILE;
  delete process.env.REVIEW_ASSISTANT_ATTACHMENTS_DIR;
  rmSync(dir, { recursive: true, force: true });
});

describe("review assistant server copy", () => {
  it("keeps a reloadable version and rejects a stale office save", async () => {
    const { POST } = await import("@/app/api/reviews-assistant/state/route");
    getEffectiveSession.mockResolvedValue(office);
    const first = await POST(
      new Request("http://localhost/api/reviews-assistant/state", {
        method: "POST",
        body: JSON.stringify({
          appBuild: "out-165",
          version: 1,
          learners: [{ id: "example-1", name: "Example Learner", tutor: "Anne-Marie Sanderson" }],
          savedReviews: [],
        }),
      }),
    );
    expect(first.status).toBe(200);
    const stale = await POST(
      new Request("http://localhost/api/reviews-assistant/state", {
        method: "POST",
        body: JSON.stringify({
          appBuild: "out-165",
          version: 1,
          learners: [{ id: "example-1", name: "Changed", tutor: "Anne-Marie Sanderson" }],
        }),
      }),
    );
    expect(stale.status).toBe(409);
    const body = (await stale.json()) as { state: { learners: Array<{ name: string }> } };
    expect(body.state.learners[0].name).toBe("Example Learner");
    expect(readReviewState().learners?.[0]?.name).toBe("Example Learner");
  });

  it("gives a tutor only their caseload and writable review fields", async () => {
    saveReviewState(
      {
        version: 1,
        learners: [
          { id: "mine", name: "Example Learner", tutor: "Anne-Marie Sanderson" },
          { id: "other", name: "Other Learner", tutor: "John Pearson" },
        ],
        savedReviews: [
          { id: "review-mine", learnerId: "mine", status: "sent", tutorNotes: "" },
          { id: "review-other", learnerId: "other", status: "sent", tutorNotes: "private" },
        ],
        settings: { email: "office@example.test", officePostcode: "DN1 1AA" },
        tutorFeedback: [{ id: "fb", email: "tutor@example.test", message: "hidden", at: "" }],
      },
      1,
    );
    const keyOf = (value: string) => value.trim().toLowerCase();
    const visible = filterStateForTutor(readReviewState(), "anne-marie sanderson", keyOf);
    expect(visible.learners?.map((learner) => learner.id)).toEqual(["mine"]);
    expect(visible.savedReviews?.map((review) => review.id)).toEqual(["review-mine"]);
    expect(visible.settings).toMatchObject({ email: "", officePostcode: "" });
    expect(visible.tutorFeedback).toEqual([]);

    const merged = mergeTutorReviewUpdates(
      readReviewState(),
      {
        savedReviews: [
          { id: "review-mine", learnerId: "mine", status: "returned", tutorNotes: "Seen" },
          { id: "review-other", learnerId: "other", status: "completed", tutorNotes: "nope" },
        ],
      },
      "anne-marie sanderson",
      keyOf,
    );
    expect(merged.savedReviews?.find((review) => review.id === "review-mine")).toMatchObject({
      status: "returned",
      tutorNotes: "Seen",
    });
    expect(merged.savedReviews?.find((review) => review.id === "review-other")?.tutorNotes).toBe(
      "private",
    );

    const { GET } = await import("@/app/api/reviews-assistant/tutor-state/route");
    getEffectiveSession.mockResolvedValue(tutor);
    const response = await GET();
    expect(response.status).toBe(200);
    const payload = (await response.json()) as { state: { learners: Array<{ id: string }> } };
    expect(payload.state.learners.map((learner) => learner.id)).toEqual(["mine"]);
    getEffectiveSession.mockResolvedValue(office);
    expect((await GET()).status).toBe(403);
    getEffectiveSession.mockResolvedValue(apprentice);
    expect((await GET()).status).toBe(403);
  });

  it("stores an attachment on the server and hides another tutor's file", async () => {
    saveReviewState(
      {
        learners: [{ id: "mine", tutor: "Anne-Marie Sanderson" }],
        savedReviews: [{ id: "review-mine", learnerId: "mine", attachment: { id: "will-replace" } }],
      },
      1,
    );
    const saved = saveReviewAttachment({
      filename: "example.pdf",
      type: "application/pdf",
      bytes: Buffer.from("%PDF-1.4"),
    });
    const state = readReviewState();
    state.savedReviews = [
      { id: "review-mine", learnerId: "mine", attachment: { id: saved.id } },
    ];
    saveReviewState(state, state.version || 1);
    const { GET } = await import("@/app/api/reviews-assistant/review-attachment/route");
    getEffectiveSession.mockResolvedValue(tutor);
    const allowed = await GET(
      new Request(`http://localhost/api/reviews-assistant/review-attachment?id=${saved.id}`),
    );
    expect(allowed.status).toBe(200);
    getEffectiveSession.mockResolvedValue(
      buildEffectiveSession(
        account({
          name: "John Pearson",
          workspace: "staff",
          baseRole: "Tutor",
          permissions: [PERMISSIONS.REVIEWS_MANAGE],
        }),
        [],
      ),
    );
    const denied = await GET(
      new Request(`http://localhost/api/reviews-assistant/review-attachment?id=${saved.id}`),
    );
    expect(denied.status).toBe(403);
    expect(() =>
      saveReviewAttachment({
        filename: "notes.txt",
        type: "text/plain",
        bytes: Buffer.from("no"),
      }),
    ).toThrow(/PDF or image/);
  });
});
