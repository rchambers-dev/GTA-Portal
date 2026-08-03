import { StaffPackSearchScreen } from "@/features/staff-records";
import { requireApprenticeWorkspaceAccess } from "@/shell/guards/apprentice-routes";

type Props = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

/**
 * Search entry for staff employment files — parallel to /apprentices.
 */
export default async function StaffRecordsIndexPage({ searchParams }: Props) {
  await requireApprenticeWorkspaceAccess("/staff-records");
  const params = await searchParams;
  const fromRaw = params.from;
  const from =
    typeof fromRaw === "string" && fromRaw.trim()
      ? fromRaw.trim()
      : "management";

  return <StaffPackSearchScreen fromContext={from} />;
}
