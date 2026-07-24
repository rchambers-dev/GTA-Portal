import { renderSharedRecordPage } from "@/shell/guards/shared-record-page";

type Props = { params: Promise<{ feedbackId: string }> };

export default async function CurriculumFeedbackRecordPage({ params }: Props) {
  const { feedbackId } = await params;
  return renderSharedRecordPage(
    `/curriculum-feedback/${feedbackId}`,
    "Curriculum feedback item",
    `Canonical curriculum feedback item (${feedbackId}).`,
  );
}
