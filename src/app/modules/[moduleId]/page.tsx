import { renderSharedRecordPage } from "@/shell/guards/shared-record-page";

type Props = { params: Promise<{ moduleId: string }> };

export default async function ModuleRecordPage({ params }: Props) {
  const { moduleId } = await params;
  return renderSharedRecordPage(
    `/modules/${moduleId}`,
    "Module record",
    `Canonical module page (${moduleId}).`,
  );
}
