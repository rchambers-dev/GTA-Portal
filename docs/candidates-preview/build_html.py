#!/usr/bin/env python3
from pathlib import Path

OUT = Path("/workspace/candidates_preview")

# Inline SVG icons (24 viewBox, stroke currentColor)
ICONS = {
    "grid": '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7" rx="1.2"/><rect x="14" y="3" width="7" height="7" rx="1.2"/><rect x="3" y="14" width="7" height="7" rx="1.2"/><rect x="14" y="14" width="7" height="7" rx="1.2"/></svg>',
    "personplus": '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M19 8v6M22 11h-6"/></svg>',
    "folder": '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7z"/></svg>',
    "chat": '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H8l-5 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>',
    "home": '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M3 11.5 12 4l9 7.5"/><path d="M5 10.5V20h14v-9.5"/></svg>',
    "people": '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></svg>',
    "interview": '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M8 7V3m8 4V3M3 11h18M5 5h14a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2z"/><path d="M8 15h.01M12 15h.01M16 15h.01"/></svg>',
    "building": '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M3 21h18M6 21V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v16M9 8h.01M15 8h.01M9 12h.01M15 12h.01M9 16h.01M15 16h.01"/></svg>',
    "calendar": '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M8 7V3m8 4V3M3 11h18M5 5h14a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2z"/></svg>',
    "checks": '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>',
    "chart": '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19h16M7 16v-5M12 16V8M17 16v-8"/></svg>',
    "clipboard": '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><rect x="8" y="3" width="8" height="4" rx="1"/><path d="M8 5H6a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2"/></svg>',
    "layers": '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="m12 2 9 5-9 5-9-5 9-5z"/><path d="m3 12 9 5 9-5M3 17l9 5 9-5"/></svg>',
    "staff": '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="4"/><path d="M4 21v-1a6 6 0 0 1 6-6h4a6 6 0 0 1 6 6v1"/></svg>',
    "bell": '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" width="18" height="18"><path d="M6 8a6 6 0 1 1 12 0c0 7 3 7 3 9H3c0-2 3-2 3-9"/><path d="M10 20a2 2 0 0 0 4 0"/></svg>',
    "search": '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" width="16" height="16"><circle cx="11" cy="11" r="7"/><path d="m20 20-3-3"/></svg>',
    "plus": '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5v14M5 12h14"/></svg>',
    "back": '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 18l-6-6 6-6"/></svg>',
    "tick": '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12l5 5L20 7"/></svg>',
    "chevron": '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9l6 6 6-6"/></svg>',
    "chevleft": '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="18" height="18"><path d="M15 18l-6-6 6-6"/></svg>',
    "intake": '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M3 21V3h10v18H3z"/><path d="M13 3h8v18h-8"/><path d="M16.5 12H19"/><path d="M7 12h.01"/></svg>',
}


def nav_item(icon, label, href, active=False):
    cls = "nav-item active" if active else "nav-item"
    return f'<a class="{cls}" href="{href}"><span class="ico">{ICONS[icon]}</span><span>{label}</span></a>'


def sidebar(active):
    # active is one of: overview, candidates, interviews, employers, calendar, actions, reports, add
    items = [
        ("overview", "home", "05-overview.html", "Overview"),
        ("candidates", "people", "01-candidates-list.html", "Candidates"),
        ("interviews", "interview", "04-interviews.html", "Interviews"),
        ("inductions", "intake", "12-inductions.html", "Inductions"),
        ("employers", "building", "06-employers-list.html", "Employers &amp; vacancies"),
        ("calendar", "calendar", "08-activity-calendar.html", "Activity calendar"),
        ("actions", "checks", "09-actions.html", "Actions"),
        ("reports", "chart", "10-reports.html", "Reports"),
    ]
    subs = "\n".join(
        f'      <li>{nav_item(icon, label, href, active=active==key)}</li>'
        for key, icon, href, label in items
    )
    return f'''  <aside class="sidebar">
    <div class="brand">
      <div class="logo">GTA</div>
      <div>
        <div class="brand-title">GTA Portal</div>
        <div class="brand-sub">Management</div>
      </div>
    </div>
    <nav class="nav">
      {nav_item("grid", "Dashboard", "#")}
      {nav_item("personplus", "Add apprentice", "#", active=active=="add")}
      {nav_item("folder", "Shared Drive", "#")}
      {nav_item("chat", "Messages", "#")}

      <div class="group-gap">
        <div class="nav-cat open">
          <span class="ico">{ICONS["people"]}</span>
          <span class="cat-label">Onboarding</span>
          <span class="chev">{ICONS["chevleft"]}</span>
        </div>
        <ul class="sublist">
{subs}
        </ul>
      </div>

      <button class="nav-cat" type="button">
        <span class="ico">{ICONS["clipboard"]}</span>
        <span>Reviews</span>
        <span class="chev">{ICONS["chevron"]}</span>
      </button>
      <button class="nav-cat" type="button">
        <span class="ico">{ICONS["layers"]}</span>
        <span>Apprenticeship Management</span>
        <span class="chev">{ICONS["chevron"]}</span>
      </button>
      <button class="nav-cat" type="button">
        <span class="ico">{ICONS["staff"]}</span>
        <span>Staff</span>
        <span class="chev">{ICONS["chevron"]}</span>
      </button>
    </nav>
  </aside>'''


