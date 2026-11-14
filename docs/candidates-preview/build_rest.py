#!/usr/bin/env python3
"""Additional Onboarding preview pages (06–12)."""
from build_html import ICONS, OUT, page, write_pages

# ---------- 06 Employers list ----------
emp_rows = [
    ("Northbridge Motors", "07-employer-record.html", "Doncaster", "Wheatley Hall Road", "2", "2", "12 Nov 2026", ("10 Nov 2026", True), "Word of mouth"),
    ("Ashfield Coachworks", "#", "Sheffield", "Attercliffe", "1", "2", "8 Nov 2026", ("20 Nov 2026", False), "Website"),
    ("Riverside Fleet Services", "#", "Doncaster", "Lakeside", "1", "2", "4 Nov 2026", ("25 Nov 2026", False), "School event"),
    ("Hallam Street Garage", "#", "Sheffield", "Walkley", "1", "1", "13 Nov 2026", ("18 Nov 2026", False), "Google"),
    ("Fenwick Auto Centre", "#", "Doncaster", "Balby", "0", "0", "2 Oct 2026", ("—", False), "Leaflet"),
    ("Oakwell Commercials", "#", "Sheffield", "Barnsley Road", "0", "0", "29 Oct 2026", ("7 Nov 2026", True), "GTA prospectus"),
    ("Carta Office Services", "#", "Doncaster", "Hyde Park", "1", "0", "9 Nov 2026", ("16 Nov 2026", False), "Website"),
    ("Meadowside Contact Centre", "#", "Sheffield", "Meadowhall", "1", "0", "6 Nov 2026", ("2 Dec 2026", False), "Social media"),
]

emp_tr = []
for name, href, site, loc, vacs, places, last, follow, source in emp_rows:
    due, overdue = follow
    due_html = f'<span class="date-overdue">{due}</span>' if overdue else due
    emp_tr.append(f'''          <tr>
            <td><a class="name" href="{href}">{name}</a><div class="note-inline">{loc}</div></td>
            <td class="nowrap">{site}</td>
            <td class="frac">{vacs}</td>
            <td class="frac">{places}</td>
            <td class="nowrap">{last}</td>
            <td class="nowrap">{due_html}</td>
            <td class="nowrap">{source}</td>
          </tr>''')

employers_body = f'''      <div class="page-head">
        <div>
          <div class="crumb">Onboarding / <span>Employers &amp; vacancies</span></div>
          <h1>Employers &amp; vacancies</h1>
          <p class="lede">Employers are the Portal’s employer records. Vacancies sit on an employer and can be offered to candidates. Filled and cancelled vacancies are kept, but their places are not available.</p>
        </div>
        <div class="head-actions">
          <span class="chip chip-example">Example data</span>
          <div class="btn-secondary">Add employer</div>
          <div class="btn">{ICONS["plus"]} Add vacancy</div>
        </div>
      </div>

      <div class="tabs">
        <div class="tab-on">Employers <span class="count">8</span></div>
        <a class="tab" href="06b-vacancies-list.html">Vacancies <span class="count">10</span></a>
      </div>

      <div class="card table-wrap">
        <table>
          <colgroup>
            <col style="width:22%" /><col style="width:11%" /><col style="width:12%" />
            <col style="width:12%" /><col style="width:14%" /><col style="width:15%" /><col style="width:14%" />
          </colgroup>
          <thead>
            <tr>
              <th>Employer</th>
              <th>Site</th>
              <th class="wrap">Open vacancies</th>
              <th class="wrap">Places available</th>
              <th class="wrap">Last contact</th>
              <th class="wrap">Next follow-up</th>
              <th>Source</th>
            </tr>
          </thead>
          <tbody>
{chr(10).join(emp_tr)}
          </tbody>
        </table>
      </div>
      <p class="footer-note">Places available excludes filled, cancelled, on-hold and withdrawn places waiting for the employer to decide. Example data only.</p>'''

# ---------- 06b Vacancies list ----------
vac_rows = [
    ("Light Vehicle Technician", "Northbridge Motors", "07-employer-record.html", "Light Vehicle", "Doncaster", "2", "1", "0", ("Confirmed / open", "pill-green"), "1 withdrawn place — employer to decide whether to reoffer"),
    ("Autocare Technician", "Northbridge Motors", "07-employer-record.html", "Autocare", "Doncaster", "3", "1", "2", ("Confirmed / open", "pill-green"), ""),
    ("Vehicle Paint Technician", "Ashfield Coachworks", "#", "Vehicle Paint", "Sheffield", "2", "0", "2", ("Potential opportunity", "pill-amber"), ""),
    ("Heavy Vehicle Technician", "Riverside Fleet Services", "#", "Heavy Vehicle", "Doncaster", "2", "0", "2", ("Confirmed / open", "pill-green"), ""),
    ("Light Vehicle Technician", "Hallam Street Garage", "#", "Light Vehicle", "Sheffield", "2", "1", "1", ("Confirmed / open", "pill-green"), ""),
    ("Autocare Technician", "Fenwick Auto Centre", "#", "Autocare", "Doncaster", "1", "1", "0", ("Filled", "pill-grey"), "Not available — kept on the record"),
    ("Heavy Vehicle Technician", "Oakwell Commercials", "#", "Heavy Vehicle", "Sheffield", "2", "0", "0", ("On hold", "pill-amber"), "Places are not available while on hold"),
    ("Business Administrator", "Carta Office Services", "#", "Business Admin", "Doncaster", "1", "1", "0", ("Confirmed / open", "pill-green"), ""),
    ("Customer Service Practitioner", "Meadowside Contact Centre", "#", "Customer Service", "Sheffield", "1", "1", "0", ("Confirmed / open", "pill-green"), ""),
    ("Vehicle Panel Technician", "Fenwick Auto Centre", "#", "Vehicle Panel", "Doncaster", "1", "0", "0", ("Cancelled", "pill-red"), "Not available — kept on the record"),
]

