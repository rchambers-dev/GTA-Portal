import { describe, expect, it } from "vitest";
import { canReadReviewPack, gateReviews } from "./reviews-access";

describe("reviews query access (DEV-221)", () => {
  it("requires the same review permission for from=tutor and pack as the reviews route", () => {
    expect(gateReviews({ signedIn: true, canManage: false, canTutor: false, from: "tutor", pack: "" })).toEqual({
      ok: false,
      reason: "forbidden",
    });
    expect(gateReviews({ signedIn: true, canManage: false, canTutor: false, from: "", pack: "pack-1" })).toEqual({
      ok: false,
      reason: "forbidden",
    });
    expect(gateReviews({ signedIn: false, canManage: false, canTutor: true, from: "tutor", pack: "" })).toEqual({
      ok: false,
      reason: "sign-in",
    });
    expect(gateReviews({ signedIn: true, canManage: false, canTutor: true, from: "tutor", pack: "" }).ok).toBe(true);
    expect(gateReviews({ signedIn: true, canManage: true, canTutor: false, from: "", pack: "" })).toEqual({
      ok: true,
      mode: "shared",
    });
  });

  it("only lets a tutor open their own pack", () => {
    expect(canReadReviewPack({ canManage: false, canTutor: true, userId: "tutor-a", tutorId: "tutor-a" })).toBe(true);
    expect(canReadReviewPack({ canManage: false, canTutor: true, userId: "tutor-a", tutorId: "tutor-b" })).toBe(false);
    expect(canReadReviewPack({ canManage: true, canTutor: false, userId: "manager", tutorId: "tutor-b" })).toBe(true);
    expect(canReadReviewPack({ canManage: false, canTutor: false, userId: "tutor-a", tutorId: "tutor-a" })).toBe(false);
  });
});