def topbar():
    return f'''    <header class="topbar">
      <div></div>
      <div class="search">{ICONS["search"]} Search pages and commands… <span class="kbd">Ctrl K</span></div>
      <div class="top-actions">
        <div class="icon-btn">{ICONS["bell"]}</div>
        <div class="user">
          <div class="avatar">RC</div>
          <div>
            <div class="user-name">Reiss Chambers</div>
            <div class="user-role">Management</div>
          </div>
        </div>
        <div class="signout">Sign out</div>
      </div>
    </header>'''


def page(title, filename, active, body, crumb="Onboarding", overlay=""):
    return f'''<!DOCTYPE html>
<html lang="en-GB">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=1280" />
  <title>{title} · GTA Portal — preview</title>
  <link rel="stylesheet" href="styles.css" />
</head>
<body>
<div class="shell">
{sidebar(active)}
  <div class="main">
{topbar()}
    <div class="content">
{body}
    </div>
  </div>
{overlay}
</div>
</body>
</html>
'''


# ---------- 1. Candidates list ----------
rows = [
    ("Maya Henshaw", "C‑1042", "Doncaster", "Light Vehicle", ("Stage 2", "pill-navy"), ("Confirmed", "pill-green"), ("Responsive", "pill-green"), ("Complete H&amp;S visit", "")),
    ("Callum Briggs", "C-1108", "Sheffield", "Autocare", ("Interview", "pill-navy"), ("Employer needed", "pill-red"), ("Responsive", "pill-green"), ("Stage 2 locked: employer not confirmed", "blocked")),
    ("Priya Naylor", "—", "Doncaster", "Heavy Vehicle", ("Stage 1", "pill-grey"), ("Identified", "pill-amber"), ("Responsive", "pill-green"), ("Sit Maths assessment", "")),
    ("Sophie Ware", "C-0988", "Doncaster", "Business Admin", ("Interview", "pill-navy"), ("Confirmed", "pill-green"), ("Responsive", "pill-green"), ("Await Anne-Marie approval", "")),
    ("Lewis Cartwright", "C-0871", "Sheffield", "Customer Service", ("Induction", "pill-green"), ("Confirmed", "pill-green"), ("Responsive", "pill-green"), ("Attend induction 4 Jan 2027", "")),
    ("Jordan Blake", "C-1120", "Sheffield", "Vehicle Paint", ("Interview", "pill-navy"), ("Identified", "pill-amber"), ("Unresponsive", "pill-amber"), ("Stage 2 locked: employer not confirmed", "blocked")),
    ("Ethan Patel", "C-1066", "Doncaster", "Vehicle Panel", ("Stage 1", "pill-grey"), ("Employer needed", "pill-red"), ("Responsive", "pill-green"), ("Verify ID", "")),
    ("Freya Moss", "—", "Sheffield", "Light Vehicle", ("Stage 2", "pill-navy"), ("Confirmed", "pill-green"), ("Responsive", "pill-green"), ("Create learner file", "")),
    ("Noah Bennett", "C-1014", "Doncaster", "Autocare", ("Interview", "pill-navy"), ("Confirmed", "pill-green"), ("Responsive", "pill-green"), ("Book Monday session (attempt 2)", "")),
    ("Harper Quinn", "C-1152", "Sheffield", "Heavy Vehicle", ("Stage 1", "pill-grey"), ("Employer needed", "pill-red"), ("Responsive", "pill-green"), ("Record English result", "")),
]

