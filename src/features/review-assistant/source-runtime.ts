import path from "node:path";
import { pathToFileURL } from "node:url";
import { NextResponse } from "next/server";
import { getStandalonePorts } from "@/adapters/standalone";
import type { EffectiveSession } from "@/lib/portal/types";
import { pageApiAllowed } from "@/features/staff-page-access/enforce";
import { reviewAssistantAccess, type ReviewAssistantAccess } from "./access";
import type { ReviewState } from "./state-store";

function sourceUrl(relativePath: string) {
  return pathToFileURL(
    path.join(/*turbopackIgnore: true*/ process.cwd(), relativePath),
  ).href;
}

export async function requireReviewActor(): Promise<
  | { session: EffectiveSession; access: Exclude<ReviewAssistantAccess, "denied"> }
  | { error: NextResponse }
> {
  const session = await getStandalonePorts().auth.getEffectiveSession();
  if (!session) {
    return { error: NextResponse.json({ error: "Authentication required." }, { status: 401 }) };
  }
  const access = reviewAssistantAccess(session);
  if (access === "denied") {
    return { error: NextResponse.json({ error: "Access denied." }, { status: 403 }) };
  }
  return { session, access };
}

export function reviewPageDenied(
  session: EffectiveSession,
  pathname: string,
  mode: "read" | "edit",
) {
  const decision = pageApiAllowed(session, pathname, mode);
  if (decision.ok) return null;
  return NextResponse.json({ error: decision.error }, { status: 403 });
}

export async function tutorNameKey() {
  const planner = (await import(
    sourceUrl("integrations/gta-reviews/source/src/planner.js")
  )) as {
    tutorLookupKey: (value: string) => string;
    normaliseTutor: (value: string) => string;
  };
  return (value: string) => planner.tutorLookupKey(planner.normaliseTutor(value));
}

export async function rejectOutdatedBuild(clientBuild: unknown) {
  const build = (await import(sourceUrl("integrations/gta-reviews/shared/app-build.js"))) as {
    APP_BUILD: string;
    isOutdatedBuild: (value: unknown) => boolean;
  };
  if (!build.isOutdatedBuild(clientBuild)) return null;
  return NextResponse.json(
    {
      error: "This tab is out of date. Reload the page before saving.",
      code: "outdated-build",
      appBuild: build.APP_BUILD,
    },
    { status: 426 },
  );
}

export async function preserveOfficeDocument(incoming: ReviewState, stored: ReviewState) {
  const locks = (await import(
    sourceUrl("integrations/gta-reviews/source/src/plan-locks.js")
  )) as {
    applyNewerPlanSnapshot: (state: ReviewState, newer: ReviewState) => void;
    mergePreservedPlanLocks: (incoming: ReviewState, existing: ReviewState) => ReviewState;
    mergeLearnerRecords: (
      incoming: ReviewState,
      existing: ReviewState,
      base?: ReviewState,
    ) => ReviewState;
  };
  const base = Date.parse(String(incoming.baseSavedAt || "")) || 0;
  const storedTime = Date.parse(String(stored.savedAt || "")) || 0;
  if (base && storedTime > base) locks.applyNewerPlanSnapshot(incoming, stored);
  else {
    locks.mergePreservedPlanLocks(incoming, stored);
    locks.mergeLearnerRecords(incoming, stored, stored);
  }
  return incoming;
}
