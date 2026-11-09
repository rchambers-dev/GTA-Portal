"use client";

import { useState, type Dispatch, type FormEvent, type SetStateAction } from "react";
import { useRouter } from "next/navigation";
import { Select } from "@/components/ui";
import {
  CHECKLIST_EMPTY_NOTE,
  EXTENSION_PAPERWORK_HELP,
  PLANNED_DATE_TYPES,
  PLANNED_RETURN_HELP,
  RETURN_ANY_TIME_HELP,
  dateChangeActorLines,
  dateChangeExplanation,
  dateChangeReasonLabel,
  dateChangeStatusLabel,
  extensionPaperworkLabel,
  formatOptionalDate,
  formatPortalTimestamp,
  isPlannedDateOverdue,
  plannedDateIsSet,
  plannedDateRow,
  plannedReturnOn,
  programmeIdentity,
  returnFromBreakReady,
  type ApprenticeBreaks,
  type ApprenticeProgrammePage,
  type DateChangeRecord,
  type EffectiveDates,
  type OpenBreak,
  type PlannedDateRow,
  type StoredDates,
} from "../domain/apprentice-programme";
import type { ApprenticeLearnerRecord } from "../domain/apprentice-tutor";
import {
  approvePlannedDateChangeAction,
  recordReturnCheckResultAction,
  rejectPlannedDateChangeAction,
  requestPlannedDateChangeAction,
  returnFromBreakAction,
  saveApprenticeCourseDatesAction,
  setExtensionPaperworkAction,
  signOffReturnToLearningAction,
  startBreakInLearningAction,
} from "./apprentice-programme-actions";
import styles from "./admin-pages.module.css";

type DateFormState = {
  courseStart: string;
  actualCourseEnd: string;
  actualGateway1: string;
  actualGateway2: string;
  actualEpa: string;
  plannedCourseEnd: string;
  plannedGateway1: string;
  plannedGateway2: string;
  plannedEpa: string;
};

function formFromDates(dates: StoredDates | null): DateFormState {
  return {
    courseStart: dates?.courseStart ?? "",
    actualCourseEnd: dates?.actualCourseEnd ?? "",
    actualGateway1: dates?.actualGateway1 ?? "",
    actualGateway2: dates?.actualGateway2 ?? "",
    actualEpa: dates?.actualEpa ?? "",
    plannedCourseEnd: dates?.plannedCourseEnd ?? "",
    plannedGateway1: dates?.plannedGateway1 ?? "",
    plannedGateway2: dates?.plannedGateway2 ?? "",
    plannedEpa: dates?.plannedEpa ?? "",
  };
}

function useResetWhen<T>(value: T, signature: string): [T, Dispatch<SetStateAction<T>>] {
  const [state, setState] = useState(value);
  const [seen, setSeen] = useState(signature);
  if (seen !== signature) {
    setSeen(signature);
    setState(value);
    return [value, setState];
  }
  return [state, setState];
}

function messageFrom(error: unknown): string {
  return error instanceof Error && error.message
    ? error.message
    : "The change could not be saved.";
}

function statusTone(status: string): "amber" | "green" | "red" | "navy" {
  if (status === "pending") return "amber";
  if (status === "approved") return "green";
  if (status === "rejected") return "red";
  return "navy";
}

export function ApprenticeProgrammePanel({
  canManage,
  apprentice,
  programme,
}: {
  canManage: boolean;
  apprentice: ApprenticeLearnerRecord;
  programme: ApprenticeProgrammePage;
}) {
  const identity = programmeIdentity(apprentice);
  return (
    <div className={styles.stack} data-learner-section="programme">
      {programme.loadError ? (
        <p className={styles.error} role="alert">
          {programme.loadError}
        </p>
      ) : null}
      <section className={styles.learnerCard} aria-labelledby="programme-identity-heading">
        <h2 id="programme-identity-heading" className={styles.formGroupTitle}>
          Programme
        </h2>
        <dl className={styles.learnerFacts}>
          <dt>Name</dt>
          <dd data-learner-programme-name={identity.name}>{identity.name}</dd>
          <dt>Standard code</dt>
          <dd className={styles.assignedId} data-learner-standard-code={identity.standardCode}>
            {identity.standardCode}
          </dd>
        </dl>
      </section>
      <CourseDates
        canManage={canManage}
        gtaId={apprentice.gtaId}
        dates={programme.dates}
        effective={programme.effective}
        today={programme.today}
      />
      <DateChanges
        canManage={canManage}
        gtaId={apprentice.gtaId}
        dates={programme.dates}
        effective={programme.effective}
        changes={programme.changes}
        reasons={programme.dateChangeReasons}
      />
      {canManage && programme.breaks ? (
        <Breaks
          gtaId={apprentice.gtaId}
          status={apprentice.status}
          statusLabel={apprentice.statusLabel}
          breaks={programme.breaks}
          today={programme.today}
        />
      ) : null}
    </div>
  );
}

