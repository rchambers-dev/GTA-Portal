"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { TutorCeaTaskReviewScreen } from "./TutorCeaTaskReviewScreen";
import {
  ApprenticePageShell,
} from "@/features/apprentice-portal/components/ApprenticePageShell";

function ReviewInner({ audience }: { audience: "teacher" | "employer" }) {
  const sp = useSearchParams();
  const apprenticeId = sp.get("apprenticeId")?.trim() ?? "";
  const packId = sp.get("packId")?.trim() ?? "";
  const taskId = sp.get("taskId")?.trim() ?? "";

  if (!apprenticeId || !packId || !taskId) {
    return (
      <ApprenticePageShell
        title="Missing document"
        description="Open a submission from the sign-off queue."
      >
        <p>apprenticeId, packId and taskId are required.</p>
      </ApprenticePageShell>
    );
  }

  return (
    <TutorCeaTaskReviewScreen
      apprenticeId={apprenticeId}
      packId={packId}
      taskId={taskId}
      audience={audience}
    />
  );
}

export function TutorCeaReviewRoute({
  audience = "teacher",
}: {
  audience?: "teacher" | "employer";
}) {
  return (
    <Suspense
      fallback={
        <ApprenticePageShell title="Loading document…" description="">
          <p>Loading…</p>
        </ApprenticePageShell>
      }
    >
      <ReviewInner audience={audience} />
    </Suspense>
  );
}
