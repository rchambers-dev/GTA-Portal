"use client";

import { useMemo, useState } from "react";
import {
  ApprenticePageShell,
  ApprenticeStatusChip,
} from "@/features/apprentice-portal/components/ApprenticePageShell";
import { calculateProgrammeWeek } from "@/features/apprentice-lifecycle/domain/programme-week";
import { useDemoSession } from "@/shell/demo/DemoSessionProvider";
import {
  createEnrolment,
  findIntakeCohort,
  updateEnrolment,
  type EnrolmentInput,
} from "../domain/store";
import { awaitingEnrolment, enrolmentBlockers } from "../domain/intake-pack";
import type {
  AdminCohortRecord,
  AdminEmployerRecord,
  AdminApprenticeEnrolment,
  AdminProgrammeRecord,
  EnrolmentKind,
  EnrolmentStatus,
} from "../domain/types";
import { useAdminStore } from "../hooks/useAdminStore";
import styles from "./admin-pages.module.css";

type TransferDraft = {
  cohortId: string;
  employerId: string;
  reason: string;
};

type FormState = {
  kind: EnrolmentKind;
  apprenticeId: string;
  programmeName: string;
  standardCode: string;
  cohortId: string | null;
  employerId: string;
  workplaceContact: string;
  mentorName: string;
  tutorName: string;
  startDate: string;
  originalPlannedEndDate: string;
  programmeYear: string;
  programmeWeek: string;
  attendancePercent: string;
  actualProgressPercent: string;
  collegeDays: string;
  notes: string;
  status: EnrolmentStatus;
};

type EnrolmentSearchMode =
  | "name"
  | "programme"
  | "employer"
  | "cohort"
  | "status";

const SEARCH_MODES: Array<{
  id: EnrolmentSearchMode;
  label: string;
  placeholder: string;
}> = [
  { id: "name", label: "Name", placeholder: "Search by apprentice name or email…" },
  {
    id: "programme",
    label: "Programme",
    placeholder: "Search by programme or standard code…",
  },
  { id: "employer", label: "Employer", placeholder: "Search by employer…" },
  { id: "cohort", label: "Cohort", placeholder: "Search by cohort name…" },
  {
    id: "status",
    label: "Status",
    placeholder: "Search by status, e.g. active or pending…",
  },
];

function emptyForm(
  kind: EnrolmentKind,
  programme?: { name: string; standardCode: string },
): FormState {
  return {
    kind,
    apprenticeId: "",
    programmeName: programme?.name ?? "",
    standardCode: programme?.standardCode ?? "",
    cohortId: null,
    employerId: "",
    workplaceContact: "",
    mentorName: "",
    tutorName: "",
    startDate: "",
    originalPlannedEndDate: "",
    programmeYear: "",
    programmeWeek: "",
    attendancePercent: "",
    actualProgressPercent: "",
    collegeDays: "",
    notes: "",
    status: kind === "new_starter" ? "pending_start" : "active",
  };
}

function yearFromWeek(week: number | null): 1 | 2 | 3 | null {
  if (week == null || week < 1) return null;
  if (week <= 52) return 1;
  if (week <= 104) return 2;
  return 3;
}

function derivePosition(startDate: string): {
  programmeWeek: number | null;
  programmeYear: 1 | 2 | 3 | null;
} {
  if (!startDate) return { programmeWeek: null, programmeYear: null };
  const week = calculateProgrammeWeek(new Date(`${startDate}T00:00:00`));
  return { programmeWeek: week, programmeYear: yearFromWeek(week) };
}

function deriveEnrolmentStatus(
  kind: EnrolmentKind,
  startDate: string,
  existing?: EnrolmentStatus,
): EnrolmentStatus {
  if (existing === "withdrawn" || existing === "completed") return existing;
  if (!startDate) {
    return kind === "new_starter" ? "pending_start" : "draft";
  }
  const start = new Date(`${startDate}T00:00:00`);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  if (start > today) return "pending_start";
  return "active";
}

function applyCohortFields(
  prev: FormState,
  cohort: AdminCohortRecord | null,
  programmes: AdminProgrammeRecord[],
): FormState {
  if (!cohort) {
    return {
      ...prev,
      cohortId: null,
    };
  }
  const programme = programmes.find((p) => p.id === cohort.programmeId);
  const position = derivePosition(cohort.startDate);
  const studying = prev.kind === "currently_studying";
  return {
    ...prev,
    cohortId: cohort.id,
    programmeName: programme?.name ?? prev.programmeName,
    standardCode: cohort.standardCode || prev.standardCode,
    startDate: cohort.startDate,
    originalPlannedEndDate: cohort.expectedEndDate,
    collegeDays: cohort.collegeDays,
    tutorName: cohort.tutorName,
    programmeWeek: studying && position.programmeWeek != null
      ? String(position.programmeWeek)
      : "",
    programmeYear: studying && position.programmeYear != null
      ? String(position.programmeYear)
      : "",
    status: deriveEnrolmentStatus(prev.kind, cohort.startDate, prev.status),
  };
}

function applyEmployerFields(
  prev: FormState,
  employer: AdminEmployerRecord | null,
): FormState {
  if (!employer) {
    return { ...prev, employerId: "", workplaceContact: "", mentorName: "" };
  }
  return {
    ...prev,
    employerId: employer.id,
    workplaceContact: employer.mainContact,
    mentorName: employer.mainContact,
  };
}

function ReadonlyDetail({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <label className={styles.detailField}>
      <span className={styles.detailFieldLabel}>{label}</span>
      <input className={styles.detailFieldInput} value={value || "—"} readOnly />
      {hint ? <span className={styles.fieldHint}>{hint}</span> : null}
    </label>
  );
}

