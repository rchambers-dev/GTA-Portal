# CEA Year 1 / Year 2 — inspection & impact review

**STATUS:** STAGING EVIDENCE IMPACT ONLY  
**Ratified six-KSB pilot:** unchanged  
**Golden A / programme truth:** unchanged  

Sources:

- Desktop `Auto-care Year 1 CEA.zip`
- Desktop `Auto-care Year 2 CEA.zip`

Catalogue outputs:

- `cea-catalogue/cea-resources.json`
- `cea-catalogue/cea-relationships.json`
- `cea-catalogue/cea-impact-review.json`
- `cea-catalogue/cea-product-learning.json`
- `cea-catalogue/extracts/`
- `cea-ingest/` (raw unzip)

---

## 1. What these folders actually contain

They are **Group-era controlled centre practical assessment packs**, not teaching slides and not workplace job cards.

Each numbered file is typically:

1. **APPRENTICE INSTRUCTIONS** — timed scenario + performance steps  
2. **APPRENTICE ASSESSMENT RECORD** — tech-data capture, oral questions, apprentice + assessor sign-off, **Pass / Refer**

**CEA** in this corpus = a **Competency / Controlled Evidence Assessment** task (centre practical assessment), numbered as **Group.task** (e.g. `CEA 3.1` under Wheels & Tyres / Group 3).

Structure:

| Layer | Finding |
|---|---|
| Year folders | Year 1 ≈ Groups 2–7; Year 2 ≈ Groups 8–14 + commercial templates |
| Numbering | `CEA {Group}.{Task}` |
| Block | Not Block-native — Block links only via Transition Guide inference |
| Mixture | Primarily **PRACTISES + ASSESSES + RECORDS EVIDENCE**; does **not TEACH** |

Supporting extras in Year 2: service schedule, invoice proforma, repair estimate xlsx, ECP URL — commercial/process supports, not the same as CEA practical tasks.

---

## 2. Are they the practical/CEA evidence previously requested?

**Yes — for centre CEA practical assessment templates.**

Previous claim that “standalone CEA forms/packs were not found” should be **closed**.

They are **blank assessment instruments**, not completed learner portfolios.

---

## 3. Correspondence to missing Block Task 1 / Task 2

**Partially / analogue only — not the same artefacts.**

- These are **not** Block `Task 1` / `Task 2` PDFs from the practical pack.
- They **do** look like the older Group practical-assessment layer that may functionally cover similar ground.
- Block Task 1/2 status remains a separate question until those files (or an explicit retirement note for Block Tasks) appear.

---

## 4. Inspection counts

| Metric | Count |
|---|---|
| Files total | 57 |
| `.docx` | 55 |
| Successfully text-extracted | 56 (xlsx catalogued, contents not parsed) |
| Controlled practical assessment tasks | 53 |
| Supporting/commercial/other | 4 |

---

## 5. Material new relationships (examples)

| CEA | Proves (when delivered) | Axes |
|---|---|---|
| 3.1 Tyres R&I | Remove/replace tyre, puncture repair BS159, balance | PRACTISES / ASSESSES / RECORDS |
| 3.2 Puncture | Puncture repair, R&R wheels, TPMS reset | PRACTISES / ASSESSES / RECORDS |
| 3.4 Balance 4 wheels | Assessed four-wheel balancing | PRACTISES / ASSESSES / RECORDS |
| 3.5 Run-flat | Remove/install run-flat + balance | PRACTISES / ASSESSES / RECORDS |
| 5.2 Track rod end | Mechanical steering R&R | PRACTISES / ASSESSES / RECORDS |
| 5.6 / 5.7 | Hydraulic PAS pump / rack R&R | PRACTISES / ASSESSES / RECORDS |
| 2.1 Hybrid | **Isolate HV system**, locate/explain components, reinstate, test | PRACTISES / ASSESSES / RECORDS |
| 4.x / 10.x | Brake replacement / ABS practicals | Supporting for K12 |
| 11.5 “EPA Practice” | **Four-wheel alignment** — **not** EPS and **not** End-Point Assessment (filename misleading) | Alignment assessment |

No document alone proves completed apprentice competence — only that the centre has assessed-practical instruments.

---

## 6–7. Missing-evidence claim updates

| Prior “missing” claim | Now |
|---|---|
| CEA forms/packs | **CLOSED** (templates found) |
| Assessed tyre strip/refit/balance | **CLOSED as missing artefact** (CEA 3.1/3.2/3.4/3.5) |
| Steering practical/application | **STRENGTHENED** (CEA 5.2/5.6/5.7 etc.) |
| HV isolation practical/assessment instrument | **STRENGTHENED** (CEA 2.1 isolate language) |
| Observation mechanism | **PARTIAL CLOSE** (assessor Pass/Refer present); completed observed samples still absent |
| Block Tasks 1–2 | **STILL OPEN** (different layer) |
| Workplace job-card templates | **STILL OPEN** (CEA ≠ job cards) |
| Dedicated EPS/EPAS CEA | **NOT found** in these packs (`11.5` = alignment) |
| Completed filled learner CEA examples | **STILL OPEN** |

---

## 8–11. Pilot impact (shadow conclusions NOT edited)

| KSB | Impact | Material? | Note |
|---|---|---|---|
| **S9** | STRENGTHEN practice/assessment visibility | Yes | Remove/repair/balance/run-flat now have assessed CEA tasks. Ownership still UNMAPPED/inferred G3→B2/B3. Direction CHANGE still coherent; evidence-strength upgrades. |
| **K10** | STRENGTHEN application/assessment | Yes | Hydraulic + mechanical R&R assessed. Helps application more than Primary ownership. EPS still not CEA-proven here. |
| **S13** | STRENGTHEN | Yes | CEA 2.1 requires isolation under assessment conditions. Still blank template; title mixes locating components. Rules≠competence still valid for completed evidence. |
| **K12** | Supporting strengthen | No | 4.x/10.x support KEEP B2 |
| **K21** | Mild support | No | HV vehicle context in 2.1; KEEP B6 |
| **K23** | STRENGTHEN practice/assessment axes | No ownership change | Isolation procedure under assessment strengthens previously PARTIAL axes |

**Reopen pilot for human review?** Recommended once further packs (e.g. Gateway) are ingested and a source-sufficiency audit runs — **not done in this pass**.

---

## 12. Group/Year → Block

```
OFFICIAL STANDARD
→ KSB (inferred, rarely explicit on forms)
→ GROUP (explicit via CEA major number)
→ YEAR (folder)
→ BLOCK (INFERRED via Transition Guide only)
→ WEEK/SESSION (UNKNOWN — no join in these files)
→ TEACHING MATERIAL (separate Learning Materials)
→ PRACTICAL/CEA (these documents)
→ ASSESSMENT RECORD (embedded Pass/Refer)
→ WORKPLACE EVIDENCE (still separate — job cards not in these packs)
```

---

## 13. Product / Curriculum Assurance implications (design only)

CEA tasks are first-class **PracticalAssessmentTask** entities with structured fields:

ref, year, group, title, duration, objectives, materials, scenario, steps, tech-data fields, measurements, oral questions, PPE, sign-offs, Pass/Refer, linked KSBs, Block routing (inferred), axes PRACTISES|ASSESSES|RECORDS_EVIDENCE.

Portal should eventually author/generate these consistently rather than absorb inconsistent Word.

---

## 14. Guardrail compliance

- Ratified pilot artifacts **not** modified  
- No Golden A / Primaries / gaps / OTJ / AI / V2 / tranche 2  

**STOP** — awaiting further packs (e.g. Gateway) before sufficiency audit / any pilot reopen decision.
