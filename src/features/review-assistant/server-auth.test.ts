import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("review server authority", () => {
  it("takes the actor from the server session, not a client role claim", () => {
    const runtime = readFileSync(
      path.join(process.cwd(), "src/features/review-assistant/source-runtime.ts"),
      "utf8",
    );
    const attachment = readFileSync(
      path.join(process.cwd(), "src/app/api/reviews-assistant/review-attachment/route.ts"),
      "utf8",
    );
    expect(runtime).toContain("getStandalonePorts().auth.getEffectiveSession()");
    expect(runtime).not.toContain("x-portal-role");
    expect(attachment).not.toContain("body.role");
    expect(attachment).toContain("requireReviewActor()");
    expect(attachment).toContain("reviewPageDenied");
  });
});