function statusTone(status: EnrolmentStatus) {
  switch (status) {
    case "active":
      return "green" as const;
    case "pending_start":
    case "draft":
      return "amber" as const;
    case "withdrawn":
      return "red" as const;
    default:
      return "neutral" as const;
  }
}

function cardTone(status: EnrolmentStatus) {
  switch (status) {
    case "active":
      return "green";
    case "pending_start":
    case "draft":
      return "amber";
    default:
      return "neutral";
  }
}

function formatDate(value: string): string {
  if (!value) return "—";
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function positionLabel(row: AdminApprenticeEnrolment): string {
  if (row.kind === "currently_studying") {
    return `Y${row.programmeYear ?? "—"} · W${row.programmeWeek ?? "—"}`;
  }
  return `Starts ${formatDate(row.startDate)}`;
}

function kindLabel(kind: EnrolmentKind): string {
  return kind === "new_starter" ? "New starter" : "Currently studying";
}

function EnrolmentInlineField({
  label,
  value,
  onCommit,
  type = "text",
  placeholder,
  wide = false,
  multiline = false,
}: {
  label: string;
  value: string;
  onCommit: (next: string) => void;
  type?: "text" | "email" | "tel" | "date" | "number";
  placeholder?: string;
  wide?: boolean;
  multiline?: boolean;
}) {
  const [draft, setDraft] = useState(value);
  const [prevValue, setPrevValue] = useState(value);
  if (value !== prevValue) {
    setPrevValue(value);
    setDraft(value);
  }

  function commit() {
    if (draft.trim() !== value.trim()) onCommit(draft);
    else setDraft(value);
  }

  return (
    <label
      className={`${styles.detailField}${wide ? ` ${styles.detailFieldWide}` : ""}`}
    >
      <span className={styles.detailFieldLabel}>{label}</span>
      {multiline ? (
        <textarea
          className={styles.detailFieldInput}
          value={draft}
          placeholder={placeholder}
          rows={3}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
        />
      ) : (
        <input
          className={styles.detailFieldInput}
          type={type}
          value={draft}
          placeholder={placeholder}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
        />
      )}
    </label>
  );
}

export function AdminEnrolmentsScreen() {
  const store = useAdminStore();
  const { session } = useDemoSession();
  const [query, setQuery] = useState("");
  const [searchMode, setSearchMode] = useState<EnrolmentSearchMode>("name");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(() => emptyForm("new_starter"));
  const [transferringId, setTransferringId] = useState<string | null>(null);
  const [transferDraft, setTransferDraft] = useState<TransferDraft>({
    cohortId: "",
    employerId: "",
    reason: "",
  });
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const employers = store.employers.filter((e) => e.status === "active");
  const programmes = store.programmes.filter((p) => p.status === "active");
  const defaultProgramme = programmes[0];
  const apprentices = useMemo(
    () =>
      [...store.apprentices].sort((a, b) =>
        a.displayName.localeCompare(b.displayName),
      ),
    [store.apprentices],
  );

  const selectedApprentice = form.apprenticeId
    ? (store.apprentices.find((l) => l.id === form.apprenticeId) ?? null)
    : null;

  // Completed intakes not yet on a programme — the queue this page works from.
  const awaitingApprentices = useMemo(
    () =>
      awaitingEnrolment(
        store.apprentices,
        store.enrolments.map((e) => e.apprenticeId),
      ).sort((a, b) => a.displayName.localeCompare(b.displayName)),
    [store.enrolments, store.apprentices],
  );

  const apprenticeHint = (() => {
    if (!selectedApprentice) {
      return "Pick from apprentices already on the system — personal details come from Apprentice Intake, so there's nothing to re-key here.";
    }
    const existing = store.enrolments.filter(
      (e) => e.apprenticeId === selectedApprentice.id && e.id !== editingId,
    );
    const blockers = enrolmentBlockers(selectedApprentice);
    const parts = [selectedApprentice.apprenticeReference];
    if (blockers.length > 0) {
      parts.push(
        `not ready to start — ${blockers.length} item${blockers.length === 1 ? "" : "s"} still needed from intake`,
      );
    } else {
      parts.push("ready to start");
    }
    if (existing.length > 0) {
      parts.push(
        `already enrolled on ${existing.map((e) => e.programmeName).join(", ")}`,
      );
    }
    return parts.join(" · ");
  })();

  const cohortsForProgramme = useMemo(() => {
    const code = form.standardCode.trim().toUpperCase();
    if (!code) return [] as AdminCohortRecord[];
    return [...store.cohorts]
      .filter((c) => c.standardCode.toUpperCase() === code)
      .sort((a, b) => b.startDate.localeCompare(a.startDate));
  }, [form.standardCode, store.cohorts]);

  const selectedCohort = form.cohortId
    ? (store.cohorts.find((c) => c.id === form.cohortId) ?? null)
    : null;

  const cohortHint = (() => {
    if (selectedCohort) {
      if (selectedCohort.status === "active") {
        return `Manually placed in an active cohort (v${selectedCohort.standardVersion}). Double-check this is the right group.`;
      }
      if (selectedCohort.status === "completed") {
        return `This cohort has completed — verify before assigning.`;
      }
      return `Auto-flowed into the planned intake (v${selectedCohort.standardVersion}). Apprentice finishes on this version.`;
    }
    if (form.kind === "new_starter") {
      return cohortsForProgramme.some((c) => c.status === "planned")
        ? "Select a planned cohort, or leave unset to assign later."
        : "No planned intake open for this programme yet — assign a cohort later.";
    }
    return "Place studying apprentices in their current cohort manually for accuracy.";
  })();

  const filtered = useMemo(() => {
    const rows = [...store.enrolments].sort((a, b) =>
      a.displayName.localeCompare(b.displayName),
    );
    const q = query.trim().toLowerCase();
    if (!q) return rows;

    return rows.filter((row) => {
      const cohort = row.cohortId
        ? store.cohorts.find((c) => c.id === row.cohortId)
        : null;
      switch (searchMode) {
        case "name":
          return q
            .split(/\s+/)
            .every(
              (token) =>
                row.displayName.toLowerCase().includes(token) ||
                row.email.toLowerCase().includes(token),
            );
        case "programme":
          return (
            row.programmeName.toLowerCase().includes(q) ||
            row.standardCode.toLowerCase().includes(q.replace(/\s+/g, ""))
          );
        case "employer":
          return row.employerName.toLowerCase().includes(q);
        case "cohort":
          return (cohort?.name ?? "").toLowerCase().includes(q);
        case "status":
          return (
            row.status.replace(/_/g, " ").includes(q) ||
            row.status.includes(q.replace(/\s+/g, "_"))
          );
      }
    });
  }, [query, searchMode, store.cohorts, store.enrolments]);

  const totalEnrolments = store.enrolments.length;
  const activeSearch = SEARCH_MODES.find((m) => m.id === searchMode)!;

  function autoCohortId(
    kind: EnrolmentKind,
    standardCode?: string,
  ): string | null {
    if (kind !== "new_starter" || !standardCode) return null;
    return findIntakeCohort(standardCode)?.id ?? null;
  }

  function setKind(kind: EnrolmentKind) {
    setForm((prev) => ({
      ...emptyForm(kind, defaultProgramme),
      apprenticeId: prev.apprenticeId,
      cohortId: autoCohortId(kind, defaultProgramme?.standardCode),
      employerId: prev.employerId || employers[0]?.id || "",
      workplaceContact:
        prev.workplaceContact ||
        employers.find((e) => e.id === prev.employerId)?.mainContact ||
        employers[0]?.mainContact ||
        "",
    }));
  }

  function openCreate(kind: EnrolmentKind, apprenticeId = "") {
    setEditingId(null);
    setTransferringId(null);
    setError(null);
    setSuccess(null);
    const employer = employers[0] ?? null;
    const autoCohort = autoCohortId(kind, defaultProgramme?.standardCode)
      ? findIntakeCohort(defaultProgramme?.standardCode ?? "")
      : null;
    let next = {
      ...emptyForm(kind, defaultProgramme),
      apprenticeId,
    };
    next = applyEmployerFields(next, employer);
    if (autoCohort) next = applyCohortFields(next, autoCohort, programmes);
    setForm(next);
    setShowForm(true);
  }

  function openEdit(row: AdminApprenticeEnrolment) {
    setEditingId(row.id);
    setTransferringId(null);
    setError(null);
    setSuccess(null);
    setForm({
      kind: row.kind,
      apprenticeId: row.apprenticeId ?? "",
      programmeName: row.programmeName,
      standardCode: row.standardCode,
      cohortId: row.cohortId,
      employerId: row.employerId,
      workplaceContact: row.workplaceContact,
      mentorName: row.mentorName,
      tutorName: row.tutorName,
      startDate: row.startDate,
      originalPlannedEndDate: row.originalPlannedEndDate,
      programmeYear: row.programmeYear?.toString() ?? "",
      programmeWeek: row.programmeWeek?.toString() ?? "",
      attendancePercent: row.attendancePercent?.toString() ?? "",
      actualProgressPercent: row.actualProgressPercent?.toString() ?? "",
      collegeDays: row.collegeDays,
      notes: row.notes,
      status: row.status,
    });
    setShowForm(true);
    setExpandedId(row.id);
  }

  function onProgrammeChange(name: string) {
    const match = programmes.find((p) => p.name === name);
    const standardCode = match?.standardCode ?? "";
    const autoCohort =
      form.kind === "new_starter" && !editingId
        ? findIntakeCohort(standardCode)
        : null;
    setForm((prev) => {
      const next = {
        ...prev,
        programmeName: name,
        standardCode: standardCode || prev.standardCode,
      };
      if (autoCohort) return applyCohortFields(next, autoCohort, programmes);
      return { ...next, cohortId: prev.cohortId };
    });
  }

  function onCohortChange(cohortId: string) {
    const cohort = store.cohorts.find((c) => c.id === cohortId) ?? null;
    setForm((prev) => applyCohortFields(prev, cohort, programmes));
  }

  function onEmployerChange(employerId: string) {
    const employer = employers.find((e) => e.id === employerId) ?? null;
    setForm((prev) => applyEmployerFields(prev, employer));
  }

  function buildInput(): EnrolmentInput | null {
    const apprentice = store.apprentices.find((l) => l.id === form.apprenticeId);
    if (!apprentice) {
      setError(
        "Select an apprentice. If they aren't on the system yet, add them in Apprentice Intake first.",
      );
      return null;
    }
    if (!editingId) {
      const blockers = enrolmentBlockers(apprentice);
      if (blockers.length > 0) {
        setError(
          `${apprentice.displayName} can't be moved onto a programme yet — still needed: ${blockers.join(", ")}.`,
        );
        return null;
      }
    }
    if (!form.employerId) {
      setError("Select an employer.");
      return null;
    }
    if (!form.startDate) {
      setError("Pick a cohort so the start date can fill from the intake.");
      return null;
    }
    if (!form.originalPlannedEndDate) {
      setError("Pick a cohort with a planned finish date.");
      return null;
    }
    const employer = employers.find((e) => e.id === form.employerId);
    if (!employer) {
      setError("Select a valid employer.");
      return null;
    }

    const position = derivePosition(form.startDate);
    const studying = form.kind === "currently_studying";
    const existing = editingId
      ? store.enrolments.find((e) => e.id === editingId)
      : null;

    return {
      kind: form.kind,
      status: deriveEnrolmentStatus(
        form.kind,
        form.startDate,
        existing?.status,
      ),
      apprenticeId: apprentice.id,
      displayName: apprentice.displayName,
      email: apprentice.email,
      phone: apprentice.phone,
      dateOfBirth: apprentice.dateOfBirth,
      uln: apprentice.uln,
      programmeName: form.programmeName,
      standardCode: form.standardCode,
      cohortId: form.cohortId,
      employerId: employer.id,
      employerName: employer.name,
      workplaceContact: employer.mainContact,
      mentorName: employer.mainContact,
      tutorName: form.tutorName,
      startDate: form.startDate,
      originalPlannedEndDate: form.originalPlannedEndDate,
      programmeYear: studying ? position.programmeYear : null,
      programmeWeek: studying ? position.programmeWeek : null,
      // Attendance / progress come from register & tracking — preserve existing only.
      attendancePercent: studying ? (existing?.attendancePercent ?? null) : null,
      actualProgressPercent: studying
        ? (existing?.actualProgressPercent ?? null)
        : null,
      collegeDays: form.collegeDays,
      notes: form.notes,
    };
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setSuccess(null);
    const input = buildInput();
    if (!input) return;

    if (editingId) {
      await updateEnrolment(editingId, input);
      setSuccess(`Updated ${input.displayName}.`);
      setExpandedId(editingId);
    } else {
      const created = await createEnrolment(input);
      setSuccess(
        input.kind === "new_starter"
          ? `Added new starter ${input.displayName}.`
          : `Registered currently studying apprentice ${input.displayName}.`,
      );
      setExpandedId(created.id);
    }
    setShowForm(false);
    setEditingId(null);
  }

  async function patchEnrolment(
    idValue: string,
    patch: Partial<EnrolmentInput> & { status?: EnrolmentStatus },
  ) {
    const next = await updateEnrolment(idValue, patch);
    if (next) setSuccess(`Updated ${next.displayName}.`);
  }

  function openTransfer(row: AdminApprenticeEnrolment) {
    setShowForm(false);
    setEditingId(null);
    setError(null);
    setSuccess(null);
    setExpandedId(row.id);
    setTransferringId(row.id);
    setTransferDraft({
      cohortId: row.cohortId ?? "",
      employerId: row.employerId,
      reason: "",
    });
  }

  function closeTransfer() {
    setTransferringId(null);
    setTransferDraft({ cohortId: "", employerId: "", reason: "" });
    setError(null);
  }

  /**
   * Pre-framed transfer: college day/group (cohort) and/or employer.
   * Formal rules (approvals, version pinning, progress reset) still TBC with Jon.
   */
  async function applyTransfer(row: AdminApprenticeEnrolment) {
    const nextCohort = transferDraft.cohortId
      ? store.cohorts.find((c) => c.id === transferDraft.cohortId) ?? null
      : null;
    const nextEmployer = transferDraft.employerId
      ? store.employers.find((e) => e.id === transferDraft.employerId) ?? null
      : null;

    if (!nextEmployer) {
      setError("Pick an employer for the transfer.");
      return;
    }

    const cohortChanged =
      (row.cohortId ?? "") !== (transferDraft.cohortId || "");
    const employerChanged = row.employerId !== transferDraft.employerId;

    if (!cohortChanged && !employerChanged) {
      setError("Nothing has changed — pick a new group or employer.");
      return;
    }

    const stamp = new Date().toLocaleDateString("en-GB", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
    const parts: string[] = [];
    if (cohortChanged) {
      parts.push(
        `group ${row.collegeDays || "unset"} → ${nextCohort?.collegeDays || "unset"} (${nextCohort?.name ?? "no cohort"})`,
      );
    }
    if (employerChanged) {
      parts.push(`employer ${row.employerName} → ${nextEmployer.name}`);
    }
    const reasonNote = transferDraft.reason.trim()
      ? ` Reason: ${transferDraft.reason.trim()}.`
      : "";
    const transferNote = `Transfer ${stamp} by ${session.account.name}: ${parts.join("; ")}.${reasonNote}`;

    const patch: Partial<EnrolmentInput> = {
      notes: row.notes
        ? `${row.notes}\n${transferNote}`
        : transferNote,
    };

    if (cohortChanged) {
      // College day / group move — tutor and days follow the cohort.
      // Start date and year/week are left alone until Jon confirms the rule.
      patch.cohortId = nextCohort?.id ?? null;
      if (nextCohort) {
        patch.collegeDays = nextCohort.collegeDays;
        patch.tutorName = nextCohort.tutorName;
        if (nextCohort.standardCode) {
          patch.standardCode = nextCohort.standardCode;
        }
        const programme = store.programmes.find(
          (p) => p.id === nextCohort.programmeId,
        );
        if (programme) patch.programmeName = programme.name;
      }
    }

    if (employerChanged) {
      patch.employerId = nextEmployer.id;
      patch.employerName = nextEmployer.name;
      patch.workplaceContact = nextEmployer.mainContact;
      patch.mentorName = nextEmployer.mainContact;
    }

    const updated = await updateEnrolment(row.id, patch);
    if (!updated) {
      setError("Could not apply the transfer.");
      return;
    }
    setSuccess(`Transfer recorded for ${updated.displayName}.`);
    closeTransfer();
  }

  return (
    <ApprenticePageShell
      eyebrow="Administration"
      title="Apprentice Enrolments"
      description="Enrol apprentices who are already on the system onto a programme — employer, cohort and progress position. Transfer covers college-day / group moves and employer changes. Personal details are captured once in Apprentice Intake."
      actions={
        <div className={styles.toolbarActions}>
          <button
            type="button"
            className={styles.secondaryBtn}
            onClick={() => openCreate("currently_studying")}
          >
            Currently studying
          </button>
          <button
            type="button"
            className={styles.primaryBtn}
            onClick={() => openCreate("new_starter")}
          >
            New starter
          </button>
        </div>
      }
    >
      <div className={styles.stack}>
        {success ? <p className={styles.success}>{success}</p> : null}

        {awaitingApprentices.length > 0 && !showForm ? (
          <div className={styles.awaitingPanel}>
            <div className={styles.awaitingMain}>
              <strong className={styles.awaitingCount}>
                {awaitingApprentices.length} apprentice
                {awaitingApprentices.length === 1 ? "" : "s"} waiting for enrolment
              </strong>
              <span className={styles.awaitingNames}>
                {awaitingApprentices
                  .slice(0, 4)
                  .map((l) => l.displayName)
                  .join(", ")}
                {awaitingApprentices.length > 4
                  ? ` and ${awaitingApprentices.length - 4} more`
                  : ""}
              </span>
            </div>
            <button
              type="button"
              className={styles.primaryBtn}
              onClick={() => openCreate("new_starter", awaitingApprentices[0].id)}
            >
              Enrol {awaitingApprentices[0].displayName.split(" ")[0]}
            </button>
          </div>
        ) : null}

        {showForm ? (
          <form className={styles.formStack} onSubmit={submit}>
            <section className={styles.formGroup}>
              <div className={styles.formGroupHead}>
                <h2 className={styles.formGroupTitle}>
                  {editingId ? "Edit enrolment" : "Add enrolment"}
                </h2>
                <span className={styles.formGroupBadge}>
                  {editingId
                    ? "Existing record"
                    : form.kind === "new_starter"
                      ? "New starter"
                      : "Currently studying"}
                </span>
              </div>
              <p className={styles.formGroupMeta}>
                Place the apprentice on a programme, cohort and employer. Start
                date, tutor, college days, mentor and progress position fill
                from those records — attendance and progress come from register
                and tracking when those exist.
              </p>

              {!editingId ? (
                <div className={styles.kindTabs}>
                  <button
                    type="button"
                    className={
                      form.kind === "new_starter"
                        ? styles.kindTabActive
                        : styles.kindTab
                    }
                    onClick={() => setKind("new_starter")}
                  >
                    New starter
                  </button>
                  <button
                    type="button"
                    className={
                      form.kind === "currently_studying"
                        ? styles.kindTabActive
                        : styles.kindTab
                    }
                    onClick={() => setKind("currently_studying")}
                  >
                    Currently studying
                  </button>
                </div>
              ) : null}

              <div className={styles.formGrid}>
                <label className={`${styles.field} ${styles.fieldWide}`}>
                  <span>
                    Apprentice <em className={styles.fieldRequired}>required</em>
                  </span>
                  <select
                    value={form.apprenticeId}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        apprenticeId: e.target.value,
                      }))
                    }
                    required
                  >
                    <option value="">Select apprentice…</option>
                    {apprentices.map((apprentice) => (
                      <option key={apprentice.id} value={apprentice.id}>
                        {apprentice.displayName} · {apprentice.apprenticeReference}
                      </option>
                    ))}
                  </select>
                  <span className={styles.fieldHint}>{apprenticeHint}</span>
                </label>
                {selectedApprentice ? (
                  <>
                    <label className={styles.field}>
                      <span>Email</span>
                      <input value={selectedApprentice.email} readOnly />
                    </label>
                    <label className={styles.field}>
                      <span>Date of birth</span>
                      <input value={selectedApprentice.dateOfBirth} readOnly />
                    </label>
                    <label className={styles.field}>
                      <span>ULN</span>
                      <input
                        value={selectedApprentice.uln || "Not recorded yet"}
                        readOnly
                      />
                    </label>
                  </>
                ) : null}
                <label className={styles.field}>
                  <span>Programme</span>
                  <select
                    value={form.programmeName}
                    onChange={(e) => onProgrammeChange(e.target.value)}
                  >
                    {programmes.map((p) => (
                      <option key={p.id} value={p.name}>
                        {p.name} · {p.standardCode}
                      </option>
                    ))}
                  </select>
                </label>
                <label className={styles.field}>
                  <span>Standard code</span>
                  <input value={form.standardCode} readOnly />
                </label>
                <label className={styles.field}>
                  <span>Cohort</span>
                  <select
                    value={form.cohortId ?? ""}
                    onChange={(e) => onCohortChange(e.target.value)}
                  >
                    <option value="">No cohort yet</option>
                    {cohortsForProgramme.map((cohort) => (
                      <option key={cohort.id} value={cohort.id}>
                        {cohort.name} · v{cohort.standardVersion} (
                        {cohort.status})
                      </option>
                    ))}
                  </select>
                  <span className={styles.fieldHint}>{cohortHint}</span>
                </label>
                <label className={styles.field}>
                  <span>
                    Employer <em className={styles.fieldRequired}>required</em>
                  </span>
                  <select
                    value={form.employerId}
                    onChange={(e) => onEmployerChange(e.target.value)}
                    required
                  >
                    <option value="">Select employer…</option>
                    {employers.map((employer) => (
                      <option key={employer.id} value={employer.id}>
                        {employer.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className={styles.field}>
                  <span>Status</span>
                  <input
                    value={form.status.replace(/_/g, " ")}
                    readOnly
                  />
                  <span className={styles.fieldHint}>
                    From start date — pending until they start, then active.
                  </span>
                </label>
                <label className={styles.field}>
                  <span>Start date</span>
                  <input type="date" value={form.startDate} readOnly />
                  <span className={styles.fieldHint}>From the cohort intake.</span>
                </label>
                <label className={styles.field}>
                  <span>Tutor</span>
                  <input value={form.tutorName || "—"} readOnly />
                  <span className={styles.fieldHint}>From the cohort.</span>
                </label>
                <label className={styles.field}>
                  <span>College days</span>
                  <input value={form.collegeDays || "—"} readOnly />
                  <span className={styles.fieldHint}>From the cohort.</span>
                </label>
                <label className={styles.field}>
                  <span>Workplace contact</span>
                  <input value={form.workplaceContact || "—"} readOnly />
                  <span className={styles.fieldHint}>From the employer record.</span>
                </label>
                <label className={styles.field}>
                  <span>Progress mentor</span>
                  <input value={form.mentorName || "—"} readOnly />
                  <span className={styles.fieldHint}>
                    From the employer record (workplace mentor).
                  </span>
                </label>
                {form.kind === "currently_studying" ? (
                  <>
                    <label className={styles.field}>
                      <span>Programme year / week</span>
                      <input
                        value={
                          form.programmeYear && form.programmeWeek
                            ? `Y${form.programmeYear} · W${form.programmeWeek}`
                            : "Calculated from start date"
                        }
                        readOnly
                      />
                      <span className={styles.fieldHint}>
                        Calculated from cohort start date.
                      </span>
                    </label>
                    <label className={styles.field}>
                      <span>Attendance %</span>
                      <input value="From register" readOnly />
                      <span className={styles.fieldHint}>
                        Pulled from the teaching register when that exists.
                      </span>
                    </label>
                    <label className={styles.field}>
                      <span>Progress %</span>
                      <input value="From programme tracking" readOnly />
                      <span className={styles.fieldHint}>
                        Pulled from programme progress — not edited here.
                      </span>
                    </label>
                  </>
                ) : null}
                <label className={`${styles.field} ${styles.fieldWide}`}>
                  <span>Notes</span>
                  <textarea
                    value={form.notes}
                    rows={2}
                    onChange={(e) =>
                      setForm((prev) => ({ ...prev, notes: e.target.value }))
                    }
                  />
                </label>

                <label className={`${styles.field} ${styles.fieldWide}`}>
                  <span>Notes</span>
                  <textarea
                    value={form.notes}
                    onChange={(e) =>
                      setForm((prev) => ({ ...prev, notes: e.target.value }))
                    }
                    rows={3}
                    placeholder="Induction notes, missing paperwork, transfer details…"
                  />
                </label>
              </div>

              {error ? <p className={styles.error}>{error}</p> : null}

              <div className={styles.formActions}>
                <button type="submit" className={styles.primaryBtn}>
                  {editingId ? "Save enrolment" : "Create enrolment"}
                </button>
                <button
                  type="button"
                  className={styles.secondaryBtn}
                  onClick={() => {
                    setShowForm(false);
                    setEditingId(null);
                    setError(null);
                  }}
                >
                  Cancel
                </button>
              </div>
            </section>
          </form>
        ) : null}

        <div className={styles.searchBlock}>
          <div className={styles.searchModeRow}>
            <p className={styles.searchModeLabel}>Search by</p>
            <div
              className={styles.searchModeTabs}
              role="group"
              aria-label="Search enrolments by"
            >
              {SEARCH_MODES.map((mode) => (
                <button
                  key={mode.id}
                  type="button"
                  className={
                    searchMode === mode.id
                      ? styles.searchModeActive
                      : styles.searchModeBtn
                  }
                  aria-pressed={searchMode === mode.id}
                  onClick={() => setSearchMode(mode.id)}
                >
                  {mode.label}
                </button>
              ))}
            </div>
            <p className={styles.searchResultCount}>
              {query.trim()
                ? `Showing ${filtered.length} of ${totalEnrolments}`
                : `${totalEnrolments} enrolment${totalEnrolments === 1 ? "" : "s"}`}
            </p>
          </div>
          <label className={styles.searchField}>
            <span>Search enrolments</span>
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={activeSearch.placeholder}
            />
          </label>
        </div>

        {filtered.length === 0 ? (
          <p className={styles.empty}>No enrolments match this search.</p>
        ) : (
          <div className={styles.employerList}>
            {filtered.map((row) => {
              const open = expandedId === row.id;
              const cohort = row.cohortId
                ? store.cohorts.find((c) => c.id === row.cohortId)
                : null;
              return (
                <article
                  key={row.id}
                  className={styles.employerCard}
                  data-tone={cardTone(row.status)}
                  data-open={open ? "true" : "false"}
                  role="button"
                  tabIndex={0}
                  aria-expanded={open}
                  aria-label={`${open ? "Collapse" : "Expand"} details for ${row.displayName}`}
                  onClick={() =>
                    setExpandedId((current) =>
                      current === row.id ? null : row.id,
                    )
                  }
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      setExpandedId((current) =>
                        current === row.id ? null : row.id,
                      );
                    }
                  }}
                >
                  <div className={styles.employerCardHeader}>
                    <div className={styles.employerCardMain}>
                      <strong className={styles.employerName}>
                        {row.displayName}
                      </strong>
                      <span>
                        {row.programmeName} · {row.standardCode}
                        {cohort ? ` · ${cohort.name}` : ""}
                      </span>
                      <span>
                        {row.employerName}
                        {row.tutorName ? ` · Tutor ${row.tutorName}` : ""}
                        {row.collegeDays ? ` · ${row.collegeDays}` : ""}
                      </span>
                    </div>

                    <div
                      className={styles.employerPillColumn}
                      onClick={(event) => event.stopPropagation()}
                      onKeyDown={(event) => event.stopPropagation()}
                    >
                      <span
                        className={styles.enrolmentStatusPill}
                        data-status={row.status}
                      >
                        {row.status.replace("_", " ")}
                      </span>
                      <span
                        className={styles.employerApprenticePill}
                        data-has={
                          row.kind === "currently_studying" ? "true" : "false"
                        }
                      >
                        {positionLabel(row)}
                      </span>
                    </div>
                  </div>

                  {open ? (
                    <div
                      className={styles.employerCardBody}
                      onClick={(event) => event.stopPropagation()}
                      onKeyDown={(event) => event.stopPropagation()}
                    >
                      {(() => {
                        const apprentice = row.apprenticeId
                          ? store.apprentices.find((l) => l.id === row.apprenticeId)
                          : null;
                        return (
                          <p className={styles.linkedApprenticeNote}>
                            {apprentice
                              ? `Linked to apprentice record ${apprentice.apprenticeReference} · ${apprentice.email || "no email"} · DOB ${apprentice.dateOfBirth || "not recorded"} · ULN ${apprentice.uln || "not recorded"}. Amend personal details and pack documents on the Apprentices page.`
                              : "Not linked to an apprentice record yet — re-save this enrolment and pick the apprentice."}
                          </p>
                        );
                      })()}
                      <div className={styles.employerDetailGrid}>
                        <ReadonlyDetail
                          label="Status"
                          value={row.status.replace(/_/g, " ")}
                          hint="From start date (pending until they start, then active)."
                        />
                        <ReadonlyDetail
                          label="Programme"
                          value={`${row.programmeName} · ${row.standardCode}`}
                          hint="From the selected programme / cohort."
                        />
                        <label className={styles.detailField}>
                          <span className={styles.detailFieldLabel}>
                            Cohort
                          </span>
                          <select
                            className={styles.detailFieldInput}
                            value={row.cohortId ?? ""}
                            onChange={(e) => {
                              const cohort =
                                store.cohorts.find(
                                  (c) => c.id === e.target.value,
                                ) ?? null;
                              if (!cohort) {
                                patchEnrolment(row.id, { cohortId: null });
                                return;
                              }
                              const programme = programmes.find(
                                (p) => p.id === cohort.programmeId,
                              );
                              const position = derivePosition(cohort.startDate);
                              patchEnrolment(row.id, {
                                cohortId: cohort.id,
                                programmeName:
                                  programme?.name ?? row.programmeName,
                                standardCode: cohort.standardCode,
                                startDate: cohort.startDate,
                                collegeDays: cohort.collegeDays,
                                tutorName: cohort.tutorName,
                                programmeWeek:
                                  row.kind === "currently_studying"
                                    ? position.programmeWeek
                                    : null,
                                programmeYear:
                                  row.kind === "currently_studying"
                                    ? position.programmeYear
                                    : null,
                                status: deriveEnrolmentStatus(
                                  row.kind,
                                  cohort.startDate,
                                  row.status,
                                ),
                              });
                            }}
                          >
                            <option value="">No cohort yet</option>
                            {store.cohorts
                              .filter(
                                (c) =>
                                  c.standardCode.toUpperCase() ===
                                  row.standardCode.toUpperCase(),
                              )
                              .map((cohort) => (
                                <option key={cohort.id} value={cohort.id}>
                                  {cohort.name} · v{cohort.standardVersion}
                                </option>
                              ))}
                          </select>
                        </label>
                        <label className={styles.detailField}>
                          <span className={styles.detailFieldLabel}>
                            Employer
                          </span>
                          <select
                            className={styles.detailFieldInput}
                            value={row.employerId}
                            onChange={(e) => {
                              const employer = employers.find(
                                (emp) => emp.id === e.target.value,
                              );
                              if (!employer) return;
                              patchEnrolment(row.id, {
                                employerId: employer.id,
                                employerName: employer.name,
                                workplaceContact: employer.mainContact,
                                mentorName: employer.mainContact,
                              });
                            }}
                          >
                            {employers.map((employer) => (
                              <option key={employer.id} value={employer.id}>
                                {employer.name}
                              </option>
                            ))}
                          </select>
                        </label>
                        <ReadonlyDetail
                          label="Workplace contact"
                          value={row.workplaceContact}
                          hint="From the employer record."
                        />
                        <ReadonlyDetail
                          label="Progress mentor"
                          value={row.mentorName}
                          hint="From the employer record."
                        />
                        <ReadonlyDetail
                          label="Tutor"
                          value={row.tutorName}
                          hint="From the cohort."
                        />
                        <ReadonlyDetail
                          label={
                            row.kind === "new_starter"
                              ? "Planned start"
                              : "Programme start"
                          }
                          value={row.startDate}
                          hint="From the cohort intake date."
                        />
                        <ReadonlyDetail
                          label="College days"
                          value={row.collegeDays}
                          hint="From the cohort."
                        />
                        {row.kind === "currently_studying" ? (
                          <>
                            <ReadonlyDetail
                              label="Programme year / week"
                              value={
                                row.programmeYear != null &&
                                row.programmeWeek != null
                                  ? `Y${row.programmeYear} · W${row.programmeWeek}`
                                  : "—"
                              }
                              hint="Calculated from start date."
                            />
                            <ReadonlyDetail
                              label="Attendance %"
                              value={
                                row.attendancePercent != null
                                  ? `${row.attendancePercent}%`
                                  : "Awaiting register"
                              }
                              hint="From the teaching register — not edited here."
                            />
                            <ReadonlyDetail
                              label="Progress %"
                              value={
                                row.actualProgressPercent != null
                                  ? `${row.actualProgressPercent}%`
                                  : "From programme tracking"
                              }
                              hint="From programme tracking — not edited here."
                            />
                          </>
                        ) : null}
                        <EnrolmentInlineField
                          label="Notes"
                          value={row.notes}
                          wide
                          multiline
                          onCommit={(next) =>
                            patchEnrolment(row.id, { notes: next })
                          }
                        />
                      </div>

                      <div className={styles.formActions}>
                        <ApprenticeStatusChip tone={statusTone(row.status)}>
                          {kindLabel(row.kind)}
                        </ApprenticeStatusChip>
                        <button
                          type="button"
                          className={styles.secondaryBtn}
                          onClick={() => openTransfer(row)}
                        >
                          Transfer
                        </button>
                        <button
                          type="button"
                          className={styles.secondaryBtn}
                          onClick={() => openEdit(row)}
                        >
                          Open full edit form
                        </button>
                      </div>

                      {transferringId === row.id ? (
                        <section className={styles.transferPanel}>
                          <div className={styles.formGroupHead}>
                            <h3 className={styles.formGroupTitle}>
                              Transfer · {row.displayName}
                            </h3>
                            <span className={styles.formGroupBadge}>
                              Pre-framed
                            </span>
                          </div>
                          <p className={styles.formGroupMeta}>
                            Two common moves: college day / teaching group
                            (cohort), or employer. Formal rules — approvals,
                            whether start date or programme version move with a
                            group change — still to agree with Jon. This frame
                            updates group days, tutor, and employer only.
                          </p>

                          <div className={styles.transferGrid}>
                            <div className={styles.transferBlock}>
                              <h4 className={styles.transferBlockTitle}>
                                College day / group
                              </h4>
                              <p className={styles.transferCurrent}>
                                Now:{" "}
                                {cohort
                                  ? `${cohort.name} · ${row.collegeDays || "days unset"}`
                                  : row.collegeDays || "No group assigned"}
                                {row.tutorName
                                  ? ` · Tutor ${row.tutorName}`
                                  : ""}
                              </p>
                              <label className={styles.field}>
                                <span>Move to cohort</span>
                                <select
                                  value={transferDraft.cohortId}
                                  onChange={(e) =>
                                    setTransferDraft((prev) => ({
                                      ...prev,
                                      cohortId: e.target.value,
                                    }))
                                  }
                                >
                                  <option value="">No cohort</option>
                                  {store.cohorts
                                    .filter(
                                      (c) =>
                                        !row.standardCode ||
                                        c.standardCode === row.standardCode ||
                                        c.id === row.cohortId,
                                    )
                                    .map((c) => (
                                      <option key={c.id} value={c.id}>
                                        {c.name}
                                        {c.collegeDays
                                          ? ` · ${c.collegeDays}`
                                          : ""}
                                        {c.tutorName
                                          ? ` · ${c.tutorName}`
                                          : ""}
                                      </option>
                                    ))}
                                </select>
                                <span className={styles.fieldHint}>
                                  Same standard only for now. Cross-programme
                                  moves TBC.
                                </span>
                              </label>
                            </div>

                            <div className={styles.transferBlock}>
                              <h4 className={styles.transferBlockTitle}>
                                Employer
                              </h4>
                              <p className={styles.transferCurrent}>
                                Now: {row.employerName || "—"}
                                {row.mentorName
                                  ? ` · Mentor ${row.mentorName}`
                                  : ""}
                              </p>
                              <label className={styles.field}>
                                <span>Move to employer</span>
                                <select
                                  value={transferDraft.employerId}
                                  onChange={(e) =>
                                    setTransferDraft((prev) => ({
                                      ...prev,
                                      employerId: e.target.value,
                                    }))
                                  }
                                >
                                  {employers.map((e) => (
                                    <option key={e.id} value={e.id}>
                                      {e.name}
                                      {e.mainContact
                                        ? ` · ${e.mainContact}`
                                        : ""}
                                    </option>
                                  ))}
                                </select>
                                <span className={styles.fieldHint}>
                                  Workplace mentor follows the employer record.
                                </span>
                              </label>
                            </div>
                          </div>

                          <label className={styles.field}>
                            <span>Reason / note</span>
                            <textarea
                              value={transferDraft.reason}
                              rows={2}
                              placeholder="Optional — e.g. changed college day, new employer…"
                              onChange={(e) =>
                                setTransferDraft((prev) => ({
                                  ...prev,
                                  reason: e.target.value,
                                }))
                              }
                            />
                          </label>

                          {error && transferringId === row.id ? (
                            <p className={styles.error}>{error}</p>
                          ) : null}

                          <div className={styles.formActions}>
                            <button
                              type="button"
                              className={styles.secondaryBtn}
                              onClick={closeTransfer}
                            >
                              Cancel
                            </button>
                            <button
                              type="button"
                              className={styles.primaryBtn}
                              onClick={() => applyTransfer(row)}
                            >
                              Apply transfer
                            </button>
                          </div>
                        </section>
                      ) : null}
                    </div>
                  ) : null}
                </article>
              );
            })}
          </div>
        )}
      </div>
    </ApprenticePageShell>
  );
}