vac_tr = []
for title, emp, href, prog, site, total, alloc, avail, status, note in vac_rows:
    note_html = f'<div class="note-inline">{note}</div>' if note else ""
    vac_tr.append(f'''          <tr>
            <td><div class="name">{title}</div>{note_html}</td>
            <td><a href="{href}" style="font-family:var(--font-display);font-weight:700;color:var(--navy)">{emp}</a></td>
            <td class="nowrap">{prog}</td>
            <td class="nowrap">{site}</td>
            <td class="frac">{total} <span>/</span> {alloc} <span>/</span> {avail}</td>
            <td><span class="pill {status[1]}">{status[0]}</span></td>
          </tr>''')

vacancies_body = f'''      <div class="page-head">
        <div>
          <div class="crumb">Onboarding / <span>Employers &amp; vacancies</span></div>
          <h1>Employers &amp; vacancies</h1>
          <p class="lede">Each vacancy belongs to one employer and one programme. Filled, cancelled and on-hold vacancies stay on the list so the history is not lost, but their places cannot be offered.</p>
        </div>
        <div class="head-actions">
          <span class="chip chip-example">Example data</span>
          <div class="btn">{ICONS["plus"]} Add vacancy</div>
        </div>
      </div>

      <div class="tabs">
        <a class="tab" href="06-employers-list.html">Employers <span class="count">8</span></a>
        <div class="tab-on">Vacancies <span class="count">10</span></div>
      </div>

      <div class="card table-wrap">
        <table>
          <colgroup>
            <col style="width:22%" /><col style="width:20%" /><col style="width:13%" />
            <col style="width:11%" /><col style="width:16%" /><col style="width:18%" />
          </colgroup>
          <thead>
            <tr>
              <th>Vacancy</th>
              <th>Employer</th>
              <th>Programme</th>
              <th>Site</th>
              <th class="wrap">Total / allocated / available</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
{chr(10).join(vac_tr)}
          </tbody>
        </table>
      </div>
      <p class="footer-note">Example data only.</p>'''

