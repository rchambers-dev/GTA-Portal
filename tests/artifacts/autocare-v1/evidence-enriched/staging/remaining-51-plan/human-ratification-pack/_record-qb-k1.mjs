import fs from "fs";
import path from "path";

const pack =
  "tests/artifacts/autocare-v1/evidence-enriched/staging/remaining-51-plan/human-ratification-pack";
const today = "2026-08-10";
const code = "K1";
const erId = "ER-27";
const notes =
  "Queue B 2026-08-10 (3/9): APPROVE KEEP GAP. No dedicated automotive industry / autocare technician role teaching found in richer corpus. W16 duties tags rejected; FS01 adjacency insufficient; FS03 autonomy limits HV-framed only; reporting only partial via FS01/GW. Type B on supplied curriculum. Opened ER-27 for industry/role induction materials. ER-01 (EDI) not used as K1 overturn path.";

const cardsPath = path.join(pack, "cards-64.json");
const cards = JSON.parse(fs.readFileSync(cardsPath, "utf8"));
const c = cards.cards.find((x) => x.code === code);
c.humanDecision = "APPROVE";
c.humanDecisionNotes = notes;
c.humanDecisionAt = today;
c.humanDecisionQueue = "B";
c.linkedEvidenceRequests = [erId];
c.unresolved = false;
c.gapProductClassification = {
  conclusionType: "B_GENUINE_UNSUPPORTED_ON_SUPPLIED_CURRICULUM",
  meaning:
    "Supplied curriculum does not substantively teach industry context or the autocare technician role; autonomy/reporting only partial/framed.",
  unsupportedComponents: [
    "Automotive industry context",
    "Role of the autocare technician",
  ],
  partialButInsufficient: [
    "Limits of autonomy (HV-framed FS03 only)",
    "Reporting channels (workshop/GW fragments only)",
  ],
  futureProgrammeBuilderAction:
    "Auto-request dedicated industry + technician-role induction teaching (ER-27). Do not invent Primary. Do not treat EDI ER-01 as covering K1.",
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
  linkedEvidenceRequests: [erId],
  unresolved: false,
  gapProductClassification: c.gapProductClassification,
});
if (!log.queueBPass.completed.includes(code)) log.queueBPass.completed.push(code);
log.lastUpdated = today;
fs.writeFileSync(logPath, JSON.stringify(log, null, 2) + "\n");

const erPath = path.join(pack, "evidence-requests.json");
const ers = JSON.parse(fs.readFileSync(erPath, "utf8"));
if (!ers.requests.find((r) => r.id === erId)) {
  ers.requests.push({
    id: erId,
    request:
      "Dedicated automotive industry context + autocare technician role teaching (limits of autonomy & reporting channels as whole-role, not HV-only)",
    affects: ["K1"],
    why: "KEEP GAP approved; industry/role components unsupported; FS03/GW fragments insufficient",
    current: "KEEP GAP",
    couldChange: true,
    priority: "HIGH",
    portalDesign: {
      shouldAutoRequestDuringOnboardingOrSourceSufficiency: true,
      evidenceClass: "MISSING_INDUSTRY_AND_ROLE_INDUCTION_TEACHING",
      axis: ["teaching"],
      reason:
        "Official K1 requires industry context and technician role; richer Autocare corpus has none. Auto-request induction/off-pack packs during source-sufficiency.",
    },
    createdDuring: "Queue B K1 ratification 2026-08-10",
  });
}
// Clarify ER-01 no longer counted as K1 overturn
const er01 = ers.requests.find((r) => r.id === "ER-01");
if (er01) {
  er01.affects = er01.affects.filter((a) => a !== "K1");
  er01.affectsNote =
    "K1 removed 2026-08-10 during Queue B — EDI request does not cover industry/role; see ER-27.";
}
ers.lastUpdated = today;
fs.writeFileSync(erPath, JSON.stringify(ers, null, 2) + "\n");

const qbPath = path.join(pack, "QUEUE-B-DECISIONS.md");
let qb = fs.readFileSync(qbPath, "utf8").split(/\r?\n/);
qb = qb.filter((line) => !line.startsWith("| K1 |"));
while (qb.length && qb[qb.length - 1] === "") qb.pop();
qb.push(
  "| K1 | APPROVE KEEP GAP | — | ER-27 | Type B; opened ER-27 industry/role induction; ER-01 unlinked from K1 | 2026-08-10 |",
);
qb.push("");
fs.writeFileSync(qbPath, qb.join("\n"));

const regPath = path.join(pack, "REGISTER-EVIDENCE-REQUESTS.md");
let reg = fs.readFileSync(regPath, "utf8");
if (!reg.includes("ER-27")) {
  reg = reg.replace(
    "| ER-01 | **HIGH** | Named EDI / inclusion teaching materials (not SEND “inclusion” scaffolding) | K1, K31, S20, B5 |",
    "| ER-01 | **HIGH** | Named EDI / inclusion teaching materials (not SEND “inclusion” scaffolding) | K31, S20, B5 |",
  );
  reg += `
| ER-27 | **HIGH** | Dedicated automotive industry + autocare technician role induction teaching (whole-role autonomy/reporting, not HV-only) | K1 | KEEP GAP; industry/role unsupported | KEEP GAP | YES |
`;
  fs.writeFileSync(regPath, reg);
}

const qbLog = path.join(pack, "QUEUE-B-RESOLUTION-LOG.md");
let t = fs.readFileSync(qbLog, "utf8");
t = t.replace(
  "| 3/9 | K1 | _pending_ | — | — | — | — |",
  "| 3/9 | K1 | APPROVE KEEP GAP | ER-27 | B | YES | 2026-08-10 |",
);
if (!t.includes("## K1 notes")) {
  t += `
## K1 notes

- Unsupported: industry context; autocare technician role.
- Insufficient/partial: HV-framed autonomy (FS03); reporting fragments (FS01/GW).
- Rejected: W16 duties tags/intent as teaching proof; FS01 pathway adjacency as full role curriculum.
- Opened ER-27; unlinked EDI ER-01 from K1.
`;
}
fs.writeFileSync(qbLog, t);

console.log("Recorded K1 APPROVE KEEP GAP + ER-27");
