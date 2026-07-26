import { notFound } from "next/navigation";
import { StaffPackWorkspaceScreen } from "@/features/staff-records";
import { requireLearnerWorkspaceAccess } from "@/shell/guards/learner-routes";

type Props = {
  params: Promise<{ staffId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

/**
 * Individual staff employment file — parallel to /learners/[learnerId].
 */
export default async function StaffRecordPage({ params, searchParams }: Props) {
  await requireLearnerWorkspaceAccess("/staff-records");
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
