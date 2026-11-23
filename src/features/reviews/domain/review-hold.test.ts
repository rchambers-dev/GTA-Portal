import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const sql = readFileSync(
  new URL("../../../../supabase/migrations/20261123140000_review_holds.sql", import.meta.url),
  "utf8",
);

describe("review holds migration", () => {
  it("keeps an active hold out of the tutor queue without a pack hold event", () => {
    expect(sql).toContain("create table public.review_holds");
    expect(sql).toContain("where released_at is null");
    expect(sql).toContain("action, summary, payload)");
    expect(sql).toContain("'hold_set'");
    expect(sql).toContain("'hold_released'");
    expect(sql).not.toContain("'held'");
    expect(sql).not.toContain("review_packs.hold_reason");
    expect(sql).toContain("r.on_hold");
    expect(sql).toContain("This learner is on hold until");
    expect(sql).toContain("taken off hold because it was booked");
    expect(sql).not.toContain("function public.complete_review");
    expect(sql).toContain("Only an open review can be put on hold");
  });
});
