# Portal UX visual test — 8 HOLD cases (current Portal only)

**Date:** 2026-08-10  
**Status:** UX findings only — no product changes implemented.  
**Route tested (code inspection):** `/management/programme-builder` → Curriculum Coverage / Gap (+ nested AI Analysis)

## Critical finding

**The Portal does not currently surface HOLD_FOR_EVIDENCE, Evidence Requests (ER-*), or human-ratification shadow conclusions.**

Staging files under `tests/artifacts/.../human-ratification-pack/` are **not loaded** by Programme Builder.

What Jon / a curriculum user sees today for the 8 HOLD KSBs is only:

1. **Curriculum Coverage / Gap** — DB Primaries + hardcoded Golden A reviewed-gap register  
2. Optional **AI Analysis** — SOW-only AI-1.x recommendations (different system; does not show HolDS/ERs)

Therefore this document records **current Portal appearance** for each case, then the UX gap vs the HOLD/ER truth we ratified in staging.

---

## Screen: Curriculum Coverage / Gap (what exists)

From `CurriculumCoveragePanel.tsx`:

- Title: **Curriculum Coverage / Gap**
- Intro: “Authoritative coverage comes only from approved Primary mappings…”
- Metrics: Official · Approved Primaries · Reviewed gaps · Distributed · Not yet resolved
- Layers:
  - Official requirement
  - **Current programme truth** (chips `KSB → Bn`)
  - **Reviewed curriculum gaps** (`<details>` groups: title, reason, chips, proposed amendment)
  - Distributed-skill review
  - Proposed amendments (advisory list)
  - **AI Analysis** (run / list / click KSB for classification + evidence)
  - Not yet resolved chips

**No KSB detail drawer for HOLD.**  
**No ER list.**  
**No teaching / practice / assessment / visibility axes.**  
**No “request evidence” action.**

Click-through today:
- Gap group → expand `<details>` (reason + chips + proposed B/W) only  
- AI Analysis → open run → click chip → classification, confidence, reasoning, evidence excerpts (if a run exists)

---

## What Portal shows today for each HOLD KSB

| KSB | Portal layer today | What user sees | HOLD/ER staging (NOT in Portal) |
|---|---|---|---|
| **K8** | Reviewed curriculum gap | Gap chip under service-literature group | HOLD + ER-16; PARTIAL candidate; manuals/service history |
| **K9** | Approved Primary **B7** | Chip `K9 → B7` in programme truth | HOLD + ER-09; ownership likely B2; tech-info open |
| **K15** | Approved Primary **B2** | Chip `K15 → B2` | HOLD + ER-10; ownership likely G7; e-machine open |
| **K17** | Approved Primary **B9** | Chip `K17 → B9` | HOLD + ER-11; ownership likely G11; methods open |
| **K20** | Reviewed curriculum gap | Gap chip with S25 fluids group | HOLD + ER-18; fluids proven in richer corpus; air filter open |
| **K25** | Approved Primary **B6** | Chip `K25 → B6` | HOLD + ER-20; ownership not confidently B6; business-ops open |
| **S13** | Approved Primary **B6** | Chip `S13 → B6` | HOLD + ER-04; rules taught; assessed isolation unproven |
| **S25** | Reviewed curriculum gap | Gap chip with K20 | HOLD + ER-18 (shared) |

---

### K8 — current Portal

**Location:** Reviewed curriculum gaps → group containing K8 (service literature / manuals / warranties).

**Wording user sees (from `reviewed-curriculum-gaps.ts`):** human-reviewed “no defensible Primary on current original SOW” style reason for K8 group + proposed amendment advisory.

**Proven / missing / ER / HOLD?** Not shown.  
**Primary?** None (gap).  
**Misleading vs HOLD truth:** Sounds like total curriculum absence. Does not say service-history PPT may be unextracted or that documents practice already exists. No ER-16.

**UX assessment:** Jon would understand “gap”, not why HOLD / what to fetch.  
**Needs change before wider use:** Yes.

---

### K9 — current Portal

**Location:** Current programme truth → `K9 → B7`.

**Looks “done”.** No residual tech-info warning. No suggested B2 ownership. No ER-09.

**Misleading vs HOLD truth:** Presents late B7 as settled; hides strong early B2 operational teaching and open legislation/labelling/sidewall/homolog. Looks like no action needed.

**Critical test case FAILED in current UX.**  
**Needs change before wider use:** Yes (misleading confidence).

---

### K15 — current Portal

**Location:** Programme truth → `K15 → B2`.

**Looks settled at B2.** No e-machine residual. No G7 ownership candidate. No ER-10.

**Misleading:** Golden A B2 presented as complete; richer review wants G7 + open e-machine component.

**Needs change:** Yes.

---

### K17 — current Portal

**Location:** Programme truth → `K17 → B9`.

**Looks settled.** No G11-first note, no static/dynamic methods residual, no ER-11.

**Misleading:** Late B9 looks final; methods incompleteness invisible.

**Needs change:** Yes.

---

### K20 — current Portal

**Location:** Reviewed gaps → fluids/filtration group with S25.

**Wording (gap register):** framed as no defensible Primary for fluid/filtration set on original SOW.

**Misleading vs HOLD truth:** Does not show fluids already evidenced in richer corpus; does not isolate air-filter residual; does not offer ER-18. Reads as full gap / not delivered.