function plannedFacts(
  row: PlannedDateRow,
  dates: StoredDates,
  effective: EffectiveDates | null,
): { value: string | null; original: string | null; changed: boolean; locked: boolean } {
  const stored = dates[row.plannedKey];
  const effectiveValue = effective ? effective[row.effectiveKey] : null;
  return {
    value: effective ? effectiveValue : stored,
    original: effective ? effective[row.originalKey] : stored,
    changed: effective ? effective[row.changedKey] === true : false,
    locked: plannedDateIsSet(stored, effective ? effectiveValue : null),
  };
}

function CourseDates({
  canManage,
  gtaId,
  dates,
  effective,
  today,
}: {
  canManage: boolean;
  gtaId: string;
  dates: StoredDates | null;
  effective: EffectiveDates | null;
  today: string;
}) {
  const router = useRouter();
  const signature = JSON.stringify(dates);
  const [form, setForm] = useResetWhen(formFromDates(dates), signature);
  const [formError, setFormError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [pending, setPending] = useState(false);

  function setField(key: keyof DateFormState, value: string) {
    setSaved(false);
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!dates) return;
    setFormError(null);
    setSaved(false);
    setPending(true);
    try {
      const result = await saveApprenticeCourseDatesAction({
        gtaId,
        courseStart: form.courseStart,
        actualCourseEnd: form.actualCourseEnd,
        actualGateway1: form.actualGateway1,
        actualGateway2: form.actualGateway2,
        actualEpa: form.actualEpa,
        ...(plannedFacts(PLANNED_DATE_TYPES[0], dates, effective).locked
          ? {}
          : { plannedCourseEnd: form.plannedCourseEnd }),
        ...(plannedFacts(PLANNED_DATE_TYPES[1], dates, effective).locked
          ? {}
          : { plannedGateway1: form.plannedGateway1 }),
        ...(plannedFacts(PLANNED_DATE_TYPES[2], dates, effective).locked
          ? {}
          : { plannedGateway2: form.plannedGateway2 }),
        ...(plannedFacts(PLANNED_DATE_TYPES[3], dates, effective).locked
          ? {}
          : { plannedEpa: form.plannedEpa }),
      });
      if (!result.ok) {
        setFormError(result.formError);
        return;
      }
      setSaved(true);
      router.refresh();
    } catch (error) {
      setFormError(messageFrom(error));
    } finally {
      setPending(false);
    }
  }

  return (
    <section className={styles.learnerCard} aria-labelledby="course-dates-heading">
      <h2 id="course-dates-heading" className={styles.formGroupTitle}>
        Course dates
      </h2>
      <p className={styles.formGroupMeta}>
        {canManage
          ? "Course start, actual dates, and a planned date that is still empty can be saved here. Once a planned date is set, change it with a date change request."
          : "You can view these dates. Administrator and Management can change them."}
      </p>
      {dates ? (
        <form onSubmit={onSubmit} noValidate>
          <div className={styles.dateGrid}>
            <DateSlot
              label="Course start"
              value={dates.courseStart}
              editable={canManage}
              inputValue={form.courseStart}
              pending={pending}
              onChange={(value) => setField("courseStart", value)}
              field="courseStart"
            />
            {PLANNED_DATE_TYPES.map((row) => {
              const facts = plannedFacts(row, dates, effective);
              const overdue = isPlannedDateOverdue(facts.value, dates[row.actualKey], today);
              return (
                <div key={row.id} className={styles.dateSpan}>
                  <div className={styles.learnerField} data-course-date={row.id}>
                    <span>{row.plannedLabel}</span>
                    {canManage && !facts.locked ? (
                      <input
                        type="date"
                        value={form[row.plannedKey]}
                        disabled={pending}
                        aria-label={row.plannedLabel}
                        onChange={(event) => setField(row.plannedKey, event.target.value)}
                      />
                    ) : (
                      <p className={styles.dateValue}>{formatOptionalDate(facts.value)}</p>
                    )}
                    {facts.changed ? (
                      <p className={styles.dateNotes} data-date-changed={row.id}>
                        <span className={styles.statusPill} data-static="true" data-tone="amber">
                          Changed
                        </span>
                        <span data-date-original={row.id}>
                          Original: {formatOptionalDate(facts.original)}
                        </span>
                      </p>
                    ) : null}
                    {overdue ? (
                      <p className={styles.dateNotes} data-date-overdue={row.id}>
                        <span className={styles.statusPill} data-static="true" data-tone="red">
                          Passed, no actual date
                        </span>
                      </p>
                    ) : null}
                    {canManage && facts.locked ? (
                      <p className={styles.formGroupMeta}>Change this date with a date change request.</p>
                    ) : null}
                  </div>
                  <DateSlot
                    label={row.actualLabel}
                    value={dates[row.actualKey]}
                    editable={canManage}
                    inputValue={form[row.actualKey]}
                    pending={pending}
                    onChange={(value) => setField(row.actualKey, value)}
                    field={row.actualKey}
                  />
                </div>
              );
            })}
          </div>
          {formError ? (
            <p className={styles.error} role="alert">
              {formError}
            </p>
          ) : null}
          {saved ? (
            <p className={styles.success} role="status">
              Dates saved.
            </p>
          ) : null}
          {canManage ? (
            <div className={styles.learnerActions}>
              <button
                type="submit"
                className={styles.primaryBtn}
                disabled={pending}
                data-save-course-dates="live"
              >
                {pending ? "Saving…" : "Save dates"}
              </button>
            </div>
          ) : null}
        </form>
      ) : (
        <p className={styles.empty} role="status">
          Course dates are not available.
        </p>
      )}
    </section>
  );
}

