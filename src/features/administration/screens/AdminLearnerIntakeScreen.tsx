"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { LearnerPageShell } from "@/features/learner-portal/components/LearnerPageShell";
import {
  createLearner,
  updateLearner,
  type LearnerInput,
} from "../domain/store";
import {
  awaitingEnrolment,
  missingPersonalFields,
} from "../domain/intake-pack";
import type { AdminLearnerRecord } from "../domain/types";
import { useAdminStore } from "../hooks/useAdminStore";
import styles from "./admin-pages.module.css";

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

function canMarkReady(row: PersonalForm | AdminLearnerRecord): boolean {
  return Boolean(
    row.displayName.trim() && row.dateOfBirth && row.email.trim(),
  );
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
          data-empty={required && !value.trim() ? "true" : "false"}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
        />
      )}
    </label>
  );
}

/**
 * Learner Intake — personal details only. Staff onboarding lives on Management.
 * Progressive pack documents are chased on Learners.
 */
export function AdminLearnerIntakeScreen() {
  const store = useAdminStore();
  const [activeId, setActiveId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [newForm, setNewForm] = useState<PersonalForm>(() =>
    emptyPersonalForm(),
  );
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const enrolledLearnerIds = store.enrolments.map((e) => e.learnerId);

  const queue = [...store.learners]
    .filter((learner) => learner.intakeStatus === "in_progress")
    .sort((a, b) => a.displayName.localeCompare(b.displayName));

  const readyAwaiting = awaitingEnrolment(store.learners, enrolledLearnerIds);

  const active = activeId
    ? (store.learners.find((l) => l.id === activeId) ?? null)
    : null;

  function closeEditor() {
    setActiveId(null);
    setCreating(false);
    setError(null);
  }

  function startNew() {
    setSuccess(null);
    setError(null);
    setNewForm(emptyPersonalForm());
    setActiveId(null);
    setCreating(true);
  }

  function resume(learner: AdminLearnerRecord) {
    setSuccess(null);
    setError(null);
    setCreating(false);
    setActiveId(learner.id);
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
  }

  function completeIntake(learner: AdminLearnerRecord) {
    if (!canMarkReady(learner)) {
      setError(
        "Name, date of birth and email are needed before intake can be marked ready.",
      );
      return;
    }
    updateLearner(learner.id, { intakeStatus: "ready" });
    setSuccess(
      `${learner.displayName} is ready for enrolment. Programme documents are chased on the Learners page.`,
    );
    closeEditor();
  }

  if (creating) {
    return (
      <LearnerPageShell
        eyebrow="Administration · Learner intake"
        title="Start an intake"
        description="Capture who they are so they can be enrolled. Programme documents and progressive pack items live on the Learners page."
      >
        <div className={styles.stack}>
          <section className={styles.formGroup}>
            <div className={styles.formGroupHead}>
              <h2 className={styles.formGroupTitle}>Start an intake</h2>
              <span className={styles.formGroupBadge}>Personal details</span>
            </div>
            <p className={styles.formGroupMeta}>
              Only a name is needed to create the record — save mid-way and come
              back. Once ready, enrol them from Learner Enrolments.
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
                onClick={closeEditor}
              >
                Cancel
              </button>
              <button
                type="button"
                className={styles.primaryBtn}
                onClick={createDraft}
              >
                Save and continue
              </button>
            </div>
          </section>
        </div>
      </LearnerPageShell>
    );
  }

  if (active) {
    const gaps = missingPersonalFields(active).filter((field) =>
      ["full name", "date of birth", "email"].includes(field),
    );

    return (
      <LearnerPageShell
        eyebrow="Administration · Learner intake"
        title={active.displayName}
        description={`${active.learnerReference} · personal details only — pack documents are managed on Learners`}
        actions={
          <div className={styles.toolbarActions}>
            <button
              type="button"
              className={styles.secondaryBtn}
              onClick={() => {
                setSuccess(
                  `Draft saved for ${active.displayName} — pick it back up any time.`,
                );
                closeEditor();
              }}
            >
              Save and close
            </button>
            <button
              type="button"
              className={styles.primaryBtn}
              onClick={() => completeIntake(active)}
            >
              Mark ready for enrolment
            </button>
          </div>
        }
      >
        <div className={styles.stack}>
          {error ? <p className={styles.error}>{error}</p> : null}
          {gaps.length > 0 ? (
            <p className={styles.linkedLearnerNote}>
              Still needed to mark ready: {gaps.join(", ")}.
            </p>
          ) : (
            <p className={styles.linkedLearnerNote}>
              Personal details are complete. Mark ready, then enrol them.
              Training plan, contracts, OTJ logs and the rest of the pack are
              filled on the{" "}
              <Link href="/learners?from=administration">Learners</Link> page
              as they progress.
            </p>
          )}

          <section className={styles.formGroup}>
            <div className={styles.formGroupHead}>
              <h2 className={styles.formGroupTitle}>Personal details</h2>
            </div>
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
                placeholder="Can be added later"
                onCommit={(next) => updateLearner(active.id, { uln: next })}
              />
              <IntakeInlineField
                label="Email"
                value={active.email}
                type="email"
                required
                onCommit={(next) => updateLearner(active.id, { email: next })}
              />
              <IntakeInlineField
                label="Phone"
                value={active.phone}
                type="tel"
                onCommit={(next) => updateLearner(active.id, { phone: next })}
              />
              <IntakeInlineField
                label="Address line 1"
                value={active.addressLine1}
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
                onCommit={(next) =>
                  updateLearner(active.id, { postcode: next })
                }
              />
              <IntakeInlineField
                label="Emergency contact"
                value={active.emergencyContactName}
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
                onCommit={(next) => updateLearner(active.id, { notes: next })}
              />
            </div>
            <div className={styles.formActions}>
              <button
                type="button"
                className={styles.secondaryBtn}
                onClick={closeEditor}
              >
                Back to queue
              </button>
              <button
                type="button"
                className={styles.primaryBtn}
                onClick={() => completeIntake(active)}
              >
                Mark ready for enrolment
              </button>
            </div>
          </section>
        </div>
      </LearnerPageShell>
    );
  }

  return (
    <LearnerPageShell
      eyebrow="Administration"
      title="Learner Intake"
      description="Get potential learners onto the system with personal details. Save drafts mid-way. Programme pack documents are filled on Learners as they progress. Staff onboarding sits on Management."
      actions={
        <button type="button" className={styles.primaryBtn} onClick={startNew}>
          Start new learner
        </button>
      }
    >
      <div className={styles.stack}>
        {success ? <p className={styles.success}>{success}</p> : null}

        {readyAwaiting.length > 0 ? (
          <p className={styles.linkedLearnerNote}>
            {readyAwaiting.length} learner
            {readyAwaiting.length === 1 ? "" : "s"} waiting for enrolment —{" "}
            <Link href="/administration/enrolments">put them on a programme</Link>
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
              const gaps = missingPersonalFields(row).filter((field) =>
                ["full name", "date of birth", "email"].includes(field),
              );
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
                        {gaps.length > 0
                          ? `Still needed: ${gaps.join(", ")}`
                          : "Personal details complete — ready to sign off"}
                      </span>
                    </div>
                    <div className={styles.employerPillColumn}>
                      <span
                        className={styles.intakeStatusPill}
                        data-status={
                          gaps.length === 0 ? "ready" : "in_progress"
                        }
                      >
                        {gaps.length === 0
                          ? "Ready to sign off"
                          : "In progress"}
                      </span>
                      <span
                        className={styles.employerApprenticePill}
                        data-has="false"
                      >
                        Personal details
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
