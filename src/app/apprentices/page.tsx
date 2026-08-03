import { listApprenticeSearchHits } from "@/adapters/fictional";
import { ApprenticePackSearchScreen } from "@/features/apprentice-lifecycle";
import { isDemoModeEnabled } from "@/lib/env/portal";
import { requireApprenticeWorkspaceAccess } from "@/shell/guards/apprentice-routes";

type Props = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

/**
 * Blank search entry for the shared apprentice file pack.
 * Selecting an apprentice opens `/apprentices/[apprenticeId]`.
 * Live mode: only real intake / enrolment records (via admin store).
 * Demo mode: also includes fictional caseload seeds.
 */
export default async function ApprenticesIndexPage({ searchParams }: Props) {
  await requireApprenticeWorkspaceAccess("/apprentices");
  const params = await searchParams;
  const fromRaw = params.from;
  const from =
    typeof fromRaw === "string" && fromRaw.trim()
      ? fromRaw.trim()
      : "apprentices";
  const apprentices = isDemoModeEnabled() ? listApprenticeSearchHits() : [];

  return <ApprenticePackSearchScreen apprentices={apprentices} fromContext={from} />;
}
