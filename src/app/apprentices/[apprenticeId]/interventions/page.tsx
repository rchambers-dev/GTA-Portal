import { redirect } from "next/navigation";
import { apprenticeRecordHref } from "@/features/shared-records";
import { requireApprenticeWorkspaceAccess } from "@/shell/guards/apprentice-routes";

type Props = {
  params: Promise<{ apprenticeId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function ApprenticeInterventionsRedirect({
  params,
  searchParams,
}: Props) {
  const { apprenticeId } = await params;
  const query = await searchParams;
  await requireApprenticeWorkspaceAccess(`/apprentices/${apprenticeId}`);
  const from = typeof query.from === "string" ? query.from : "lifecycle";
  redirect(apprenticeRecordHref(apprenticeId, { tab: "interventions", from }));
}
