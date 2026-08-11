import fs from "fs";
import path from "path";

const pack =
  "tests/artifacts/autocare-v1/evidence-enriched/staging/remaining-51-plan/human-ratification-pack";
const today = "2026-08-10";
const code = "K28";
const erIds = ["ER-02"];
const notes =
  "Queue B 2026-08-10 (4/9): APPROVE KEEP GAP. Named FCA/PCI requirements not found in richer corpus. G8 LP29 payments/VAT/GDPR/fraud rejected as adjacency (payments≠FCA/PCI). Commercial quotation sessions lack FCA/PCI language. Type B on supplied curriculum. ER-02 remains onboarding auto-request. Do not force Primary.";

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
    "Supplied curriculum teaches adjacent payments/VAT/GDPR/fraud, not FCA/PCI financial-compliance principles required by K28.",
  rejectedFalsePositives: [
    "G8 LP29 Payments, VAT, GDPR and Fraud as proof of FCA/PCI",
  ],
  futureProgrammeBuilderAction:
    "Auto-request dedicated FCA/PCI teaching (ER-02). Do not map Primary from sales/payments adjacency alone.",
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
const er = ers.requests.find((r) => r.id === "ER-02");
er.portalDesign = {
  shouldAutoRequestDuringOnboardingOrSourceSufficiency: true,
  evidenceClass: "MISSING_NAMED_REGULATORY_COMPLIANCE_TEACHING",
  axis: ["teaching"],
  reason:
    "KEEP GAP approved: payments/VAT/GDPR adjacency must not satisfy FCA/PCI. Auto-request named FCA/PCI materials during source-sufficiency.",
};
ers.lastUpdated = today;
fs.writeFileSync(erPath, JSON.stringify(ers, null, 2) + "\n");

const qbPath = path.join(pack, "QUEUE-B-DECISIONS.md");
let qb = fs.readFileSync(qbPath, "utf8").split(/\r?\n/);
qb = qb.filter((line) => !line.startsWith("| K28 |"));
while (qb.length && qb[qb.length - 1] === "") qb.pop();
qb.push(
  "| K28 | APPROVE KEEP GAP | — | ER-02 | Type B; payments/VAT/GDPR adjacency rejected | 2026-08-10 |",
);
qb.push("");
fs.writeFileSync(qbPath, qb.join("\n"));

const qbLog = path.join(pack, "QUEUE-B-RESOLUTION-LOG.md");
let t = fs.readFileSync(qbLog, "utf8");
t = t.replace(
  "| 4/9 | K28 | _pending_ | — | — | — | — |",
  "| 4/9 | K28 | APPROVE KEEP GAP | ER-02 | B | YES | 2026-08-10 |",
);
if (!t.includes("## K28 notes")) {
  t += `
## K28 notes

- Official unsupported: FCA and PCI requirements.
- Rejected: G8 payments/VAT/GDPR/fraud adjacency; commercial quotation LPs without FCA/PCI text.
- Tranche-2 LP scan: zero FCA / Financial Conduct / PCI hits.
`;
}
fs.writeFileSync(qbLog, t);
console.log("Recorded K28 APPROVE KEEP GAP");
