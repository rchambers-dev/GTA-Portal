# Autocare Controlled Structure Decisions H1–H9

**Artefact type:** Staging / control only  
**Status:** LOCKED  
**Version:** 1.0  
**Date:** 2026-08-11  
**Scope:** Controlled Autocare Technician L2 (ST0499 v1.3) structure inputs for future Programme Builder authoring  

**Not:** Programme truth · Golden A · Golden B · learner records · live database writes · migration

Sources considered when locking: SOW Clean Master v4.4; GTA Portal / Programme Builder masters; Other Portal (read-only discovery). Where those disagree, this log records the **controlled** choice only.

---

## H1 — Planned eligible OTJ

| Field | Content |
| --- | --- |
| **Decision** | Controlled planned eligible OTJ = **611.5**. **605** remains the published minimum / context where already documented. Do **not** use the Other Portal **660** as controlled programme truth. |
| **Controlled source** | SOW v4.4; GTA Portal planned OTJ masters aligned to SOW; H1 human lock |
| **Rationale** | SOW v4.4 already defines planned eligible OTJ 611.50, published minimum 605, and headroom 6.50. Programme Builder / Golden A discipline already uses 611.5. |
| **Conflicting source/value** | Other Portal `standards.standard_OTJ_hours` = 660 (and flat block OTJ patterns that do not match the SOW planned split). This is **not** the controlled programme OTJ value. |
| **Implementation consequence** | Controlled PB Autocare must use 611.5 planned eligible OTJ (605 published minimum where shown). Do not import 660 into controlled programme masters. |
| **Status** | **LOCKED** |
| **Date / version** | 2026-08-11 · v1.0 |

---

## H2 — Block titles

| Field | Content |
| --- | --- |
| **Decision** | SOW v4.4 / Programme Builder block titles are controlled truth. |
| **Controlled source** | SOW v4.4 programme block map; Programme Builder Golden spine titles |
| **Rationale** | SOW v4.4 clearly names Blocks 1–12. PB spine titles match SOW. Live short themes often do not match SOW block meaning. |
| **Conflicting source/value** | Other Portal `blocks.primary_themes` (short operational theme strings). These are **not** the controlled block titles. |
| **Implementation consequence** | Author and display controlled Autocare blocks using SOW/PB titles. Do not promote Other Portal themes as controlled titles. |
| **Status** | **LOCKED** |
| **Date / version** | 2026-08-11 · v1.0 |

---

## H3 — B9–B10 calendar

| Field | Content |
| --- | --- |
| **Decision** | SOW v4.4 calendar is controlled: **B9 = Weeks 81–94**; **B10 = Weeks 95–112**; **112 calendar weeks / 113 planned sessions** where applicable. |
| **Controlled source** | SOW v4.4 block map and practical delivery statement |
| **Rationale** | SOW clearly defines late-programme spans and the 112 calendar / 113 sessions model. This is consistent with H1 planned OTJ hours for B9/B10 (77.00 / 104.50). |
| **Conflicting source/value** | Other Portal B9 weeks 81–90 and B10 weeks 91–100 (different late-programme shape). GTA delivery masters label B10 through week 113 in places (session framing). Other Portal week ranges are **not** the controlled B9–B10 calendar. |
| **Implementation consequence** | Controlled PB uses SOW B9/B10 week ranges and the 112/113 session framing. Do not import the Other Portal compressed B9–B10 ranges as controlled calendar. |
| **Status** | **LOCKED** |
| **Date / version** | 2026-08-11 · v1.0 |

---

## H4 — Block 11

| Field | Content |
| --- | --- |
| **Decision** | Block 11 = **Gateway Readiness and Confirmation** · **Month 30** · **0 eligible OTJ**. |
| **Controlled source** | SOW v4.4 Block 11; Programme Builder spine gateway item with that title |
| **Rationale** | SOW clearly places Gateway Readiness and Confirmation after practical training, in Month 30, with zero eligible OTJ. |
| **Conflicting source/value** | Other Portal Block 11 as a weeks 101–110 training-like row with OTJ hours recorded. GTA delivery “Pre-EPA Consolidation” training-block framing. Those are **not** the controlled Block 11 meaning. |
| **Implementation consequence** | Controlled spine models Block 11 as gateway readiness (not a funded training OTJ block). Mid-programme gateways are handled under H5, separately. |
| **Status** | **LOCKED** |
| **Date / version** | 2026-08-11 · v1.0 |

---

## H5 — Mid-programme Gateways

| Field | Content |
| --- | --- |
| **Decision** | Mid-programme GW1/GW2 remain **delivery/operational milestones**. They do **not** replace controlled SOW Block 11 Gateway. |
| **Controlled source** | SOW v4.4 for curriculum gateway (Block 11); H4 lock; live/GTA schedules only as delivery milestone references |
| **Rationale** | SOW defines end-of-programme Gateway/EPA as Blocks 11–12 in Month 30. Live/GTA mid-GW1 (after Block 5 / +12m) and GW2 (after Block 10 / +24m) can remain operational practice without becoming curriculum replacements for B11. |
| **Conflicting source/value** | Treating mid-GW1/GW2 as the controlled curriculum gateway in place of Block 11. That is **not** the controlled model. |
| **Implementation consequence** | Keep two layers distinct in PB: controlled B11 gateway readiness (H4); optional delivery milestone tracking for mid-GW1/GW2 without overriding SOW B11. |
| **Status** | **LOCKED** |
| **Date / version** | 2026-08-11 · v1.0 |

---

## H6 — Task 1 / Task 2 forms

