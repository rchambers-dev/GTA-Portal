import fs from "fs";
import path from "path";

const pack =
  "tests/artifacts/autocare-v1/evidence-enriched/staging/remaining-51-plan/human-ratification-pack";
const today = "2026-08-10";
const code = "S19";
const erIds = ["ER-22", "ER-05"];
const notes =
  "Queue B 2026-08-10 (8/9): APPROVE KEEP GAP. Aligns with companion K30. No deliberate apply-team-working skill evidence. FS06 mention and inferred paired practicals rejected. Golden A Primary B3 not preserved. Type B on supplied curriculum. ER-22 primary; ER-05 mentor residual.";

const cardsPath = path.join(pack, "cards-64.json");
const cards = JSON.parse(fs.readFileSync(cardsPath, "utf8"));
const c = cards.cards.find((x) => x.code === code);
c.humanDecision = "APPROVE";
c.humanDecisionNotes = notes;
c.humanDecisionAt = today;
c.humanDecisionQueue = "B";
c.linkedEvidenceRequests = erIds;
c.unresolved = false;
c.gapProductClassification = {
  conclusionType: "B_GENUINE_UNSUPPORTED_ON_SUPPLIED_CURRICULUM",
  meaning:
    "Supplied curriculum does not deliberately teach/assess application of team-working principles.",
  rejectedFalsePositives: [
    "FS06 teamwork mention",
    "Common paired/group practicals as deliberate S19 assessment",
  ],
  futureProgrammeBuilderAction:
    "Auto-request deliberate team-working application teaching and observed assessment (ER-22). Do not force Primary B3.",
};
fs.writeFileSync(cardsPath, JSON.stringify(cards, null, 2) + "\n");

const logPath = path.join(pack, "DECISIONS-LOG.json");
const log = JSON.parse(fs.readFileSync(logPath, "utf8"));
log.decisions = log.decisions.filter((d) => !(d.code === code && d.queue === "B"));
log.decisions.push({
  code,
  queue: "B",
  decision: "APPROVE",
  decidedAt: today,
  proposedDirectionBucket: "KEEP_GAP",
  shadowPosition: c.shadowPosition,
  goldenAPosition: c.goldenAPosition,
  rationale: notes,
  amendedPosition: null,
  linkedEvidenceRequests: erIds,
  unresolved: false,
  gapProductClassification: c.gapProductClassification,
});
if (!log.queueBPass.completed.includes(code)) log.queueBPass.completed.push(code);
log.lastUpdated = today;
fs.writeFileSync(logPath, JSON.stringify(log, null, 2) + "\n");

const qbPath = path.join(pack, "QUEUE-B-DECISIONS.md");
let qb = fs.readFileSync(qbPath, "utf8").split(/\r?\n/);
qb = qb.filter((line) => !line.startsWith("| S19 |"));
while (qb.length && qb[qb.length - 1] === "") qb.pop();
qb.push(
  "| S19 | APPROVE KEEP GAP | — | ER-22, ER-05 | Type B; companion K30; do not keep Primary B3 | 2026-08-10 |",
);
qb.push("");
fs.writeFileSync(qbPath, qb.join("\n"));

const qbLog = path.join(pack, "QUEUE-B-RESOLUTION-LOG.md");
let t = fs.readFileSync(qbLog, "utf8");
t = t.replace(
  "| 8/9 | S19 | _pending_ | — | — | — | — |",
  "| 8/9 | S19 | APPROVE KEEP GAP | ER-22 (+ER-05) | B | YES | 2026-08-10 |",
);
if (!t.includes("## S19 notes")) {
  t += `
## S19 notes

- Unsupported: deliberate apply team-working principles.
- Companion to K30; Golden A B3 not preserved.
`;
}
fs.writeFileSync(qbLog, t);
console.log("Recorded S19 APPROVE KEEP GAP");
