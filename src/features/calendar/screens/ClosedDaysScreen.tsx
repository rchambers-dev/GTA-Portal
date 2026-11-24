import { getSupabaseEffectiveSession } from "@/adapters/supabase/auth";
import { loadClosures } from "../domain/closed-days";
import { ClosedDaysEditor } from "./ClosedDaysEditor";
import styles from "./closed-days.module.css";

export async function ClosedDaysScreen() {
  const session = await getSupabaseEffectiveSession();
  const management = session?.account.baseRole === "Management";
  const year = 2027;
  const loaded = management ? await loadClosures(year) : { rows: [], error: null };
  return (
    <div className={styles.page}>
      <p className={styles.kicker}>Management · Settings</p>
      <h1>Closed days</h1>
      {management ? null : <p className={styles.error}>Closed days are for Management.</p>}
      {loaded.error ? <p className={styles.error} role="alert">{loaded.error}</p> : null}
      <ClosedDaysEditor year={year} rows={loaded.rows} canWrite={management && !loaded.error} />
    </div>
  );
}
