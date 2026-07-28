"use client";

import Link from "next/link";
import { LearnerStatusChip } from "./LearnerPageShell";
import {
  EMPLOYER_FUNDING_OPTIONS,
  RPLE_ADM14_REFERENCE,
  RPLE_SCORE_OPTIONS,
  canSubmitRple,
  programmeLabel,
  scoreKey,
  useRpleAssessmentState,
  type RpleScore,
} from "../domain/rple-form";
import styles from "../screens/learner-pages.module.css";

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

function YesNoAnswerRow({
  question,
  answer,
  comment,
  disabled,
  onAnswer,
  onComment,
}: {
  question: string;
  answer: "yes" | "no" | "";
  comment: string;
  disabled?: boolean;
  onAnswer: (value: "yes" | "no") => void;
  onComment: (value: string) => void;
}) {
  return (
    <div className={styles.stack}>
      <fieldset className={styles.otjFieldset} disabled={disabled}>
        <legend>{question}</legend>
        <div className={styles.otjPresetRow}>
          {(["yes", "no"] as const).map((option) => (
            <button
              key={option}
              type="button"
              className={
                answer === option ? styles.otjPresetActive : styles.otjPreset
              }
              disabled={disabled}
              onClick={() => onAnswer(option)}
            >
              {option === "yes" ? "Yes" : "No"}
            </button>
          ))}
        </div>
      </fieldset>
      <label className={styles.field}>
        Assessor comments
        <textarea
          rows={2}
          value={comment}
          disabled={disabled}
          onChange={(e) => onComment(e.target.value)}
        />
      </label>
    </div>
  );
}

