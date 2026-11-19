import { setResponsivenessAction } from "../actions";
import { checkSummary } from "../domain/applicant-record";
import type { ApplicantDetail } from "../load";
import { ukDate } from "../domain/format";
import { ContactEventButton } from "./ContactEventModal";
import { BackLink, PageHead, Pill, Tick } from "./parts";

const STAGE_ORDER = ["Stage 1", "Interview", "Stage 2", "Induction", "Started"] as const;

function stageState(current: string, step: string): "done" | "current" | "later" {
  const at = STAGE_ORDER.indexOf(current as (typeof STAGE_ORDER)[number]);
  const index = STAGE_ORDER.indexOf(step as (typeof STAGE_ORDER)[number]);
  if (at < 0 || index < 0) return "later";
  if (index < at) return "done";
  if (index === at) return "current";
  return "later";
}

export function ApplicantRecordView({
  base,
  recordId,
  record,
}: {
  base: string;
  recordId: string;
  record: ApplicantDetail | null;
}) {
  if (!record) {
    return (
      <>
        <BackLink href={`${base}/candidates`}>Applicants</BackLink>
        <PageHead
          crumb={<>Onboarding / Applicants / <span>{recordId}</span></>}
          title="Applicant not found"
          lede={`No applicant has the ID ${recordId}.`}
        />
      </>
    );
  }
  const stage1 = record.checks.filter((check) => ["id", "maths", "english"].includes(check.code));
  const stage2 = record.checks.filter((check) => ["tna", "hs_booked", "hs_completed", "file_created", "file_completed"].includes(check.code));
  const stage1Done = stage1.every((check) => check.done);
  const stage1Label = stage1Done ? "Complete" : stage1.some((check) => check.done) ? "In progress" : "Not started";
  const returnTo = `${base}/candidates/${encodeURIComponent(record.candidateId)}`;
  const nextResponsiveness = record.responsiveness === "responsive" ? "unresponsive" : "responsive";
  return (
    <>
      <BackLink href={`${base}/candidates`}>Applicants</BackLink>
      <PageHead
        crumb={<>Onboarding / Applicants / <span>{record.name}</span></>}
        title={record.name}
        lede={record.statusReason ? `Status ${record.status.split("_").join(" ")} · ${record.statusReason}` : `Status ${record.status.split("_").join(" ")}`}
        actions={<ContactEventButton returnTo={returnTo} candidateId={record.candidateId} />}
      />
      <div className="id-row">
        <div>
          <div className="side-label">{record.convertedGtaId ? "Main ID" : "Applicant ID"}</div>
          <div className="readonly-id" aria-readonly="true">{record.convertedGtaId || record.candidateId}</div>
        </div>
        {record.convertedGtaId ? (
          <div>
            <div className="side-label">Applicant ID</div>
            <div className="readonly-id" aria-readonly="true">{record.candidateId}</div>
          </div>
        ) : (
          <div className="hint">Assigned by the system. After a start, the apprentice GTA ID becomes the main ID and this applicant ID stays as a reference.</div>
        )}
      </div>
      <div className="meta-row" style={{ marginTop: -8 }}>
        <span className="muted">{record.site}</span>
        <span className="meta-dot">·</span>
        <span className="muted">{record.programme || "No programme"}</span>
        <span className="meta-dot">·</span>
        <span className="muted">First contact {ukDate(record.firstContactOn)} · {record.source}</span>
        {record.email || record.phone ? (
          <>
            <span className="meta-dot">·</span>
            <span className="muted">{[record.email, record.phone].filter(Boolean).join(" · ")}</span>
          </>
        ) : null}
      </div>
      <div className="progress">
        {STAGE_ORDER.slice(0, 4).map((step, index) => {
          const state = stageState(record.stage, step);
          return (
            <span key={step} style={{ display: "contents" }}>
              {index > 0 ? <div className={state === "later" ? "prog-rule" : "prog-rule on"} /> : null}
              <div className={state === "done" ? "prog-step done" : state === "current" ? "prog-step current" : "prog-step"}>
                <div className="prog-num">{state === "done" ? <Tick /> : index + 1}</div>
                <div className="prog-label">{step}</div>
              </div>
            </span>
          );
        })}
      </div>
      <div className="layout">
        <div className="stack">
          <section className="section">
            <div className="section-head"><h2>Stage 1</h2><Pill tone={stage1Done ? "green" : stage1Label === "In progress" ? "amber" : "grey"}>{stage1Label}</Pill></div>
            <div className="section-body">
              {stage1.map((check) => (
                <CheckLine key={check.code} title={check.label} date={checkSummary(check)} off={!check.done} />
              ))}
            </div>
          </section>
          <section className="section">
            <div className="section-head"><h2>Interview</h2><Pill tone={record.interview?.outcome === "passed" ? "green" : "grey"}>{record.interview ? record.interview.outcome : "Not yet"}</Pill></div>
            <div className="section-body">
              {record.interview ? (
                <CheckLine title={`${record.interview.outcome} · attempt ${record.interview.attempt}`} date={record.interview.sessionOn ? ukDate(record.interview.sessionOn) : "Recorded"} off={false} />
              ) : (
                <p className="muted">No interview yet.</p>
              )}
            </div>
          </section>
          <section className="section">
            <div className="section-head"><h2>Stage 2</h2><Pill tone={record.stage2Approved ? "amber" : "grey"}>{record.stage2Approved ? "In progress" : "Not started"}</Pill></div>
            <div className="section-body">
              {record.stage2Approved || stage2.some((check) => check.done) ? stage2.map((check) => (
                <CheckLine key={check.code} title={check.label} date={checkSummary(check)} off={!check.done} />
              )) : <p className="muted">Stage 2 has not started. An interview has to be passed and approved first.</p>}
            </div>
          </section>
          <section className="section">
            <div className="section-head"><h2>Induction</h2><Pill tone="grey">{record.actualStartOn ? "Started" : "Not started"}</Pill></div>
            <div className="section-body">
              <CheckLine title="Intended intake" date={record.intendedIntakeOn ? ukDate(record.intendedIntakeOn) : "No intended induction"} off={!record.intendedIntakeOn} />
              <CheckLine title="Induction booked" date={record.inductionBooked ? (record.inductionOn ? ukDate(record.inductionOn) : "Booked") : "Not yet"} off={!record.inductionBooked} />
              <CheckLine title="Attendance" date={record.inductionAttendance ? record.inductionAttendance : "Not yet"} off={!record.inductionAttendance} />
              <CheckLine title="Actual start" date={record.actualStartOn ? ukDate(record.actualStartOn) : "Not yet"} off={!record.actualStartOn} />
            </div>
          </section>
        </div>
        <div className="stack">
          <div className="card side-card">
            <div className="side-label">Employer</div>
            <div className="side-value">{record.employerName || "Employer needed"}</div>
            <div className="side-sub"><Pill tone={record.employerStatus === "Confirmed" ? "green" : record.employerStatus === "Identified" ? "amber" : "red"}>{record.employerStatus}</Pill></div>
            {record.employerSite ? <div className="side-sub">{record.employerSite}</div> : null}
            {record.employerManager ? <div className="side-sub">{record.employerManager}</div> : null}
            {record.employerName ? null : <div className="side-sub">No employer is recorded yet.</div>}
          </div>
          <div className="card side-card">
            <div className="side-label">Intended induction</div>
            <div className="side-value">{record.intendedIntakeOn ? ukDate(record.intendedIntakeOn) : "No intended induction"}</div>
            <div className="side-sub">{record.intendedIntakeOn ? "Not a booking. A place still needs to be reserved on that intake." : "Nothing is planned yet."}</div>
          </div>
          <div className="card side-card">
            <div className="side-label">Responsiveness</div>
            <div className="side-value">{record.responsiveness === "unresponsive" ? "Unresponsive" : "Responsive"}</div>
            <div className="side-sub">Counted from the original first-contact date, {ukDate(record.firstContactOn)}.</div>
            <div className="side-sub" style={{ marginTop: 10 }}><Pill tone="grey">Review due {ukDate(record.reviewDueOn)}</Pill></div>
            <form action={setResponsivenessAction} style={{ marginTop: 12 }}>
              <input type="hidden" name="returnTo" value={returnTo} />
              <input type="hidden" name="candidateId" value={record.candidateId} />
              <input type="hidden" name="firstContact" value={record.firstContactOn} />
              <input type="hidden" name="responsiveness" value={nextResponsiveness} />
              <button className="btn-secondary" type="submit">{record.responsiveness === "responsive" ? "Mark unresponsive" : "Mark responsive"}</button>
            </form>
          </div>
        </div>
      </div>
      <p className="muted">Checks, the interview, and induction are shown from what is already saved. There is no control on this page to change them.</p>
      <div className="card card-pad">
        <h2 className="card-title">Audit trail</h2>
        {record.events.length ? (
          <div className="timeline">
            {record.events.map((event, index) => (
              <div className="event" key={`${event.title}-${index}`}><div className="rail"><div className="dot" /></div><div className="event-body"><div className="event-title">{event.title}</div><div className="event-meta">{event.meta}</div></div></div>
            ))}
          </div>
        ) : <p className="muted">No events recorded yet.</p>}
      </div>
    </>
  );
}

function CheckLine({ title, date, off }: { title: string; date: string; off: boolean }) {
  return (
    <div className="check">
      <div className={off ? "box" : "box on"}>{off ? null : <Tick />}</div>
      <div><div className="check-title">{title}</div></div>
      <div className="check-dates"><strong>{date}</strong></div>
    </div>
  );
}