# ---------- 07 Employer record ----------
employer_body = f'''      <a class="back" href="06-employers-list.html">{ICONS["back"]} Employers &amp; vacancies</a>
      <div class="page-head">
        <div>
          <div class="crumb">Onboarding / Employers &amp; vacancies / <span>Northbridge Motors</span></div>
          <h1>Northbridge Motors</h1>
          <div class="meta-row">
            <span class="muted">Diane Copeland · Workshop manager</span>
            <span class="meta-dot">·</span>
            <span class="muted">diane.copeland@northbridge-motors.example</span>
          </div>
          <div class="meta-row">
            <span class="muted">Unit 4, Wheatley Hall Road, Doncaster</span>
            <span class="meta-dot">·</span>
            <span class="muted">Source: Word of mouth</span>
          </div>
        </div>
        <div class="head-actions">
          <span class="chip chip-example">Example data</span>
          <div class="btn-secondary">Edit employer</div>
          <div class="btn">{ICONS["plus"]} Add vacancy</div>
        </div>
      </div>

      <div class="card card-pad">
        <div class="side-label">Contact attempts</div>
        <div class="places"><strong>7</strong> <span>attempts across 2 distinct contacts</span></div>
        <div class="side-sub">Diane Copeland, workshop manager · Paul Wheatley, director. The counter is attempts, not people — both figures are kept so a busy contact is not counted as several employers.</div>
      </div>

      <div class="card table-wrap">
        <div class="card-pad" style="padding-bottom:8px"><h2 class="card-title" style="margin:0">Vacancies</h2></div>
        <table>
          <colgroup>
            <col style="width:24%" /><col style="width:16%" /><col style="width:20%" /><col style="width:18%" /><col style="width:22%" />
          </colgroup>
          <thead>
            <tr>
              <th>Vacancy</th>
              <th>Programme</th>
              <th class="wrap">Total / allocated / available</th>
              <th>Status</th>
              <th>Notes</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td class="name">Light Vehicle Technician</td>
              <td class="nowrap">Light Vehicle</td>
              <td class="frac">2 <span>/</span> 1 <span>/</span> 0</td>
              <td><span class="pill pill-green">Confirmed / open</span></td>
              <td>1 withdrawn place is not reopened automatically</td>
            </tr>
            <tr>
              <td class="name">Autocare Technician</td>
              <td class="nowrap">Autocare</td>
              <td class="frac">3 <span>/</span> 1 <span>/</span> 2</td>
              <td><span class="pill pill-green">Confirmed / open</span></td>
              <td class="muted">—</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div class="card table-wrap">
        <div class="card-pad" style="padding-bottom:8px"><h2 class="card-title" style="margin:0">Linked candidates</h2></div>
        <table>
          <colgroup>
            <col style="width:22%" /><col style="width:22%" /><col style="width:14%" /><col style="width:42%" />
          </colgroup>
          <thead>
            <tr>
              <th>Candidate</th>
              <th>Vacancy</th>
              <th>Stage</th>
              <th>Place</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td><a class="name" href="02-candidate-record.html">Maya Henshaw</a></td>
              <td>Light Vehicle Technician</td>
              <td><span class="pill pill-navy">Stage 2</span></td>
              <td>Allocated</td>
            </tr>
            <tr>
              <td class="name">Noah Bennett</td>
              <td>Autocare Technician</td>
              <td><span class="pill pill-navy">Interview</span></td>
              <td>Allocated</td>
            </tr>
            <tr>
              <td class="name">Theo Wade</td>
              <td>Light Vehicle Technician</td>
              <td><span class="pill pill-grey">Withdrawn</span></td>
              <td><span class="pill pill-amber">Employer to decide whether to reoffer</span></td>
            </tr>
          </tbody>
        </table>
      </div>

      <div class="card table-wrap">
        <div class="card-pad" style="padding-bottom:8px"><h2 class="card-title" style="margin:0">Follow-ups</h2></div>
        <table>
          <colgroup>
            <col style="width:40%" /><col style="width:16%" /><col style="width:16%" /><col style="width:14%" /><col style="width:14%" />
          </colgroup>
          <thead>
            <tr>
              <th>Follow-up</th>
              <th>Owner</th>
              <th>Due</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Send TNA summary to Diane Copeland</td>
              <td class="nowrap">J. Hartley</td>
              <td class="date-overdue">10 Nov 2026</td>
              <td><span class="pill pill-red">Overdue</span></td>
              <td><div class="btn btn-sm">Mark done</div></td>
            </tr>
            <tr>
              <td>Confirm whether to reoffer Theo Wade’s place</td>
              <td class="nowrap">Anne-Marie</td>
              <td class="nowrap">18 Nov 2026</td>
              <td><span class="pill pill-amber">Open</span></td>
              <td><div class="btn-secondary btn-sm">Mark done</div></td>
            </tr>
            <tr>
              <td>H&amp;S visit at Northbridge Motors</td>
              <td class="nowrap">Anne-Marie</td>
              <td class="nowrap">20 Nov 2026</td>
              <td><span class="pill pill-navy">Booked</span></td>
              <td><div class="btn-secondary btn-sm">Mark done</div></td>
            </tr>
          </tbody>
        </table>
      </div>

      <div class="card table-wrap">
        <div class="card-pad" style="padding-bottom:8px"><h2 class="card-title" style="margin:0">Activity log</h2></div>
        <table>
          <colgroup>
            <col style="width:14%" /><col style="width:16%" /><col style="width:50%" /><col style="width:20%" />
          </colgroup>
          <thead>
            <tr>
              <th>Type</th>
              <th>Actual date</th>
              <th>Notes</th>
              <th>Follow-up</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Call</td>
              <td class="nowrap">12 Nov 2026</td>
              <td>Spoke to Diane Copeland about Theo Wade withdrawing. She will confirm whether the Light Vehicle place should be reoffered.</td>
              <td class="nowrap">18 Nov 2026</td>
            </tr>
            <tr>
              <td>Email</td>
              <td class="nowrap">3 Oct 2026</td>
              <td>Sent the TNA agenda for Maya Henshaw.</td>
              <td class="date-overdue">10 Nov 2026</td>
            </tr>
            <tr>
              <td>Visit booked</td>
              <td class="nowrap">8 Oct 2026</td>
              <td>H&amp;S visit booked for 20 Nov 2026.</td>
              <td class="nowrap">20 Nov 2026</td>
            </tr>
            <tr>
              <td>Call</td>
              <td class="nowrap">18 Sep 2026</td>
              <td>Employer confirmed for Maya Henshaw’s Light Vehicle place.</td>
              <td class="muted">—</td>
            </tr>
            <tr>
              <td>Email</td>
              <td class="nowrap">4 Sep 2026</td>
              <td>First enquiry from Diane after a word-of-mouth referral. Paul Wheatley was copied.</td>
              <td class="muted">—</td>
            </tr>
          </tbody>
        </table>
      </div>'''

# ---------- 08 Activity calendar ----------
# November 2026: Mon-start. 26 Oct – 6 Dec.
# Events: 4 Hall Cross (done), 11 Open evening (done), 18 Schools roadshow (planned, selected),
# 25 Social campaign (planned), 27 Employer breakfast (booked)
def cal_day(num, mute=False, today=False, selected=False, events=None):
    cls = "cal-day"
    if mute: cls += " mute"
    if today: cls += " today"
    if selected: cls += " selected"
    ev_html = ""
    for label, kind in (events or []):
        ev_html += f'<div class="cal-ev {kind}">{label}</div>'
    return f'<div class="{cls}"><div class="cal-num">{num}</div>{ev_html}</div>'

