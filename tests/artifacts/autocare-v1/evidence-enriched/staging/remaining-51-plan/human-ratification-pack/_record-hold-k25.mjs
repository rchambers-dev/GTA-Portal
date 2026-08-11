import fs from "fs";
import path from "path";

const pack =
  "tests/artifacts/autocare-v1/evidence-enriched/staging/remaining-51-plan/human-ratification-pack";

const cardsPath = path.join(pack, "cards-64.json");
const cards = JSON.parse(fs.readFileSync(cardsPath, "utf8"));
const c = cards.cards.find((x) => x.code === "K25");
c.holdResolutionReview = {
  reviewedAt: "2026-08-10",
  decision: "HOLD_FOR_EVIDENCE",
  linkedEvidenceRequests: ["ER-20"],
  unresolved: true,
  notes:
    "HOLD resolution pass (6/8): confirm keep HOLD. CS/ethics fragments must not be over-credited as full K25. Do not close PARTIAL/DISTRIBUTED until dedicated efficiency/competitiveness/operational-risk teaching is located or confirmed absent (ER-20).",
  portalOnboardingRequest: {
    shouldAutoRequestDuringSourceSufficiency: true,
    evidenceClass: "MISSING_DEDICATED_BUSINESS_OPERATIONS_TEACHING",
    requestSummary:
      "Locate dedicated business-operations teaching covering efficiency, competitiveness, and minimising operational risks",
  },
};
c.humanDecision = "HOLD_FOR_EVIDENCE";
c.humanDecisionNotes =
  "HOLD resolution 2026-08-10 (pass 6/8): confirm HOLD_FOR_EVIDENCE pending ER-20. Onboarding/source-sufficiency auto-request: YES.";
c.humanDecisionAt = "2026-08-10";
c.linkedEvidenceRequests = ["ER-20"];
c.unresolved = true;
fs.writeFileSync(cardsPath, JSON.stringify(cards, null, 2) + "\n");

const logPath = path.join(pack, "DECISIONS-LOG.json");
const log = JSON.parse(fs.readFileSync(logPath, "utf8"));
const d = log.decisions.find((x) => x.code === "K25");
d.rationale = c.humanDecisionNotes;
d.holdResolutionReview = c.holdResolutionReview;
d.unresolved = true;
log.lastUpdated = "2026-08-10";
if (!log.holdResolutionPass.completed.includes("K25")) {
  log.holdResolutionPass.completed.push("K25");
}
fs.writeFileSync(logPath, JSON.stringify(log, null, 2) + "\n");

const erPath = path.join(pack, "evidence-requests.json");
const ers = JSON.parse(fs.readFileSync(erPath, "utf8"));
const er = ers.requests.find((r) => r.id === "ER-20");
er.portalDesign = {
  shouldAutoRequestDuringOnboardingOrSourceSufficiency: true,
  evidenceClass: "MISSING_DEDICATED_BUSINESS_OPERATIONS_TEACHING",
  axis: ["teaching"],
  reason:
    "Official K25 spans efficiency/competitiveness/operational risk/ethics/CS; only CS/ethics fragments are evidenced — source-sufficiency should request dedicated business-operations materials rather than accepting adjacency.",
};
ers.lastUpdated = "2026-08-10";
fs.writeFileSync(erPath, JSON.stringify(ers, null, 2) + "\n");

const mdPath = path.join(pack, "QUEUE-A-DECISIONS.md");
let lines = fs.readFileSync(mdPath, "utf8").split(/\r?\n/);
lines = lines.map((line) => {
  if (line.startsWith("| K25 |")) {
    return "| K25 | HOLD FOR EVIDENCE | — | ER-20 | HOLD resolution 6/8 confirmed; auto source-sufficiency request YES | 2026-08-10 |";
  }
  return line;
});
fs.writeFileSync(mdPath, lines.join("\n"));

const holdPath = path.join(pack, "HOLD-RESOLUTION-LOG.md");
let hold = fs.readFileSync(holdPath, "utf8");
hold = hold.replace(
  "| 6/8 | K25 | ER-20 | _pending_ | — | — |",
  "| 6/8 | K25 | ER-20 | HOLD FOR EVIDENCE (confirmed) | YES | 2026-08-10 |",
);
if (!hold.includes("## K25 notes")) {
  hold += `
## K25 notes

- CS/ethics fragments only; efficiency/competitiveness/operational-risk body missing.
- Do not over-credit CS as full K25; Golden A B6 Primary is ownership-suspect.
- Remaining OPEN = ER-20.
- Future Portal: auto-request dedicated business-operations teaching (not adjacency).
`;
}
fs.writeFileSync(holdPath, hold);

console.log("Recorded K25 HOLD resolution confirm -> ER-20");
