import { redirect } from "next/navigation";
import { requireApprenticeWorkspaceAccess } from "@/shell/guards/apprentice-routes";

type Props = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

/**
 * The separate apprentice lookup page now opens the Apprentices layout.
 * Pack pages under /apprentices/[apprenticeId] stay. This route still
 * requires a signed-in session before the redirect.
 */
export default async function ApprenticesIndexPage({ searchParams }: Props) {
  await requireApprenticeWorkspaceAccess("/apprentices");
  const params = await searchParams;
  const fromRaw = params.from;
  const from = typeof fromRaw === "string" ? fromRaw.trim() : "";
  if (from === "management") redirect("/management/intake");
  redirect("/administration/intake");
}