days = []
# week 0
for n in (26, 27, 28, 29, 30, 31):
    days.append(cal_day(n, mute=True))
days.append(cal_day(1))
# 2-8
for n in range(2, 9):
    ev = [("Hall Cross talk", "done")] if n == 4 else None
    days.append(cal_day(n, events=ev))
# 9-15
for n in range(9, 16):
    ev = None
    if n == 11:
        ev = [("Open evening", "done")]
    days.append(cal_day(n, today=(n == 14), events=ev))
# 16-22
for n in range(16, 23):
    ev = [("Roadshow", "planned")] if n == 18 else None
    days.append(cal_day(n, selected=(n == 18), events=ev))
# 23-29
for n in range(23, 30):
    ev = None
    if n == 25:
        ev = [("Social campaign", "planned")]
    if n == 27:
        ev = [("Breakfast", "booked")]
    days.append(cal_day(n, events=ev))
# 30 + Dec 1-6
days.append(cal_day(30))
for n in range(1, 7):
    days.append(cal_day(n, mute=True))

dows = "".join(f'<div class="cal-dow">{d}</div>' for d in ("Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"))

calendar_body = f'''      <div class="page-head">
        <div>
          <div class="crumb">Onboarding / <span>Activity calendar</span></div>
          <h1>Activity calendar</h1>
          <p class="lede">A shared month view for marketing and careers activity at both sites. Assigning an owner does not send a message.</p>
        </div>
        <div class="head-actions">
          <span class="chip chip-example">Example data</span>
          <div class="field" style="min-width:150px">
            <select><option>All sites</option><option>Doncaster</option><option>Sheffield</option></select>
          </div>
          <div class="btn">{ICONS["plus"]} Add activity</div>
        </div>
      </div>

      <div class="card card-pad">
        <div class="cal-toolbar" style="margin-bottom:12px">
          <div class="cal-month">November 2026</div>
          <div class="muted">Today is Saturday 14 Nov</div>
        </div>
        <div class="cal-grid">
          {dows}
          {''.join(days)}
        </div>
      </div>

      <div class="card card-pad">
        <div class="side-label">Selected activity</div>
        <div class="side-value">Sheffield schools roadshow</div>
        <div class="meta-row" style="margin-top:10px">
          <span class="pill pill-navy">Planned</span>
          <span class="muted">Wednesday 18 Nov 2026</span>
          <span class="meta-dot">·</span>
          <span class="muted">Sheffield</span>
        </div>
        <div class="form-grid" style="margin-top:16px">
          <div>
            <div class="side-label">Intended audience</div>
            <div>Year 10 and Year 11 pupils, with parents welcome in the last hour.</div>
          </div>
          <div>
            <div class="side-label">Owner</div>
            <div>Anne-Marie</div>
            <div class="note-inline">Assigning an owner does not send a message.</div>
          </div>
          <div class="wide">
            <div class="side-label">Notes</div>
            <div>Stand booked in the sports hall at a Sheffield school cluster event. Autocare and Light Vehicle leaflets to be taken. Status will move to Booked once the school confirms the room, and to Completed after the day.</div>
          </div>
        </div>
      </div>'''

# ---------- 09 Actions ----------
act_rows = [
    ("Follow up Jordan Blake’s 9 Nov interview no-show", "J. Hartley", "11 Nov 2026", True, "Call logged and a new Monday session offered, or responsiveness reviewed", "In progress", "pill-amber", "Jordan Blake", "#"),
    ("Send overdue TNA summary to Northbridge Motors", "J. Hartley", "10 Nov 2026", True, "Diane Copeland confirms receipt of the TNA summary", "Open", "pill-red", "Northbridge Motors", "07-employer-record.html"),
    ("Approve Sophie Ware’s 9 Nov interview outcome", "Anne-Marie", "14 Nov 2026", False, "Outcome marked approved on the interview session", "Open", "pill-amber", "Sophie Ware", "04-interviews.html"),
    ("Confirm whether Northbridge will reoffer Theo Wade’s place", "Anne-Marie", "18 Nov 2026", False, "Employer decision recorded on the vacancy — place is not reopened automatically", "Open", "pill-amber", "Northbridge Motors", "07-employer-record.html"),
    ("Publish January intake dates on the GTA website", "Anne-Marie", "21 Nov 2026", False, "Intake dates visible on the public website", "Open", "pill-navy", "4 Jan induction", "12-inductions.html"),
    ("Review Amira Khan on the Due for review list", "Anne-Marie", "21 Nov 2026", False, "Record marked responsive, archived, or a delete decision recorded", "Open", "pill-navy", "Amira Khan", "11-due-for-review.html"),
    ("Book Maya Henshaw’s H&amp;S visit at Northbridge", "Anne-Marie", "8 Oct 2026", False, "Visit appears on the candidate record and employer log", "Completed", "pill-green", "Maya Henshaw", "02-candidate-record.html"),
]

