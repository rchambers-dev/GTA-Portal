import { describe, expect, it } from "vitest";
import { ANALYTICS_TABLES, queueRefresh } from "./analytics-live";

describe("analytics live refresh", () => {
  it("collapses a burst of table changes into one refresh", () => {
    const queued: Array<() => void> = [];
    let refreshed = 0;
    const kick = queueRefresh(
      (run) => {
        queued.push(run);
        return queued.length;
      },
      (id) => {
        if (id > 0) queued[id - 1] = () => undefined;
      },
      () => {
        refreshed += 1;
      },
    );
    kick();
    kick();
    kick();
    queued.forEach((run) => run());
    expect(refreshed).toBe(1);
    expect(ANALYTICS_TABLES).toContain("reviews");
    expect(ANALYTICS_TABLES).toContain("learner_concerns");
    expect(ANALYTICS_TABLES).toContain("candidates");
  });
});