| Field | Content |
| --- | --- |
| **Decision** | Controlled typed tasks: **Task 1 = Knowledge Assessment**; **Task 2 = Employer Job Card**; using the **GTA/canonical controlled forms**. |
| **Controlled source** | GTA Portal task masters: Knowledge Test Result Record form; Apprentice Job Card form |
| **Rationale** | Types match the delivery five-task pattern. Canonical forms match type purpose. Other Portal `standard_tasks` attachments for Task 1/2 use practical-topic PDF filenames, which do not match knowledge/job-card form purpose. |
| **Conflicting source/value** | Other Portal Task 1/2 PDF mappings to practical-named sheets. Those attachments are **not** the controlled Task 1/2 forms. |
| **Implementation consequence** | Controlled PB binds Task 1/2 to GTA/canonical knowledge and job-card forms. Practical-topic PDFs remain usable as practice/topic materials where appropriate, not as the controlled T1/T2 form identity. |
| **Status** | **LOCKED** |
| **Date / version** | 2026-08-11 · v1.0 |

---

## H7 — Task 5 reflection form

| Field | Content |
| --- | --- |
| **Decision** | Controlled Task 5 = **`Task_5_Block_Reflection_and_Review_v1.0.pdf`**. **`Training_Impact_Record_Task_v1.0.pdf` is NOT the controlled Task 5 form.** |
| **Controlled source** | Task_5_Block_Reflection_and_Review_v1.0.pdf (content-compared 2026-08-11); GTA Portal `makeBlockReflection()` parity |
| **Rationale** | PDF compare showed they are different instruments. Block Reflection is block-scoped, matches GTA digital Task 5, and includes apprentice / mentor / trainer review structure. Training Impact Record is a different impact-period form. |
| **Conflicting source/value** | Other Portal maps Task 5 to `Training_Impact_Record_Task_v1.0.pdf`. That file is **not** the controlled Task 5 form. |
| **Implementation consequence** | Controlled PB Task 5 uses Block Reflection and Review. Do not treat Training Impact Record as the controlled Task 5 artefact. |
| **Status** | **LOCKED** |
| **Date / version** | 2026-08-11 · v1.0 |

---

## H8 — Block 12 / EPA OTJ

| Field | Content |
| --- | --- |
| **Decision** | Block 12 / EPA = **0 eligible OTJ**. |
| **Controlled source** | SOW v4.4 Block 12 End-Point Assessment; GTA Portal EPA block OTJ = 0; consistent with H1 |
| **Rationale** | SOW clearly states EPA is assessment activity with zero eligible OTJ. H1 planned programme OTJ cannot absorb an EPA OTJ allocation. |
| **Conflicting source/value** | Other Portal Block 12 row with `otj_hours = 60`. That is **not** the controlled EPA OTJ value. |
| **Implementation consequence** | Controlled PB Block 12 / EPA carries 0 eligible OTJ. Do not import 60 into controlled EPA planned OTJ. |
| **Status** | **LOCKED** |
| **Date / version** | 2026-08-11 · v1.0 |

---

## H9 — Two calculation layers

| Field | Content |
| --- | --- |
| **Decision** | Keep **two separate calculation layers**: (1) **Curriculum / RPL / OTJ** = equal-KSB controlled model based on **611.5** and **64 KSBs**; (2) **Learner-specific coverage / progress** = Knowledge **0.30**, Skills **0.50**, Behaviours **0.20**. The K/S/B weighting affects the individual apprentice’s remaining programme/coverage where prior learning is recognised. It must **not** alter master programme OTJ, controlled Primary ownership, or the master curriculum structure. |
| **Controlled source** | SOW v4.4 equal-KSB RPL unit and Primary matrix for layer 1; retained K/S/B weights for layer 2 learner coverage/progress; H1 for 611.5 |
| **Rationale** | These are different purposes. Equal-KSB governs controlled curriculum OTJ allocation and Primary. K/S/B weights score/adjust individual learner coverage/progress. Conflating them produces incorrect programme truth or incorrect learner remaining-training maths. |
| **Conflicting source/value** | Describing weighted K/S/B as an alternative controlled curriculum APL/OTJ model, or using equal-KSB to replace learner coverage weights. Other Portal storing weights on programme/standard rows does **not** make weighted K/S/B the controlled curriculum OTJ model. |
| **Implementation consequence** | PB must keep layers explicit in product language and calculations. Curriculum masters use equal-KSB / 611.5 / Primary. Learner RPL/coverage UI may use K/S/B weights without rewriting master OTJ or Primaries. |
| **Status** | **LOCKED** |
| **Date / version** | 2026-08-11 · v1.0 |

---

## Locked summary

| ID | Controlled decision |
| --- | --- |
| H1 | Planned eligible OTJ **611.5**; published min **605** where documented; Other Portal **660** not controlled |
| H2 | SOW v4.4 / PB **block titles** |
| H3 | SOW **B9 81–94**; **B10 95–112**; **112 calendar / 113 sessions** |
| H4 | Block 11 **Gateway Readiness and Confirmation · Month 30 · 0 OTJ** |
| H5 | Mid GW1/GW2 **delivery/operational only**; do not replace B11 |
| H6 | Task 1 Knowledge + Task 2 Employer Job Card via **GTA/canonical forms** |
| H7 | Task 5 = **Task_5_Block_Reflection_and_Review_v1.0.pdf** (Training Impact Record is not controlled Task 5) |
| H8 | Block 12 / EPA **0 eligible OTJ** |
| H9 | **Equal-KSB** curriculum/RPL/OTJ · **K/S/B 0.30/0.50/0.20** learner coverage/progress only |

---

## Explicit non-actions

This freeze does **not**:

- write Programme Builder programme truth  
- draft Golden B  
- migrate or update Other Portal data  
- change learner records  
- change Golden A, SOW formulas, or OTJ maths implementations  

Next authorised step (separate instruction): controlled Autocare build against these locks, or further staging artefacts only.
