import fs from "fs";
import path from "path";

const pack =
  "tests/artifacts/autocare-v1/evidence-enriched/staging/remaining-51-plan/human-ratification-pack";
const today = "2026-08-10";
const code = "K31";
const erIds = ["ER-01"];
const notes =
  "Queue B 2026-08-10 (6/9): APPROVE KEEP GAP. No EDI principles / workplace-impact teaching in richer Autocare corpus. Rejected edi-substring false positives and mv13 diversity milestone labels. Type B on supplied curriculum; ER-01 off-pack pastoral residual. Companion B5/S20. Do not force Primary.";

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
    "Supplied Autocare curriculum does not teach equity, diversity and inclusion principles or their workplace impact.",
  residualTypeAForOffPackOnly: "Off-pack pastoral EDI via ER-01 only.",
  futureProgrammeBuilderAction:
    "Auto-request named EDI teaching (ER-01), excluding SEND 'inclusion' scaffolding false positives. Do not invent Primary.",
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
qb = qb.filter((line) => !line.startsWith("| K31 |"));
while (qb.length && qb[qb.length - 1] === "") qb.pop();
qb.push(
  "| K31 | APPROVE KEEP GAP | — | ER-01 | Type B; EDI cluster with B5/S20 | 2026-08-10 |",
);
qb.push("");
fs.writeFileSync(qbPath, qb.join("\n"));

const qbLog = path.join(pack, "QUEUE-B-RESOLUTION-LOG.md");
let t = fs.readFileSync(qbLog, "utf8");
t = t.replace(
  "| 6/9 | K31 | _pending_ | — | — | — | — |",
  "| 6/9 | K31 | APPROVE KEEP GAP | ER-01 | B (+ off-pack A residual) | YES | 2026-08-10 |",
);
if (!t.includes("## K31 notes")) {
  t += `
## K31 notes

- Unsupported: EDI principles; impact on their work.
- Rejected: edi substring FPs; mv13 diversity milestone labels.
`;
}
fs.writeFileSync(qbLog, t);
console.log("Recorded K31 APPROVE KEEP GAP");
