import fs from "fs";
import path from "path";

const pack =
  "tests/artifacts/autocare-v1/evidence-enriched/staging/remaining-51-plan/human-ratification-pack";
const today = "2026-08-10";
const code = "S20";
const erIds = ["ER-01"];
const notes =
  "Queue B 2026-08-10 (9/9): APPROVE KEEP GAP. No EDI compliance skill teaching/practice/assessment in richer Autocare corpus. Rejected SEND 'Inclusion, support and stretch' boilerplate and W11 S20 tags. Companion B5/K31. Type B on supplied curriculum; ER-01 off-pack residual. Do not force Primary.";

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
    "Supplied Autocare curriculum does not teach or assess compliance with equity, diversity and inclusion guidance.",
  rejectedFalsePositives: [
    "Block LP boilerplate 'Inclusion, support and stretch' (SEND scaffolding)",
    "W11 KSB tag listing S20",
  ],
  residualTypeAForOffPackOnly: "Off-pack pastoral EDI via ER-01 only.",
  futureProgrammeBuilderAction:
    "Auto-request named EDI compliance teaching/guidance (ER-01). Never treat SEND inclusion scaffolding as EDI skill coverage.",
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
log.queueBPass.status = "COMPLETE";
log.queueBPass.completedAt = today;
log.queueBPass.summary =
  "All 9 Queue B KEEP GAP cases APPROVED KEEP GAP (type B on supplied curriculum). Opened ER-27 for K1. No Golden A/programme-truth mutation. Queue C not started.";
log.lastUpdated = today;
fs.writeFileSync(logPath, JSON.stringify(log, null, 2) + "\n");

const qbPath = path.join(pack, "QUEUE-B-DECISIONS.md");
let qb = fs.readFileSync(qbPath, "utf8").split(/\r?\n/);
qb = qb.filter((line) => !line.startsWith("| S20 |"));
while (qb.length && qb[qb.length - 1] === "") qb.pop();
qb.push(
  "| S20 | APPROVE KEEP GAP | — | ER-01 | Type B; reject SEND inclusion scaffolding + W11 tags | 2026-08-10 |",
);
qb.push("");
fs.writeFileSync(qbPath, qb.join("\n"));

const qbLog = path.join(pack, "QUEUE-B-RESOLUTION-LOG.md");
let t = fs.readFileSync(qbLog, "utf8");
t = t.replace(
  "| 9/9 | S20 | _pending_ | — | — | — | — |",
  "| 9/9 | S20 | APPROVE KEEP GAP | ER-01 | B (+ off-pack A residual) | YES | 2026-08-10 |",
);
if (!t.includes("## S20 notes")) {
  t += `
## S20 notes

- Unsupported: comply with EDI guidance.
- Rejected: SEND inclusion boilerplate; W11 tags.
- Companion B5/K31 via ER-01.

---

## Queue B summary

**Result:** 9/9 **APPROVE KEEP GAP** (conclusion type **B** on the supplied Autocare curriculum).

No KEEP GAP was overturned to coverage by richer-corpus review.
No Primary was forced for a gap.
Golden A Primaries that lacked teaching home were **not** preserved merely because Golden A (B3 Primary on B3 behaviour? wait B3 behaviour had Primary B6; K30/S19 had Primary B3).

| KSB | Official focus unsupported | Key false positives rejected | Linked ER | Auto-request |
|---|---|---|---|---|
| B3 | Adapt to changing work demands | Adaptive suspension; W62 adjacency | ER-23 | YES |
| B5 | Inclusive workplace behaviour | W11 focus-tag; FS01 professional behaviours | ER-01 | YES |
| K1 | Industry context + technician role | W16 tags; FS01 adjacency; FS03 HV-only autonomy | **ER-27** (new) | YES |
| K28 | FCA + PCI | Payments/VAT/GDPR/fraud adjacency | ER-02 | YES |
| K30 | Team-working principles | FS06 mention; inferred collaboration | ER-22 (+ER-05) | YES |
| K31 | EDI principles + impact | edi substring FPs; mv13 labels | ER-01 | YES |
| S11 | HV battery/charger SoH tests | EV awareness; locate/isolate; 12V GW | ER-03 | YES |
| S19 | Apply team working | FS06; paired practicals | ER-22 (+ER-05) | YES |
| S20 | Comply with EDI guidance | SEND inclusion boilerplate; W11 tags | ER-01 | YES |

**Product distinction applied:** type **B** = curriculum appears genuinely not to teach/practise/assess the requirement on the supplied pack. Residual type **A** only where off-pack pastoral/induction materials could still exist (ER-01 / ER-27 family).

**Not started:** Queue C.  
**Not mutated:** Golden A, Primaries in DB, SOW, OTJ, programme truth, Golden B.
`;
}
fs.writeFileSync(qbLog, t);
console.log("Recorded S20 APPROVE KEEP GAP; Queue B COMPLETE");