tr_html = []
for name, cid, site, prog, stage, emp, resp, nxt in rows:
    href = "02-candidate-record.html" if name == "Maya Henshaw" else "#"
    nxt_cls = f' next-step {nxt[1]}'.strip() if nxt[1] else "next-step"
    tr_html.append(f'''          <tr>
            <td><a class="name" href="{href}">{name}</a></td>
            <td class="mono muted nowrap">{cid}</td>
            <td class="nowrap">{site}</td>
            <td class="nowrap">{prog}</td>
            <td><span class="pill {stage[1]}">{stage[0]}</span></td>
            <td><span class="pill {emp[1]}">{emp[0]}</span></td>
            <td><span class="pill {resp[1]}">{resp[0]}</span></td>
            <td class="{nxt_cls}">{nxt[0]}</td>
          </tr>''')

list_body = f'''      <div class="page-head">
        <div>
          <div class="crumb">Onboarding / <span>Candidates</span></div>
          <h1>Candidates</h1>
          <p class="lede">Recruitment records for people who have not yet started as an apprentice. Nothing is removed automatically — overdue reviews stay on Due for review until you archive them.</p>
        </div>
        <div class="head-actions">
          <span class="chip chip-example">Example data</span>
          <a class="btn" href="03-add-candidate.html">{ICONS["plus"]} Add candidate</a>
        </div>
      </div>

      <div class="tabs">
        <div class="tab-on">Active <span class="count">24</span></div>
        <a class="tab-amber" href="11-due-for-review.html">Due for review <span class="count">5</span></a>
        <div class="tab">Archived <span class="count">11</span></div>
      </div>

      <div class="card card-pad">
        <div class="filters">
          <div class="field field-grow">
            <span class="label">Search</span>
            <input type="search" value="" placeholder="Name or ID" />
          </div>
          <div class="field field-sm">
            <span class="label">Site</span>
            <select><option>All sites</option><option>Doncaster</option><option>Sheffield</option></select>
          </div>
          <div class="field field-md">
            <span class="label">Programme</span>
            <select><option>All programmes</option><option>Autocare</option><option>Light Vehicle</option><option>Heavy Vehicle</option><option>Vehicle Paint</option><option>Vehicle Panel</option><option>Business Admin</option><option>Customer Service</option></select>
          </div>
          <div class="field field-sm">
            <span class="label">Stage</span>
            <select><option>All stages</option><option>Stage 1</option><option>Interview</option><option>Stage 2</option><option>Induction</option></select>
          </div>
          <div class="field field-md">
            <span class="label">Employer</span>
            <select><option>All employer statuses</option><option>Employer needed</option><option>Identified</option><option>Confirmed</option></select>
          </div>
        </div>
      </div>

      <div class="card table-wrap">
        <table>
          <colgroup>
            <col style="width:15%" />
            <col style="width:8%" />
            <col style="width:10%" />
            <col style="width:13%" />
            <col style="width:10%" />
            <col style="width:13%" />
            <col style="width:14%" />
            <col style="width:17%" />
          </colgroup>
          <thead>
            <tr>
              <th>Candidate</th>
              <th>ID</th>
              <th>Site</th>
              <th>Programme</th>
              <th>Stage</th>
              <th>Employer status</th>
              <th>Responsiveness</th>
              <th>Next step</th>
            </tr>
          </thead>
          <tbody>
{chr(10).join(tr_html)}
          </tbody>
        </table>
      </div>
      <p class="footer-note">Showing 10 of 24 active candidates. Example data only.</p>'''


# ---------- 2. Candidate record ----------
def check(done, title, sub, actual, entered):
    box = f'<div class="box on">{ICONS["tick"]}</div>' if done else '<div class="box"></div>'
    return f'''            <div class="check">
              {box}
              <div>
                <div class="check-title">{title}</div>
                <div class="check-sub">{sub}</div>
              </div>
              <div class="check-dates"><strong>{actual}</strong>{entered}</div>
            </div>'''

