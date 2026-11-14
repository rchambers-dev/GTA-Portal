"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import styles from "./review-log.module.css";

export function UndoControl({
  ready,
  summary,
  label = "Undo",
  title = "Undo this event?",
  learners = [],
  confirm,
}: {
  ready: boolean;
  summary: string;
  label?: string;
  title?: string;
  learners?: { gtaId: string; name: string }[];
  confirm: () => Promise<{ ok: true } | { ok: false; formError: string }>;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  if (!ready) {
    return (
      <button type="button" className={styles.undo} disabled title="Undo is waiting for the database change Reiss needs to approve.">
        {label}
      </button>
    );
  }
  return (
    <>
      <button type="button" className={styles.undo} onClick={() => { setError(null); setOpen(true); }}>{label}</button>
      {open ? (
        <div className={styles.dialog} role="dialog" aria-modal="true" aria-labelledby="undo-title">
          <div className={styles.dialogCard}>
            <h2 id="undo-title">{title}</h2>
            <p>{summary}</p>
            {learners.length > 0 ? (
              <ul>
                {learners.map((learner) => <li key={learner.gtaId}>{learner.name}</li>)}
              </ul>
            ) : null}
            {error ? <p className={styles.error} role="alert">{error}</p> : null}
            <div className={styles.dialogActions}>
              <button
                type="button"
                disabled={pending}
                onClick={() => {
                  setPending(true);
                  void confirm().then((result) => {
                    setPending(false);
                    if (!result.ok) {
                      setError(result.formError);
                      return;
                    }
                    setOpen(false);
                    router.refresh();
                  });
                }}
              >
                Confirm undo
              </button>
              <button type="button" onClick={() => setOpen(false)}>Cancel</button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
