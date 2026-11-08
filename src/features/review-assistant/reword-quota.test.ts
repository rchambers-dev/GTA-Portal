import { afterEach, describe, expect, it, vi } from "vitest";
import { buildEffectiveSession } from "@/lib/permissions/effective-permissions";
import { PERMISSIONS } from "@/lib/permissions/capabilities";

const getEffectiveSession = vi.fn();
const rpc = vi.fn();
const complete = vi.fn();

vi.mock("@/adapters/standalone", () => ({
  getStandalonePorts: () => ({
    auth: { getEffectiveSession: () => getEffectiveSession() },
  }),
}));

vi.mock("@/adapters/supabase/client", () => ({
  createSupabaseAdminClient: () => ({ rpc }),
}));

vi.mock("@/lib/ai/client", () => ({
  resolveAiProvider: () => ({ complete }),
}));

const tutor = buildEffectiveSession(
  {
    id: "11111111-1111-4111-8111-111111111111",
    name: "Tutor",
    initials: "T",
    email: "tutor@example.test",
    baseRole: "Tutor",
    responsibilities: [],
    workspace: "staff",
    permissions: [PERMISSIONS.REVIEWS_MANAGE],
  },
  [],
);

afterEach(() => {
  delete process.env.REVIEW_ASSISTANT_AI;
  delete process.env.AI_API_KEY;
  delete process.env.OPENAI_API_KEY;
  rpc.mockReset();
  complete.mockReset();
});

describe("review reword stays off", () => {
  it("does not call a model or the rate function when a generic key or the opt-in flag is set", async () => {
    process.env.AI_API_KEY = "present-but-not-for-reviews";
    process.env.OPENAI_API_KEY = "present-but-not-for-reviews";
    process.env.REVIEW_ASSISTANT_AI = "on";
    getEffectiveSession.mockResolvedValue(tutor);
    const { POST } = await import("@/app/api/reviews-assistant/tutor-reword/route");
    const response = await POST(
      new Request("http://localhost/api/reviews-assistant/tutor-reword", {
        method: "POST",
        body: JSON.stringify({ text: "Met the target." }),
      }),
    );
    expect(response.status).toBe(503);
    const body = (await response.json()) as { error: string };
    expect(body.error).toMatch(/disabled/);
    expect(body.error).toMatch(/two hours/);
    expect(rpc).not.toHaveBeenCalled();
    expect(complete).not.toHaveBeenCalled();
  });
});
