import fs from "fs";
import path from "path";

const pack =
  "tests/artifacts/autocare-v1/evidence-enriched/staging/remaining-51-plan/human-ratification-pack";
const today = "2026-08-10";

// Freeze note for Queue A HOLD pass
const holdPath = path.join(pack, "HOLD-RESOLUTION-LOG.md");
let hold = fs.readFileSync(holdPath, "utf8");
if (!hold.includes("FROZEN as human-reviewed staging")) {
  hold =
    hold.replace(
      "**Status:** Staging only — does not mutate Golden A / Primaries / OTJ / programme truth.",
      "**Status:** FROZEN as human-reviewed staging (Queue A HOLD-resolution complete). Does not mutate Golden A / Primaries / OTJ / programme truth.",
    ) +
    "\n\n**Checkpoint:** Queue A HOLD-resolution frozen before Queue B start.\n";
  fs.writeFileSync(holdPath, hold);
}

const cardsPath = path.join(pack, "cards-64.json");
const cards = JSON.parse(fs.readFileSync(cardsPath, "utf8"));
const c = cards.cards.find((x) => x.code === "B3");
c.humanDecision = "APPROVE";
c.humanDecisionNotes =
  "Queue B 2026-08-10 (1/9): APPROVE KEEP GAP. Richer corpus still shows no deliberate adapt-to-demand behaviour teaching. Reject false-positive 'adaptive suspension'. Golden A Primary B6 not supported as teaching home — do not force Primary. Conclusion type B on supplied curriculum; ER-23 remains open source-sufficiency auto-request (could overturn if deliberate materials/observations appear).";
c.humanDecisionAt = today;
c.humanDecisionQueue = "B";
c.linkedEvidenceRequests = ["ER-23"];
c.unresolved = false;
c.gapProductClassification = {
  conclusionType: "B_GENUINE_UNSUPPORTED_ON_SUPPLIED_CURRICULUM",
  meaning:
    "The supplied curriculum appears genuinely not to teach/practise/assess this requirement deliberately.",
  notTypeA:
    "Not merely 'you have not supplied enough evidence to verify' — searches found adjacency/false positives only.",
  futureProgrammeBuilderAction:
    "During onboarding/source-sufficiency, auto-request deliberate B3 behaviour teaching and observed-adaptability evidence (ER-23). Do not invent a Primary while gap stands.",
};
fs.writeFileSync(cardsPath, JSON.stringify(cards, null, 2) + "\n");

const logPath = path.join(pack, "DECISIONS-LOG.json");
const log = JSON.parse(fs.readFileSync(logPath, "utf8"));
log.decisions = log.decisions.filter((d) => !(d.code === "B3" && d.queue === "B"));
log.decisions.push({
  code: "B3",
  queue: "B",
  decision: "APPROVE",
  decidedAt: today,
  proposedDirectionBucket: "KEEP_GAP",
  shadowPosition: "KEEP_GAP",
  goldenAPosition: c.goldenAPosition,
  rationale: c.humanDecisionNotes,
  amendedPosition: null,
  linkedEvidenceRequests: ["ER-23"],
  unresolved: false,
  gapProductClassification: c.gapProductClassification,
});
if (!log.queueBPass) {
  log.queueBPass = {
    status: "IN_PROGRESS",
    startedAt: today,
    scope: "Queue B KEEP GAP cases only (9)",
    order: ["B3", "B5", "K1", "K28", "K30", "K31", "S11", "S19", "S20"],
    completed: [],
  };
}
if (!log.queueBPass.completed.includes("B3")) log.queueBPass.completed.push("B3");
log.lastUpdated = today;
fs.writeFileSync(logPath, JSON.stringify(log, null, 2) + "\n");

