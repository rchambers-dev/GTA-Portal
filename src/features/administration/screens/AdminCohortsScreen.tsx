"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  LearnerPageShell,
  LearnerStatusChip,
} from "@/features/learner-portal/components/LearnerPageShell";
import {
  createCohort,
  setEnrolmentCohort,
  updateCohort,
  type CohortInput,
} from "../domain/store";
import type {
  AdminCohortRecord,
  AdminLearnerEnrolment,
  AdminProgrammeRecord,
} from "../domain/types";
import { useAdminStore } from "../hooks/useAdminStore";
import styles from "./admin-pages.module.css";

type FormState = CohortInput;

/** Above this many learners, the picker opens as a full container, not a dropdown. */
const LEARNER_MODAL_THRESHOLD = 5;

type CohortSearchMode = "name" | "programme" | "version" | "group";

const SEARCH_MODES: Array<{
  id: CohortSearchMode;
  label: string;
  placeholder: string;
}> = [
  { id: "name", label: "Name", placeholder: "Search by cohort name…" },
  {
    id: "programme",
    label: "Programme",
    placeholder: "Search by programme or standard code…",
  },
  { id: "version", label: "Version", placeholder: "Search by version, e.g. 1.3…" },
  {
    id: "group",
    label: "Group",
    placeholder: "Search by teaching group…",
  },
];

function emptyForm(programme?: AdminProgrammeRecord): FormState {
  return {
    name: "",
    programmeId: programme?.id ?? "",
    programmeName: programme?.name ?? "",
    standardCode: programme?.standardCode ?? "",
    standardVersion: "1.0",
    enrolmentOpensDate: "",
    startDate: "",
    expectedEndDate: "",
    teachingGroup: "",
    collegeDays: "Mon, Tue",
    tutorName: "",
    status: "planned",
    notes: "",
  };
}

/** "Autocare Level 2" → "Autocare L2" */
function programmeShortLabel(name: string): string {
  return name
    .replace(/\bLevel\s+(\d+)\b/gi, "L$1")
    .replace(/\s+/g, " ")
    .trim();
}

const INTAKE_MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sept",
  "Oct",
  "Nov",
  "Dec",
] as const;

function formatIntakeMonthYear(isoDate: string): string | null {
  const match = /^(\d{4})-(\d{2})/.exec(isoDate);
  if (!match) return null;
  const year = match[1];
  const monthIndex = Number(match[2]) - 1;
  if (monthIndex < 0 || monthIndex > 11) return null;
  return `${INTAKE_MONTHS[monthIndex]} ${year}`;
}

/** e.g. Autocare L2 · Sept 2026 · Mon–Tue Group A */
function buildCohortName(
  programmeName: string,
  startDate: string,
  teachingGroup = "",
): string {
  const programme = programmeShortLabel(programmeName);
  const when = formatIntakeMonthYear(startDate);
  if (!programme || !when) return "";
  const parts = [programme, when];
  const group = teachingGroup.trim();
  if (group) parts.push(group);
  return parts.join(" · ");
}

function withAutoCohortName(
  prev: FormState,
  patch: Partial<FormState>,
  nameLocked: boolean,
): FormState {
  const next = { ...prev, ...patch };
  if (nameLocked) return next;
  const autoName = buildCohortName(
    next.programmeName,
    next.startDate,
    next.teachingGroup,
  );
  if (autoName) next.name = autoName;
  return next;
}

function learnersForCohort(
  enrolments: AdminLearnerEnrolment[],
  cohortId: string,
): AdminLearnerEnrolment[] {
  return enrolments
    .filter((e) => e.cohortId === cohortId)
    .sort((a, b) => a.displayName.localeCompare(b.displayName));
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

function cohortMatchesQuery(
  row: AdminCohortRecord,
  query: string,
  mode: CohortSearchMode,
): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;

  switch (mode) {
    case "name":
      return q
        .split(/\s+/)
        .every((token) => row.name.toLowerCase().includes(token));
    case "programme":
      return (
        row.programmeName.toLowerCase().includes(q) ||
        row.standardCode.toLowerCase().includes(q.replace(/\s+/g, ""))
      );
    case "version":
      return row.standardVersion.toLowerCase().includes(q.replace(/^v/i, ""));
    case "group":
      return row.teachingGroup.toLowerCase().includes(q);
  }
}

