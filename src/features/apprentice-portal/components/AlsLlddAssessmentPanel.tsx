"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { ApprenticeStatusChip } from "./ApprenticePageShell";
import {
  ALS_INTERVIEW_AREAS,
  ALS_LLDD_ADM14_REFERENCE,
  ALS_LLDD_FORM_CODE,
  ALS_LLDD_FORM_TITLE,
  ALS_SOFT_SKILLS,
  canSubmitAlsLldd,
  useAlsLlddState,
  type YesNo,
} from "../domain/als-lldd-form";
import styles from "../screens/apprentice-pages.module.css";

function YesNoField({
  label,
  value,
  onChange,
  disabled,
}: {
  label: string;
  value: YesNo;
  onChange: (value: YesNo) => void;
  disabled?: boolean;
}) {
  return (
    <fieldset className={styles.otjFieldset} disabled={disabled}>
      <legend>{label}</legend>
      <div className={styles.otjPresetRow}>
        {(["yes", "no"] as const).map((option) => (
          <button
            key={option}
            type="button"
            className={
              value === option ? styles.otjPresetActive : styles.otjPreset
            }
            onClick={() => onChange(option)}
            disabled={disabled}
          >
            {option === "yes" ? "Yes" : "No"}
          </button>
        ))}
      </div>
    </fieldset>
  );
}

function CheckRow({
  checked,
  onChange,
  children,
  disabled,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  children: ReactNode;
  disabled?: boolean;
}) {
  return (
    <label className={styles.checkRow}>
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(event) => onChange(event.target.checked)}
      />
      <span>{children}</span>
    </label>
  );
}

