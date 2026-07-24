import { EmptyState } from "@/components/ui/EmptyState";
import styles from "./FeatureStubScreen.module.css";

/** Permanent-friendly stub for routes not yet implemented. */
export function FeatureStubScreen({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className={styles.root}>
      <h1 className={styles.title}>{title}</h1>
      <EmptyState title="Route shell prepared" description={description} />
    </div>
  );
}
