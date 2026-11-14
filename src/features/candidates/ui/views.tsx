import type { ReactNode } from "react";
import Link from "next/link";
import {
  bookResitAction,
  addCalendarEventAction,
  addEmployerActivityAction,
  addIntakeAction,
  addRecruitmentAction,
  addVacancyAction,
  archiveCandidateAction,
  confirmInductionAction,
  createCandidateAction,
  deleteCandidateAction,
  saveDeadlineSettingAction,
  setResponsivenessAction,
} from "../actions";
import { BackLink, ExampleChip, MissingNote, PageHead, Pill, Plus, Tick } from "./parts";

export type CandidatesViewProps = {
  base: string;
  example: boolean;
  missing: boolean;
  error: string | null;
  query: string;
};

function q(example: boolean, extra = ""): string {
  const params = new URLSearchParams(extra);
  if (example) params.set("example", "1");
  const text = params.toString();
  return text ? `?${text}` : "";
}

function Frame({
  props,
  children,
}: {
  props: CandidatesViewProps;
  children: ReactNode;
}) {
  return (
    <>
      <MissingNote show={props.missing && !props.example} message={props.error} />
      {props.error && !(props.missing && !props.example) ? (
        <div className="banner banner-red" role="alert">
          <div>{props.error}</div>
        </div>
      ) : null}
      {children}
    </>
  );
}

const ROWS = [
  ["Maya Henshaw", "GTA-C-000042", "Doncaster", "Light Vehicle", "navy", "Stage 2", "green", "Confirmed", "green", "Responsive", "Complete H&S visit", false],
  ["Callum Briggs", "GTA-C-000108", "Sheffield", "Autocare", "navy", "Interview", "red", "Employer needed", "green", "Responsive", "Stage 2 locked: employer not confirmed", true],
  ["Priya Naylor", "—", "Doncaster", "Heavy Vehicle", "grey", "Stage 1", "amber", "Identified", "green", "Responsive", "Sit Maths assessment", false],
  ["Sophie Ware", "GTA-C-000088", "Doncaster", "Business Admin", "navy", "Interview", "green", "Confirmed", "green", "Responsive", "Await Anne-Marie approval", false],
  ["Lewis Cartwright", "GTA-C-000071", "Sheffield", "Customer Service", "green", "Induction", "green", "Confirmed", "green", "Responsive", "Attend induction 4 Jan 2027", false],
  ["Jordan Blake", "GTA-C-000120", "Sheffield", "Vehicle Paint", "navy", "Interview", "amber", "Identified", "amber", "Unresponsive", "Stage 2 locked: employer not confirmed", true],
  ["Ethan Patel", "GTA-C-000066", "Doncaster", "Vehicle Panel", "grey", "Stage 1", "red", "Employer needed", "green", "Responsive", "Verify ID", false],
  ["Freya Moss", "—", "Sheffield", "Light Vehicle", "navy", "Stage 2", "green", "Confirmed", "green", "Responsive", "Create learner file", false],
  ["Noah Bennett", "GTA-C-000014", "Doncaster", "Autocare", "navy", "Interview", "green", "Confirmed", "green", "Responsive", "Book Monday session (attempt 2)", false],
  ["Harper Quinn", "GTA-C-000152", "Sheffield", "Heavy Vehicle", "grey", "Stage 1", "red", "Employer needed", "green", "Responsive", "Record English result", false],
] as const;

