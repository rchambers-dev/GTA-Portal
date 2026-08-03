"use client";

import { useRouter } from "next/navigation";
import styles from "../screens/apprentice-pages.module.css";

/**
 * One hierarchy step back (topic → module → modules list).
 */
export function StepBackButton({
  parentHref,
  label = "Back",
}: {
  parentHref: string;
  label?: string;
}) {
  const router = useRouter();

  return (
    <button
      type="button"
      className={styles.ghostBtn}
      onClick={() => router.push(parentHref)}
    >
      ← {label}
    </button>
  );
}
