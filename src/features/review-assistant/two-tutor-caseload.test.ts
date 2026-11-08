import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { buildEffectiveSession } from "@/lib/permissions/effective-permissions";
import { PERMISSIONS } from "@/lib/permissions/capabilities";
import type { PortalAccount } from "@/lib/portal/types";
import { saveReviewState } from "./state-store";

const getEffectiveSession = vi.fn();
const { loadReviewApprentices } = vi.hoisted(() => ({ loadReviewApprentices: vi.fn() }));

vi.mock("@/adapters/standalone", () => ({
  getStandalonePorts: () => ({
    auth: { getEffectiveSession: () => getEffectiveSession() },
  }),
}));

vi.mock("@/features/review-assistant/portal-roster", async () => {
  const actual = await vi.importActual<typeof import("@/features/review-assistant/portal-roster")>(
    "@/features/review-assistant/portal-roster",
  );
  return { ...actual, loadReviewApprentices };
});

const tutorAId = "11111111-1111-4111-8111-111111111111";
const tutorBId = "22222222-2222-4222-8222-222222222222";
const apprenticeA = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const apprenticeB = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

function tutor(id: string, name: string) {
  const account: PortalAccount = {
    id,
    name,
    initials: "T",
    email: `${id}@example.test`,
    baseRole: "Tutor",
    responsibilities: [],
    workspace: "staff",
    permissions: [PERMISSIONS.REVIEWS_MANAGE],
  };
  return buildEffectiveSession(account, []);
}

let dir = "";

beforeEach(() => {
  dir = mkdtempSync(path.join(tmpdir(), "two-tutor-"));
  process.env.REVIEW_ASSISTANT_STORE = "file";
  process.env.REVIEW_ASSISTANT_STATE_FILE = path.join(dir, "state.json");
  process.env.REVIEW_ASSISTANT_ATTACHMENTS_DIR = path.join(dir, "attachments");
  saveReviewState(
    {
      version: 1,
      learners: [
        { id: apprenticeA, name: "Apprentice A", tutor: "Same Display Name" },
        { id: apprenticeB, name: "Apprentice B", tutor: "Same Display Name" },
      ],
      savedReviews: [
        { id: "review-a", learnerId: apprenticeA, status: "sent", tutorNotes: "a-private" },
        { id: "review-b", learnerId: apprenticeB, status: "sent", tutorNotes: "b-private" },
      ],
    },
    1,
  );
  loadReviewApprentices.mockImplementation(async (session: { account: { id: string } }) => {
    if (session.account.id === tutorAId) return [{ id: apprenticeA, name: "Apprentice A" }];
    if (session.account.id === tutorBId) return [{ id: apprenticeB, name: "Apprentice B" }];
    return [];
  });
});

afterEach(() => {
  delete process.env.REVIEW_ASSISTANT_STORE;
  delete process.env.REVIEW_ASSISTANT_STATE_FILE;
  delete process.env.REVIEW_ASSISTANT_ATTACHMENTS_DIR;
  rmSync(dir, { recursive: true, force: true });
});

