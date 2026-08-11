import fs from "fs";
import path from "path";

const pack =
  "tests/artifacts/autocare-v1/evidence-enriched/staging/remaining-51-plan/human-ratification-pack";
const today = "2026-08-10";
const code = "B5";
const erIds = ["ER-01"];
const notes =
  "Queue B 2026-08-10 (2/9): APPROVE KEEP GAP. Richer corpus: no substantive inclusive-workplace/EDI teaching. W11 B5 focus-tag rejected (CS scenarios only). FS01 professional behaviours ≠ B5. Residual off-pack pastoral EDI = possible visibility only (ER-01). Type B on supplied Autocare curriculum. Do not force Primary.";

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
    "The supplied Autocare curriculum appears genuinely not to teach/practise/assess inclusive workplace behaviour.",
  residualTypeAForOffPackOnly:
    "Off-pack pastoral/tutorial EDI could exist — tracked as ER-01 visibility residual, not as coverage.",
  futureProgrammeBuilderAction:
    "Auto-request named EDI/inclusion teaching (not SEND 'inclusion' scaffolding) during onboarding/source-sufficiency (ER-01). Do not invent Primary from SOW focus tags.",
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
const er = ers.requests.find((r) => r.id === "ER-01");
er.portalDesign = {
  shouldAutoRequestDuringOnboardingOrSourceSufficiency: true,
  evidenceClass: "MISSING_NAMED_EDI_INCLUSION_TEACHING",
  axis: ["teaching", "practice", "workplaceApplication"],
  reason:
    "KEEP GAP approved for B5/K31/S20 cluster on supplied Autocare corpus; auto-request any named EDI/inclusion induction materials (exclude SEND inclusion scaffolding false positives).",
};
ers.lastUpdated = today;
fs.writeFileSync(erPath, JSON.stringify(ers, null, 2) + "\n");

const qbPath = path.join(pack, "QUEUE-B-DECISIONS.md");
let qb = fs.readFileSync(qbPath, "utf8").split(/\r?\n/);
qb = qb.filter((line) => !line.startsWith("| B5 |"));
while (qb.length && qb[qb.length - 1] === "") qb.pop();
qb.push(
  "| B5 | APPROVE KEEP GAP | — | ER-01 | Type B on supplied Autocare curriculum; off-pack EDI via ER-01 | 2026-08-10 |",
);
qb.push("");
fs.writeFileSync(qbPath, qb.join("\n"));

const qbLog = path.join(pack, "QUEUE-B-RESOLUTION-LOG.md");
let t = fs.readFileSync(qbLog, "utf8");
t = t.replace(
  "| 2/9 | B5 | _pending_ | — | — | — | — |",
  "| 2/9 | B5 | APPROVE KEEP GAP | ER-01 | B (+ off-pack A residual) | YES | 2026-08-10 |",
);
if (!t.includes("## B5 notes")) {
  t += `
## B5 notes

- Official: support inclusive workplace / respect different views.
- Rejected: W11 focus-tag without inclusive content; FS01 professional/safety behaviours.
- Checked: Block/Foundation LP scan — zero inclusivity/diversity/equity hits in tranche-2 dossier.
- Do not invent Primary from tags.
`;
}
fs.writeFileSync(qbLog, t);

console.log("Recorded B5 APPROVE KEEP GAP");
