/** Permission and ownership for /reviews, including ?from=tutor and ?pack=. */

export type ReviewsGate =
  | { ok: false; reason: "sign-in" | "forbidden" }
  | { ok: true; mode: "shared" | "tutor-list" | "pack" };

export function gateReviews(input: {
  signedIn: boolean;
  canManage: boolean;
  canTutor: boolean;
  from: string;
  pack: string;
}): ReviewsGate {
  if (!input.signedIn) return { ok: false, reason: "sign-in" };
  const tutorView = input.from === "tutor" || Boolean(input.pack);
  if (tutorView) {
    if (!input.canTutor && !input.canManage) return { ok: false, reason: "forbidden" };
    return { ok: true, mode: input.pack ? "pack" : "tutor-list" };
  }
  if (!input.canManage && input.canTutor) return { ok: true, mode: "tutor-list" };
  if (!input.canManage) return { ok: false, reason: "forbidden" };
  return { ok: true, mode: "shared" };
}

export function canReadReviewPack(input: {
  canManage: boolean;
  canTutor: boolean;
  userId: string;
  tutorId: string | null;
}): boolean {
  if (input.canManage) return true;
  return input.canTutor && Boolean(input.tutorId) && input.tutorId === input.userId;
}
