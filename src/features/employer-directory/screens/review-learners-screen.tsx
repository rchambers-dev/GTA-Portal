"use client";

import { useEffect, useMemo, useState } from "react";
import { ApprenticePageShell } from "@/features/apprentice-portal/components/ApprenticePageShell";
import { RELEASE_DAYS, emptyDirectory, type DirectorySnapshot, type ReviewLearner } from "../domain/model";
import { normalizeMatchKey } from "../domain/fields";
import { rolesForCompany, sitesForCompany } from "../domain/reduce";
import styles from "@/features/administration/screens/admin-pages.module.css";

type Payload = {
  snapshot?: DirectorySnapshot;
  error?: string;
};

const EMPTY_FORM = {
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

export function ReviewLearnersScreen({ eyebrow }: { eyebrow: string }) {
  const [snapshot, setSnapshot] = useState<DirectorySnapshot>(emptyDirectory());
  const [form, setForm] = useState(EMPTY_FORM);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [companyId, setCompanyId] = useState("");
  const [siteId, setSiteId] = useState("");
  const [managerRoleId, setManagerRoleId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const response = await fetch("/api/employer-directory", { cache: "no-store" });
      const payload = (await response.json().catch(() => ({}))) as Payload;
      if (cancelled) return;
      if (!response.ok || !payload.snapshot) {
        setError(payload.error || "Unable to load review learners.");
      } else {
        setSnapshot(payload.snapshot);
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const selected = snapshot.learners.find((learner) => learner.id === selectedId) ?? null;
  const companySites = companyId ? sitesForCompany(snapshot, companyId) : [];
  const companyRoles = companyId ? rolesForCompany(snapshot, companyId) : [];
  const roleChoices = companyRoles.filter(
    (role) => !role.siteId || role.siteId === siteId,
  );
  const nameMatches = useMemo(() => {
    const key = normalizeMatchKey(selected?.sourceCompanyName || form.sourceCompanyName);
    if (!key) return [];
    return snapshot.companies.filter((company) => normalizeMatchKey(company.name) === key);
  }, [form.sourceCompanyName, selected?.sourceCompanyName, snapshot.companies]);

  async function saveLearner(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setNotice(null);
    const response = await fetch("/api/employer-directory", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: selected ? "updateReviewLearner" : "createReviewLearner",
        id: selected?.id,
        input: form,
        patch: form,
      }),
    });
    const payload = (await response.json().catch(() => ({}))) as Payload;
    if (!response.ok || !payload.snapshot) {
      setError(payload.error || "Unable to save the learner.");
      return;
    }
    setSnapshot(payload.snapshot);
    setForm(EMPTY_FORM);
    setSelectedId(null);
    setNotice(selected ? "Learner details saved. Employer link was not changed." : "Learner added. No employer, login, or enrolment was created.");
  }

  async function saveLink(next: { companyId: string | null; siteId: string | null; managerRoleId: string | null }) {
    if (!selected) return;
    setError(null);
    const response = await fetch("/api/employer-directory", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "linkReviewLearner", id: selected.id, link: next }),
    });
    const payload = (await response.json().catch(() => ({}))) as Payload;
    if (!response.ok || !payload.snapshot) {
      setError(payload.error || "Unable to update the employer relationship.");
      return;
    }
    setSnapshot(payload.snapshot);
    setNotice(next.companyId ? "Employer relationship saved." : "Employer relationship cleared.");
  }

  function openLearner(learner: ReviewLearner) {
    setSelectedId(learner.id);
    setForm({
      fullName: learner.fullName,
      sourceCompanyName: learner.sourceCompanyName,
      sourcePostcode: learner.sourcePostcode,
      releaseDay: learner.releaseDay,
      tutorName: learner.tutorName,
      apprenticeshipLabel: learner.apprenticeshipLabel,
      apprenticeshipStartDate: learner.apprenticeshipStartDate ?? "",
      apprenticeshipEndDate: learner.apprenticeshipEndDate ?? "",
      reviewerName: learner.reviewerName,
      sourceContactName: learner.sourceContactName,
      sourceContactEmail: learner.sourceContactEmail,
      sourceContactPhone: learner.sourceContactPhone,
      plannedReviewDate: learner.plannedReviewDate ?? "",
    });
    setCompanyId(learner.companyId ?? "");
    setSiteId(learner.siteId ?? "");
    setManagerRoleId(learner.managerRoleId ?? "");
    setError(null);
    setNotice(null);
  }

  return (
    <ApprenticePageShell
      eyebrow={eyebrow}
      title="Review learners"
      description="Add someone for reviews with their full name. Every other detail can stay blank. Attaching a company, site, or manager is a separate choice and does not create a login or an enrolment."
    >
      <div className={styles.stack}>
        {loading ? <p className={styles.empty}>Loading learners…</p> : null}
        {error ? <p className={styles.error}>{error}</p> : null}
        {notice ? <p className={styles.success}>{notice}</p> : null}

        <form className={styles.formStack} onSubmit={(event) => void saveLearner(event)}>
          <section className={styles.formGroup}>
            <h2 className={styles.formGroupTitle}>{selected ? "Learner details" : "Add learner"}</h2>
            <div className={styles.formGrid}>
              <label className={styles.field}>
                <span>Full name <em className={styles.fieldRequired}>required</em></span>
                <input
                  value={form.fullName}
                  onChange={(event) => setForm((prev) => ({ ...prev, fullName: event.target.value }))}
                  required
                />
              </label>
              <label className={styles.field}>
                <span>Recorded company name</span>
                <input
                  value={form.sourceCompanyName}
                  onChange={(event) => setForm((prev) => ({ ...prev, sourceCompanyName: event.target.value }))}
                />
              </label>
              <label className={styles.field}>
                <span>Recorded postcode</span>
                <input
                  value={form.sourcePostcode}
                  onChange={(event) => setForm((prev) => ({ ...prev, sourcePostcode: event.target.value }))}
                />
              </label>
              <label className={styles.field}>
                <span>Release day</span>
                <select
                  value={form.releaseDay}
                  onChange={(event) => setForm((prev) => ({ ...prev, releaseDay: event.target.value }))}
                >
                  <option value="">Not recorded</option>
                  {RELEASE_DAYS.map((day) => (
                    <option key={day} value={day}>{day}</option>
                  ))}
                </select>
              </label>
              <label className={styles.field}>
                <span>Tutor</span>
                <input value={form.tutorName} onChange={(event) => setForm((prev) => ({ ...prev, tutorName: event.target.value }))} />
              </label>
              <label className={styles.field}>
                <span>Apprenticeship</span>
                <input
                  value={form.apprenticeshipLabel}
                  onChange={(event) => setForm((prev) => ({ ...prev, apprenticeshipLabel: event.target.value }))}
                />
              </label>
              <label className={styles.field}>
                <span>Start date</span>
                <input
                  type="date"
                  value={form.apprenticeshipStartDate}
                  onChange={(event) => setForm((prev) => ({ ...prev, apprenticeshipStartDate: event.target.value }))}
                />
              </label>
              <label className={styles.field}>
                <span>Planned end date</span>
                <input
                  type="date"
                  value={form.apprenticeshipEndDate}
                  onChange={(event) => setForm((prev) => ({ ...prev, apprenticeshipEndDate: event.target.value }))}
                />
              </label>
              <label className={styles.field}>
                <span>Reviewer</span>
                <input value={form.reviewerName} onChange={(event) => setForm((prev) => ({ ...prev, reviewerName: event.target.value }))} />
              </label>
              <label className={styles.field}>
                <span>Recorded contact name</span>
                <input
                  value={form.sourceContactName}
                  onChange={(event) => setForm((prev) => ({ ...prev, sourceContactName: event.target.value }))}
                />
              </label>
              <label className={styles.field}>
                <span>Recorded contact email</span>
                <input
                  type="email"
                  value={form.sourceContactEmail}
                  onChange={(event) => setForm((prev) => ({ ...prev, sourceContactEmail: event.target.value }))}
                />
              </label>
              <label className={styles.field}>
                <span>Recorded contact phone</span>
                <input
                  value={form.sourceContactPhone}
                  onChange={(event) => setForm((prev) => ({ ...prev, sourceContactPhone: event.target.value }))}
                />
              </label>
              <label className={styles.field}>
                <span>Planned review date</span>
                <input
                  type="date"
                  value={form.plannedReviewDate}
                  onChange={(event) => setForm((prev) => ({ ...prev, plannedReviewDate: event.target.value }))}
                />
              </label>
            </div>
            <p className={styles.fieldHint}>
              Recorded contact details stay on this learner. They are not copied onto a manager, and they are not used as a mentor.
            </p>
            <button type="submit" className={styles.primaryBtn}>
              {selected ? "Save details" : "Add learner"}
            </button>
          </section>
        </form>

        {selected ? (
          <section className={styles.formGroup}>
            <h2 className={styles.formGroupTitle}>Employer relationship</h2>
            <p className={styles.formGroupMeta}>
              Optional. Leave this empty when the company is unknown. Choosing a record does not create a new company or change that company&apos;s contacts.
            </p>
            {nameMatches.length > 0 ? (
              <p className={styles.fieldHint}>
                Name matches, not linked automatically: {nameMatches.map((company) => company.name).join(", ")}.
                {nameMatches.length > 1 ? " More than one company uses this name." : ""}
              </p>
            ) : selected.sourceCompanyName ? (
              <p className={styles.fieldHint}>No company record uses “{selected.sourceCompanyName}”. The recorded name is kept.</p>
            ) : null}
            <div className={styles.formGrid}>
              <label className={styles.field}>
                <span>Company</span>
                <select
                  value={companyId}
                  onChange={(event) => {
                    setCompanyId(event.target.value);
                    setSiteId("");
                    setManagerRoleId("");
                  }}
                >
                  <option value="">Not linked</option>
                  {snapshot.companies.map((company) => (
                    <option key={company.id} value={company.id}>{company.name}</option>
                  ))}
                </select>
              </label>
              <label className={styles.field}>
                <span>Site</span>
                <select
                  value={siteId}
                  disabled={!companyId}
                  onChange={(event) => {
                    setSiteId(event.target.value);
                    setManagerRoleId("");
                  }}
                >
                  <option value="">Not recorded</option>
                  {companySites.map((site) => (
                    <option key={site.id} value={site.id}>{site.label}</option>
                  ))}
                </select>
              </label>
              <label className={styles.field}>
                <span>Manager responsibility</span>
                <select
                  value={managerRoleId}
                  disabled={!companyId}
                  onChange={(event) => {
                    const roleId = event.target.value;
                    setManagerRoleId(roleId);
                    const role = companyRoles.find((item) => item.id === roleId);
                    if (role?.siteId) setSiteId(role.siteId);
                  }}
                >
                  <option value="">Not recorded</option>
                  {roleChoices.map((role) => {
                    const manager = snapshot.managers.find((item) => item.id === role.managerId);
                    const site = snapshot.sites.find((item) => item.id === role.siteId);
                    return (
                      <option key={role.id} value={role.id}>
                        {manager?.fullName || "Manager"}
                        {site ? ` · ${site.label}` : " · company-wide"}
                      </option>
                    );
                  })}
                </select>
              </label>
            </div>
            <div className={styles.formActions}>
              <button
                type="button"
                className={styles.primaryBtn}
                onClick={() =>
                  void saveLink({
                    companyId: companyId || null,
                    siteId: siteId || null,
                    managerRoleId: managerRoleId || null,
                  })
                }
              >
                Save relationship
              </button>
              <button
                type="button"
                className={styles.secondaryBtn}
                onClick={() => {
                  setCompanyId("");
                  setSiteId("");
                  setManagerRoleId("");
                  void saveLink({ companyId: null, siteId: null, managerRoleId: null });
                }}
              >
                Clear relationship
              </button>
            </div>
          </section>
        ) : null}

        <section className={styles.formGroup}>
          <h2 className={styles.formGroupTitle}>Learners</h2>
          {snapshot.learners.length === 0 && !loading ? (
            <p className={styles.empty}>No review learners yet.</p>
          ) : (
            <ul>
              {snapshot.learners.map((learner) => {
                const company = snapshot.companies.find((item) => item.id === learner.companyId);
                return (
                  <li key={learner.id}>
                    <button type="button" className={styles.secondaryBtn} onClick={() => openLearner(learner)}>
                      {learner.fullName}
                    </button>
                    <div className={styles.fieldHint}>
                      {learner.portalReference}
                      {" · "}
                      {company ? `Linked company: ${company.name}` : "Employer relationship: not linked"}
                      {learner.sourceCompanyName ? ` · Recorded name: ${learner.sourceCompanyName}` : ""}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>
    </ApprenticePageShell>
  );
}
