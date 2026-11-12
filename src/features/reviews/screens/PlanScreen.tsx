import { getSupabaseEffectiveSession } from "@/adapters/supabase/auth";
import { canAddApprentice } from "@/features/administration/domain/apprentice-record";
import { londonToday } from "@/features/administration/domain/apprentice-tutor";
import { ApprenticePageShell } from "@/features/apprentice-portal/components/ApprenticePageShell";
import { loadPlanPage } from "../domain/plan-repository";
import { Fraunces, Outfit } from "next/font/google";
import { PlanView } from "./PlanView";
import styles from "./plan.module.css";

const outfit = Outfit({ subsets: ["latin"], weight: ["400", "600", "700"] });
const fraunces = Fraunces({ subsets: ["latin"], weight: ["600", "700"], variable: "--font-fraunces" });

export async function PlanScreen({
  workspace,
  date,
  month,
}: {
  workspace: "administration" | "management";
  date?: string;
  month?: string;
}) {
  const session = await getSupabaseEffectiveSession();
  const today = londonToday();
  const selected = date && /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : today;
  const selectedMonth = month && /^\d{4}-\d{2}$/.test(month) ? month : selected.slice(0, 7);
  const canWrite = canAddApprentice(session);
  const page = await loadPlanPage({ canWrite, date: selected, month: selectedMonth });

  return (
    <ApprenticePageShell
      eyebrow="Reviews"
      title="Plan"
    >
      <div className={`${styles.raPage} ${outfit.className} ${fraunces.variable}`}>
        {page.loadError ? <p role="alert">{page.loadError}</p> : null}
        <PlanView workspace={workspace} page={page} date={selected} month={selectedMonth} />
      </div>
    </ApprenticePageShell>
  );
}
