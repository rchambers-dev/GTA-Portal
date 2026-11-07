"use client";

import { useState } from "react";
import { ApprenticePageShell } from "@/features/apprentice-portal/components/ApprenticePageShell";
import { ApprenticesVisualPreview } from "./apprentices-visual-preview";
import { EmployersVisualPreview } from "./employers-visual-preview";
import styles from "./admin-pages.module.css";

export type DirectoryView = "apprentices" | "employers";

/**
 * One example directory for apprentices and employers.
 * Search filters the selected list only. Add forms live on Onboarding.
 */
export function OnboardingDirectory({
  initialView = "apprentices",
}: {
  initialView?: DirectoryView;
}) {
  const [view, setView] = useState<DirectoryView>(initialView);
  const [query, setQuery] = useState("");

  return (
    <ApprenticePageShell
      eyebrow="Onboarding"
      title="Directory"
      description="Example records only. Saving is disabled."
    >
      <div className={styles.stack} data-directory-view={view}>
        <p className={styles.previewBanner} role="status">
          EXAMPLE DATA. Saving is disabled. Search filters this example list only.
        </p>
        <div className={styles.overviewFilters} role="group" aria-label="Directory">
          <button
            type="button"
            className={view === "apprentices" ? styles.overviewChipActive : styles.overviewChip}
            aria-pressed={view === "apprentices"}
            onClick={() => setView("apprentices")}
          >
            Apprentices
          </button>
          <button
            type="button"
            className={view === "employers" ? styles.overviewChipActive : styles.overviewChip}
            aria-pressed={view === "employers"}
            onClick={() => setView("employers")}
          >
            Employers
          </button>
        </div>
        <label className={styles.registrySearch}>
          <span className={styles.registrySearchLabel}>Search directory</span>
          <input
            type="search"
            value={query}
            placeholder={
              view === "apprentices"
                ? "Search by apprentice or employer"
                : "Search by company, phone, postcode, site, or manager"
            }
            onChange={(event) => setQuery(event.target.value)}
          />
        </label>
        {view === "apprentices" ? (
          <ApprenticesVisualPreview mode="list" query={query} />
        ) : (
          <EmployersVisualPreview mode="list" query={query} />
        )}
      </div>
    </ApprenticePageShell>
  );
}