**Critical test case FAILED.**  
**Needs change:** Yes.

---

### S25 — current Portal

Same gap group as K20. Duplicate gap framing. No shared ER-18.

**Misleading:** same as K20 — total gap instead of fluids strong + filtration incomplete.  
**Needs change:** Yes.

---

### K25 — current Portal

**Location:** Programme truth → `K25 → B6`.

**Looks like confident B6 ownership and coverage.** No business-ops residual, no ER-20, no “fragments only”.

**Critical test case FAILED** (exactly the B6 overconfidence risk).  
**Needs change:** Yes.

---

### S13 — current Portal

**Location:** Programme truth → `S13 → B6`.

**Looks like fully covered Primary.** No distinction teaching rules vs assessed competence. No ER-04. Closest alternative: AI Analysis may say something different if a run exists — still not HOLD wording.

**Critical test case FAILED** — Portal can be read as “S13 taught/owned; done,” which collapses rules≠competence.

**Needs change:** Yes.

---

## AI Analysis panel (secondary)

If Jon runs/opens a historical AI run and clicks a code, they see AI-1.x classification / confidence / reasoning / excerpts from the **SOW lesson-plan corpus only** — not richer-evidence HOLD cards or ERs.

This can disagree with Golden A and with shadow HOLDs without explaining the ratification HOLD.

**Do not treat AI Analysis as the HOLD UX.**

---

## Screenshots / rendered views

**Unable to capture live screenshots of HOLD cards** because those cards **do not exist in the Portal**.

What can be shown from the live app (if logged in):

1. Programme Builder → Curriculum Coverage / Gap header + metrics  
2. Approved Primary chips including K9→B7, K15→B2, K17→B9, K25→B6, S13→B6  
3. Reviewed gap groups including K8 and K20/S25  
4. AI Analysis empty or prior runs (optional)

A live browser pass would only reconfirm the table above — it would not show HOLD/ER detail.

---

## Cross-cutting UX assessment

| Question | Current Portal |
|---|---|
| Would Jon understand without analysis process knowledge? | Only as Primary vs Gap chips — not HOLD meaning |
| Explains WHY on HOLD? | **No** |
| Distinguishes teaching / practice / assessment / ownership / visibility / genuine gap? | **No** (only Primary vs reviewed gap vs distributed vs AI class) |
| Avoids “missing evidence = not delivered”? | **No** for gap chips (K8/K20/S25 especially) |
| Explains specific evidence needed next? | **No** |
| Too technical / vague / AI-like? | Gap register reasons are plain but SOW-era; AI detail can be AI-like |
| Enough evidence detail to trust? | Gap: reason only. Primary: none. |
| Too much detail for normal user? | N/A — under-detailed for HOLD cases |

---

## Confusing / misleading wording (current)

| Shown today | Problem | Proposed replacement (do not implement yet) |
|---|---|---|
| Reviewed curriculum gap (K8, K20, S25) as “no defensible Primary on current original SOW” | Reads as not taught; ignores richer evidence / visibility | “Coverage incomplete — specific evidence still needed” + list proven axes vs open component + ER |
| `K9 → B7` / `K15 → B2` / `K17 → B9` / `K25 → B6` / `S13 → B6` as unqualified programme truth chips | Looks final; hides HOLD residuals and ownership reviews | Chip + badge “Under evidence review” with short status line |
| No ER request UI | User cannot act | “Requested evidence” panel: one ER-18 for K20+S25; per-HOLD action “Provide evidence” |
| S13 as Primary only | Implies competence covered | “Primary ownership B6 · Isolation **rules** taught · **Assessed learner isolation** not yet evidenced (ER-04)” |
| K9 as B7 Primary only | Hides strong B2 + open tech-info | “Operational tyre teaching strong (candidate Primary B2) · Legislation/labelling/sidewall/homolog awaiting Tyres.ppt (ER-09) · Golden A B7 under review” |
| K25 as B6 Primary | Over-credits Golden A | “Business fragments only · Dedicated efficiency/competitiveness/risk teaching not evidenced (ER-20) · Ownership not confirmed as B6” |

---

## Missing Portal fields / buttons (needed later — not implemented)

1. Assurance status: APPROVED / HOLD FOR EVIDENCE / GAP / KEEP WITH RESIDUAL  
2. Axis strip: Teaching · Practice · Assessment · Workplace · Ownership  
3. “Already proven” vs “Still needed”  
4. Linked Evidence Request(s) with deduped ER-18  
5. Requested document / action for Jon  
6. Confidence + evidence basis  
7. Click-through dossier (not only chip)  
8. Distinguisher: evidence visibility ≠ curriculum absence  

---

## What already looks good enough for Jon (current Portal)

- Clear separation: DB Primaries ≠ reviewed gaps ≠ AI recommendations  
- Publication blocked messaging  
- Distributed-skill explicit “not no teaching” for S10  
- AI panel “recommendations never count as coverage”

**None of the 8 HOLD cases** currently look good enough for Jon as HOLD/evidence-request UX.

---

## Which need UX/wording changes before wider use

**All 8** — especially **S13, K9, K20+S25, K25** (critical test cases all fail in current Portal).

---

## STOP

No implementation · no Golden B · no HOLD resolution · no programme-truth changes.
