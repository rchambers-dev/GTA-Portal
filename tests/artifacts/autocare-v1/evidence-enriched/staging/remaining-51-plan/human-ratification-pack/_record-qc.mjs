import fs from "fs";
import path from "path";

const pack =
  "tests/artifacts/autocare-v1/evidence-enriched/staging/remaining-51-plan/human-ratification-pack";
const today = "2026-08-10";
const code = process.argv[2];
const decision = process.argv[3] || "APPROVE";
const notes = process.argv[4];
const erRaw = process.argv[5] || "";
const productProof = process.argv[6] || "";
const erIds = erRaw
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

if (!code || !notes) {
  console.error("Usage: node _record-qc.mjs CODE DECISION NOTES ER_JSON PRODUCT_PROOF");
  process.exit(1);
}

const cardsPath = path.join(pack, "cards-64.json");
const cards = JSON.parse(fs.readFileSync(cardsPath, "utf8"));
const c = cards.cards.find((x) => x.code === code);
if (!c) throw new Error("missing card " + code);

c.humanDecision = decision;
c.humanDecisionNotes = notes;
c.humanDecisionAt = today;
c.humanDecisionQueue = "C";
c.linkedEvidenceRequests = erIds;
c.unresolved = decision === "HOLD_FOR_EVIDENCE";
c.controlProductProof = {
  proved:
    productProof ||
    "Mapping can KEEP Primary while still carrying residual quality/visibility issues underneath.",
};
fs.writeFileSync(cardsPath, JSON.stringify(cards, null, 2) + "\n");

const logPath = path.join(pack, "DECISIONS-LOG.json");
const log = JSON.parse(fs.readFileSync(logPath, "utf8"));
log.decisions = log.decisions.filter((d) => !(d.code === code && d.queue === "C"));
log.decisions.push({
  code,
  queue: "C",
  decision,
  decidedAt: today,
  proposedDirectionBucket: c.proposedDirectionBucket,
  shadowPosition: c.shadowPosition,
  goldenAPosition: c.goldenAPosition,
  rationale: notes,
  amendedPosition: null,
  linkedEvidenceRequests: erIds,
  unresolved: c.unresolved,
  controlProductProof: c.controlProductProof,
});

if (!log.queueCPass) {
  log.queueCPass = {
    status: "IN_PROGRESS",
    startedAt: today,
    scope: "Queue C KEEP control cases only (23)",
    order: [
      "B1",
      "B2",
      "B4",
      "K3",
      "K4",
      "K5",
      "K6",
      "K11",
      "K12",
      "K14",
      "K19",
      "K21",
      "K22",
      "K23",
      "K24",
      "K33",
      "S5",
      "S6",
      "S8",
      "S12",
      "S15",
      "S16",
      "S22",
    ],
    completed: [],
  };
}
if (!log.queueCPass.completed.includes(code)) log.queueCPass.completed.push(code);
if (log.queueBPass) log.queueBPass.frozenBeforeQueueC = true;
if (log.holdResolutionPass) log.holdResolutionPass.frozenBeforeQueueC = true;
log.lastUpdated = today;
fs.writeFileSync(logPath, JSON.stringify(log, null, 2) + "\n");

const qbPath = path.join(pack, "QUEUE-C-DECISIONS.md");
if (!fs.existsSync(qbPath)) {
  fs.writeFileSync(
    qbPath,
    `# Queue C Decisions

**Status:** Human ratification staging only — not programme truth. Control test.

| KSB | Decision | Amended position | Linked evidence | Notes | When |
|---|---|---|---|---|---|
`,
  );
}
let lines = fs.readFileSync(qbPath, "utf8").split(/\r?\n/);
lines = lines.filter((line) => !line.startsWith(`| ${code} |`));
while (lines.length && lines[lines.length - 1] === "") lines.pop();
const short = notes.length > 120 ? notes.slice(0, 117) + "…" : notes;
lines.push(
  `| ${code} | ${decision === "APPROVE" ? "APPROVE KEEP" : decision} | — | ${erIds.join(", ") || "—"} | ${short.replace(/\|/g, "/")} | ${today} |`,
);
lines.push("");
fs.writeFileSync(qbPath, lines.join("\n"));

const idx = log.queueCPass.order.indexOf(code) + 1;
const qcLog = path.join(pack, "QUEUE-C-RESOLUTION-LOG.md");
if (!fs.existsSync(qcLog)) {
  fs.writeFileSync(
    qcLog,
    `# Queue C Resolution Pass

**Status:** Staging only — control KEEP test. Does not mutate Golden A / Primaries / OTJ / programme truth.

**Queue A + B:** frozen before Queue C.

| # | KSB | Decision | Residual ER | Product proof | When |
|---|---|---|---|---|---|
`,
  );
}
let qc = fs.readFileSync(qcLog, "utf8");
const row = `| ${idx}/23 | ${code} | ${decision === "APPROVE" ? "APPROVE KEEP" : decision} | ${erIds.join(", ") || "—"} | KEEP mapping + residual issues allowed | ${today} |`;
if (!qc.includes(`| ${idx}/23 | ${code} |`)) {
  // append before trailing content or at end of table
  if (qc.includes("| _pending_")) {
    // no-op
  }
  qc = qc.trimEnd() + "\n" + row + "\n";
  fs.writeFileSync(qcLog, qc);
}

console.log(`Recorded Queue C ${code} ${decision} (${idx}/23)`);