function DateSlot({
  label,
  value,
  editable,
  inputValue,
  pending,
  onChange,
  field,
}: {
  label: string;
  value: string | null;
  editable: boolean;
  inputValue: string;
  pending: boolean;
  onChange: (value: string) => void;
  field: string;
}) {
  if (!editable) {
    return (
      <div className={styles.learnerField} data-course-date={field}>
        <span>{label}</span>
        <p className={styles.dateValue}>{formatOptionalDate(value)}</p>
      </div>
    );
  }
  return (
    <label className={styles.learnerField} data-course-date={field}>
      <span>{label}</span>
      <input
        type="date"
        value={inputValue}
        disabled={pending}
        aria-label={label}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}

function DateChanges({
  canManage,
  gtaId,
  dates,
  effective,
  changes,
  reasons,
}: {
  canManage: boolean;
  gtaId: string;
  dates: StoredDates | null;
  effective: EffectiveDates | null;
  changes: DateChangeRecord[];
  reasons: ApprenticeProgrammePage["dateChangeReasons"];
}) {
  const pending = changes.filter((change) => change.status === "pending");
  const changeable = PLANNED_DATE_TYPES.filter((row) => {
    if (!dates) return false;
    const stored = dates[row.plannedKey];
    const current = effective ? effective[row.effectiveKey] : null;
    return plannedDateIsSet(stored, current);
  });

  return (
    <section className={styles.learnerCard} aria-labelledby="date-changes-heading">
      <h2 id="date-changes-heading" className={styles.formGroupTitle}>
        Date changes
      </h2>
      {canManage ? (
        changeable.length > 0 ? (
          <DateChangeForm gtaId={gtaId} dates={dates} effective={effective} reasons={reasons} rows={changeable} />
        ) : (
          <p className={styles.formGroupMeta}>
            Set a planned date first. Once it is saved, changes go through a date change request.
          </p>
        )
      ) : (
        <p className={styles.formGroupMeta} role="status">
          You can view date changes. Administrator and Management can request, approve, or reject them.
        </p>
      )}
      <h3 className={styles.formGroupTitle}>Pending</h3>
      {pending.length === 0 ? (
        <p className={styles.empty} role="status">
          No pending date changes.
        </p>
      ) : (
        <ul className={styles.changeList}>
          {pending.map((change) => (
            <li key={change.id}>
              <ChangeCard change={change} canManage={canManage} pendingActions />
            </li>
          ))}
        </ul>
      )}
      <h3 className={styles.formGroupTitle}>History</h3>
      {changes.length === 0 ? (
        <p className={styles.empty} role="status">
          No date changes.
        </p>
      ) : (
        <ul className={styles.changeList} data-date-change-history="live">
          {changes.map((change) => (
            <li key={change.id}>
              <ChangeCard change={change} canManage={false} pendingActions={false} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function DateChangeForm({
  gtaId,
  dates,
  effective,
  reasons,
  rows,
}: {
  gtaId: string;
  dates: StoredDates | null;
  effective: EffectiveDates | null;
  reasons: ApprenticeProgrammePage["dateChangeReasons"];
  rows: readonly PlannedDateRow[];
}) {
  const router = useRouter();
  const [dateType, setDateType] = useState<string>(rows[0]?.id ?? "");
  const [newDate, setNewDate] = useState("");
  const [reasonId, setReasonId] = useState("");
  const [explanation, setExplanation] = useState("");
  const [paperwork, setPaperwork] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [pending, setPending] = useState(false);
  const selected = plannedDateRow(dateType);
  const current = selected
    ? effective
      ? effective[selected.effectiveKey]
      : dates?.[selected.plannedKey] ?? null
    : null;

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaved(false);
    if (!selected) {
      setFormError("Choose course end, gateway 1, gateway 2, or EPA.");
      return;
    }
    if (newDate && current && newDate === current) {
      setFormError("The new date is the same as the current planned date.");
      return;
    }
    setFormError(null);
    setPending(true);
    try {
      const result = await requestPlannedDateChangeAction({
        gtaId,
        dateType,
        newDate,
        reasonId,
        explanation,
        extensionPaperwork: dateType === "course_end" && paperwork,
      });
      if (!result.ok) {
        setFormError(result.formError);
        return;
      }
      setNewDate("");
      setReasonId("");
      setExplanation("");
      setPaperwork(false);
      setSaved(true);
      router.refresh();
    } catch (error) {
      setFormError(messageFrom(error));
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={onSubmit} noValidate data-date-change-request="live">
      <div className={styles.learnerField}>
        <span>
          Which date<em className={styles.fieldRequired}> required</em>
        </span>
        <Select
          aria-label="Which date"
          value={dateType}
          disabled={pending}
          placeholder="Choose a date"
          options={rows.map((row) => ({ value: row.id, label: row.label }))}
          onChange={setDateType}
        />
      </div>
      {selected ? (
        <p className={styles.formGroupMeta}>Current planned date: {formatOptionalDate(current)}</p>
      ) : null}
      <label className={styles.learnerField}>
        <span>
          New date<em className={styles.fieldRequired}> required</em>
        </span>
        <input
          type="date"
          value={newDate}
          disabled={pending}
          aria-label="New date"
          onChange={(event) => setNewDate(event.target.value)}
        />
      </label>
      <div className={styles.learnerField}>
        <span>
          Reason<em className={styles.fieldRequired}> required</em>
        </span>
        <Select
          aria-label="Reason"
          value={reasonId}
          disabled={pending || reasons.length === 0}
          invalid={Boolean(formError) && !reasonId}
          placeholder={reasons.length === 0 ? "No reasons are available" : "Choose a reason"}
          options={reasons.map((reason) => ({ value: reason.id, label: reason.label }))}
          onChange={setReasonId}
        />
      </div>
      <label className={styles.learnerField}>
        <span>
          Explanation<em className={styles.fieldRequired}> required</em>
        </span>
        <textarea
          value={explanation}
          disabled={pending}
          aria-label="Explanation"
          onChange={(event) => setExplanation(event.target.value)}
        />
      </label>
      {dateType === "course_end" ? (
        <label className={styles.checkRow}>
          <input
            type="checkbox"
            checked={paperwork}
            disabled={pending}
            data-extension-paperwork="request"
            onChange={(event) => setPaperwork(event.target.checked)}
          />
          <span>
            Extension paperwork
            <small>{EXTENSION_PAPERWORK_HELP}</small>
          </span>
        </label>
      ) : null}
      {formError ? (
        <p className={styles.error} role="alert">
          {formError}
        </p>
      ) : null}
      {saved ? (
        <p className={styles.success} role="status">
          Date change requested.
        </p>
      ) : null}
      <div className={styles.learnerActions}>
        <button type="submit" className={styles.primaryBtn} disabled={pending}>
          {pending ? "Requesting…" : "Request change"}
        </button>
      </div>
    </form>
  );
}

function ChangeCard({
  change,
  canManage,
  pendingActions,
}: {
  change: DateChangeRecord;
  canManage: boolean;
  pendingActions: boolean;
}) {
  const router = useRouter();
  const explanation = dateChangeExplanation(change);
  const withheld = change.isSafeguarding && !explanation;
  const row = plannedDateRow(change.dateType);
  const [paperwork, setPaperwork] = useResetWhen(
    change.extensionPaperwork,
    `${change.id}:${change.extensionPaperwork}`,
  );
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, setPending] = useState<string | null>(null);
  const paperworkBlocks = change.dateType === "course_end" && !paperwork;
  const showActions = canManage && pendingActions && change.status === "pending";

  async function run(
    key: string,
    action: () => Promise<{ ok: true } | { ok: false; formError: string }>,
  ) {
    setFormError(null);
    setPending(key);
    try {
      const result = await action();
      if (!result.ok) {
        setFormError(result.formError);
        return;
      }
      router.refresh();
    } catch (error) {
      setFormError(messageFrom(error));
    } finally {
      setPending(null);
    }
  }

  async function onPaperwork(received: boolean) {
    const previous = paperwork;
    setPaperwork(received);
    setPending("paperwork");
    setFormError(null);
    try {
      const result = await setExtensionPaperworkAction({ changeId: change.id, received });
      if (!result.ok) {
        setPaperwork(previous);
        setFormError(result.formError);
        return;
      }
      router.refresh();
    } catch (error) {
      setPaperwork(previous);
      setFormError(messageFrom(error));
    } finally {
      setPending(null);
    }
  }

  return (
    <article
      className={styles.changeCard}
      data-date-change={change.id}
      data-safeguarding-redacted={withheld ? "true" : undefined}
    >
      <div className={styles.changeHead}>
        <h3>{row?.label ?? change.dateType}</h3>
        <span className={styles.statusPill} data-static="true" data-tone={statusTone(change.status)}>
          {dateChangeStatusLabel(change.status)}
        </span>
      </div>
      <p className={styles.dateValue}>
        {formatOptionalDate(change.oldDate)} → {formatOptionalDate(change.newDate)}
      </p>
      <p>Reason: {dateChangeReasonLabel(change)}</p>
      {explanation ? <p className={styles.preWrap}>{explanation}</p> : null}
      {change.dateType === "course_end" && showActions ? (
        <label className={styles.checkRow}>
          <input
            type="checkbox"
            checked={paperwork}
            disabled={pending !== null}
            data-extension-paperwork={change.id}
            onChange={(event) => void onPaperwork(event.target.checked)}
          />
          <span>
            Extension paperwork received
            <small>{EXTENSION_PAPERWORK_HELP}</small>
          </span>
        </label>
      ) : change.dateType === "course_end" ? (
        <p>{extensionPaperworkLabel(change.extensionPaperwork)}</p>
      ) : null}
      {showActions && paperworkBlocks ? (
        <p className={styles.error} id={`paperwork-block-${change.id}`}>
          Extension paperwork must be ticked before this course end change can be approved.
        </p>
      ) : null}
      {dateChangeActorLines(change).map((line) => (
        <p key={line} className={styles.formGroupMeta}>
          {line}
        </p>
      ))}
      {formError ? (
        <p className={styles.error} role="alert">
          {formError}
        </p>
      ) : null}
      {showActions ? (
        <div className={styles.learnerActions}>
          <button
            type="button"
            className={styles.primaryBtn}
            data-approve-change={change.id}
            disabled={pending !== null || paperworkBlocks}
            aria-describedby={paperworkBlocks ? `paperwork-block-${change.id}` : undefined}
            onClick={() => void run("approve", () => approvePlannedDateChangeAction({ changeId: change.id }))}
          >
            {pending === "approve" ? "Approving…" : "Approve"}
          </button>
          <button
            type="button"
            className={styles.secondaryBtn}
            data-reject-change={change.id}
            disabled={pending !== null}
            onClick={() => void run("reject", () => rejectPlannedDateChangeAction({ changeId: change.id }))}
          >
            {pending === "reject" ? "Rejecting…" : "Reject"}
          </button>
        </div>
      ) : null}
    </article>
  );
}

function Breaks({
  gtaId,
  status,
  statusLabel,
  breaks,
  today,
}: {
  gtaId: string;
  status: string;
  statusLabel: string;
  breaks: ApprenticeBreaks;
  today: string;
}) {
  const closed = status === "withdrawn" || status === "completed";
  return (
    <section className={styles.learnerCard} aria-labelledby="breaks-heading" data-break-section="live">
      <h2 id="breaks-heading" className={styles.formGroupTitle}>
        Breaks in learning
      </h2>
      {breaks.multipleOpen ? (
        <p className={styles.error} role="alert">
          This apprentice has more than one open break. The latest one is shown.
        </p>
      ) : null}
      {breaks.open ? (
        <OpenBreakPanel open={breaks.open} />
      ) : closed ? (
        <p className={styles.formGroupMeta} role="status">
          A break cannot be started while the status is {statusLabel}.
        </p>
      ) : (
        <StartBreak gtaId={gtaId} reasons={breaks.reasons} today={today} />
      )}
      <h3 className={styles.formGroupTitle}>Previous breaks</h3>
      {breaks.history.length === 0 ? (
        <p className={styles.empty} role="status">
          No previous breaks.
        </p>
      ) : (
        <ul className={styles.changeList} data-break-history="live">
          {breaks.history.map((item) => (
            <li key={item.id}>
              <article className={styles.changeCard}>
                <h3>{item.reason}</h3>
                <p>Started {formatOptionalDate(item.startDate)}</p>
                <p>Planned return {formatOptionalDate(item.plannedReturn)}</p>
                <p>Returned {formatOptionalDate(item.actualReturn)}</p>
                <p className={styles.preWrap}>{item.explanation}</p>
                <p className={styles.formGroupMeta}>Started by {item.startedByName}</p>
              </article>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function StartBreak({
  gtaId,
  reasons,
  today,
}: {
  gtaId: string;
  reasons: ApprenticeBreaks["reasons"];
  today: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [reasonId, setReasonId] = useState("");
  const [explanation, setExplanation] = useState("");
  const [startDate, setStartDate] = useState(today);
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const preview = plannedReturnOn(startDate, null);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);
    setPending(true);
    try {
      const result = await startBreakInLearningAction({
        gtaId,
        reasonId,
        explanation,
        startDate,
      });
      if (!result.ok) {
        setFormError(result.formError);
        return;
      }
      setOpen(false);
      setReasonId("");
      setExplanation("");
      setStartDate(today);
      router.refresh();
    } catch (error) {
      setFormError(messageFrom(error));
    } finally {
      setPending(false);
    }
  }

  return (
    <div>
      <p className={styles.formGroupMeta}>{PLANNED_RETURN_HELP}</p>
      <div className={styles.learnerActions}>
        <button
          type="button"
          className={styles.primaryBtn}
          aria-expanded={open}
          onClick={() => setOpen((current) => !current)}
        >
          {open ? "Close" : "Start break in learning"}
        </button>
      </div>
      {open ? (
        <form onSubmit={onSubmit} noValidate data-start-break="live">
          <div className={styles.learnerField}>
            <span>
              Reason<em className={styles.fieldRequired}> required</em>
            </span>
            <Select
              aria-label="Break reason"
              value={reasonId}
              disabled={pending || reasons.length === 0}
              placeholder={reasons.length === 0 ? "No reasons are available" : "Choose a reason"}
              options={reasons.map((reason) => ({ value: reason.id, label: reason.label }))}
              onChange={setReasonId}
            />
          </div>
          <label className={styles.learnerField}>
            <span>
              Explanation<em className={styles.fieldRequired}> required</em>
            </span>
            <textarea
              value={explanation}
              disabled={pending}
              aria-label="Break explanation"
              onChange={(event) => setExplanation(event.target.value)}
            />
          </label>
          <label className={styles.learnerField}>
            <span>
              Start date<em className={styles.fieldRequired}> required</em>
            </span>
            <input
              type="date"
              value={startDate}
              disabled={pending}
              aria-label="Break start date"
              onChange={(event) => setStartDate(event.target.value)}
            />
          </label>
          <p className={styles.formGroupMeta}>
            {preview ? `Planned return: ${formatOptionalDate(preview)}.` : PLANNED_RETURN_HELP}
          </p>
          {formError ? (
            <p className={styles.error} role="alert">
              {formError}
            </p>
          ) : null}
          <div className={styles.learnerActions}>
            <button type="submit" className={styles.primaryBtn} disabled={pending}>
              {pending ? "Starting…" : "Start break"}
            </button>
          </div>
        </form>
      ) : null}
    </div>
  );
}

function OpenBreakPanel({ open }: { open: OpenBreak }) {
  const router = useRouter();
  const [checks, setChecks] = useResetWhen(open.checks, JSON.stringify(open.checks));
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, setPending] = useState<string | null>(null);
  const liveReady = returnFromBreakReady({
    signedOff: open.signedOff,
    checks,
    checksUnavailable: open.checksUnavailable,
  });

  async function onCheck(itemId: string, passed: boolean) {
    const previous = checks;
    setChecks((current) => current.map((item) => (item.id === itemId ? { ...item, passed } : item)));
    setPending(itemId);
    setFormError(null);
    try {
      const result = await recordReturnCheckResultAction({
        breakId: open.id,
        itemId,
        passed,
      });
      if (!result.ok) {
        setChecks(previous);
        setFormError(result.formError);
        return;
      }
      router.refresh();
    } catch (error) {
      setChecks(previous);
      setFormError(messageFrom(error));
    } finally {
      setPending(null);
    }
  }

  async function onSignOff() {
    setPending("sign-off");
    setFormError(null);
    try {
      const result = await signOffReturnToLearningAction({ breakId: open.id });
      if (!result.ok) {
        setFormError(result.formError);
        return;
      }
      router.refresh();
    } catch (error) {
      setFormError(messageFrom(error));
    } finally {
      setPending(null);
    }
  }

  async function onReturn() {
    setPending("return");
    setFormError(null);
    try {
      const result = await returnFromBreakAction({ breakId: open.id });
      if (!result.ok) {
        setFormError(result.formError);
        return;
      }
      router.refresh();
    } catch (error) {
      setFormError(messageFrom(error));
    } finally {
      setPending(null);
    }
  }

  return (
    <div data-open-break="live">
      <dl className={styles.learnerFacts}>
        <dt>Start date</dt>
        <dd>{formatOptionalDate(open.startDate)}</dd>
        <dt>Planned return</dt>
        <dd>{formatOptionalDate(open.plannedReturn)}</dd>
        <dt>Reason</dt>
        <dd>{open.reason}</dd>
        <dt>Explanation</dt>
        <dd className={styles.preWrap}>{open.explanation}</dd>
      </dl>
      <p className={styles.formGroupMeta}>Started by {open.startedByName}</p>
      <h3 className={styles.formGroupTitle}>Return to learning</h3>
      <div data-return-checklist="live">
        {open.checksUnavailable ? (
          <p className={styles.empty} role="status">
            The return checklist could not be loaded.
          </p>
        ) : checks.length === 0 ? (
          <p className={styles.empty} role="status" data-checklist-empty="live">
            {CHECKLIST_EMPTY_NOTE}
          </p>
        ) : (
          <ul className={styles.changeList}>
            {checks.map((item) => (
              <li key={item.id}>
                <label className={styles.checkRow}>
                  <input
                    type="checkbox"
                    checked={item.passed}
                    disabled={pending !== null}
                    data-checklist-item={item.id}
                    onChange={(event) => void onCheck(item.id, event.target.checked)}
                  />
                  <span>{item.label}</span>
                </label>
              </li>
            ))}
          </ul>
        )}
      </div>
      {open.signedOff ? (
        <p className={styles.success} role="status" data-return-signed-off="live">
          Signed off
          {open.signedOffByName ? ` by ${open.signedOffByName}` : ""}
          {open.signedOffAt ? ` on ${formatPortalTimestamp(open.signedOffAt)}` : ""}.
        </p>
      ) : (
        <div className={styles.learnerActions}>
          <button
            type="button"
            className={styles.secondaryBtn}
            data-sign-off-return="live"
            disabled={pending !== null}
            onClick={() => void onSignOff()}
          >
            {pending === "sign-off" ? "Signing off…" : "Sign off return"}
          </button>
        </div>
      )}
      <p className={styles.formGroupMeta}>{RETURN_ANY_TIME_HELP}</p>
      {liveReady.reason ? <p className={styles.formGroupMeta}>{liveReady.reason}</p> : null}
      {formError ? (
        <p className={styles.error} role="alert">
          {formError}
        </p>
      ) : null}
      <div className={styles.learnerActions}>
        <button
          type="button"
          className={styles.primaryBtn}
          data-return-from-break="live"
          disabled={pending !== null || !liveReady.ready}
          onClick={() => void onReturn()}
        >
          {pending === "return" ? "Returning…" : "Return from break"}
        </button>
      </div>
    </div>
  );
}
