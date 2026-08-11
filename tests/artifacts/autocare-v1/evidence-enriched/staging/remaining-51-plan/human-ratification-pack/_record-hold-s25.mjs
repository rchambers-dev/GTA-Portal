import fs from "fs";
import path from "path";

const pack =
  "tests/artifacts/autocare-v1/evidence-enriched/staging/remaining-51-plan/human-ratification-pack";

const cardsPath = path.join(pack, "cards-64.json");
const cards = JSON.parse(fs.readFileSync(cardsPath, "utf8"));
const c = cards.cards.find((x) => x.code === "S25");
c.holdResolutionReview = {
  reviewedAt: "2026-08-10",
  decision: "HOLD_FOR_EVIDENCE",
  linkedEvidenceRequests: ["ER-18"],
  unresolved: true,
  notes:
    "HOLD resolution pass (8/8): confirm keep HOLD. Aligns with K20 companion. Fluids check/replace may remain strong; do not close full filtration-parts completeness without ER-18. Primary not forced.",
  portalOnboardingRequest: {
    shouldAutoRequestDuringSourceSufficiency: true,
    evidenceClass: "MISSING_OFFICIAL_COMPONENT_TEACHING_AND_PRACTICE",
    requestSummary:
      "Locate air-filter / full filtration teaching and R&R practice beyond fluids (shared with K20)",
  },
};
c.humanDecision = "HOLD_FOR_EVIDENCE";
c.humanDecisionNotes =
  "HOLD resolution 2026-08-10 (pass 8/8): confirm HOLD_FOR_EVIDENCE pending ER-18 (companion K20). Onboarding/source-sufficiency auto-request: YES.";
c.humanDecisionAt = "2026-08-10";
c.linkedEvidenceRequests = ["ER-18"];
c.unresolved = true;
fs.writeFileSync(cardsPath, JSON.stringify(cards, null, 2) + "\n");

const logPath = path.join(pack, "DECISIONS-LOG.json");
const log = JSON.parse(fs.readFileSync(logPath, "utf8"));
const d = log.decisions.find((x) => x.code === "S25");
d.rationale = c.humanDecisionNotes;
d.holdResolutionReview = c.holdResolutionReview;
d.unresolved = true;
log.lastUpdated = "2026-08-10";
if (!log.holdResolutionPass.completed.includes("S25")) {
  log.holdResolutionPass.completed.push("S25");
}
log.holdResolutionPass.status = "COMPLETE";
log.holdResolutionPass.completedAt = "2026-08-10";
log.holdResolutionPass.summary =
  "All 8 Queue A HOLD_FOR_EVIDENCE cases re-reviewed and confirmed HOLD. None converted to APPROVE/AMEND. All linked ERs marked for future Portal onboarding/source-sufficiency auto-request. No Golden A / programme-truth mutation.";
fs.writeFileSync(logPath, JSON.stringify(log, null, 2) + "\n");

const mdPath = path.join(pack, "QUEUE-A-DECISIONS.md");
let lines = fs.readFileSync(mdPath, "utf8").split(/\r?\n/);
lines = lines.map((line) => {
  if (line.startsWith("| S25 |")) {
    return "| S25 | HOLD FOR EVIDENCE | — | ER-18 | HOLD resolution 8/8 confirmed; companion K20; auto source-sufficiency request YES | 2026-08-10 |";
  }
  return line;
});
fs.writeFileSync(mdPath, lines.join("\n"));

const holdPath = path.join(pack, "HOLD-RESOLUTION-LOG.md");
let hold = fs.readFileSync(holdPath, "utf8");
hold = hold.replace(
  "| 8/8 | S25 | ER-18 | _pending_ | — | — |",
  "| 8/8 | S25 | ER-18 | HOLD FOR EVIDENCE (confirmed) | YES | 2026-08-10 |",
);
if (!hold.includes("## S25 notes")) {
  hold += `
## S25 notes

- Companion to K20 via shared ER-18.
- Fluids check/replace evidenced; full filtration-parts set (esp. air filter) open.
- Primary not forced.
- Future Portal: auto-request missing filtration/practice components with K20.

---

## HOLD-resolution summary

**Result:** 8/8 confirmed **HOLD FOR EVIDENCE**. No case closed to APPROVE or AMEND in this pass.

| KSB | ER | Why still open | Portal auto-request |
|---|---|---|---|
| K8 | ER-16 | Service History.ppt unextracted + owner's manuals not found | YES |
| K9 | ER-09 | Tyres.ppt unextracted for legislation/labels/sidewall/homolog | YES |
| K15 | ER-10 | Named e-machine teaching not found | YES |
| K17 | ER-11 | Named static/dynamic ADAS methods thin | YES |
| K20 | ER-18 | Air-filter / full filtration teaching not found | YES |
| K25 | ER-20 | Dedicated business-operations body not found | YES |
| S13 | ER-04 | Assessed HV isolation competence unproven | YES |
| S25 | ER-18 | Filtration-parts R&R completeness (with K20) | YES |

**Not started:** Queue B KEEP GAP (9 cases).  
**Not mutated:** Golden A, Primaries, SOW, OTJ, programme truth, Golden B.
`;
}
fs.writeFileSync(holdPath, hold);

// Refresh ER register markdown yes column already YES - append hold-pass note
const regPath = path.join(pack, "REGISTER-EVIDENCE-REQUESTS.md");
let reg = fs.readFileSync(regPath, "utf8");
if (!reg.includes("HOLD resolution pass 2026-08-10")) {
  reg += `
---

## HOLD resolution pass 2026-08-10

Queue A re-confirmed HOLD on ER-04, ER-09, ER-10, ER-11, ER-16, ER-18, ER-20.

All of these are flagged \`shouldAutoRequestDuringOnboardingOrSourceSufficiency: true\` in \`evidence-requests.json\` (\`portalDesign\`).

For product design: distinguish **unextracted linked materials**, **missing official components**, and **missing practice/assessment artefacts** — each should generate a different source-sufficiency prompt later (not implemented yet).
`;
  fs.writeFileSync(regPath, reg);
}

console.log("Recorded S25 HOLD resolution confirm -> ER-18; HOLD pass COMPLETE");
