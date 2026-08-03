"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { ApprenticeStatusChip } from "./ApprenticePageShell";
import {
  AF12_ACADEMIC_YEAR,
  AF12_FORM_CODE,
  AF12_FORM_TITLE,
  AF12_FORM_VERSION,
  AF12_SERIES,
  INTERVIEW_OUTCOME_OPTIONS,
  canSubmitInterviewForm,
  useInterviewFormAf12State,
  type Score1to4,
  type YesNo,
} from "../domain/interview-form-af12";
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

function ScoreField({
  label,
  value,
  onChange,
  disabled,
}: {
  label: string;
  value: Score1to4;
  onChange: (value: Score1to4) => void;
  disabled?: boolean;
}) {
  return (
    <fieldset className={styles.otjFieldset} disabled={disabled}>
      <legend>{label} (1 = Poor · 4 = Excellent)</legend>
      <div className={styles.otjPresetRow}>
        {([1, 2, 3, 4] as const).map((option) => (
          <button
            key={option}
            type="button"
            className={
              value === option ? styles.otjPresetActive : styles.otjPreset
            }
            onClick={() => onChange(option)}
            disabled={disabled}
          >
            {option}
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

export function InterviewFormAf12Panel() {
  const { state, patch, persist, submit, progress, scores } =
    useInterviewFormAf12State();
  const locked = Boolean(state.signedAt);

  return (
    <div className={styles.stack}>
      <div
        className={styles.otjHealthBar}
        data-health={
          progress.status === "complete"
            ? "ahead"
            : progress.status === "in_progress"
              ? "on_track"
              : "behind"
        }
      >
        <div className={styles.otjHealthMain}>
          <p className={styles.otjHealthLabel}>
            {AF12_FORM_CODE} {AF12_FORM_VERSION} · {AF12_SERIES}{" "}
            {AF12_ACADEMIC_YEAR}
          </p>
          <p className={styles.otjHealthValue}>{AF12_FORM_TITLE}</p>
          <p className={styles.otjHealthHint}>
            ADM14 1.3 · Interview for the Apprenticeship Programme (Part 1
            only). LLDD / ALS referrals (old AF1.2 Parts 2–4) live under
            Documents 1.7.
          </p>
        </div>
        <div className={styles.otjHealthSide}>
          <ApprenticeStatusChip
            tone={
              progress.status === "complete"
                ? "green"
                : progress.status === "in_progress"
                  ? "amber"
                  : "blue"
            }
          >
            {progress.status === "complete"
              ? "Submitted"
              : `${progress.percent}% complete`}
          </ApprenticeStatusChip>
          <p className={styles.glanceHint}>
            Interview score {scores.interviewTotal}/{scores.maxInterview}
          </p>
          <p className={styles.glanceHint}>
            Last saved · {formatSavedAt(state.lastSavedAt)}
          </p>
        </div>
      </div>

      <section className={styles.otjForm}>
        <h2 className={styles.sectionTitle}>Interview header</h2>
        <div className={styles.formGrid}>
          <label className={styles.field}>
            Date of interview
            <input
              type="date"
              value={state.interviewDate}
              disabled={locked}
              onChange={(e) => patch({ interviewDate: e.target.value })}
            />
          </label>
          <label className={styles.field}>
            Date of re-interview
            <input
              type="date"
              value={state.reinterviewDate}
              disabled={locked}
              onChange={(e) => patch({ reinterviewDate: e.target.value })}
            />
          </label>
          <label className={styles.field}>
            Interviewer name
            <input
              value={state.interviewerName}
              disabled={locked}
              onChange={(e) => patch({ interviewerName: e.target.value })}
            />
          </label>
        </div>
        <label className={styles.field}>
          Reason(s) for re-interview
          <textarea
            rows={2}
            value={state.reinterviewReasons}
            disabled={locked}
            onChange={(e) => patch({ reinterviewReasons: e.target.value })}
          />
        </label>
      </section>

      <section className={styles.otjForm}>
        <h2 className={styles.sectionTitle}>1 · Candidate details</h2>
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
            Apprenticeship route applied for
            <input
              value={state.apprenticeshipRoute}
              disabled={locked}
              onChange={(e) => patch({ apprenticeshipRoute: e.target.value })}
            />
          </label>
        </div>
      </section>

      <section className={styles.otjForm}>
        <h2 className={styles.sectionTitle}>1.1 · Employer details</h2>
        <p className={styles.metaBlock}>
          Leave blank / mark not applicable and skip if employer section does
          not apply yet.
        </p>
        <YesNoField
          label="Employer details applicable for this interview?"
          value={state.employerApplicable}
          disabled={locked}
          onChange={(value) => patch({ employerApplicable: value })}
        />
        {state.employerApplicable !== "no" ? (
          <>
            <div className={styles.formGrid}>
              <label className={styles.field}>
                Employer name
                <input
                  value={state.employerName}
                  disabled={locked}
                  onChange={(e) => patch({ employerName: e.target.value })}
                />
              </label>
              <label className={styles.field}>
                Employer contact name (if known)
                <input
                  value={state.employerContactName}
                  disabled={locked}
                  onChange={(e) =>
                    patch({ employerContactName: e.target.value })
                  }
                />
              </label>
            </div>
            <label className={styles.field}>
              Employer address
              <textarea
                rows={2}
                value={state.employerAddress}
                disabled={locked}
                onChange={(e) => patch({ employerAddress: e.target.value })}
              />
            </label>
            <YesNoField
              label="Employer Health and Safety inspection required?"
              value={state.employerHsInspectionRequired}
              disabled={locked}
              onChange={(value) =>
                patch({ employerHsInspectionRequired: value })
              }
            />
          </>
        ) : null}
      </section>

      <section className={styles.otjForm}>
        <h2 className={styles.sectionTitle}>
          2 · Apprentice eligibility — identity and right to work
        </h2>
        <YesNoField
          label="2.1 Fully completed apprentice enrolment form, signed declaration, and confirmed right to work in England?"
          value={state.enrolmentFormCompleteSignedRtw}
          disabled={locked}
          onChange={(value) =>
            patch({ enrolmentFormCompleteSignedRtw: value })
          }
        />
        <YesNoField
          label="2.2 Apprentice is 16+ and/or will start after the last Friday in June of the academic year of their 16th birthday?"
          value={state.ageEligible16Plus}
          disabled={locked}
          onChange={(value) => patch({ ageEligible16Plus: value })}
        />
        <div className={styles.formGrid}>
          <label className={styles.field}>
            Last four digits of evidence provided
            <input
              value={state.identityEvidenceLastFour}
              disabled={locked}
              onChange={(e) =>
                patch({ identityEvidenceLastFour: e.target.value })
              }
            />
          </label>
        </div>
        <label className={styles.field}>
          2.3 Primary identity document(s) seen/witnessed
          <textarea
            rows={2}
            value={state.identityPrimarySources}
            disabled={locked}
            onChange={(e) => patch({ identityPrimarySources: e.target.value })}
            placeholder="e.g. British passport"
          />
        </label>
        <label className={styles.field}>
          And/or two secondary sources
          <textarea
            rows={2}
            value={state.identitySecondarySources}
            disabled={locked}
            onChange={(e) =>
              patch({ identitySecondarySources: e.target.value })
            }
          />
        </label>
        <label className={styles.field}>
          Residency and right to work — interviewer comments (required if
          British/Irish passport, birth/adoption certificate, or certificate of
          registration/naturalisation was NOT used)
          <textarea
            rows={3}
            value={state.residencyRightToWorkComments}
            disabled={locked}
            onChange={(e) =>
              patch({ residencyRightToWorkComments: e.target.value })
            }
          />
        </label>
      </section>

      <section className={styles.otjForm}>
        <h2 className={styles.sectionTitle}>3 · Professional discussion</h2>
        <YesNoField
          label="3.1 Attend secondary school?"
          value={state.attendedSecondarySchool}
          disabled={locked}
          onChange={(value) => patch({ attendedSecondarySchool: value })}
        />
        <YesNoField
          label="Attended a school-linked programme (PRU, GTA Alternative Provision or similar)?"
          value={state.attendedLinkedProgramme}
          disabled={locked}
          onChange={(value) => patch({ attendedLinkedProgramme: value })}
        />
        <YesNoField
          label="Previously completed an apprenticeship with the GTA?"
          value={state.previousGtaApprenticeship}
          disabled={locked}
          onChange={(value) => patch({ previousGtaApprenticeship: value })}
        />
        <label className={styles.field}>
          If yes to any above — attendance, conduct/behaviour, achievements
          (may include contacting the provision or GTA tutor report)
          <textarea
            rows={3}
            value={state.previousEducationDetails}
            disabled={locked}
            onChange={(e) =>
              patch({ previousEducationDetails: e.target.value })
            }
          />
        </label>
        <label className={styles.field}>
          3.2 Progress file / certificates — or reason why not
          <textarea
            rows={2}
            value={state.progressFileCertificatesNotes}
            disabled={locked}
            onChange={(e) =>
              patch({ progressFileCertificatesNotes: e.target.value })
            }
          />
        </label>
        <label className={styles.field}>
          3.4 Health and/or learning needs that could be barriers
          <textarea
            rows={3}
            value={state.healthLearningBarriersNotes}
            disabled={locked}
            onChange={(e) =>
              patch({ healthLearningBarriersNotes: e.target.value })
            }
          />
        </label>
        <label className={styles.field}>
          3.5 Describe a time/event where you faced a challenge and how you
          overcame it
          <textarea
            rows={3}
            value={state.challengeOvercameNotes}
            disabled={locked}
            onChange={(e) => patch({ challengeOvercameNotes: e.target.value })}
          />
        </label>
      </section>

      <section className={styles.otjForm}>
        <h2 className={styles.sectionTitle}>
          4 · Questions about the apprenticeship · {scores.section4}/
          {scores.max4}
        </h2>
        {(
          [
            [
              "4.1 How did you find out about the GTA?",
              "q41HowFoundGta",
              "q41Score",
            ],
            [
              "4.2 Why do you want this apprenticeship?",
              "q42WhyWantApprenticeship",
              "q42Score",
            ],
            [
              "4.3 What do you feel will be challenging undertaking an apprenticeship?",
              "q43Challenges",
              "q43Score",
            ],
            [
              "4.4 What type of tasks do you expect during the apprenticeship?",
              "q44ExpectedTasks",
              "q44Score",
            ],
            [
              "4.5 Travel / transport arrangements — what will you use? Need help with routes?",
              "q45TravelArrangements",
              "q45Score",
            ],
            [
              "4.6 How will you ensure you arrive at your place of employment on time?",
              "q46Punctuality",
              "q46Score",
            ],
          ] as const
        ).map(([label, textKey, scoreKey]) => (
          <div key={textKey} className={styles.stack}>
            <label className={styles.field}>
              {label}
              <textarea
                rows={2}
                value={state[textKey]}
                disabled={locked}
                onChange={(e) => patch({ [textKey]: e.target.value })}
              />
            </label>
            <ScoreField
              label="Score"
              value={state[scoreKey]}
              disabled={locked}
              onChange={(value) => patch({ [scoreKey]: value })}
            />
          </div>
        ))}
      </section>

      <section className={styles.otjForm}>
        <h2 className={styles.sectionTitle}>
          5 · Questions about them · {scores.section5}/{scores.max5}
        </h2>
        {(
          [
            [
              "5.1 Personal interests, skills or experiences that would help you succeed?",
              "q51InterestsSkills",
              "q51Score",
            ],
            [
              "5.2 What do you consider is your greatest strength?",
              "q52GreatestStrength",
              "q52Score",
            ],
            [
              "5.3 What do you consider is your greatest area for development?",
              "q53DevelopmentArea",
              "q53Score",
            ],
            ["5.4 What motivates you?", "q54Motivation", "q54Score"],
            [
              "5.5 How do you typically respond to stress or pressure, and what strategies do you use?",
              "q55StressResponse",
              "q55Score",
            ],
          ] as const
        ).map(([label, textKey, scoreKey]) => (
          <div key={textKey} className={styles.stack}>
            <label className={styles.field}>
              {label}
              <textarea
                rows={2}
                value={state[textKey]}
                disabled={locked}
                onChange={(e) => patch({ [textKey]: e.target.value })}
              />
            </label>
            <ScoreField
              label="Score"
              value={state[scoreKey]}
              disabled={locked}
              onChange={(value) => patch({ [scoreKey]: value })}
            />
          </div>
        ))}
        <label className={styles.field}>
          5.6 Preferred learning style — and how this could support your GTA
          trainer
          <textarea
            rows={3}
            value={state.q56LearningStyle}
            disabled={locked}
            onChange={(e) => patch({ q56LearningStyle: e.target.value })}
          />
        </label>
      </section>

      <section className={styles.otjForm}>
        <h2 className={styles.sectionTitle}>
          6 · Questions for interviewer · {scores.section6}/{scores.max6}
        </h2>
        {(
          [
            ["6.1 Confidence e.g. eye contact", "q61Confidence", "q61Score"],
            [
              "6.2 Positive attitude / enthusiasm?",
              "q62Attitude",
              "q62Score",
            ],
            [
              "6.3 Appearance / presentation?",
              "q63Appearance",
              "q63Score",
            ],
            [
              "6.4 Conversation flow / interactions?",
              "q64Conversation",
              "q64Score",
            ],
            [
              "6.5 Aspirations / personal development goals?",
              "q65Aspirations",
              "q65Score",
            ],
          ] as const
        ).map(([label, textKey, scoreKey]) => (
          <div key={textKey} className={styles.stack}>
            <label className={styles.field}>
              {label} — comments
              <textarea
                rows={2}
                value={state[textKey]}
                disabled={locked}
                onChange={(e) => patch({ [textKey]: e.target.value })}
              />
            </label>
            <ScoreField
              label="Score"
              value={state[scoreKey]}
              disabled={locked}
              onChange={(value) => patch({ [scoreKey]: value })}
            />
          </div>
        ))}
      </section>

      <section className={styles.otjForm}>
        <h2 className={styles.sectionTitle}>7 · Initial &amp; diagnostic assessment</h2>
        <p className={styles.metaBlock}>
          Expected minimum: Level 2 apprenticeship Entry Level 3.5 · Level 3
          apprenticeship Level 1 · Following instructions 6/10.
        </p>
        <div className={styles.formGrid}>
          <label className={styles.field}>
            Maths
            <input
              value={state.mathsScore}
              disabled={locked}
              onChange={(e) => patch({ mathsScore: e.target.value })}
            />
          </label>
          <label className={styles.field}>
            English
            <input
              value={state.englishScore}
              disabled={locked}
              onChange={(e) => patch({ englishScore: e.target.value })}
            />
          </label>
          <label className={styles.field}>
            Following instructions
            <input
              value={state.followingInstructionsScore}
              disabled={locked}
              onChange={(e) =>
                patch({ followingInstructionsScore: e.target.value })
              }
            />
          </label>
          <label className={styles.field}>
            Total score
            <input
              value={state.diagnosticTotal}
              disabled={locked}
              onChange={(e) => patch({ diagnosticTotal: e.target.value })}
            />
          </label>
        </div>
      </section>

      <section className={styles.otjForm}>
        <h2 className={styles.sectionTitle}>
          8 · Recognition of prior learning (RPLE)
        </h2>
        <YesNoField
          label="8.1 Prior work experience and/or qualifications relevant to this apprenticeship — any suggestion RPLE could be applied?"
          value={state.rpleRelevantPrior}
          disabled={locked}
          onChange={(value) => patch({ rpleRelevantPrior: value })}
        />
        <label className={styles.field}>
          RPLE details
          <textarea
            rows={2}
            value={state.rpleDetails}
            disabled={locked}
            onChange={(e) => patch({ rpleDetails: e.target.value })}
          />
        </label>
        <YesNoField
          label="8.2 Maths exemption criteria met (from PLR / evidence)?"
          value={state.mathsExemptionMet}
          disabled={locked}
          onChange={(value) => patch({ mathsExemptionMet: value })}
        />
        {state.mathsExemptionMet === "yes" ? (
          <label className={styles.field}>
            Maths qualification / exemption details
            <textarea
              rows={2}
              value={state.mathsExemptionDetails}
              disabled={locked}
              onChange={(e) =>
                patch({ mathsExemptionDetails: e.target.value })
              }
            />
          </label>
        ) : null}
        <YesNoField
          label="8.3 English exemption criteria met (from PLR / evidence)?"
          value={state.englishExemptionMet}
          disabled={locked}
          onChange={(value) => patch({ englishExemptionMet: value })}
        />
        {state.englishExemptionMet === "yes" ? (
          <label className={styles.field}>
            English qualification / exemption details
            <textarea
              rows={2}
              value={state.englishExemptionDetails}
              disabled={locked}
              onChange={(e) =>
                patch({ englishExemptionDetails: e.target.value })
              }
            />
          </label>
        ) : null}
        <label className={styles.field}>
          8.4 Highest level of existing prior attainment (PLR / certificates)
          <input
            value={state.highestPriorAttainment}
            disabled={locked}
            onChange={(e) =>
              patch({ highestPriorAttainment: e.target.value })
            }
          />
        </label>
        <YesNoField
          label="8.5 Potential for RPLE based on work experience, qualifications, knowledge, skills or behaviours identified?"
          value={state.rplePotentialConfirmation}
          disabled={locked}
          onChange={(value) => patch({ rplePotentialConfirmation: value })}
        />
        <label className={styles.field}>
          Confirmation notes
          <textarea
            rows={2}
            value={state.rpleConfirmationNotes}
            disabled={locked}
            onChange={(e) => patch({ rpleConfirmationNotes: e.target.value })}
          />
        </label>
      </section>

      <section className={styles.otjForm}>
        <h2 className={styles.sectionTitle}>9 · LLDD review (flags only)</h2>
        <p className={styles.metaBlock}>
          LLDD / ALS detailed forms were attached to the paper AF1.2 pack but
          belong on ADM14 <strong>1.7</strong>. Use these flags to trigger that
          assessment — do not complete Parts 2–4 here.
        </p>
        <YesNoField
          label="9.1 Apprentice indicated LLDD via interview and/or enrolment that may require an Additional Learning Support assessment?"
          value={state.needsAlsAssessment}
          disabled={locked}
          onChange={(value) => patch({ needsAlsAssessment: value })}
        />
        <YesNoField
          label="9.2 Apprentice indicated LLDD that may require a health and safety risk assessment review?"
          value={state.needsHsRiskAssessment}
          disabled={locked}
          onChange={(value) => patch({ needsHsRiskAssessment: value })}
        />
        {(state.needsAlsAssessment === "yes" ||
          state.needsHsRiskAssessment === "yes" ||
          state.employerHsInspectionRequired === "yes") && (
          <Link
            href="/apprentice/documents/eligibility/1.7"
            className={styles.primaryBtn}
            style={{ alignSelf: "flex-start", textDecoration: "none" }}
          >
            Open ALS / LLDD assessment (1.7) →
          </Link>
        )}
      </section>

      <section className={styles.otjForm}>
        <h2 className={styles.sectionTitle}>10 · Interview evaluation &amp; outcome</h2>
        <div className={styles.grid}>
          <div className={styles.glance} data-tone="navy">
            <p className={styles.glanceLabel}>Section 4</p>
            <p className={styles.glanceValueSmall}>
              {scores.section4}/{scores.max4}
            </p>
          </div>
          <div className={styles.glance} data-tone="navy">
            <p className={styles.glanceLabel}>Section 5</p>
            <p className={styles.glanceValueSmall}>
              {scores.section5}/{scores.max5}
            </p>
          </div>
          <div className={styles.glance} data-tone="navy">
            <p className={styles.glanceLabel}>Section 6</p>
            <p className={styles.glanceValueSmall}>
              {scores.section6}/{scores.max6}
            </p>
          </div>
          <div className={styles.glance} data-tone="green">
            <p className={styles.glanceLabel}>Interview total</p>
            <p className={styles.glanceValueSmall}>
              {scores.interviewTotal}/{scores.maxInterview}
            </p>
          </div>
        </div>
        <fieldset className={styles.otjFieldset} disabled={locked}>
          <legend>Interview outcome</legend>
          <div className={styles.choiceStack}>
            {INTERVIEW_OUTCOME_OPTIONS.map((option) => (
              <label key={option.value} className={styles.checkRow}>
                <input
                  type="radio"
                  name="interviewOutcome"
                  disabled={locked}
                  checked={state.interviewOutcome === option.value}
                  onChange={() => patch({ interviewOutcome: option.value })}
                />
                <span>{option.label}</span>
              </label>
            ))}
          </div>
        </fieldset>
        <label className={styles.field}>
          Summary / next steps
          <textarea
            rows={4}
            value={state.summaryNextSteps}
            disabled={locked}
            onChange={(e) => patch({ summaryNextSteps: e.target.value })}
          />
        </label>
        <CheckRow
          checked={state.interviewerDeclarationConfirmed}
          disabled={locked}
          onChange={(checked) =>
            patch({ interviewerDeclarationConfirmed: checked })
          }
        >
          On behalf of the GTA, I have reviewed the applicant&apos;s
          identification, evidence of residency and right to work in England and
          confirm they are eligible for funding in accordance with DfE
          Apprenticeship Funding Rules 2025/26 in relation to residency and
          right to work (further eligibility criteria may still apply).
        </CheckRow>
        <label className={styles.field}>
          Interviewer signature (full name)
          <input
            value={state.interviewerSignatureName}
            disabled={locked}
            onChange={(e) =>
              patch({ interviewerSignatureName: e.target.value })
            }
            placeholder="Type full name to sign"
          />
        </label>
        {state.signedAt ? (
          <p className={styles.metaBlock}>
            Submitted {formatSavedAt(state.signedAt)} by{" "}
            {state.interviewerSignatureName}. Form is locked — contact GTA admin
            if a correction is needed.
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
            disabled={locked || !canSubmitInterviewForm(state)}
            onClick={() => submit()}
          >
            Submit interview form
          </button>
        </div>
      </section>
    </div>
  );
}
