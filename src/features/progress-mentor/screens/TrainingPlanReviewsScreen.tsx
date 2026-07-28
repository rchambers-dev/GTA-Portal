"use client";

import { TrainingPlanAgreementPanel } from "@/features/learner-portal/components/TrainingPlanAgreementPanel";
import { ALEX_PROFILE } from "@/features/learner-portal/domain/mock-learner";
import { MentorPageShell } from "../components/MentorWorkQueue";

export function TrainingPlanReviewsScreen() {
  return (
    <MentorPageShell
      eyebrow="Progress Mentor · Training Plans"
      title="Tripartite Training Plan Reviews"
      description="Review learner, employer, and provider commitments before signing the training plan agreement."
    >
      <TrainingPlanAgreementPanel
        audience="mentor"
        learnerName={ALEX_PROFILE.displayName}
        employerName={ALEX_PROFILE.employerName}
        employerContact={ALEX_PROFILE.employerContact}
        mentorName={ALEX_PROFILE.mentorName}
      />
    </MentorPageShell>
  );
}
