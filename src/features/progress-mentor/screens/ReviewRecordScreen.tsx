import Link from "next/link";
import { getFormalReview } from "@/features/progress-mentor/domain/reviews/mock-store";
import {
  ACTION_RECORDS,
  actionsForReview,
} from "@/features/progress-mentor/domain/actions/mock-store";
import type { ActionRecord } from "@/features/progress-mentor/domain/actions/types";
import {
  humanSourceLabel,
  lastCycleActionsForReview,
} from "@/features/progress-mentor/domain/actions/cycle";
import { smarttoQualityLabel } from "@/features/progress-mentor/domain/actions/smartto";
import { getReturnLink } from "@/features/shared-records/lib/record-context";
import styles from "./ReviewRecordScreen.module.css";

type Props = {
  reviewId: string;
  from?: string;
};

const SMARTTO_LABELS = [
  { key: "S", label: "Specific" },
  { key: "M", label: "Measurable" },
  { key: "A", label: "Achievable" },
  { key: "R", label: "Relevant" },
  { key: "T", label: "Timely" },
  { key: "T", label: "Trackable" },
  { key: "O", label: "Owned" },
] as const;

function moduleStatusClass(status: string): string {
  if (status === "completed") return styles.modComplete;
  if (status === "in_progress") return styles.modProgress;
  return styles.modRemaining;
}

function moduleStatusLabel(status: string): string {
  if (status === "completed") return "Completed";
  if (status === "in_progress") return "In progress";
  return "Remaining";
}

function actionStatusClass(status: ActionRecord["status"]): string {
  if (status === "completed" || status === "impact_confirmed") {
    return styles.actionStatusOk;
  }
  if (
    status === "overdue" ||
    status === "escalated" ||
    status === "checkpoint_due"
  ) {
    return styles.actionStatusBad;
  }
  if (status === "awaiting_evidence" || status === "in_progress") {
    return styles.actionStatusWarn;
  }
  return styles.actionStatusNeutral;
}

function ActionDetailCard({
  action,
  from,
}: {
  action: ActionRecord;
  from: string;
}) {
  const dims = [
    ["specific", "S"],
    ["measurable", "M"],
    ["achievable", "A"],
    ["relevant", "R"],
    ["timely", "T"],
    ["trackable", "T"],
    ["owned", "O"],
  ] as const;

  return (
    <article className={styles.actionCard}>
      <div className={styles.actionCardHead}>
        <div>
          <Link
            href={`/actions/${action.actionId}?from=${from}`}
            className={styles.actionTitle}
          >
            {action.title}
          </Link>
          <p className={styles.actionDesc}>{action.description}</p>
        </div>
        <span className={actionStatusClass(action.status)}>
          {action.status.replace(/_/g, " ")}
        </span>
      </div>

      <dl className={styles.actionMeta}>
        <div>
          <dt>Owner</dt>
          <dd>
            {action.owner} · {action.ownerType}
          </dd>
        </div>
        <div>
          <dt>Due</dt>
          <dd>{action.dueDate}</dd>
        </div>
        <div>
          <dt>Checkpoint</dt>
          <dd>{action.checkpointDate}</dd>
        </div>
        <div>
          <dt>Evidence</dt>
          <dd>
            {action.evidenceRequirement} (
            {action.evidenceState.replace(/_/g, " ")})
          </dd>
        </div>
        <div>
          <dt>Success measure</dt>
          <dd>{action.successMeasure}</dd>
        </div>
        {action.progressUpdate ? (
          <div>
            <dt>Progress</dt>
            <dd>{action.progressUpdate}</dd>
          </div>
        ) : null}
        {action.impact ? (
          <div>
            <dt>Impact</dt>
            <dd>{action.impact}</dd>
          </div>
        ) : null}
      </dl>

      <div className={styles.smarttoRow}>
        <p className={styles.smarttoQuality}>
          {smarttoQualityLabel(action.smartto.quality)}
        </p>
        <ul className={styles.smarttoDims} aria-label="SMARTTO checks">
          {dims.map(([dim, letter]) => (
            <li
              key={dim}
              className={
                action.smartto.scores[dim]
                  ? styles.smarttoPass
                  : styles.smarttoFail
              }
              title={`${dim}: ${action.smartto.scores[dim] ? "met" : "needs work"}`}
            >
              {letter}
            </li>
          ))}
        </ul>
      </div>
    </article>
  );
}