export function CandidatesList(props: CandidatesViewProps) {
  const { base, example } = props;
  const show = example;
  return (
    <Frame props={props}>
      <PageHead
        crumb={<>Onboarding / <span>Candidates</span></>}
        title="Candidates"
        lede="Recruitment records for people who have not yet started as an apprentice. Nothing is removed automatically — overdue reviews stay on Due for review until you archive them."
        actions={
          <>
            <ExampleChip show={example} />
            <Link className="btn" href={`${base}/candidates/new${q(example)}`}><Plus /> Add candidate</Link>
          </>
        }
      />
      <div className="tabs">
        <div className="tab-on">Active <span className="count">{show ? "24" : "0"}</span></div>
        <Link className="tab-amber" href={`${base}/candidates/due${q(example)}`}>Due for review <span className="count">{show ? "5" : "0"}</span></Link>
        <Link className="tab" href={`${base}/candidates${q(example, "tab=archived")}`}>Archived <span className="count">{show ? "11" : "0"}</span></Link>
        <Link className="tab" href={`${base}/candidates${q(example, "tab=started")}`}>Started <span className="count">{show ? "2" : "0"}</span></Link>
      </div>
      <div className="card card-pad">
        <form className="filters" method="get">
          {example ? <input type="hidden" name="example" value="1" /> : null}
          <label className="field field-grow"><span className="label">Search</span><input type="search" name="q" placeholder="Name or ID" defaultValue="" /></label>
          <label className="field field-sm"><span className="label">Site</span><select name="site"><option>All sites</option><option>Doncaster</option><option>Sheffield</option></select></label>
          <label className="field field-md"><span className="label">Programme</span><select name="programme"><option>All programmes</option><option>Autocare</option><option>Light Vehicle</option><option>Heavy Vehicle</option><option>Vehicle Paint</option><option>Vehicle Panel</option><option>Business Admin</option><option>Customer Service</option></select></label>
          <label className="field field-sm"><span className="label">Stage</span><select name="stage"><option>All stages</option><option>Stage 1</option><option>Interview</option><option>Stage 2</option><option>Induction</option></select></label>
          <label className="field field-md"><span className="label">Employer</span><select name="employer"><option>All employer statuses</option><option>Employer needed</option><option>Identified</option><option>Confirmed</option></select></label>
        </form>
      </div>
      <div className="card table-wrap">
        <table>
          <colgroup>
            <col style={{ width: "16%" }} />
            <col style={{ width: "14%" }} />
            <col style={{ width: "11%" }} />
            <col style={{ width: "13%" }} />
            <col style={{ width: "10%" }} />
            <col style={{ width: "13%" }} />
            <col style={{ width: "12%" }} />
            <col style={{ width: "11%" }} />
          </colgroup>
          <thead>
            <tr>
              <th>Candidate</th><th>ID</th><th>Site</th><th>Programme</th><th>Stage</th><th>Employer status</th><th>Responsiveness</th><th>Next step</th>
            </tr>
          </thead>
          <tbody>
            {show ? ROWS.map((row) => (
              <tr key={row[0]}>
                <td><Link className="name" href={`${base}/candidates/${row[0] === "Maya Henshaw" ? "GTA-C-000042" : row[1]}${q(example)}`}>{row[0]}</Link></td>
                <td className="mono muted nowrap">{row[1]}</td>
                <td className="nowrap">{row[2]}</td>
                <td className="nowrap">{row[3]}</td>
                <td><Pill tone={row[4]}>{row[5]}</Pill></td>
                <td><Pill tone={row[6]}>{row[7]}</Pill></td>
                <td><Pill tone={row[8]}>{row[9]}</Pill></td>
                <td className={row[11] ? "next-step blocked" : "next-step"}>{row[10]}</td>
              </tr>
            )) : (
              <tr><td colSpan={8} className="muted">No candidates yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>
      <p className="footer-note">{show ? "Showing 10 of 24 active candidates. Example data only." : "Active candidates appear here after the migration is applied. Started candidates stay off this list."}</p>
    </Frame>
  );
}

export function CandidateRecord(props: CandidatesViewProps) {
  const { base, example } = props;
  return (
    <Frame props={props}>
      <BackLink href={`${base}/candidates${q(example)}`}>Candidates</BackLink>
      <PageHead
        crumb={<>Onboarding / Candidates / <span>Maya Henshaw</span></>}
        title="Maya Henshaw"
        actions={<ExampleChip show={example} />}
      />
      <div className="meta-row" style={{ marginTop: -8 }}>
        <span className="pill pill-grey mono">GTA-C-000042</span>
        <span className="muted">Doncaster</span>
        <span className="meta-dot">·</span>
        <span className="muted">Light Vehicle</span>
        <span className="meta-dot">·</span>
        <span className="muted">First contact 3 Mar 2026 · School event</span>
        <span className="meta-dot">·</span>
        <span className="muted">maya.henshaw@example.com · 07700 900042</span>
      </div>
      <div className="progress">
        <div className="prog-step done"><div className="prog-num"><Tick /></div><div className="prog-label">Stage 1</div></div>
        <div className="prog-rule on" />
        <div className="prog-step done"><div className="prog-num"><Tick /></div><div className="prog-label">Interview</div></div>
        <div className="prog-rule on" />
        <div className="prog-step current"><div className="prog-num">3</div><div className="prog-label">Stage 2</div></div>
        <div className="prog-rule" />
        <div className="prog-step"><div className="prog-num">4</div><div className="prog-label">Induction</div></div>
      </div>
      <div className="layout">
        <div className="stack">
          <section className="section collapsed">
            <div className="section-head"><Chevron /><h2>Stage 1</h2><Pill tone="green">Complete</Pill></div>
            <div className="summary">ID verified 12 Mar 2026 · Maths pass 19 Mar 2026 · English pass 19 Mar 2026</div>
          </section>
          <section className="section">
            <div className="section-head"><Chevron /><h2>Interview</h2><Pill tone="green">Passed</Pill></div>
            <div className="section-body">
              <div className="banner banner-green"><div><strong>Passed on first attempt</strong> and approved by Anne-Marie. Maya can enter Stage 2 because her employer is confirmed.</div></div>
              <Check title="Monday group session" sub="14 Sep 2026 · 6 of 8 places used that morning" date="14 Sep 2026" by="Entered 14 Sep 2026 by Anne-Marie" />
              <Check title="Outcome" sub="Passed · attempt 1" date="14 Sep 2026" by="Entered 14 Sep 2026 by Anne-Marie" />
              <Check title="Approved by Anne-Marie" sub="Required before Stage 2 can start" date="16 Sep 2026" by="Entered 16 Sep 2026 by Anne-Marie" />
            </div>
          </section>
          <section className="section">
            <div className="section-head"><Chevron /><h2>Stage 2</h2><Pill tone="amber">In progress</Pill></div>
            <div className="section-body">
              <Check title="TNA completed" sub="Training needs analysis held at Northbridge Motors" date="2 Oct 2026" by="Entered 3 Oct 2026 by J. Hartley" />
              <Check title="H&S visit booked" sub="Visit scheduled for 20 Nov 2026" date="8 Oct 2026" by="Entered 8 Oct 2026 by Anne-Marie" />
              <Check title="H&S visit completed" sub="Waiting for the booked visit on 20 Nov 2026" date="Not yet" by="—" off />
              <Check title="Learner file created" sub="File opened on the candidate record" date="Not yet" by="—" off />
              <Check title="Learner file completed" sub="All Stage 2 documents present" date="Not yet" by="—" off />
            </div>
          </section>
          <section className="section">
            <div className="section-head"><Chevron /><h2>Induction</h2><Pill tone="grey">Not started</Pill></div>
            <div className="section-body">
              <Check title="Intended intake" sub="4 Jan 2027 · this is a plan date, not a booking" date="Intended 4 Jan 2027" by="Entered 18 Sep 2026 by Anne-Marie" off />
              <Check title="Induction booked" sub="A place on an intake must be booked separately" date="Not yet" by="—" off />
              <Check title="Attendance" sub="Confirmed only after the induction day" date="Not yet" by="—" off />
              <Check title="Actual start" sub="Becomes an apprentice record once attendance is confirmed. A start is counted only once." date="Not yet" by="—" off />
            </div>
          </section>
        </div>
        <div className="stack">
          <div className="card side-card">
            <div className="side-label">Employer</div>
            <div className="side-value">Northbridge Motors</div>
            <div className="side-sub"><Pill tone="green">Confirmed</Pill></div>
            <div className="side-sub">Confirmed 18 Sep 2026, entered the same day by Anne-Marie. A vacancy is optional.</div>
          </div>
          <div className="card side-card">
            <div className="side-label">Intended induction</div>
            <div className="side-value">4 Jan 2027</div>
            <div className="side-sub">Not a booking. A place still needs to be reserved on that intake.</div>
          </div>
          <div className="card side-card">
            <div className="side-label">Responsiveness</div>
            <div className="side-value">Responsive</div>
            <div className="side-sub">Counted from the original first-contact date, 3 Mar 2026. Switching back to responsive restores the 1-year date.</div>
            <div className="side-sub" style={{ marginTop: 10 }}><Pill tone="grey">Review due 3 Mar 2027</Pill></div>
            <form action={setResponsivenessAction} style={{ marginTop: 12 }}>
              <input type="hidden" name="returnTo" value={`${base}/candidates/GTA-C-000042${q(example)}`} />
              <input type="hidden" name="candidateId" value="GTA-C-000042" />
              <input type="hidden" name="firstContact" value="2026-03-03" />
              <input type="hidden" name="responsiveness" value="unresponsive" />
              <button className="btn-secondary" type="submit">Mark unresponsive</button>
            </form>
          </div>
        </div>
      </div>
      <div className="card card-pad">
        <h2 className="card-title">Audit trail</h2>
        <div className="timeline">
          <Event title="H&S visit booked for 20 Nov 2026" meta="Actual date 8 Oct 2026 · Entered 8 Oct 2026 by Anne-Marie" />
          <Event title="TNA completed" meta="Actual date 2 Oct 2026 · Entered 3 Oct 2026 by J. Hartley" />
          <Event title="Employer confirmed — Northbridge Motors" meta="Actual date 18 Sep 2026 · Entered 18 Sep 2026 by Anne-Marie" />
          <Event title="Interview passed and approved" meta="Actual date 16 Sep 2026 · Entered 16 Sep 2026 by Anne-Marie" />
          <Event title="Attended Monday interview (attempt 1)" meta="Actual date 14 Sep 2026 · Entered 14 Sep 2026 by Anne-Marie" />
          <Event title="Maths pass and English pass" meta="Actual date 19 Mar 2026 · Entered 20 Mar 2026 by J. Hartley" />
          <Event title="ID verified" meta="Actual date 12 Mar 2026 · Entered 12 Mar 2026 by Anne-Marie" />
          <Event title="Candidate record created" meta="Actual date 3 Mar 2026 · Entered 3 Mar 2026 by Anne-Marie · Source: School event" />
        </div>
      </div>
    </Frame>
  );
}

function Chevron() {
  return (
    <svg className="chev-sm" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 9l6 6 6-6" />
    </svg>
  );
}

function Check({ title, sub, date, by, off = false }: { title: string; sub: string; date: string; by: string; off?: boolean }) {
  return (
    <div className="check">
      <div className={off ? "box" : "box on"}>{off ? null : <Tick />}</div>
      <div><div className="check-title">{title}</div><div className="check-sub">{sub}</div></div>
      <div className="check-dates"><strong>{date}</strong>{by}</div>
    </div>
  );
}

function Event({ title, meta }: { title: string; meta: string }) {
  return (
    <div className="event"><div className="rail"><div className="dot" /></div><div className="event-body"><div className="event-title">{title}</div><div className="event-meta">{meta}</div></div></div>
  );
}

export function AddCandidate(props: CandidatesViewProps) {
  const { base, example } = props;
  return (
    <Frame props={props}>
      <BackLink href={`${base}/candidates${q(example)}`}>Candidates</BackLink>
      <PageHead
        crumb={<>Onboarding / Candidates / <span>Add candidate</span></>}
        title="Add candidate"
        lede="Manual entry for a new enquiry. An intended intake is a plan date only — it does not book a place. At entry, the personal fields are name, email and phone."
        actions={<ExampleChip show={example} />}
      />
      <div className="form-layout">
        <form className="card card-pad" action={createCandidateAction}>
          <input type="hidden" name="returnTo" value={`${base}/candidates/new${q(example)}`} />
          <div className="form-grid">
            <label className="field"><span className="label">First name</span><input name="firstName" defaultValue={example ? "Hannah" : ""} required /></label>
            <label className="field"><span className="label">Last name</span><input name="lastName" defaultValue={example ? "Colton" : ""} required /></label>
            <label className="field"><span className="label">Email</span><input name="email" type="email" required placeholder="name@example.com" /></label>
            <label className="field"><span className="label">Phone</span><input name="phone" type="tel" required placeholder="07…" /></label>
            <label className="field"><span className="label">Existing ID, optional</span><input name="externalId" placeholder="If they already have a GTA ID" /></label>
            <label className="field"><span className="label">Site</span><select name="centre" defaultValue="doncaster"><option value="doncaster">Doncaster</option><option value="sheffield">Sheffield</option></select></label>
            <label className="field"><span className="label">Programme</span><select name="programme"><option>Autocare</option><option>Light Vehicle</option><option>Heavy Vehicle</option><option>Vehicle Paint</option><option>Vehicle Panel</option><option>Business Admin</option><option>Customer Service</option></select></label>
            <label className="field"><span className="label">Original first-contact date</span><input name="firstContact" required placeholder="dd/mm/yyyy" defaultValue={example ? "14/11/2026" : ""} /></label>
            <label className="field"><span className="label">Source</span><select name="source"><option>Website</option><option>Social media</option><option>School event</option><option>Google</option><option>Word of mouth</option><option>Leaflet</option><option>Flyer</option><option>GTA prospectus</option><option>Other</option></select></label>
            <label className="field"><span className="label">Employer status</span><select name="employerStatus" defaultValue="needed"><option value="needed">Employer needed</option><option value="identified">Identified</option><option value="confirmed">Confirmed</option></select></label>
            <label className="field wide"><span className="label">Employer</span><input name="employerId" placeholder="Employer ID, optional — a vacancy is not required" /><div className="hint">Required later: a candidate can be interviewed without an employer, but cannot enter Stage 2 until the employer is confirmed.</div></label>
            <label className="field wide"><span className="label">Notes</span><textarea name="notes" defaultValue={example ? "Called after seeing the Autocare page on the GTA website. Interested in a January start if a place is available." : ""} /></label>
          </div>
          <div style={{ display: "flex", gap: 8, marginTop: 18, justifyContent: "flex-end" }}>
            <Link className="btn-secondary" href={`${base}/candidates${q(example)}`}>Cancel</Link>
            <button className="btn" type="submit">Save candidate</button>
          </div>
        </form>
        <div className="stack">
          <div className="card side-card">
            <div className="side-label">What happens next</div>
            <div className="side-value">Starts in Stage 1</div>
            <div className="side-sub">Every new candidate begins in Stage 1. Nothing is marked complete automatically. Maths and English must both be passed before an interview.</div>
            <ul className="help-list">
              <li>ID verified, with the actual date</li>
              <li>Maths pass or fail, with the actual date</li>
              <li>English pass or fail, with the actual date</li>
            </ul>
            <div className="side-sub" style={{ marginTop: 12 }}>The new ID is GTA-C-000001. Review is due 1 year from the original first-contact date while Responsive, or 3 months if Unresponsive.</div>
          </div>
        </div>
      </div>
    </Frame>
  );
}

export function InterviewsPage(props: CandidatesViewProps) {
  const { example, base } = props;
  const mondays = [
    ["Mon 16 Nov 2026 · Doncaster", "Next session", "navy", "6 of 8 booked"],
    ["Mon 23 Nov 2026 · Sheffield", "", "grey", "2 of 8 booked"],
    ["Mon 30 Nov 2026 · Doncaster", "", "grey", "0 of 8 booked"],
    ["Mon 7 Dec 2026 · Sheffield", "", "grey", "1 of 8 booked"],
    ["Mon 14 Dec 2026 · Doncaster", "", "grey", "0 of 8 booked"],
    ["Mon 21 Dec 2026 · Sheffield", "", "grey", "0 of 8 booked"],
  ] as const;
  return (
    <Frame props={props}>
      <PageHead
        crumb={<>Onboarding / <span>Interviews</span></>}
        title="Interviews"
        lede="Group sessions run on Mondays, with a maximum of 8 candidates. Bank holidays are skipped. Resits are booked on their own dates. A candidate can be interviewed without an employer, but cannot enter Stage 2 until one is confirmed."
        actions={<ExampleChip show={example} />}
      />
      <div className="overview-grid">
        <div className="card card-pad">
          <div className="card-title" style={{ marginBottom: 4 }}>Latest session · Monday 9 Nov 2026</div>
          <p className="muted" style={{ marginBottom: 14 }}>Doncaster · awaiting Anne-Marie’s approval on the outstanding outcomes</p>
          <div className="places"><strong>{example ? "7" : "0"}</strong> <span>of 8 places used · 1 no-show</span></div>
          <div className="meter"><i style={{ width: example ? "87.5%" : "0%" }} /></div>
        </div>
        <div className="card card-pad">
          <div className="card-title" style={{ marginBottom: 4 }}>Next Monday · 16 Nov 2026</div>
          <p className="muted" style={{ marginBottom: 14 }}>Doncaster · bookings only, session not yet held</p>
          <div className="places"><strong>{example ? "6" : "0"}</strong> <span>of 8 places booked</span></div>
          <div className="meter"><i style={{ width: example ? "75%" : "0%" }} /></div>
        </div>
      </div>
      <div className="card table-wrap">
        <div className="card-pad" style={{ paddingBottom: 8 }}><h2 className="card-title" style={{ margin: 0 }}>Attendees · 9 Nov 2026</h2></div>
        <table>
          <thead><tr><th>Candidate</th><th>Attendance</th><th>Outcome</th><th>Attempt</th><th>Decision</th></tr></thead>
          <tbody>
            {example ? (
              <>
                <Attendee name="Sophie Ware" attendance="Present" outcome="Passed" outcomeTone="green" attempt="1" decision="Pending approval" decisionTone="amber" />
                <Attendee name="Callum Briggs" attendance="Present" outcome="Passed" outcomeTone="green" attempt="1" decision="Pending approval" decisionTone="amber" />
                <Attendee name="Harper Quinn" attendance="Present" outcome="Passed" outcomeTone="green" attempt="1" decision="Pending approval" decisionTone="amber" />
                <Attendee name="Noah Bennett" attendance="Present" outcome="Failed" outcomeTone="red" attempt="2" decision="Approved" decisionTone="green" />
                <Attendee name="Dylan Shore" attendance="Present" outcome="Passed" outcomeTone="green" attempt="1" decision="Approved" decisionTone="green" />
                <Attendee name="Ivy Morton" attendance="Present" outcome="Failed" outcomeTone="red" attempt="1" decision="Approved" decisionTone="green" />
                <Attendee name="Reuben Clark" attendance="Present" outcome="Passed" outcomeTone="green" attempt="1" decision="Approved" decisionTone="green" />
                <Attendee name="Jordan Blake" attendance="No show" outcome="—" outcomeTone="grey" attempt="1" decision="Follow-up needed" decisionTone="red" attendanceTone="red" />
              </>
            ) : <tr><td colSpan={5} className="muted">No interview sessions yet.</td></tr>}
          </tbody>
        </table>
      </div>
      {example ? <div className="banner banner-red"><div><strong>No-show follow-up.</strong> Jordan Blake did not attend the 9 Nov session (attempt 1). A follow-up was due by 11 Nov 2026 and is now overdue. Responsiveness is already set to Unresponsive, so the review date is 3 months after first contact. An employer is Identified but not confirmed — even after a later pass, Stage 2 stays locked until the employer is confirmed. A cancelled or rescheduled place stays taken unless Anne-Marie chooses to free it.</div></div> : null}
      <div className="card card-pad">
        <h2 className="card-title">Upcoming Mondays</h2>
        <p className="muted" style={{ margin: "-4px 0 12px" }}>Bank holidays are skipped. Monday 28 Dec 2026 is a substitute Boxing Day holiday, so there is no session that week.</p>
        <div className="monday-list">
          {(example ? mondays : []).map((row) => (
            <div className="monday" key={row[0]}>
              <div><div className="when">{row[0]}</div>{row[1] ? <div className="seats">{row[1]}</div> : null}</div>
              <Pill tone={row[2]}>{row[3]}</Pill>
            </div>
          ))}
          <div className="monday skip">
            <div><div className="when">Mon 28 Dec 2026</div><div className="seats">Skipped — substitute Boxing Day bank holiday</div></div>
            <Pill tone="grey">No session</Pill>
          </div>
          {example ? (
            <div className="monday">
              <div><div className="when">Mon 4 Jan 2027 · Doncaster</div></div>
              <Pill tone="grey">0 of 8 booked</Pill>
            </div>
          ) : null}
          {!example ? <p className="muted">Monday groups appear here once sessions are saved.</p> : null}
        </div>
      </div>
      <div className="card card-pad">
        <h2 className="card-title">Resits</h2>
        <p className="muted" style={{ margin: "-4px 0 12px" }}>A resit is its own date. It is not added to a Monday group of 8. Three failures, then 6 months from the third failure, then one final attempt with a manual outcome.</p>
        <form className="filters" action={bookResitAction}>
          <input type="hidden" name="returnTo" value={`${base}/interviews${q(example)}`} />
          <label className="field"><span className="label">Candidate ID</span><input name="candidateId" placeholder="GTA-C-000001" required /></label>
          <label className="field"><span className="label">Resit date</span><input name="resitOn" type="date" required /></label>
          <label className="field"><span className="label">Site</span><select name="centre"><option value="doncaster">Doncaster</option><option value="sheffield">Sheffield</option></select></label>
          <label className="field"><span className="label">Free the Monday place?</span><select name="freesPlace" defaultValue="no"><option value="no">Keep the place taken</option><option value="yes">Anne-Marie frees the place</option></select></label>
          <button className="btn" type="submit">Book resit</button>
        </form>
      </div>
    </Frame>
  );
}

function Attendee({ name, attendance, attendanceTone = "green", outcome, outcomeTone, attempt, decision, decisionTone }: {
  name: string; attendance: string; attendanceTone?: "green" | "red"; outcome: string; outcomeTone: "green" | "red" | "grey"; attempt: string; decision: string; decisionTone: "amber" | "green" | "red";
}) {
  return (
    <tr>
      <td className="name">{name}</td>
      <td><Pill tone={attendanceTone}>{attendance}</Pill></td>
      <td><Pill tone={outcomeTone}>{outcome}</Pill></td>
      <td>{attempt}</td>
      <td><Pill tone={decisionTone}>{decision}</Pill></td>
    </tr>
  );
}

export function OverviewPage(props: CandidatesViewProps) {
  const { base, example } = props;
  return (
    <Frame props={props}>
      <PageHead
        crumb={<>Onboarding / <span>Overview</span></>}
        title="Candidates overview"
        lede="A snapshot of the recruitment pipeline. Use the site filter to look at Doncaster or Sheffield on their own."
        actions={
          <>
            <ExampleChip show={example} />
            <form method="get">
              {example ? <input type="hidden" name="example" value="1" /> : null}
              <label className="field" style={{ minWidth: 150 }}><select name="site" defaultValue="all"><option value="all">All sites</option><option value="doncaster">Doncaster</option><option value="sheffield">Sheffield</option></select></label>
            </form>
          </>
        }
      />
      <div className="metrics">
        <Metric k="Stage 1" v={example ? "8" : "0"} s="ID, Maths and English" />
        <Metric k="Interview" v={example ? "7" : "0"} s="Including 3 pending approval" />
        <Metric k="Stage 2" v={example ? "5" : "0"} s="Employer confirmed" />
        <Metric k="Induction" v={example ? "4" : "0"} s="Intended or booked" />
      </div>
      <div className="overview-grid">
        <div className="card card-pad">
          <h2 className="card-title">Needs attention</h2>
          {example ? (
            <div className="attention">
              <Attn title="Employer needed" items={[["Callum Briggs", "red", "Stage 2 locked", "Sheffield · Autocare · Interview passed"], ["Ethan Patel", "red", "Employer needed", "Doncaster · Vehicle Panel · still in Stage 1"], ["Harper Quinn", "red", "Employer needed", "Sheffield · Heavy Vehicle · still in Stage 1"]]} />
              <Attn title="Decision pending" items={[["Sophie Ware", "amber", "Awaiting Anne-Marie", "Doncaster · 9 Nov session · Passed"], ["Callum Briggs", "amber", "Awaiting Anne-Marie", "Sheffield · 9 Nov session · Passed"], ["Harper Quinn", "amber", "Awaiting Anne-Marie", "Sheffield · 9 Nov session · Passed"]]} />
              <Attn title="Due for review" items={[["Amira Khan", "red", "3 months overdue", "Doncaster · Unresponsive · due 12 Nov"], ["Oscar Flynn", "amber", "Due this week", "Sheffield · Responsive · due 16 Nov"], ["Lila Bennett", "amber", "Due this month", "Doncaster · Responsive · due 20 Nov"]]} />
              <Attn title="Overdue follow-ups" items={[["Jordan Blake", "red", "Overdue", "No-show on 9 Nov · follow-up due 11 Nov"], ["Ivy Morton", "red", "Overdue", "Failed attempt 1 · still needs attempt 2 booked"]]} />
            </div>
          ) : <p className="muted">Nothing needs attention yet.</p>}
        </div>
        <div className="stack">
          <div className="card card-pad">
            <h2 className="card-title">Next interview</h2>
            <div className="side-value">{example ? "Monday 16 Nov 2026" : "No session booked"}</div>
            <div className="side-sub">Doncaster · group session, maximum of 8</div>
            <div className="places" style={{ marginTop: 12 }}><strong>{example ? "6" : "0"}</strong> <span>of 8 places booked</span></div>
            <div className="meter"><i style={{ width: example ? "75%" : "0%" }} /></div>
            <div style={{ marginTop: 14 }}><Link className="btn-secondary" href={`${base}/interviews${q(example)}`}>Open interviews</Link></div>
          </div>
          <div className="card card-pad">
            <h2 className="card-title">Pipeline</h2>
            <div className="side-sub" style={{ marginTop: -4 }}>{example ? "24 active candidates across both sites. 5 are on Due for review and stay there until they are updated or archived — nothing is deleted automatically." : "Counts stay at zero until candidates are saved."}</div>
            <div style={{ marginTop: 14 }}><Link className="btn-secondary" href={`${base}/candidates${q(example)}`}>Open candidates</Link></div>
          </div>
        </div>
      </div>
    </Frame>
  );
}

function Metric({ k, v, s }: { k: string; v: string; s: string }) {
  return <div className="card metric"><div className="k">{k}</div><div className="v">{v}</div><div className="s">{s}</div></div>;
}

function Attn({ title, items }: { title: string; items: Array<[string, "red" | "amber", string, string]> }) {
  return (
    <div>
      <div className="side-label" style={{ marginBottom: 4 }}>{title}</div>
      {items.map((item) => (
        <div className="attn-item" key={`${title}-${item[0]}-${item[2]}`}>
          <div className="attn-top"><div className="attn-name">{item[0]}</div><Pill tone={item[1]}>{item[2]}</Pill></div>
          <div className="attn-sub">{item[3]}</div>
        </div>
      ))}
    </div>
  );
}

export function EmployersPage(props: CandidatesViewProps) {
  const { base, example } = props;
  const rows: Array<[string, string, string, string, string, string, string, boolean, string]> = [
    ["Northbridge Motors", "Wheatley Hall Road", "Doncaster", "2", "2", "12 Nov 2026", "10 Nov 2026", true, "Word of mouth"],
    ["Ashfield Coachworks", "Attercliffe", "Sheffield", "1", "2", "8 Nov 2026", "20 Nov 2026", false, "Website"],
    ["Riverside Fleet Services", "Lakeside", "Doncaster", "1", "2", "4 Nov 2026", "25 Nov 2026", false, "School event"],
    ["Hallam Street Garage", "Walkley", "Sheffield", "1", "1", "13 Nov 2026", "18 Nov 2026", false, "Google"],
    ["Fenwick Auto Centre", "Balby", "Doncaster", "0", "0", "2 Oct 2026", "—", false, "Leaflet"],
    ["Oakwell Commercials", "Barnsley Road", "Sheffield", "0", "0", "29 Oct 2026", "7 Nov 2026", true, "GTA prospectus"],
    ["Carta Office Services", "Hyde Park", "Doncaster", "1", "0", "9 Nov 2026", "16 Nov 2026", false, "Website"],
    ["Meadowside Contact Centre", "Meadowhall", "Sheffield", "1", "0", "6 Nov 2026", "2 Dec 2026", false, "Social media"],
  ];
  return (
    <Frame props={props}>
      <PageHead
        crumb={<>Onboarding / <span>Employers & vacancies</span></>}
        title="Employers & vacancies"
        lede="Employers are the Portal’s employer records. Vacancies sit on an employer and can be offered to candidates. A candidate can have a confirmed employer with no vacancy. Filled and cancelled vacancies are kept, but their places are not available."
        actions={<><ExampleChip show={example} /><Link className="btn-secondary" href={`${base}/employer`}>Add employer</Link><Link className="btn" href={`${base}/vacancies${q(example)}`}><Plus /> Add vacancy</Link></>}
      />
      <div className="tabs">
        <div className="tab-on">Employers <span className="count">{example ? "8" : "0"}</span></div>
        <Link className="tab" href={`${base}/vacancies${q(example)}`}>Vacancies <span className="count">{example ? "10" : "0"}</span></Link>
      </div>
      <div className="card table-wrap">
        <table>
          <thead><tr><th>Employer</th><th>Site</th><th className="wrap">Open vacancies</th><th className="wrap">Places available</th><th className="wrap">Last contact</th><th className="wrap">Next follow-up</th><th>Source</th></tr></thead>
          <tbody>
            {example ? rows.map((row) => (
              <tr key={row[0]}>
                <td><Link className="name" href={`${base}/employers/${encodeURIComponent(String(row[0]))}${q(example)}`}>{row[0]}</Link><div className="note-inline">{row[1]}</div></td>
                <td className="nowrap">{row[2]}</td>
                <td className="frac">{row[3]}</td>
                <td className="frac">{row[4]}</td>
                <td className="nowrap">{row[5]}</td>
                <td className="nowrap">{row[6] === "—" ? "—" : row[7] ? <span className="date-overdue">{row[6]}</span> : row[6]}</td>
                <td className="nowrap">{row[8]}</td>
              </tr>
            )) : <tr><td colSpan={7} className="muted">No employer activity yet. Existing employers are unchanged.</td></tr>}
          </tbody>
        </table>
      </div>
      <form className="card card-pad" action={addVacancyAction}>
        <h2 className="card-title">Add vacancy</h2>
        <input type="hidden" name="returnTo" value={`${base}/vacancies${q(example)}`} />
        <div className="form-grid">
          <label className="field"><span className="label">Employer ID</span><input name="employerId" placeholder="GTA-EMP-000001" required /></label>
          <label className="field"><span className="label">Title</span><input name="title" required /></label>
          <label className="field"><span className="label">Places</span><input name="places" type="number" min={1} defaultValue={1} /></label>
          <label className="field"><span className="label">Status</span><select name="status"><option value="potential">Potential</option><option value="open">Open</option></select></label>
        </div>
        <div className="hint">Places are allocated only after Stage 2 approval, and never above the total. Withdrawal does not free a place until the employer’s reoffer decision is recorded.</div>
        <div style={{ marginTop: 12, display: "flex", justifyContent: "flex-end" }}><button className="btn" type="submit">Save vacancy</button></div>
      </form>
      <p className="footer-note">Places available excludes filled, cancelled, on-hold and withdrawn places waiting for the employer to decide.</p>
    </Frame>
  );
}

export function VacanciesPage(props: CandidatesViewProps) {
  const { base, example } = props;
  return (
    <Frame props={props}>
      <PageHead
        crumb={<>Onboarding / <span>Employers & vacancies</span></>}
        title="Employers & vacancies"
        lede="Each vacancy belongs to one employer and one programme. Filled, cancelled and on-hold vacancies stay on the list so the history is not lost, but their places cannot be offered."
        actions={<><ExampleChip show={example} /><Link className="btn" href={`${base}/employers${q(example)}`}><Plus /> Add vacancy</Link></>}
      />
      <div className="tabs">
        <Link className="tab" href={`${base}/employers${q(example)}`}>Employers <span className="count">{example ? "8" : "0"}</span></Link>
        <div className="tab-on">Vacancies <span className="count">{example ? "10" : "0"}</span></div>
      </div>
      <div className="card table-wrap">
        <table>
          <thead><tr><th>Vacancy</th><th>Employer</th><th>Programme</th><th>Site</th><th className="wrap">Total / allocated / available</th><th>Status</th></tr></thead>
          <tbody>
            {example ? (
              <>
                <Vacancy title="Light Vehicle Technician" note="1 withdrawn place — employer to decide whether to reoffer" employer="Northbridge Motors" programme="Light Vehicle" site="Doncaster" frac="2 / 1 / 0" status="Confirmed / open" tone="green" />
                <Vacancy title="Autocare Technician" employer="Northbridge Motors" programme="Autocare" site="Doncaster" frac="3 / 1 / 2" status="Confirmed / open" tone="green" />
                <Vacancy title="Vehicle Paint Technician" employer="Ashfield Coachworks" programme="Vehicle Paint" site="Sheffield" frac="2 / 0 / 2" status="Potential opportunity" tone="amber" />
                <Vacancy title="Heavy Vehicle Technician" employer="Riverside Fleet Services" programme="Heavy Vehicle" site="Doncaster" frac="2 / 0 / 2" status="Confirmed / open" tone="green" />
                <Vacancy title="Light Vehicle Technician" employer="Hallam Street Garage" programme="Light Vehicle" site="Sheffield" frac="2 / 1 / 1" status="Confirmed / open" tone="green" />
                <Vacancy title="Autocare Technician" note="Not available — kept on the record" employer="Fenwick Auto Centre" programme="Autocare" site="Doncaster" frac="1 / 1 / 0" status="Filled" tone="grey" />
                <Vacancy title="Heavy Vehicle Technician" note="Places are not available while on hold" employer="Oakwell Commercials" programme="Heavy Vehicle" site="Sheffield" frac="2 / 0 / 0" status="On hold" tone="amber" />
                <Vacancy title="Business Administrator" employer="Carta Office Services" programme="Business Admin" site="Doncaster" frac="1 / 1 / 0" status="Confirmed / open" tone="green" />
                <Vacancy title="Customer Service Practitioner" employer="Meadowside Contact Centre" programme="Customer Service" site="Sheffield" frac="1 / 1 / 0" status="Confirmed / open" tone="green" />
                <Vacancy title="Vehicle Panel Technician" note="Not available — kept on the record" employer="Fenwick Auto Centre" programme="Vehicle Panel" site="Doncaster" frac="1 / 0 / 0" status="Cancelled" tone="red" />
              </>
            ) : <tr><td colSpan={6} className="muted">No vacancies yet.</td></tr>}
          </tbody>
        </table>
      </div>
    </Frame>
  );
}

function Vacancy({ title, note, employer, programme, site, frac, status, tone }: { title: string; note?: string; employer: string; programme: string; site: string; frac: string; status: string; tone: "green" | "amber" | "grey" | "red" }) {
  return (
    <tr>
      <td><div className="name">{title}</div>{note ? <div className="note-inline">{note}</div> : null}</td>
      <td className="name">{employer}</td>
      <td className="nowrap">{programme}</td>
      <td className="nowrap">{site}</td>
      <td className="frac">{frac}</td>
      <td><Pill tone={tone}>{status}</Pill></td>
    </tr>
  );
}

export function EmployerRecord(props: CandidatesViewProps & { employer: string }) {
  const { base, example, employer } = props;
  const name = employer === "Northbridge Motors" || !employer ? "Northbridge Motors" : employer;
  return (
    <Frame props={props}>
      <BackLink href={`${base}/employers${q(example)}`}>Employers & vacancies</BackLink>
      <PageHead
        crumb={<>Onboarding / Employers & vacancies / <span>{name}</span></>}
        title={name}
        actions={<><ExampleChip show={example} /><Link className="btn" href={`${base}/vacancies${q(example)}`}><Plus /> Add vacancy</Link></>}
      />
      <div className="meta-row" style={{ marginTop: -8 }}>
        <span className="muted">Diane Copeland · Workshop manager</span><span className="meta-dot">·</span><span className="muted">diane.copeland@northbridge-motors.example</span>
      </div>
      <div className="card card-pad">
        <div className="side-label">Contact attempts</div>
        <div className="places"><strong>{example ? "7" : "0"}</strong> <span>attempts across 2 distinct contacts</span></div>
        <div className="side-sub">The counter is attempts, not people — both figures are kept so a busy contact is not counted as several employers.</div>
      </div>
      {example ? (
        <>
          <SimpleTable title="Vacancies" heads={["Vacancy", "Programme", "Total / allocated / available", "Status", "Notes"]} rows={[
            ["Light Vehicle Technician", "Light Vehicle", "2 / 1 / 0", "Confirmed / open", "1 withdrawn place is not reopened automatically"],
            ["Autocare Technician", "Autocare", "3 / 1 / 2", "Confirmed / open", "—"],
          ]} />
          <SimpleTable title="Linked candidates" heads={["Candidate", "Vacancy", "Stage", "Place"]} rows={[
            ["Maya Henshaw", "Light Vehicle Technician", "Stage 2", "Allocated"],
            ["Noah Bennett", "Autocare Technician", "Interview", "Allocated"],
            ["Theo Wade", "Light Vehicle Technician", "Withdrawn", "Employer to decide whether to reoffer"],
          ]} />
        </>
      ) : <p className="muted">No vacancies or linked candidates yet.</p>}
      <form className="card card-pad" action={addEmployerActivityAction}>
        <h2 className="card-title">Log a contact attempt</h2>
        <input type="hidden" name="returnTo" value={`${base}/employers/${encodeURIComponent(name)}${q(example)}`} />
        <div className="form-grid">
          <label className="field"><span className="label">Employer ID</span><input name="employerId" placeholder="GTA-EMP-000001" required /></label>
          <label className="field"><span className="label">Type</span><select name="activityType"><option>Call</option><option>Email</option><option>Visit</option></select></label>
          <label className="field"><span className="label">Actual date</span><input name="actualOn" type="date" required /></label>
          <label className="field wide"><span className="label">Notes</span><textarea name="notes" /></label>
        </div>
        <div style={{ marginTop: 12, display: "flex", justifyContent: "flex-end" }}><button className="btn" type="submit">Save activity</button></div>
      </form>
    </Frame>
  );
}

function SimpleTable({ title, heads, rows }: { title: string; heads: string[]; rows: string[][] }) {
  return (
    <div className="card table-wrap">
      <div className="card-pad" style={{ paddingBottom: 8 }}><h2 className="card-title" style={{ margin: 0 }}>{title}</h2></div>
      <table>
        <thead><tr>{heads.map((head) => <th key={head}>{head}</th>)}</tr></thead>
        <tbody>{rows.map((row) => <tr key={row.join("-")}>{row.map((cell) => <td key={cell}>{cell}</td>)}</tr>)}</tbody>
      </table>
    </div>
  );
}

export function CalendarPage(props: CandidatesViewProps) {
  const { example } = props;
  const days = example
    ? ["26", "27", "28", "29", "30", "31", "1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12", "13", "14", "15", "16", "17", "18", "19", "20", "21", "22", "23", "24", "25", "26", "27", "28", "29", "30", "1", "2", "3", "4", "5", "6"]
    : [];
  return (
    <Frame props={props}>
      <PageHead
        crumb={<>Onboarding / <span>Activity calendar</span></>}
        title="Activity calendar"
        lede="A shared month view for marketing and careers activity at both sites. Assigning an owner does not send a message."
        actions={
          <>
            <ExampleChip show={example} />
            <label className="field" style={{ minWidth: 150 }}><select defaultValue="all"><option value="all">All sites</option><option>Doncaster</option><option>Sheffield</option></select></label>
          </>
        }
      />
      <div className="card card-pad">
        <div className="cal-toolbar" style={{ marginBottom: 12 }}>
          <div className="cal-month">November 2026</div>
          <div className="muted">Today is Saturday 14 Nov</div>
        </div>
        <div className="cal-grid">
          {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((dow) => <div className="cal-dow" key={dow}>{dow}</div>)}
          {days.map((day, index) => {
            const mute = index < 6 || index > 35;
            const today = index === 19;
            const selected = index === 23;
            const event = index === 9 ? "Hall Cross talk" : index === 16 ? "Open evening" : index === 23 ? "Roadshow" : index === 30 ? "Social campaign" : index === 32 ? "Breakfast" : "";
            const tone = index === 9 || index === 16 ? "done" : index === 32 ? "booked" : "planned";
            return (
              <div className={`cal-day${mute ? " mute" : ""}${today ? " today" : ""}${selected ? " selected" : ""}`} key={`${day}-${index}`}>
                <div className="cal-num">{day}</div>
                {event ? <div className={`cal-ev ${tone}`}>{event}</div> : null}
              </div>
            );
          })}
        </div>
      </div>
      {example ? (
        <div className="card card-pad">
          <div className="side-label">Selected activity</div>
          <div className="side-value">Sheffield schools roadshow</div>
          <div className="meta-row" style={{ marginTop: 10 }}>
            <Pill tone="navy">Planned</Pill><span className="muted">Wednesday 18 Nov 2026</span><span className="meta-dot">·</span><span className="muted">Sheffield</span>
          </div>
          <div className="form-grid" style={{ marginTop: 16 }}>
            <div><div className="side-label">Intended audience</div><div>Year 10 and Year 11 pupils, with parents welcome in the last hour.</div></div>
            <div><div className="side-label">Owner</div><div>Anne-Marie</div><div className="note-inline">Assigning an owner does not send a message.</div></div>
            <div className="wide"><div className="side-label">Notes</div><div>Stand booked in the sports hall at a Sheffield school cluster event. Status will move to Booked once the school confirms the room, and to Completed after the day.</div></div>
          </div>
        </div>
      ) : <p className="muted">No activities this month.</p>}
      <form className="card card-pad" action={addCalendarEventAction}>
        <h2 className="card-title">Add activity</h2>
        <input type="hidden" name="returnTo" value={`${props.base}/calendar${q(example)}`} />
        <div className="form-grid">
          <label className="field"><span className="label">Title</span><input name="title" required /></label>
          <label className="field"><span className="label">Date</span><input name="eventOn" type="date" required /></label>
          <label className="field wide"><span className="label">Audience</span><input name="audience" required /></label>
          <label className="field wide"><span className="label">Notes</span><textarea name="notes" /></label>
        </div>
        <div style={{ marginTop: 12, display: "flex", justifyContent: "flex-end" }}><button className="btn" type="submit">Save activity</button></div>
      </form>
    </Frame>
  );
}

export function ActionsPage(props: CandidatesViewProps) {
  const { example, base } = props;
  return (
    <Frame props={props}>
      <PageHead
        crumb={<>Onboarding / <span>Actions</span></>}
        title="Actions and decisions"
        lede="Work that needs an owner and a deadline, including decisions that should be checked later. Overdue deadlines are shown in red."
        actions={<><ExampleChip show={example} /></>}
      />
      <div className="card card-pad">
        <div className="filters" style={{ gridTemplateColumns: "1.4fr 1fr 1fr 1fr" }}>
          <label className="field"><span className="label">Search</span><input type="search" placeholder="Action, owner or record" /></label>
          <label className="field"><span className="label">Status</span><select><option>All statuses</option><option>Open</option><option>In progress</option><option>Completed</option></select></label>
          <label className="field"><span className="label">Owner</span><select><option>All owners</option><option>Anne-Marie</option><option>J. Hartley</option></select></label>
          <label className="field"><span className="label">Deadline</span><select><option>Any deadline</option><option>Overdue</option><option>Due this week</option></select></label>
        </div>
      </div>
      <div className="card table-wrap">
        <table>
          <thead><tr><th>Action or decision</th><th>Owner</th><th>Deadline</th><th>How impact will be checked</th><th>Status</th><th>Linked to</th></tr></thead>
          <tbody>
            {example ? (
              <>
                <Action title="Follow up Jordan Blake’s 9 Nov interview no-show" owner="J. Hartley" deadline="11 Nov 2026" overdue impact="Call logged and a new Monday session offered, or responsiveness reviewed" status="In progress" tone="amber" link="Jordan Blake" />
                <Action title="Send overdue TNA summary to Northbridge Motors" owner="J. Hartley" deadline="10 Nov 2026" overdue impact="Diane Copeland confirms receipt of the TNA summary" status="Open" tone="red" link="Northbridge Motors" />
                <Action title="Approve Sophie Ware’s 9 Nov interview outcome" owner="Anne-Marie" deadline="14 Nov 2026" impact="Outcome marked approved on the interview session" status="Open" tone="amber" link="Sophie Ware" />
                <Action title="Confirm whether Northbridge will reoffer Theo Wade’s place" owner="Anne-Marie" deadline="18 Nov 2026" impact="Employer decision recorded on the vacancy — place is not reopened automatically" status="Open" tone="amber" link="Northbridge Motors" />
                <Action title="Publish January intake dates on the GTA website" owner="Anne-Marie" deadline="21 Nov 2026" impact="Intake dates visible on the public website" status="Open" tone="navy" link="4 Jan induction" />
                <Action title="Review Amira Khan on the Due for review list" owner="Anne-Marie" deadline="21 Nov 2026" impact="Record marked responsive, archived, or a delete decision recorded" status="Open" tone="navy" link="Amira Khan" />
                <Action title="Book Maya Henshaw’s H&S visit at Northbridge" owner="Anne-Marie" deadline="8 Oct 2026" impact="Visit appears on the candidate record and employer log" status="Completed" tone="green" link="Maya Henshaw" />
              </>
            ) : <tr><td colSpan={6} className="muted">No actions yet.</td></tr>}
          </tbody>
        </table>
      </div>
      <form className="card card-pad" action={addRecruitmentAction}>
        <h2 className="card-title">Add action</h2>
        <input type="hidden" name="returnTo" value={`${base}/actions${q(example)}`} />
        <div className="form-grid">
          <label className="field wide"><span className="label">Action or decision</span><input name="title" required /></label>
          <label className="field"><span className="label">Deadline</span><input name="deadline" type="date" /></label>
          <label className="field"><span className="label">How impact will be checked</span><input name="impact" /></label>
        </div>
        <div style={{ marginTop: 12, display: "flex", justifyContent: "flex-end" }}><button className="btn" type="submit"><Plus /> Save action</button></div>
      </form>
      <p className="footer-note">{example ? "2 overdue · 4 open · 1 in progress · 1 completed. Example data only." : "Assigning an owner does not send a message."}</p>
    </Frame>
  );
}

function Action({ title, owner, deadline, overdue = false, impact, status, tone, link }: { title: string; owner: string; deadline: string; overdue?: boolean; impact: string; status: string; tone: "amber" | "red" | "navy" | "green"; link: string }) {
  return (
    <tr>
      <td>{title}</td>
      <td className="nowrap">{owner}</td>
      <td>{overdue ? <span className="date-overdue">{deadline}</span> : <span className="nowrap">{deadline}</span>}</td>
      <td>{impact}</td>
      <td><Pill tone={tone}>{status}</Pill></td>
      <td className="name">{link}</td>
    </tr>
  );
}

export function ReportsPage(props: CandidatesViewProps) {
  const { example } = props;
  const zero = example ? undefined : "0";
  return (
    <Frame props={props}>
      <PageHead
        crumb={<>Onboarding / <span>Reports</span></>}
        title="Monthly report"
        lede="A workspace for the month’s recruitment and marketing figures, ready to preview as a Word report. Definitions are provisional and can be changed before this is used for official reporting."
        actions={<ExampleChip show={example} />}
      />
      <form className="card card-pad report-head" method="get">
        {example ? <input type="hidden" name="example" value="1" /> : null}
        <label className="field" style={{ minWidth: 200 }}><span className="label">Month</span><select name="month"><option>November 2026</option><option>October 2026</option><option>September 2026</option></select></label>
        <label className="field" style={{ minWidth: 160 }}><span className="label">Site</span><select name="site"><option>All sites</option><option>Doncaster</option><option>Sheffield</option></select></label>
        <div style={{ marginLeft: "auto" }}><button className="btn" type="submit">Preview Word report</button></div>
      </form>
      <div className="banner banner-amber"><div><strong>Definitions are provisional.</strong> 0 means a counted total of none, ? means the figure is not yet agreed, and N/A means the measure does not apply. A start is counted only when induction attendance is confirmed.</div></div>
      <section className="card report-section">
        <h2 className="card-title">Recruitment pipeline</h2>
        <div className="kpi-row">
          <Kpi k="Stage 1" v={zero ?? "8"} s="ID, Maths and English" />
          <Kpi k="Interview" v={zero ?? "7"} s="Including 3 pending approval" />
          <Kpi k="Stage 2" v={zero ?? "5"} s="Employer confirmed" />
          <Kpi k="Induction" v={zero ?? "4"} s="Intended or booked" />
        </div>
      </section>
      <section className="card report-section">
        <h2 className="card-title">Starts</h2>
        <p className="side-sub" style={{ margin: "-6px 0 12px" }}>A start is counted only when induction attendance is confirmed. Booking or an intended intake date is not a start.</p>
        <div className="kpi-row" style={{ gridTemplateColumns: "repeat(3, minmax(0,1fr))" }}>
          <Kpi k="Starts this month" v="0" s="Confirmed attendance in November" />
          <Kpi k="Starts year to date" v={example ? "2" : "0"} s="Reuben Clark and Dylan Shore, 2 Nov intake" />
          <Kpi k="Expected January starts" v={example ? "?" : "0"} unknown={example} s="Under review — bookings are still open" />
        </div>
      </section>
      {example ? (
        <section className="card report-section">
          <h2 className="card-title">By programme</h2>
          <table>
            <thead><tr><th>Programme</th><th>Stage 1</th><th>Interview</th><th>Stage 2</th><th>Induction</th><th>Starts this month</th></tr></thead>
            <tbody>
              <tr><td>Autocare</td><td>1</td><td>2</td><td>0</td><td>0</td><td>0</td></tr>
              <tr><td>Light Vehicle</td><td>0</td><td>0</td><td>2</td><td>0</td><td>0</td></tr>
              <tr><td>Heavy Vehicle</td><td>2</td><td>0</td><td>0</td><td>0</td><td>0</td></tr>
              <tr><td>Vehicle Paint</td><td>0</td><td>1</td><td>0</td><td>0</td><td>0</td></tr>
              <tr><td>Vehicle Panel</td><td>1</td><td>0</td><td>0</td><td>0</td><td>0</td></tr>
              <tr><td>Business Admin</td><td>0</td><td>1</td><td>0</td><td>0</td><td>0</td></tr>
              <tr><td>Customer Service</td><td>0</td><td>0</td><td>0</td><td>1</td><td>0</td></tr>
              <tr><td className="muted">Other / not mapped</td><td className="muted">N/A</td><td className="muted">N/A</td><td className="muted">N/A</td><td className="muted">N/A</td><td className="muted">N/A</td></tr>
            </tbody>
          </table>
        </section>
      ) : null}
      <section className="card report-section">
        <h2 className="card-title">Employer activity</h2>
        <div className="kpi-row">
          <Kpi k="Distinct employers" v={example ? "8" : "0"} s="Employers contacted, not attempts" />
          <Kpi k="Contact attempts" v={example ? "22" : "0"} s="Calls, emails and visits logged" />
          <Kpi k="Visits" v={example ? "3" : "0"} s="Including 1 booked for 20 Nov" />
          <Kpi k="Confirmed vacancies" v={example ? "6" : "0"} s="Open and filled, not cancelled" />
        </div>
      </section>
      <section className="card report-section">
        <h2 className="card-title">Marketing leads and overdue follow-ups</h2>
        <div className="kpi-row">
          <Kpi k="New candidates this month" v={example ? "3" : "0"} s="Including Hannah Colton’s draft enquiry" />
          <Kpi k="Overdue follow-ups" v={example ? "2" : "0"} s="Jordan Blake and the Northbridge TNA" />
          <Kpi k="Leads from leaflets and flyers" v={example ? "?" : "0"} unknown={example} s="Source mapping still under review" />
          <Kpi k="Paid advertising reach" v="N/A" na s="Not collected in this period" />
        </div>
      </section>
    </Frame>
  );
}

function Kpi({ k, v, s, unknown, na }: { k: string; v: string; s: string; unknown?: boolean; na?: boolean }) {
  return <div className="kpi"><div className="k">{k}</div><div className={`v${unknown ? " unknown" : ""}${na ? " na" : ""}`}>{v}</div><div className="s">{s}</div></div>;
}

const DUE = [
  ["Amira Khan", "Doncaster", "amber", "Unresponsive", "12 Aug 2026", "3 months if Unresponsive", "12 Nov 2026", "2 days overdue", true, "2026-08-12"],
  ["Bea Collett", "Sheffield", "green", "Responsive", "30 Oct 2025", "1 year if Responsive", "30 Oct 2026", "15 days overdue", true, "2025-10-30"],
  ["Marlon Yates", "Doncaster", "amber", "Unresponsive", "1 Aug 2026", "3 months if Unresponsive", "1 Nov 2026", "13 days overdue", true, "2026-08-01"],
  ["Oscar Flynn", "Sheffield", "green", "Responsive", "16 Nov 2025", "1 year if Responsive", "16 Nov 2026", "Due in 2 days", false, "2025-11-16"],
  ["Lila Bennett", "Doncaster", "green", "Responsive", "20 Nov 2025", "1 year if Responsive", "20 Nov 2026", "Due in 6 days", false, "2025-11-20"],
] as const;

export function DuePage(props: CandidatesViewProps & { confirmName: string | null }) {
  const { base, example, confirmName } = props;
  return (
    <Frame props={props}>
      <PageHead
        crumb={<>Onboarding / Candidates / <span>Due for review</span></>}
        title="Due for review"
        lede="Review is due 1 year after the original entry date if the candidate is Responsive, or 3 months if Unresponsive. Switching back to responsive restores 1 year from that original date. Responsiveness is set manually."
        actions={<ExampleChip show={example} />}
      />
      <div className="banner banner-amber"><div><strong>Nothing is deleted automatically.</strong> Candidates stay on this list until you mark them responsive, archive them, or delete them permanently. Archived records can still be found later.</div></div>
      <div className="tabs">
        <Link className="tab" href={`${base}/candidates${q(example)}`}>Active <span className="count">{example ? "24" : "0"}</span></Link>
        <div className="tab-on">Due for review <span className="count">{example ? "5" : "0"}</span></div>
        <Link className="tab" href={`${base}/candidates${q(example, "tab=archived")}`}>Archived <span className="count">{example ? "11" : "0"}</span></Link>
      </div>
      <div className="card table-wrap">
        <table>
          <thead>
            <tr>
              <th>Candidate</th><th className="wrap">Responsiveness</th><th className="wrap">Original entry date</th><th>Rule</th><th className="wrap">Due date</th><th className="wrap">Days overdue</th><th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {example ? DUE.map((row) => (
              <tr key={row[0]}>
                <td><div className="name">{row[0]}</div><div className="note-inline">{row[1]}</div></td>
                <td><Pill tone={row[2]}>{row[3]}</Pill></td>
                <td className="nowrap">{row[4]}</td>
                <td>{row[5]}</td>
                <td className="nowrap">{row[6]}</td>
                <td>{row[8] ? <span className="date-overdue">{row[7]}</span> : row[7]}</td>
                <td>
                  <div className="btn-col">
                    {row[3] === "Unresponsive" ? (
                      <form action={setResponsivenessAction}>
                        <input type="hidden" name="returnTo" value={`${base}/candidates/due${q(example)}`} />
                        <input type="hidden" name="candidateId" value={row[0]} />
                        <input type="hidden" name="firstContact" value={row[9]} />
                        <input type="hidden" name="responsiveness" value="responsive" />
                        <button className="btn-secondary btn-sm" type="submit">Mark responsive</button>
                      </form>
                    ) : null}
                    <form action={archiveCandidateAction}>
                      <input type="hidden" name="returnTo" value={`${base}/candidates/due${q(example)}`} />
                      <input type="hidden" name="candidateId" value={row[0]} />
                      <button className="btn-secondary btn-sm" type="submit">Archive</button>
                    </form>
                    <Link className="btn-danger btn-sm" href={`${base}/candidates/due${q(example, `delete=${encodeURIComponent(row[0])}`)}`}>Delete permanently</Link>
                  </div>
                </td>
              </tr>
            )) : <tr><td colSpan={7} className="muted">Nobody is due for review.</td></tr>}
          </tbody>
        </table>
      </div>
      {confirmName ? (
        <div className="overlay">
          <form className="dialog" action={deleteCandidateAction}>
            <h2>Delete {confirmName} permanently?</h2>
            <p>This removes {confirmName}’s personal data from the candidate record, including contact details, notes and the audit trail.</p>
            <p>Anonymous totals used in reports are kept, so monthly counts are not lost. The record itself cannot be restored.</p>
            <p className="muted">Nothing else on this list will be changed. Deletion is never automatic.</p>
            <label className="field" style={{ marginTop: 8 }}>
              <span className="label">Type the full name to confirm</span>
              <input name="confirmedName" required placeholder={confirmName} autoComplete="off" />
            </label>
            <input type="hidden" name="returnTo" value={`${base}/candidates/due${q(example)}`} />
            <input type="hidden" name="candidateId" value={confirmName} />
            <div className="dialog-actions">
              <Link className="btn-secondary" href={`${base}/candidates/due${q(example)}`}>Cancel</Link>
              <button className="btn-danger solid" type="submit">Delete permanently</button>
            </div>
          </form>
        </div>
      ) : null}
    </Frame>
  );
}

export function InductionsPage(props: CandidatesViewProps) {
  const { example, base } = props;
  return (
    <Frame props={props}>
      <PageHead
        crumb={<>Onboarding / <span>Inductions</span></>}
        title="Inductions"
        lede="Intake dates are shared across Doncaster and Sheffield, and each intake has its own booking deadline. There is no default deadline and no capacity cap. Missed deadlines are flagged for Anne-Marie — candidates are never moved automatically."
        actions={<ExampleChip show={example} />}
      />
      {example ? <div className="banner banner-amber"><div><strong>Flagged for Anne-Marie.</strong> Katie Shaw was booked onto the 2 Nov intake two days after the 12 Oct deadline, and two candidates booked on 4 Jan are not yet Stage 2 ready. Nobody has been moved or unbooked automatically.</div></div> : null}
      <form className="card card-pad" action={addIntakeAction}>
        <h2 className="card-title">Add intake date</h2>
        <input type="hidden" name="returnTo" value={`${base}/inductions${q(example)}`} />
        <div className="form-grid">
          <label className="field"><span className="label">Intake date</span><input name="intakeOn" type="date" required /></label>
          <label className="field"><span className="label">Booking deadline</span><input name="deadline" type="date" /><div className="hint">Leave blank. There is no default.</div></label>
        </div>
        <div style={{ marginTop: 12 }}><button className="btn" type="submit"><Plus /> Save intake</button></div>
      </form>
      <form className="card card-pad" action={saveDeadlineSettingAction}>
        <h2 className="card-title">Suggested booking deadline</h2>
        <input type="hidden" name="returnTo" value={`${base}/inductions${q(example)}`} />
        <label className="field"><span className="label">Days before the intake, optional</span><input name="days" type="number" min={0} placeholder="No default" /></label>
        <div style={{ marginTop: 12 }}><button className="btn-secondary" type="submit">Save setting</button></div>
      </form>
      {example ? (
        <>
          <div className="card intake">
            <div className="intake-head"><div><div className="intake-title">Monday 2 Nov 2026</div><div className="side-sub">Shared intake · both sites · booking deadline 12 Oct 2026 (configurable)</div></div><Pill tone="grey">Held</Pill></div>
            <table>
              <thead><tr><th>Candidate</th><th>Site</th><th>Stage 2 readiness</th><th>Booked</th><th>Attendance</th><th>If absent</th></tr></thead>
              <tbody>
                <tr><td className="name">Reuben Clark</td><td>Doncaster</td><td><Pill tone="green">Stage 2 ready</Pill></td><td>Booked</td><td><Pill tone="green">Attended</Pill></td><td className="muted">—</td></tr>
                <tr><td className="name">Dylan Shore</td><td>Sheffield</td><td><Pill tone="green">Stage 2 ready</Pill></td><td>Booked</td><td><Pill tone="green">Attended</Pill></td><td className="muted">—</td></tr>
                <tr><td className="name">Theo Wade</td><td>Doncaster</td><td><Pill tone="green">Stage 2 ready</Pill></td><td>Booked</td><td><Pill tone="red">Absent</Pill></td><td><div className="choice"><span className="opt">Reschedule</span><span className="opt">Pause</span><span className="opt on-red">Withdraw</span></div></td></tr>
                <tr><td className="name">Katie Shaw</td><td>Sheffield</td><td><Pill tone="green">Stage 2 ready</Pill></td><td>Booked <Pill tone="amber">After deadline</Pill></td><td><Pill tone="red">Absent</Pill></td><td><div className="choice"><span className="opt on-amber">Reschedule</span><span className="opt">Pause</span><span className="opt">Withdraw</span></div><div className="note-inline">Rescheduled to 4 Jan 2027</div></td></tr>
              </tbody>
            </table>
          </div>
          <div className="card intake">
            <div className="intake-head"><div><div className="intake-title">Monday 4 Jan 2027</div><div className="side-sub">Shared intake · both sites · booking deadline 14 Dec 2026 (configurable) · no capacity cap</div></div><Pill tone="navy">Upcoming</Pill></div>
            <table>
              <thead><tr><th>Candidate</th><th>Site</th><th>Stage 2 readiness</th><th>Booked</th><th>Attendance</th><th>Notes</th></tr></thead>
              <tbody>
                <tr><td className="name">Lewis Cartwright</td><td>Sheffield</td><td><Pill tone="green">Stage 2 ready</Pill></td><td><Pill tone="green">Booked</Pill></td><td className="muted">Not yet held</td><td className="muted">Customer Service · Meadowside</td></tr>
                <tr><td className="name">Katie Shaw</td><td>Sheffield</td><td><Pill tone="green">Stage 2 ready</Pill></td><td><Pill tone="green">Booked</Pill></td><td className="muted">Not yet held</td><td>Rescheduled from 2 Nov</td></tr>
                <tr><td className="name">Maya Henshaw</td><td>Doncaster</td><td><Pill tone="amber">Stage 2 not ready</Pill></td><td>Intended only</td><td className="muted">—</td><td>H&S visit still outstanding. Not a booking.</td></tr>
                <tr><td className="name">Freya Moss</td><td>Sheffield</td><td><Pill tone="amber">Stage 2 not ready</Pill></td><td><Pill tone="green">Booked</Pill></td><td className="muted">Not yet held</td><td><><Pill tone="amber">Flagged</Pill> Learner file not completed</></td></tr>
                <tr><td className="name">Sophie Ware</td><td>Doncaster</td><td><Pill tone="amber">Stage 2 not ready</Pill></td><td>Intended only</td><td className="muted">—</td><td>Interview approval still pending</td></tr>
              </tbody>
            </table>
          </div>
          <div className="card intake">
            <div className="intake-head">
              <div>
                <div className="intake-title">Monday 8 Mar 2027</div>
                <div className="side-sub">Shared intake · both sites · booking deadline 15 Feb 2027 (configurable) · no capacity cap</div>
              </div>
              <Pill tone="grey">Open</Pill>
            </div>
            <div className="card-pad muted">No candidates have been intended or booked on this intake yet.</div>
          </div>
        </>
      ) : <p className="muted">No intake dates yet. Add one above. The booking deadline stays empty until you set it.</p>}
      <form action={confirmInductionAction} className="card card-pad">
        <h2 className="card-title">Confirm attendance</h2>
        <p className="side-sub">Confirming attendance creates the apprentice, links the employer, site and manager, and moves the candidate to Started. It counts once.</p>
        <input type="hidden" name="returnTo" value={`${base}/inductions${q(example)}`} />
        <div className="form-grid">
          <label className="field"><span className="label">Booking ID</span><input name="bookingId" required /></label>
          <label className="field"><span className="label">Actual date</span><input name="actualOn" type="date" required /></label>
        </div>
        <div style={{ marginTop: 12 }}><button className="btn" type="submit">Confirm and start</button></div>
      </form>
    </Frame>
  );
}
