import fs from "fs";
import path from "path";

const pack =
  "tests/artifacts/autocare-v1/evidence-enriched/staging/remaining-51-plan/human-ratification-pack";
const today = "2026-08-10";
const code = "K30";
const erIds = ["ER-22", "ER-05"];
const notes =
  "Queue B 2026-08-10 (5/9): APPROVE KEEP GAP. No deliberate team-working principles teaching in richer corpus. FS06 teamwork mention rejected; inferred collaborative practicals rejected as principles coverage. Golden A Primary B3 not preserved. Type B on supplied curriculum. ER-22 primary overturn path; ER-05 filled mentor residual only.";

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
    "Supplied curriculum does not deliberately teach team-working principles; mentions/inference insufficient.",
  rejectedFalsePositives: [
    "FS06 occupational relevance listing teamwork",
    "Inferred collaborative workshop practicals as principles teaching",
  ],
  futureProgrammeBuilderAction:
    "Auto-request deliberate team-working principles LP and observed teamwork assessment (ER-22). Do not force Primary from Golden A B3.",
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

const erPath = path.join(pack, "evidence-requests.json");
const ers = JSON.parse(fs.readFileSync(erPath, "utf8"));
const er = ers.requests.find((r) => r.id === "ER-22");
er.portalDesign = {
  shouldAutoRequestDuringOnboardingOrSourceSufficiency: true,
  evidenceClass: "MISSING_DELIBERATE_SOFT_SKILL_PRINCIPLES_TEACHING",
  axis: ["teaching", "practice", "assessment"],
  reason:
    "KEEP GAP approved for K30/S19: mention/inference insufficient. Auto-request deliberate team-working principles teaching and observed assessment.",
};
ers.lastUpdated = today;
fs.writeFileSync(erPath, JSON.stringify(ers, null, 2) + "\n");

const qbPath = path.join(pack, "QUEUE-B-DECISIONS.md");
let qb = fs.readFileSync(qbPath, "utf8").split(/\r?\n/);
qb = qb.filter((line) => !line.startsWith("| K30 |"));
while (qb.length && qb[qb.length - 1] === "") qb.pop();
qb.push(
  "| K30 | APPROVE KEEP GAP | — | ER-22, ER-05 | Type B; reject FS06 mention; do not keep Primary B3 | 2026-08-10 |",
);
qb.push("");
fs.writeFileSync(qbPath, qb.join("\n"));

const qbLog = path.join(pack, "QUEUE-B-RESOLUTION-LOG.md");
let t = fs.readFileSync(qbLog, "utf8");
t = t.replace(
  "| 5/9 | K30 | _pending_ | — | — | — | — |",
  "| 5/9 | K30 | APPROVE KEEP GAP | ER-22 (+ER-05) | B | YES | 2026-08-10 |",
);
if (!t.includes("## K30 notes")) {
  t += `
## K30 notes

- Unsupported: deliberate team-working principles teaching.
- Rejected: FS06 mention; inferred collaborative practicals; Golden A B3 as automatic Primary.
`;
}
fs.writeFileSync(qbLog, t);
console.log("Recorded K30 APPROVE KEEP GAP");
