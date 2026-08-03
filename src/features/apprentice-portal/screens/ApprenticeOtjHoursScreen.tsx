"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import {
  ApprenticePageShell,
  ApprenticeStatusChip,
} from "../components/ApprenticePageShell";
import { Shareable } from "../components/portal-share/Shareable";
import { useApprenticePortalProfile } from "../hooks/useApprenticePortalProfile";
import {
  ALEX_OTJ_ENTRIES,
  OTJ_CATCH_UP_HOURS_HINT,
  OTJ_TRAINING_TYPES,
  buildOtjDashboardStats,
  buildOtjLoggingHealth,
  formatModuleDate,
  formatOtjActivityPeriod,
  formatOtjDuration,
  isOtjCatchUpEntry,
  nextOtjEntryNumber,
  otjHours,
  otjPipelineLabel,
  otjTrainingTypeLabel,
  type ApprenticeOtjEntry,
  type OtjPartyStatus,
  type OtjTrainingTypeCode,
} from "../domain/mock-apprentice";
import styles from "./apprentice-pages.module.css";

function partyTone(status: OtjPartyStatus) {
  switch (status) {
    case "agreed":
      return "green" as const;
    case "returned":
      return "red" as const;
    case "not_ready":
      return "neutral" as const;
    default:
      return "amber" as const;
  }
}

function partyLabel(role: "Apprentice" | "Employer" | "Teacher", status: OtjPartyStatus | "done") {
  if (role === "Apprentice" && status === "done") return "Apprentice submitted";
  switch (status) {
    case "agreed":
      return `${role} agreed`;
    case "returned":
      return `${role} returned`;
    case "not_ready":
      return `${role} locked`;
    case "done":
      return `${role} done`;
    default:
      return `${role} pending`;
  }
}

function pipelineTone(entry: ApprenticeOtjEntry) {
  const label = otjPipelineLabel(entry);
  if (label.includes("Fully agreed")) return "green" as const;
  if (label.startsWith("Returned")) return "red" as const;
  if (label.includes("teacher")) return "blue" as const;
  return "amber" as const;
}

function OtjApprovalTrail({ entry }: { entry: ApprenticeOtjEntry }) {
  const apprenticeDone = entry.apprenticeConfirmed;
  const employerDone = entry.employerStatus === "agreed";
  const employerActive = entry.employerStatus === "pending";
  const employerReturned = entry.employerStatus === "returned";
  const tutorDone = entry.tutorStatus === "agreed";
  const tutorActive = entry.tutorStatus === "pending";
  const tutorLocked =
    entry.tutorStatus === "not_ready" || entry.employerStatus !== "agreed";

  return (
    <ol className={styles.otjTrail} aria-label="Approval order">
      <li
        className={styles.otjTrailStep}
        data-state={apprenticeDone ? "done" : "pending"}
      >
        <span className={styles.otjTrailNum}>1</span>
        <span>
          <strong>Apprentice</strong>
          <span>{apprenticeDone ? "Submitted" : "Not submitted"}</span>
        </span>
      </li>
      <li className={styles.otjTrailArrow} aria-hidden>
        →
      </li>
      <li
        className={styles.otjTrailStep}
        data-state={
          employerReturned
            ? "returned"
            : employerDone
              ? "done"
              : employerActive
                ? "active"
                : "pending"
        }
      >
        <span className={styles.otjTrailNum}>2</span>
        <span>
          <strong>Employer</strong>
          <span>
            {employerReturned
              ? "Returned"
              : employerDone
                ? "Agreed"
                : employerActive
                  ? "Action needed"
                  : "Waiting"}
          </span>
        </span>
      </li>
      <li className={styles.otjTrailArrow} aria-hidden>
        →
      </li>
      <li
        className={styles.otjTrailStep}
        data-state={
          entry.tutorStatus === "returned"
            ? "returned"
            : tutorDone
              ? "done"
              : tutorActive
                ? "active"
                : tutorLocked
                  ? "locked"
                  : "pending"
        }
      >
        <span className={styles.otjTrailNum}>3</span>
        <span>
          <strong>Teacher</strong>
          <span>
            {entry.tutorStatus === "returned"
              ? "Returned"
              : tutorDone
                ? "Final agree"
                : tutorActive
                  ? "Final check"
                  : "Locked until employer agrees"}
          </span>
        </span>
      </li>
    </ol>
  );
}

