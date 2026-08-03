import { notFound } from "next/navigation";
import { StaffPackWorkspaceScreen } from "@/features/staff-records";
import { requireApprenticeWorkspaceAccess } from "@/shell/guards/apprentice-routes";

type Props = {
  params: Promise<{ staffId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

/**
 * Individual staff employment file — parallel to /apprentices/[apprenticeId].
 */
export default async function StaffRecordPage({ params, searchParams }: Props) {
  await requireApprenticeWorkspaceAccess("/staff-records");
  const { staffId } = await params;
  if (!staffId?.trim()) notFound();

  const query = await searchParams;
  const fromRaw = query.from;
  const from =
    typeof fromRaw === "string" && fromRaw.trim()
      ? fromRaw.trim()
      : "management";

  return (
    <StaffPackWorkspaceScreen staffId={staffId.trim()} fromContext={from} />
  );
}
