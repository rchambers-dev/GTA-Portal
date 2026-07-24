import { renderSharedRecordPage } from "@/shell/guards/shared-record-page";

type Props = { params: Promise<{ programmeId: string }> };

export default async function ProgrammeRecordPage({ params }: Props) {
  const { programmeId } = await params;
  return renderSharedRecordPage(
    `/programmes/${programmeId}`,
    "Programme record",
    `Canonical programme page (${programmeId}). Curriculum editors still use /curriculum tools for drafts.`,
  );
}
