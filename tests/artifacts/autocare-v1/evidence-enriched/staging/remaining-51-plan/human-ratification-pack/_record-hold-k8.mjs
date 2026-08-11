import fs from "fs";
import path from "path";

const pack =
  "tests/artifacts/autocare-v1/evidence-enriched/staging/remaining-51-plan/human-ratification-pack";

const cardsPath = path.join(pack, "cards-64.json");
const cards = JSON.parse(fs.readFileSync(cardsPath, "utf8"));
const c = cards.cards.find((x) => x.code === "K8");
c.holdResolutionReview = {
  reviewedAt: "2026-08-10",
  decision: "HOLD_FOR_EVIDENCE",
  linkedEvidenceRequests: ["ER-16"],
  unresolved: true,
  notes:
    "HOLD resolution pass (1/8): confirm keep HOLD. Do not APPROVE PARTIAL flip until Vehicle Service History.ppt is extracted and owner's-manuals teaching is located or confirmed absent. Warranty intent topics remain thin.",
  portalOnboardingRequest: {
    shouldAutoRequestDuringSourceSufficiency: true,
    evidenceClass: "MISSING_OR_UNEXTRACTED_TEACHING_MATERIAL",
    requestSummary:
      "Extract/ingest Vehicle Service History.ppt body + locate any owner's manuals purpose/use teaching",
  },
};
c.humanDecision = "HOLD_FOR_EVIDENCE";
c.humanDecisionNotes =
  "HOLD resolution 2026-08-10 (pass 1/8): confirm HOLD_FOR_EVIDENCE pending ER-16. Onboarding/source-sufficiency auto-request: YES.";
c.humanDecisionAt = "2026-08-10";
c.humanDecisionQueue = "A";
c.linkedEvidenceRequests = ["ER-16"];
c.unresolved = true;
fs.writeFileSync(cardsPath, JSON.stringify(cards, null, 2) + "\n");

const logPath = path.join(pack, "DECISIONS-LOG.json");
const log = JSON.parse(fs.readFileSync(logPath, "utf8"));
const d = log.decisions.find((x) => x.code === "K8");
d.rationale = c.humanDecisionNotes;
d.holdResolutionReview = c.holdResolutionReview;
d.unresolved = true;
d.decision = "HOLD_FOR_EVIDENCE";
log.lastUpdated = "2026-08-10";
if (!log.holdResolutionPass) {
  log.holdResolutionPass = {
    status: "IN_PROGRESS",
    startedAt: "2026-08-10",
    scope: "Queue A HOLD_FOR_EVIDENCE cases only (8)",
    order: ["K8", "K9", "K15", "K17", "K20", "K25", "S13", "S25"],
    completed: [],
  };
}
if (!log.holdResolutionPass.completed.includes("K8")) {
  log.holdResolutionPass.completed.push("K8");
}
fs.writeFileSync(logPath, JSON.stringify(log, null, 2) + "\n");

const erPath = path.join(pack, "evidence-requests.json");
const ers = JSON.parse(fs.readFileSync(erPath, "utf8"));
const er = ers.requests.find((r) => r.id === "ER-16");
er.portalDesign = {
  shouldAutoRequestDuringOnboardingOrSourceSufficiency: true,
  evidenceClass: "MISSING_OR_UNEXTRACTED_TEACHING_MATERIAL",
  axis: ["teaching"],
  reason:
    "Named PPT exists in catalogue with empty extract; owner's manuals axis not found — future Programme Builder should flag unextracted linked materials and missing official components during source-sufficiency.",
};
ers.lastUpdated = "2026-08-10";
fs.writeFileSync(erPath, JSON.stringify(ers, null, 2) + "\n");

const mdPath = path.join(pack, "QUEUE-A-DECISIONS.md");
let lines = fs.readFileSync(mdPath, "utf8").split(/\r?\n/);
lines = lines.map((line) => {
  if (line.startsWith("| K8 |")) {
    return "| K8 | HOLD FOR EVIDENCE | — | ER-16 | HOLD resolution 1/8 confirmed; auto source-sufficiency request YES | 2026-08-10 |";
  }
  return line;
});
fs.writeFileSync(mdPath, lines.join("\n"));

const holdLog = `# Queue A HOLD Resolution Pass

**Status:** Staging only — does not mutate Golden A / Primaries / OTJ / programme truth.

**Scope:** The 8 Queue A \`HOLD_FOR_EVIDENCE\` cases recorded in \`DECISIONS-LOG.json\`.

| # | KSB | Linked ER | Decision | Portal auto-request? | When |
|---|---|---|---|---|---|
| 1/8 | K8 | ER-16 | HOLD FOR EVIDENCE (confirmed) | YES | 2026-08-10 |
| 2/8 | K9 | ER-09 | _pending_ | — | — |
| 3/8 | K15 | ER-10 | _pending_ | — | — |
| 4/8 | K17 | ER-11 | _pending_ | — | — |
| 5/8 | K20 | ER-18 | _pending_ | — | — |
| 6/8 | K25 | ER-20 | _pending_ | — | — |
| 7/8 | S13 | ER-04 | _pending_ | — | — |
| 8/8 | S25 | ER-18 | _pending_ | — | — |

## K8 notes

- Remaining OPEN pending extract of \`Vehicle Service History.ppt\` (\`res_lm_049aeee9cc31_124\`) and owner's-manuals teaching.
- Do not APPROVE PARTIAL classification flip until ER-16 reviewed.
- Future Portal: automatically request this during apprenticeship onboarding / source-sufficiency checking.
`;
fs.writeFileSync(path.join(pack, "HOLD-RESOLUTION-LOG.md"), holdLog);

console.log("Recorded K8 HOLD resolution confirm -> ER-16");
