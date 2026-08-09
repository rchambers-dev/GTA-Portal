# Autocare V1 — Programme Builder evaluation artifacts

This folder is the **historical test / audit set** created while using Autocare
(ST0499) as the Programme Builder V1 golden programme and evaluation case.

**Git checkpoint meaning:**  
`AUTOCARE / PROGRAMME BUILDER BEFORE FULL LIVE TEACHING-MATERIAL INGESTION`

These files help **reproduce and verify** development reasoning and experiments.
They are **not** automatically production programme truth.

---

## Authority layers (do not conflate)

| Layer | What it is | Where truth lives |
| --- | --- | --- |
| **Authoritative programme data** | Approved Primaries, parameters, spine, OTJ in the live product | Database / domain stores |
| **Human-reviewed golden test data** | Trusted benchmark decisions used for evaluation | Golden labels + this artifact tree (Track A) |
| **AI evaluation output** | Model predictions, metrics, comparisons | `sow-only/ai-evaluations/`, `comparisons/`, `failure-analysis/` |
| **Historical / debug output** | Intermediate mapping iterations, extracts, one-shot scripts | `sow-only/historical/` |

---

## Golden A (frozen SOW-only review)

**AUTOCARE GOLDEN A — SOW-ONLY REVIEW**

| Metric | Value |
| --- | --- |
| Approved Primaries | **45** |
| Reviewed curriculum gaps | **18** |
| Distributed-skill cases | **1** (S10) |
| Unresolved | **0** |
| Structured OTJ | **611.5** |

AI capability benchmark for SOW-only inference: **AI-1.4** (frozen).  
Do not overwrite AI-1…AI-1.3 evaluation artifacts when re-running later stages.

Supporting programme construction evidence under this tree documents how Autocare
was used to establish / test / verify:

1. Autocare programme structure  
2. Official ST0499 KSB accounting  
3. Human-reviewed Primary KSB ownership  
4. Reviewed curriculum gaps  
5. Distributed-skill handling  
6. Golden A totals (45 / 18 / 1 / 0)  
7. Structured OTJ = 611.5  
8. Persistence of approved Primary mappings  
9. Post-persistence verification  
10. AI-1 → AI-1.4 curriculum-analysis experiments  
11. False-Primary testing  
12. False-gap testing  
13. Primary block ownership testing  
14. Retrieval-vs-judgement analysis  
15. AI regression / failure comparisons  
16. The frozen SOW-only AI-1.4 benchmark  

Runtime SOW/lesson-plan evidence corpus (canonical):  
`data/curriculum-evidence/autocare-st0499-v1-original-corpus.json`

---

## Track A vs Track B

```
GOLDEN A / TRACK A          GOLDEN B / TRACK B
SOW-only understanding  →   Full current-curriculum understanding
(this folder: sow-only/)    (evidence-enriched/ — placeholder until pack arrives)
```

When Jon’s **full current live teaching-material** corpus is ingested and reviewed:

- Create **AUTOCARE GOLDEN B — FULL CURRENT-CURRICULUM REVIEW**
- Golden B must **not** overwrite Golden A
- Record every A→B change with evidence and reason
- Golden B may disagree with A where richer live curriculum proves A incomplete/wrong

Future A↔B comparison should measure:

- which previous decisions remained correct  
- which changed  
- which gaps closed / new gaps appeared  
- which Primary owners changed  
- what teaching existed but was previously invisible  
- what teaching was structurally unaccounted  
- how assurance confidence changed  
- whether richer evidence improves AI accuracy  

---

## Layout

```
autocare-v1/
  README.md                          ← this file
  sow-only/                          ← TRACK A (SOW-only)
    golden-baseline/
    persistence/
    ai-evaluations/
      ai-1/ … ai-1.4/
    comparisons/
    failure-analysis/
    historical/
  evidence-enriched/                 ← TRACK B placeholder
    README.md
```

### What each area holds

- **golden-baseline/** — Human decision / panel / provenance snapshots used around Golden A  
- **persistence/** — Preflight, persist reports, post-verify, step import IDs  
- **ai-evaluations/ai-N/** — Frozen eval reports per AI stage (do not overwrite earlier stages)  
- **comparisons/** — Before/after metric diffs between stages  
- **failure-analysis/** — Retrieval vs judgement / disagreement audits  
- **historical/** — Intermediate extracts, mapping iterations, retained one-shot scripts  

Regenerable scratch outputs from live evals should write to repository-root  
`.tmp-*` paths (gitignored), then be **copied** here only when intentionally frozen.

---

## Curriculum Assurance (design only — not implemented)

Approved design direction (architecture only; **no P1 implementation in this checkpoint**):

- GTA/Jon materials = **current live delivered curriculum** (not hypothetical attachments)  
- Analysis is **KSB-first curriculum quality**, not evidence-hunting for mappings  
- Dual assurance levels: KSB-level and teaching-resource/session-level  
- Inferred teaching requirements = AI rubric (not new official requirements)  
- Mapped ≠ evidenced; not evidenced ≠ not taught  
- Resources may later serve assurance **and** learner revisit (separate permissions)  
- Do **not** start AI-1.5, AI-2, V2, or Curriculum Assurance schema/UI in this checkpoint  

---

## Safety

- Do not treat AI eval JSON as DB programme truth  
- Do not commit secrets, `.env*`, or service keys  
- Do not commit learner personal data  
- Live eval harnesses may use `SUPABASE_SERVICE_ROLE_KEY` from local `.env.local` only  
