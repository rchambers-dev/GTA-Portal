"use client";

import { useEffect, useMemo, useState } from "react";
import { ApprenticePageShell } from "@/features/apprentice-portal/components/ApprenticePageShell";
import {
  RELEASE_DAYS,
  emptyDirectory,
  type DirectorySnapshot,
} from "../domain/model";
import { normalizeMatchKey } from "../domain/fields";
import { rolesForEmployer, sitesForEmployer } from "../domain/reduce";
import styles from "@/features/administration/screens/admin-pages.module.css";

function changedFields(
  before: typeof EMPTY,
  after: typeof EMPTY,
): Partial<typeof EMPTY> {
  const patch: Partial<typeof EMPTY> = {};
  for (const key of Object.keys(after) as Array<keyof typeof EMPTY>) {
    if (before[key] !== after[key]) patch[key] = after[key];
  }
  return patch;
}

const EMPTY = {
  fullName: "",
  sourceCompanyName: "",
  sourcePostcode: "",
  releaseDay: "",
  tutorName: "",
  apprenticeshipLabel: "",
  apprenticeshipStartDate: "",
  apprenticeshipEndDate: "",
  reviewerName: "",
  sourceContactName: "",
  sourceContactEmail: "",
  sourceContactPhone: "",
  plannedReviewDate: "",
};

type Payload = {
  snapshot?: DirectorySnapshot;
  error?: string;
  code?: string;
};