function toDateInputValue(iso?: string): string {
  const d = iso ? new Date(iso) : new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function OtjLogEntry({
  entry,
  employerContact,
  tutorName,
  initialOpen = false,
}: {
  entry: ApprenticeOtjEntry;
  employerContact: string;
  tutorName: string;
  initialOpen?: boolean;
}) {
  const [open, setOpen] = useState(initialOpen);
  const panelId = `otj-detail-${entry.id}`;
  const catchUp = isOtjCatchUpEntry(entry);
  const fullyAgreed =
    entry.employerStatus === "agreed" && entry.tutorStatus === "agreed";
  const needsInput =
    entry.employerStatus === "returned" ||
    entry.tutorStatus === "returned" ||
    !fullyAgreed;

  return (
    <Shareable
      as="li"
      id={`otj-entry-${entry.id}`}
      kind={needsInput ? "action" : "view"}
      href={`/apprentice/otj?otj=${entry.id}`}
      title={`OTJ · Entry ${entry.entryNumber} · ${entry.activityName}`}
      detail={`${formatOtjDuration(entry.durationMinutes)} · ${otjPipelineLabel(entry)}`}
      area="OTJ log"
      actionLabel={needsInput ? "Open OTJ entry" : "View OTJ entry"}
      className={styles.otjEntry}
      dataAttrs={{
        "data-catch-up": catchUp ? "true" : undefined,
        "data-focus": initialOpen ? "true" : undefined,
      }}
    >
      <button
        type="button"
        className={styles.otjEntryToggle}
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((v) => !v)}
      >
        <span className={styles.otjEntryMain}>
          <strong>
            Entry {entry.entryNumber} · {entry.activityName}
          </strong>
          <span>
            {formatOtjDuration(entry.durationMinutes)} ·{" "}
            {otjTrainingTypeLabel(entry.trainingType)}
            {entry.trainingType === "OTHER" && entry.trainingTypeOther
              ? ` (${entry.trainingTypeOther})`
              : ""}{" "}
            · {formatOtjActivityPeriod(entry)}
          </span>
        </span>
        <span className={styles.otjEntryMeta}>
          {catchUp ? (
            <ApprenticeStatusChip tone="amber">Catch-up block</ApprenticeStatusChip>
          ) : null}
          <ApprenticeStatusChip tone={pipelineTone(entry)}>
            {otjPipelineLabel(entry)}
          </ApprenticeStatusChip>
          <span className={styles.otjChevron} aria-hidden>
            {open ? "▾" : "▸"}
          </span>
        </span>
      </button>

      {open ? (
        <div id={panelId} className={styles.otjEntryPanel}>
          {catchUp ? (
            <p className={styles.otjCatchUpNote}>
              Catch-up claim · {otjHours(entry)}h across{" "}
              {formatOtjActivityPeriod(entry)}. Allowed — employer and teacher
              should review the period as one block.
            </p>
          ) : null}
          <div className={styles.otjDetailGrid}>
            <div>
              <p className={styles.otjDetailLabel}>Activity period</p>
              <p className={styles.otjDetailValue}>
                {formatOtjActivityPeriod(entry)}
              </p>
            </div>
            <div>
              <p className={styles.otjDetailLabel}>Comments</p>
              <p className={styles.otjDetailValue}>{entry.comments}</p>
            </div>
            <div>
              <p className={styles.otjDetailLabel}>Submitted</p>
              <p className={styles.otjDetailValue}>
                {formatModuleDate(entry.submittedAt)}
                {entry.apprenticeConfirmed
                  ? " · Apprentice confirmed OTJ definition"
                  : ""}
              </p>
            </div>
            <div>
              <p className={styles.otjDetailLabel}>Employer</p>
              <p className={styles.otjDetailValue}>
                {entry.employerStatus === "agreed" && entry.employerName
                  ? `${entry.employerName} agreed · ${formatModuleDate(entry.employerDecidedAt)}`
                  : entry.employerStatus === "returned"
                    ? "Returned — needs your update"
                    : `Waiting for ${employerContact}`}
              </p>
              {entry.employerNote ? (
                <p className={styles.meta}>{entry.employerNote}</p>
              ) : null}
            </div>
            <div>
              <p className={styles.otjDetailLabel}>Teacher (final)</p>
              <p className={styles.otjDetailValue}>
                {entry.tutorStatus === "agreed" && entry.tutorName
                  ? `${entry.tutorName} confirmed · ${formatModuleDate(entry.tutorDecidedAt)}`
                  : entry.tutorStatus === "returned"
                    ? "Returned — needs your update"
                    : entry.tutorStatus === "not_ready" ||
                        entry.employerStatus !== "agreed"
                      ? "Locked — teacher can only agree after the employer"
                      : `Waiting for ${tutorName}`}
              </p>
              {entry.tutorNote ? (
                <p className={styles.meta}>{entry.tutorNote}</p>
              ) : null}
            </div>
          </div>
          <OtjApprovalTrail entry={entry} />
          <div className={styles.otjChipRow}>
            <ApprenticeStatusChip tone="green">
              {partyLabel("Apprentice", "done")}
            </ApprenticeStatusChip>
            <ApprenticeStatusChip tone={partyTone(entry.employerStatus)}>
              {partyLabel("Employer", entry.employerStatus)}
            </ApprenticeStatusChip>
            <ApprenticeStatusChip tone={partyTone(entry.tutorStatus)}>
              {partyLabel("Teacher", entry.tutorStatus)}
            </ApprenticeStatusChip>
          </div>
        </div>
      ) : null}
    </Shareable>
  );
}