act_tr = []
for action, owner, deadline, overdue, impact, status, pill, link, href in act_rows:
    dl = f'<span class="date-overdue">{deadline}</span>' if overdue else f'<span class="nowrap">{deadline}</span>'
    act_tr.append(f'''          <tr>
            <td>{action}</td>
            <td class="nowrap">{owner}</td>
            <td>{dl}</td>
            <td>{impact}</td>
            <td><span class="pill {pill}">{status}</span></td>
            <td><a href="{href}" style="font-family:var(--font-display);font-weight:700;color:var(--navy)">{link}</a></td>
          </tr>''')

actions_body = f'''      <div class="page-head">
        <div>
          <div class="crumb">Onboarding / <span>Actions</span></div>
          <h1>Actions and decisions</h1>
          <p class="lede">Work that needs an owner and a deadline, including decisions that should be checked later. Overdue deadlines are shown in red.</p>
        </div>
        <div class="head-actions">
          <span class="chip chip-example">Example data</span>
          <div class="btn">{ICONS["plus"]} Add action</div>
        </div>
      </div>

      <div class="card card-pad">
        <div class="filters" style="grid-template-columns: 1.4fr 1fr 1fr 1fr;">
          <div class="field">
            <span class="label">Search</span>
            <input type="search" placeholder="Action, owner or record" />
          </div>
          <div class="field">
            <span class="label">Status</span>
            <select><option>All statuses</option><option>Open</option><option>In progress</option><option>Completed</option></select>
          </div>
          <div class="field">
            <span class="label">Owner</span>
            <select><option>All owners</option><option>Anne-Marie</option><option>J. Hartley</option></select>
          </div>
          <div class="field">
            <span class="label">Deadline</span>
            <select><option>Any deadline</option><option>Overdue</option><option>Due this week</option></select>
          </div>
        </div>
      </div>

      <div class="card table-wrap">
        <table>
          <colgroup>
            <col style="width:22%" /><col style="width:11%" /><col style="width:12%" />
            <col style="width:25%" /><col style="width:12%" /><col style="width:18%" />
          </colgroup>
          <thead>
            <tr>
              <th>Action or decision</th>
              <th>Owner</th>
              <th>Deadline</th>
              <th>How impact will be checked</th>
              <th>Status</th>
              <th>Linked to</th>
            </tr>
          </thead>
          <tbody>
{chr(10).join(act_tr)}
          </tbody>
        </table>
      </div>
      <p class="footer-note">2 overdue · 4 open · 1 in progress · 1 completed. Example data only.</p>'''

# ---------- 10 Reports ----------
def kpi(label, value, sub, kind=""):
    vclass = f' v {kind}'.strip() if kind else "v"
    return f'<div class="kpi"><div class="k">{label}</div><div class="{vclass}">{value}</div><div class="s">{sub}</div></div>'

