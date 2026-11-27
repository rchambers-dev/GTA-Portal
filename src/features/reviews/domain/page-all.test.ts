import { describe, expect, it } from "vitest";
import { pageAll } from "./page-all";

describe("pageAll", () => {
  it("joins pages until a short page", async () => {
    const result = await pageAll<number>(async (from) => {
      if (from === 0) return { data: Array.from({ length: 1000 }, (_, index) => index), error: null };
      return { data: [1000, 1001], error: null };
    });
    expect(result.error).toBeNull();
    expect(result.data).toHaveLength(1002);
    expect(result.data[1001]).toBe(1001);
  });

  it("returns no rows when a page fails, instead of a partial count", async () => {
    const result = await pageAll<number>(async () => ({ data: [1], error: { message: "timeout" } }));
    expect(result.data).toEqual([]);
    expect(result.error?.message).toBe("timeout");
  });
});
