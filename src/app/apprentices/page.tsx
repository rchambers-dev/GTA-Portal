import { ApprenticePackSearchScreen } from "@/features/apprentice-lifecycle";
import { requireApprenticeWorkspaceAccess } from "@/shell/guards/apprentice-routes";

type Props = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

/**
 * Blank search entry for the shared apprentice file pack.
 * Selecting an apprentice opens `/apprentices/[apprenticeId]`.
 * Live mode: real intake / enrolment records (via admin store on the client).
 */
export default async function ApprenticesIndexPage({ searchParams }: Props) {
  await requireApprenticeWorkspaceAccess("/apprentices");
  const params = await searchParams;
  const fromRaw = params.from;
  const from =
    typeof fromRaw === "string" && fromRaw.trim()
      ? fromRaw.trim()
      : "apprentices";

  return <ApprenticePackSearchScreen apprentices={[]} fromContext={from} />;
}