reports_body = f'''      <div class="page-head">
        <div>
          <div class="crumb">Onboarding / <span>Reports</span></div>
          <h1>Monthly report</h1>
          <p class="lede">A workspace for the month’s recruitment and marketing figures, ready to preview as a Word report. Definitions are provisional and can be changed before this is used for official reporting.</p>
        </div>
        <div class="head-actions">
          <span class="chip chip-example">Example data</span>
        </div>
      </div>

      <div class="card card-pad report-head">
        <div class="field" style="min-width:200px">
          <span class="label">Month</span>
          <select><option>November 2026</option><option>October 2026</option><option>September 2026</option></select>
        </div>
        <div class="field" style="min-width:160px">
          <span class="label">Site</span>
          <select><option>All sites</option><option>Doncaster</option><option>Sheffield</option></select>
        </div>
        <div style="margin-left:auto"><div class="btn">Preview Word report</div></div>
      </div>

      <div class="banner banner-amber">
        <div><strong>Definitions are provisional.</strong> Figures below are example data for November 2026, all sites. 0 means a counted total of none, ? means the figure is not yet agreed, and N/A means the measure does not apply.</div>
      </div>

      <div class="card report-section">
        <h2 class="card-title">Recruitment pipeline</h2>
        <div class="kpi-row">
          {kpi("Stage 1", "8", "ID, Maths and English")}
          {kpi("Interview", "7", "Including 3 pending approval")}
          {kpi("Stage 2", "5", "Employer confirmed")}
          {kpi("Induction", "4", "Intended or booked")}
        </div>
        <p class="footer-note" style="margin-top:10px">24 active candidates · 5 on Due for review · 11 archived. Nothing is deleted automatically.</p>
      </div>

      <div class="card report-section">
        <h2 class="card-title">Starts</h2>
        <p class="side-sub" style="margin:-6px 0 12px">A start is counted only when induction attendance is confirmed. Booking or an intended intake date is not a start.</p>
        <div class="kpi-row" style="grid-template-columns: repeat(3, minmax(0,1fr));">
          {kpi("Starts this month", "0", "Confirmed attendance in November")}
          {kpi("Starts year to date", "2", "Reuben Clark and Dylan Shore, 2 Nov intake")}
          {kpi("Expected January starts", "?", "Under review — bookings are still open", "unknown")}
        </div>
        <div style="margin-top:10px"><span class="pill pill-amber">Under review</span> <span class="muted">Expected January starts is not yet agreed, because some 4 Jan candidates are still in Stage 2.</span></div>
      </div>

      <div class="card report-section">
        <h2 class="card-title">By programme</h2>
        <table>
          <colgroup>
            <col style="width:28%" /><col style="width:12%" /><col style="width:12%" /><col style="width:12%" /><col style="width:12%" /><col style="width:24%" />
          </colgroup>
          <thead>
            <tr>
              <th>Programme</th>
              <th>Stage 1</th>
              <th>Interview</th>
              <th>Stage 2</th>
              <th>Induction</th>
              <th>Starts this month</th>
            </tr>
          </thead>
          <tbody>
            <tr><td>Autocare</td><td>1</td><td>2</td><td>0</td><td>0</td><td>0</td></tr>
            <tr><td>Light Vehicle</td><td>0</td><td>0</td><td>2</td><td>0</td><td>0</td></tr>
            <tr><td>Heavy Vehicle</td><td>2</td><td>0</td><td>0</td><td>0</td><td>0</td></tr>
            <tr><td>Vehicle Paint</td><td>0</td><td>1</td><td>0</td><td>0</td><td>0</td></tr>
            <tr><td>Vehicle Panel</td><td>1</td><td>0</td><td>0</td><td>0</td><td>0</td></tr>
            <tr><td>Business Admin</td><td>0</td><td>1</td><td>0</td><td>0</td><td>0</td></tr>
            <tr><td>Customer Service</td><td>0</td><td>0</td><td>0</td><td>1</td><td>0</td></tr>
            <tr><td class="muted">Other / not mapped</td><td class="muted">N/A</td><td class="muted">N/A</td><td class="muted">N/A</td><td class="muted">N/A</td><td class="muted">N/A</td></tr>
          </tbody>
        </table>
      </div>

      <div class="card report-section">
        <h2 class="card-title">Employer activity</h2>
        <div class="kpi-row">
          {kpi("Distinct employers", "8", "Employers contacted, not attempts")}
          {kpi("Contact attempts", "22", "Calls, emails and visits logged")}
          {kpi("Visits", "3", "Including 1 booked for 20 Nov")}
          {kpi("Confirmed vacancies", "6", "Open and filled, not cancelled")}
        </div>
        <p class="footer-note" style="margin-top:10px">Potential opportunities: 1 · Vacancies on hold: 1 · Cancelled (kept): 1. Contact attempts are counted separately from distinct employers.</p>
      </div>

      <div class="card report-section">
        <h2 class="card-title">Marketing leads and overdue follow-ups</h2>
        <div class="kpi-row">
          {kpi("New candidates this month", "3", "Including Hannah Colton’s draft enquiry")}
          {kpi("Overdue follow-ups", "2", "Jordan Blake and the Northbridge TNA")}
          {kpi("Leads from leaflets and flyers", "?", "Source mapping still under review", "unknown")}
          {kpi("Paid advertising reach", "N/A", "Not collected in this period", "na")}
        </div>
        <div style="margin-top:10px;display:flex;gap:8px;flex-wrap:wrap;align-items:center">
          <span class="pill pill-amber">Under review</span>
          <span class="muted">Leaflet and flyer leads are marked ? until the source definitions are agreed. Paid advertising is N/A because none was run in November.</span>
        </div>
      </div>

      <div class="card report-section">
        <h2 class="card-title">Careers activity</h2>
        <div class="kpi-row">
          {kpi("Events completed", "2", "Hall Cross talk and GTA open evening")}
          {kpi("Events planned or booked", "3", "18, 25 and 27 Nov")}
          {kpi("Schools engaged", "3", "Doncaster and Sheffield")}
          {kpi("Pupils attended", "?", "Register totals not yet entered", "unknown")}
        </div>
        <div style="margin-top:10px"><span class="pill pill-amber">Under review</span> <span class="muted">Pupil attendance is ? until event registers are entered. 0 would mean a completed event with no pupils recorded.</span></div>
      </div>

      <div class="card report-section">
        <h2 class="card-title">Actions and decisions</h2>
        <div class="kpi-row">
          {kpi("Open", "4", "Including 1 due today")}
          {kpi("In progress", "1", "Jordan Blake no-show follow-up")}
          {kpi("Overdue", "2", "Shown in red on the Actions page")}
          {kpi("Completed this month", "1", "Maya Henshaw H&amp;S visit booked")}
        </div>
      </div>'''

# ---------- 11 Due for review ----------
due_rows = [
    ("Amira Khan", "Doncaster", "Unresponsive", "pill-amber", "12 Aug 2026", "3 months if Unresponsive", "12 Nov 2026", "2 days overdue", True, True),
    ("Bea Collett", "Sheffield", "Responsive", "pill-green", "30 Oct 2025", "1 year if Responsive", "30 Oct 2026", "15 days overdue", True, False),
    ("Marlon Yates", "Doncaster", "Unresponsive", "pill-amber", "1 Aug 2026", "3 months if Unresponsive", "1 Nov 2026", "13 days overdue", True, True),
    ("Oscar Flynn", "Sheffield", "Responsive", "pill-green", "16 Nov 2025", "1 year if Responsive", "16 Nov 2026", "Due in 2 days", False, False),
    ("Lila Bennett", "Doncaster", "Responsive", "pill-green", "20 Nov 2025", "1 year if Responsive", "20 Nov 2026", "Due in 6 days", False, False),
]

