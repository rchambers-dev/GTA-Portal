import fs from "fs";
import path from "path";

const pack =
  "tests/artifacts/autocare-v1/evidence-enriched/staging/remaining-51-plan/human-ratification-pack";

const cardsPath = path.join(pack, "cards-64.json");
const cards = JSON.parse(fs.readFileSync(cardsPath, "utf8"));
const c = cards.cards.find((x) => x.code === "K15");
c.holdResolutionReview = {
  reviewedAt: "2026-08-10",
  decision: "HOLD_FOR_EVIDENCE",
  linkedEvidenceRequests: ["ER-10"],
  unresolved: true,
  notes:
    "HOLD resolution pass (3/8): confirm keep HOLD. Core G7 battery/starter/alternator ownership direction is strong; do not close e-machine completeness without named teaching (ER-10). FS04 awareness must not steal Primary.",
  portalOnboardingRequest: {
    shouldAutoRequestDuringSourceSufficiency: true,
    evidenceClass: "MISSING_OFFICIAL_COMPONENT_TEACHING",
    requestSummary:
      "Locate named e-machine teaching within LV starting/charging (or confirm genuine absence)",
  },
};
c.humanDecision = "HOLD_FOR_EVIDENCE";
c.humanDecisionNotes =
  "HOLD resolution 2026-08-10 (pass 3/8): confirm HOLD_FOR_EVIDENCE pending ER-10. Onboarding/source-sufficiency auto-request: YES.";
c.humanDecisionAt = "2026-08-10";
c.linkedEvidenceRequests = ["ER-10"];
c.unresolved = true;
fs.writeFileSync(cardsPath, JSON.stringify(cards, null, 2) + "\n");

const logPath = path.join(pack, "DECISIONS-LOG.json");
const log = JSON.parse(fs.readFileSync(logPath, "utf8"));
const d = log.decisions.find((x) => x.code === "K15");
d.rationale = c.humanDecisionNotes;
d.holdResolutionReview = c.holdResolutionReview;
d.unresolved = true;
log.lastUpdated = "2026-08-10";
if (!log.holdResolutionPass.completed.includes("K15")) {
  log.holdResolutionPass.completed.push("K15");
}
fs.writeFileSync(logPath, JSON.stringify(log, null, 2) + "\n");

const erPath = path.join(pack, "evidence-requests.json");
const ers = JSON.parse(fs.readFileSync(erPath, "utf8"));
const er = ers.requests.find((r) => r.id === "ER-10");
er.portalDesign = {
  shouldAutoRequestDuringOnboardingOrSourceSufficiency: true,
  evidenceClass: "MISSING_OFFICIAL_COMPONENT_TEACHING",
  axis: ["teaching"],
  reason:
    "Official K15 explicitly names e-machine; current corpus has strong adjacent battery/starter/alternator teaching but no named e-machine component — source-sufficiency should flag official-component absences.",
};
ers.lastUpdated = "2026-08-10";
fs.writeFileSync(erPath, JSON.stringify(ers, null, 2) + "\n");

const mdPath = path.join(pack, "QUEUE-A-DECISIONS.md");
let lines = fs.readFileSync(mdPath, "utf8").split(/\r?\n/);
lines = lines.map((line) => {
  if (line.startsWith("| K15 |")) {
    return "| K15 | HOLD FOR EVIDENCE | — | ER-10 | HOLD resolution 3/8 confirmed; auto source-sufficiency request YES | 2026-08-10 |";
  }
  return line;
});
fs.writeFileSync(mdPath, lines.join("\n"));

const holdPath = path.join(pack, "HOLD-RESOLUTION-LOG.md");
let hold = fs.readFileSync(holdPath, "utf8");
hold = hold.replace(
  "| 3/8 | K15 | ER-10 | _pending_ | — | — |",
  "| 3/8 | K15 | ER-10 | HOLD FOR EVIDENCE (confirmed) | YES | 2026-08-10 |",
);
if (!hold.includes("## K15 notes")) {
  hold += `
## K15 notes

- Core LV battery + starter + alternator strong at G7 with practice/CEA.
- Golden A Primary B2 is ownership-skewed vs first substantive G7 home.
- Remaining OPEN = named e-machine component (ER-10).
- Future Portal: auto-flag missing named official components during source-sufficiency.
`;
}
fs.writeFileSync(holdPath, hold);

console.log("Recorded K15 HOLD resolution confirm -> ER-10");
