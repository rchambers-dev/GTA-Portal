import type { Metadata } from "next";
import { TUTOR_REVIEW_TITLE } from "@/features/tutor-reviews/domain/catalogue";
import { readPublicForm } from "@/features/tutor-reviews/domain/repository";
import { TutorReviewForm } from "@/features/tutor-reviews/screens/TutorReviewForm";

export const metadata: Metadata = {
  title: TUTOR_REVIEW_TITLE,
  robots: { index: false, follow: false },
};

export default async function TutorReviewPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const form = await readPublicForm(decodeURIComponent(token));
  return <TutorReviewForm token={token} form={form} />;
}
