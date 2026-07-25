"use client";

import { useMemo, useState } from "react";
import {
  LearnerPageShell,
  LearnerStatusChip,
} from "@/features/learner-portal/components/LearnerPageShell";
import { ALEX_PROFILE } from "@/features/learner-portal/domain/mock-learner";
import {
  createEnrolment,
  updateEnrolment,
  type EnrolmentInput,
} from "../domain/store";
import type { EnrolmentKind, EnrolmentStatus } from "../domain/types";
import { useAdminStore } from "../hooks/useAdminStore";
import styles from "./admin-pages.module.css";

type FormState = {
  kind: EnrolmentKind;
  displayName: string;
  email: string;
  phone: string;
  dateOfBirth: string;
  uln: string;
  programmeName: string;
  standardCode: string;
  employerId: string;
  workplaceContact: string;
  mentorName: string;
  tutorName: string;
  startDate: string;
  programmeYear: string;
  programmeWeek: string;
  attendancePercent: string;
  actualProgressPercent: string;
  collegeDays: string;
  notes: string;
  status: EnrolmentStatus;
};

function emptyForm(
  kind: EnrolmentKind,
  programme?: { name: string; standardCode: string },
): FormState {
  return {
    kind,
    displayName: "",
    email: "",
    phone: "",
    dateOfBirth: "",
    uln: "",
    programmeName: programme?.name ?? "",
    standardCode: programme?.standardCode ?? "",
    employerId: "",
    workplaceContact: "",
    mentorName: ALEX_PROFILE.mentorName,
    tutorName: ALEX_PROFILE.tutorName,
    startDate: "",
    programmeYear: kind === "currently_studying" ? "1" : "",
    programmeWeek: kind === "currently_studying" ? "1" : "",
    attendancePercent: kind === "currently_studying" ? "100" : "",
    actualProgressPercent: kind === "currently_studying" ? "0" : "",
    collegeDays: "Monday & Tuesday",
    notes: "",
    status: kind === "new_starter" ? "pending_start" : "active",
  };
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

export function AdminEnrolmentsScreen() {
  const store = useAdminStore();
  const [query, setQuery] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(() => emptyForm("new_starter"));
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const employers = store.employers.filter((e) => e.status === "active");
  const programmes = store.programmes.filter((p) => p.status === "active");
  const defaultProgramme = programmes[0];

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const rows = [...store.enrolments].sort((a, b) =>
      b.updatedAt.localeCompare(a.updatedAt),
    );
    if (!q) return rows;
    return rows.filter((row) =>
      [
        row.displayName,
        row.email,
        row.programmeName,
        row.employerName,
        row.uln,
        row.kind,
        row.status,
      ]
        .join(" ")
        .toLowerCase()
        .includes(q),
    );
  }, [query, store.enrolments]);

  function setKind(kind: EnrolmentKind) {
    setForm((prev) => ({
      ...emptyForm(kind, defaultProgramme),
      displayName: prev.displayName,
      email: prev.email,
      phone: prev.phone,
      dateOfBirth: prev.dateOfBirth,
      employerId: prev.employerId || employers[0]?.id || "",
      workplaceContact:
        prev.workplaceContact ||
        employers.find((e) => e.id === prev.employerId)?.mainContact ||
        employers[0]?.mainContact ||
        "",
    }));
  }

  function openCreate(kind: EnrolmentKind) {
    setEditingId(null);
    setError(null);
    setSuccess(null);
    const employer = employers[0];
    setForm({
      ...emptyForm(kind, defaultProgramme),
      employerId: employer?.id ?? "",
      workplaceContact: employer?.mainContact ?? "",
    });
    setShowForm(true);
  }

  function openEdit(idValue: string) {
    const row = store.enrolments.find((e) => e.id === idValue);
    if (!row) return;
    setEditingId(row.id);
    setError(null);
    setSuccess(null);
    setForm({
      kind: row.kind,
      displayName: row.displayName,
      email: row.email,
      phone: row.phone,
      dateOfBirth: row.dateOfBirth,
      uln: row.uln,
      programmeName: row.programmeName,
      standardCode: row.standardCode,
      employerId: row.employerId,
      workplaceContact: row.workplaceContact,
      mentorName: row.mentorName,
      tutorName: row.tutorName,
      startDate: row.startDate,
      programmeYear: row.programmeYear?.toString() ?? "",
      programmeWeek: row.programmeWeek?.toString() ?? "",
      attendancePercent: row.attendancePercent?.toString() ?? "",
      actualProgressPercent: row.actualProgressPercent?.toString() ?? "",
      collegeDays: row.collegeDays,
      notes: row.notes,
      status: row.status,
    });
    setShowForm(true);
  }

  function onProgrammeChange(name: string) {
    const match = programmes.find((p) => p.name === name);
    setForm((prev) => ({
      ...prev,
      programmeName: name,
      standardCode: match?.standardCode ?? prev.standardCode,
    }));
  }

  function onEmployerChange(employerId: string) {
    const employer = employers.find((e) => e.id === employerId);
    setForm((prev) => ({
      ...prev,
      employerId,
      workplaceContact: employer?.mainContact ?? prev.workplaceContact,
    }));
  }

  function buildInput(): EnrolmentInput | null {
    if (!form.displayName.trim()) {
      setError("Learner name is required.");
      return null;
    }
    if (!form.email.trim()) {
      setError("Email is required.");
      return null;
    }
    if (!form.employerId) {
      setError("Select an employer.");
      return null;
    }
    if (!form.startDate) {
      setError("Start date is required.");
      return null;
    }
    const employer = employers.find((e) => e.id === form.employerId);
    if (!employer) {
      setError("Select a valid employer.");
      return null;
    }

    const studying = form.kind === "currently_studying";
    const year = studying ? (Number(form.programmeYear) as 1 | 2 | 3) : null;
    const week = studying ? Number(form.programmeWeek) : null;
    if (studying && (![1, 2, 3].includes(year as number) || Number.isNaN(week))) {
      setError("Currently studying learners need programme year and week.");
      return null;
    }

    return {
      kind: form.kind,
      status: form.status,
      displayName: form.displayName,
      email: form.email,
      phone: form.phone,
      dateOfBirth: form.dateOfBirth,
      uln: form.uln,
      programmeName: form.programmeName,
      standardCode: form.standardCode,
      employerId: employer.id,
      employerName: employer.name,
      workplaceContact: form.workplaceContact,
      mentorName: form.mentorName,
      tutorName: form.tutorName,
      startDate: form.startDate,
      programmeYear: studying ? year : null,
      programmeWeek: studying ? week : null,
      attendancePercent: studying
        ? Number(form.attendancePercent || 0)
        : null,
      actualProgressPercent: studying
        ? Number(form.actualProgressPercent || 0)
        : null,
      collegeDays: form.collegeDays,
      notes: form.notes,
    };
  }

  function submit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setSuccess(null);
    const input = buildInput();
    if (!input) return;

    if (editingId) {
      updateEnrolment(editingId, input);
      setSuccess(`Updated ${input.displayName}.`);
    } else {
      createEnrolment(input);
      setSuccess(
        input.kind === "new_starter"
          ? `Added new starter ${input.displayName}.`
          : `Registered currently studying learner ${input.displayName}.`,
      );
    }
    setShowForm(false);
    setEditingId(null);
  }

  return (
    <LearnerPageShell
      eyebrow="Administration"
      title="Learner Enrolments"
      description="Add new starters, or register learners who are already studying so their programme position is recorded from day one."
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

        {showForm ? (
          <form className={styles.panel} onSubmit={submit}>
            <div>
              <h2 className={styles.panelTitle}>
                {editingId ? "Edit enrolment" : "Add enrolment"}
              </h2>
              <p className={styles.panelLead}>
                Choose whether this person is joining as a new starter or is
                already on programme.
              </p>
            </div>

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
              <label className={styles.field}>
                <span>Full name</span>
                <input
                  value={form.displayName}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, displayName: e.target.value }))
                  }
                  required
                />
              </label>
              <label className={styles.field}>
                <span>Email</span>
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, email: e.target.value }))
                  }
                  required
                />
              </label>
              <label className={styles.field}>
                <span>Phone</span>
                <input
                  value={form.phone}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, phone: e.target.value }))
                  }
                />
              </label>
              <label className={styles.field}>
                <span>Date of birth</span>
                <input
                  type="date"
                  value={form.dateOfBirth}
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      dateOfBirth: e.target.value,
                    }))
                  }
                />
              </label>
              <label className={styles.field}>
                <span>ULN</span>
                <input
                  value={form.uln}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, uln: e.target.value }))
                  }
                  placeholder={
                    form.kind === "new_starter" ? "Can be added later" : ""
                  }
                />
              </label>
              <label className={styles.field}>
                <span>Status</span>
                <select
                  value={form.status}
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      status: e.target.value as EnrolmentStatus,
                    }))
                  }
                >
                  <option value="draft">Draft</option>
                  <option value="pending_start">Pending start</option>
                  <option value="active">Active</option>
                  <option value="completed">Completed</option>
                  <option value="withdrawn">Withdrawn</option>
                </select>
              </label>
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
                <span>Employer</span>
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
                <span>Workplace contact</span>
                <input
                  value={form.workplaceContact}
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      workplaceContact: e.target.value,
                    }))
                  }
                />
              </label>
              <label className={styles.field}>
                <span>Progress mentor</span>
                <input
                  value={form.mentorName}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, mentorName: e.target.value }))
                  }
                />
              </label>
              <label className={styles.field}>
                <span>Tutor</span>
                <input
                  value={form.tutorName}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, tutorName: e.target.value }))
                  }
                />
              </label>
              <label className={styles.field}>
                <span>
                  {form.kind === "new_starter"
                    ? "Planned start date"
                    : "Programme start date"}
                </span>
                <input
                  type="date"
                  value={form.startDate}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, startDate: e.target.value }))
                  }
                  required
                />
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
                />
              </label>

              {form.kind === "currently_studying" ? (
                <>
                  <label className={styles.field}>
                    <span>Programme year</span>
                    <select
                      value={form.programmeYear}
                      onChange={(e) =>
                        setForm((prev) => ({
                          ...prev,
                          programmeYear: e.target.value,
                        }))
                      }
                    >
                      <option value="1">Year 1</option>
                      <option value="2">Year 2</option>
                      <option value="3">Year 3</option>
                    </select>
                  </label>
                  <label className={styles.field}>
                    <span>Programme week</span>
                    <input
                      type="number"
                      min={1}
                      max={52}
                      value={form.programmeWeek}
                      onChange={(e) =>
                        setForm((prev) => ({
                          ...prev,
                          programmeWeek: e.target.value,
                        }))
                      }
                    />
                  </label>
                  <label className={styles.field}>
                    <span>Attendance %</span>
                    <input
                      type="number"
                      min={0}
                      max={100}
                      value={form.attendancePercent}
                      onChange={(e) =>
                        setForm((prev) => ({
                          ...prev,
                          attendancePercent: e.target.value,
                        }))
                      }
                    />
                  </label>
                  <label className={styles.field}>
                    <span>Progress %</span>
                    <input
                      type="number"
                      min={0}
                      max={100}
                      value={form.actualProgressPercent}
                      onChange={(e) =>
                        setForm((prev) => ({
                          ...prev,
                          actualProgressPercent: e.target.value,
                        }))
                      }
                    />
                  </label>
                </>
              ) : null}

              <label className={`${styles.field} ${styles.fieldWide}`}>
                <span>Notes</span>
                <textarea
                  value={form.notes}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, notes: e.target.value }))
                  }
                  placeholder="Induction notes, missing paperwork, transfer details…"
                />
              </label>
            </div>

            {error ? <p className={styles.error}>{error}</p> : null}

            <div className={styles.formActions}>
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
              <button type="submit" className={styles.primaryBtn}>
                {editingId ? "Save changes" : "Save enrolment"}
              </button>
            </div>
          </form>
        ) : null}

        <div className={styles.toolbar}>
          <label className={styles.searchField}>
            <span>Search enrolments</span>
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Name, email, programme, employer…"
            />
          </label>
          <p className={styles.muted}>
            {filtered.length} record{filtered.length === 1 ? "" : "s"}
          </p>
        </div>

        {filtered.length === 0 ? (
          <p className={styles.empty}>No enrolments match this search.</p>
        ) : (
          <div className={`${styles.panel} ${styles.tableWrap}`}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Learner</th>
                  <th>Type</th>
                  <th>Programme</th>
                  <th>Employer</th>
                  <th>Position</th>
                  <th>Status</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {filtered.map((row) => (
                  <tr key={row.id}>
                    <td>
                      <span className={styles.rowName}>{row.displayName}</span>
                      <span className={styles.rowMeta}>{row.email}</span>
                    </td>
                    <td>
                      {row.kind === "new_starter"
                        ? "New starter"
                        : "Currently studying"}
                    </td>
                    <td>
                      {row.programmeName}
                      <span className={styles.rowMeta}>{row.standardCode}</span>
                    </td>
                    <td>{row.employerName}</td>
                    <td>
                      {row.kind === "currently_studying"
                        ? `Y${row.programmeYear} · W${row.programmeWeek}`
                        : `Starts ${row.startDate}`}
                    </td>
                    <td>
                      <LearnerStatusChip tone={statusTone(row.status)}>
                        {row.status.replace("_", " ")}
                      </LearnerStatusChip>
                    </td>
                    <td>
                      <button
                        type="button"
                        className={styles.secondaryBtn}
                        onClick={() => openEdit(row.id)}
                      >
                        Edit
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </LearnerPageShell>
  );
}