def due_actions(name, can_mark, confirm=False):
    mark = '<div class="btn-secondary btn-sm">Mark responsive</div>' if can_mark else ""
    delete = '<div class="btn-danger btn-sm">Delete permanently</div>'
    return f'<div class="btn-col">{mark}<div class="btn-secondary btn-sm">Archive</div>{delete}</div>'

due_tr = []
for name, site, resp, pill, entered, rule, due, overdue, is_od, can_mark in due_rows:
    od = f'<span class="date-overdue">{overdue}</span>' if is_od else overdue
    due_tr.append(f'''          <tr>
            <td><div class="name">{name}</div><div class="note-inline">{site}</div></td>
            <td><span class="pill {pill}">{resp}</span></td>
            <td class="nowrap">{entered}</td>
            <td>{rule}</td>
            <td class="nowrap">{due}</td>
            <td>{od}</td>
            <td>{due_actions(name, can_mark)}</td>
          </tr>''')

due_shared = f'''      <div class="page-head">
        <div>
          <div class="crumb">Onboarding / Candidates / <span>Due for review</span></div>
          <h1>Due for review</h1>
          <p class="lede">Review is due 1 year after the original entry date if the candidate is Responsive, or 3 months if Unresponsive. Responsiveness is set manually.</p>
        </div>
        <div class="head-actions">
          <span class="chip chip-example">Example data</span>
        </div>
      </div>

      <div class="banner banner-amber">
        <div><strong>Nothing is deleted automatically.</strong> Candidates stay on this list until you mark them responsive, archive them, or delete them permanently. Archived records can still be found later.</div>
      </div>

      <div class="tabs">
        <a class="tab" href="01-candidates-list.html">Active <span class="count">24</span></a>
        <div class="tab-on">Due for review <span class="count">5</span></div>
        <div class="tab">Archived <span class="count">11</span></div>
      </div>

      <div class="card table-wrap">
        <table>
          <colgroup>
            <col style="width:14%" /><col style="width:13%" /><col style="width:12%" />
            <col style="width:16%" /><col style="width:12%" /><col style="width:13%" /><col style="width:20%" />
          </colgroup>
          <thead>
            <tr>
              <th>Candidate</th>
              <th class="wrap">Responsiveness</th>
              <th class="wrap">Original entry date</th>
              <th>Rule</th>
              <th class="wrap">Due date</th>
              <th class="wrap">Days overdue</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
{chr(10).join(due_tr)}
          </tbody>
        </table>
      </div>'''

due_body = due_shared + '''
      <p class="footer-note">Example data only.</p>'''

due_confirm_body = due_shared + '''
      <p class="footer-note">Example data only.</p>'''

due_overlay = '''      <div class="overlay">
        <div class="dialog">
          <h2>Delete Amira Khan permanently?</h2>
          <p>This will remove Amira Khan’s personal data from the candidate record, including contact details, notes and the audit trail.</p>
          <p>Anonymous totals used in reports are kept, so monthly counts are not lost. The record itself cannot be restored.</p>
          <p class="muted">Nothing else on this list will be changed. Deletion is never automatic.</p>
          <div class="dialog-actions">
            <a class="btn-secondary" href="11-due-for-review.html">Cancel</a>
            <div class="btn-danger solid">Delete permanently</div>
          </div>
        </div>
      </div>'''

# ---------- 12 Inductions ----------
def ready_pill(ok):
    return '<span class="pill pill-green">Stage 2 ready</span>' if ok else '<span class="pill pill-amber">Stage 2 not ready</span>'

