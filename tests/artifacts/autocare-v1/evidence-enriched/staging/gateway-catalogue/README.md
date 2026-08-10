# Gateway / GW1–GW2 ingest — staging catalogue

**STATUS:** STAGING ONLY  
**Golden A / ratified six-KSB pilot / programme truth:** unchanged  

## Sources inspected

| Source | Contents |
|---|---|
| `Downloads/OneDrive_1_10-08-2026.zip` | 4 practical support documents (GW1+GW2 × Apprentice+Assessor) |
| `Downloads/Autocare GW1 practice paper.docx` | GW1 knowledge practice MCQs |
| `Downloads/Autocare GW2 practice exam 2.docx` | GW2 knowledge practice MCQs (46 Qs, 70 mins) |

Raw: `../gateway-ingest/`  
Extracts: `./extracts/`  
Machine JSON: `gateway-resources.json`, `gateway-pairs.json`, `gateway-pilot-delta.json`, `source-sufficiency-audit.json`, `tranche-2-proposal.json`

## What the documents actually are

### A. Practical support materials (paired)

These are **IMI-style Gateway Component Assessment** instruments for ST0499/AP01 — **not** Group CEA packs, **not** Block Task 1/2, **not** live EPA.

| File | Role | Classification |
|---|---|---|
| Autocare-AP01-GW1-Practical-Support-Material-Apprentice | Apprentice | Practical assessment + apprentice instructions + assessment records + gateway readiness summary |
| Autocare-AP01-GW1-Practical-Support-Material-Assessor | Assessor | Assessor instructions + workstation setup + assessor criteria / Pass–Refer record |
| Autocare-AP01-GW2-Practical-Support-Material-Apprentice | Apprentice | Same pattern for GW2 |
| Autocare-AP01-GW2-Practical-Support-Material-Assessor | Assessor | Same pattern for GW2 |

### B. Knowledge practice papers (no assessor pair in pack)

| File | Classification |
|---|---|
| Autocare GW1 practice paper.docx | Knowledge assessment (practice) · Gateway readiness · EPA prep (practice only) |
| Autocare GW2 practice exam 2.docx | Knowledge assessment (practice) · Gateway readiness · EPA prep (practice only) |

These are **not** the live online GW knowledge tests (`ST0499-AP01GW1K` / `ST0499-AP01GW2K`) — practice/preparation materials.

## Gateway structure discovered

### Gateway 1 — Skills Group A (all required) + knowledge

| Code | Task | Time (assessor) |
|---|---|---|
| **GW1AC01** | Remove and Replace Wheels and Tyres (inspect; remove/replace/balance both front tyres) | 90 mins |
| **GW1AC02** | Remove and Replace Battery Charging and Starting System Components | 120 mins |
| **GW1AC03** | Carry out Front Wheel Alignment (toe) | (in pack) |
| **GW1AC04** | Remove and Replace Discs and Pads | (in pack) |
| Knowledge | Online test stub **ST0499-AP01GW1K** + practice paper supplied separately | — |

### Gateway 2 — Skills Group A (all required) + knowledge

| Code | Task | Time |
|---|---|---|
| **GW2AC01** | Carry Out a Vehicle Safety Inspection (seeded faults incl. tyre/steer/brake defects) | 90 mins |
| **GW2AC02** | Carry out Four-Wheel Alignment | 90 mins |
| **GW2AC03** | Emissions Related Fault / Diagnose | 90 mins |
| Knowledge | Online test stub **ST0499-AP01GW2K** + practice exam 2 supplied | 70 mins / 46 MCQ (practice) |

Apprentice packs include gateway completion declaration + IQA sign-off lines.

## Apprentice ↔ assessor pairs

| Pair | Confidence |
|---|---|
| GW1 Practical Apprentice ↔ GW1 Practical Assessor | EXPLICIT filename + matching GW1ACnn refs |
| GW2 Practical Apprentice ↔ GW2 Practical Assessor | EXPLICIT filename + matching GW2ACnn refs |
| GW1/GW2 practice papers | No assessor/mark-scheme pair supplied |

## Chain placement

```
OFFICIAL ST0499/AP01
→ GATEWAY 1 / GATEWAY 2 readiness assessments
→ PRACTICAL component assessments (GW1AC**/GW2AC**)
→ KNOWLEDGE practice / online stubs
→ (distinct from) GROUP CEA practicals
→ (distinct from) BLOCK Tasks 3–4
→ EPA = preparation only (not live EPA observed here)
```

Group / Block / Week joins: **NOT ESTABLISHED** by these files (Gateway layer sits above Block/Group delivery).