const DURATION_PRESETS = [
  { label: "30 min", minutes: 30 },
  { label: "1 hour", minutes: 60 },
  { label: "1.5 hours", minutes: 90 },
  { label: "2 hours", minutes: 120 },
] as const;

function readOtjQueryId(): string | null {
  if (typeof window === "undefined") return null;
  return new URLSearchParams(window.location.search).get("otj");
}

export function ApprenticeOtjHoursScreen() {
  const { profile, live } = useApprenticePortalProfile();
  const initialOtjId = readOtjQueryId();
  const [focusOtjId] = useState<string | null>(initialOtjId);
  const [otjEntries, setOtjEntries] = useState<ApprenticeOtjEntry[]>(() =>
    live ? [] : ALEX_OTJ_ENTRIES,
  );
  const [activityDate, setActivityDate] = useState(toDateInputValue());
  const [activityDateEnd, setActivityDateEnd] = useState("");
  const [isCatchUp, setIsCatchUp] = useState(false);
  const [activityName, setActivityName] = useState("");
  const [durationMinutes, setDurationMinutes] = useState(60);
  const [customMinutes, setCustomMinutes] = useState("");
  const [customHours, setCustomHours] = useState("");
  const [useCustomDuration, setUseCustomDuration] = useState(false);
  const [durationUnit, setDurationUnit] = useState<"minutes" | "hours">("minutes");
  const [trainingType, setTrainingType] = useState<OtjTrainingTypeCode>("PM");
  const [trainingTypeOther, setTrainingTypeOther] = useState("");
  const [comments, setComments] = useState("");
  const [apprenticeConfirmed, setApprenticeConfirmed] = useState(false);
  const [formNote, setFormNote] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [showLog, setShowLog] = useState(() => initialOtjId !== null);

  useEffect(() => {
    if (!focusOtjId) return;
    const timer = window.setTimeout(() => {
      document
        .getElementById(`otj-entry-${focusOtjId}`)
        ?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 80);
    return () => window.clearTimeout(timer);
  }, [focusOtjId]);

  const dashboard = useMemo(
    () => buildOtjDashboardStats(otjEntries, profile.programmeWeek),
    [otjEntries, profile.programmeWeek],
  );

  const loggingHealth = useMemo(
    () => buildOtjLoggingHealth(otjEntries),
    [otjEntries],
  );

  function resolvedMinutes(): number {
    if (useCustomDuration) {
      if (durationUnit === "hours") {
        const n = Number(customHours);
        return Number.isFinite(n) && n > 0 ? Math.round(n * 60) : 0;
      }
      const n = Number(customMinutes);
      return Number.isFinite(n) && n > 0 ? Math.round(n) : 0;
    }
    return durationMinutes;
  }

  function enableCatchUpMode(next: boolean) {
    setIsCatchUp(next);
    if (next) {
      setUseCustomDuration(true);
      setDurationUnit("hours");
      if (!customHours) setCustomHours(String(OTJ_CATCH_UP_HOURS_HINT));
    }
  }

  function submitOtj(e: FormEvent) {
    e.preventDefault();
    const mins = resolvedMinutes();
    if (!activityName.trim()) {
      setFormNote("Add an activity name for this training.");
      return;
    }
    if (mins <= 0) {
      setFormNote("Choose a training time (or enter custom minutes / hours).");
      return;
    }
    if (isCatchUp && !activityDateEnd) {
      setFormNote("Catch-up blocks need an end date for the period covered.");
      return;
    }
    if (activityDateEnd && activityDateEnd < activityDate) {
      setFormNote("End date must be on or after the start date.");
      return;
    }
    if (trainingType === "OTHER" && !trainingTypeOther.trim()) {
      setFormNote("Describe the other training type.");
      return;
    }
    if (!comments.trim()) {
      setFormNote("Add comments describing what you did and learned.");
      return;
    }
    if (!apprenticeConfirmed) {
      setFormNote("Confirm the off-the-job definition before submitting.");
      return;
    }

    const now = new Date();
    const endIso = activityDateEnd
      ? new Date(`${activityDateEnd}T17:00:00`).toISOString()
      : null;
    const draftFlags = {
      isCatchUp,
      durationMinutes: mins,
      activityDate: new Date(`${activityDate}T12:00:00`).toISOString(),
      activityDateEnd: endIso,
    };
    const treatAsCatchUp = isOtjCatchUpEntry(draftFlags);

    const next: ApprenticeOtjEntry = {
      id: `otj-${Date.now().toString(36)}`,
      entryNumber: nextOtjEntryNumber(otjEntries),
      activityName: activityName.trim(),
      activityDate: draftFlags.activityDate,
      activityDateEnd: endIso,
      durationMinutes: mins,
      trainingType,
      trainingTypeOther:
        trainingType === "OTHER" ? trainingTypeOther.trim() : null,
      comments: comments.trim(),
      submittedAt: now.toISOString(),
      isCatchUp: treatAsCatchUp,
      apprenticeConfirmed: true,
      employerStatus: "pending",
      employerName: null,
      employerDecidedAt: null,
      employerNote: null,
      tutorStatus: "not_ready",
      tutorName: null,
      tutorDecidedAt: null,
      tutorNote: null,
    };

    setOtjEntries((prev) => [next, ...prev]);
    setActivityName("");
    setComments("");
    setTrainingType("PM");
    setTrainingTypeOther("");
    setDurationMinutes(60);
    setCustomMinutes("");
    setCustomHours("");
    setUseCustomDuration(false);
    setDurationUnit("minutes");
    setIsCatchUp(false);
    setActivityDateEnd("");
    setApprenticeConfirmed(false);
    setActivityDate(toDateInputValue());
    setShowForm(false);
    setShowLog(true);
    setFormNote(
      treatAsCatchUp
        ? `Submitted catch-up entry ${next.entryNumber} (${formatOtjDuration(next.durationMinutes)} · ${formatOtjActivityPeriod(next)}) — next: ${profile.employerContact} must agree, then ${profile.tutorName} gives final teacher agree.`
        : `Submitted entry ${next.entryNumber} (${formatOtjDuration(next.durationMinutes)}) — next: ${profile.employerContact} must agree, then ${profile.tutorName} gives final teacher agree.`,
    );
  }

  return (
    <ApprenticePageShell
      title="OTJ hours"
      description="Log off-the-job training with task details, time, and training type. Track progress toward your programme hours."
    >
      <div className={styles.stack}>
        <section className={styles.otjHero} aria-labelledby="otj-heading">
          <div className={styles.otjHeroHead}>
            <div>
              <p className={styles.otjKicker}>Off-the-job training log</p>
              <h2 id="otj-heading" className={styles.otjHeroTitle}>
                OTJ hours
              </h2>
              <p className={styles.otjHeroCopy}>
                Log your hours every week — that is what we expect, and it keeps
                your evidence accurate. Catch-up blocks are a last resort only,
                and must be marked clearly for employer and teacher review.
              </p>
            </div>
            <button
              type="button"
              className={styles.primaryBtn}
              aria-expanded={showForm}
              aria-controls="otj-log-form"
              onClick={() => setShowForm((v) => !v)}
            >
              {showForm ? "Close log form" : "Log OTJ hours"}
            </button>
          </div>

          {loggingHealth.alert && loggingHealth.apprenticeNudge ? (
            <div
              className={styles.otjGapAlert}
              data-kind={loggingHealth.alertKind}
              role="status"
            >
              <p className={styles.otjGapAlertTitle}>Logging reminder</p>
              <p className={styles.otjGapAlertCopy}>{loggingHealth.apprenticeNudge}</p>
              {loggingHealth.lastSubmittedAt ? (
                <p className={styles.meta}>
                  Last submitted {formatModuleDate(loggingHealth.lastSubmittedAt)}
                  {loggingHealth.daysSinceLastSubmit != null
                    ? ` · ${loggingHealth.daysSinceLastSubmit} days ago`
                    : ""}
                </p>
              ) : null}
            </div>
          ) : null}

          <div className={styles.otjHealthBar} data-health={dashboard.health}>
            <div className={styles.otjHealthMain}>
              <p className={styles.otjHealthLabel}>OTJ progress</p>
              <p className={styles.otjHealthValue}>
                {dashboard.summary.agreedHours}h / {dashboard.minimumHours}h
                <span> programme minimum</span>
              </p>
              <p className={styles.otjHealthHint}>{dashboard.healthLabel}</p>
            </div>
            <div className={styles.otjHealthSide}>
              <p className={styles.otjHealthPercent}>{dashboard.progressPercent}%</p>
              <div className={styles.otjHealthTrack} aria-hidden>
                <div
                  className={styles.otjHealthFill}
                  style={{ width: `${dashboard.progressPercent}%` }}
                />
              </div>
              <p className={styles.meta}>
                Expected ~{dashboard.expectedHours}h by week{" "}
                {profile.programmeWeek}
              </p>
            </div>
          </div>

          <div className={styles.otjSummaryGrid}>
            {dashboard.cards.map((card) => (
              <div
                key={card.id}
                className={styles.otjSummaryCard}
                data-tone={card.tone}
              >
                <p className={styles.glanceLabel}>{card.label}</p>
                <p className={styles.glanceValue}>{card.value}</p>
                <p className={styles.glanceHint}>{card.hint}</p>
                <p
                  className={styles.otjStatTrend}
                  data-good={card.trendIsGood ? "true" : "false"}
                  data-direction={card.trendDirection}
                >
                  {card.trendLabel}
                </p>
              </div>
            ))}
          </div>

          {formNote ? <p className={styles.note}>{formNote}</p> : null}

          {showForm ? (
            <form
              id="otj-log-form"
              className={styles.otjForm}
              onSubmit={submitOtj}
            >
              <h3 className={styles.sectionTitle}>Log new OTJ entry</h3>
              <p className={styles.meta}>
                Complete each field as on the training log. Order is fixed: you
                submit → {profile.employerContact} agrees it is true →{" "}
                {profile.tutorName} gives the final teacher agree.
              </p>

              <label className={styles.otjConfirm}>
                <input
                  type="checkbox"
                  checked={isCatchUp}
                  onChange={(e) => enableCatchUpMode(e.target.checked)}
                />
                <span>
                  This is a <strong>catch-up block</strong> — one entry covering
                  a longer period (not logged week-by-week). Large hours are OK;
                  employer and teacher will review the whole claim.
                </span>
              </label>

              <div className={styles.formGrid}>
                <label className={styles.field}>
                  <span>{isCatchUp ? "Period start" : "Date completed"}</span>
                  <input
                    type="date"
                    value={activityDate}
                    onChange={(e) => setActivityDate(e.target.value)}
                    required
                  />
                </label>
                {isCatchUp ? (
                  <label className={styles.field}>
                    <span>Period end</span>
                    <input
                      type="date"
                      value={activityDateEnd}
                      onChange={(e) => setActivityDateEnd(e.target.value)}
                      required
                    />
                  </label>
                ) : (
                  <label className={styles.field}>
                    <span>Entry number (auto)</span>
                    <input
                      type="text"
                      value={String(nextOtjEntryNumber(otjEntries))}
                      readOnly
                      aria-readonly="true"
                    />
                  </label>
                )}
              </div>

              {isCatchUp ? (
                <label className={styles.field}>
                  <span>Entry number (auto)</span>
                  <input
                    type="text"
                    value={String(nextOtjEntryNumber(otjEntries))}
                    readOnly
                    aria-readonly="true"
                  />
                </label>
              ) : null}

              <label className={styles.field}>
                <span>Activity name</span>
                <input
                  type="text"
                  value={activityName}
                  onChange={(e) => setActivityName(e.target.value)}
                  placeholder={
                    isCatchUp
                      ? "e.g. Catch-up OTJ block — May to July"
                      : "e.g. Diagnostic scanner mentoring"
                  }
                  required
                />
              </label>

              <fieldset className={styles.otjFieldset}>
                <legend>Training time</legend>
                {!isCatchUp ? (
                  <div className={styles.otjPresetRow}>
                    {DURATION_PRESETS.map((preset) => (
                      <button
                        key={preset.minutes}
                        type="button"
                        className={
                          !useCustomDuration && durationMinutes === preset.minutes
                            ? styles.otjPresetActive
                            : styles.otjPreset
                        }
                        onClick={() => {
                          setUseCustomDuration(false);
                          setDurationMinutes(preset.minutes);
                        }}
                      >
                        {preset.label}
                      </button>
                    ))}
                    <button
                      type="button"
                      className={
                        useCustomDuration ? styles.otjPresetActive : styles.otjPreset
                      }
                      onClick={() => setUseCustomDuration(true)}
                    >
                      Other
                    </button>
                  </div>
                ) : (
                  <p className={styles.meta}>
                    Enter the total hours for this catch-up period (for example
                    167).
                  </p>
                )}
                {useCustomDuration || isCatchUp ? (
                  <div className={styles.formGrid}>
                    <label className={styles.field}>
                      <span>{durationUnit === "hours" ? "Hours" : "Minutes"}</span>
                      <input
                        type="number"
                        min={durationUnit === "hours" ? 0.25 : 5}
                        step={durationUnit === "hours" ? 0.25 : 5}
                        value={durationUnit === "hours" ? customHours : customMinutes}
                        onChange={(e) =>
                          durationUnit === "hours"
                            ? setCustomHours(e.target.value)
                            : setCustomMinutes(e.target.value)
                        }
                        placeholder={durationUnit === "hours" ? "e.g. 167" : "e.g. 45"}
                        required
                      />
                    </label>
                    <label className={styles.field}>
                      <span>Unit</span>
                      <select
                        value={durationUnit}
                        onChange={(e) =>
                          setDurationUnit(e.target.value as "minutes" | "hours")
                        }
                      >
                        <option value="hours">Hours</option>
                        <option value="minutes">Minutes</option>
                      </select>
                    </label>
                  </div>
                ) : (
                  <p className={styles.meta}>
                    Selected: {formatOtjDuration(durationMinutes)} (
                    {otjHours({ durationMinutes })}h)
                  </p>
                )}
                {(useCustomDuration || isCatchUp) && resolvedMinutes() > 0 ? (
                  <p className={styles.meta}>
                    Total: {formatOtjDuration(resolvedMinutes())} (
                    {otjHours({ durationMinutes: resolvedMinutes() })}h)
                    {resolvedMinutes() >= OTJ_CATCH_UP_HOURS_HINT * 60
                      ? " · will show as a catch-up block"
                      : ""}
                  </p>
                ) : null}
              </fieldset>

              <label className={styles.field}>
                <span>Training type</span>
                <select
                  value={trainingType}
                  onChange={(e) =>
                    setTrainingType(e.target.value as OtjTrainingTypeCode)
                  }
                  required
                >
                  {OTJ_TRAINING_TYPES.map((t) => (
                    <option key={t.code} value={t.code}>
                      {t.code} — {t.label}
                    </option>
                  ))}
                </select>
              </label>

              {trainingType === "OTHER" ? (
                <label className={styles.field}>
                  <span>Other training type</span>
                  <input
                    type="text"
                    value={trainingTypeOther}
                    onChange={(e) => setTrainingTypeOther(e.target.value)}
                    placeholder="Describe the training type"
                    required
                  />
                </label>
              ) : null}

              <label className={styles.field}>
                <span>Comments</span>
                <textarea
                  rows={3}
                  value={comments}
                  onChange={(e) => setComments(e.target.value)}
                  placeholder={
                    isCatchUp
                      ? "Summarise what the catch-up period covered (mentoring, modules, job cards…)."
                      : "What did you do, and how does it support your apprenticeship?"
                  }
                  required
                />
              </label>

              <label className={styles.otjConfirm}>
                <input
                  type="checkbox"
                  checked={apprenticeConfirmed}
                  onChange={(e) => setApprenticeConfirmed(e.target.checked)}
                />
                <span>
                  I confirm this was off-the-job training outside normal day-to-day
                  duties, directly relevant to my apprenticeship, and completed in
                  paid work time or time in lieu.
                </span>
              </label>

              <div className={styles.formActions}>
                <button type="submit" className={styles.primaryBtn}>
                  Submit for employer agreement
                </button>
              </div>
            </form>
          ) : null}

          <div className={styles.otjLogBlock}>
            <button
              type="button"
              className={styles.otjLogToggle}
              aria-expanded={showLog}
              aria-controls="otj-hours-log-panel"
              onClick={() => setShowLog((v) => !v)}
            >
              <span className={styles.otjLogToggleMain}>
                <strong>OTJ hours log</strong>
                <span>
                  {otjEntries.length}{" "}
                  {otjEntries.length === 1 ? "entry" : "entries"}
                  {showLog ? "" : " · minimised"}
                </span>
              </span>
              <span className={styles.otjLogToggleHint}>
                {showLog ? "Hide log" : "Show log"}
                <span className={styles.otjChevron} aria-hidden>
                  {showLog ? "▾" : "▸"}
                </span>
              </span>
            </button>

            {showLog ? (
              <div id="otj-hours-log-panel" className={styles.otjLogPanel}>
                {otjEntries.length === 0 ? (
                  <p className={styles.empty}>No OTJ hours logged yet.</p>
                ) : (
                  <ul className={styles.otjLogList}>
                    {otjEntries.map((entry) => (
                      <OtjLogEntry
                        key={entry.id}
                        entry={entry}
                        employerContact={profile.employerContact}
                        tutorName={profile.tutorName}
                        initialOpen={focusOtjId === entry.id}
                      />
                    ))}
                  </ul>
                )}
              </div>
            ) : null}
          </div>
        </section>
      </div>
    </ApprenticePageShell>
  );
}
