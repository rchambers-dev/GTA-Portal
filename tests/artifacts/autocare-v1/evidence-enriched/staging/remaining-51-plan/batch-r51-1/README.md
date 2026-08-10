# Batch R51-1 — Shadow Curriculum Assurance (STAGING)

**STATUS:** SHADOW ONLY · awaiting human review · **not** programme truth  
**Batch:** R51-1 (first remaining-51 batch)  
**KSBs:** K18, K2, K20, S25, K1, K31, K6, S12  
**Standard:** ST0499 v1.3  
**Methodology:** Frozen remaining-51 / approved traceability methodology  
**Mutates Golden A / Primaries / gaps / programme truth:** NO  

Machine dossier: `shadow-batch-r51-1.json`  
Compare note: `golden-a-vs-shadow.md`  
Chains: `CHAINS.md`  
Drift log: `methodology-drift.md`

## Progress

| Metric | Count |
|---|---|
| Official Autocare KSBs | 64 |
| Previously human-reviewed (Pilot1+Tranche2) | 13 |
| R51-1 analysed this batch | 8 |
| **Richer-evidence analysed** | **21 / 64** |
| Remaining after this batch | **43** |

## Summary matrix (judgement before Golden A compare)

| KSB | Type | Shadow coverage | Ownership | Shadow vs Golden A |
|---|---|---|---|---|
| **K18** | K | Taught (levels aim EXPLICIT); residual depth check passive/active phrasing | Candidate late G11 cluster — **not forced**; B9/GW do not steal | **CHANGE** (visibility) |
| **K2** | K | Schedules/specs/serviceability substantively evidenced | Advisory B3 W22 / G14 — **not forced** | **CHANGE** (visibility) |
| **K20** | K | Brake fluid + oil strong; **air filters thin/missing** | Multi-home G4/G6 — not forced | **CHANGE → PARTIAL** |
| **S25** | S | Fluids check/replace strong; filtration-parts incomplete if air-filter required | Same cluster — not forced | **CHANGE → PARTIAL** |
| **K1** | K | Only partial FS01/FS03 adjacency | **UNMAPPED** | **KEEP GAP** (weak) |
| **K31** | K | No EDI body content found | **UNMAPPED** | **KEEP GAP** |
| **K6** | K | Tools/calibration taught @ FS; storage thinner | **CLEAR B1 / FS** KEEP | **KEEP B1** |
| **S12** | S | Geometry strong teach+practise+assess | **CLEAR early B2/G3**; G11/GW REINFORCE | **KEEP B2** |

## Methodology drift (this batch)

| Risk | Observed? | Action taken |
|---|---|---|
| Adjacency → coverage | Watched | ADAS pre-cal not counted as “levels” teaching; teaching from G11 LP aims |
| Filename / KSB tags alone | Watched | Rejected practical KSB tag lists; Brake Fluid.ppt unextracted → not treated as EXPLICIT content |
| Overusing Group routing | No | Used Group LPs as teaching evidence, not Transition Guide as proof |
| Inventing week placement | No | Group weeks UNRESOLVED; only Block weeks with explicit plans used |
| Missing supplied = missing curriculum | Partial caution | Air filter / EDI / K1 industry may still hide off-pack — flagged as uncertainty, not auto-closed |
| Teaching = practice / practice = assessment | No | Axes kept separate |
| Forcing Primary | No | `forcePrimary: false` throughout |
| Gateway as original teaching | No | GW geometry / reporting used as Gateway support only |
| Wrong evidence bar by kind | No | Behaviour/CEA rules not misapplied; Knowledge not required to have workshop CEA |

**No batch-stopping systematic failure detected.** Scaling confidence: **increases**.

## Recommended next (NOT executed)

**R51-2:** K7, K8, K34, S20, S23, K33, S15, S16 — commercial/soft/digital.

## STOP

Await human review before R51-2.
