"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  LearnerPageShell,
  LearnerStatusChip,
} from "@/features/learner-portal/components/LearnerPageShell";
import {
  createProgramme,
  updateProgramme,
  type ProgrammeInput,
} from "../domain/store";
import type {
  AdminLearnerEnrolment,
  AdminProgrammeRecord,
} from "../domain/types";
import { useAdminStore } from "../hooks/useAdminStore";
import styles from "./admin-pages.module.css";

type FormState = ProgrammeInput;

type ProgrammeSearchMode = "name" | "code" | "level";

const SEARCH_MODES: Array<{
  id: ProgrammeSearchMode;
  label: string;
  placeholder: string;
}> = [
  { id: "name", label: "Name", placeholder: "Search by programme name…" },
  { id: "code", label: "Code", placeholder: "Search by standard code…" },
  { id: "level", label: "Level", placeholder: "Search by level, e.g. 2 or 3…" },
];

function emptyForm(): FormState {
  return {
    name: "",
    standardCode: "",
    level: 2,
    route: "Engineering and manufacturing",
    durationMonths: 30,
    awardingBody: "IMI",
    status: "active",
    summary: "",
    skillsEnglandUrl: "",
    notes: "",
  };
}

function learnersForProgramme(
  enrolments: AdminLearnerEnrolment[],
  programme: AdminProgrammeRecord,
): AdminLearnerEnrolment[] {
  return enrolments
    .filter(
      (e) =>
        e.standardCode.toUpperCase() === programme.standardCode.toUpperCase() ||
        e.programmeName === programme.name,
    )
    .sort((a, b) => a.displayName.localeCompare(b.displayName));
}

function programmeMatchesQuery(
  row: AdminProgrammeRecord,
  query: string,
  mode: ProgrammeSearchMode,
): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;

  switch (mode) {
    case "name":
      return q
        .split(/\s+/)
        .every((token) => row.name.toLowerCase().includes(token));
    case "code":
      return row.standardCode.toLowerCase().replace(/\s+/g, "").includes(
        q.replace(/\s+/g, ""),
      );
    case "level":
      return String(row.level).includes(q.replace(/[^0-9]/g, ""));
  }
}

