import styles from "./RouteLoadingFallback.module.css";

/** Instant fallback while a route segment's RSC payload loads. */
export function RouteLoadingFallback() {
  return (
    <div className={styles.root} aria-busy="true" aria-label="Loading page">
      <div className={styles.blockWide} />
      <div className={styles.block} />
      <div className={styles.card} />
      <div className={styles.card} />
    </div>
  );
}