export function AddApprenticeForm({
  eyebrow,
  onCancel,
  onCreated,
  existing,
}: {
  eyebrow: string;
  onCancel: () => void;
  onCreated: (message: string) => void;
  existing?: {
    apprenticeId: string;
    version: number;
    values: typeof EMPTY;
    employerId: string;
    siteId: string;
    managerRoleId: string;
  };
}) {
  const [form, setForm] = useState(existing?.values ?? EMPTY);
  const [snapshot, setSnapshot] = useState<DirectorySnapshot>(emptyDirectory());
  const [employerId, setEmployerId] = useState(existing?.employerId ?? "");
  const [siteId, setSiteId] = useState(existing?.siteId ?? "");
  const [managerRoleId, setManagerRoleId] = useState(existing?.managerRoleId ?? "");
  const [error, setError] = useState<string | null>(null);
  const [confirmDistinct, setConfirmDistinct] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const response = await fetch("/api/employer-directory", { cache: "no-store" });
      const payload = (await response.json().catch(() => ({}))) as Payload;
      if (cancelled || !response.ok || !payload.snapshot) return;
      setSnapshot(payload.snapshot);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const sites = employerId ? sitesForEmployer(snapshot, employerId) : [];
  const roles = employerId ? rolesForEmployer(snapshot, employerId) : [];
  const roleChoices = roles.filter((role) => !role.siteId || role.siteId === siteId);
  const nameMatches = useMemo(() => {
    const key = normalizeMatchKey(form.sourceCompanyName);
    if (!key) return [];
    return snapshot.employers.filter((employer) => normalizeMatchKey(employer.name) === key);
  }, [form.sourceCompanyName, snapshot.employers]);

  function setField(key: keyof typeof EMPTY, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function submit(forceDistinct: boolean) {
    setBusy(true);
    setError(null);
    const patch = existing ? changedFields(existing.values, form) : null;
    const linkChanged =
      !existing ||
      existing.employerId !== employerId ||
      existing.siteId !== siteId ||
      existing.managerRoleId !== managerRoleId;
    if (existing && patch && Object.keys(patch).length === 0 && !linkChanged) {
      setBusy(false);
      onCreated("Nothing changed.");
      return;
    }
    let payload: Payload = {};
    if (!existing || (patch && Object.keys(patch).length > 0)) {
      const response = await fetch("/api/employer-directory", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          existing
            ? {
                action: "updateReviewDetails",
                apprenticeId: existing.apprenticeId,
                expectedVersion: existing.version,
                patch,
              }
            : {
                action: "createReviewApprentice",
                input: { ...form, confirmDistinct: forceDistinct },
              },
        ),
      });
      payload = (await response.json().catch(() => ({}))) as Payload;
      if (response.status === 409 && payload.code === "possible_duplicate") {
        setConfirmDistinct(true);
        setError(payload.error || "This name is already on the apprentice register.");
        setBusy(false);
        return;
      }
      if (response.status === 409 && payload.code === "version_conflict") {
        setError(payload.error || "This apprentice was saved by someone else. Go back and open them again.");
        setBusy(false);
        return;
      }
      if (!response.ok || !payload.snapshot) {
        setError(payload.error || "Unable to save the apprentice.");
        setBusy(false);
        return;
      }
    }
    const created = existing
      ? payload.snapshot?.apprentices.find((row) => row.id === existing.apprenticeId) ??
        { id: existing.apprenticeId, displayName: form.fullName, apprenticeReference: "", portalEntry: "reviews" as const }
      : payload.snapshot?.apprentices[payload.snapshot.apprentices.length - 1];
    const detail = payload.snapshot?.reviewDetails.find(
      (row) => row.apprenticeId === created?.id,
    );
    const version = detail?.version ?? existing?.version ?? 1;
    if (created && linkChanged && (employerId || existing)) {
      const link = await fetch("/api/employer-directory", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "linkReviewApprentice",
          apprenticeId: created.id,
          expectedVersion: version,
          link: {
            employerId: employerId || null,
            siteId: siteId || null,
            managerRoleId: managerRoleId || null,
          },
        }),
      });
      const linkPayload = (await link.json().catch(() => ({}))) as Payload;
      if (!link.ok) {
        setError(
          linkPayload.error ||
            "The apprentice was added. The employer link was not saved.",
        );
        setBusy(false);
        return;
      }
    }
    setBusy(false);
    onCreated(
      `${form.fullName.trim()} is on the apprentice register. No login or enrolment was created.`,
    );
  }

  return (
    <ApprenticePageShell
      eyebrow={eyebrow}
      title="Apprentices"
      description={
        existing
          ? "Update only what you change. Blank fields stay blank. Enrolment is a separate page and is not required."
          : "Add an apprentice with their full name. Leave anything unknown blank. Enrolment and account setup stay available afterwards and are not required here."
      }
      actions={
        <button type="button" className={styles.secondaryBtn} onClick={onCancel}>
          Back to apprentices
        </button>
      }
    >
      <form
        className={styles.formStack}
        onSubmit={(event) => {
          event.preventDefault();
          void submit(confirmDistinct);
        }}
      >
        <section className={styles.formGroup}>
          <h2 className={styles.formGroupTitle}>{existing ? "Apprentice details" : "Add apprentice"}</h2>
          <div className={styles.formGrid}>
            <label className={styles.field}>
              <span>Full name <em className={styles.fieldRequired}>required</em></span>
              <input value={form.fullName} onChange={(event) => setField("fullName", event.target.value)} required />
            </label>
            <label className={styles.field}>
              <span>Recorded employer name</span>
              <input value={form.sourceCompanyName} onChange={(event) => setField("sourceCompanyName", event.target.value)} />
            </label>
            <label className={styles.field}>
              <span>Recorded postcode</span>
              <input value={form.sourcePostcode} onChange={(event) => setField("sourcePostcode", event.target.value)} />
            </label>
            <label className={styles.field}>
              <span>Release day</span>
              <select value={form.releaseDay} onChange={(event) => setField("releaseDay", event.target.value)}>
                <option value="">Not recorded</option>
                {RELEASE_DAYS.map((day) => (
                  <option key={day} value={day}>{day}</option>
                ))}
              </select>
            </label>
            <label className={styles.field}>
              <span>Tutor</span>
              <input value={form.tutorName} onChange={(event) => setField("tutorName", event.target.value)} />
            </label>
            <label className={styles.field}>
              <span>Apprenticeship</span>
              <input value={form.apprenticeshipLabel} onChange={(event) => setField("apprenticeshipLabel", event.target.value)} />
            </label>
            <label className={styles.field}>
              <span>Start date</span>
              <input type="date" value={form.apprenticeshipStartDate} onChange={(event) => setField("apprenticeshipStartDate", event.target.value)} />
            </label>
            <label className={styles.field}>
              <span>Planned end date</span>
              <input type="date" value={form.apprenticeshipEndDate} onChange={(event) => setField("apprenticeshipEndDate", event.target.value)} />
            </label>
            <label className={styles.field}>
              <span>Reviewer</span>
              <input value={form.reviewerName} onChange={(event) => setField("reviewerName", event.target.value)} />
            </label>
            <label className={styles.field}>
              <span>Recorded contact name</span>
              <input value={form.sourceContactName} onChange={(event) => setField("sourceContactName", event.target.value)} />
            </label>
            <label className={styles.field}>
              <span>Recorded contact email</span>
              <input type="email" value={form.sourceContactEmail} onChange={(event) => setField("sourceContactEmail", event.target.value)} />
            </label>
            <label className={styles.field}>
              <span>Recorded contact phone</span>
              <input value={form.sourceContactPhone} onChange={(event) => setField("sourceContactPhone", event.target.value)} />
            </label>
            <label className={styles.field}>
              <span>Planned review date</span>
              <input type="date" value={form.plannedReviewDate} onChange={(event) => setField("plannedReviewDate", event.target.value)} />
            </label>
          </div>
          <p className={styles.fieldHint}>
            A recorded employer name is kept as text. It does not create an employer or copy a contact onto a mentor.
            {nameMatches.length > 0
              ? ` Name matches, not linked automatically: ${nameMatches.map((row) => row.name).join(", ")}.`
              : ""}
          </p>
        </section>
        <section className={styles.formGroup}>
          <h2 className={styles.formGroupTitle}>Employer, site and manager</h2>
          <p className={styles.formGroupMeta}>Optional. Choose an existing employer. Leave this empty when it is unknown.</p>
          <div className={styles.formGrid}>
            <label className={styles.field}>
              <span>Employer</span>
              <select
                value={employerId}
                onChange={(event) => {
                  setEmployerId(event.target.value);
                  setSiteId("");
                  setManagerRoleId("");
                }}
              >
                <option value="">Not linked</option>
                {snapshot.employers.map((employer) => (
                  <option key={employer.id} value={employer.id}>{employer.name}</option>
                ))}
              </select>
            </label>
            <label className={styles.field}>
              <span>Site</span>
              <select value={siteId} disabled={!employerId} onChange={(event) => { setSiteId(event.target.value); setManagerRoleId(""); }}>
                <option value="">Not recorded</option>
                {sites.map((site) => (
                  <option key={site.id} value={site.id}>{site.label}</option>
                ))}
              </select>
            </label>
            <label className={styles.field}>
              <span>Manager</span>
              <select
                value={managerRoleId}
                disabled={!employerId}
                onChange={(event) => {
                  const roleId = event.target.value;
                  setManagerRoleId(roleId);
                  const role = roles.find((item) => item.id === roleId);
                  if (role?.siteId) setSiteId(role.siteId);
                }}
              >
                <option value="">Not recorded</option>
                {roleChoices.map((role) => {
                  const manager = snapshot.managers.find((item) => item.id === role.managerId);
                  const site = snapshot.sites.find((item) => item.id === role.siteId);
                  return (
                    <option key={role.id} value={role.id}>
                      {manager?.fullName || "Manager"}{site ? ` · ${site.label}` : " · employer-wide"}
                    </option>
                  );
                })}
              </select>
            </label>
          </div>
        </section>
        {error ? <p className={styles.error}>{error}</p> : null}
        <div className={styles.formActions}>
          <button type="button" className={styles.secondaryBtn} onClick={onCancel}>Cancel</button>
          <button type="submit" className={styles.primaryBtn} disabled={busy}>
            {busy ? "Saving…" : existing ? "Save apprentice" : confirmDistinct ? "Add as a different apprentice" : "Add apprentice"}
          </button>
        </div>
      </form>
    </ApprenticePageShell>
  );
}