const erPath = path.join(pack, "evidence-requests.json");
const ers = JSON.parse(fs.readFileSync(erPath, "utf8"));
const er = ers.requests.find((r) => r.id === "ER-23");
er.portalDesign = {
  shouldAutoRequestDuringOnboardingOrSourceSufficiency: true,
  evidenceClass: "MISSING_DELIBERATE_BEHAVIOUR_TEACHING_OR_OBSERVATION",
  axis: ["teaching", "practice", "workplaceApplication"],
  reason:
    "KEEP GAP approved on supplied corpus; still auto-request any deliberate adapt-to-demand behaviour LP / observation packs during apprenticeship source-sufficiency.",
};
ers.lastUpdated = today;
fs.writeFileSync(erPath, JSON.stringify(ers, null, 2) + "\n");

// QUEUE-B decisions md
const qbPath = path.join(pack, "QUEUE-B-DECISIONS.md");
if (!fs.existsSync(qbPath)) {
  fs.writeFileSync(
    qbPath,
    `# Queue B Decisions

**Status:** Human ratification staging only — not programme truth.

| KSB | Decision | Amended position | Linked evidence | Notes | When |
|---|---|---|---|---|---|
`,
  );
}
let qb = fs.readFileSync(qbPath, "utf8").split(/\r?\n/);
qb = qb.filter((line) => !line.startsWith("| B3 |"));
while (qb.length && qb[qb.length - 1] === "") qb.pop();
qb.push(
  "| B3 | APPROVE KEEP GAP | — | ER-23 | Type B genuine unsupported on supplied corpus; auto-request ER-23 | 2026-08-10 |",
);
qb.push("");
fs.writeFileSync(qbPath, qb.join("\n"));

// Update QUEUE-B-KEEP-GAP.md decision line for B3
const qbg = path.join(pack, "QUEUE-B-KEEP-GAP.md");
let md = fs.readFileSync(qbg, "utf8");
md = md.replace(
  /(## B3 \(behaviours\)[\s\S]*?\| S Human decision \| )_APPROVE \/ AMEND \/ HOLD FOR EVIDENCE_/,
  "$1**APPROVE KEEP GAP**",
);
md = md.replace(
  /(## B3 \(behaviours\)[\s\S]*?\*\*Decision notes \(human\):\*\*\n\n>)(\s*)(\n\n---)/,
  `$1 APPROVE KEEP GAP 2026-08-10. Type B on supplied curriculum. ER-23 open as onboarding auto-request. Do not force Primary. Reject adaptive-suspension false positive.$3`,
);
fs.writeFileSync(qbg, md);

const qbLog = path.join(pack, "QUEUE-B-RESOLUTION-LOG.md");
fs.writeFileSync(
  qbLog,
  `# Queue B Resolution Pass

**Status:** Staging only — does not mutate Golden A / Primaries / OTJ / programme truth.

**Scope:** 9 KEEP GAP cases from \`queues.json\` / \`QUEUE-B-KEEP-GAP.md\`.

| # | KSB | Decision | Linked ER | Type A/B | Portal auto-request | When |
|---|---|---|---|---|---|---|
| 1/9 | B3 | APPROVE KEEP GAP | ER-23 | B — genuine unsupported on supplied curriculum | YES | 2026-08-10 |
| 2/9 | B5 | _pending_ | — | — | — | — |
| 3/9 | K1 | _pending_ | — | — | — | — |
| 4/9 | K28 | _pending_ | — | — | — | — |
| 5/9 | K30 | _pending_ | — | — | — | — |
| 6/9 | K31 | _pending_ | — | — | — | — |
| 7/9 | S11 | _pending_ | — | — | — | — |
| 8/9 | S19 | _pending_ | — | — | — | — |
| 9/9 | S20 | _pending_ | — | — | — | — |

## B3 notes

- Official component unsupported: deliberate respond/adapt to changing work demands behaviour.
- Checked/rejected: W62 adjacency; G11 adaptive suspension (false positive); inferred workshop prioritisation; LIR/SPR mechanism without explicit B3 teaching; filled mentor examples not supplied.
- Golden A Primary B6 not preserved merely because Golden A.
`,
);

console.log("Recorded B3 APPROVE KEEP GAP");