function CohortInlineField({
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
  type?: "text" | "date";
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

export function AdminCohortsScreen() {
  const store = useAdminStore();
  const [query, setQuery] = useState("");
  const [searchMode, setSearchMode] = useState<CohortSearchMode>("name");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [apprenticeMenuId, setApprenticeMenuId] = useState<string | null>(null);
  const [prevApprenticeMenuId, setPrevApprenticeMenuId] = useState<
    string | null
  >(null);
  const [learnerFilter, setLearnerFilter] = useState("");
  const apprenticeMenuRef = useRef<HTMLDivElement | null>(null);
  const learnerModalRef = useRef<HTMLDivElement | null>(null);
  /** When true, programme/date changes no longer overwrite the cohort name. */
  const [nameLocked, setNameLocked] = useState(false);
  const programmes = store.programmes.filter((p) => p.status === "active");
  const [form, setForm] = useState<FormState>(() =>
    emptyForm(programmes[0]),
  );
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const rows = [...store.cohorts].sort((a, b) =>
      b.startDate.localeCompare(a.startDate),
    );
    return rows.filter((row) => cohortMatchesQuery(row, query, searchMode));
  }, [query, searchMode, store.cohorts]);

  const totalCohorts = store.cohorts.length;
  const activeSearch = SEARCH_MODES.find((m) => m.id === searchMode)!;

  if (apprenticeMenuId !== prevApprenticeMenuId) {
    setPrevApprenticeMenuId(apprenticeMenuId);
    if (!apprenticeMenuId) {
      setLearnerFilter("");
    }
  }

  useEffect(() => {
    if (!apprenticeMenuId) return;
    function onPointerDown(event: MouseEvent) {
      const target = event.target as Node;
      const inDropdown =
        apprenticeMenuRef.current?.contains(target) ?? false;
      const inModal = learnerModalRef.current?.contains(target) ?? false;
      if (!inDropdown && !inModal) setApprenticeMenuId(null);
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setApprenticeMenuId(null);
    }
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [apprenticeMenuId]);

  function openCreate() {
    setEditingId(null);
    setNameLocked(false);
    setForm(emptyForm(programmes[0]));
    setError(null);
    setSuccess(null);
    setShowForm(true);
  }

  function openEdit(row: AdminCohortRecord) {
    setEditingId(row.id);
    setNameLocked(true);
    setForm({
      name: row.name,
      programmeId: row.programmeId,
      programmeName: row.programmeName,
      standardCode: row.standardCode,
      standardVersion: row.standardVersion,
      enrolmentOpensDate: row.enrolmentOpensDate,
      startDate: row.startDate,
      expectedEndDate: row.expectedEndDate,
      teachingGroup: row.teachingGroup,
      collegeDays: row.collegeDays,
      tutorName: row.tutorName,
      status: row.status,
      notes: row.notes,
    });
    setError(null);
    setSuccess(null);
    setShowForm(true);
    setExpandedId(row.id);
  }

  function onProgrammeChange(programmeId: string) {
    const match = programmes.find((p) => p.id === programmeId);
    setForm((prev) =>
      withAutoCohortName(
        prev,
        {
          programmeId,
          programmeName: match?.name ?? prev.programmeName,
          standardCode: match?.standardCode ?? prev.standardCode,
        },
        nameLocked,
      ),
    );
  }

  function buildInput(): CohortInput | null {
    if (!form.name.trim()) {
      setError("Cohort name is required.");
      return null;
    }
    if (!form.programmeId) {
      setError("Select a programme.");
      return null;
    }
    if (!form.standardVersion.trim()) {
      setError("Standard version is required (e.g. 1.3).");
      return null;
    }
    if (!form.startDate) {
      setError("Intake start date is required.");
      return null;
    }
    return {
      ...form,
      name: form.name.trim(),
      standardVersion: form.standardVersion.trim().replace(/^v/i, ""),
    };
  }

  function submit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    const input = buildInput();
    if (!input) return;
    if (editingId) {
      updateCohort(editingId, input);
      setSuccess(`Updated ${input.name}.`);
      setExpandedId(editingId);
    } else {
      const created = createCohort(input);
      setSuccess(`Added cohort ${input.name}.`);
      setExpandedId(created.id);
    }
    setShowForm(false);
    setEditingId(null);
  }

  function toggleLearner(cohort: AdminCohortRecord, learner: AdminLearnerEnrolment) {
    if (learner.cohortId === cohort.id) {
      setEnrolmentCohort(learner.id, null);
      setSuccess(`${learner.displayName} removed from ${cohort.name}.`);
      return;
    }
    setEnrolmentCohort(learner.id, cohort.id);
    setSuccess(
      `${learner.displayName} assigned to ${cohort.name} (v${cohort.standardVersion}).`,
    );
  }

  return (
    <LearnerPageShell
      eyebrow="Administration"
      title="Cohorts & Groups"
      description="Organise intakes and teaching groups, and lock each cohort to the Skills England version learners finish on."
      actions={
        <button type="button" className={styles.primaryBtn} onClick={openCreate}>
          Add cohort
        </button>
      }
    >
      <div className={styles.stack}>
        {success ? <p className={styles.success}>{success}</p> : null}

        {showForm ? (
          <form className={styles.formStack} onSubmit={submit}>
            <section className={styles.formGroup}>
              <div className={styles.formGroupHead}>
                <h2 className={styles.formGroupTitle}>
                  {editingId ? "Edit cohort" : "Add cohort"}
                </h2>
                <span className={styles.formGroupBadge}>
                  {editingId ? "Existing intake" : "New intake"}
                </span>
              </div>
              <p className={styles.formGroupMeta}>
                When Skills England updates a standard, keep older cohorts on
                the version they started. New intakes can use the latest version
                while both run side by side.
              </p>

              <div className={styles.formGrid}>
                <label className={styles.field}>
                  <span>
                    Programme{" "}
                    <em className={styles.fieldRequired}>required</em>
                  </span>
                  <select
                    value={form.programmeId}
                    onChange={(e) => onProgrammeChange(e.target.value)}
                    required
                  >
                    <option value="">Select programme…</option>
                    {programmes.map((programme) => (
                      <option key={programme.id} value={programme.id}>
                        {programme.name} ({programme.standardCode})
                      </option>
                    ))}
                  </select>
                </label>
                <label className={styles.field}>
                  <span>
                    Standard version{" "}
                    <em className={styles.fieldRequired}>required</em>
                  </span>
                  <input
                    value={form.standardVersion}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        standardVersion: e.target.value,
                      }))
                    }
                    required
                    placeholder="1.3"
                  />
                </label>
                <label className={styles.field}>
                  <span>Enrolment opens</span>
                  <input
                    type="date"
                    value={form.enrolmentOpensDate}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        enrolmentOpensDate: e.target.value,
                      }))
                    }
                  />
                  <span className={styles.fieldHint}>
                    While planned, new pupils auto-flow into this cohort from
                    this date until it goes active.
                  </span>
                </label>
                <label className={styles.field}>
                  <span>
                    Intake start{" "}
                    <em className={styles.fieldRequired}>required</em>
                  </span>
                  <input
                    type="date"
                    value={form.startDate}
                    onChange={(e) =>
                      setForm((prev) =>
                        withAutoCohortName(
                          prev,
                          { startDate: e.target.value },
                          nameLocked,
                        ),
                      )
                    }
                    required
                  />
                </label>
                <label className={styles.field}>
                  <span>Expected end / gateway</span>
                  <input
                    type="date"
                    value={form.expectedEndDate}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        expectedEndDate: e.target.value,
                      }))
                    }
                  />
                </label>
                <label className={styles.field}>
                  <span>Teaching group</span>
                  <input
                    value={form.teachingGroup}
                    onChange={(e) =>
                      setForm((prev) =>
                        withAutoCohortName(
                          prev,
                          { teachingGroup: e.target.value },
                          nameLocked,
                        ),
                      )
                    }
                    placeholder="e.g. Mon–Tue Group A"
                  />
                </label>
                <label className={`${styles.field} ${styles.fieldWide}`}>
                  <span>
                    Cohort name{" "}
                    <em className={styles.fieldRequired}>required</em>
                  </span>
                  <input
                    value={form.name}
                    onChange={(e) => {
                      setNameLocked(true);
                      setForm((prev) => ({ ...prev, name: e.target.value }));
                    }}
                    required
                    placeholder="Fills from programme and start date…"
                  />
                  <span className={styles.fieldHint}>
                    Auto-filled as programme · month year
                    {form.teachingGroup.trim() ? " · teaching group" : ""}. Edit
                    to lock a custom name.
                  </span>
                </label>
                <label className={styles.field}>
                  <span>College days</span>
                  <input
                    value={form.collegeDays}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        collegeDays: e.target.value,
                      }))
                    }
                    placeholder="Mon, Tue"
                  />
                </label>
                <label className={styles.field}>
                  <span>Tutor</span>
                  <input
                    value={form.tutorName}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        tutorName: e.target.value,
                      }))
                    }
                  />
                </label>
                <label className={styles.field}>
                  <span>Intake status</span>
                  <select
                    value={form.status}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        status: e.target.value as FormState["status"],
                      }))
                    }
                  >
                    <option value="planned">Planned</option>
                    <option value="active">Active</option>
                    <option value="completed">Completed</option>
                  </select>
                </label>
                <label className={`${styles.field} ${styles.fieldWide}`}>
                  <span>Notes</span>
                  <textarea
                    value={form.notes}
                    onChange={(e) =>
                      setForm((prev) => ({ ...prev, notes: e.target.value }))
                    }
                    rows={3}
                    placeholder="e.g. Started on v1.2 — finish what they started."
                  />
                </label>
              </div>

              {error ? <p className={styles.error}>{error}</p> : null}

              <div className={styles.formActions}>
                <button type="submit" className={styles.primaryBtn}>
                  {editingId ? "Save cohort" : "Create cohort"}
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
              aria-label="Search cohorts by"
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
                ? `Showing ${filtered.length} of ${totalCohorts}`
                : `${totalCohorts} cohort${totalCohorts === 1 ? "" : "s"}`}
            </p>
          </div>
          <label className={styles.searchField}>
            <span>Search cohorts</span>
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={activeSearch.placeholder}
            />
          </label>
        </div>

        {filtered.length === 0 ? (
          <p className={styles.empty}>No cohorts match this search.</p>
        ) : (
          <div className={styles.employerList}>
            {filtered.map((row) => {
              const linked = learnersForCohort(store.enrolments, row.id);
              const open = expandedId === row.id;
              const tone =
                row.status === "completed"
                  ? "neutral"
                  : linked.length > 0
                    ? "green"
                    : "amber";
              const candidates = store.enrolments
                .filter(
                  (e) =>
                    e.standardCode.toUpperCase() ===
                      row.standardCode.toUpperCase() ||
                    e.cohortId === row.id,
                )
                .sort((a, b) => a.displayName.localeCompare(b.displayName));

              return (
                <article
                  key={row.id}
                  className={styles.employerCard}
                  data-tone={tone}
                  data-open={open ? "true" : "false"}
                  role="button"
                  tabIndex={0}
                  aria-expanded={open}
                  aria-label={`${open ? "Collapse" : "Expand"} details for ${row.name}`}
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
                      <strong className={styles.employerName}>{row.name}</strong>
                      <span>
                        {row.standardCode} · v{row.standardVersion}
                        {row.teachingGroup ? ` · ${row.teachingGroup}` : ""}
                      </span>
                      <span>
                        Starts {formatDate(row.startDate)}
                        {row.expectedEndDate
                          ? ` · ends ${formatDate(row.expectedEndDate)}`
                          : ""}
                        {row.tutorName ? ` · ${row.tutorName}` : ""}
                      </span>
                    </div>

                    <div
                      className={styles.employerPillColumn}
                      onClick={(event) => event.stopPropagation()}
                      onKeyDown={(event) => event.stopPropagation()}
                    >
                      <span
                        className={styles.cohortStatusPill}
                        data-status={row.status}
                      >
                        {row.status}
                      </span>
                      {linked.length === 0 ? (
                        <span
                          className={styles.employerApprenticePill}
                          data-has="false"
                        >
                          No learners
                        </span>
                      ) : (
                        (() => {
                          const menuOpen = apprenticeMenuId === row.id;
                          const useModal =
                            linked.length > LEARNER_MODAL_THRESHOLD;
                          const q = learnerFilter.trim().toLowerCase();
                          const visible =
                            useModal && q
                              ? linked.filter((l) =>
                                  [l.displayName, l.employerName]
                                    .join(" ")
                                    .toLowerCase()
                                    .includes(q),
                                )
                              : linked;
                          return (
                            <div
                              className={styles.employerApprenticeMenu}
                              ref={
                                menuOpen && !useModal
                                  ? apprenticeMenuRef
                                  : undefined
                              }
                            >
                              <button
                                type="button"
                                className={styles.employerApprenticePill}
                                data-has="true"
                                data-open={menuOpen ? "true" : "false"}
                                aria-haspopup="listbox"
                                aria-expanded={menuOpen}
                                onClick={() =>
                                  setApprenticeMenuId((current) =>
                                    current === row.id ? null : row.id,
                                  )
                                }
                              >
                                <span>
                                  {linked.length === 1
                                    ? "1 learner"
                                    : `${linked.length} learners`}
                                </span>
                                <span aria-hidden>▾</span>
                              </button>

                              {menuOpen && !useModal ? (
                                <ul
                                  className={styles.employerApprenticeDropdown}
                                  role="listbox"
                                  aria-label={`Learners in ${row.name}`}
                                >
                                  {linked.map((learner) => (
                                    <li
                                      key={learner.id}
                                      role="option"
                                      aria-selected={false}
                                    >
                                      <button
                                        type="button"
                                        className={
                                          styles.employerApprenticeOption
                                        }
                                        onClick={() => {
                                          setExpandedId(row.id);
                                          setApprenticeMenuId(null);
                                        }}
                                      >
                                        <strong>{learner.displayName}</strong>
                                        <span>
                                          {learner.kind === "new_starter"
                                            ? "New starter"
                                            : "Currently studying"}
                                          {" · "}
                                          {learner.employerName ||
                                            "No employer"}
                                        </span>
                                      </button>
                                    </li>
                                  ))}
                                </ul>
                              ) : null}

                              {menuOpen && useModal ? (
                                <div
                                  className={styles.learnerModalBackdrop}
                                  role="presentation"
                                  onClick={() => setApprenticeMenuId(null)}
                                >
                                  <div
                                    className={styles.learnerModal}
                                    role="dialog"
                                    aria-modal="true"
                                    aria-label={`Learners in ${row.name}`}
                                    ref={learnerModalRef}
                                    onClick={(event) =>
                                      event.stopPropagation()
                                    }
                                  >
                                    <div className={styles.learnerModalHead}>
                                      <div>
                                        <h3
                                          className={styles.learnerModalTitle}
                                        >
                                          {row.name}
                                        </h3>
                                        <p className={styles.learnerModalMeta}>
                                          {linked.length} learners · v
                                          {row.standardVersion}
                                        </p>
                                      </div>
                                      <button
                                        type="button"
                                        className={styles.learnerModalClose}
                                        aria-label="Close"
                                        onClick={() =>
                                          setApprenticeMenuId(null)
                                        }
                                      >
                                        ×
                                      </button>
                                    </div>
                                    <input
                                      className={styles.learnerModalSearch}
                                      type="search"
                                      autoFocus
                                      value={learnerFilter}
                                      onChange={(e) =>
                                        setLearnerFilter(e.target.value)
                                      }
                                      placeholder="Search learners…"
                                    />
                                    {visible.length === 0 ? (
                                      <p className={styles.empty}>
                                        No learners match “{learnerFilter}”.
                                      </p>
                                    ) : (
                                      <ul
                                        className={styles.learnerModalList}
                                        role="listbox"
                                      >
                                        {visible.map((learner) => (
                                          <li
                                            key={learner.id}
                                            role="option"
                                            aria-selected={false}
                                          >
                                            <button
                                              type="button"
                                              className={
                                                styles.employerApprenticeOption
                                              }
                                              onClick={() => {
                                                setExpandedId(row.id);
                                                setApprenticeMenuId(null);
                                              }}
                                            >
                                              <strong>
                                                {learner.displayName}
                                              </strong>
                                              <span>
                                                {learner.kind === "new_starter"
                                                  ? "New starter"
                                                  : "Currently studying"}
                                                {" · "}
                                                {learner.employerName ||
                                                  "No employer"}
                                              </span>
                                            </button>
                                          </li>
                                        ))}
                                      </ul>
                                    )}
                                  </div>
                                </div>
                              ) : null}
                            </div>
                          );
                        })()
                      )}
                    </div>
                  </div>

                  {open ? (
                    <div
                      className={styles.employerCardBody}
                      onClick={(event) => event.stopPropagation()}
                      onKeyDown={(event) => event.stopPropagation()}
                    >
                      <div className={styles.employerDetailGrid}>
                        <CohortInlineField
                          label="Cohort name"
                          value={row.name}
                          onCommit={(next) =>
                            updateCohort(row.id, { name: next })
                          }
                          wide
                        />
                        <CohortInlineField
                          label="Standard version"
                          value={row.standardVersion}
                          onCommit={(next) =>
                            updateCohort(row.id, { standardVersion: next })
                          }
                          placeholder="1.3"
                        />
                        <CohortInlineField
                          label="Teaching group"
                          value={row.teachingGroup}
                          onCommit={(next) =>
                            updateCohort(row.id, { teachingGroup: next })
                          }
                          placeholder="Mon–Tue Group A"
                        />
                        <CohortInlineField
                          label="College days"
                          value={row.collegeDays}
                          onCommit={(next) =>
                            updateCohort(row.id, { collegeDays: next })
                          }
                        />
                        <CohortInlineField
                          label="Tutor"
                          value={row.tutorName}
                          onCommit={(next) =>
                            updateCohort(row.id, { tutorName: next })
                          }
                        />
                        <CohortInlineField
                          label="Enrolment opens"
                          value={row.enrolmentOpensDate}
                          type="date"
                          onCommit={(next) =>
                            updateCohort(row.id, { enrolmentOpensDate: next })
                          }
                        />
                        <CohortInlineField
                          label="Intake start"
                          value={row.startDate}
                          type="date"
                          onCommit={(next) =>
                            updateCohort(row.id, { startDate: next })
                          }
                        />
                        <CohortInlineField
                          label="Expected end"
                          value={row.expectedEndDate}
                          type="date"
                          onCommit={(next) =>
                            updateCohort(row.id, { expectedEndDate: next })
                          }
                        />
                        <label className={styles.detailField}>
                          <span className={styles.detailFieldLabel}>
                            Intake status
                          </span>
                          <select
                            className={styles.detailFieldInput}
                            value={row.status}
                            onChange={(e) =>
                              updateCohort(row.id, {
                                status: e.target
                                  .value as AdminCohortRecord["status"],
                              })
                            }
                          >
                            <option value="planned">Planned</option>
                            <option value="active">Active</option>
                            <option value="completed">Completed</option>
                          </select>
                        </label>
                        <CohortInlineField
                          label="Notes"
                          value={row.notes}
                          onCommit={(next) =>
                            updateCohort(row.id, { notes: next })
                          }
                          wide
                          multiline
                        />
                      </div>

                      <div className={styles.linkedLearners}>
                        <div className={styles.linkedLearnersHead}>
                          <h3>Learners on this version</h3>
                          <Link
                            href="/administration/enrolments"
                            className={styles.secondaryBtn}
                          >
                            Manage enrolments
                          </Link>
                        </div>
                        <p className={styles.formGroupMeta}>
                          Assigning a learner here pins them to {row.standardCode}{" "}
                          v{row.standardVersion}.
                        </p>
                        {candidates.length === 0 ? (
                          <p className={styles.empty}>
                            No enrolments on {row.standardCode} yet.
                          </p>
                        ) : (
                          <ul className={styles.linkedLearnerList}>
                            {candidates.map((learner) => {
                              const assigned = learner.cohortId === row.id;
                              const otherCohort =
                                learner.cohortId && learner.cohortId !== row.id
                                  ? store.cohorts.find(
                                      (c) => c.id === learner.cohortId,
                                    )
                                  : null;
                              return (
                                <li key={learner.id}>
                                  <div className={styles.linkedLearnerMain}>
                                    <strong>{learner.displayName}</strong>
                                    <span>
                                      {learner.employerName || "No employer"}
                                      {otherCohort
                                        ? ` · currently on ${otherCohort.name}`
                                        : ""}
                                    </span>
                                  </div>
                                  <div className={styles.formActions}>
                                    <LearnerStatusChip
                                      tone={
                                        learner.status === "active"
                                          ? "green"
                                          : learner.status === "pending_start" ||
                                              learner.status === "draft"
                                            ? "amber"
                                            : "neutral"
                                      }
                                    >
                                      {learner.status.replace("_", " ")}
                                    </LearnerStatusChip>
                                    <button
                                      type="button"
                                      className={styles.secondaryBtn}
                                      onClick={() =>
                                        toggleLearner(row, learner)
                                      }
                                    >
                                      {assigned ? "Remove" : "Assign"}
                                    </button>
                                  </div>
                                </li>
                              );
                            })}
                          </ul>
                        )}
                      </div>

                      <div className={styles.formActions}>
                        <Link
                          href="/administration/programmes"
                          className={styles.secondaryBtn}
                        >
                          Programme records
                        </Link>
                        <button
                          type="button"
                          className={styles.secondaryBtn}
                          onClick={() => openEdit(row)}
                        >
                          Open full edit form
                        </button>
                      </div>
                    </div>
                  ) : null}
                </article>
              );
            })}
          </div>
        )}
      </div>
    </LearnerPageShell>
  );
}
