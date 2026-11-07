import { redirect } from "next/navigation";
import { requireMentorWorkspace } from "@/shell/guards/mentor-workspace";

type Props = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

/**
 * Progress Mentor "Apprentices" still uses the shared lookup URL.
 * That URL now opens the Apprentices page after its own session check.
 * Lifecycle and pack pages are unchanged.
 */
export default async function MentorApprenticesPage({ searchParams }: Props) {
  await requireMentorWorkspace("/workspaces/progress-mentor/apprentices");
  const params = await searchParams;
  const from = params.from === "lifecycle" ? "?from=lifecycle" : "";
  redirect(`/apprentices${from}`);
}
