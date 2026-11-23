import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const sql = readFileSync(
  new URL("../../../../supabase/migrations/20261123170000_verify_clears_stop_lock.sql", import.meta.url),
  "utf8",
);

describe("verify clears a stop lock", () => {
  it("clears the lock columns and records the clear only when verifying", () => {
    const verifyAt = sql.indexOf("if p_verified then");
    const undoAt = sql.indexOf("\n  else\n", verifyAt);
    const verify = sql.slice(verifyAt, undoAt);
    const undo = sql.slice(undoAt, sql.indexOf("end if;", undoAt));
    expect(verify).toContain("verified = true");
    expect(verify).toContain("arrive_minutes = v_arrive");
    expect(verify).toContain("locked_until_minutes = null");
    expect(verify).toContain("lock_arrive_minutes = null");
    expect(verify).toContain("lock_leave_minutes = null");
    expect(verify).toContain("locked_at = null");
    expect(verify).toContain("lock_expires_at = null");
    expect(verify).toContain("insert into public.review_lock_clears");
    expect(verify).toContain("on conflict (gta_id) do update set cleared_at = excluded.cleared_at");
    expect(undo).toContain("verified = false");
    expect(undo).not.toContain("locked_at");
    expect(sql).toContain("where s.verified and s.locked_at is not null");
  });
});
