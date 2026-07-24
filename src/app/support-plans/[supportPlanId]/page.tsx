import { renderSharedRecordPage } from "@/shell/guards/shared-record-page";

type Props = { params: Promise<{ supportPlanId: string }> };

export default async function SupportPlanRecordPage({ params }: Props) {
  const { supportPlanId } = await params;
  return renderSharedRecordPage(
    `/support-plans/${supportPlanId}`,
    "Support plan record",
    `Canonical support plan (${supportPlanId}).`,
  );
}