describe("two tutors on one review document", () => {
  it("lets each tutor save only their canonical apprentice and keeps the other review", async () => {
    const { GET, POST } = await import("@/app/api/reviews-assistant/tutor-state/route");
    getEffectiveSession.mockResolvedValue(tutor(tutorAId, "Same Display Name"));
    const firstRead = await GET();
    const firstBody = (await firstRead.json()) as {
      state: { version: number; learners: Array<{ id: string }>; savedReviews: Array<{ id: string }> };
    };
    expect(firstBody.state.learners.map((item) => item.id)).toEqual([apprenticeA]);
    expect(firstBody.state.savedReviews.map((item) => item.id)).toEqual(["review-a"]);

    const saved = await POST(
      new Request("http://localhost/api/reviews-assistant/tutor-state", {
        method: "POST",
        body: JSON.stringify({
          appBuild: "out-165",
          version: firstBody.state.version,
          savedReviews: [
            { id: "review-a", learnerId: apprenticeA, tutorNotes: "A updated" },
            { id: "review-b", learnerId: apprenticeB, tutorNotes: "stolen" },
          ],
        }),
      }),
    );
    expect(saved.status).toBe(200);
    const savedBody = (await saved.json()) as { state: { savedReviews: Array<{ tutorNotes?: string }> } };
    expect(savedBody.state.savedReviews.map((item) => item.tutorNotes)).toEqual(["A updated"]);

    getEffectiveSession.mockResolvedValue(tutor(tutorBId, "Same Display Name"));
    const second = await GET();
    const secondBody = (await second.json()) as {
      state: { version: number; savedReviews: Array<{ id: string; tutorNotes?: string }> };
    };
    expect(secondBody.state.savedReviews).toEqual([
      expect.objectContaining({ id: "review-b", tutorNotes: "b-private" }),
    ]);
    const version = secondBody.state.version;
    const bSaved = await POST(
      new Request("http://localhost/api/reviews-assistant/tutor-state", {
        method: "POST",
        body: JSON.stringify({
          appBuild: "out-165",
          version,
          savedReviews: [{ id: "review-b", learnerId: apprenticeB, tutorNotes: "B updated" }],
        }),
      }),
    );
    expect(bSaved.status).toBe(200);

    const stale = await POST(
      new Request("http://localhost/api/reviews-assistant/tutor-state", {
        method: "POST",
        body: JSON.stringify({
          appBuild: "out-165",
          version,
          savedReviews: [{ id: "review-b", learnerId: apprenticeB, tutorNotes: "stale" }],
        }),
      }),
    );
    expect(stale.status).toBe(409);
    const conflict = (await stale.json()) as { state: { savedReviews: Array<{ tutorNotes?: string }> } };
    expect(conflict.state.savedReviews[0]?.tutorNotes).toBe("B updated");

    getEffectiveSession.mockResolvedValue(tutor(tutorAId, "Same Display Name"));
    const after = await GET();
    const afterBody = (await after.json()) as { state: { savedReviews: Array<{ tutorNotes?: string }> } };
    expect(afterBody.state.savedReviews[0]?.tutorNotes).toBe("A updated");
  });

  it("refuses an upload for an apprentice outside the canonical caseload", async () => {
    const { POST } = await import("@/app/api/reviews-assistant/review-attachment/route");
    getEffectiveSession.mockResolvedValue(tutor(tutorAId, "Same Display Name"));
    const denied = await POST(
      new Request(`http://localhost/api/reviews-assistant/review-attachment?learner=${apprenticeB}&name=note.pdf`, {
        method: "POST",
        headers: { "content-type": "application/pdf" },
        body: Buffer.from("%PDF-1.4"),
      }),
    );
    expect(denied.status).toBe(403);
    const allowed = await POST(
      new Request(`http://localhost/api/reviews-assistant/review-attachment?learner=${apprenticeA}&name=note.pdf`, {
        method: "POST",
        headers: { "content-type": "application/pdf" },
        body: Buffer.from("%PDF-1.4"),
      }),
    );
    expect(allowed.status).toBe(200);
    const payload = (await allowed.json()) as { attachment: { id: string; learnerId: string; portalApprenticeId?: string } };
    expect(payload.attachment.learnerId).toBe(apprenticeA);
    expect(payload.attachment.portalApprenticeId).toBe(apprenticeA);

    getEffectiveSession.mockResolvedValue(tutor(tutorBId, "Same Display Name"));
    const hidden = await (await import("@/app/api/reviews-assistant/review-attachment/route")).GET(
      new Request(`http://localhost/api/reviews-assistant/review-attachment?id=${payload.attachment.id}`),
    );
    expect(hidden.status).toBe(403);
  });
});