function ProgrammeInlineField({
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
  type?: "text" | "url" | "number";
  placeholder?: string;
  wide?: boolean;
  multiline?: boolean;
}) {
  const [draft, setDraft] = useState(value);

  useEffect(() => {
    setDraft(value);
  }, [value]);

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

export function AdminProgrammesScreen() {
  const store = useAdminStore();
  const [query, setQuery] = useState("");
  const [searchMode, setSearchMode] = useState<ProgrammeSearchMode>("name");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const rows = [...store.programmes].sort((a, b) =>
      a.name.localeCompare(b.name),
    );
    return rows.filter((row) => programmeMatchesQuery(row, query, searchMode));
  }, [query, searchMode, store.programmes]);

  const totalProgrammes = store.programmes.length;
  const activeSearch = SEARCH_MODES.find((m) => m.id === searchMode)!;

  function openCreate() {
    setEditingId(null);
    setForm(emptyForm());
    setError(null);
    setSuccess(null);
    setShowForm(true);
  }

  function openEdit(row: AdminProgrammeRecord) {
    setEditingId(row.id);
    setForm({
      name: row.name,
      standardCode: row.standardCode,
      level: row.level,
      route: row.route,
      durationMonths: row.durationMonths,
      awardingBody: row.awardingBody,
      status: row.status,
      summary: row.summary,
      skillsEnglandUrl: row.skillsEnglandUrl,
      notes: row.notes,
    });
    setError(null);
    setSuccess(null);
    setShowForm(true);
    setExpandedId(row.id);
  }

  function buildInput(): ProgrammeInput | null {
    if (!form.name.trim() || !form.standardCode.trim()) {
      setError("Programme name and standard code are required.");
      return null;
    }
    return {
      ...form,
      name: form.name,
      standardCode: form.standardCode,
      durationMonths: Number(form.durationMonths) || 12,
    };
  }

  function submit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    const input = buildInput();
    if (!input) return;
    if (editingId) {
      updateProgramme(editingId, input);
      setSuccess(`Updated ${input.name}.`);
      setExpandedId(editingId);
    } else {
      const created = createProgramme(input);
      setSuccess(`Added programme ${input.name}.`);
      setExpandedId(created.id);
    }
    setShowForm(false);
    setEditingId(null);
  }

  return (
    <LearnerPageShell
      eyebrow="Administration"
      title="Programme Records"
      description="Apprenticeship standards offered by GTA — add more as you take them on."
      actions={
        <button type="button" className={styles.primaryBtn} onClick={openCreate}>
          Add programme
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
                  {editingId ? "Edit programme" : "Add programme"}
                </h2>
                <span className={styles.formGroupBadge}>
                  {editingId ? "Existing record" : "New standard"}
                </span>
              </div>
              <p className={styles.formGroupMeta}>
                Capture the Skills England / IfATE reference used for enrolments
                and employer matching. You can add the rest of your 8–9
                programmes here as you go.
              </p>

              <div className={styles.formGrid}>
                <label className={`${styles.field} ${styles.fieldWide}`}>
                  <span>
                    Programme name{" "}
                    <em className={styles.fieldRequired}>required</em>
                  </span>
                  <input
                    value={form.name}
                    onChange={(e) =>
                      setForm((prev) => ({ ...prev, name: e.target.value }))
                    }
                    required
                    placeholder="e.g. Autocare Level 2"
                  />
                </label>
                <label className={styles.field}>
                  <span>
                    Standard code{" "}
                    <em className={styles.fieldRequired}>required</em>
                  </span>
                  <input
                    value={form.standardCode}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        standardCode: e.target.value,
                      }))
                    }
                    required
                    placeholder="ST0499"
                  />
                </label>
                <label className={styles.field}>
                  <span>Level</span>
                  <select
                    value={form.level}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        level: Number(e.target.value) as FormState["level"],
                      }))
                    }
                  >
                    {[2, 3, 4, 5, 6, 7].map((level) => (
                      <option key={level} value={level}>
                        Level {level}
                      </option>
                    ))}
                  </select>
                </label>
                <label className={styles.field}>
                  <span>Typical duration (months)</span>
                  <input
                    type="number"
                    min={1}
                    value={form.durationMonths}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        durationMonths: Number(e.target.value) || 0,
                      }))
                    }
                  />
                </label>
                <label className={styles.field}>
                  <span>Awarding body / EPAO</span>
                  <input
                    value={form.awardingBody}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        awardingBody: e.target.value,
                      }))
                    }
                    placeholder="IMI"
                  />
                </label>
                <label className={`${styles.field} ${styles.fieldWide}`}>
                  <span>Route</span>
                  <input
                    value={form.route}
                    onChange={(e) =>
                      setForm((prev) => ({ ...prev, route: e.target.value }))
                    }
                    placeholder="Engineering and manufacturing"
                  />
                </label>
                <label className={`${styles.field} ${styles.fieldWide}`}>
                  <span>Skills England / IfATE link</span>
                  <input
                    value={form.skillsEnglandUrl}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        skillsEnglandUrl: e.target.value,
                      }))
                    }
                    placeholder="https://skillsengland.education.gov.uk/apprenticeships/…"
                  />
                </label>
              </div>
            </section>

            <section className={styles.formGroup}>
              <div className={styles.formGroupHead}>
                <h2 className={styles.formGroupTitle}>Summary</h2>
                <span className={styles.formGroupBadge}>Optional</span>
              </div>
              <label className={styles.field}>
                <span>What this programme covers</span>
                <textarea
                  value={form.summary}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, summary: e.target.value }))
                  }
                  placeholder="Short description for staff and employers…"
                />
              </label>
              <label className={styles.field}>
                <span>Internal notes</span>
                <textarea
                  value={form.notes}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, notes: e.target.value }))
                  }
                  placeholder="Delivery notes, cohort fit, anything useful…"
                />
              </label>
            </section>

            {error ? <p className={styles.error}>{error}</p> : null}
            <div className={styles.formActions}>
              <button
                type="button"
                className={styles.secondaryBtn}
                onClick={() => setShowForm(false)}
              >
                Cancel
              </button>
              <button type="submit" className={styles.primaryBtn}>
                {editingId ? "Save changes" : "Save programme"}
              </button>
            </div>
          </form>
        ) : null}

        <div className={styles.searchBlock}>
          <div className={styles.searchModeRow}>
            <p className={styles.searchModeLabel}>Search by</p>
            <div
              className={styles.searchModeTabs}
              role="group"
              aria-label="Search programmes by"
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
                ? `Showing ${filtered.length} of ${totalProgrammes}`
                : `${totalProgrammes} programme${totalProgrammes === 1 ? "" : "s"}`}
            </p>
          </div>
          <label className={styles.searchField}>
            <span>Search programmes</span>
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={activeSearch.placeholder}
            />
          </label>
        </div>

        {filtered.length === 0 ? (
          <p className={styles.empty}>No programmes match this search.</p>
        ) : (
          <div className={styles.employerList}>
            {filtered.map((row) => {
              const linked = learnersForProgramme(store.enrolments, row);
              const open = expandedId === row.id;
              const tone = linked.length > 0 ? "green" : "amber";
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
                        {row.standardCode} · Level {row.level}
                        {row.durationMonths
                          ? ` · ${row.durationMonths} months`
                          : ""}
                      </span>
                      <span>
                        {row.awardingBody || "Awarding body not set"}
                        {row.route ? ` · ${row.route}` : ""}
                      </span>
                    </div>

                    <div
                      className={styles.employerPillColumn}
                      onClick={(event) => event.stopPropagation()}
                      onKeyDown={(event) => event.stopPropagation()}
                    >
                      <span
                        className={styles.employerApprenticePill}
                        data-has={linked.length > 0 ? "true" : "false"}
                      >
                        {linked.length === 0
                          ? "No learners"
                          : linked.length === 1
                            ? "1 learner"
                            : `${linked.length} learners`}
                      </span>
                    </div>
                  </div>

                  {open ? (
                    <div
                      className={styles.employerCardBody}
                      onClick={(event) => event.stopPropagation()}
                      onKeyDown={(event) => event.stopPropagation()}
                    >
                      <div className={styles.employerDetailGrid}>
                        <ProgrammeInlineField
                          label="Programme name"
                          value={row.name}
                          onCommit={(next) =>
                            updateProgramme(row.id, { name: next })
                          }
                        />
                        <ProgrammeInlineField
                          label="Standard code"
                          value={row.standardCode}
                          onCommit={(next) =>
                            updateProgramme(row.id, { standardCode: next })
                          }
                        />
                        <ProgrammeInlineField
                          label="Level"
                          value={String(row.level)}
                          type="number"
                          onCommit={(next) => {
                            const level = Number(next) as FormState["level"];
                            if ([2, 3, 4, 5, 6, 7].includes(level)) {
                              updateProgramme(row.id, { level });
                            }
                          }}
                        />
                        <ProgrammeInlineField
                          label="Duration (months)"
                          value={String(row.durationMonths)}
                          type="number"
                          onCommit={(next) =>
                            updateProgramme(row.id, {
                              durationMonths: Number(next) || row.durationMonths,
                            })
                          }
                        />
                        <ProgrammeInlineField
                          label="Awarding body / EPAO"
                          value={row.awardingBody}
                          onCommit={(next) =>
                            updateProgramme(row.id, { awardingBody: next })
                          }
                        />
                        <ProgrammeInlineField
                          label="Route"
                          value={row.route}
                          onCommit={(next) =>
                            updateProgramme(row.id, { route: next })
                          }
                        />
                        <ProgrammeInlineField
                          label="Skills England link"
                          value={row.skillsEnglandUrl}
                          type="url"
                          wide
                          placeholder="https://"
                          onCommit={(next) =>
                            updateProgramme(row.id, {
                              skillsEnglandUrl: next,
                            })
                          }
                        />
                        <ProgrammeInlineField
                          label="Summary"
                          value={row.summary}
                          wide
                          multiline
                          onCommit={(next) =>
                            updateProgramme(row.id, { summary: next })
                          }
                        />
                        <ProgrammeInlineField
                          label="Notes"
                          value={row.notes}
                          wide
                          multiline
                          onCommit={(next) =>
                            updateProgramme(row.id, { notes: next })
                          }
                        />
                      </div>

                      <div className={styles.linkedLearners}>
                        <div className={styles.linkedLearnersHead}>
                          <h3>Linked learners</h3>
                          <Link
                            href="/administration/enrolments"
                            className={styles.secondaryBtn}
                          >
                            Manage enrolments
                          </Link>
                        </div>
                        {linked.length === 0 ? (
                          <p className={styles.empty}>
                            No learners enrolled on this programme yet.
                          </p>
                        ) : (
                          <ul className={styles.linkedLearnerList}>
                            {linked.map((learner) => (
                              <li key={learner.id}>
                                <div className={styles.linkedLearnerMain}>
                                  <strong>{learner.displayName}</strong>
                                  <span>
                                    {learner.employerName}
                                    {learner.kind === "currently_studying" &&
                                    learner.programmeYear != null
                                      ? ` · Y${learner.programmeYear} · W${learner.programmeWeek}`
                                      : ` · starts ${learner.startDate}`}
                                  </span>
                                </div>
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
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>

                      <div className={styles.formActions}>
                        {row.skillsEnglandUrl ? (
                          <a
                            href={row.skillsEnglandUrl}
                            target="_blank"
                            rel="noreferrer"
                            className={styles.secondaryBtn}
                          >
                            Open Skills England
                          </a>
                        ) : null}
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