export function RpleAssessmentPanel() {
  const {
    state,
    programme,
    resolvedKey,
    patch,
    setScore,
    setItemComment,
    setYesNo,
    persist,
    submit,
    refreshFromPrior,
    progress,
    averageScore,
  } = useRpleAssessmentState();

  const locked = Boolean(state.signedAt);
  const reductionPercent = Math.round(averageScore * 100);

  if (!state.programmeKey && !resolvedKey) {
    return (
      <div className={styles.stack}>
        <div className={styles.otjSummaryCard} data-tone="amber">
          <p className={styles.glanceLabel}>Course not selected yet</p>
          <p className={styles.metaBlock}>
            Complete <strong>AF1.1 Learner Enrolment Form</strong> and choose
            the apprenticeship programme first. The correct RPLE assessment
            (AF1.30–AF1.35) is selected automatically from that choice.
          </p>
          <p className={styles.glanceHint}>
            <Link href="/learner/documents/eligibility/1.2" className={styles.linkish}>
              Open enrolment form →
            </Link>
          </p>
        </div>
      </div>
    );
  }

  if (programme && !programme.available) {
    return (
      <div className={styles.stack}>
        <div className={styles.otjHealthBar} data-health="behind">
          <div className={styles.otjHealthMain}>
            <p className={styles.otjHealthLabel}>
              RPLE · {programmeLabel(state.programmeKey || resolvedKey)}
            </p>
            <p className={styles.otjHealthValue}>Workbook not supplied yet</p>
            <p className={styles.otjHealthHint}>
              ADM14 {RPLE_ADM14_REFERENCE} · {programme.stubNote}
            </p>
          </div>
          <LearnerStatusChip tone="amber">Stub</LearnerStatusChip>
        </div>
        <div className={styles.otjSummaryCard} data-tone="navy">
          <p className={styles.metaBlock}>
            Learner is on{" "}
            <strong>{programmeLabel(state.programmeKey || resolvedKey)}</strong>.
            Header details can still flow from enrolment / interview once the
            AF1.x RPLE Excel for this route is provided.
          </p>
          <button
            type="button"
            className={styles.ghostBtn}
            onClick={() => refreshFromPrior()}
          >
            Refresh from enrolment / interview
          </button>
        </div>
      </div>
    );
  }

  if (!programme) {
    return (
      <div className={styles.otjSummaryCard} data-tone="amber">
        <p className={styles.metaBlock}>
          No RPLE template found for this programme key.
        </p>
      </div>
    );
  }

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
            {programme.formCode} {programme.formVersion}
            {programme.academicYear ? ` · ${programme.academicYear}` : ""}
          </p>
          <p className={styles.otjHealthValue}>{programme.standardTitle}</p>
          <p className={styles.otjHealthHint}>
            ADM14 {RPLE_ADM14_REFERENCE} · Auto-selected from AF1.1 course
            choice ({programmeLabel(state.programmeKey)}). Scores 0–100% in 10%
            steps against standard KSBs.
          </p>
        </div>
        <div className={styles.otjHealthSide}>
          <LearnerStatusChip
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
          </LearnerStatusChip>
          <p className={styles.glanceHint}>
            Avg prior learning {reductionPercent}%
          </p>
          <p className={styles.glanceHint}>
            Last saved · {formatSavedAt(state.lastSavedAt)}
          </p>
        </div>
      </div>

      <div className={styles.grid}>
        <div className={styles.glance} data-tone="navy">
          <p className={styles.glanceLabel}>Standard</p>
          <p className={styles.glanceValueSmall}>
            {programme.standardRef || "—"}
          </p>
          <p className={styles.glanceHint}>
            v{programme.standardVersion || "—"}
          </p>
        </div>
        <div className={styles.glance} data-tone="blue">
          <p className={styles.glanceLabel}>KSB items</p>
          <p className={styles.glanceValue}>{programme.itemCount}</p>
          <p className={styles.glanceHint}>{programme.groups.length} groups</p>
        </div>
        {programme.funding.maxBand ? (
          <div className={styles.glance} data-tone="green">
            <p className={styles.glanceLabel}>Max funding band</p>
            <p className={styles.glanceValueSmall}>
              £{programme.funding.maxBand.toLocaleString("en-GB")}
            </p>
            <p className={styles.glanceHint}>
              OTJ hrs {programme.funding.otjHoursRequired ?? "—"}
            </p>
          </div>
        ) : null}
      </div>

      <div className={styles.otjChipRow}>
        <button
          type="button"
          className={styles.ghostBtn}
          disabled={locked}
          onClick={() => refreshFromPrior()}
        >
          Refresh from enrolment / interview
        </button>
        <Link
          href="/learner/documents/eligibility/1.2"
          className={styles.ghostBtn}
        >
          AF1.1 Enrolment
        </Link>
        <Link
          href="/learner/documents/eligibility/1.3"
          className={styles.ghostBtn}
        >
          AF1.2 Interview
        </Link>
      </div>

      <section className={styles.otjForm}>
        <h2 className={styles.sectionTitle}>Learner summary</h2>
        <div className={styles.formGrid}>
          <label className={styles.field}>
            Learner name
            <input
              value={state.learnerName}
              disabled={locked}
              onChange={(e) => patch({ learnerName: e.target.value })}
            />
          </label>
          <label className={styles.field}>
            Date of birth
            <input
              type="date"
              value={state.dateOfBirth}
              disabled={locked}
              onChange={(e) => patch({ dateOfBirth: e.target.value })}
            />
          </label>
          <label className={styles.field}>
            Employer name
            <input
              value={state.employerName}
              disabled={locked}
              onChange={(e) => patch({ employerName: e.target.value })}
            />
          </label>
          <label className={styles.field}>
            Line manager
            <input
              value={state.lineManagerName}
              disabled={locked}
              onChange={(e) => patch({ lineManagerName: e.target.value })}
            />
          </label>
          <label className={styles.field}>
            Date of discussion
            <input
              type="date"
              value={state.discussionDate}
              disabled={locked}
              onChange={(e) => patch({ discussionDate: e.target.value })}
            />
          </label>
          <label className={styles.field}>
            Assessor name
            <input
              value={state.assessorName}
              disabled={locked}
              onChange={(e) => patch({ assessorName: e.target.value })}
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
        <fieldset className={styles.otjFieldset} disabled={locked}>
          <legend>Employer funding type</legend>
          <div className={styles.choiceStack}>
            {EMPLOYER_FUNDING_OPTIONS.map((option) => (
              <label key={option.value} className={styles.checkRow}>
                <input
                  type="radio"
                  name="employerType"
                  disabled={locked}
                  checked={state.employerType === option.value}
                  onChange={() => patch({ employerType: option.value })}
                />
                <span>{option.label}</span>
              </label>
            ))}
          </div>
        </fieldset>
      </section>

      {programme.eligibilityQuestions.length > 0 ? (
        <section className={styles.otjForm}>
          <h2 className={styles.sectionTitle}>Learner eligibility check</h2>
          {programme.eligibilityQuestions.map((q) => {
            const row = state.eligibility[q.id] ?? {
              answer: "" as const,
              comment: "",
            };
            return (
              <YesNoAnswerRow
                key={q.id}
                question={q.question}
                answer={row.answer}
                comment={row.comment}
                disabled={locked}
                onAnswer={(answer) =>
                  setYesNo("eligibility", q.id, { ...row, answer })
                }
                onComment={(comment) =>
                  setYesNo("eligibility", q.id, { ...row, comment })
                }
              />
            );
          })}
        </section>
      ) : null}

      {programme.assessmentQuestions.length > 0 ? (
        <section className={styles.otjForm}>
          <h2 className={styles.sectionTitle}>Assessment questions</h2>
          {programme.assessmentQuestions.map((q) => {
            const row = state.assessment[q.id] ?? {
              answer: "" as const,
              comment: "",
            };
            return (
              <YesNoAnswerRow
                key={q.id}
                question={q.question}
                answer={row.answer}
                comment={row.comment}
                disabled={locked}
                onAnswer={(answer) =>
                  setYesNo("assessment", q.id, { ...row, answer })
                }
                onComment={(comment) =>
                  setYesNo("assessment", q.id, { ...row, comment })
                }
              />
            );
          })}
        </section>
      ) : null}

      {programme.supportQuestions.length > 0 ? (
        <section className={styles.otjForm}>
          <h2 className={styles.sectionTitle}>
            Programme eligibility &amp; support needs
          </h2>
          {programme.supportQuestions.map((q) => {
            const row = state.support[q.id] ?? {
              answer: "" as const,
              comment: "",
            };
            return (
              <YesNoAnswerRow
                key={q.id}
                question={q.question}
                answer={row.answer}
                comment={row.comment}
                disabled={locked}
                onAnswer={(answer) =>
                  setYesNo("support", q.id, { ...row, answer })
                }
                onComment={(comment) =>
                  setYesNo("support", q.id, { ...row, comment })
                }
              />
            );
          })}
        </section>
      ) : null}

      <section className={styles.otjForm}>
        <h2 className={styles.sectionTitle}>
          Record of employer discussion / RPLE notes
        </h2>
        <label className={styles.field}>
          Notes
          <textarea
            rows={4}
            value={state.employerDiscussionNotes}
            disabled={locked}
            onChange={(e) =>
              patch({ employerDiscussionNotes: e.target.value })
            }
          />
        </label>
        <fieldset className={styles.otjFieldset} disabled={locked}>
          <legend>Has RPLE been identified for this learner?</legend>
          <div className={styles.otjPresetRow}>
            {(["yes", "no"] as const).map((option) => (
              <button
                key={option}
                type="button"
                className={
                  state.rpleIdentified === option
                    ? styles.otjPresetActive
                    : styles.otjPreset
                }
                disabled={locked}
                onClick={() => patch({ rpleIdentified: option })}
              >
                {option === "yes" ? "Yes" : "No"}
              </button>
            ))}
          </div>
        </fieldset>
        <label className={styles.field}>
          {state.rpleIdentified === "no"
            ? "If no RPLE identified, provide justification"
            : "RPLE summary / justification"}
          <textarea
            rows={3}
            value={state.rpleJustification}
            disabled={locked}
            onChange={(e) => patch({ rpleJustification: e.target.value })}
          />
        </label>
      </section>

      {programme.groups.map((group) => (
        <section key={group.id} className={styles.otjForm}>
          <h2 className={styles.sectionTitle}>
            {group.title}{" "}
            <span className={styles.glanceHint}>
              ({group.items.length} items)
            </span>
          </h2>
          <ul className={styles.list}>
            {group.items.map((item) => {
              const key = scoreKey(group.id, item.code);
              const score = state.scores[key];
              const comment = state.comments[key] ?? "";
              return (
                <li key={key} className={styles.row}>
                  <div className={styles.stack} style={{ width: "100%" }}>
                    <div className={styles.rowMain}>
                      <strong>
                        {item.code} · {item.kind}
                      </strong>
                      <span>{item.text}</span>
                    </div>
                    <fieldset className={styles.otjFieldset} disabled={locked}>
                      <legend>Extent of prior learning</legend>
                      <div className={styles.otjPresetRow}>
                        {RPLE_SCORE_OPTIONS.map((option) => (
                          <button
                            key={option.value}
                            type="button"
                            className={
                              score === option.value
                                ? styles.otjPresetActive
                                : styles.otjPreset
                            }
                            disabled={locked}
                            onClick={() =>
                              setScore(
                                group.id,
                                item.code,
                                option.value as RpleScore,
                              )
                            }
                          >
                            {option.label}
                          </button>
                        ))}
                      </div>
                    </fieldset>
                    <label className={styles.field}>
                      Assessor / workshop comments
                      <textarea
                        rows={2}
                        value={comment}
                        disabled={locked}
                        onChange={(e) =>
                          setItemComment(group.id, item.code, e.target.value)
                        }
                      />
                    </label>
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      ))}

      <section className={styles.otjForm}>
        <h2 className={styles.sectionTitle}>Submit RPLE assessment</h2>
        <p className={styles.metaBlock}>
          Indicative average prior-learning score across marked items:{" "}
          <strong>{reductionPercent}%</strong>. Funding / OTJ reductions from
          the Excel calc engine can be refined later; this portal captures the
          assessor inputs and decision.
        </p>
        <label className={styles.field}>
          Assessor signature (full name)
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
            Form is locked.
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
            disabled={locked || !canSubmitRple(state, programme)}
            onClick={() => submit()}
          >
            Submit RPLE assessment
          </button>
        </div>
      </section>
    </div>
  );
}
