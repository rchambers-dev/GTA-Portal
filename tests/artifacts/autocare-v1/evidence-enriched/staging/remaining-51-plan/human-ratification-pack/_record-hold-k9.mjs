import fs from "fs";
import path from "path";

const pack =
  "tests/artifacts/autocare-v1/evidence-enriched/staging/remaining-51-plan/human-ratification-pack";

const cardsPath = path.join(pack, "cards-64.json");
const cards = JSON.parse(fs.readFileSync(cardsPath, "utf8"));
const c = cards.cards.find((x) => x.code === "K9");
c.holdResolutionReview = {
  reviewedAt: "2026-08-10",
  decision: "HOLD_FOR_EVIDENCE",
  linkedEvidenceRequests: ["ER-09"],
  unresolved: true,
  notes:
    "HOLD resolution pass (2/8): confirm keep HOLD. Ownership toward early G3/B2 is already strongly evidenced on operational components; do not finalise completeness of legislation/EU labelling/sidewall/homologation until Tyres.ppt is extracted (ER-09).",
  portalOnboardingRequest: {
    shouldAutoRequestDuringSourceSufficiency: true,
    evidenceClass: "MISSING_OR_UNEXTRACTED_TEACHING_MATERIAL",
    requestSummary:
      "Extract/ingest Tyres.ppt for legislation, EU labelling, sidewall markings, and homologated fitments",
  },
};
c.humanDecision = "HOLD_FOR_EVIDENCE";
c.humanDecisionNotes =
  "HOLD resolution 2026-08-10 (pass 2/8): confirm HOLD_FOR_EVIDENCE pending ER-09. Onboarding/source-sufficiency auto-request: YES.";
c.humanDecisionAt = "2026-08-10";
c.linkedEvidenceRequests = ["ER-09"];
c.unresolved = true;
fs.writeFileSync(cardsPath, JSON.stringify(cards, null, 2) + "\n");

const logPath = path.join(pack, "DECISIONS-LOG.json");
const log = JSON.parse(fs.readFileSync(logPath, "utf8"));
const d = log.decisions.find((x) => x.code === "K9");
d.rationale = c.humanDecisionNotes;
d.holdResolutionReview = c.holdResolutionReview;
d.unresolved = true;
log.lastUpdated = "2026-08-10";
if (!log.holdResolutionPass.completed.includes("K9")) {
  log.holdResolutionPass.completed.push("K9");
}
fs.writeFileSync(logPath, JSON.stringify(log, null, 2) + "\n");

const erPath = path.join(pack, "evidence-requests.json");
const ers = JSON.parse(fs.readFileSync(erPath, "utf8"));
const er = ers.requests.find((r) => r.id === "ER-09");
er.portalDesign = {
  shouldAutoRequestDuringOnboardingOrSourceSufficiency: true,
  evidenceClass: "MISSING_OR_UNEXTRACTED_TEACHING_MATERIAL",
  axis: ["teaching"],
  reason:
    "Tyres.ppt is catalogue-linked but largely unextracted; official K9 tech-info components remain unresolved between visibility and depth gap.",
};
ers.lastUpdated = "2026-08-10";
fs.writeFileSync(erPath, JSON.stringify(ers, null, 2) + "\n");

const mdPath = path.join(pack, "QUEUE-A-DECISIONS.md");
let lines = fs.readFileSync(mdPath, "utf8").split(/\r?\n/);
lines = lines.map((line) => {
  if (line.startsWith("| K9 |")) {
    return "| K9 | HOLD FOR EVIDENCE | — | ER-09 | HOLD resolution 2/8 confirmed; auto source-sufficiency request YES | 2026-08-10 |";
  }
  return line;
});
fs.writeFileSync(mdPath, lines.join("\n"));

const holdPath = path.join(pack, "HOLD-RESOLUTION-LOG.md");
let hold = fs.readFileSync(holdPath, "utf8");
hold = hold.replace(
  "| 2/8 | K9 | ER-09 | _pending_ | — | — |",
  "| 2/8 | K9 | ER-09 | HOLD FOR EVIDENCE (confirmed) | YES | 2026-08-10 |",
);
if (!hold.includes("## K9 notes")) {
  hold += `
## K9 notes

- Operational R&R / repair / TPMS already strong with practice + CEA.
- Ownership direction toward early G3/B2 is evidenced; B7 is later reinforce.
- Remaining OPEN = tech-info components pending Tyres.ppt extract (ER-09).
- Future Portal: automatically request unextracted linked tyre tech-info materials during source-sufficiency.
`;
}
fs.writeFileSync(holdPath, hold);

console.log("Recorded K9 HOLD resolution confirm -> ER-09");
