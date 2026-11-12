import { describe, expect, it } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { saveReviewState, readReviewState } from "./state-store";
import { versionOf } from "./version-rules";

describe("review state versions", () => {
  it("matches the original version rule and rejects a stale save", async () => {
    const original = (await import(
      pathToFileURL(
        path.join(process.cwd(), "integrations/gta-reviews/server/app-state.js"),
      ).href
    )) as { versionOf: (payload: { version?: unknown }) => number };
    expect(versionOf({ version: "0" })).toBe(original.versionOf({ version: "0" }));
    expect(versionOf({ version: "4" })).toBe(4);

    const dir = mkdtempSync(path.join(tmpdir(), "review-state-"));
    const previous = process.env.REVIEW_ASSISTANT_STATE_FILE;
    process.env.REVIEW_ASSISTANT_STATE_FILE = path.join(dir, "state.json");
    try {
      const first = saveReviewState({ learners: [{ id: "example-1", name: "Example Learner" }] }, 1);
      expect(first.status).toBe(200);
      if (first.status === 200 && "version" in first.body) expect(first.body.version).toBe(2);
      const stale = saveReviewState({ learners: [{ id: "example-1", name: "Changed" }] }, 1);
      expect(stale.status).toBe(409);
      if (stale.status === 409) expect(stale.body.error).toBe("Version conflict");
      expect(readReviewState().learners?.[0]?.name).toBe("Example Learner");
    } finally {
      if (previous == null) delete process.env.REVIEW_ASSISTANT_STATE_FILE;
      else process.env.REVIEW_ASSISTANT_STATE_FILE = previous;
      rmSync(dir, { recursive: true, force: true });
    }
  });
});