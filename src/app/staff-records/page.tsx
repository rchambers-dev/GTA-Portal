import { StaffPackSearchScreen } from "@/features/staff-records";
import { requireLearnerWorkspaceAccess } from "@/shell/guards/learner-routes";

type Props = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

/**
 * Search entry for staff employment files — parallel to /learners.
 */
export default async function StaffRecordsIndexPage({ searchParams }: Props) {
  await requireLearnerWorkspaceAccess("/staff-records");
  const params = await searchParams;
  const fromRaw = params.from;
  const from =
    typeof fromRaw === "string" && fromRaw.trim()
      ? fromRaw.trim()
      : "management";

  return <StaffPackSearchScreen fromContext={from} />;
}
