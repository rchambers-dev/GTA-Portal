# Remaining-51 expansion — controlled plan (AWAITING APPROVAL TO EXECUTE)

**STATUS:** PLAN FROZEN · R51-1/R51-2 **RATIFIED** · **R51-3 SHADOW COMPLETE** (awaiting human review) · R51-4+ not started  
**Methodology:** Traceability methodology **APPROVED** (staging edges ≠ programme truth)  
**Reviewed locked:** Pilot1 (6) + Tranche2 (7) = **13** — unchanged  
**Standard:** ST0499 v1.3  

Artifacts:
- `remaining-51-manifests.json` — 51 planning manifests (analysisStatus: NOT_STARTED)
- This README — full execution design

---

## 1. Methodology frozen / approved

Approved as methodology only:

- typed relationships
- Group provenance preserved
- KSB component-level traceability
- Block-level OK where defensible; week/session nullable
- TEACHES / PRACTISES / ASSESSES / REINFORCES / SUPPORTS kept separate
- EXPLICIT vs INFERRED visibly different
- later reinforcement does not steal Primary
- distributed KSBs not forced into one owner

Pilot edges remain staging evidence, not programme truth.

## 2. Locked 13 unchanged

Pilot 1: S9, K10, K12, K21, K23, S13  
Tranche 2: K13, S7, S10, S11, B5, K28, K11  

No re-open, no Golden A mutation, no Primary/gap/S10/OTJ/SOW persistence.

## 3–4. Remaining 51 and K/S/B distribution

**Knowledge (27):** K1–K5, K6–K9, K14–K20, K22, K24–K27, K29–K34  
**Skills (20):** S1–S6, S8, S12, S14–S25  
**Behaviours (4):** B1–B4  

Full code list in `remaining-51-manifests.json`.

## 5. Analysis manifest structure

Each manifest includes:

| Field | Role |
|---|---|
| `ksbCode` / `kind` / `officialWording` | Official ST0499 v1.3 identity |
| `dutyRelationship` | When available; null until sourced (not invented) |
| `goldenAPosition` / `goldenAPrimaryBlock` | Control/comparison only |
| `knownBlockRelationships` | Starts with Golden A control marker only |
| `likelyEvidenceDomains` | Heuristic planning guide |
| `likelyGroupProvenance` | Expect mixed Group+Block corpus |
| `relevantEvidenceTypesExpected` | Not a completeness requirement |
| `knownUncertainties` | Pre-registered risks |
| `proposedAssuranceChecks` | Mandatory process checks |
| `componentDecompositionStatus` / `components` | Filled during analysis |
| `proposedBatch` / `analysisStatus` | Execution control |

Golden A is **never** used as evidence.

## 6. Component-decomposition method

1. Split official wording on conjunctions / enumerated systems / distinct obligations.  
2. Name each component as a requirement claim (not a boolean “covered”).  
3. For every component eventually score six axes with evidence + confidence:

   - TEACHING  
   - PRACTICE  
   - ASSESSMENT  
   - WORKPLACE APPLICATION  
   - GATEWAY/EPA SUPPORT  
   - STRUCTURAL ACCOUNTING  

4. Aggregate to KSB only after components are judged — so “mostly taught but one material component missing” is expressible.

Do not invent components beyond the official wording.

## 7. Evidence retrieval hierarchy (KSB-first)

For each KSB, retrieve only what is relevant:

1. Official KSB (+ Duty if available)  
2. Current SOW / Block structure / Transition Guide (routing, not teaching proof)  
3. Block lesson plans (intent ≠ Primary proof)  
4. Group-era lesson plans + teaching PPT/PPTX/DOC/PDF + extracted legacy PPT  
5. Block practical Tasks 3/4  
6. CEA practical assessments  
7. Gateway knowledge + practical apprentice/assessor packs  
8. Skills progress reviews / learning impact records  
9. Workplace job-card **mechanism** (filled cards still often unavailable)  

Evidence bar by kind:

- **Behaviour** — must not fail for lack of workshop CEA  
- **Skill** — needs stronger application evidence than Knowledge alone  
- **Knowledge** — teaching depth + assessment instruments weigh more  

PATH_MISSING on Desktop paths: prefer catalogue excerpts / prior extracts over filename inference.

## 8. Assurance judgement rules

Multi-label taxonomy (may stack):

- GOOD / ADEQUATELY CONTROLLED  
- CURRICULUM GAP  
- TEACHING DEPTH GAP  
- PRACTICE GAP  
- ASSESSMENT GAP  
- EVIDENCE VISIBILITY GAP  
- STRUCTURAL MAPPING GAP  
- DISTRIBUTED-SKILL / OWNERSHIP ISSUE  

Separate **curriculum quality** from **curriculum visibility**.  
Do not collapse to covered/gap.  
Do not invent numeric scores.

## 9. Ownership rules

Keep separate:

1. Is the KSB covered (by components/axes)?  
2. Where should Primary candidacy sit?

Rules:

- First substantive teaching = ownership principle unless better structure is evidenced  
- Later competence, Gateway, reinforcement, advanced teaching do **not** steal Primary  
- Outcomes: CLEAR PRIMARY · AMBIGUOUS · DISTRIBUTED · UNMAPPED — all legitimate  
- Do not force Primary in shadow dossiers (`forcePrimary: false` pattern)

## 10. Confidence / provenance rules

Every relationship retains:

- relationship type (TEACHES / PRACTISES / ASSESSES / REINFORCES / SUPPORTS / …)  
- evidence basis  
- confidence: EXPLICIT · INFERRED_HIGH · INFERRED_MEDIUM · INFERRED_LOW · CONFLICTING · UNRESOLVED  
- source + Group provenance where Group-era  

Week/session: only if proven; otherwise UNRESOLVED. Block-level preferred to invented precision.  
0 explicit resource→week bindings in the pilot remains an acceptable baseline.

## 11. Batching strategy

Patterned by assurance/domain risk, not only KSB number:

| Batch | Theme | KSBs | Size |
|---|---|---:|---:|
| **R51-1** | Visibility risks + fluids pair + EDI knowledge + KEEP controls | K18, K2, K20, S25, K1, K31, K6, S12 | 8 |
| R51-2 | Commercial / soft / digital | K7, K8, K34, S20, S23, K33, S15, S16 | 8 |
| R51-3 | Foundation H&S/tools KEPT + workshop skills | K3–K5, S1–S3, S5, S6, B1 | 9 |
| R51-4 | Powertrain / service systems | K9, K14–K17, K19, S4, S8, S14 | 9 |
| R51-5 | Remainder commercial/behaviour + orphan-resource scan prep | K22, K24–K27, K29–K30, K32, S17–S19, S21–S22, S24, B2–B4 | 17 |

After all 64 analysed: separate orphan/duplicate/obsolete resource pass — **not** up-front mass-map of 288.

## 12. Human-review checkpoints

After **every** batch:

1. Sample ≥2 dossiers for methodology drift (ownership steal, week invention, Golden A as evidence).  
2. Check component-level claims vs boolean collapse.  
3. Check EXPLICIT/INFERRED labels honest.  
4. Confirm KEEP-control KSBs (e.g. K6, S12 in R51-1) still keep intended Primaries.  
5. Explicit approve/stop before next batch.

Additional global checkpoint after R51-5 before any Golden B discussion.

## 13. Expected artifacts / output structure

Per batch (staging only):

```
.../staging/remaining-51-plan/batch-r51-N/
  README.md                 # human readout
  shadow-batch-r51-N.json   # dossiers + typed edges
  golden-a-vs-shadow.md     # KEEP/CHANGE/... after judgement
```

Per KSB dossier fields: components × axes, assurance labels, ownership, confidence, attached resources (organic), Golden A compare last.

Rolling roll-up after batches (counts by taxonomy only — no weighted score).

## 14. Scaling risks

- Code/version confusion (legacy K# ≠ v1.3; e.g. tools = K6, tyres legislation = K9)  
- Filename-as-evidence when PATH_MISSING / excerpt-thin  
- Week invention pressure after pilot’s 0 week bindings  
- Ownership stolen by Gateway/later CEA strength  
- Soft/EDI false gaps vs off-pack visibility  
- Air-filter / thin-component false FULL COVERAGE  
- Batch contamination if systematic error not paused  
- Treating Transition Guide routing as teaching proof  

## 15. Detecting systematic mapping errors

- KEEP controls in early batches (K6@B1, S12@B2)  
- Paired K/S (K20/S25; later K2 already paired with ratified S7 CHANGE pattern)  
- Re-audit identical residual claims appearing ≥3 times before next batch  
- Independent spot-check: pick 1 resource from dossier and verify excerpt still supports the edge  
- Conflict log: EXPLICIT opposing EXPLICIT → CONFLICTING, not silent merge  

## 16. Missing evidence — blocking?

**No material blocker to starting R51-1.**

Known limitations that remain non-blocking:

- Many Learning Materials Desktop paths PATH_MISSING (catalogue excerpts usable)  
- Filled workplace job cards not supplied (mechanism only)  
- Soft/EDI may require off-pack checks later  

These affect confidence axes, not ability to begin controlled shadow expansion.

## 17. Recommended first batch

**R51-1 (8):** `K18, K2, K20, S25, K1, K31, K6, S12`

Intent: test visibility-gap hypothesis (K18/K2), fluids paired Knowledge/Skill (K20/S25), genuine soft gap likelihood (K1/K31), and two KEEP controls (K6, S12).

## 18. Exact STOP point for human approval

STOP here.

Do **not** execute R51-1 until explicitly approved.  
Do **not** mass-map 288 resources.  
Do **not** mutate Golden A / Primaries / gaps / S10 / OTJ / SOW / formulas.  
Do **not** declare trusted Golden B / AI-1.5 / AI-2 / V2 / production schema.  
Do **not** auto-cascade batches.

**Awaiting:** Approve start of Batch R51-1 only (or amend plan / batch composition).
