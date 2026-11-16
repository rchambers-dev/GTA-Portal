import { ApprenticePageShell } from "@/features/apprentice-portal/components/ApprenticePageShell";
import { loadOutPage } from "../domain/out-repository";
import { OutView } from "./OutView";

export async function OutScreen() {
  const page = await loadOutPage();
  return (
    <ApprenticePageShell eyebrow="Reviews" title="Out" hideHeader>
      <OutView page={page} />
    </ApprenticePageShell>
  );
}
