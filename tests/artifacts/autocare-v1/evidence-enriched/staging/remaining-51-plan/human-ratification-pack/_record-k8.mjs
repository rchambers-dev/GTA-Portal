import fs from 'fs';
import path from 'path';

const pack =
  'tests/artifacts/autocare-v1/evidence-enriched/staging/remaining-51-plan/human-ratification-pack';
const cardsPath = path.join(pack, 'cards-64.json');
const cards = JSON.parse(fs.readFileSync(cardsPath, 'utf8'));
const c = cards.cards.find((x) => x.code === 'K8');
c.humanDecision = 'HOLD_FOR_EVIDENCE';
c.humanDecisionNotes =
  "Human hold 2026-08-10: leave CHANGE CLASSIFICATION TO PARTIAL unresolved pending ER-16 (Vehicle Service History.ppt extract + owner's manuals teaching). Could materially change component coverage.";
c.humanDecisionAt = '2026-08-10';
c.humanDecisionQueue = 'A';
c.linkedEvidenceRequests = ['ER-16'];
c.unresolved = true;
fs.writeFileSync(cardsPath, JSON.stringify(cards, null, 2) + '\n');

const logPath = path.join(pack, 'DECISIONS-LOG.json');
const log = JSON.parse(fs.readFileSync(logPath, 'utf8'));
log.decisions = log.decisions.filter((d) => d.code !== 'K8');
log.decisions.push({
  code: 'K8',
  queue: 'A',
  decision: 'HOLD_FOR_EVIDENCE',
  decidedAt: '2026-08-10',
  proposedDirectionBucket: 'CHANGE_CLASSIFICATION',
  shadowPosition: 'CHANGE_CLASSIFICATION_TO_PARTIAL',
  goldenAPosition: c.goldenAPosition,
  rationale: c.humanDecisionNotes,
  amendedPosition: null,
  linkedEvidenceRequests: ['ER-16'],
  unresolved: true
});
log.lastUpdated = '2026-08-10';
fs.writeFileSync(logPath, JSON.stringify(log, null, 2) + '\n');

const mdPath = path.join(pack, 'QUEUE-A-DECISIONS.md');
let lines = fs.readFileSync(mdPath, 'utf8').split(/\r?\n/);
lines = lines.filter((line) => !line.startsWith('| K8 |'));
while (lines.length && lines[lines.length - 1] === '') lines.pop();
lines.push(
  "| K8 | HOLD FOR EVIDENCE | — | ER-16 | Unresolved pending Service History.ppt + owner's manuals | 2026-08-10 |"
);
lines.push('');
fs.writeFileSync(mdPath, lines.join('\n'));
console.log('Recorded K8 HOLD_FOR_EVIDENCE -> ER-16');
