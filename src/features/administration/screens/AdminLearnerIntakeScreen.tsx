"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { LearnerPageShell } from "@/features/learner-portal/components/LearnerPageShell";
import {
  createLearner,
  setLearnerPackItem,
  updateLearner,
  type LearnerInput,
} from "../domain/store";
import {
  PACK_SECTIONS,
  intakeCompletionBlockers,
  isPreStartRequired,
  missingPersonalFields,
  packItemStatus,
  packSectionProgress,
  packTotals,
} from "../domain/intake-pack";
import type {
  AdminLearnerRecord,
  AdminPackItemStatus,
} from "../domain/types";
import { useAdminStore } from "../hooks/useAdminStore";
import styles from "./admin-pages.module.css";

const PACK_STATUS_OPTIONS: Array<{
  value: AdminPackItemStatus;
  label: string;
}> = [
  { value: "missing", label: "Missing" },
  { value: "requested", label: "Requested" },
  { value: "received", label: "Received" },
  { value: "checked", label: "Checked" },
  { value: "not_applicable", label: "Not applicable" },
];

/** Personal details step sits in front of the ADM14 sections. */
const PERSONAL_STEP = {
  key: "personal",
  label: "Personal details",
  bookletSection: "Start",
};

const STEPS = [
  PERSONAL_STEP,
  ...PACK_SECTIONS.map((section) => ({
    key: section.key,
    label: section.title,
    bookletSection: section.bookletSection,
  })),
];

type PersonalForm = Omit<LearnerInput, "intakeStatus">;

function emptyPersonalForm(): PersonalForm {
  return {
    displayName: "",
    learnerReference: "",
    email: "",
    phone: "",
    dateOfBirth: "",
    uln: "",
    addressLine1: "",
    addressLine2: "",
    town: "",
    postcode: "",
    emergencyContactName: "",
    emergencyContactPhone: "",
    emergencyContactRelationship: "",
    supportNotes: "",
    notes: "",
  };
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

function IntakeInlineField({
  label,
  value,
  onCommit,
  type = "text",
  placeholder,
  required = false,
  wide = false,
  multiline = false,
}: {
  label: string;
  value: string;
  onCommit: (next: string) => void;
  type?: "text" | "email" | "tel" | "date";
  placeholder?: string;
  required?: boolean;
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
      <span className={styles.detailFieldLabel}>
        {label}
        {required ? <em className={styles.fieldRequired}>required</em> : null}
      </span>
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
          data-empty={value.trim() ? "false" : "true"}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
        />
      )}
    </label>
  );
}