function formatSavedAt(iso: string | null) {
  if (!iso) return "Not saved yet";
  return new Date(iso).toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

export function AlsLlddAssessmentPanel() {
  const { state, patch, persist, submit, refreshFromPrior, progress } =
    useAlsLlddState();
  const locked = Boolean(state.signedAt);

  function toggleListItem(
    key: "alsReferralInterviewAreas" | "alsSoftSkills",
    value: string,
  ) {
    const current = state[key];
    const exists = current.includes(value);
    patch({
      [key]: exists
        ? current.filter((item) => item !== value)
        : [...current, value],
    });
  }

  return (
    <div className={styles.stack}>
      <div
        className={styles.otjHealthBar}
        data-health={
          progress.status === "complete" || progress.status === "not_applicable"
            ? "ahead"
            : progress.status === "in_progress"
              ? "on_track"
              : "behind"
        }
      >
        <div className={styles.otjHealthMain}>
          <p className={styles.otjHealthLabel}>
            {ALS_LLDD_FORM_CODE} · ADM14 {ALS_LLDD_ADM14_REFERENCE}
          </p>
          <p className={styles.otjHealthValue}>{ALS_LLDD_FORM_TITLE}</p>
          <p className={styles.otjHealthHint}>
            Moved from the AF1.2 interview PDF attachments (Parts 2–4). The
            final guidance page is not used in the portal. Flags from interview
            section 9 prefill these referrals.
          </p>
        </div>
        <div className={styles.otjHealthSide}>
          <ApprenticeStatusChip
            tone={
              progress.status === "complete" ||
              progress.status === "not_applicable"
                ? "green"
                : progress.status === "in_progress"
                  ? "amber"
                  : "blue"
            }
          >
            {progress.status === "not_applicable"
              ? "Not applicable"
              : progress.status === "complete"
                ? "Submitted"
                : `${progress.percent}% complete`}
          </ApprenticeStatusChip>
          <p className={styles.glanceHint}>
            Last saved · {formatSavedAt(state.lastSavedAt)}
          </p>
        </div>
      </div>

      <div className={styles.otjChipRow}>
        <button
          type="button"
          className={styles.ghostBtn}
          disabled={locked}
          onClick={() => refreshFromPrior()}
        >
          Refresh from interview / enrolment
        </button>
        <Link
          href="/apprentice/documents/eligibility/1.3"
          className={styles.ghostBtn}
        >
          AF1.2 Interview (Part 1)
        </Link>
      </div>

      <section className={styles.otjForm}>
        <h2 className={styles.sectionTitle}>Linked apprentice</h2>
        <div className={styles.formGrid}>
          <label className={styles.field}>
            Candidate name
            <input
              value={state.candidateName}
              disabled={locked}
              onChange={(e) => patch({ candidateName: e.target.value })}
            />
          </label>
          <label className={styles.field}>
            Apprenticeship route
            <input
              value={state.apprenticeshipRoute}
              disabled={locked}
              onChange={(e) => patch({ apprenticeshipRoute: e.target.value })}
            />
          </label>
        </div>
        <YesNoField
          label="Requires ALS / Learning Support assessment (Part 2)?"
          value={state.requiresAlsAssessment}
          disabled={locked}
          onChange={(value) => patch({ requiresAlsAssessment: value })}
        />
        <YesNoField
          label="Requires employer H&S visit request (Part 3)?"
          value={state.requiresEmployerHsVisit}
          disabled={locked}
          onChange={(value) => patch({ requiresEmployerHsVisit: value })}
        />
        <YesNoField
          label="Requires H&S risk assessment for LLDD (Part 4)?"
          value={state.requiresHsRiskAssessment}
          disabled={locked}
          onChange={(value) => patch({ requiresHsRiskAssessment: value })}
        />
      </section>

      {state.requiresAlsAssessment === "yes" ? (
        <section className={styles.otjForm}>
          <h2 className={styles.sectionTitle}>
            Part 2 · ALS / LLDD learning assessment request
          </h2>
          <div className={styles.formGrid}>
            <label className={styles.field}>
              Referral raised by
              <input
                value={state.alsRaisedBy}
                disabled={locked}
                onChange={(e) => patch({ alsRaisedBy: e.target.value })}
              />
            </label>
            <label className={styles.field}>
              Date
              <input
                type="date"
                value={state.alsRaisedDate}
                disabled={locked}
                onChange={(e) => patch({ alsRaisedDate: e.target.value })}
              />
            </label>
          </div>
          <fieldset className={styles.otjFieldset} disabled={locked}>
            <legend>Interview area(s) of referral</legend>
            <div className={styles.choiceStack}>
              {ALS_INTERVIEW_AREAS.map((area) => (
                <CheckRow
                  key={area}
                  checked={state.alsReferralInterviewAreas.includes(area)}
                  disabled={locked}
                  onChange={() =>
                    toggleListItem("alsReferralInterviewAreas", area)
                  }
                >
                  {area}
                </CheckRow>
              ))}
            </div>
          </fieldset>
          <label className={styles.field}>
            Details of the referral
            <textarea
              rows={3}
              value={state.alsReferralDetails}
              disabled={locked}
              onChange={(e) => patch({ alsReferralDetails: e.target.value })}
            />
          </label>
          <label className={styles.field}>
            Details of support / action plan
            <textarea
              rows={3}
              value={state.alsSupportActionPlan}
              disabled={locked}
              onChange={(e) => patch({ alsSupportActionPlan: e.target.value })}
            />
          </label>
          <fieldset className={styles.otjFieldset} disabled={locked}>
            <legend>Linked soft skills</legend>
            <div className={styles.choiceStack}>
              {ALS_SOFT_SKILLS.map((skill) => (
                <CheckRow
                  key={skill}
                  checked={state.alsSoftSkills.includes(skill)}
                  disabled={locked}
                  onChange={() => toggleListItem("alsSoftSkills", skill)}
                >
                  {skill}
                </CheckRow>
              ))}
            </div>
          </fieldset>
          <label className={styles.field}>
            Notes
            <textarea
              rows={2}
              value={state.alsNotes}
              disabled={locked}
              onChange={(e) => patch({ alsNotes: e.target.value })}
            />
          </label>
          <YesNoField
            label="1. Does the apprentice require a full Learning Support Assessment to review barriers to learning?"
            value={state.alsRequiresFullAssessment}
            disabled={locked}
            onChange={(value) => patch({ alsRequiresFullAssessment: value })}
          />
          <YesNoField
            label="2. Can the extra support/training be delivered alongside the apprenticeship without impacting the delivery model?"
            value={state.alsCanDeliverAlongside}
            disabled={locked}
            onChange={(value) => patch({ alsCanDeliverAlongside: value })}
          />
          <p className={styles.metaBlock}>
            If question 2 is Yes, the apprentice can continue and work on actions
            during the apprenticeship. If No, support/actions must be completed
            before the interview process restarts.
          </p>
          <div className={styles.formGrid}>
            <label className={styles.field}>
              Referral outcome
              <input
                value={state.alsReferralOutcome}
                disabled={locked}
                onChange={(e) => patch({ alsReferralOutcome: e.target.value })}
              />
            </label>
            <label className={styles.field}>
              Assessor signature
              <input
                value={state.alsAssessorSignature}
                disabled={locked}
                onChange={(e) =>
                  patch({ alsAssessorSignature: e.target.value })
                }
              />
            </label>
            <label className={styles.field}>
              Assessor date
              <input
                type="date"
                value={state.alsAssessorDate}
                disabled={locked}
                onChange={(e) => patch({ alsAssessorDate: e.target.value })}
              />
            </label>
          </div>
        </section>
      ) : null}

      {state.requiresEmployerHsVisit === "yes" ? (
        <section className={styles.otjForm}>
          <h2 className={styles.sectionTitle}>
            Part 3 · Employer health and safety visit request
          </h2>
          <div className={styles.formGrid}>
            <label className={styles.field}>
              Raised by
              <input
                value={state.part3RaisedBy}
                disabled={locked}
                onChange={(e) => patch({ part3RaisedBy: e.target.value })}
              />
            </label>
            <label className={styles.field}>
              Date
              <input
                type="date"
                value={state.part3RaisedDate}
                disabled={locked}
                onChange={(e) => patch({ part3RaisedDate: e.target.value })}
              />
            </label>
            <label className={styles.field}>
              Employer name
              <input
                value={state.part3EmployerName}
                disabled={locked}
                onChange={(e) => patch({ part3EmployerName: e.target.value })}
              />
            </label>
            <label className={styles.field}>
              Employer contact name
              <input
                value={state.part3EmployerContact}
                disabled={locked}
                onChange={(e) =>
                  patch({ part3EmployerContact: e.target.value })
                }
              />
            </label>
          </div>
          <label className={styles.field}>
            Employer address
            <textarea
              rows={2}
              value={state.part3EmployerAddress}
              disabled={locked}
              onChange={(e) => patch({ part3EmployerAddress: e.target.value })}
            />
          </label>
          <p className={styles.metaBlock}>
            Paper form used “send email” to request a GTA H&S Officer visit —
            email automation can be wired later.
          </p>
        </section>
      ) : null}

      {state.requiresHsRiskAssessment === "yes" ? (
        <section className={styles.otjForm}>
          <h2 className={styles.sectionTitle}>
            Part 4 · Health and safety risk assessment request (LLDD)
          </h2>
          <div className={styles.formGrid}>
            <label className={styles.field}>
              Raised by
              <input
                value={state.part4RaisedBy}
                disabled={locked}
                onChange={(e) => patch({ part4RaisedBy: e.target.value })}
              />
            </label>
            <label className={styles.field}>
              Date
              <input
                type="date"
                value={state.part4RaisedDate}
                disabled={locked}
                onChange={(e) => patch({ part4RaisedDate: e.target.value })}
              />
            </label>
            <label className={styles.field}>
              Employer name (if applicable)
              <input
                value={state.part4EmployerName}
                disabled={locked}
                onChange={(e) => patch({ part4EmployerName: e.target.value })}
              />
            </label>
            <label className={styles.field}>
              Employer contact name
              <input
                value={state.part4EmployerContact}
                disabled={locked}
                onChange={(e) =>
                  patch({ part4EmployerContact: e.target.value })
                }
              />
            </label>
          </div>
          <label className={styles.field}>
            Employer address
            <textarea
              rows={2}
              value={state.part4EmployerAddress}
              disabled={locked}
              onChange={(e) => patch({ part4EmployerAddress: e.target.value })}
            />
          </label>
        </section>
      ) : null}

      <section className={styles.otjForm}>
        <h2 className={styles.sectionTitle}>Submit ALS / LLDD pack</h2>
        <label className={styles.field}>
          Assessor / staff signature (full name)
          <input
            value={state.signatureName}
            disabled={locked}
            onChange={(e) => patch({ signatureName: e.target.value })}
            placeholder="Type full name to sign"
          />
        </label>
        {state.signedAt ? (
          <p className={styles.metaBlock}>
            Submitted {formatSavedAt(state.signedAt)} by {state.signatureName}.
          </p>
        ) : null}
        <div className={styles.otjChipRow}>
          <button
            type="button"
            className={styles.ghostBtn}
            disabled={locked}
            onClick={() => persist()}
          >
            Save draft
          </button>
          <button
            type="button"
            className={styles.primaryBtn}
            disabled={locked || !canSubmitAlsLldd(state)}
            onClick={() => submit()}
          >
            Submit ALS / LLDD assessment
          </button>
        </div>
      </section>
    </div>
  );
}