inductions_body = f'''      <div class="page-head">
        <div>
          <div class="crumb">Onboarding / <span>Inductions</span></div>
          <h1>Inductions</h1>
          <p class="lede">Intake dates are shared across Doncaster and Sheffield, and each intake has its own booking deadline. There is no capacity cap. Missed deadlines are flagged for Anne-Marie — candidates are never moved automatically.</p>
        </div>
        <div class="head-actions">
          <span class="chip chip-example">Example data</span>
          <div class="btn">{ICONS["plus"]} Add intake date</div>
        </div>
      </div>

      <div class="banner banner-amber">
        <div><strong>Flagged for Anne-Marie.</strong> Katie Shaw was booked onto the 2 Nov intake two days after the 12 Oct deadline, and two candidates booked on 4 Jan are not yet Stage 2 ready. Nobody has been moved or unbooked automatically.</div>
      </div>

      <div class="card intake">
        <div class="intake-head">
          <div>
            <div class="intake-title">Monday 2 Nov 2026</div>
            <div class="side-sub">Shared intake · both sites · booking deadline 12 Oct 2026 (configurable)</div>
          </div>
          <span class="pill pill-grey">Held</span>
        </div>
        <table>
          <colgroup>
            <col style="width:18%" /><col style="width:12%" /><col style="width:16%" /><col style="width:12%" /><col style="width:14%" /><col style="width:28%" />
          </colgroup>
          <thead>
            <tr>
              <th>Candidate</th>
              <th>Site</th>
              <th>Stage 2 readiness</th>
              <th>Booked</th>
              <th>Attendance</th>
              <th>If absent</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td class="name">Reuben Clark</td>
              <td>Doncaster</td>
              <td>{ready_pill(True)}</td>
              <td>Booked</td>
              <td><span class="pill pill-green">Attended</span></td>
              <td class="muted">—</td>
            </tr>
            <tr>
              <td class="name">Dylan Shore</td>
              <td>Sheffield</td>
              <td>{ready_pill(True)}</td>
              <td>Booked</td>
              <td><span class="pill pill-green">Attended</span></td>
              <td class="muted">—</td>
            </tr>
            <tr>
              <td class="name">Theo Wade</td>
              <td>Doncaster</td>
              <td>{ready_pill(True)}</td>
              <td>Booked</td>
              <td><span class="pill pill-red">Absent</span></td>
              <td>
                <div class="choice">
                  <span class="opt">Reschedule</span>
                  <span class="opt">Pause</span>
                  <span class="opt on-red">Withdraw</span>
                </div>
              </td>
            </tr>
            <tr>
              <td class="name">Katie Shaw</td>
              <td>Sheffield</td>
              <td>{ready_pill(True)}</td>
              <td>Booked <span class="pill pill-amber">After deadline</span></td>
              <td><span class="pill pill-red">Absent</span></td>
              <td>
                <div class="choice">
                  <span class="opt on-amber">Reschedule</span>
                  <span class="opt">Pause</span>
                  <span class="opt">Withdraw</span>
                </div>
                <div class="note-inline">Rescheduled to 4 Jan 2027</div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div class="card intake">
        <div class="intake-head">
          <div>
            <div class="intake-title">Monday 4 Jan 2027</div>
            <div class="side-sub">Shared intake · both sites · booking deadline 14 Dec 2026 (configurable) · no capacity cap</div>
          </div>
          <span class="pill pill-navy">Upcoming</span>
        </div>
        <table>
          <colgroup>
            <col style="width:18%" /><col style="width:12%" /><col style="width:18%" /><col style="width:16%" /><col style="width:14%" /><col style="width:22%" />
          </colgroup>
          <thead>
            <tr>
              <th>Candidate</th>
              <th>Site</th>
              <th>Stage 2 readiness</th>
              <th>Booked</th>
              <th>Attendance</th>
              <th>Notes</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td class="name">Lewis Cartwright</td>
              <td>Sheffield</td>
              <td>{ready_pill(True)}</td>
              <td><span class="pill pill-green">Booked</span></td>
              <td class="muted">Not yet held</td>
              <td class="muted">Customer Service · Meadowside</td>
            </tr>
            <tr>
              <td class="name">Katie Shaw</td>
              <td>Sheffield</td>
              <td>{ready_pill(True)}</td>
              <td><span class="pill pill-green">Booked</span></td>
              <td class="muted">Not yet held</td>
              <td>Rescheduled from 2 Nov</td>
            </tr>
            <tr>
              <td><a class="name" href="02-candidate-record.html">Maya Henshaw</a></td>
              <td>Doncaster</td>
              <td>{ready_pill(False)}</td>
              <td>Intended only</td>
              <td class="muted">—</td>
              <td>H&amp;S visit still outstanding. Not a booking.</td>
            </tr>
            <tr>
              <td class="name">Freya Moss</td>
              <td>Sheffield</td>
              <td>{ready_pill(False)}</td>
              <td><span class="pill pill-green">Booked</span></td>
              <td class="muted">Not yet held</td>
              <td><span class="pill pill-amber">Flagged</span> Learner file not completed</td>
            </tr>
            <tr>
              <td class="name">Sophie Ware</td>
              <td>Doncaster</td>
              <td>{ready_pill(False)}</td>
              <td>Intended only</td>
              <td class="muted">—</td>
              <td>Interview approval still pending</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div class="card intake">
        <div class="intake-head">
          <div>
            <div class="intake-title">Monday 8 Mar 2027</div>
            <div class="side-sub">Shared intake · both sites · booking deadline 15 Feb 2027 (configurable) · no capacity cap</div>
          </div>
          <span class="pill pill-grey">Open</span>
        </div>
        <div class="card-pad muted">No candidates have been intended or booked on this intake yet.</div>
      </div>'''


extra = [
    ("06-employers-list.html", "Employers & vacancies", "employers", employers_body),
    ("06b-vacancies-list.html", "Vacancies", "employers", vacancies_body),
    ("07-employer-record.html", "Northbridge Motors", "employers", employer_body),
    ("08-activity-calendar.html", "Activity calendar", "calendar", calendar_body),
    ("09-actions.html", "Actions", "actions", actions_body),
    ("10-reports.html", "Monthly report", "reports", reports_body),
    ("11-due-for-review.html", "Due for review", "candidates", due_body),
    ("11b-delete-confirm.html", "Delete Amira Khan", "candidates", due_confirm_body, due_overlay),
    ("12-inductions.html", "Inductions", "inductions", inductions_body),
]

if __name__ == "__main__":
    write_pages(extra)
