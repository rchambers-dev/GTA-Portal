import { renderSharedRecordPage } from "@/shell/guards/shared-record-page";

type Props = { params: Promise<{ employerId: string }> };

export default async function EmployerRecordPage({ params }: Props) {
  const { employerId } = await params;
  return renderSharedRecordPage(
    `/employers/${employerId}`,
    "Employer record",
    `Canonical employer page (${employerId}).`,
  );
}
