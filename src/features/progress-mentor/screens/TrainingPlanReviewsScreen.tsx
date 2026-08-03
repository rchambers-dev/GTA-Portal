"use client";

import { TrainingPlanAgreementPanel } from "@/features/apprentice-portal/components/TrainingPlanAgreementPanel";
import { MentorPageShell } from "../components/MentorWorkQueue";

export function TrainingPlanReviewsScreen() {
  return (
    <MentorPageShell
      eyebrow="Progress Mentor · Training Plans"
      title="Tripartite Training Plan Reviews"
      description="Review apprentice, employer, and provider commitments before signing the training plan agreement."
    >
      <TrainingPlanAgreementPanel
        audience="mentor"
        apprenticeName=""
        employerName=""
        employerContact=""
        mentorName=""
      />
    </MentorPageShell>
  );
}