record_body = f'''      <a class="back" href="01-candidates-list.html">{ICONS["back"]} Candidates</a>
      <div class="page-head">
        <div>
          <div class="crumb">Onboarding / Candidates / <span>Maya Henshaw</span></div>
          <h1>Maya Henshaw</h1>
          <div class="meta-row">
            <span class="pill pill-grey mono">C-1042</span>
            <span class="muted">Doncaster</span>
            <span class="meta-dot">·</span>
            <span class="muted">Light Vehicle</span>
            <span class="meta-dot">·</span>
            <span class="muted">First contact 3 Mar 2026 · School event</span>
          </div>
        </div>
        <div class="head-actions">
          <span class="chip chip-example">Example data</span>
        </div>
      </div>

      <div class="progress">
        <div class="prog-step done">
          <div class="prog-num">{ICONS["tick"]}</div>
          <div class="prog-label">Stage 1</div>
        </div>
        <div class="prog-rule on"></div>
        <div class="prog-step done">
          <div class="prog-num">{ICONS["tick"]}</div>
          <div class="prog-label">Interview</div>
        </div>
        <div class="prog-rule on"></div>
        <div class="prog-step current">
          <div class="prog-num">3</div>
          <div class="prog-label">Stage 2</div>
        </div>
        <div class="prog-rule"></div>
        <div class="prog-step">
          <div class="prog-num">4</div>
          <div class="prog-label">Induction</div>
        </div>
      </div>

      <div class="layout">
        <div class="stack">
          <section class="section collapsed">
            <div class="section-head">
              <svg class="chev-sm" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9l6 6 6-6"/></svg>
              <h2>Stage 1</h2>
              <span class="pill pill-green">Complete</span>
            </div>
            <div class="summary">ID verified 12 Mar 2026 · Maths pass 19 Mar 2026 · English pass 19 Mar 2026</div>
          </section>

          <section class="section">
            <div class="section-head">
              <svg class="chev-sm" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9l6 6 6-6"/></svg>
              <h2>Interview</h2>
              <span class="pill pill-green">Passed</span>
            </div>
            <div class="section-body">
              <div class="banner banner-green"><div><strong>Passed on first attempt</strong> and approved by Anne-Marie. Maya can enter Stage 2 because her employer is confirmed.</div></div>
              {check(True, "Monday group session", "14 Sep 2026 · 6 of 8 places used that morning", "14 Sep 2026", "Entered 14 Sep 2026 by Anne-Marie")}
              {check(True, "Outcome", "Passed · attempt 1", "14 Sep 2026", "Entered 14 Sep 2026 by Anne-Marie")}
              {check(True, "Approved by Anne-Marie", "Required before Stage 2 can start", "16 Sep 2026", "Entered 16 Sep 2026 by Anne-Marie")}
            </div>
          </section>

          <section class="section">
            <div class="section-head">
              <svg class="chev-sm" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9l6 6 6-6"/></svg>
              <h2>Stage 2</h2>
              <span class="pill pill-amber">In progress</span>
            </div>
            <div class="section-body">
              {check(True, "TNA completed", "Training needs analysis held at Northbridge Motors", "2 Oct 2026", "Entered 3 Oct 2026 by J. Hartley")}
              {check(True, "H&amp;S visit booked", "Visit scheduled for 20 Nov 2026", "8 Oct 2026", "Entered 8 Oct 2026 by Anne-Marie")}
              {check(False, "H&amp;S visit completed", "Waiting for the booked visit on 20 Nov 2026", "Not yet", "—")}
              {check(False, "Learner file created", "File opened on the candidate record", "Not yet", "—")}
              {check(False, "Learner file completed", "All Stage 2 documents present", "Not yet", "—")}
            </div>
          </section>

          <section class="section">
            <div class="section-head">
              <svg class="chev-sm" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9l6 6 6-6"/></svg>
              <h2>Induction</h2>
              <span class="pill pill-grey">Not started</span>
            </div>
            <div class="section-body">
              {check(False, "Intended intake", "4 Jan 2027 · this is a plan date, not a booking", "Intended 4 Jan 2027", "Entered 18 Sep 2026 by Anne-Marie")}
              {check(False, "Induction booked", "A place on an intake must be booked separately", "Not yet", "—")}
              {check(False, "Attendance", "Confirmed only after the induction day", "Not yet", "—")}
              {check(False, "Actual start", "Becomes an apprentice record once attendance is confirmed", "Not yet", "—")}
            </div>
          </section>
        </div>

        <div class="stack">
          <div class="card side-card">
            <div class="side-label">Employer</div>
            <div class="side-value">Northbridge Motors</div>
            <div class="side-sub"><span class="pill pill-green">Confirmed</span></div>
            <div class="side-sub">Confirmed 18 Sep 2026, entered the same day by Anne-Marie.</div>
          </div>
          <div class="card side-card">
            <div class="side-label">Intended induction</div>
            <div class="side-value">4 Jan 2027</div>
            <div class="side-sub">Not a booking. A place still needs to be reserved on that intake.</div>
          </div>
          <div class="card side-card">
            <div class="side-label">Responsiveness</div>
            <div class="side-value">Responsive</div>
            <div class="side-sub">Set manually. Review is due 1 year after the original entry date.</div>
            <div class="side-sub" style="margin-top:10px"><span class="pill pill-grey">Review due 3 Mar 2027</span></div>
          </div>
        </div>
      </div>

      <div class="card card-pad">
        <h2 class="card-title">Audit trail</h2>
        <div class="timeline">
          <div class="event"><div class="rail"><div class="dot"></div></div><div class="event-body"><div class="event-title">H&amp;S visit booked for 20 Nov 2026</div><div class="event-meta">Actual date 8 Oct 2026 · Entered 8 Oct 2026 by Anne-Marie</div></div></div>
          <div class="event"><div class="rail"><div class="dot"></div></div><div class="event-body"><div class="event-title">TNA completed</div><div class="event-meta">Actual date 2 Oct 2026 · Entered 3 Oct 2026 by J. Hartley</div></div></div>
          <div class="event"><div class="rail"><div class="dot"></div></div><div class="event-body"><div class="event-title">Employer confirmed — Northbridge Motors</div><div class="event-meta">Actual date 18 Sep 2026 · Entered 18 Sep 2026 by Anne-Marie</div></div></div>
          <div class="event"><div class="rail"><div class="dot"></div></div><div class="event-body"><div class="event-title">Interview passed and approved</div><div class="event-meta">Actual date 16 Sep 2026 · Entered 16 Sep 2026 by Anne-Marie</div></div></div>
          <div class="event"><div class="rail"><div class="dot"></div></div><div class="event-body"><div class="event-title">Attended Monday interview (attempt 1)</div><div class="event-meta">Actual date 14 Sep 2026 · Entered 14 Sep 2026 by Anne-Marie</div></div></div>
          <div class="event"><div class="rail"><div class="dot"></div></div><div class="event-body"><div class="event-title">Maths pass and English pass</div><div class="event-meta">Actual date 19 Mar 2026 · Entered 20 Mar 2026 by J. Hartley</div></div></div>
          <div class="event"><div class="rail"><div class="dot"></div></div><div class="event-body"><div class="event-title">ID verified</div><div class="event-meta">Actual date 12 Mar 2026 · Entered 12 Mar 2026 by Anne-Marie</div></div></div>
          <div class="event"><div class="rail"><div class="dot"></div></div><div class="event-body"><div class="event-title">Candidate record created</div><div class="event-meta">Actual date 3 Mar 2026 · Entered 3 Mar 2026 by Anne-Marie · Source: School event</div></div></div>
        </div>
      </div>'''