export function ReviewRecordScreen({ reviewId, from }: Props) {
  const review = getFormalReview(reviewId);
  const backHref =
    getReturnLink(from ?? null).href || "/workspaces/progress-mentor/reviews";

  if (!review) {
    return (
      <div className={styles.root}>
        <Link href={backHref} className={styles.back}>
          ← Back
        </Link>
        <h1>Review not found</h1>
        <p>No formal review exists for id {reviewId}.</p>
      </div>
    );
  }

  const agreedActions = actionsForReview(review.reviewId);
  const lastCycle = lastCycleActionsForReview({
    learnerId: review.learnerId,
    reviewId: review.reviewId,
    reviewDate: review.reviewDate,
    actions: ACTION_RECORDS,
  });
  const lastCycleBringUp = lastCycle.filter((row) => row.bringUpAtNextReview);
  const lastCycleDone = lastCycle.filter((row) => row.outcome === "yes");
  const completedFromThisReview = agreedActions.filter(
    (a) =>
      a.status === "completed" ||
      a.status === "impact_confirmed",
  );
  const openFromThisReview = agreedActions.filter(
    (a) =>
      a.status !== "completed" &&
      a.status !== "impact_confirmed" &&
      a.status !== "cancelled" &&
      a.status !== "closed",
  );
  const live = review.liveProgress;
  const snap = review.snapshot;
  const progressChanged =
    live &&
    (live.actualProgressPercent !== snap.actualProgressPercent ||
      live.plannedProgressPercent !== snap.plannedProgressPercent);

  const stageSteps = [
    "Created",
    "Discussion",
    "Judgement",
    "Actions",
    "Sign-off",
    "Complete",
  ];
  const activeStep =
    review.stage === "completed"
      ? 5
      : review.stage === "awaiting_sign_off"
        ? 4
        : review.actionsCreated > 0
          ? 3
          : review.progressJudgement
            ? 2
            : review.stage === "in_progress"
              ? 1
              : 0;

  const modulesByYear = [1, 2, 3].map((year) => ({
    year: year as 1 | 2 | 3,
    rows: snap.modules.filter((m) => m.year === year),
  })).filter((group) => group.rows.length > 0);

  const moduleTotal = Math.max(1, snap.modulesVisibleTotal);
  const modulePie = {
    completedPct: Math.round((snap.modulesCompleted / moduleTotal) * 100),
    inProgressPct: Math.round((snap.modulesInProgress / moduleTotal) * 100),
  };

  return (
    <div className={styles.root}>
      <Link href={backHref} className={styles.back}>
        ← Back to Reviews
      </Link>

      <header className={styles.header}>
        <div>
          <p className={styles.eyebrow}>Formal review record</p>
          <h1>{review.learnerName}</h1>
          <p className={styles.sub}>
            {review.programmeName} · Year {snap.programmeYear}
            {snap.programmeWeek != null ? ` · Week ${snap.programmeWeek}` : ""} ·{" "}
            {review.employerName} · {review.reviewType}
          </p>
        </div>
        <div className={styles.badges}>
          <span className={styles.stage}>{review.stage.replace(/_/g, " ")}</span>
          {review.readOnly ? (
            <span className={styles.readonly}>Read-only</span>
          ) : null}
        </div>
      </header>

      <section className={styles.overviewBoard} aria-label="Review overview">
        <div className={styles.overviewIntro}>
          <div>
            <h2>Review overview</h2>
            <p>
              This strip shows where the formal review is up to, module completion
              for Years 1–{snap.programmeYear}, college attendance, and who has
              signed. Use it to see the review at a glance before reading the
              full record below.
            </p>
          </div>
          <p className={styles.overviewStageNote}>
            Current stage: <strong>{stageSteps[activeStep]}</strong>
            {" — "}
            {activeStep === 0
              ? "Record created from preparation; discussion not finished."
              : activeStep === 5
                ? "All stages complete. This review is locked as the signed record."
                : `Working through ${stageSteps[activeStep].toLowerCase()}.`}
          </p>
        </div>

        <div className={styles.overviewGrid}>
          <article className={styles.overviewCard}>
            <h3>Where this review is up to</h3>
            <ol className={styles.stageList}>
              {stageSteps.map((step, index) => (
                <li
                  key={step}
                  className={
                    index < activeStep
                      ? styles.stageDone
                      : index === activeStep
                        ? styles.stageNow
                        : styles.stageTodo
                  }
                >
                  <span>{index + 1}</span>
                  <div>
                    <strong>{step}</strong>
                    <p>
                      {index === 0
                        ? "Preparation snapshotted into the formal record"
                        : index === 1
                          ? "Meeting notes and contributions"
                          : index === 2
                            ? "Progress judgement agreed"
                            : index === 3
                              ? "SMARTTO actions created in Action Centre"
                              : index === 4
                                ? "Apprentice, employer and provider agreement"
                                : "Locked completed review"}
                    </p>
                  </div>
                </li>
              ))}
            </ol>
          </article>

          <article className={styles.overviewCard}>
            <h3>Modules to end of Year {snap.programmeYear}</h3>
            <div className={styles.pieBlock}>
              <div
                className={styles.pie}
                style={{
                  background: `conic-gradient(
                    #2e7d4f 0 ${modulePie.completedPct}%,
                    #e07020 ${modulePie.completedPct}% ${modulePie.completedPct + modulePie.inProgressPct}%,
                    #d5dde8 ${modulePie.completedPct + modulePie.inProgressPct}% 100%
                  )`,
                }}
                role="img"
                aria-label={`${snap.modulesCompleted} completed, ${snap.modulesInProgress} in progress, ${snap.modulesRemaining} remaining`}
              >
                <div className={styles.pieHole}>
                  <strong>
                    {snap.modulesCompleted}/{snap.modulesVisibleTotal}
                  </strong>
                  <span>done</span>
                </div>
              </div>
              <ul className={styles.pieLegend}>
                <li>
                  <span className={styles.dotDone} />
                  Completed <strong>{snap.modulesCompleted}</strong>
                </li>
                <li>
                  <span className={styles.dotActive} />
                  In progress <strong>{snap.modulesInProgress}</strong>
                </li>
                <li>
                  <span className={styles.dotLeft} />
                  Remaining <strong>{snap.modulesRemaining}</strong>
                </li>
                <li className={styles.pieYearNote}>
                  Year {snap.programmeYear}:{" "}
                  {snap.currentYearModulesRemaining} module
                  {snap.currentYearModulesRemaining === 1 ? "" : "s"} left this
                  year
                </li>
              </ul>
            </div>
          </article>

          <article className={styles.overviewCard}>
            <h3>College attendance</h3>
            <div className={styles.attGlance}>
              <div>
                <strong>
                  {snap.attendancePercent != null
                    ? `${snap.attendancePercent}%`
                    : "—"}
                </strong>
                <span>Overall</span>
              </div>
              <div>
                <strong>
                  {snap.attendanceDetail.daysAttended}/
                  {snap.attendanceDetail.daysExpected}
                </strong>
                <span>Days attended</span>
              </div>
              <div>
                <strong>{snap.attendanceDetail.daysAbsent}</strong>
                <span>Absent</span>
              </div>
              <div>
                <strong>{snap.attendanceDetail.daysLate}</strong>
                <span>Late</span>
              </div>
            </div>
            <p className={styles.hintTight}>{snap.attendanceDetail.trendLabel}</p>
            <table className={styles.dayTable}>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Day</th>
                  <th>Session</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {snap.attendanceDetail.collegeDays.slice(-6).map((day) => (
                  <tr key={day.date}>
                    <td>{day.date}</td>
                    <td>{day.dayName}</td>
                    <td>{day.session}</td>
                    <td>
                      <span
                        className={
                          day.status === "attended"
                            ? styles.attGood
                            : day.status === "late" || day.status === "authorised"
                              ? styles.attWarn
                              : styles.attBad
                        }
                      >
                        {day.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className={styles.hintTight}>
              Full day-by-day list is in the Attendance section below.
            </p>
          </article>

          <article className={styles.overviewCard}>
            <h3>Sign-off — printed name, signed and dated</h3>
            <div className={styles.signGrid}>
              {review.signOff.parties.map((party) => (
                <div key={party.role} className={styles.signCard}>
                  <p className={styles.signRole}>
                    {party.role === "apprentice"
                      ? "Apprentice"
                      : party.role === "employer"
                        ? "Employer"
                        : "Provider"}
                  </p>
                  <dl>
                    <div>
                      <dt>Printed name</dt>
                      <dd>{party.printedName}</dd>
                    </div>
                    {party.organisation ? (
                      <div>
                        <dt>Organisation</dt>
                        <dd>{party.organisation}</dd>
                      </div>
                    ) : null}
                    <div>
                      <dt>Signature</dt>
                      <dd className={styles.signatureMark}>
                        {party.signed && party.signatureMark
                          ? party.signatureMark
                          : "Not signed"}
                      </dd>
                    </div>
                    <div>
                      <dt>Date signed</dt>
                      <dd>{party.signedAt ?? "—"}</dd>
                    </div>
                  </dl>
                  <span
                    className={
                      party.signed ? styles.signBadgeOk : styles.signBadgeWait
                    }
                  >
                    {party.signed ? "Signed" : "Outstanding"}
                  </span>
                </div>
              ))}
            </div>
            <p className={styles.hintTight}>
              Summary:{" "}
              {review.signOff.summaryIssued
                ? `Issued${review.signOff.summaryIssuedAt ? ` on ${review.signOff.summaryIssuedAt}` : ""}`
                : "Not issued yet"}
            </p>
          </article>
        </div>
      </section>

      <section className={styles.reviewSheet}>
        <article className={styles.reviewSummary}>
          <h2>Review summary</h2>
          <dl className={styles.dl}>
            <div>
              <dt>Review date</dt>
              <dd>{review.reviewDate}</dd>
            </div>
            <div>
              <dt>Mentor</dt>
              <dd>{review.mentorName}</dd>
            </div>
            <div>
              <dt>Tutor</dt>
              <dd>{review.tutorName}</dd>
            </div>
            <div>
              <dt>Participants</dt>
              <dd>
                <ul className={styles.participantList}>
                  {review.signOff.parties.map((party) => (
                    <li key={party.role}>
                      <span className={styles.participantRole}>
                        {party.role === "apprentice"
                          ? "Apprentice"
                          : party.role === "employer"
                            ? "Employer"
                            : "Provider"}
                      </span>
                      <span className={styles.participantName}>
                        {party.printedName}
                      </span>
                      {party.organisation ? (
                        <span className={styles.participantOrg}>
                          {party.organisation}
                        </span>
                      ) : null}
                    </li>
                  ))}
                  {review.tutorName &&
                  !review.signOff.parties.some(
                    (p) =>
                      p.printedName.toLowerCase() ===
                      review.tutorName.toLowerCase(),
                  ) ? (
                    <li>
                      <span className={styles.participantRole}>Tutor</span>
                      <span className={styles.participantName}>
                        {review.tutorName}
                      </span>
                    </li>
                  ) : null}
                </ul>
              </dd>
            </div>
            <div>
              <dt>Current stage</dt>
              <dd>{review.stage.replace(/_/g, " ")}</dd>
            </div>
            <div>
              <dt>Missing sections</dt>
              <dd>{review.missingSections.join("; ") || "None"}</dd>
            </div>
          </dl>
        </article>

        <article className={styles.snapshotHero}>
          <h2>Captured position at review creation</h2>
          <p>
            Snapshot used for this review. Live learner data may change later —
            it does not overwrite this record.
          </p>
          <div className={styles.metricGrid}>
            <div>
              <span>Planned</span>
              <strong>{snap.plannedProgressPercent}%</strong>
            </div>
            <div>
              <span>Actual</span>
              <strong>{snap.actualProgressPercent}%</strong>
            </div>
            <div>
              <span>Variance</span>
              <strong>
                {snap.variancePercent > 0 ? "+" : ""}
                {snap.variancePercent}%
              </strong>
            </div>
            <div>
              <span>Attendance</span>
              <strong>
                {snap.attendancePercent != null
                  ? `${snap.attendancePercent}%`
                  : "Unavailable"}
              </strong>
            </div>
            <div>
              <span>OTJ hours</span>
              <strong>{snap.offTheJobHours ?? "—"}</strong>
            </div>
            <div>
              <span>Evidence gaps</span>
              <strong>{snap.missingMandatoryEvidence}</strong>
            </div>
          </div>
          {progressChanged ? (
            <p className={styles.changed}>
              Live progress has changed since this review was started.
            </p>
          ) : null}
        </article>

        <article className={styles.cardWide}>
          <header className={styles.sectionHead}>
            <div>
              <h2>
                Modules to end of Year {snap.programmeYear}
              </h2>
              <p className={styles.hint}>
                Showing Years 1–{snap.programmeYear} only. Later-year modules stay
                hidden until the learner reaches that year.
              </p>
            </div>
            <div className={styles.moduleSummary}>
              <span>
                <strong>{snap.modulesCompleted}</strong> completed
              </span>
              <span>
                <strong>{snap.modulesInProgress}</strong> in progress
              </span>
              <span>
                <strong>{snap.modulesRemaining}</strong> remaining
              </span>
              <span>
                Year {snap.programmeYear}:{" "}
                <strong>{snap.currentYearModulesCompleted}</strong>/
                {snap.currentYearModulesTotal} done ·{" "}
                <strong>{snap.currentYearModulesRemaining}</strong> left
              </span>
            </div>
          </header>

          <div className={styles.moduleProgressBar} aria-hidden>
            <span
              className={styles.moduleBarDone}
              style={{
                width: `${snap.modulesVisibleTotal
                  ? (snap.modulesCompleted / snap.modulesVisibleTotal) * 100
                  : 0}%`,
              }}
            />
            <span
              className={styles.moduleBarActive}
              style={{
                width: `${snap.modulesVisibleTotal
                  ? (snap.modulesInProgress / snap.modulesVisibleTotal) * 100
                  : 0}%`,
              }}
            />
          </div>

          {modulesByYear.map((group) => (
            <div key={group.year} className={styles.yearBlock}>
              <h3>
                Year {group.year}
                {group.year === snap.programmeYear ? " · current year" : " · completed year"}
              </h3>
              <table className={styles.moduleTable}>
                <thead>
                  <tr>
                    <th>Code</th>
                    <th>Module</th>
                    <th>Status</th>
                    <th>Completed</th>
                    <th>Evidence</th>
                  </tr>
                </thead>
                <tbody>
                  {group.rows.map((mod) => (
                    <tr key={mod.moduleId}>
                      <td>{mod.code}</td>
                      <td>{mod.title}</td>
                      <td>
                        <span className={moduleStatusClass(mod.status)}>
                          {moduleStatusLabel(mod.status)}
                        </span>
                      </td>
                      <td>{mod.completedAt ?? "—"}</td>
                      <td>{mod.evidenceNote ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
        </article>

        <article className={styles.cardWide}>
          <header className={styles.sectionHead}>
            <div>
              <h2>Attendance — college days</h2>
              <p className={styles.hint}>
                {snap.attendanceDetail.trendLabel}
                {snap.attendanceDetail.concern
                  ? ` · ${snap.attendanceDetail.concern}`
                  : ""}
              </p>
            </div>
            <div className={styles.attendanceHero}>
              <strong>
                {snap.attendancePercent != null
                  ? `${snap.attendancePercent}%`
                  : "—"}
              </strong>
              <span>Overall attendance</span>
            </div>
          </header>

          <div className={styles.attGlance}>
            <div>
              <strong>
                {snap.attendanceDetail.daysAttended}/
                {snap.attendanceDetail.daysExpected}
              </strong>
              <span>College days attended</span>
            </div>
            <div>
              <strong>{snap.attendanceDetail.daysAbsent}</strong>
              <span>Absent</span>
            </div>
            <div>
              <strong>{snap.attendanceDetail.daysLate}</strong>
              <span>Late</span>
            </div>
          </div>

          {snap.attendanceDetail.collegeDays.length > 0 ? (
            <table className={styles.moduleTable}>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Day</th>
                  <th>College session</th>
                  <th>Status</th>
                  <th>Note</th>
                </tr>
              </thead>
              <tbody>
                {snap.attendanceDetail.collegeDays.map((day) => (
                  <tr key={day.date}>
                    <td>{day.date}</td>
                    <td>{day.dayName}</td>
                    <td>{day.session}</td>
                    <td>
                      <span
                        className={
                          day.status === "attended"
                            ? styles.attGood
                            : day.status === "late" || day.status === "authorised"
                              ? styles.attWarn
                              : styles.attBad
                        }
                      >
                        {day.status}
                      </span>
                    </td>
                    <td>{day.note ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p>{snap.attendanceUnavailableReason ?? "Attendance unavailable."}</p>
          )}

          {snap.attendanceDetail.months.length > 0 ? (
            <>
              <h3 className={styles.subHeading}>Monthly summary</h3>
              <table className={styles.moduleTable}>
                <thead>
                  <tr>
                    <th>Month</th>
                    <th>Attendance</th>
                    <th>Sessions</th>
                    <th>Note</th>
                  </tr>
                </thead>
                <tbody>
                  {snap.attendanceDetail.months.map((month) => (
                    <tr key={month.month}>
                      <td>{month.month}</td>
                      <td>
                        <strong
                          className={
                            month.percent < 85
                              ? styles.attBad
                              : month.percent < 90
                                ? styles.attWarn
                                : styles.attGood
                          }
                        >
                          {month.percent}%
                        </strong>
                      </td>
                      <td>
                        {month.sessionsAttended}/{month.sessionsExpected}
                      </td>
                      <td>{month.note ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          ) : null}
        </article>

        <article className={styles.cardWide}>
          <h2>Contributions loaded into the review</h2>
          <div className={styles.contributionGrid}>
            <div>
              <strong>Apprentice reflection</strong>
              <p>
                {snap.apprenticeContribution ??
                  "Not returned at review creation."}
              </p>
            </div>
            <div>
              <strong>Employer feedback</strong>
              <p>
                {snap.employerContribution ??
                  "Not returned at review creation."}
              </p>
            </div>
            <div>
              <strong>Provider / tutor evidence</strong>
              <p>
                {snap.providerContribution ??
                  "Not returned at review creation."}
              </p>
            </div>
          </div>
        </article>

        <article className={styles.card}>
          <h2>Discussion notes</h2>
          <div className={styles.formPreview}>
            <label>Progress and learning discussion</label>
            <p>
              {review.discussionNotes ??
                "Blank section ready for mentor notes from the review meeting."}
            </p>
          </div>
          <div className={styles.formPreview}>
            <label>Learning focus agreed</label>
            <p>{review.learningFocus ?? "Not yet recorded."}</p>
          </div>
          <div className={styles.formPreview}>
            <label>Workplace / employer discussion</label>
            <p>{review.employerWorkplaceNotes ?? "Not yet recorded."}</p>
          </div>
        </article>

        <article className={styles.card}>
          <h2>Barriers, support and wellbeing</h2>
          <div className={styles.formPreview}>
            <label>Barriers and support</label>
            <p>{review.barriersNotes ?? "No barriers recorded yet."}</p>
          </div>
          <div className={styles.formPreview}>
            <label>Wellbeing and safeguarding prompts</label>
            <p>{review.wellbeingNotes ?? "Prompts not yet completed."}</p>
          </div>
          <div className={styles.formPreview}>
            <label>Progress judgement</label>
            <p>{review.progressJudgement ?? "Not yet recorded"}</p>
          </div>
          <div className={styles.formPreview}>
            <label>Next review date</label>
            <p>{review.nextReviewDate ?? "Set during review completion"}</p>
          </div>
        </article>

        <article className={styles.cardWide}>
          <h2>Actions from last cycle — bring these up first</h2>
          <p className={styles.hint}>
            Before agreeing new SMARTTO actions, confirm whether previous
            commitments were completed. Yes / No / Why is the start of this
            review conversation.
          </p>

          {lastCycle.length === 0 ? (
            <div className={styles.actionEmpty}>
              <p>
                No earlier Action Centre records for {review.learnerName} before
                this review date. After you agree actions here, they will appear
                in this block at the <strong>next</strong> review.
              </p>
            </div>
          ) : (
            <>
              <div className={styles.actionSummary}>
                <div>
                  <strong>{lastCycleDone.length}</strong>
                  <span>Completed (Yes)</span>
                </div>
                <div>
                  <strong>
                    {lastCycle.filter((r) => r.outcome === "no").length}
                  </strong>
                  <span>Not met (No)</span>
                </div>
                <div>
                  <strong>
                    {
                      lastCycle.filter((r) => r.outcome === "in_progress")
                        .length
                    }
                  </strong>
                  <span>Still open</span>
                </div>
                <div>
                  <strong>{lastCycleBringUp.length}</strong>
                  <span>Must discuss today</span>
                </div>
              </div>

              <div className={styles.cycleList}>
                {lastCycle.map((row) => (
                  <article key={row.action.actionId} className={styles.cycleCard}>
                    <div className={styles.cycleCardHead}>
                      <Link
                        href={`/actions/${row.action.actionId}?from=mentor-reviews`}
                        className={styles.actionTitle}
                      >
                        {row.action.title}
                      </Link>
                      <span
                        className={
                          row.outcome === "yes"
                            ? styles.actionStatusOk
                            : row.outcome === "no"
                              ? styles.actionStatusBad
                              : styles.actionStatusWarn
                        }
                      >
                        {row.outcomeLabel}
                      </span>
                    </div>
                    <p className={styles.cycleSource}>
                      From {humanSourceLabel(row.action)} · Owner{" "}
                      {row.action.owner} · Due {row.action.dueDate}
                    </p>
                    <p className={styles.cycleWhy}>
                      <strong>Why / status:</strong> {row.why}
                    </p>
                    {row.bringUpAtNextReview ? (
                      <p className={styles.cycleBringUp}>
                        Discuss before setting new targets — carry forward,
                        escalate, or close with a reason.
                      </p>
                    ) : (
                      <p className={styles.cycleDoneNote}>
                        Completed — acknowledge impact, then move on.
                      </p>
                    )}
                  </article>
                ))}
              </div>
            </>
          )}
        </article>

        <article className={styles.cardWide}>
          <h2>Agreed SMARTTO actions (this review)</h2>
          <p className={styles.hint}>
            New commitments from <em>this</em> meeting become Action Centre
            records. They will be checked Yes / No / Why at the next review.
          </p>

          <div className={styles.actionSummary}>
            <div>
              <strong>{agreedActions.length}</strong>
              <span>Agreed in this review</span>
            </div>
            <div>
              <strong>{openFromThisReview.length}</strong>
              <span>Still open from this review</span>
            </div>
            <div>
              <strong>{completedFromThisReview.length}</strong>
              <span>Completed / impact confirmed</span>
            </div>
            <div>
              <strong>{lastCycleBringUp.length}</strong>
              <span>From last cycle to discuss</span>
            </div>
          </div>

          <div className={styles.smarttoGuide}>
            <p>
              Every action should meet <strong>SMARTTO</strong> so progress can
              be checked at the next review:
            </p>
            <ul>
              {SMARTTO_LABELS.map((item) => (
                <li key={`${item.key}-${item.label}`}>
                  <span>{item.key}</span>
                  {item.label}
                </li>
              ))}
            </ul>
          </div>

          <h3 className={styles.subHeading}>From this review</h3>
          {agreedActions.length === 0 ? (
            <div className={styles.actionEmpty}>
              {activeStep < 3 ? (
                <>
                  <p>
                    No actions yet — this review is still at{" "}
                    <strong>{stageSteps[activeStep]}</strong>. SMARTTO actions
                    are agreed after discussion and progress judgement, then
                    created in the Action Centre before sign-off.
                  </p>
                  <p>
                    Typical actions for {review.learnerName} might cover
                    workplace practice, OTJ logging, evidence gaps, or employer
                    mentoring commitments with a clear owner, due date and
                    success measure.
                  </p>
                </>
              ) : (
                <>
                  <p>
                    This review has reached the actions stage (
                    <strong>{review.actionsCreated}</strong> recorded as
                    created) but no Action Centre records are linked yet.
                  </p>
                  <p>
                    Create each agreed action in the Action Centre so owners,
                    checkpoints and evidence can be tracked through to the next
                    review.
                  </p>
                </>
              )}
              <Link
                href={`/workspaces/progress-mentor/actions?tab=assigned_by_me`}
                className={styles.actionCentreLink}
              >
                Open Action Centre →
              </Link>
            </div>
          ) : (
            <div className={styles.actionCards}>
              {agreedActions.map((a) => (
                <ActionDetailCard
                  key={a.actionId}
                  action={a}
                  from="mentor-reviews"
                />
              ))}
            </div>
          )}
        </article>

        <article className={styles.cardWide}>
          <h2>Sign-off</h2>
          <p className={styles.hint}>
            Formal agreement requires printed name, signature and date from the
            apprentice, employer and provider.
          </p>
          <div className={styles.signGrid}>
            {review.signOff.parties.map((party) => (
              <div key={`full-${party.role}`} className={styles.signCard}>
                <p className={styles.signRole}>
                  {party.role === "apprentice"
                    ? "Apprentice"
                    : party.role === "employer"
                      ? "Employer"
                      : "Provider"}
                </p>
                <dl>
                  <div>
                    <dt>Printed name</dt>
                    <dd>{party.printedName}</dd>
                  </div>
                  {party.organisation ? (
                    <div>
                      <dt>Organisation</dt>
                      <dd>{party.organisation}</dd>
                    </div>
                  ) : null}
                  <div>
                    <dt>Signature</dt>
                    <dd className={styles.signatureMark}>
                      {party.signed && party.signatureMark
                        ? party.signatureMark
                        : "Awaiting signature"}
                    </dd>
                  </div>
                  <div>
                    <dt>Date signed</dt>
                    <dd>{party.signedAt ?? "Not signed"}</dd>
                  </div>
                </dl>
                <span
                  className={
                    party.signed ? styles.signBadgeOk : styles.signBadgeWait
                  }
                >
                  {party.signed ? "Signed" : "Outstanding"}
                </span>
              </div>
            ))}
          </div>
          <p className={styles.hint}>
            Summary:{" "}
            {review.signOff.summaryIssued
              ? `Issued${review.signOff.summaryIssuedAt ? ` on ${review.signOff.summaryIssuedAt}` : ""}`
              : "Not issued — review cannot be fully completed until required sign-off is complete."}
          </p>
        </article>

        <article className={styles.card}>
          <h2>Audit history</h2>
          <ul className={styles.audit}>
            {review.audit.map((entry, i) => (
              <li key={`${entry.at}-${i}`}>
                <strong>{entry.action}</strong> — {entry.userName} ·{" "}
                {entry.at.slice(0, 16).replace("T", " ")}
                {entry.detail ? <span> · {entry.detail}</span> : null}
              </li>
            ))}
          </ul>
          {review.readOnly ? (
            <p className={styles.hint}>
              Completed reviews are read-only. Corrections must be dated
              amendments, not silent edits.
            </p>
          ) : null}
        </article>
      </section>
    </div>
  );
}
