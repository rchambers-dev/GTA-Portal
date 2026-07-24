import { renderSharedRecordPage } from "@/shell/guards/shared-record-page";

type Props = { params: Promise<{ interventionId: string }> };

export default async function InterventionRecordPage({ params }: Props) {
  const { interventionId } = await params;
  return renderSharedRecordPage(
    `/interventions/${interventionId}`,
    "Intervention record",
    `Canonical intervention page (${interventionId}).`,
  );
}
