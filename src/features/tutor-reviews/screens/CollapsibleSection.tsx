"use client";

import { useSyncExternalStore, type ReactNode } from "react";
import styles from "./tutor-reviews.module.css";

const STORAGE_KEY = "gta.tutorReviews.sections";
const CHANGE_EVENT = "gta-tutor-sections";

function readOpen(id: string, defaultOpen: boolean): boolean {
  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}") as Record<string, boolean>;
    if (typeof stored[id] === "boolean") return stored[id];
  } catch {
    // Keep the default when storage is unavailable.
  }
  return defaultOpen;
}

function writeOpen(id: string, open: boolean) {
  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}") as Record<string, boolean>;
    stored[id] = open;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(stored));
    window.dispatchEvent(new Event(CHANGE_EVENT));
  } catch {
    // The section still opens for this visit.
  }
}

export function CollapsibleSection({
  id,
  title,
  defaultOpen = false,
  children,
}: {
  id: string;
  title: string;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  const open = useSyncExternalStore(
    (onStoreChange) => {
      window.addEventListener(CHANGE_EVENT, onStoreChange);
      return () => window.removeEventListener(CHANGE_EVENT, onStoreChange);
    },
    () => readOpen(id, defaultOpen),
    () => defaultOpen,
  );

  return (
    <>
      <button type="button" className={styles.sectionToggle} aria-expanded={open} onClick={() => writeOpen(id, !open)}>
        <h2>{title}</h2>
        <span>{open ? "Hide" : "Show"}</span>
      </button>
      {open ? <div className={styles.sectionBody}>{children}</div> : null}
    </>
  );
}
