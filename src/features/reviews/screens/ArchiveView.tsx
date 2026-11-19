"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { ArchivePage } from "../domain/archive-repository";
import { restoreReviewAction, shelveReviewAction } from "./archive-actions";
import styles from "./plan.module.css";

export function ArchiveView({ page }: { page: ArchivePage }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [notice, setNotice] = useState("");
  const needle = query.trim().toLowerCase();
  const rows = page.reviews.filter((review) => !needle || `${review.name} ${review.gtaId}`.toLowerCase().includes(needle));
  const aside = rows.filter((review) => review.shelved);
  const finished = rows.filter((review) => !review.shelved);

  async function move(id: string, shelve: boolean) {
    const result = shelve ? await shelveReviewAction({ reviewId: id }) : await restoreReviewAction({ reviewId: id });
    setNotice(result.ok ? (shelve ? "Moved to the archive. The learner Reviews tab still lists it." : "Restored to the review cycle.") : result.formError);
    if (result.ok) router.refresh();
  }

  return (
    <div className={styles.raPage}>
      <header className={styles.head}>
        <h1 className={styles.planTitle}>Archive</h1>
        <p className={styles.meta}>Finished reviews can be moved out of the cycle. Restoring puts them back. Nothing is deleted, and the learner Reviews tab still shows every completed review.</p>
      </header>
      {page.loadError ? <p role="alert">{page.loadError}</p> : null}
      {notice ? <p className={styles.status} role="status">{notice}</p> : null}
      {!page.shelveReady ? <p className={styles.meta}>Putting a review aside needs the archive migration. The list below is every finished review.</p> : null}
      <input className={styles.search} value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search a name" aria-label="Search finished reviews" />
      <section>
        <h2>Moved aside · {aside.length}</h2>
        {aside.length === 0 ? <p className={styles.empty}>Nothing has been moved aside.</p> : null}
        {aside.map((review) => (
          <article key={review.id} className={styles.card}>
            <span className={styles.rowMain}>
              <strong>{review.name}</strong>
              <span className={styles.college}>{review.actualOn} · {review.method} · planned {review.plannedOn}</span>
            </span>
            <button type="button" className={styles.pill} onClick={() => void move(review.id, false)}>Restore</button>
          </article>
        ))}
      </section>
      <section>
        <h2>Finished reviews · {finished.length}</h2>
        {finished.length === 0 ? <p className={styles.empty}>No finished reviews to move.</p> : null}
        {finished.map((review) => (
          <article key={review.id} className={styles.card}>
            <span className={styles.rowMain}>
              <strong>{review.name}</strong>
              <span className={styles.college}>{review.actualOn} · {review.method} · planned {review.plannedOn}</span>
            </span>
            <button type="button" className={styles.pill} disabled={!page.shelveReady} onClick={() => void move(review.id, true)}>Move to archive</button>
          </article>
        ))}
      </section>
    </div>
  );
}
