import fs from "fs";
import path from "path";

const pack =
  "tests/artifacts/autocare-v1/evidence-enriched/staging/remaining-51-plan/human-ratification-pack";

const cardsPath = path.join(pack, "cards-64.json");
const cards = JSON.parse(fs.readFileSync(cardsPath, "utf8"));
const c = cards.cards.find((x) => x.code === "K17");
c.holdResolutionReview = {
  reviewedAt: "2026-08-10",
  decision: "HOLD_FOR_EVIDENCE",
  linkedEvidenceRequests: ["ER-11"],
  unresolved: true,
  notes:
    "HOLD resolution pass (4/8): confirm keep HOLD. G11-first ownership for ADAS awareness/repair-impact is evidenced; do not close named static/dynamic methods + equipment completeness without ER-11.",
  portalOnboardingRequest: {
    shouldAutoRequestDuringSourceSufficiency: true,
    evidenceClass: "MISSING_OR_THIN_NAMED_METHOD_TEACHING",
    requestSummary:
      "Locate named static vs dynamic ADAS calibration methods and calibration-equipment teaching",
  },
};
c.humanDecision = "HOLD_FOR_EVIDENCE";
c.humanDecisionNotes =
  "HOLD resolution 2026-08-10 (pass 4/8): confirm HOLD_FOR_EVIDENCE pending ER-11. Onboarding/source-sufficiency auto-request: YES.";
c.humanDecisionAt = "2026-08-10";
c.linkedEvidenceRequests = ["ER-11"];
c.unresolved = true;
fs.writeFileSync(cardsPath, JSON.stringify(cards, null, 2) + "\n");

const logPath = path.join(pack, "DECISIONS-LOG.json");
const log = JSON.parse(fs.readFileSync(logPath, "utf8"));
const d = log.decisions.find((x) => x.code === "K17");
d.rationale = c.humanDecisionNotes;
d.holdResolutionReview = c.holdResolutionReview;
d.unresolved = true;
log.lastUpdated = "2026-08-10";
if (!log.holdResolutionPass.completed.includes("K17")) {
  log.holdResolutionPass.completed.push("K17");
}
fs.writeFileSync(logPath, JSON.stringify(log, null, 2) + "\n");

const erPath = path.join(pack, "evidence-requests.json");
const ers = JSON.parse(fs.readFileSync(erPath, "utf8"));
const er = ers.requests.find((r) => r.id === "ER-11");
er.portalDesign = {
  shouldAutoRequestDuringOnboardingOrSourceSufficiency: true,
  evidenceClass: "MISSING_OR_THIN_NAMED_METHOD_TEACHING",
  axis: ["teaching"],
  reason:
    "Official K17 expects static and dynamic calibration methods and equipment; awareness/repair-impact is strong but named methods are thin — source-sufficiency should request method-depth materials.",
};
ers.lastUpdated = "2026-08-10";
fs.writeFileSync(erPath, JSON.stringify(ers, null, 2) + "\n");

const mdPath = path.join(pack, "QUEUE-A-DECISIONS.md");
let lines = fs.readFileSync(mdPath, "utf8").split(/\r?\n/);
lines = lines.map((line) => {
  if (line.startsWith("| K17 |")) {
    return "| K17 | HOLD FOR EVIDENCE | — | ER-11 | HOLD resolution 4/8 confirmed; auto source-sufficiency request YES | 2026-08-10 |";
  }
  return line;
});
fs.writeFileSync(mdPath, lines.join("\n"));

const holdPath = path.join(pack, "HOLD-RESOLUTION-LOG.md");
let hold = fs.readFileSync(holdPath, "utf8");
hold = hold.replace(
  "| 4/8 | K17 | ER-11 | _pending_ | — | — |",
  "| 4/8 | K17 | ER-11 | HOLD FOR EVIDENCE (confirmed) | YES | 2026-08-10 |",
);
if (!hold.includes("## K17 notes")) {
  hold += `
## K17 notes

- ADAS awareness + repair-impact strong at G11; B9 is pre-cal reinforce only.
- Remaining OPEN = named static/dynamic methods + equipment (ER-11).
- Future Portal: auto-request named-method teaching when official wording mandates methods.
`;
}
fs.writeFileSync(holdPath, hold);

console.log("Recorded K17 HOLD resolution confirm -> ER-11");
