import { renderSharedRecordPage } from "@/shell/guards/shared-record-page";

type Props = { params: Promise<{ caseId: string }> };

export default async function EmployerConcernRecordPage({ params }: Props) {
  const { caseId } = await params;
  return renderSharedRecordPage(
    `/employer-concerns/${caseId}`,
    "Employer concern case",
    `Canonical employer concern case (${caseId}).`,
  );
}
