"use client";

import { useEffect, useMemo, useState } from "react";
import { ApprenticeStatusChip } from "./ApprenticePageShell";
import {
  TRAINING_PLAN_APPRENTICE_SECTIONS,
  TRAINING_PLAN_EMPLOYER_SECTIONS,
  TRAINING_PLAN_PROVIDER_SECTIONS,
  TRAINING_PLAN_SIGNATORY_NOTE,
  type AgreementAudience,
  type AgreementSignature,
  useTrainingPlanAgreementState,
} from "../domain/training-plan-agreement";
import styles from "../screens/apprentice-pages.module.css";

function formatSignedAt(iso: string | null): string {
  if (!iso) return "Pending";
  return new Date(iso).toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

function SignatureSummary({
  title,
  signature,
}: {
  title: string;
  signature: AgreementSignature;
}) {
  return (
    <div className={styles.otjSummaryCard} data-tone={signature.signed ? "green" : "amber"}>
      <p className={styles.glanceLabel}>{title}</p>
      <p className={styles.glanceValue}>{signature.signed ? "Signed" : "Pending"}</p>
      <p className={styles.glanceHint}>
        {signature.signedBy
          ? `${signature.signedBy} · ${formatSignedAt(signature.signedAt)}`
          : "Waiting for confirmation"}
      </p>
    </div>
  );
}

function AgreementSectionList({
  title,
  items,
  intro,
}: {
  title: string;
  items: string[];
  intro?: string;
}) {
  return (
    <section className={styles.section}>
      <h3 className={styles.sectionTitle}>{title}</h3>
      {intro ? <p className={styles.metaBlock}>{intro}</p> : null}
      <ul className={styles.list}>
        {items.map((item, index) => (
          <li key={`${title}-${index}`} className={styles.row}>
            <div className={styles.rowMain}>
              <strong>{index + 1}.</strong>
              <span>{item}</span>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function TrainingPlanAgreementPanel({
  audience,
  apprenticeName,
  employerName,
  employerContact,
  mentorName,
}: {
  audience: AgreementAudience;
  apprenticeName: string;
  employerName: string;
  employerContact: string;
  mentorName: string;
}) {
  const { state, sign, setMentorNote, summary } = useTrainingPlanAgreementState();
  const [confirmTicked, setConfirmTicked] = useState(false);
  const [localNote, setLocalNote] = useState(state.mentor.note);

  useEffect(() => {
    setLocalNote(state.mentor.note);
  }, [state.mentor.note]);

  const audienceLabel = useMemo(() => {
    switch (audience) {
      case "apprentice":
        return "Apprentice";
      case "employer":
        return "Employer";
      default:
        return "Learning & Progress Mentor";
    }
  }, [audience]);

  const canSign =
    confirmTicked &&
    (audience === "apprentice"
      ? !state.apprentice.signed
      : audience === "employer"
        ? !state.employer.signed
        : !state.mentor.signed);

  const mentorReadyMessage =
    !state.apprentice.signed || !state.employer.signed
      ? "Mentor can review now, but final sign-off usually follows apprentice and employer confirmation."
      : "Apprentice and employer have confirmed; mentor can sign and close the agreement.";

  return (
    <div className={styles.stack}>
      <div className={styles.otjHealthBar} data-health={summary.allSigned ? "ahead" : "on_track"}>
        <div className={styles.otjHealthMain}>
          <p className={styles.otjHealthLabel}>Tripartite agreement</p>
          <p className={styles.otjHealthValue}>
            {apprenticeName} · {employerName}
            <span> · {mentorName}</span>
          </p>
          <p className={styles.otjHealthHint}>{TRAINING_PLAN_SIGNATORY_NOTE}</p>
        </div>
        <div className={styles.otjHealthSide}>
          <ApprenticeStatusChip tone={summary.allSigned ? "green" : "amber"}>
            {summary.allSigned ? "Fully signed" : "Awaiting signatures"}
          </ApprenticeStatusChip>
        </div>
      </div>

      <div className={styles.otjSummaryGrid}>
        <SignatureSummary title="Apprentice" signature={state.apprentice} />
        <SignatureSummary title="Employer" signature={state.employer} />
        <SignatureSummary title="Provider / mentor" signature={state.mentor} />
      </div>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Main Provider commitments</h2>
        {TRAINING_PLAN_PROVIDER_SECTIONS.map((section) => (
          <AgreementSectionList
            key={section.id}
            title={section.title}
            intro={section.intro}
            items={section.items}
          />
        ))}
      </section>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Employer commitments</h2>
        {TRAINING_PLAN_EMPLOYER_SECTIONS.map((section) => (
          <AgreementSectionList
            key={section.id}
            title={section.title}
            intro={section.intro}
            items={section.items}
          />
        ))}
      </section>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Apprentice commitments</h2>
        {TRAINING_PLAN_APPRENTICE_SECTIONS.map((section) => (
          <AgreementSectionList
            key={section.id}
            title={section.title}
            intro={section.intro}
            items={section.items}
          />
        ))}
      </section>

      <section className={styles.otjForm}>
        <h2 className={styles.sectionTitle}>{audienceLabel} confirmation</h2>
        {audience === "apprentice" ? (
          <p className={styles.metaBlock}>
            You are confirming that you understand your attendance, off-the-job,
            coursework, review, and EPA-readiness responsibilities within the agreed
            training plan.
          </p>
        ) : audience === "employer" ? (
          <p className={styles.metaBlock}>
            {employerContact} is confirming employer release for off-the-job training,
            workplace support, review participation, and agreement with the training
            plan responsibilities.
          </p>
        ) : (
          <p className={styles.metaBlock}>{mentorReadyMessage}</p>
        )}

        {audience === "mentor" ? (
          <label className={styles.field}>
            <span>Mentor review note</span>
            <textarea
              rows={4}
              value={localNote}
              onChange={(event) => {
                setLocalNote(event.target.value);
                setMentorNote(event.target.value);
              }}
              placeholder="Add any final review comments before signing this training plan."
            />
          </label>
        ) : null}

        <label className={styles.otjConfirm}>
          <input
            type="checkbox"
            checked={confirmTicked}
            onChange={(event) => setConfirmTicked(event.target.checked)}
          />
          <span>
            I have read this training plan commitment section and agree to the
            responsibilities expected of the {audienceLabel.toLowerCase()}.
          </span>
        </label>

        <div className={styles.formActions}>
          <button
            type="button"
            className={styles.primaryBtn}
            disabled={!canSign}
            onClick={() => {
              if (!canSign) return;
              if (audience === "apprentice") sign("apprentice", apprenticeName);
              if (audience === "employer") sign("employer", employerContact);
              if (audience === "mentor") sign("mentor", mentorName, { note: localNote });
            }}
          >
            {audience === "apprentice"
              ? state.apprentice.signed
                ? "Apprentice agreed"
                : "Agree as apprentice"
              : audience === "employer"
                ? state.employer.signed
                  ? "Employer agreed"
                  : "Agree as employer"
                : state.mentor.signed
                  ? "Mentor signed"
                  : "Review and sign"}
          </button>
        </div>
      </section>
    </div>
  );
}
