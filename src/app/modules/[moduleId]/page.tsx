import { redirect } from "next/navigation";

type Props = { params: Promise<{ moduleId: string }> };

/** Old module record — superseded by programme delivery / college tasks. */
export default async function ModuleRecordPage({ params }: Props) {
  await params;
  redirect("/staff/programme-delivery");
}
