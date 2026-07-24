import { renderSharedRecordPage } from "@/shell/guards/shared-record-page";

type Props = { params: Promise<{ evidenceId: string }> };

export default async function EvidenceRecordPage({ params }: Props) {
  const { evidenceId } = await params;
  return renderSharedRecordPage(
    `/evidence/${evidenceId}`,
    "Evidence record",
    `Canonical evidence page (${evidenceId}).`,
  );
}
