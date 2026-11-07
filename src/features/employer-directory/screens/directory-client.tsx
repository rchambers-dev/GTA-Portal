"use client";

import { useEffect, useState } from "react";
import { ApprenticePageShell } from "@/features/apprentice-portal/components/ApprenticePageShell";
import type {
  Candidate,
  DirectoryAction,
  DirectorySnapshot,
} from "../domain/model";
import { emptyDirectory } from "../domain/model";
import {
  apprenticesForEmployer,
  employersForSite,
  rolesForEmployer,
  sitesForEmployer,
} from "../domain/reduce";
import styles from "@/features/administration/screens/admin-pages.module.css";

type Payload = {
  snapshot?: DirectorySnapshot;
  error?: string;
  code?: string;
  candidates?: Candidate[];
};

async function postDirectory(body: DirectoryAction): Promise<{
  ok: boolean;
  status: number;
  payload: Payload;
}> {
  const response = await fetch("/api/employer-directory", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const payload = (await response.json().catch(() => ({}))) as Payload;
  return { ok: response.ok, status: response.status, payload };
}

function GapList({ gaps }: { gaps: string[] }) {
  if (gaps.length === 0) return <span className={styles.fieldHint}>Record complete</span>;
  return <span className={styles.fieldHint}>Not recorded: {gaps.join(", ")}</span>;
}

export function EmployerDirectoryScreen({ eyebrow }: { eyebrow: string }) {
  const [snapshot, setSnapshot] = useState<DirectorySnapshot>(emptyDirectory());
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [companyName, setCompanyName] = useState("");
  const [siteLabel, setSiteLabel] = useState("");
  const [siteLine, setSiteLine] = useState("");
  const [sitePostcode, setSitePostcode] = useState("");
  const [managerName, setManagerName] = useState("");
  const [linkCompanyId, setLinkCompanyId] = useState("");
  const [linkSiteId, setLinkSiteId] = useState("");
  const [roleManagerId, setRoleManagerId] = useState("");
  const [roleCompanyId, setRoleCompanyId] = useState("");
  const [roleSiteId, setRoleSiteId] = useState("");
  const [duplicate, setDuplicate] = useState<DirectoryAction | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const response = await fetch("/api/employer-directory", { cache: "no-store" });
      const payload = (await response.json().catch(() => ({}))) as Payload;
      if (cancelled) return;
      if (!response.ok || !payload.snapshot) {
        setError(payload.error || "Unable to load the employer directory.");
      } else {
        setSnapshot(payload.snapshot);
        setError(null);
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function submit(action: DirectoryAction) {
    setError(null);
    setNotice(null);
    setDuplicate(null);
    const result = await postDirectory(action);
    if (result.status === 409 && result.payload.code === "possible_duplicate") {
      if (
        action.action === "createEmployer" ||
        action.action === "createSite" ||
        action.action === "createManager"
      ) {
        setDuplicate(
          action.action === "createEmployer"
            ? { action: "createEmployer", input: { ...action.input, confirmDistinct: true } }
            : action.action === "createSite"
              ? { action: "createSite", input: { ...action.input, confirmDistinct: true } }
              : { action: "createManager", input: { ...action.input, confirmDistinct: true } },
        );
      }
      setError(result.payload.error || "Possible duplicate.");
      return;
    }
    if (!result.ok || !result.payload.snapshot) {
      setError(result.payload.error || "Unable to save.");
      return;
    }
    setSnapshot(result.payload.snapshot);
    setNotice("Saved.");
    setCompanyName("");
    setSiteLabel("");
    setSiteLine("");
    setSitePostcode("");
    setManagerName("");
  }

  const roleSites = roleCompanyId ? sitesForEmployer(snapshot, roleCompanyId) : [];

  return (
    <ApprenticePageShell
      eyebrow={eyebrow}
      title="Companies, sites and managers"
      description="Separate company, site, and manager records. One site can host more than one company. A company can have several sites and several managers. Nothing is merged by name or address."
    >
      <div className={styles.stack}>
        {loading ? <p className={styles.empty}>Loading directory…</p> : null}
        {error ? <p className={styles.error} role="alert">{error}</p> : null}
        {notice ? <p className={styles.success} role="status">{notice}</p> : null}
        {duplicate ? (
          <button type="button" className={styles.secondaryBtn} onClick={() => void submit(duplicate)}>
            Save as a separate record
          </button>
        ) : null}

        <section className={styles.formGroup}>
          <div className={styles.formGroupHead}>
            <h2 className={styles.formGroupTitle}>Employers</h2>
            <span className={styles.formGroupBadge}>{snapshot.employers.length}</span>
          </div>
          <p className={styles.formGroupMeta}>Name is required. Legal name and company number can stay blank.</p>
          <form
            className={styles.formGrid}
            onSubmit={(event) => {
              event.preventDefault();
              void submit({ action: "createEmployer", input: { name: companyName } });
            }}
          >
            <label className={styles.field}>
              <span>Company name <em className={styles.fieldRequired}>required</em></span>
              <input value={companyName} onChange={(event) => setCompanyName(event.target.value)} />
            </label>
            <div className={styles.formActions}>
              <button type="submit" className={styles.primaryBtn}>Add employer</button>
            </div>
          </form>
          <div className={styles.employerList}>
            {snapshot.employers.map((company) => (
              <article key={company.id} className={styles.employerCard} data-open="false">
                <div className={styles.employerCardHeader}>
                  <div className={styles.employerCardMain}>
                    <strong className={styles.employerName}>{company.name}</strong>
                    <span>{company.status === "inactive" ? "Inactive" : "Active"}</span>
                    <GapList
                      gaps={[
                        !company.legalName ? "Legal name" : "",
                        !company.companyNumber ? "Company number" : "",
                      ].filter(Boolean)}
                    />
                    <span>
                      Sites: {sitesForEmployer(snapshot, company.id).map((site) => site.label).join(", ") || "none linked"}
                      {" · "}
                      Managers: {rolesForEmployer(snapshot, company.id).length}
                      {" · "}
                      Apprentices: {apprenticesForEmployer(snapshot, company.id).length}
                    </span>
                  </div>
                </div>
              </article>
            ))}
          </div>
          {snapshot.employers.length === 0 && !loading ? (
            <p className={styles.empty}>No companies yet.</p>
          ) : null}
        </section>

        <section className={styles.formGroup}>
          <div className={styles.formGroupHead}>
            <h2 className={styles.formGroupTitle}>Sites</h2>
            <span className={styles.formGroupBadge}>{snapshot.sites.length}</span>
          </div>
          <p className={styles.formGroupMeta}>A label is required. Address and postcode can stay blank. A learner postcode is never turned into a site.</p>
          <form
            className={styles.formGrid}
            onSubmit={(event) => {
              event.preventDefault();
              void submit({
                action: "createSite",
                input: { label: siteLabel, addressLine1: siteLine, postcode: sitePostcode },
              });
            }}
          >
            <label className={styles.field}>
              <span>Site label <em className={styles.fieldRequired}>required</em></span>
              <input value={siteLabel} onChange={(event) => setSiteLabel(event.target.value)} />
            </label>
            <label className={styles.field}>
              <span>Address line</span>
              <input value={siteLine} onChange={(event) => setSiteLine(event.target.value)} />
            </label>
            <label className={styles.field}>
              <span>Postcode</span>
              <input value={sitePostcode} onChange={(event) => setSitePostcode(event.target.value)} />
            </label>
            <div className={styles.formActions}>
              <button type="submit" className={styles.primaryBtn}>Add site</button>
            </div>
          </form>
          <div className={styles.employerList}>
            {snapshot.sites.map((site) => (
              <article key={site.id} className={styles.employerCard} data-open="false">
                <div className={styles.employerCardHeader}>
                  <div className={styles.employerCardMain}>
                    <strong className={styles.employerName}>{site.label}</strong>
                    <GapList
                      gaps={[
                        !site.addressLine1 ? "Address" : "",
                        !site.town ? "Town" : "",
                        !site.postcode ? "Postcode" : "",
                      ].filter(Boolean)}
                    />
                    <span>
                      Employers here: {employersForSite(snapshot, site.id).map((company) => company.name).join(", ") || "none"}
                    </span>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className={styles.formGroup}>
          <div className={styles.formGroupHead}>
            <h2 className={styles.formGroupTitle}>Link an employer to a site</h2>
            <span className={styles.formGroupBadge}>Many to many</span>
          </div>
          <form
            className={styles.formGrid}
            onSubmit={(event) => {
              event.preventDefault();
              void submit({ action: "linkEmployerSite", employerId: linkCompanyId, siteId: linkSiteId });
            }}
          >
            <label className={styles.field}>
              <span>Company</span>
              <select value={linkCompanyId} onChange={(event) => setLinkCompanyId(event.target.value)}>
                <option value="">Choose company…</option>
                {snapshot.employers.map((company) => (
                  <option key={company.id} value={company.id}>{company.name}</option>
                ))}
              </select>
            </label>
            <label className={styles.field}>
              <span>Site</span>
              <select value={linkSiteId} onChange={(event) => setLinkSiteId(event.target.value)}>
                <option value="">Choose site…</option>
                {snapshot.sites.map((site) => (
                  <option key={site.id} value={site.id}>{site.label}</option>
                ))}
              </select>
            </label>
            <div className={styles.formActions}>
              <button type="submit" className={styles.primaryBtn}>Link</button>
            </div>
          </form>
        </section>

        <section className={styles.formGroup}>
          <div className={styles.formGroupHead}>
            <h2 className={styles.formGroupTitle}>Managers</h2>
            <span className={styles.formGroupBadge}>{snapshot.managers.length}</span>
          </div>
          <p className={styles.formGroupMeta}>Name is required. Email and phone can stay blank. The same name does not become the same person.</p>
          <form
            className={styles.formGrid}
            onSubmit={(event) => {
              event.preventDefault();
              void submit({ action: "createManager", input: { fullName: managerName } });
            }}
          >
            <label className={styles.field}>
              <span>Manager name <em className={styles.fieldRequired}>required</em></span>
              <input value={managerName} onChange={(event) => setManagerName(event.target.value)} />
            </label>
            <div className={styles.formActions}>
              <button type="submit" className={styles.primaryBtn}>Add manager</button>
            </div>
          </form>
          <div className={styles.employerList}>
            {snapshot.managers.map((manager) => (
              <article key={manager.id} className={styles.employerCard} data-open="false">
                <div className={styles.employerCardHeader}>
                  <div className={styles.employerCardMain}>
                    <strong className={styles.employerName}>{manager.fullName}</strong>
                    <GapList gaps={[!manager.email ? "Email" : "", !manager.phone ? "Phone" : ""].filter(Boolean)} />
                  </div>
                </div>
              </article>
            ))}
          </div>
          <form
            className={styles.formGrid}
            onSubmit={(event) => {
              event.preventDefault();
              void submit({
                action: "assignManagerRole",
                input: {
                  managerId: roleManagerId,
                  employerId: roleCompanyId,
                  siteId: roleSiteId || null,
                },
              });
            }}
          >
            <label className={styles.field}>
              <span>Manager</span>
              <select value={roleManagerId} onChange={(event) => setRoleManagerId(event.target.value)}>
                <option value="">Choose manager…</option>
                {snapshot.managers.map((manager) => (
                  <option key={manager.id} value={manager.id}>{manager.fullName}</option>
                ))}
              </select>
            </label>
            <label className={styles.field}>
              <span>Company</span>
              <select
                value={roleCompanyId}
                onChange={(event) => {
                  setRoleCompanyId(event.target.value);
                  setRoleSiteId("");
                }}
              >
                <option value="">Choose company…</option>
                {snapshot.employers.map((company) => (
                  <option key={company.id} value={company.id}>{company.name}</option>
                ))}
              </select>
            </label>
            <label className={styles.field}>
              <span>Site</span>
              <select value={roleSiteId} onChange={(event) => setRoleSiteId(event.target.value)}>
                <option value="">Company-wide, no site</option>
                {roleSites.map((site) => (
                  <option key={site.id} value={site.id}>{site.label}</option>
                ))}
              </select>
            </label>
            <div className={styles.formActions}>
              <button type="submit" className={styles.primaryBtn}>Add responsibility</button>
            </div>
          </form>
        </section>
      </div>
    </ApprenticePageShell>
  );
}