# ---------- 3. Add candidate ----------
add_body = f'''      <a class="back" href="01-candidates-list.html">{ICONS["back"]} Candidates</a>
      <div class="page-head">
        <div>
          <div class="crumb">Onboarding / Candidates / <span>Add candidate</span></div>
          <h1>Add candidate</h1>
          <p class="lede">Manual entry for a new enquiry. An intended intake is a plan date only — it does not book a place.</p>
        </div>
        <div class="head-actions">
          <span class="chip chip-example">Example data</span>
        </div>
      </div>

      <div class="form-layout">
        <div class="card card-pad">
          <div class="form-grid">
            <div class="field">
              <span class="label">First name</span>
              <input value="Hannah" />
            </div>
            <div class="field">
              <span class="label">Last name</span>
              <input value="Colton" />
            </div>
            <div class="field">
              <span class="label">Existing ID, optional</span>
              <input placeholder="If they already have a GTA ID" value="" />
            </div>
            <div class="field">
              <span class="label">Site</span>
              <select><option>Doncaster</option><option>Sheffield</option></select>
            </div>
            <div class="field">
              <span class="label">Programme</span>
              <select><option>Autocare</option><option>Light Vehicle</option><option>Heavy Vehicle</option><option>Vehicle Paint</option><option>Vehicle Panel</option><option>Business Admin</option><option>Customer Service</option></select>
            </div>
            <div class="field">
              <span class="label">Original first-contact date</span>
              <input value="14 Nov 2026" />
            </div>
            <div class="field">
              <span class="label">Source</span>
              <select>
                <option>Website</option>
                <option>Social media</option>
                <option>School event</option>
                <option>Google</option>
                <option>Word of mouth</option>
                <option>Leaflet</option>
                <option>Flyer</option>
                <option>GTA prospectus</option>
                <option>Other</option>
              </select>
            </div>
            <div class="field">
              <span class="label">Employer status</span>
              <select><option>Employer needed</option><option>Identified</option><option>Confirmed</option></select>
            </div>
            <div class="field wide">
              <span class="label">Employer</span>
              <select><option>None yet</option><option>Northbridge Motors</option><option>Ashfield Coachworks</option><option>Riverside Fleet Services</option></select>
              <div class="hint">Required later: a candidate can be interviewed without an employer, but cannot enter Stage 2 until the employer is confirmed.</div>
            </div>
            <div class="field wide">
              <span class="label">Intended intake, optional</span>
              <input placeholder="dd/mm/yyyy" value="" />
              <div class="hint">Not a booking — this only records a planned intake date.</div>
            </div>
            <div class="field wide">
              <span class="label">Notes</span>
              <textarea>Called after seeing the Autocare page on the GTA website. Interested in a January start if a place is available.</textarea>
            </div>
          </div>
          <div style="display:flex;gap:8px;margin-top:18px;justify-content:flex-end">
            <a class="btn-secondary" href="01-candidates-list.html">Cancel</a>
            <div class="btn">Save candidate</div>
          </div>
        </div>

        <div class="stack">
          <div class="card side-card">
            <div class="side-label">What happens next</div>
            <div class="side-value">Starts in Stage 1</div>
            <div class="side-sub">Every new candidate begins in Stage 1. Nothing is marked complete automatically.</div>
            <ul class="help-list">
              <li>ID verified, with the actual date</li>
              <li>Maths pass or fail, with the actual date</li>
              <li>English pass or fail, with the actual date</li>
            </ul>
            <div class="side-sub" style="margin-top:12px">Responsiveness is set on the record after you save. Review is then due in 1 year if Responsive, or in 3 months if Unresponsive.</div>
          </div>
        </div>
      </div>'''


