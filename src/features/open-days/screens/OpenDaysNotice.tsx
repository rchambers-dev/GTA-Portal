import styles from "@/features/administration/screens/admin-pages.module.css";

export function OpenDaysNotice({
  banner,
  savingMessage,
  error,
}: {
  banner: string | null;
  savingMessage: string | null;
  error: string | null;
}) {
  if (!banner && !savingMessage && !error) return null;
  return (
    <div className={styles.stack}>
      {banner ? (
        <p className={styles.previewBanner} role="status" data-open-days-banner="">
          {banner}
        </p>
      ) : null}
      {savingMessage ? (
        <p className={styles.formGroupMeta} data-open-days-saving="">
          {savingMessage}
        </p>
      ) : null}
      {error ? (
        <p className={styles.error} role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
