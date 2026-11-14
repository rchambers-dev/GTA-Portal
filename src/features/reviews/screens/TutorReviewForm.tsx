"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import type { DigitalReview } from "../domain/cycle-view";
import {
  PROGRESS_ROWS,
  TARGET_OWNERS,
  clipWords,
  emptyTutorForm,
  firstTutorFormGap,
  otjTrack,
  tidyTutorText,
  type ProgressDraft,
  type TargetDraft,
  type TutorFormDraft,
} from "../domain/tutor-form-rules";
import { addDays, formatWeeksAndDays } from "../domain/plan-due";
import { fillReviewFormPdf, reviewPdfFilename } from "../domain/review-pdf";
import { saveTutorFormAction, submitTutorFormAction } from "./cycle-actions";
import { TutorDatePicker } from "./TutorDatePicker";
import { TutorHelpDialog } from "./tutor-help";
import styles from "./tutor-form.module.css";

function limit(value: string, words: number) {
  return clipWords(value, words);
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function displayToIso(value: string) {
  const match = /^(\d{1,2}) ([A-Za-z]{3}) (\d{4})$/.exec(value.trim());
  if (!match) return "";
  const month = MONTHS.indexOf(match[2]);
  if (month < 0) return "";
  return `${match[3]}-${String(month + 1).padStart(2, "0")}-${match[1].padStart(2, "0")}`;
}

function fillCaption(learner: { band: string; fillRemaining: number; fillStarted: boolean; noticeDays: number | null }) {
  if (learner.band === "sent-back") return "Sent back to the reviewer";
  if (learner.band !== "need-doing") {
    return learner.noticeDays != null && learner.noticeDays > 0
      ? `Opens in ${formatWeeksAndDays(learner.noticeDays)}`
      : "Not due yet";
  }
  if (learner.fillRemaining === 0) return "Ready to send back";
  if (learner.fillStarted) return `${learner.fillRemaining}% left to fill`;
  return "Fill this review";
}

export function TutorReviewForm({ review }: { review: DigitalReview }) {
  const [form, setForm] = useState<TutorFormDraft>(review.form || emptyTutorForm());
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [status, setStatus] = useState("");
  const [help, setHelp] = useState<string | null>(null);
  const [section1, setSection1] = useState(false);
  const [shake, setShake] = useState(false);
  const [dirty, setDirty] = useState(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const weeks = review.intervalWeeks || 10;
  const gap = useMemo(() => firstTutorFormGap(form, review.today, weeks), [form, review.today, weeks]);
  const maxDate = addDays(review.today, weeks * 7);

  useEffect(() => {
    if (!review.editable || !dirty) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      const result = await saveTutorFormAction({ packId: review.packId, form });
      setStatus(result.ok ? "Saved." : result.formError);
    }, 800);
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, [dirty, form, review.editable, review.packId]);

  function touch(anchor: string) {
    setDirty(true);
    setTouched((current) => ({ ...current, [anchor]: true }));
  }

  function tone(anchor: string, complete: boolean | null) {
    if (complete) return styles.done;
    if (touched[anchor] && complete === false) return styles.gap;
    return "";
  }

  async function improve(field: string, value: string, words: number, apply: (next: string) => void) {
    if (!value.trim()) {
      setStatus("Write something in this box first, then use AI to improve it.");
      return;
    }
    let next = "";
    try {
      const response = await fetch("/api/tutor-reword", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: value, field, wordLimit: words }),
      });
      const data = (await response.json()) as { text?: string };
      next = response.ok && data.text ? data.text : tidyTutorText(value, words);
    } catch {
      next = tidyTutorText(value, words);
    }
    apply(limit(next, words));
    setStatus("Wording updated. Check it still says what you meant.");
  }

  async function preview() {
    if (review.editable) {
      const saved = await saveTutorFormAction({ packId: review.packId, form });
      if (!saved.ok) {
        setStatus(saved.formError);
        return;
      }
      setStatus("Saved.");
    }
    const template = await fetch("/forms/GTA_Tripartite_Progress_Review_Form_V1.2.pdf");
    if (!template.ok) {
      setStatus("Could not load the review form template.");
      return;
    }
    const value = (label: string) => review.section1.find((row) => row.label === label)?.value || "";
    const bytes = await fillReviewFormPdf(new Uint8Array(await template.arrayBuffer()), {
      name: review.name,
      apprenticeship: value("Apprenticeship standard / route / level"),
      releaseDay: value("Release day"),
      tutor: value("GTA tutor"),
      reviewer: value("GTA reviewer"),
      startDate: displayToIso(value("Apprenticeship start date")),
      endDate: displayToIso(value("Apprenticeship planned end date")),
      employer: value("Employer / workplace"),
      postcode: value("Postcode"),
      employerContact: value("Employer contact name"),
      phone: value("Employer contact phone"),
      email: value("Employer contact email"),
      plannedReviewDate: displayToIso(value("Planned review date")),
      previousReviewDate: displayToIso(value("Previous review date")),
    }, form, {
      forVisit: review.stage !== "with_tutor" && review.stage !== "waiting",
    });
    const blob = new Blob([Uint8Array.from(bytes)], { type: "application/pdf" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = reviewPdfFilename(review.name, displayToIso(value("Planned review date")));
    link.click();
    URL.revokeObjectURL(url);
  }

  async function send() {
    const missing = firstTutorFormGap(form, review.today, weeks);
    if (missing) {
      setTouched((current) => ({ ...current, [missing.anchor]: true }));
      setStatus(missing.message);
      setShake(true);
      document.getElementById(missing.anchor)?.scrollIntoView({ behavior: "smooth", block: "center" });
      window.setTimeout(() => setShake(false), 400);
      return;
    }
    const result = await submitTutorFormAction({ packId: review.packId, form });
    setStatus(result.ok ? "Sent back to the reviewer." : result.formError);
  }

  function updateTarget(kind: "previous" | "new", slot: number, patch: Partial<TargetDraft>) {
    setForm((current) => {
      const key = kind === "previous" ? "previousTargets" : "newTargets";
      return {
        ...current,
        [key]: current[key].map((target) => (target.slot === slot ? { ...target, ...patch } : target)),
      };
    });
  }

  function carry(target: TargetDraft) {
    if (!target.action.trim()) return;
    touch("previous-1");
    setForm((current) => {
      const empty = current.newTargets.find((item) => !item.action.trim() && !item.owner.trim() && !item.measure.trim());
      const slot = empty?.slot ?? 1;
      return {
        ...current,
        previousTargets: current.previousTargets.map((item) =>
          item.slot === target.slot ? { ...item, status: "carry-forward" as const } : item,
        ),
        newTargets: current.newTargets.map((item) =>
          item.slot === slot
            ? {
                ...item,
                action: target.action,
                owner: target.owner,
                measure: target.measure,
                targetDate: target.targetDate,
                carriedFromId: target.id,
              }
            : item,
        ),
      };
    });
  }

  return (
    <div className={styles.page}>
      <Link className={styles.back} href="/reviews?from=tutor">Back to reviews</Link>
      <h1 className={styles.title}>{review.name || "Digital review"}</h1>
      <p className={styles.status} role="status">{status}</p>
      <section className={styles.card}>
        <div className={styles.head}>
          <h2>Section 1 — Review details</h2>
          <button type="button" className={styles.help} onClick={() => setSection1((open) => !open)} aria-expanded={section1}>
            {section1 ? "–" : "+"}
          </button>
        </div>
        {section1 ? (
          <dl className={styles.grid}>
            {review.section1.map((row) => (
              <div key={row.label}>
                <dt>{row.label}</dt>
                <dd>{row.value}</dd>
              </div>
            ))}
          </dl>
        ) : (
          <p className={styles.meta}>Already filled from the learner record. Tutors do not change this.</p>
        )}
      </section>

      <section className={styles.compare}>
        <div className={`${styles.previous} ${tone("previous-1", form.previousTargets.every((target) => !target.action.trim() || target.status !== "open") ? true : false)}`}>
          <div className={styles.head}>
            <h2>Section 7 — Previous targets</h2>
          </div>
          {form.previousTargets.map((target) => (
            <div key={target.slot} id={target.slot === 1 ? "previous-1" : undefined} className={styles.row}>
              <p className={styles.meta}>Target {target.slot}</p>
              <p>{target.action.trim() || "No previous target"}</p>
              <div className={styles.statuses}>
                {([
                  ["met", "Met"],
                  ["partly", "Partly met"],
                  ["not-met", "Not met"],
                  ["carry-forward", "Carry forward"],
                ] as const).map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    disabled={!review.editable || !target.action.trim()}
                    className={target.status === value ? styles.on : ""}
                    onClick={() => {
                      touch("previous-1");
                      if (value === "carry-forward") carry(target);
                      else updateTarget("previous", target.slot, { status: value });
                    }}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
        <div className={styles.current}>
          <div className={styles.head}>
            <h2>Section 2 — Current targets</h2>
            <button type="button" className={styles.help} aria-label="Help" onClick={() => setHelp("target")}>?</button>
          </div>
          <div id="summary" className={`${styles.field} ${tone("summary", Boolean(form.previousSummary.trim()))}`}>
            <span>Tutor summary of the previous review <button type="button" className={styles.help} aria-label="How to write the previous review summary" onClick={() => setHelp("summary")}>?</button></span>
            <textarea
              value={form.previousSummary}
              readOnly={!review.editable}
              onChange={(event) => {
                touch("summary");
                setForm({ ...form, previousSummary: limit(event.target.value, 65) });
              }}
            />
            <button type="button" className={styles.ai} onClick={() => improve("summary", form.previousSummary, 65, (next) => setForm({ ...form, previousSummary: next }))}>✦ AI</button>
            <p className={styles.count}>{form.previousSummary.trim() ? form.previousSummary.trim().split(/\s+/).length : 0}/65</p>
          </div>
          {form.newTargets.map((target) => {
            const started = Boolean(target.action || target.owner || target.measure || target.targetDate);
            const complete = !started ? null : Boolean(target.action && target.owner && target.measure && target.targetDate && target.targetDate >= review.today && target.targetDate <= maxDate);
            return (
              <div key={target.slot} id={`target-${target.slot}`} className={`${styles.row} ${tone(`target-${target.slot}`, complete)}`}>
                <p className={styles.meta}>Target {target.slot}</p>
                <label className={styles.field}>
                  <span>Action / target</span>
                  <textarea
                    value={target.action}
                    readOnly={!review.editable}
                    onChange={(event) => {
                      touch(`target-${target.slot}`);
                      updateTarget("new", target.slot, { action: limit(event.target.value, 38) });
                    }}
                  />
                </label>
                <label className={styles.label}>
                  Owner
                  <select
                    value={target.owner}
                    disabled={!review.editable}
                    onChange={(event) => {
                      touch(`target-${target.slot}`);
                      updateTarget("new", target.slot, { owner: event.target.value });
                    }}
                  >
                    <option value="">Choose</option>
                    {TARGET_OWNERS.map((owner) => <option key={owner}>{owner}</option>)}
                  </select>
                </label>
                <div className={styles.label}>
                  Target date
                  <TutorDatePicker
                    value={target.targetDate}
                    today={review.today}
                    weeks={weeks}
                    disabled={!review.editable}
                    onChange={(next) => {
                      touch(`target-${target.slot}`);
                      updateTarget("new", target.slot, { targetDate: next });
                    }}
                  />
                </div>
                <label className={styles.field}>
                  <span>Success measure</span>
                  <textarea
                    value={target.measure}
                    readOnly={!review.editable}
                    onChange={(event) => {
                      touch(`target-${target.slot}`);
                      updateTarget("new", target.slot, { measure: limit(event.target.value, 47) });
                    }}
                  />
                </label>
              </div>
            );
          })}
        </div>
      </section>

      <section className={styles.card}>
        <div className={styles.head}>
          <h2>Section 3 — Progress update</h2>
          <button type="button" className={styles.help} aria-label="How to fill progress" onClick={() => setHelp("overall_progress")}>?</button>
        </div>
        {form.progress.map((row) => (
          <ProgressRow
            key={row.area}
            row={row}
            editable={review.editable}
            className={tone(`progress-${row.area}`, progressComplete(row))}
            onTouch={() => touch(`progress-${row.area}`)}
            onChange={(patch) => {
              setForm((current) => ({
                ...current,
                progress: current.progress.map((item) => (item.area === row.area ? { ...item, ...patch } : item)),
              }));
            }}
            onImprove={(value, words, apply) => improve("evidence", value, words, apply)}
            onHelp={() => setHelp(row.area)}
          />
        ))}
      </section>

      <section id="comment" className={`${styles.card} ${tone("comment", Boolean(form.tutorComment.trim()))}`}>
        <div className={styles.head}>
          <h2>Section 4 — GTA tutor comments</h2>
          <button type="button" className={styles.help} aria-label="Help" onClick={() => setHelp("comment")}>?</button>
        </div>
        <div className={styles.field}>
          <textarea
            value={form.tutorComment}
            readOnly={!review.editable}
            onChange={(event) => {
              touch("comment");
              setForm({ ...form, tutorComment: limit(event.target.value, 400) });
            }}
          />
          <button type="button" className={styles.ai} onClick={() => improve("comment", form.tutorComment, 400, (next) => setForm({ ...form, tutorComment: next }))}>✦ AI</button>
          <p className={styles.count}>{form.tutorComment.trim() ? form.tutorComment.trim().split(/\s+/).length : 0}/400</p>
        </div>
      </section>

      <div className={styles.bar}>
        <span className={styles.meta}>{review.editable ? "Autosave is on." : "This review is read only."}</span>
        <div className={styles.actions}>
          <button type="button" onClick={preview}>Preview PDF</button>
          {review.editable ? (
            <button type="button" className={`${styles.send} ${gap ? "" : styles.ready} ${shake ? styles.shake : ""}`} onClick={send}>
              Send back to reviewer
            </button>
          ) : null}
        </div>
      </div>

      {help ? <TutorHelpDialog topic={help} onClose={() => setHelp(null)} /> : null}
    </div>
  );
}

function progressComplete(row: ProgressDraft): boolean | null {
  if (!row.evidence.trim() && !row.rag && !row.targetHours && !row.currentHours) return null;
  if (row.area === "off_the_job") {
    const target = Number(row.targetHours);
    const current = Number(row.currentHours);
    return Boolean(row.evidence.trim() && row.targetHours.trim() && target > 0 && row.currentHours.trim() && Number.isFinite(current));
  }
  if (!row.evidence.trim() && !row.rag) return null;
  return Boolean(row.evidence.trim() && ["red", "amber", "green"].includes(row.rag));
}

function ProgressRow({
  row,
  editable,
  className,
  onTouch,
  onChange,
  onImprove,
  onHelp,
}: {
  row: ProgressDraft;
  editable: boolean;
  className: string;
  onTouch: () => void;
  onChange: (patch: Partial<ProgressDraft>) => void;
  onImprove: (value: string, words: number, apply: (next: string) => void) => void;
  onHelp: () => void;
}) {
  const spec = PROGRESS_ROWS.find((item) => item.id === row.area);
  const track = row.area === "off_the_job" ? otjTrack(row.targetHours, row.currentHours) : null;
  const na = "naComment" in (spec || {}) ? (spec as { naComment?: string }).naComment : undefined;
  return (
    <div id={`progress-${row.area}`} className={`${styles.row} ${className}`}>
      <div className={styles.head}>
        <strong>{spec?.label}</strong>
        <button type="button" className={styles.help} aria-label={`How to fill ${spec?.label}`} onClick={onHelp}>?</button>
      </div>
      {row.area === "off_the_job" ? (
        <div className={styles.grid}>
          <label className={styles.label}>
            Target hours
            <input type="number" min={0} value={row.targetHours} disabled={!editable} onChange={(event) => { onTouch(); onChange({ targetHours: event.target.value }); }} />
          </label>
          <label className={styles.label}>
            Current hours
            <input type="number" min={0} value={row.currentHours} disabled={!editable} onChange={(event) => { onTouch(); onChange({ currentHours: event.target.value }); }} />
          </label>
        </div>
      ) : null}
      {track ? (
        <p className={`${styles.meta} ${track.rag === "red" ? styles.red : track.rag === "amber" ? styles.amber : track.rag === "green" ? styles.green : track.rag === "blue" ? styles.blue : ""}`}>
          {track.label}. {track.detail}
        </p>
      ) : null}
      <div className={styles.rags}>
        {(["red", "amber", "green"] as const).map((rag) => (
          <button key={rag} type="button" disabled={!editable} className={row.rag === rag ? styles.on : ""} onClick={() => { onTouch(); onChange({ rag }); }}>
            {rag[0].toUpperCase()}{rag.slice(1)}
          </button>
        ))}
        {na ? (
          <button type="button" className={styles.na} disabled={!editable} onClick={() => { onTouch(); onChange({ evidence: na, rag: "na" }); }}>
            N/A
          </button>
        ) : null}
      </div>
      <label className={styles.field}>
        <span>Evidence</span>
        <textarea
          value={row.evidence}
          readOnly={!editable}
          onChange={(event) => { onTouch(); onChange({ evidence: limit(event.target.value, 90) }); }}
        />
        <button type="button" className={styles.ai} onClick={() => onImprove(row.evidence, 90, (next) => onChange({ evidence: next }))}>✦ AI</button>
      </label>
      <label className={styles.label}>
        Action ref (optional)
        <input
          value={row.actionRef}
          disabled={!editable}
          onChange={(event) => { onTouch(); onChange({ actionRef: limit(event.target.value, 15) }); }}
        />
      </label>
    </div>
  );
}

export function TutorReviewList({
  learners,
}: {
  learners: { gtaId: string; name: string; company: string; postcode: string; programme: string; collegeDay: string; timing: string; band: string; packId: string | null; late: boolean; fillPercent: number; fillRemaining: number; fillStarted: boolean; noticeDays: number | null }[];
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState<string | null>(null);
  const groups = [
    ["need-doing", "Need doing"],
    ["coming-up", "Coming up"],
    ["not-due", "Not due yet"],
    ["sent-back", "Sent back"],
  ] as const;
  const needle = query.trim().toLowerCase();
  const rows = learners.filter((learner) =>
    !needle || [learner.name, learner.company, learner.postcode].join(" ").toLowerCase().includes(needle),
  );
  return (
    <div className={styles.page}>
      <h1 className={styles.title}>Reviews</h1>
      <p className={styles.meta}>Your learners are listed by due date. A review can be filled from two weeks before it is due.</p>
      <input
        className={styles.search}
        aria-label="Search a name, company or postcode"
        placeholder="Search a name, company or postcode"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
      />
      {groups.map(([id, label]) => {
        const group = rows.filter((learner) => learner.band === id);
        if (!group.length) return null;
        return (
          <section key={id}>
            <h2 className={styles.group}>{label} · {group.length}</h2>
            {group.map((learner) => (
              <div key={learner.gtaId}>
                <div className={styles.listBtn}>
                  <button type="button" className={styles.listName} onClick={() => setOpen(open === learner.gtaId ? null : learner.gtaId)}>
                    {learner.name}
                  </button>
                  <span className={styles.chips}>
                    <span className={`${styles.chip} ${learner.late ? styles.red : ""}`}>{learner.timing}</span>
                    {id === "sent-back" ? <span className={styles.chip}>Sent back</span> : null}
                    {learner.packId ? <Link href={`/reviews?from=tutor&pack=${learner.packId}`}>Open review</Link> : null}
                  </span>
                </div>
                {open === learner.gtaId ? (
                  <div>
                    <p className={styles.detail}>{learner.company} · {learner.postcode || "No postcode"} · {learner.programme} · {learner.collegeDay}</p>
                    <p className={styles.detail}>{fillCaption(learner)}</p>
                    {learner.band === "need-doing" ? (
                      <div className={styles.slim} aria-hidden="true"><span style={{ width: `${learner.fillPercent}%` }} /></div>
                    ) : null}
                  </div>
                ) : null}
              </div>
            ))}
          </section>
        );
      })}
    </div>
  );
}
