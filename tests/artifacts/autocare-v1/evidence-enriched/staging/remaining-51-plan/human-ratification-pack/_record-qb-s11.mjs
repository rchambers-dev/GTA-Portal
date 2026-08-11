import fs from "fs";
import path from "path";

const pack =
  "tests/artifacts/autocare-v1/evidence-enriched/staging/remaining-51-plan/human-ratification-pack";
const today = "2026-08-10";
const code = "S11";
const erIds = ["ER-03"];
const notes =
  "Queue B 2026-08-10 (7/9): APPROVE KEEP GAP. HV battery/charger SoH condition-monitoring competence not found. EV awareness, HV safety, locate/isolate (CEA 2.1), 12V GW tests rejected as false substitutes. Must not borrow S13/K21/K23. Type B on supplied curriculum. ER-03 onboarding auto-request. Do not force Primary.";

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
    "Supplied curriculum teaches EV awareness/isolation but not HV battery/charger State-of-Health testing competence.",
  rejectedFalsePositives: [
    "Hybrid/HV awareness PPTs as SoH",
    "CEA locate + isolate as SoH tests",
    "GW1 12V battery/charging as HV SoH",
  ],
  futureProgrammeBuilderAction:
    "Auto-request SoH teaching/practice/assessment artefacts (ER-03). Keep awareness≠competence rule for EV skills.",
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
const er = ers.requests.find((r) => r.id === "ER-03");
er.portalDesign = {
  shouldAutoRequestDuringOnboardingOrSourceSufficiency: true,
  evidenceClass: "MISSING_NAMED_SKILL_COMPETENCE_ARTEFACTS",
  axis: ["teaching", "practice", "assessment"],
  reason:
    "KEEP GAP approved: EV awareness must not satisfy HV SoH skill. Auto-request SoH procedures and assessed practicals.",
};
ers.lastUpdated = today;
fs.writeFileSync(erPath, JSON.stringify(ers, null, 2) + "\n");

const qbPath = path.join(pack, "QUEUE-B-DECISIONS.md");
let qb = fs.readFileSync(qbPath, "utf8").split(/\r?\n/);
qb = qb.filter((line) => !line.startsWith("| S11 |"));
while (qb.length && qb[qb.length - 1] === "") qb.pop();
qb.push(
  "| S11 | APPROVE KEEP GAP | — | ER-03 | Type B; awareness≠SoH competence | 2026-08-10 |",
);
qb.push("");
fs.writeFileSync(qbPath, qb.join("\n"));

const qbLog = path.join(pack, "QUEUE-B-RESOLUTION-LOG.md");
let t = fs.readFileSync(qbLog, "utf8");
t = t.replace(
  "| 7/9 | S11 | _pending_ | — | — | — | — |",
  "| 7/9 | S11 | APPROVE KEEP GAP | ER-03 | B | YES | 2026-08-10 |",
);
if (!t.includes("## S11 notes")) {
  t += `
## S11 notes

- Unsupported: HV battery/charger SoH condition-monitoring tests (teaching/practice/assessment).
- Rejected: EV awareness PPTs; CEA locate/isolate; GW1 12V battery work; borrowing S13/K23.
`;
}
fs.writeFileSync(qbLog, t);
console.log("Recorded S11 APPROVE KEEP GAP");
