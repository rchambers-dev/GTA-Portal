# Course Builder — missing form modules

Seeded Autocare **Groups** learner forms (`autocare-groups-forms.ts`) use only modules that already exist in the palette. Gaps below are what we still need before forms match full PDF / block practical templates and assessment practice.

## High priority

| Missing module | Why it matters |
| --- | --- |
| **Assessor / trainer sign-off** (second role, or allow multiple `sign_off`) | Palette currently allows only one `sign_off`. Block practicals need apprentice **and** assessor declarations. Seeds include apprentice only. |
| **Photo / image evidence upload** | Workshop evidence (before/after, defects, TPMS, alignment printouts) cannot be attached in-form today. |
| **File / PDF attachment** | Alignment reports, job cards, scan printouts, quotes. |
| **Assessment decision** (staff-only Pass / Refer / Resubmit) | Approximable with `radio_group` + `filledBy: trainer`, but no dedicated staff-only assessment block or section lock. |

## Medium priority

| Missing module | Why it matters |
| --- | --- |
| **Measurement / spec table** | Structured rows: reading · limit · result (pass/fail). Seeds use repeated short-answer fields instead. |
| **Torque / fastener table** | Common on R&R jobs; currently free text. |
| **Mentor workplace sign-off** | Job-card style confirmation distinct from trainer assessor. |
| **Staff-only section** | Assessor notes and decisions should not be editable by the learner in the same canvas. |

## Lower priority / later

| Missing module | Why it matters |
| --- | --- |
| **EV isolation checklist preset** | Group 2 is awareness-only today; gateway HV work will need a stronger dedicated pattern. |
| **F-Gas / refrigerant log fields** | A/C tasks note qualified handling in guidance only. |
| **Drawing / annotation** | Sketch wear patterns, wiring, damage. |
| **Video evidence upload** | Optional for diagnose / customer tasks. |
| **Scored knowledge quiz** | Group knowledge tests are separate CEA items; not authored as Course Builder forms yet. |
| **Gateway item forms** | Gateway checklist items are listed on the pack but have no learner form seeds. |

## Already covered by existing modules

Heading, guidance, short answer, written response, number, date, checklist, single choice, knowledge check, confidence rating, action plan, parts & materials, single sign-off, task difficulty.

## Notes

- Autocare Groups seeds are marked **Form ready** so staff can review and tweak in Course Builder; edits demote to Pending as usual.
- Seeds do **not** invent KSB mappings (still pending Jon).
- Opening Autocare Groups in Course Builder persists missing seeds into local storage without overwriting existing staff forms.
