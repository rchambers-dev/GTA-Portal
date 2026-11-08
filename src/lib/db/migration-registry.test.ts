import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { migrationDecision } from "../../../scripts/migration-registry.mjs";

const appliedSha = "283720831f5fd05170212dd3b637eecf135498c176a20e48fd49ae01cf70654d";

describe("migration registry", () => {
  it("keeps the applied 035 identity and refuses a different 035", () => {
    const file = readFileSync(
      path.join(process.cwd(), "supabase/migrations/035_review_assistant_store.sql"),
    );
    const sha = createHash("sha256").update(file).digest("hex");
    expect(sha).toBe(appliedSha);
    expect(migrationDecision("035_review_assistant_store.sql", sha)).toMatchObject({ action: "skip" });
    expect(migrationDecision("035_review_assistant_store.sql", "different")).toMatchObject({ action: "refuse" });
    expect(migrationDecision("035_employer_directory.sql", "abc")).toMatchObject({ action: "refuse" });
    expect(migrationDecision("036_review_assistant_portal.sql", "abc")).toMatchObject({ action: "skip" });
    expect(migrationDecision("035_review_assistant_store_rollback.sql", "abc")).toMatchObject({ action: "skip" });
    expect(migrationDecision("036_review_assistant_portal_rollback.sql", "abc")).toMatchObject({ action: "skip" });
    expect(migrationDecision("034_independent_teaching_groups.sql", "abc")).toMatchObject({ action: "apply" });
  });
});
