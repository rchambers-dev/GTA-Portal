import fs from "fs";
import path from "path";

const pack =
  "tests/artifacts/autocare-v1/evidence-enriched/staging/remaining-51-plan/human-ratification-pack";

const cardsPath = path.join(pack, "cards-64.json");
const cards = JSON.parse(fs.readFileSync(cardsPath, "utf8"));
const c = cards.cards.find((x) => x.code === "K20");
c.holdResolutionReview = {
  reviewedAt: "2026-08-10",
  decision: "HOLD_FOR_EVIDENCE",
  linkedEvidenceRequests: ["ER-18"],
  unresolved: true,
  notes:
    "HOLD resolution pass (5/8): confirm keep HOLD. Fluids/oil may support PARTIAL once closed, but air-filter component remains unresolved (ER-18). Do not force Primary. Companion S25 shares ER-18.",
  portalOnboardingRequest: {
    shouldAutoRequestDuringSourceSufficiency: true,
    evidenceClass: "MISSING_OFFICIAL_COMPONENT_TEACHING",
    requestSummary:
      "Locate air-filter / full filtration teaching beyond fluids (also affects S25)",
  },
};
c.humanDecision = "HOLD_FOR_EVIDENCE";
c.humanDecisionNotes =
  "HOLD resolution 2026-08-10 (pass 5/8): confirm HOLD_FOR_EVIDENCE pending ER-18. Onboarding/source-sufficiency auto-request: YES.";
c.humanDecisionAt = "2026-08-10";
c.linkedEvidenceRequests = ["ER-18"];
c.unresolved = true;
fs.writeFileSync(cardsPath, JSON.stringify(cards, null, 2) + "\n");

const logPath = path.join(pack, "DECISIONS-LOG.json");
const log = JSON.parse(fs.readFileSync(logPath, "utf8"));
const d = log.decisions.find((x) => x.code === "K20");
d.rationale = c.humanDecisionNotes;
d.holdResolutionReview = c.holdResolutionReview;
d.unresolved = true;
log.lastUpdated = "2026-08-10";
if (!log.holdResolutionPass.completed.includes("K20")) {
  log.holdResolutionPass.completed.push("K20");
}
fs.writeFileSync(logPath, JSON.stringify(log, null, 2) + "\n");

const erPath = path.join(pack, "evidence-requests.json");
const ers = JSON.parse(fs.readFileSync(erPath, "utf8"));
const er = ers.requests.find((r) => r.id === "ER-18");
er.portalDesign = {
  shouldAutoRequestDuringOnboardingOrSourceSufficiency: true,
  evidenceClass: "MISSING_OFFICIAL_COMPONENT_TEACHING",
  axis: ["teaching", "practice", "assessment"],
  reason:
    "Official K20/S25 include air filters; fluids/oil evidenced but air-filter teaching not found — source-sufficiency should request missing filtration components explicitly.",
};
ers.lastUpdated = "2026-08-10";
fs.writeFileSync(erPath, JSON.stringify(ers, null, 2) + "\n");

const mdPath = path.join(pack, "QUEUE-A-DECISIONS.md");
let lines = fs.readFileSync(mdPath, "utf8").split(/\r?\n/);
lines = lines.map((line) => {
  if (line.startsWith("| K20 |")) {
    return "| K20 | HOLD FOR EVIDENCE | — | ER-18 | HOLD resolution 5/8 confirmed; auto source-sufficiency request YES | 2026-08-10 |";
  }
  return line;
});
fs.writeFileSync(mdPath, lines.join("\n"));

const holdPath = path.join(pack, "HOLD-RESOLUTION-LOG.md");
let hold = fs.readFileSync(holdPath, "utf8");
hold = hold.replace(
  "| 5/8 | K20 | ER-18 | _pending_ | — | — |",
  "| 5/8 | K20 | ER-18 | HOLD FOR EVIDENCE (confirmed) | YES | 2026-08-10 |",
);
if (!hold.includes("## K20 notes")) {
  hold += `
## K20 notes

- Brake fluid / oil already evidenced; air-filter teaching not found.
- Companion S25 shares ER-18.
- Primary not forced (multi-home G4/G6).
- Future Portal: auto-request missing official filtration components.
`;
}
fs.writeFileSync(holdPath, hold);

console.log("Recorded K20 HOLD resolution confirm -> ER-18");
