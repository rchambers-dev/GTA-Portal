import fs from "fs";
import path from "path";

const pack =
  "tests/artifacts/autocare-v1/evidence-enriched/staging/remaining-51-plan/human-ratification-pack";

const cardsPath = path.join(pack, "cards-64.json");
const cards = JSON.parse(fs.readFileSync(cardsPath, "utf8"));
const c = cards.cards.find((x) => x.code === "S13");
c.holdResolutionReview = {
  reviewedAt: "2026-08-10",
  decision: "HOLD_FOR_EVIDENCE",
  linkedEvidenceRequests: ["ER-04"],
  unresolved: true,
  notes:
    "HOLD resolution pass (7/8): confirm keep HOLD/REVIEW. Structural ownership CLEAR @ B6 is not remapped. Rules teaching must not be credited as S13 competence until learner-performed/assessed isolation artefact is reviewed (ER-04).",
  portalOnboardingRequest: {
    shouldAutoRequestDuringSourceSufficiency: true,
    evidenceClass: "MISSING_PRACTICE_OR_ASSESSMENT_ARTEFACT",
    requestSummary:
      "Supply HV isolation competence evidence (learner-performed and/or assessed) distinct from rules/awareness teaching",
  },
};
c.humanDecision = "HOLD_FOR_EVIDENCE";
c.humanDecisionNotes =
  "HOLD resolution 2026-08-10 (pass 7/8): confirm HOLD_FOR_EVIDENCE pending ER-04. Onboarding/source-sufficiency auto-request: YES (practice/assessment).";
c.humanDecisionAt = "2026-08-10";
c.linkedEvidenceRequests = ["ER-04"];
c.unresolved = true;
fs.writeFileSync(cardsPath, JSON.stringify(cards, null, 2) + "\n");

const logPath = path.join(pack, "DECISIONS-LOG.json");
const log = JSON.parse(fs.readFileSync(logPath, "utf8"));
const d = log.decisions.find((x) => x.code === "S13");
d.rationale = c.humanDecisionNotes;
d.holdResolutionReview = c.holdResolutionReview;
d.unresolved = true;
log.lastUpdated = "2026-08-10";
if (!log.holdResolutionPass.completed.includes("S13")) {
  log.holdResolutionPass.completed.push("S13");
}
fs.writeFileSync(logPath, JSON.stringify(log, null, 2) + "\n");

const erPath = path.join(pack, "evidence-requests.json");
const ers = JSON.parse(fs.readFileSync(erPath, "utf8"));
const er = ers.requests.find((r) => r.id === "ER-04");
er.portalDesign = {
  shouldAutoRequestDuringOnboardingOrSourceSufficiency: true,
  evidenceClass: "MISSING_PRACTICE_OR_ASSESSMENT_ARTEFACT",
  axis: ["practice", "assessment"],
  reason:
    "For skills, teaching of rules is not competence. Source-sufficiency should require learner-performed/assessed practical artefacts for skills like HV isolation, separate from awareness/materials teaching.",
};
ers.lastUpdated = "2026-08-10";
fs.writeFileSync(erPath, JSON.stringify(ers, null, 2) + "\n");

const mdPath = path.join(pack, "QUEUE-A-DECISIONS.md");
let lines = fs.readFileSync(mdPath, "utf8").split(/\r?\n/);
lines = lines.map((line) => {
  if (line.startsWith("| S13 |")) {
    return "| S13 | HOLD FOR EVIDENCE | — | ER-04 | HOLD resolution 7/8 confirmed; auto source-sufficiency request YES (practice/assessment) | 2026-08-10 |";
  }
  return line;
});
fs.writeFileSync(mdPath, lines.join("\n"));

const holdPath = path.join(pack, "HOLD-RESOLUTION-LOG.md");
let hold = fs.readFileSync(holdPath, "utf8");
hold = hold.replace(
  "| 7/8 | S13 | ER-04 | _pending_ | — | — |",
  "| 7/8 | S13 | ER-04 | HOLD FOR EVIDENCE (confirmed) | YES | 2026-08-10 |",
);
if (!hold.includes("## S13 notes")) {
  hold += `
## S13 notes

- Isolation RULES teaching confirmed; assessed learner-performed competence unproven.
- Ownership stays CLEAR @ B6 (not a remap case).
- Remaining OPEN = ER-04.
- Future Portal: for skills, auto-request practice/assessment artefacts separately from teaching materials.
`;
}
fs.writeFileSync(holdPath, hold);

console.log("Recorded S13 HOLD resolution confirm -> ER-04");