# ---------- 4. Interviews ----------
def irow(name, att, att_pill, outcome, out_pill, attempt, decision, dec_pill):
    return f'''            <tr>
              <td class="name">{name}</td>
              <td><span class="pill {att_pill}">{att}</span></td>
              <td><span class="pill {out_pill}">{outcome}</span></td>
              <td>{attempt}</td>
              <td><span class="pill {dec_pill}">{decision}</span></td>
            </tr>'''

interviews_body = f'''      <div class="page-head">
        <div>
          <div class="crumb">Onboarding / <span>Interviews</span></div>
          <h1>Interviews</h1>
          <p class="lede">Group sessions run on Mondays, with a maximum of 8 candidates. Bank holidays are skipped. A candidate can be interviewed without an employer, but cannot enter Stage 2 until one is confirmed.</p>
        </div>
        <div class="head-actions">
          <span class="chip chip-example">Example data</span>
        </div>
      </div>

      <div class="overview-grid">
        <div class="card card-pad">
          <div class="card-title" style="margin-bottom:4px">Latest session · Monday 9 Nov 2026</div>
          <p class="muted" style="margin-bottom:14px">Doncaster · awaiting Anne-Marie’s approval on the outstanding outcomes</p>
          <div class="places"><strong>7</strong> <span>of 8 places used · 1 no-show</span></div>
          <div class="meter"><i style="width:87.5%"></i></div>
        </div>
        <div class="card card-pad">
          <div class="card-title" style="margin-bottom:4px">Next Monday · 16 Nov 2026</div>
          <p class="muted" style="margin-bottom:14px">Doncaster · bookings only, session not yet held</p>
          <div class="places"><strong>6</strong> <span>of 8 places booked</span></div>
          <div class="meter"><i style="width:75%"></i></div>
        </div>
      </div>

      <div class="card table-wrap">
        <div class="card-pad" style="padding-bottom:8px;display:flex;justify-content:space-between;align-items:center;gap:12px">
          <h2 class="card-title" style="margin:0">Attendees · 9 Nov 2026</h2>
          <div class="btn">Approve outcomes</div>
        </div>
        <table>
          <thead>
            <tr>
              <th>Candidate</th>
              <th>Attendance</th>
              <th>Outcome</th>
              <th>Attempt</th>
              <th>Decision</th>
            </tr>
          </thead>
          <tbody>
{irow("Sophie Ware", "Present", "pill-green", "Passed", "pill-green", "1", "Pending approval", "pill-amber")}
{irow("Callum Briggs", "Present", "pill-green", "Passed", "pill-green", "1", "Pending approval", "pill-amber")}
{irow("Harper Quinn", "Present", "pill-green", "Passed", "pill-green", "1", "Pending approval", "pill-amber")}
{irow("Noah Bennett", "Present", "pill-green", "Failed", "pill-red", "2", "Approved", "pill-green")}
{irow("Dylan Shore", "Present", "pill-green", "Passed", "pill-green", "1", "Approved", "pill-green")}
{irow("Ivy Morton", "Present", "pill-green", "Failed", "pill-red", "1", "Approved", "pill-green")}
{irow("Reuben Clark", "Present", "pill-green", "Passed", "pill-green", "1", "Approved", "pill-green")}
{irow("Jordan Blake", "No show", "pill-red", "—", "pill-grey", "1", "Follow-up needed", "pill-red")}
          </tbody>
        </table>
      </div>

      <div class="banner banner-red">
        <div><strong>No-show follow-up.</strong> Jordan Blake did not attend the 9 Nov session (attempt 1). A follow-up was due by 11 Nov 2026 and is now overdue. Responsiveness is already set to Unresponsive, so the review date is 3 months after first contact. An employer is Identified but not confirmed — even after a later pass, Stage 2 stays locked until the employer is confirmed.</div>
      </div>

      <div class="card card-pad">
        <h2 class="card-title">Upcoming Mondays</h2>
        <p class="muted" style="margin:-4px 0 12px">Bank holidays are skipped. Monday 28 Dec 2026 is a substitute Boxing Day holiday, so there is no session that week.</p>
        <div class="monday-list">
          <div class="monday">
            <div><div class="when">Mon 16 Nov 2026 · Doncaster</div><div class="seats">Next session</div></div>
            <span class="pill pill-navy">6 of 8 booked</span>
          </div>
          <div class="monday">
            <div><div class="when">Mon 23 Nov 2026 · Sheffield</div></div>
            <span class="pill pill-grey">2 of 8 booked</span>
          </div>
          <div class="monday">
            <div><div class="when">Mon 30 Nov 2026 · Doncaster</div></div>
            <span class="pill pill-grey">0 of 8 booked</span>
          </div>
          <div class="monday">
            <div><div class="when">Mon 7 Dec 2026 · Sheffield</div></div>
            <span class="pill pill-grey">1 of 8 booked</span>
          </div>
          <div class="monday">
            <div><div class="when">Mon 14 Dec 2026 · Doncaster</div></div>
            <span class="pill pill-grey">0 of 8 booked</span>
          </div>
          <div class="monday">
            <div><div class="when">Mon 21 Dec 2026 · Sheffield</div></div>
            <span class="pill pill-grey">0 of 8 booked</span>
          </div>
          <div class="monday skip">
            <div><div class="when">Mon 28 Dec 2026</div><div class="seats">Skipped — substitute Boxing Day bank holiday</div></div>
            <span class="pill pill-grey">No session</span>
          </div>
          <div class="monday">
            <div><div class="when">Mon 4 Jan 2027 · Doncaster</div></div>
            <span class="pill pill-grey">0 of 8 booked</span>
          </div>
        </div>
      </div>'''


