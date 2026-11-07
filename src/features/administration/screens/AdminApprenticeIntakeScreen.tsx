"use client";

import { useEffect, useState } from "react";
import { ApprenticePageShell } from "@/features/apprentice-portal/components/ApprenticePageShell";
import { AddApprenticeForm } from "@/features/employer-directory/screens/add-apprentice-form";
import {
  emptyDirectory,
  type DirectorySnapshot,
  type ReviewDetails,
} from "@/features/employer-directory/domain/model";
import styles from "./admin-pages.module.css";

type Payload = { snapshot?: DirectorySnapshot; error?: string };

function gapsFor(detail: ReviewDetails): string[] {
  return [
    !detail.sourceCompanyName ? "Recorded employer" : "",
    !detail.sourcePostcode ? "Postcode" : "",
    !detail.releaseDay ? "Release day" : "",
    !detail.tutorName ? "Tutor" : "",
    !detail.apprenticeshipLabel ? "Apprenticeship" : "",
    !detail.apprenticeshipStartDate ? "Start date" : "",
    !detail.apprenticeshipEndDate ? "Planned end" : "",
    !detail.reviewerName ? "Reviewer" : "",
    !detail.employerId ? "Employer link" : "",
  ].filter(Boolean);
}

/**
 * Existing Apprentice Intake routes, now the Apprentices workspace.
 * People are public.apprentices. Enrolment stays on the Enrolments page.
 */
export function AdminApprenticeIntakeScreen() {
  const [snapshot, setSnapshot] = useState<DirectorySnapshot>(emptyDirectory());
  const [mode, setMode] = useState<"list" | "add" | "edit">("list");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  async function load() {
    const response = await fetch("/api/employer-directory", { cache: "no-store" });
    const payload = (await response.json().catch(() => ({}))) as Payload;
    setLoading(false);
    if (!response.ok || !payload.snapshot) {
      setError(payload.error || "Unable to load apprentices.");
      return;
    }
    setSnapshot(payload.snapshot);
    setError(null);
  }

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const response = await fetch("/api/employer-directory", { cache: "no-store" });
      const payload = (await response.json().catch(() => ({}))) as Payload;
      if (cancelled) return;
      setLoading(false);
      if (!response.ok || !payload.snapshot) {
        setError(payload.error || "Unable to load apprentices.");
        return;
      }
      setSnapshot(payload.snapshot);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const rows = snapshot.reviewDetails
    .map((detail) => ({
      detail,
      person: snapshot.apprentices.find((row) => row.id === detail.apprenticeId),
    }))
    .filter((row) => row.person?.portalEntry === "reviews")
    .sort((a, b) =>
      (a.person?.displayName || "").localeCompare(b.person?.displayName || ""),
    );

  const selected = rows.find((row) => row.detail.apprenticeId === selectedId);

  if (mode === "add" || (mode === "edit" && selected?.person)) {
    return (
      <AddApprenticeForm
        eyebrow="Apprentices"
        existing={
          mode === "edit" && selected?.person
            ? {
                apprenticeId: selected.person.id,
                version: selected.detail.version,
                employerId: selected.detail.employerId ?? "",
                siteId: selected.detail.siteId ?? "",
                managerRoleId: selected.detail.managerRoleId ?? "",
                values: {
                  fullName: selected.person.displayName,
                  sourceCompanyName: selected.detail.sourceCompanyName,
                  sourcePostcode: selected.detail.sourcePostcode,
                  releaseDay: selected.detail.releaseDay,
                  tutorName: selected.detail.tutorName,
                  apprenticeshipLabel: selected.detail.apprenticeshipLabel,
                  apprenticeshipStartDate: selected.detail.apprenticeshipStartDate ?? "",
                  apprenticeshipEndDate: selected.detail.apprenticeshipEndDate ?? "",
                  reviewerName: selected.detail.reviewerName,
                  sourceContactName: selected.detail.sourceContactName,
                  sourceContactEmail: selected.detail.sourceContactEmail,
                  sourceContactPhone: selected.detail.sourceContactPhone,
                  plannedReviewDate: selected.detail.plannedReviewDate ?? "",
                },
              }
            : undefined
        }
        onCancel={() => {
          setMode("list");
          setSelectedId(null);
        }}
        onCreated={(message) => {
          setNotice(message);
          setMode("list");
          setSelectedId(null);
          void load();
        }}
      />
    );
  }

  return (
    <ApprenticePageShell
      eyebrow="Apprentices"
      title="Apprentices"
      description="The apprentice register. Add someone with a full name and leave unknown details blank. Enrolment stays on its own page."
      actions={
        <button type="button" className={styles.primaryBtn} onClick={() => setMode("add")}>
          Add apprentice
        </button>
      }
    >
      <div className={styles.stack}>
        {loading ? <p className={styles.empty}>Loading apprentices…</p> : null}
        {error ? <p className={styles.error}>{error}</p> : null}
        {notice ? <p className={styles.success}>{notice}</p> : null}
        {rows.length === 0 && !loading ? (
          <p className={styles.empty}>No apprentices added here yet.</p>
        ) : (
          <ul>
            {rows.map(({ person, detail }) => {
              const employer = snapshot.employers.find((row) => row.id === detail.employerId);
              const missing = gapsFor(detail);
              return (
                <li key={detail.apprenticeId}>
                  <button
                    type="button"
                    className={styles.secondaryBtn}
                    onClick={() => {
                      setSelectedId(detail.apprenticeId);
                      setMode("edit");
                    }}
                  >
                    {person?.displayName}
                  </button>
                  <div className={styles.fieldHint}>
                    {person?.apprenticeReference}
                    {" · "}
                    {employer ? `Employer: ${employer.name}` : "Employer: not linked"}
                    {detail.sourceCompanyName ? ` · Recorded name: ${detail.sourceCompanyName}` : ""}
                    {missing.length > 0 ? ` · Not recorded: ${missing.join(", ")}` : ""}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </ApprenticePageShell>
  );
}
