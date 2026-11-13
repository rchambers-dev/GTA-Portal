"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { inviteCsv } from "../domain/csv";
import type { ConcernItem, EmailAttemptRow, ReportCard, TrackerRow, TutorReviewRound, TutorReviewsPage } from "../domain/repository";
import { londonToday, roundCanSend, type EmailMode } from "../domain/email";
import { generateTutorReviewInvitesAction, setTutorReviewRoundAction } from "./actions";
import { EmailAttempts, SendInvitesButton, SendTestEmailButton, TestLinkPanel } from "./EmailPanel";
import { ReviewOverview } from "./ReviewOverview";
import { CollapsibleSection } from "./CollapsibleSection";
import { QuestionnaireEditor } from "./QuestionnaireEditor";
import styles from "./tutor-reviews.module.css";

type LinkRow = { name: string; email: string; path: string };

function formatDate(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

function statusLabel(round: TutorReviewRound) {
  if (round.status === "closed" && round.closedEarly) return "Closed early";
  if (round.status === "open") return "Open";
  if (round.status === "closed") return "Closed";
  return "Draft";
}

function changeLabel(value: number | null) {
  if (value == null) return "—";
  return `${value > 0 ? "+" : ""}${value.toFixed(1)}`;
}

function isPastRound(round: TutorReviewRound, today: string) {
  return round.status === "closed" || Boolean(round.closedEarly) || round.closesOn < today;
}

export function TutorReviewsBoard({
  rounds,
  tracker,
  reports,
  concerns,
  attempts,
  emailQueueReady,
  emailMode,
  workspace,
  templates,
  templatesReady,
}: {
  rounds: TutorReviewRound[];
  tracker: TrackerRow[];
  reports: ReportCard[];
  concerns: ConcernItem[];
  attempts: EmailAttemptRow[];
  emailQueueReady: boolean;
  emailMode: EmailMode;
  workspace: "administration" | "management";
  templates: TutorReviewsPage["templates"];
  templatesReady: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const today = londonToday();
  const [tab, setTab] = useState<"overview" | "questions" | "email" | "past">("overview");
  const upcoming = rounds.filter((item) => !isPastRound(item, today));
  const past = rounds.filter((item) => isPastRound(item, today));
  const [roundId, setRoundId] = useState(upcoming[0]?.id ?? rounds.at(-1)?.id ?? "");
  const [links, setLinks] = useState<LinkRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const round = rounds.find((item) => item.id === roundId) ?? rounds[0];
  const rows = useMemo(() => tracker.filter((row) => row.roundId === round?.id).sort((a, b) => a.name.localeCompare(b.name)), [tracker, round?.id]);
  const roundReports = reports.filter((item) => item.roundId === round?.id);

  function run(task: () => Promise<{ ok: boolean; error?: string } | void>) {
    setError(null);
    startTransition(async () => {
      const result = await task();
      if (result && "ok" in result && !result.ok) {
        setError(result.error || "That change could not be saved.");
        return;
      }
      router.refresh();
    });
  }

  function absolute(path: string) {
    return `${window.location.origin}${path}`;
  }

  return (
    <div className={styles.stack}>
      <nav className={styles.tabs} aria-label="Tutor reviews">
        {([
          ["overview", "Overview"],
          ["questions", "Questions & versions"],
          ["email", "Email attempts"],
          ["past", "Past rounds"],
        ] as const).map(([id, label]) => (
          <button key={id} type="button" className={tab === id ? styles.tabOn : styles.tab} onClick={() => setTab(id)}>{label}</button>
        ))}
      </nav>
      {tab === "overview" && round ? (
        <ReviewOverview
          round={round}
          rounds={upcoming.length ? upcoming : [round]}
          onSelect={setRoundId}
          actions={
            <>
              <button type="button" className={styles.primary} disabled={pending || round.status === "open"} onClick={() => run(() => setTutorReviewRoundAction({ roundId: round.id, status: "open" }))}>Open round</button>
              <button type="button" className={styles.secondary} disabled={pending || round.status !== "open"} onClick={() => run(() => setTutorReviewRoundAction({ roundId: round.id, status: "closed" }))}>Close early</button>
              <SendInvitesButton roundId={round.id} label={round.label} plan={round.emailPlan} mode={emailMode} canSend={emailQueueReady && roundCanSend({ status: round.status, closesOn: round.closesOn, closedEarly: round.closedEarly, today }).ok} reason={null} />
              <SendTestEmailButton roundId={round.id} canSend={emailQueueReady && roundCanSend({ status: round.status, closesOn: round.closesOn, closedEarly: round.closedEarly, today }).ok} reason={null} />
              <TestLinkPanel roundId={round.id} path={round.testPath} />
            </>
          }
          tracker={rows}
          reports={roundReports}
          concerns={concerns.filter((item) => item.roundLabel === round.label)}
          attempts={attempts.filter((item) => item.roundId === round.id)}
          onOpenEmail={() => setTab("email")}
          onEditQuestions={() => setTab("questions")}
        />
      ) : null}
      {tab === "past" ? <section className={styles.card}>
        <CollapsibleSection id="rounds" title="Rounds" defaultOpen>
        <div className={styles.sectionHead}>
          <div>
            <p className={styles.muted}>Rounds whose closing date has passed, or that were closed early.</p>
          </div>
        </div>
        <div className={styles.rounds}>
          {([] as typeof upcoming).map((item) => (
            <article key={item.id} className={item.id === round?.id ? `${styles.round} ${styles.roundSelected}` : styles.round}>
              <button type="button" className={styles.roundPick} onClick={() => setRoundId(item.id)}>
                <strong>{item.label}</strong>
                <span className={styles.pill}>{statusLabel(item)}</span>
                <p className={styles.dates}>{formatDate(item.opensOn)} – {formatDate(item.closesOn)}</p>
              </button>
              <div className={styles.actions}>
                <button type="button" className={styles.primary} disabled={pending || item.status === "open"} onClick={() => run(() => setTutorReviewRoundAction({ roundId: item.id, status: "open" }))}>
                  Open
                </button>
                <button type="button" className={styles.secondary} disabled={pending || item.status !== "open"} onClick={() => run(() => setTutorReviewRoundAction({ roundId: item.id, status: "closed" }))}>
                  Close early
                </button>
                <SendInvitesButton
                  roundId={item.id}
                  label={item.label}
                  plan={item.emailPlan}
                  mode={emailMode}
                  canSend={emailQueueReady && roundCanSend({ status: item.status, closesOn: item.closesOn, closedEarly: item.closedEarly, today: londonToday() }).ok}
                  reason={emailQueueReady ? (roundCanSend({ status: item.status, closesOn: item.closesOn, closedEarly: item.closedEarly, today: londonToday() }).ok ? null : "Invites can be sent when a round is open or scheduled to open.") : "Email sending is not available until the database migration is applied."}
                />
                <SendTestEmailButton
                  roundId={item.id}
                  canSend={emailQueueReady && roundCanSend({ status: item.status, closesOn: item.closesOn, closedEarly: item.closedEarly, today: londonToday() }).ok}
                  reason={emailQueueReady ? (roundCanSend({ status: item.status, closesOn: item.closesOn, closedEarly: item.closedEarly, today: londonToday() }).ok ? null : "Invites can be sent when a round is open or scheduled to open.") : "Email sending is not available until the database migration is applied."}
                />
                <TestLinkPanel roundId={item.id} path={item.testPath} />
              </div>
            </article>
          ))}
        </div>
        <CollapsibleSection id="past-rounds" title={`Past rounds${past.length ? ` · ${past.length}` : ""}`}>
          <div className={styles.rounds}>
            {past.length ? past.map((item) => (
              <article key={item.id} className={item.id === round?.id ? `${styles.round} ${styles.roundSelected}` : styles.round}>
                <button type="button" className={styles.roundPick} onClick={() => setRoundId(item.id)}>
                  <strong>{item.label}</strong>
                  <span className={styles.pill}>{statusLabel(item)}</span>
                  <p className={styles.dates}>{formatDate(item.opensOn)} – {formatDate(item.closesOn)}</p>
                </button>
              </article>
            )) : <p className={styles.muted}>No past rounds yet.</p>}
          </div>
        </CollapsibleSection>
        {error ? <p className={styles.error}>{error}</p> : null}
        </CollapsibleSection>
      </section> : null}

      {tab === "questions" && round ? (
        <section className={styles.card}>
          <CollapsibleSection id="editor" title="Editor">
            <QuestionnaireEditor
              key={`${round.id}-${round.templateVersionId ?? "none"}`}
              roundId={round.id}
              snapshotted={round.snapshotted}
              templateVersionId={round.templateVersionId}
              versions={templates}
              templatesReady={templatesReady}
            />
          </CollapsibleSection>
        </section>
      ) : null}

      {tab === "questions" && round ? (
        <section className={styles.card}>
          <CollapsibleSection id="invites" title={`Invites · ${round.label}`}>
          <div className={styles.sectionHead}>
            <div>
              <p className={styles.muted}>Creates a one-time link for each apprentice who has a tutor. Copy a link or export a CSV. Send invites posts those links by email. Generating again replaces any link that has not been submitted.</p>
            </div>
            <button
              type="button"
              className={styles.primary}
              disabled={pending}
              onClick={() => {
                setError(null);
                startTransition(async () => {
                  const result = await generateTutorReviewInvitesAction(round.id);
                  if (!result.ok) {
                    setError(result.error);
                    return;
                  }
                  setLinks(result.links);
                  setNotice(result.links.length ? null : "No new links. Submitted apprentices stay submitted, and apprentices without a tutor are skipped.");
                  router.refresh();
                });
              }}
            >
              Generate links
            </button>
          </div>
          {notice ? <p className={styles.muted}>{notice}</p> : null}
          {links.length ? (
            <>
              <div className={styles.actions}>
                <button
                  type="button"
                  className={styles.secondary}
                  onClick={() => {
                    const csv = inviteCsv(links.map((link) => ({ ...link, link: absolute(link.path) })));
                    const blob = new Blob([csv], { type: "text/csv" });
                    const url = URL.createObjectURL(blob);
                    const anchor = document.createElement("a");
                    anchor.href = url;
                    anchor.download = `${round.label} tutor review links.csv`;
                    anchor.click();
                    URL.revokeObjectURL(url);
                  }}
                >
                  Export CSV
                </button>
              </div>
              <div className={styles.links}>
                {links.map((link) => (
                  <div key={link.path} className={styles.linkRow}>
                    <div>
                      <strong>{link.name}</strong>
                      <p className={styles.muted}>{link.email}</p>
                    </div>
                    <button
                      type="button"
                      className={styles.copy}
                      onClick={async () => {
                        await navigator.clipboard.writeText(absolute(link.path));
                        setCopied(link.path);
                      }}
                    >
                      {copied === link.path ? "Copied" : "Copy link"}
                    </button>
                  </div>
                ))}
              </div>
            </>
          ) : null}
          </CollapsibleSection>
        </section>
      ) : null}

      {tab === "email" && round ? (
        <EmailAttempts
          roundId={round.id}
          attempts={attempts}
          workspace={workspace}
          mode={emailMode}
          queueReady={emailQueueReady}
        />
      ) : null}

      {false ? <><section className={styles.card}>
        <CollapsibleSection id="tracker" title={`Tracker${round ? ` · ${round.label}` : ""}`}>
        <p className={styles.muted}>Who was invited and who has submitted. Answers are not shown here.</p>
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Apprentice</th>
                <th>Tutor</th>
                <th>Email</th>
                <th>Invited</th>
                <th>Submitted</th>
              </tr>
            </thead>
            <tbody>
              {rows.length ? rows.map((row) => (
                <tr key={`${row.roundId}-${row.apprenticeId}`}>
                  <td>{row.name}</td>
                  <td>{row.tutorName}</td>
                  <td>{row.email || "No email"}</td>
                  <td>{row.invited ? "Yes" : "No"}</td>
                  <td>{row.submitted ? "Yes" : "No"}</td>
                </tr>
              )) : (
                <tr>
                  <td colSpan={5}>No apprentices with a tutor yet.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        </CollapsibleSection>
      </section>

      <section className={styles.card}>
        <CollapsibleSection id="report" title={`Report${round ? ` · ${round.label}` : ""}`}>
        <p className={styles.muted}>Averages, Yes percentages, and comments stay hidden until a tutor has at least 3 responses. The change is against the previous round when that round also has at least 3.</p>
        <div className={styles.reportGrid}>
          {roundReports.length ? roundReports.map((report) => (
            <article key={`${report.roundId}-${report.tutorId}`} className={styles.round}>
              <h3>{report.tutorName}</h3>
              <div className={styles.statRow}>
                <span>{report.responseCount} responses</span>
                <span>{report.invited} invited</span>
                <span>{report.submitted} submitted</span>
              </div>
              {report.hidden ? <p className={styles.muted}>Fewer than 3 responses, so averages, Yes percentages, and comments stay hidden.</p> : report.questions.map((question) => (
                <div key={question.code} className={styles.question}>
                  <strong>{question.text}</strong>
                  {question.kind === "yes_no" ? (
                    <p>
                      {question.yesAnswered ? `${question.yesCount} Yes of ${question.yesAnswered} (${question.yesPercent}%)` : "No answers yet"}
                      {" · "}
                      <span className={question.change == null ? undefined : question.change < 0 ? styles.changeDown : styles.changeUp}>
                        {question.change == null ? "—" : `${question.change > 0 ? "+" : ""}${question.change} points`}
                      </span>
                      {report.previousLabel ? ` vs ${report.previousLabel}` : ""}
                    </p>
                  ) : question.kind === "rating_1_5" ? (
                    <p>
                      Average {question.average?.toFixed(1) ?? "—"}
                      {" · "}
                      <span className={question.change == null ? undefined : question.change < 0 ? styles.changeDown : styles.changeUp}>
                        {changeLabel(question.change)}
                      </span>
                      {report.previousLabel ? ` vs ${report.previousLabel}` : ""}
                    </p>
                  ) : question.texts.map((text, index) => <p key={`${question.code}-${index}`}>{text}</p>)}
                </div>
              ))}
            </article>
          )) : <p className={styles.muted}>No responses for this round yet.</p>}
        </div>
        </CollapsibleSection>
      </section></> : null}

      {false ? <section className={styles.card}>
        <CollapsibleSection id="concerns" title="Concerns to read">
        <p className={styles.muted}>A concern names the tutor and the round only. It is not linked to an apprentice.</p>
        {concerns.length ? concerns.map((item, index) => (
          <article key={`${item.tutorName}-${item.roundLabel}-${index}`} className={styles.concern}>
            <strong>{item.tutorName}</strong>
            <p className={styles.muted}>{item.roundLabel}</p>
            <p>{item.text}</p>
          </article>
        )        ) : <p className={styles.muted}>No concerns to read.</p>}
        </CollapsibleSection>
      </section> : null}
    </div>
  );
}