export function AdminLearnerIntakeScreen() {
  const store = useAdminStore();
  const [activeId, setActiveId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const [newForm, setNewForm] = useState<PersonalForm>(() =>
    emptyPersonalForm(),
  );
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const enrolledLearnerIds = store.enrolments.map((e) => e.learnerId);

  // Only unfinished intakes belong in this queue — once signed off they move
  // on and are counted as awaiting enrolment on the Enrolments page.
  const queue = [...store.learners]
    .filter((learner) => learner.intakeStatus === "in_progress")
    .sort((a, b) => a.displayName.localeCompare(b.displayName));

  const readyAwaiting = store.learners.filter(
    (learner) =>
      learner.intakeStatus === "ready" && !enrolledLearnerIds.includes(learner.id),
  );

  const active = activeId
    ? (store.learners.find((l) => l.id === activeId) ?? null)
    : null;

  function closeWizard() {
    setActiveId(null);
    setCreating(false);
    setStepIndex(0);
    setError(null);
  }

  function startNew() {
    setSuccess(null);
    setError(null);
    setNewForm(emptyPersonalForm());
    setStepIndex(0);
    setActiveId(null);
    setCreating(true);
  }

  function resume(learner: AdminLearnerRecord) {
    setSuccess(null);
    setError(null);
    setCreating(false);
    setActiveId(learner.id);
    // Land on the first section that still has required gaps.
    const sections = packSectionProgress(learner);
    if (missingPersonalFields(learner).length > 0) {
      setStepIndex(0);
      return;
    }
    const firstGap = sections.findIndex((s) => s.requiredOutstanding > 0);
    setStepIndex(firstGap === -1 ? 0 : firstGap + 1);
  }

  function createDraft() {
    if (!newForm.displayName.trim()) {
      setError("A name is needed to start the intake.");
      return;
    }
    const created = createLearner({ ...newForm, intakeStatus: "in_progress" });
    setError(null);
    setCreating(false);
    setActiveId(created.id);
    setStepIndex(1);
  }

  function completeIntake(learner: AdminLearnerRecord) {
    const blockers = intakeCompletionBlockers(learner);
    if (blockers.length > 0) {
      setError(
        `Intake can't be signed off yet — still outstanding: ${blockers.join(", ")}.`,
      );
      return;
    }
    updateLearner(learner.id, { intakeStatus: "ready" });
    setSuccess(
      `${learner.displayName} has completed intake and is now waiting for enrolment.`,
    );
    closeWizard();
  }

  // ── New learner: personal details before a record exists ──────────────
  if (creating) {
    return (
      <LearnerPageShell
        eyebrow="Administration"
        title="Learner Intake"
        description="Start with who they are. Once saved you'll walk through each pack section, and you can stop and resume at any point."
      >
        <div className={styles.stack}>
          <section className={styles.formGroup}>
            <div className={styles.formGroupHead}>
              <h2 className={styles.formGroupTitle}>Start an intake</h2>
              <span className={styles.formGroupBadge}>Step 1 of {STEPS.length}</span>
            </div>
            <p className={styles.formGroupMeta}>
              Only a name is needed to create the record — everything else can
              be filled as you work through the sections.
            </p>
            <div className={styles.formGrid}>
              <label className={styles.field}>
                <span>
                  Full name <em className={styles.fieldRequired}>required</em>
                </span>
                <input
                  value={newForm.displayName}
                  onChange={(e) =>
                    setNewForm((prev) => ({
                      ...prev,
                      displayName: e.target.value,
                    }))
                  }
                  required
                  autoFocus
                />
              </label>
              <label className={styles.field}>
                <span>Date of birth</span>
                <input
                  type="date"
                  value={newForm.dateOfBirth}
                  onChange={(e) =>
                    setNewForm((prev) => ({
                      ...prev,
                      dateOfBirth: e.target.value,
                    }))
                  }
                />
              </label>
              <label className={styles.field}>
                <span>Email</span>
                <input
                  type="email"
                  value={newForm.email}
                  onChange={(e) =>
                    setNewForm((prev) => ({ ...prev, email: e.target.value }))
                  }
                />
              </label>
              <label className={styles.field}>
                <span>Phone</span>
                <input
                  type="tel"
                  value={newForm.phone}
                  onChange={(e) =>
                    setNewForm((prev) => ({ ...prev, phone: e.target.value }))
                  }
                />
              </label>
            </div>
            {error ? <p className={styles.error}>{error}</p> : null}
            <div className={styles.formActions}>
              <button
                type="button"
                className={styles.secondaryBtn}
                onClick={closeWizard}
              >
                Cancel
              </button>
              <button
                type="button"
                className={styles.primaryBtn}
                onClick={createDraft}
              >
                Save and start sections
              </button>
            </div>
          </section>
        </div>
      </LearnerPageShell>
    );
  }

  // ── Section walkthrough for an in-progress learner ────────────────────
  if (active) {
    const sections = packSectionProgress(active);
    const totals = packTotals(active);
    const blockers = intakeCompletionBlockers(active);
    const personalGaps = missingPersonalFields(active);
    const step = STEPS[stepIndex] ?? STEPS[0];
    const onPersonal = step.key === PERSONAL_STEP.key;
    const sectionEntry = onPersonal
      ? null
      : (sections.find((s) => s.section.key === step.key) ?? sections[0]);

    return (
      <LearnerPageShell
        eyebrow="Administration · Learner intake"
        title={active.displayName}
        description={`${active.learnerReference} · ${totals.satisfied} of ${totals.total} pack items logged · ${blockers.length} outstanding before sign-off`}
        actions={
          <div className={styles.toolbarActions}>
            <button
              type="button"
              className={styles.secondaryBtn}
              onClick={() => {
                setSuccess(
                  `Progress saved for ${active.displayName} — pick the intake back up any time.`,
                );
                closeWizard();
              }}
            >
              Save and close
            </button>
            <button
              type="button"
              className={styles.primaryBtn}
              onClick={() => completeIntake(active)}
            >
              Complete intake
            </button>
          </div>
        }
      >
        <div className={styles.stack}>
          {error ? <p className={styles.error}>{error}</p> : null}

          <nav
            className={styles.stepNav}
            aria-label="Intake sections"
          >
            {STEPS.map((entry, index) => {
              const entrySection = sections.find(
                (s) => s.section.key === entry.key,
              );
              const outstanding =
                entry.key === PERSONAL_STEP.key
                  ? personalGaps.length
                  : (entrySection?.requiredOutstanding ?? 0);
              return (
                <button
                  key={entry.key}
                  type="button"
                  className={styles.stepChip}
                  data-active={index === stepIndex ? "true" : "false"}
                  data-outstanding={outstanding > 0 ? "true" : "false"}
                  aria-current={index === stepIndex}
                  onClick={() => setStepIndex(index)}
                >
                  <span className={styles.stepChipText}>
                    <small>{entry.bookletSection.toUpperCase()}</small>
                    {entry.label}
                  </span>
                  {outstanding > 0 ? (
                    <span className={styles.stepChipBadge}>{outstanding}</span>
                  ) : (
                    <span className={styles.stepChipDone} aria-hidden="true">
                      ✓
                    </span>
                  )}
                </button>
              );
            })}
          </nav>

          <section className={styles.formGroup}>
            <div className={styles.formGroupHead}>
              <h2 className={styles.formGroupTitle}>
                {step.bookletSection} · {step.label}
              </h2>
              <span className={styles.formGroupBadge}>
                Step {stepIndex + 1} of {STEPS.length}
              </span>
            </div>

            {onPersonal ? (
              <>
                <p className={styles.formGroupMeta}>
                  Everything here feeds the learner record and shows up on the
                  Learners page. Changes save as you leave each field.
                </p>
                <div className={styles.employerDetailGrid}>
                  <IntakeInlineField
                    label="Full name"
                    value={active.displayName}
                    required
                    onCommit={(next) =>
                      updateLearner(active.id, { displayName: next })
                    }
                  />
                  <IntakeInlineField
                    label="Learner reference"
                    value={active.learnerReference}
                    onCommit={(next) =>
                      updateLearner(active.id, { learnerReference: next })
                    }
                  />
                  <IntakeInlineField
                    label="Date of birth"
                    value={active.dateOfBirth}
                    type="date"
                    required
                    onCommit={(next) =>
                      updateLearner(active.id, { dateOfBirth: next })
                    }
                  />
                  <IntakeInlineField
                    label="ULN"
                    value={active.uln}
                    required
                    placeholder="10 digits"
                    onCommit={(next) => updateLearner(active.id, { uln: next })}
                  />
                  <IntakeInlineField
                    label="Email"
                    value={active.email}
                    type="email"
                    required
                    onCommit={(next) =>
                      updateLearner(active.id, { email: next })
                    }
                  />
                  <IntakeInlineField
                    label="Phone"
                    value={active.phone}
                    type="tel"
                    onCommit={(next) =>
                      updateLearner(active.id, { phone: next })
                    }
                  />
                  <IntakeInlineField
                    label="Address line 1"
                    value={active.addressLine1}
                    required
                    onCommit={(next) =>
                      updateLearner(active.id, { addressLine1: next })
                    }
                  />
                  <IntakeInlineField
                    label="Address line 2"
                    value={active.addressLine2}
                    onCommit={(next) =>
                      updateLearner(active.id, { addressLine2: next })
                    }
                  />
                  <IntakeInlineField
                    label="Town / city"
                    value={active.town}
                    onCommit={(next) => updateLearner(active.id, { town: next })}
                  />
                  <IntakeInlineField
                    label="Postcode"
                    value={active.postcode}
                    required
                    onCommit={(next) =>
                      updateLearner(active.id, { postcode: next })
                    }
                  />
                  <IntakeInlineField
                    label="Emergency contact"
                    value={active.emergencyContactName}
                    required
                    onCommit={(next) =>
                      updateLearner(active.id, { emergencyContactName: next })
                    }
                  />
                  <IntakeInlineField
                    label="Emergency phone"
                    value={active.emergencyContactPhone}
                    type="tel"
                    onCommit={(next) =>
                      updateLearner(active.id, { emergencyContactPhone: next })
                    }
                  />
                  <IntakeInlineField
                    label="Relationship"
                    value={active.emergencyContactRelationship}
                    placeholder="e.g. Mother, guardian…"
                    onCommit={(next) =>
                      updateLearner(active.id, {
                        emergencyContactRelationship: next,
                      })
                    }
                  />
                  <IntakeInlineField
                    label="Learning support needs"
                    value={active.supportNotes}
                    wide
                    multiline
                    placeholder="Access arrangements, EHCP, anything tutors should know…"
                    onCommit={(next) =>
                      updateLearner(active.id, { supportNotes: next })
                    }
                  />
                  <IntakeInlineField
                    label="Notes"
                    value={active.notes}
                    wide
                    multiline
                    placeholder="What's still to chase…"
                    onCommit={(next) =>
                      updateLearner(active.id, { notes: next })
                    }
                  />
                </div>
              </>
            ) : sectionEntry ? (
              <>
                <p className={styles.formGroupMeta}>
                  {sectionEntry.satisfied} of {sectionEntry.total} logged
                  {sectionEntry.requiredOutstanding > 0
                    ? ` · ${sectionEntry.requiredOutstanding} still required before start`
                    : " · nothing outstanding here"}
                  . Items marked as filling in later stay open on the Learners
                  page as they progress.
                </p>
                <ul className={styles.packItemList}>
                  {sectionEntry.section.items.map((item) => {
                    const status = packItemStatus(active, item);
                    const required = isPreStartRequired(item.reference);
                    const satisfied =
                      status === "received" ||
                      status === "checked" ||
                      status === "not_applicable";
                    return (
                      <li
                        key={item.reference}
                        className={styles.packItemRow}
                        data-satisfied={
                          status === "future" ? "future" : String(satisfied)
                        }
                      >
                        <span className={styles.packItemRef}>
                          {item.reference}
                        </span>
                        <span className={styles.packItemTitle}>
                          {item.title}
                          <small>
                            {required
                              ? "Required before start (provisional)"
                              : item.endOfProgramme
                                ? "End of programme"
                                : item.isRecurring
                                  ? "Fills in as they progress"
                                  : item.applicability}
                          </small>
                        </span>
                        {status === "future" ? (
                          <span className={styles.packItemFuture}>
                            Future requirement
                          </span>
                        ) : (
                          <select
                            className={styles.packItemSelect}
                            value={status}
                            data-status={status}
                            onChange={(e) =>
                              setLearnerPackItem(
                                active.id,
                                item.reference,
                                e.target.value as AdminPackItemStatus,
                              )
                            }
                          >
                            {PACK_STATUS_OPTIONS.map((option) => (
                              <option key={option.value} value={option.value}>
                                {option.label}
                              </option>
                            ))}
                          </select>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </>
            ) : null}

            <div className={styles.formActions}>
              <button
                type="button"
                className={styles.secondaryBtn}
                disabled={stepIndex === 0}
                onClick={() => setStepIndex((i) => Math.max(0, i - 1))}
              >
                Back
              </button>
              {stepIndex < STEPS.length - 1 ? (
                <button
                  type="button"
                  className={styles.primaryBtn}
                  onClick={() =>
                    setStepIndex((i) => Math.min(STEPS.length - 1, i + 1))
                  }
                >
                  Next section
                </button>
              ) : (
                <button
                  type="button"
                  className={styles.primaryBtn}
                  onClick={() => completeIntake(active)}
                >
                  Complete intake
                </button>
              )}
            </div>
          </section>
        </div>
      </LearnerPageShell>
    );
  }

  // ── Queue of intakes still in progress ────────────────────────────────
  return (
    <LearnerPageShell
      eyebrow="Administration"
      title="Learner Intake"
      description="Work through each pack section to get a learner onto the system. Save mid-way and come back — finished intakes leave this list and wait on the Enrolments page."
      actions={
        <button type="button" className={styles.primaryBtn} onClick={startNew}>
          Start new learner
        </button>
      }
    >
      <div className={styles.stack}>
        {success ? <p className={styles.success}>{success}</p> : null}
        {error ? <p className={styles.error}>{error}</p> : null}

        {readyAwaiting.length > 0 ? (
          <p className={styles.linkedLearnerNote}>
            {readyAwaiting.length} completed intake
            {readyAwaiting.length === 1 ? "" : "s"} waiting for enrolment —{" "}
            <Link href="/administration/enrolments">
              put them on a programme
            </Link>
            .
          </p>
        ) : null}

        {queue.length === 0 ? (
          <p className={styles.empty}>
            No intakes in progress. Start a new learner when you want to get
            ahead on someone.
          </p>
        ) : (
          <div className={styles.employerList}>
            {queue.map((row) => {
              const totals = packTotals(row);
              const blockers = intakeCompletionBlockers(row);
              return (
                <article
                  key={row.id}
                  className={styles.employerCard}
                  data-tone="amber"
                  data-open="false"
                  role="button"
                  tabIndex={0}
                  aria-label={`Continue intake for ${row.displayName}`}
                  onClick={() => resume(row)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      resume(row);
                    }
                  }}
                >
                  <div className={styles.employerCardHeader}>
                    <div className={styles.employerCardMain}>
                      <strong className={styles.employerName}>
                        {row.displayName}
                      </strong>
                      <span>
                        {row.learnerReference}
                        {row.dateOfBirth
                          ? ` · DOB ${formatDate(row.dateOfBirth)}`
                          : ""}
                        {row.town ? ` · ${row.town}` : ""}
                      </span>
                      <span>
                        {blockers.length > 0
                          ? `Next: ${blockers.slice(0, 2).join(", ")}${blockers.length > 2 ? ` and ${blockers.length - 2} more` : ""}`
                          : "Everything logged — ready to sign off"}
                      </span>
                    </div>

                    <div
                      className={styles.employerPillColumn}
                      onClick={(event) => event.stopPropagation()}
                      onKeyDown={(event) => event.stopPropagation()}
                    >
                      <span
                        className={styles.intakeStatusPill}
                        data-status={
                          blockers.length === 0 ? "ready" : "in_progress"
                        }
                      >
                        {blockers.length === 0
                          ? "Ready to sign off"
                          : `${blockers.length} outstanding`}
                      </span>
                      <span
                        className={styles.employerApprenticePill}
                        data-has="false"
                      >
                        {totals.satisfied}/{totals.total} pack items
                      </span>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>
    </LearnerPageShell>
  );
}
