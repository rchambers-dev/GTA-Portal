"use client";

import Link from "next/link";
import { useEffect } from "react";
import { ApprenticeStatusChip } from "./ApprenticePageShell";
import {
  PLR_ADM14_REFERENCE,
  formatPlrDate,
  plrSourceLabel,
  usePlrStore,
  type PlrRplDecision,
} from "../domain/plr-store";
import { getLrsPlrPort } from "@/adapters/lrs/lrs-plr-adapter";
import styles from "../screens/apprentice-pages.module.css";

function decisionTone(decision: PlrRplDecision | undefined) {
  switch (decision) {
    case "relevant":
      return "green" as const;
    case "not_relevant":
      return "neutral" as const;
    default:
      return "amber" as const;
  }
}

function decisionLabel(decision: PlrRplDecision | undefined) {
  switch (decision) {
    case "relevant":
      return "Relevant to RPL";
    case "not_relevant":
      return "Not for RPL";
    default:
      return "Awaiting staff decision";
  }
}

export function PlrReportPanel() {
  const { state, refresh, autoFetch, setDecision, setNote } = usePlrStore();
  const port = getLrsPlrPort();

  useEffect(() => {
    void autoFetch();
  }, [autoFetch]);

  const record = state.record;
  const relevantCount = Object.values(state.rplDecisions).filter(
    (d) => d === "relevant",
  ).length;
  const decidedCount = Object.values(state.rplDecisions).filter(
    (d) => d === "relevant" || d === "not_relevant",
  ).length;

  return (
    <div className={styles.stack}>
      <div
        className={styles.otjHealthBar}
        data-health={
          state.status === "ready"
            ? "ahead"
            : state.status === "fetching" || state.status === "finding_uln"
              ? "on_track"
              : "behind"
        }
      >
        <div className={styles.otjHealthMain}>
          <p className={styles.otjHealthLabel}>
            ADM14 {PLR_ADM14_REFERENCE} · DfE Learning Records Service
          </p>
          <p className={styles.otjHealthValue}>Personal Learning Record</p>
          <p className={styles.otjHealthHint}>
            Auto-retrieves via LRS Get Apprentice Learning Events when ULN, given
            name and family name are ready from AF1.1. Adapter mode:{" "}
            <strong>{port.mode}</strong>.
          </p>
        </div>
        <div className={styles.otjHealthSide}>
          <ApprenticeStatusChip
            tone={
              state.status === "ready"
                ? "green"
                : state.status === "fetching" || state.status === "finding_uln"
                  ? "amber"
                  : "blue"
            }
          >
            {state.status === "ready"
              ? "PLR loaded"
              : state.status === "fetching"
                ? "Fetching…"
                : state.status === "finding_uln"
                  ? "Finding ULN…"
                  : state.status === "missing_identity"
                    ? "Waiting for identity"
                    : state.status === "privacy_blocked"
                      ? "Privacy blocked"
                      : state.status === "not_verified"
                        ? "Not verified"
                        : "Not loaded"}
          </ApprenticeStatusChip>
          {state.lastFetchedAt ? (
            <p className={styles.glanceHint}>
              Retrieved {formatPlrDate(state.lastFetchedAt)}
            </p>
          ) : null}
        </div>
      </div>

      <div className={styles.otjChipRow}>
        <button
          type="button"
          className={styles.primaryBtn}
          onClick={() => void refresh(true)}
          disabled={
            state.status === "fetching" || state.status === "finding_uln"
          }
        >
          Refresh PLR from LRS
        </button>
        <Link
          href="/apprentice/documents/eligibility/1.2"
          className={styles.ghostBtn}
        >
          AF1.1 Enrolment (ULN / name)
        </Link>
        <Link
          href="/apprentice/documents/eligibility/1.5"
          className={styles.ghostBtn}
        >
          Open RPLE assessment →
        </Link>
      </div>

      {state.lastError ? (
        <div className={styles.otjSummaryCard} data-tone="amber">
          <p className={styles.glanceLabel}>LRS message</p>
          <p className={styles.metaBlock}>{state.lastError}</p>
          {state.status === "missing_identity" ? (
            <p className={styles.glanceHint}>
              Add first name, surname and a 10-digit ULN on the enrolment form
              so Find ULN can resolve automatically.
            </p>
          ) : null}
        </div>
      ) : null}

      {state.identity ? (
        <section className={styles.otjForm}>
          <h2 className={styles.sectionTitle}>Request identity</h2>
          <div className={styles.grid}>
            <div className={styles.glance} data-tone="navy">
              <p className={styles.glanceLabel}>Apprentice</p>
              <p className={styles.glanceValueSmall}>
                {state.identity.givenName} {state.identity.familyName}
              </p>
            </div>
            <div className={styles.glance} data-tone="blue">
              <p className={styles.glanceLabel}>ULN</p>
              <p className={styles.glanceValueSmall}>
                {state.identity.uln || "—"}
              </p>
            </div>
            <div className={styles.glance} data-tone="navy">
              <p className={styles.glanceLabel}>Date of birth</p>
              <p className={styles.glanceValueSmall}>
                {formatPlrDate(state.identity.dateOfBirth ?? null)}
              </p>
            </div>
          </div>
        </section>
      ) : null}

      {record ? (
        <>
          <div className={styles.grid}>
            <div className={styles.glance} data-tone="green">
              <p className={styles.glanceLabel}>Qualifications</p>
              <p className={styles.glanceValue}>
                {record.qualifications.length}
              </p>
              <p className={styles.glanceHint}>
                {relevantCount} marked relevant to RPL
              </p>
            </div>
            <div className={styles.glance} data-tone="blue">
              <p className={styles.glanceLabel}>Staff decisions</p>
              <p className={styles.glanceValue}>
                {decidedCount}/{record.qualifications.length}
              </p>
              <p className={styles.glanceHint}>Confirm each achievement</p>
            </div>
            <div className={styles.glance} data-tone="navy">
              <p className={styles.glanceLabel}>Verified</p>
              <p className={styles.glanceValueSmall}>
                {record.verified ? "Yes" : "No"}
              </p>
              <p className={styles.glanceHint}>
                Sharing{" "}
                {record.privacyAllowsSharing ? "permitted" : "blocked"}
              </p>
            </div>
          </div>

          <section className={styles.otjForm}>
            <h2 className={styles.sectionTitle}>
              Qualifications &amp; achievements
            </h2>
            <p className={styles.metaBlock}>
              Imported from LRS. Staff should confirm which achievements may
              count toward RPL / RPLE — the portal can highlight candidates, but
              a tutor or assessor decides KSB mapping.
            </p>
            <ul className={styles.list}>
              {record.qualifications.map((q) => {
                const decision = state.rplDecisions[q.id] ?? "pending";
                return (
                  <li key={q.id} className={styles.row}>
                    <div className={styles.stack} style={{ width: "100%" }}>
                      <div className={styles.rowMain}>
                        <strong>{q.title}</strong>
                        <span>
                          {q.qualificationCode} · {q.level}
                          {q.grade ? ` · Grade ${q.grade}` : ""}
                          {q.credits ? ` · ${q.credits} credits` : ""}
                        </span>
                        <span>
                          {q.awardingOrganisation}
                          {q.previousProvider
                            ? ` · ${q.previousProvider}`
                            : ""}{" "}
                          · {plrSourceLabel(q.source)}
                        </span>
                        <span>
                          Awarded {formatPlrDate(q.awardDate)} ·{" "}
                          {formatPlrDate(q.startDate)} –{" "}
                          {formatPlrDate(q.endDate)}
                        </span>
                      </div>
                      <div className={styles.rowEnd}>
                        <ApprenticeStatusChip tone={decisionTone(decision)}>
                          {decisionLabel(decision)}
                        </ApprenticeStatusChip>
                      </div>
                      <div className={styles.otjPresetRow}>
                        {(
                          [
                            ["relevant", "Relevant to RPL"],
                            ["not_relevant", "Not for RPL"],
                            ["pending", "Reset"],
                          ] as const
                        ).map(([value, label]) => (
                          <button
                            key={value}
                            type="button"
                            className={
                              decision === value
                                ? styles.otjPresetActive
                                : styles.otjPreset
                            }
                            onClick={() => setDecision(q.id, value)}
                          >
                            {label}
                          </button>
                        ))}
                      </div>
                      <label className={styles.field}>
                        Assessor note (optional)
                        <textarea
                          rows={2}
                          value={state.rplNotes[q.id] ?? ""}
                          onChange={(e) => setNote(q.id, e.target.value)}
                          placeholder="Why this does / does not map to apprenticeship KSBs"
                        />
                      </label>
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>

          {record.participations.length > 0 ? (
            <section className={styles.otjForm}>
              <h2 className={styles.sectionTitle}>Participation records</h2>
              <ul className={styles.list}>
                {record.participations.map((p) => (
                  <li key={p.id} className={styles.row}>
                    <div className={styles.rowMain}>
                      <strong>{p.title}</strong>
                      <span>
                        {p.provider} · {p.status}
                      </span>
                      <span>
                        {formatPlrDate(p.startDate)} –{" "}
                        {formatPlrDate(p.endDate)}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          {record.notes.length > 0 ? (
            <section className={styles.otjForm}>
              <h2 className={styles.sectionTitle}>Integration notes</h2>
              {record.notes.map((note) => (
                <p key={note} className={styles.metaBlock}>
                  {note}
                </p>
              ))}
            </section>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
