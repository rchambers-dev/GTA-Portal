"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  getAction,
  mentorSignOffAction,
} from "@/features/progress-mentor/domain/actions/mock-store";
import {
  getEvidencePack,
  getEvidencePackForAction,
} from "@/features/progress-mentor/domain/actions/evidence";
import {
  cycleOutcome,
  humanSourceLabel,
} from "@/features/progress-mentor/domain/actions/cycle";
import {
  shouldEscalate,
  smarttoProofRows,
  smarttoQualityLabel,
} from "@/features/progress-mentor/domain/actions/smartto";
import { MENTOR_NAME } from "@/features/progress-mentor/data/mentor-caseload";
import { getReturnLink } from "@/features/shared-records/lib/record-context";
import styles from "./ActionRecordScreen.module.css";

type Props = {
  actionId: string;
  from?: string;
};

export function ActionRecordScreen({ actionId, from }: Props) {
  const backHref =
    getReturnLink(from ?? null).href || "/workspaces/progress-mentor/actions";
  const [tick, setTick] = useState(0);
  const [showTracker, setShowTracker] = useState(true);
  const [signOffNote, setSignOffNote] = useState("");
  const [impactNote, setImpactNote] = useState("");
  const [message, setMessage] = useState<string | null>(null);

  const action = useMemo(() => {
    void tick;
    return getAction(actionId);
  }, [actionId, tick]);

  if (!action) {
    return (
      <div className={styles.root}>
        <Link href={backHref} className={styles.back}>
          ← Back
        </Link>
        <h1>Action not found</h1>
        <p>No action exists for id {actionId}.</p>
      </div>
    );
  }

  const escalation = shouldEscalate(action);
  const cycle = cycleOutcome(action);
  const sourceText = humanSourceLabel(action);
  const pack =
    (action.evidencePackId
      ? getEvidencePack(action.evidencePackId)
      : undefined) ?? getEvidencePackForAction(action.actionId);
  const needsMentorSignOff =
    !action.signedOffBy &&
    !["completed", "impact_confirmed", "cancelled", "closed"].includes(
      action.status,
    );
  const smarttoRows = smarttoProofRows(action);
  const smarttoComplete = smarttoRows.every((row) => row.passed);
  const canSignOff =
    needsMentorSignOff &&
    pack &&
    pack.shortfallHours === 0 &&
    pack.loggedTotalHours >= pack.plannedTotalHours &&
    smarttoComplete;

  function handleSignOff() {
    if (!action) return;
    const result = mentorSignOffAction({
      actionId: action.actionId,
      mentorName: MENTOR_NAME,
      note:
        signOffNote.trim() ||
        "Checked OTJ tracker entries against the success measure while with the learner / employer.",
      impact:
        impactNote.trim() ||
        (pack
          ? `Verified ${pack.loggedTotalHours}h logged against ${pack.plannedTotalHours}h planned — no shortfall for this action.`
          : "Mentor confirmed completion against linked evidence."),
    });
    if (!result) {
      setMessage("Could not sign off this action.");
      return;
    }
    setMessage("Signed off as completed. This will show as Yes at the next review.");
    setTick((n) => n + 1);
  }

  return (
    <div className={styles.root}>
      <Link href={backHref} className={styles.back}>
        ← Back to Action Centre
      </Link>

      <header className={styles.header}>
        <div>
          <p className={styles.eyebrow}>Action record</p>
          <h1>{action.title}</h1>
          <p className={styles.sub}>{action.description}</p>
        </div>
        <span className={styles.status}>{action.status.replace(/_/g, " ")}</span>
      </header>

      <section className={styles.cycleBanner} aria-label="Review cycle outcome">
        <div>
          <p className={styles.cycleEyebrow}>For the next review</p>
          <strong>{cycle.outcomeLabel}</strong>
          <p>{cycle.why}</p>
          {cycle.bringUpAtNextReview ? (
            <p className={styles.bringUp}>
              Bring this up before agreeing new SMARTTO actions.
            </p>
          ) : (
            <p className={styles.cycleOk}>
              Acknowledge impact at the next review, then set new targets if
              needed.
            </p>
          )}
        </div>
      </section>

      {pack ? (
        <section className={styles.evidencePanel} aria-label="Linked evidence">
          <div className={styles.evidenceHead}>
            <div>
              <p className={styles.cycleEyebrow}>Evidence from the database</p>
              <h2>{pack.title}</h2>
              <p className={styles.evidenceSummary}>{pack.summary}</p>
            </div>
            <button
              type="button"
              className={styles.secondaryBtn}
              onClick={() => setShowTracker((v) => !v)}
            >
              {showTracker ? "Hide OTJ hours" : "Show OTJ hours"}
            </button>
          </div>

          <div className={styles.evidenceStats}>
            <div>
              <span>Planned</span>
              <strong>{pack.plannedTotalHours}h</strong>
            </div>
            <div>
              <span>Logged</span>
              <strong>{pack.loggedTotalHours}h</strong>
            </div>
            <div>
              <span>Shortfall</span>
              <strong
                className={
                  pack.shortfallHours > 0 ? styles.shortfallBad : styles.shortfallOk
                }
              >
                {pack.shortfallHours}h
              </strong>
            </div>
          </div>

          {showTracker ? (
            <div className={styles.tableWrap}>
              <table className={styles.evidenceTable}>
                <thead>
                  <tr>
                    <th>Week starting</th>
                    <th>Activity</th>
                    <th>Planned</th>
                    <th>Logged</th>
                    <th>Logged by</th>
                    <th>Logged at</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {pack.entries.map((row) => (
                    <tr key={`${row.weekStarting}-${row.activity}`}>
                      <td>{row.weekStarting}</td>
                      <td>{row.activity}</td>
                      <td>{row.plannedHours}h</td>
                      <td>{row.loggedHours}h</td>
                      <td>{row.loggedBy}</td>
                      <td>{row.loggedAt}</td>
                      <td>
                        <span
                          className={
                            row.status === "logged"
                              ? styles.entryOk
                              : row.status === "partial"
                                ? styles.entryWarn
                                : styles.entryBad
                          }
                        >
                          {row.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
        </section>
      ) : (
        <section className={styles.evidenceMissing}>
          <h2>No linked evidence pack</h2>
          <p>
            This action asks for “{action.evidenceRequirement}” but nothing in
            the evidence store is linked yet. Do not sign off until evidence can
            be opened and checked.
          </p>
        </section>
      )}

      <section className={styles.signOffPanel} aria-label="Mentor sign-off">
        <h2>Mentor sign-off</h2>
        <p className={styles.hint}>
          You set these targets with the learner. Completion is your
          confirmation against the evidence above — not just an employer claim.
        </p>

        {action.signedOffBy ? (
          <div className={styles.signedBox}>
            <strong>
              Signed off by {action.signedOffBy} on {action.signedOffAt}
            </strong>
            <p>{action.signOffNote ?? action.closureReason}</p>
          </div>
        ) : needsMentorSignOff ? (
          <div className={styles.signOffForm}>
            {!pack ? (
              <p className={styles.blockNote}>
                Sign-off blocked — no evidence pack linked to validate this
                action.
              </p>
            ) : pack.shortfallHours > 0 ? (
              <p className={styles.blockNote}>
                Sign-off blocked — tracker shows a {pack.shortfallHours}h
                shortfall. Resolve the missing hours (or record why) before
                completing.
              </p>
            ) : !smarttoComplete ? (
              <p className={styles.blockNote}>
                Sign-off blocked — SMARTTO is incomplete. Fix the failed checks
                above before treating this as completed.
              </p>
            ) : (
              <p className={styles.allClear}>
                Tracker matches the plan ({pack.loggedTotalHours}h /{" "}
                {pack.plannedTotalHours}h) and SMARTTO is 7/7. You can sign this
                off.
              </p>
            )}

            <label className={styles.field}>
              Sign-off note (what you checked in the meeting)
              <textarea
                value={signOffNote}
                onChange={(e) => setSignOffNote(e.target.value)}
                rows={3}
                placeholder="e.g. Opened OTJ tracker with Isla and Mark — four mentoring weeks present, totals match plan."
              />
            </label>
            <label className={styles.field}>
              Impact for next review
              <textarea
                value={impactNote}
                onChange={(e) => setImpactNote(e.target.value)}
                rows={2}
                placeholder="e.g. OTJ hours now match college plan; no shortfall at next review."
              />
            </label>
            <button
              type="button"
              className={styles.primaryBtn}
              disabled={!canSignOff}
              onClick={handleSignOff}
            >
              Sign off as completed
            </button>
            {message ? <p className={styles.message}>{message}</p> : null}
          </div>
        ) : (
          <p className={styles.hint}>
            This action is already closed ({action.status.replace(/_/g, " ")}
            ).
          </p>
        )}
      </section>

      <section className={styles.grid}>
        <article className={styles.card}>
          <h2>Ownership & source</h2>
          <dl className={styles.dl}>
            <div>
              <dt>Owner</dt>
              <dd>
                {action.owner} ({action.ownerType})
              </dd>
            </div>
            <div>
              <dt>Created by</dt>
              <dd>{action.createdBy}</dd>
            </div>
            <div>
              <dt>Source</dt>
              <dd>
                {action.sourceType === "review" ? (
                  <Link
                    className={styles.inlineLink}
                    href={`/reviews/${action.sourceId}?from=action-centre`}
                  >
                    {sourceText}
                  </Link>
                ) : (
                  sourceText
                )}
              </dd>
            </div>
            <div>
              <dt>Learner</dt>
              <dd>
                {action.learnerId ? (
                  <Link
                    className={styles.inlineLink}
                    href={`/learners/${action.learnerId}?from=action-centre`}
                  >
                    {action.learnerName}
                  </Link>
                ) : (
                  "—"
                )}
              </dd>
            </div>
            <div>
              <dt>Employer</dt>
              <dd>{action.employerName ?? "—"}</dd>
            </div>
          </dl>
        </article>

        <article className={styles.card}>
          <h2>Schedule & evidence</h2>
          <dl className={styles.dl}>
            <div>
              <dt>Due</dt>
              <dd>{action.dueDate}</dd>
            </div>
            <div>
              <dt>Checkpoint</dt>
              <dd>{action.checkpointDate}</dd>
            </div>
            <div>
              <dt>Success measure</dt>
              <dd>{action.successMeasure}</dd>
            </div>
            <div>
              <dt>Evidence requirement</dt>
              <dd>
                {pack ? (
                  <button
                    type="button"
                    className={styles.linkBtn}
                    onClick={() => setShowTracker(true)}
                  >
                    {action.evidenceRequirement} — open tracker
                  </button>
                ) : (
                  action.evidenceRequirement
                )}
              </dd>
            </div>
            <div>
              <dt>Evidence state</dt>
              <dd>{action.evidenceState.replace(/_/g, " ")}</dd>
            </div>
            <div>
              <dt>Challenge</dt>
              <dd>{action.challengeLevel}</dd>
            </div>
          </dl>
        </article>

        <article className={styles.card}>
          <h2>SMARTTO quality</h2>
          <p
            className={
              action.smartto.quality === "strong" ? styles.strong : styles.weak
            }
          >
            {smarttoQualityLabel(action.smartto.quality)}
            {" · "}
            {
              Object.values(action.smartto.scores).filter(Boolean).length
            }
            /7 checks met
          </p>
          <p className={styles.hint}>
            Strong means the target is written so you can prove it at sign-off —
            each letter must show evidence below.
          </p>
          <ul className={styles.smarttoProof}>
            {smarttoProofRows(action).map((row) => (
              <li key={row.key}>
                <span
                  className={row.passed ? styles.proofPass : styles.proofFail}
                  aria-label={row.passed ? "Met" : "Not met"}
                >
                  {row.letter}
                </span>
                <div>
                  <strong>
                    {row.label}
                    {row.passed ? " — met" : " — not met"}
                  </strong>
                  <p>{row.proof}</p>
                </div>
              </li>
            ))}
          </ul>
          {action.smartto.guidance.length > 0 ? (
            <div className={styles.guidanceBlock}>
              <strong>Improve before relying on this target</strong>
              <ul>
                {action.smartto.guidance.map((g) => (
                  <li key={g}>{g}</li>
                ))}
              </ul>
            </div>
          ) : null}
        </article>

        <article className={styles.card}>
          <h2>Progress, completion & impact</h2>
          <dl className={styles.dl}>
            <div>
              <dt>Progress update</dt>
              <dd>{action.progressUpdate ?? "—"}</dd>
            </div>
            <div>
              <dt>Completion evidence</dt>
              <dd>{action.completionEvidence ?? "—"}</dd>
            </div>
            <div>
              <dt>Impact</dt>
              <dd>{action.impact ?? "Not yet assessed"}</dd>
            </div>
            <div>
              <dt>Missed targets</dt>
              <dd>{action.missedTargetCount}</dd>
            </div>
            <div>
              <dt>Escalation</dt>
              <dd>
                {escalation.escalate
                  ? `${escalation.reason} (level ${escalation.level})`
                  : "None"}
              </dd>
            </div>
          </dl>
        </article>
      </section>
    </div>
  );
}
