import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { learnerIdsOutside, portalScriptJson } from "./portal-roster";

describe("review assistant bundle", () => {
  it("matches a fresh production build and has no hardcoded tutor roster", () => {
    execFileSync("node", ["server/build.js"], {
      cwd: path.join(process.cwd(), "integrations/gta-reviews"),
      env: {
        ...process.env,
        NODE_ENV: "production",
        NODE_SUPABASE_URL: "",
        NODE_SUPABASE_ANON_KEY: "",
        NEXT_PUBLIC_SUPABASE_URL: "",
        SUPABASE_URL: "",
      },
    });
    const built = readFileSync(path.join(process.cwd(), "integrations/gta-reviews/dist/app.js"));
    const shipped = readFileSync(path.join(process.cwd(), "public/review-assistant/app.js"));
    const hash = (bytes: Buffer) => createHash("sha256").update(bytes).digest("hex");
    expect(hash(shipped)).toBe(hash(built));
    const html = readFileSync(path.join(process.cwd(), "public/review-assistant/index.html"), "utf8");
    expect(shipped.toString("utf8")).not.toContain("John Pearson");
    expect(html).not.toContain("John Pearson");
    expect(shipped.toString("utf8")).toContain("__PORTAL_REVIEW_STAFF__");
  });

  it("escapes the injected roster and refuses unknown learner ids", () => {
    expect(portalScriptJson({ name: "</script><script>" })).not.toContain("</script>");
    expect(
      learnerIdsOutside([], { learners: [{ id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc" }] }),
    ).toMatch(/No Portal apprentices/);
    expect(
      learnerIdsOutside(
        ["cccccccc-cccc-4ccc-8ccc-cccccccccccc"],
        { learners: [{ id: "dddddddd-dddd-4ddd-8ddd-dddddddddddd" }] },
      ),
    ).toMatch(/does not create one/);
    expect(
      learnerIdsOutside(["cccccccc-cccc-4ccc-8ccc-cccccccccccc"], {
        learners: [{ id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc" }],
      }),
    ).toBeNull();
  });
});
