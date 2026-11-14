import { ApprenticePageShell } from "@/features/apprentice-portal/components/ApprenticePageShell";
import { loadReviewCycle } from "../domain/cycle-repository";
import { CycleView } from "./CycleView";

export async function CycleScreen({ workspace }: { workspace: "administration" | "management" }) {
  const page = await loadReviewCycle();
  return (
    <ApprenticePageShell eyebrow="Reviews" title="Review cycle" hideHeader>
      <CycleView workspace={workspace} page={page} />
    </ApprenticePageShell>
  );
}
