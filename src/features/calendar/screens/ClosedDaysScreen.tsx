import { getSupabaseEffectiveSession } from "@/adapters/supabase/auth";
import { loadClosures } from "../domain/closed-days";
import { ClosedDaysEditor } from "./ClosedDaysEditor";
import styles from "./closed-days.module.css";

export async function ClosedDaysScreen() {
  const session = await getSupabaseEffectiveSession();
  const management = session?.account.baseRole === "Management";
  const loaded = management ? await loadClosures() : { rows: [], lastChecked: null, error: null };
  return (
    <div className={styles.shell}>
      {management ? null : <p className={styles.note}>Closed days are for Management.</p>}
      {loaded.error ? <p className={styles.note} role="alert">{loaded.error}</p> : null}
      <ClosedDaysEditor rows={loaded.rows} lastChecked={loaded.lastChecked} canWrite={management && !loaded.error} />
    </div>
  );
}
