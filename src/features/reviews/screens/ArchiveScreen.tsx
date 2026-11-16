import { ApprenticePageShell } from "@/features/apprentice-portal/components/ApprenticePageShell";
import { loadArchivePage } from "../domain/archive-repository";
import { ArchiveView } from "./ArchiveView";

export async function ArchiveScreen() {
  const page = await loadArchivePage();
  return (
    <ApprenticePageShell eyebrow="Reviews" title="Archive" hideHeader>
      <ArchiveView page={page} />
    </ApprenticePageShell>
  );
}
