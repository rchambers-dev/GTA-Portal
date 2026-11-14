"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { undoReviewPackEventAction } from "./log-actions";
import styles from "./review-log.module.css";

export function UndoControl({ ready, summary, eventId }: { ready: boolean; summary: string; eventId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  if (!ready) {
    return (
      <button type="button" className={styles.undo} disabled title="Undo is waiting for the database change Reiss needs to approve.">
        Undo
      </button>
    );
  }
  return (
    <>
      <button type="button" className={styles.undo} onClick={() => { setError(null); setOpen(true); }}>Undo</button>
      {open ? (
        <div className={styles.dialog} role="dialog" aria-modal="true" aria-labelledby="undo-title">
          <div className={styles.dialogCard}>
            <h2 id="undo-title">Undo this event?</h2>
            <p>{summary}</p>
            {error ? <p className={styles.error} role="alert">{error}</p> : null}
            <div className={styles.dialogActions}>
              <button
                type="button"
                disabled={pending}
                onClick={() => {
                  setPending(true);
                  void undoReviewPackEventAction(eventId).then((result) => {
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
