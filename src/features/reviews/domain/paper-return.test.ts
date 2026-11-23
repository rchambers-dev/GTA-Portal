import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const sql = readFileSync(
  new URL("../../../../supabase/migrations/20261123120000_paper_return_waiting_snapshot.sql", import.meta.url),
  "utf8",
);
const undo = readFileSync(
  new URL("../../../../supabase/migrations/20261118120000_paper_review_return.sql", import.meta.url),
  "utf8",
);

function body(source: string, name: string): string {
  const start = source.indexOf(`function public.${name}`);
  const next = source.indexOf("revoke all on function", start);
  return source.slice(start, next === -1 ? undefined : next);
}

describe("paper return of a waiting pack", () => {
  const receive = body(sql, "record_paper_review_return");
  const undoBody = body(undo, "undo_paper_review_return");

  it("fills the tutor and snapshot before leaving waiting, and does not release the pack", () => {
    expect(receive).toContain("v_pack.stage = 'waiting'");
    expect(receive).toContain("t.tutor_id");
    expect(receive).toContain("t.apprentice_id = v_pack.gta_id and t.end_date is null");
    expect(receive).toContain("has no current tutor, so this review cannot be marked received");
    expect(receive).toContain("learner_snapshot = public.review_pack_snapshot(v_pack.review_id)");
    expect(receive).toContain("snapshot_at = now()");
    expect(receive).toContain("t.kind = 'new'");
    expect(receive).toContain("on conflict (pack_id, kind, slot) do nothing");
    expect(receive).not.toContain("review_pack_release_core");
    expect(receive).not.toContain("'released'");
    expect(receive).toContain("'submitted', 'to_book'");
    expect(receive).toContain("'sent_known', v_sent");
    expect(receive).toContain("review_pack_sync_booking");
    expect(receive).toContain("v_pack.stage not in ('waiting', 'with_tutor')");
  });

  it("undo still sends a never-released pack back to waiting", () => {
    expect(undoBody).toContain("e.event_type = 'released'");
    expect(undoBody).toContain("case when v_sent then 'with_tutor' else 'waiting' end");
    expect(undoBody).toContain("entry_method = 'paper'");
    expect(undoBody).toContain("v_pack.stage <> 'to_book'");
  });
});