# ---------- 5. Overview ----------
def attn(name, sub, pill, pill_cls):
    return f'''            <div class="attn-item">
              <div class="attn-top">
                <div class="attn-name">{name}</div>
                <span class="pill {pill_cls}">{pill}</span>
              </div>
              <div class="attn-sub">{sub}</div>
            </div>'''

overview_body = f'''      <div class="page-head">
        <div>
          <div class="crumb">Onboarding / <span>Overview</span></div>
          <h1>Candidates overview</h1>
          <p class="lede">A snapshot of the recruitment pipeline. Use the site filter to look at Doncaster or Sheffield on their own.</p>
        </div>
        <div class="head-actions" style="align-items:center">
          <span class="chip chip-example">Example data</span>
          <div class="field" style="min-width:150px">
            <select><option>All sites</option><option>Doncaster</option><option>Sheffield</option></select>
          </div>
        </div>
      </div>

      <div class="metrics">
        <div class="card metric"><div class="k">Stage 1</div><div class="v">8</div><div class="s">ID, Maths and English</div></div>
        <div class="card metric"><div class="k">Interview</div><div class="v">7</div><div class="s">Including 3 pending approval</div></div>
        <div class="card metric"><div class="k">Stage 2</div><div class="v">5</div><div class="s">Employer confirmed</div></div>
        <div class="card metric"><div class="k">Induction</div><div class="v">4</div><div class="s">Intended or booked</div></div>
      </div>

      <div class="overview-grid">
        <div class="card card-pad">
          <h2 class="card-title">Needs attention</h2>
          <div class="attention">
            <div>
              <div class="side-label" style="margin-bottom:4px">Employer needed</div>
              {attn("Callum Briggs", "Sheffield · Autocare · Interview passed", "Stage 2 locked", "pill-red")}
              {attn("Ethan Patel", "Doncaster · Vehicle Panel · still in Stage 1", "Employer needed", "pill-red")}
              {attn("Harper Quinn", "Sheffield · Heavy Vehicle · still in Stage 1", "Employer needed", "pill-red")}
            </div>
            <div>
              <div class="side-label" style="margin-bottom:4px">Decision pending</div>
              {attn("Sophie Ware", "Doncaster · 9 Nov session · Passed", "Awaiting Anne-Marie", "pill-amber")}
              {attn("Callum Briggs", "Sheffield · 9 Nov session · Passed", "Awaiting Anne-Marie", "pill-amber")}
              {attn("Harper Quinn", "Sheffield · 9 Nov session · Passed", "Awaiting Anne-Marie", "pill-amber")}
            </div>
            <div>
              <div class="side-label" style="margin-bottom:4px">Due for review</div>
              {attn("Amira Khan", "Doncaster · Unresponsive · due 12 Nov", "3 months overdue", "pill-red")}
              {attn("Oscar Flynn", "Sheffield · Responsive · due 16 Nov", "Due this week", "pill-amber")}
              {attn("Lila Bennett", "Doncaster · Responsive · due 20 Nov", "Due this month", "pill-amber")}
            </div>
            <div>
              <div class="side-label" style="margin-bottom:4px">Overdue follow-ups</div>
              {attn("Jordan Blake", "No-show on 9 Nov · follow-up due 11 Nov", "Overdue", "pill-red")}
              {attn("Ivy Morton", "Failed attempt 1 · still needs attempt 2 booked", "Overdue", "pill-red")}
            </div>
          </div>
        </div>

        <div class="stack">
          <div class="card card-pad">
            <h2 class="card-title">Next interview</h2>
            <div class="side-value">Monday 16 Nov 2026</div>
            <div class="side-sub">Doncaster · group session, maximum of 8</div>
            <div class="places" style="margin-top:12px"><strong>6</strong> <span>of 8 places booked</span></div>
            <div class="meter"><i style="width:75%"></i></div>
            <div class="side-sub" style="margin-top:12px">2 places still open. Bank holidays are skipped — there is no session on Monday 28 Dec 2026.</div>
            <div style="margin-top:14px"><a class="btn-secondary" href="04-interviews.html">Open interviews</a></div>
          </div>
          <div class="card card-pad">
            <h2 class="card-title">Pipeline</h2>
            <div class="side-sub" style="margin-top:-4px">24 active candidates across both sites. 5 are on Due for review and stay there until they are updated or archived — nothing is deleted automatically.</div>
            <div style="margin-top:14px"><a class="btn-secondary" href="01-candidates-list.html">Open candidates</a></div>
          </div>
        </div>
      </div>'''


pages = [
    ("01-candidates-list.html", "Candidates", "candidates", list_body),
    ("02-candidate-record.html", "Maya Henshaw", "candidates", record_body),
    ("03-add-candidate.html", "Add candidate", "candidates", add_body),
    ("04-interviews.html", "Interviews", "interviews", interviews_body),
    ("05-overview.html", "Candidates overview", "overview", overview_body),
]

def write_pages(extra=None):
    all_pages = list(pages)
    if extra:
        all_pages.extend(extra)
    for item in all_pages:
        filename, title, active, body, *rest = item
        overlay = rest[0] if rest else ""
        html = page(title, filename, active, body, overlay=overlay)
        (OUT / filename).write_text(html, encoding="utf-8")
        print(f"wrote {filename} ({len(html)} bytes)")


if __name__ == "__main__":
    write_pages()
