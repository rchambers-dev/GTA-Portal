# Golden B is a Human-Ratified Reference Baseline

**Status:** Binding design / assurance rule for all future Golden B comparison, Portal validation, evaluation tooling and test design.  
**Recorded:** 2026-08-10  
**Location:** Staging ratification pack (not programme truth).

**Does not:** draft Golden B · mutate Golden A · write programme truth · change OTJ/SOW/formulas · start AI model work.

---

## Core rule

**Golden B is a HUMAN-RATIFIED REFERENCE BASELINE, not unquestionable truth.**

If future Portal/AI analysis disagrees with Golden B:

1. Do **NOT** automatically mark the AI as wrong.
2. Do **NOT** automatically overwrite Golden B.
3. Treat the disagreement as a **REVIEW CASE**.
4. Show:
   - Golden B conclusion
   - AI conclusion
   - evidence used by Golden B
   - evidence used by the AI
   - whether the evidence is old/new
   - whether the disagreement is about:
     - a) coverage  
     - b) ownership / Primary  
     - c) teaching depth  
     - d) practice  
     - e) assessment  
     - f) workplace evidence  
     - g) evidence visibility  
     - h) interpretation of the official KSB requirement  
5. Classify the disagreement as one of:
   - AI likely wrong  
   - Golden B likely outdated/incomplete  
   - new evidence found  
   - both interpretations plausible  
   - insufficient evidence / unresolved  
6. Require **HUMAN REVIEW** before changing the trusted baseline.

Golden B must therefore be **versioned** and **evidence-backed**.

---

## Intended future workflow

```
AI conclusion
  → evidence
  → compare with Golden B
  → explain disagreement
  → human decision
  → optionally version/update Golden B
```

**NOT:**

```
AI conclusion != Golden B
  → AI FAIL
```

---

## Apply this principle in

- Golden B schema / versioning
- Comparison / validation logic
- Portal UX (review cases, not silent fails)
- Evaluation tooling and golden-eval design
- Future Curriculum Assurance tests

Golden A remains the preserved SOW-only reviewed baseline and is separate from this Golden B comparison rule.
