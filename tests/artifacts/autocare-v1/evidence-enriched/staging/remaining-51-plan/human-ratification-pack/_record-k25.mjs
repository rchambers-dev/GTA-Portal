import fs from 'fs';
import path from 'path';

const pack =
  'tests/artifacts/autocare-v1/evidence-enriched/staging/remaining-51-plan/human-ratification-pack';
const cardsPath = path.join(pack, 'cards-64.json');
const cards = JSON.parse(fs.readFileSync(cardsPath, 'utf8'));
const c = cards.cards.find((x) => x.code === 'K25');
c.humanDecision = 'HOLD_FOR_EVIDENCE';
c.humanDecisionNotes =
  'Human hold 2026-08-10: leave CHANGE CLASSIFICATION TO PARTIAL/DISTRIBUTED unresolved pending ER-20 (dedicated business-operations teaching covering efficiency, competitiveness, minimising operational risks). CS/ethics fragments must not be over-credited as full K25.';
c.humanDecisionAt = '2026-08-10';
c.humanDecisionQueue = 'A';
c.linkedEvidenceRequests = ['ER-20'];
c.unresolved = true;
fs.writeFileSync(cardsPath, JSON.stringify(cards, null, 2) + '\n');

const logPath = path.join(pack, 'DECISIONS-LOG.json');
const log = JSON.parse(fs.readFileSync(logPath, 'utf8'));
log.decisions = log.decisions.filter((d) => d.code !== 'K25');
log.decisions.push({
  code: 'K25',
  queue: 'A',
  decision: 'HOLD_FOR_EVIDENCE',
  decidedAt: '2026-08-10',
  proposedDirectionBucket: 'CHANGE_CLASSIFICATION',
  shadowPosition: 'CHANGE_CLASSIFICATION_TO_PARTIAL_DISTRIBUTED',
  goldenAPosition: c.goldenAPosition,
  rationale: c.humanDecisionNotes,
  amendedPosition: null,
  linkedEvidenceRequests: ['ER-20'],
  unresolved: true
});
log.lastUpdated = '2026-08-10';
fs.writeFileSync(logPath, JSON.stringify(log, null, 2) + '\n');

const mdPath = path.join(pack, 'QUEUE-A-DECISIONS.md');
let lines = fs.readFileSync(mdPath, 'utf8').split(/\r?\n/);
lines = lines.filter((line) => !line.startsWith('| K25 |'));
while (lines.length && lines[lines.length - 1] === '') lines.pop();
lines.push(
  '| K25 | HOLD FOR EVIDENCE | — | ER-20 | Unresolved pending dedicated business-operations teaching | 2026-08-10 |'
);
lines.push('');
fs.writeFileSync(mdPath, lines.join('\n'));
console.log('Recorded K25 HOLD_FOR_EVIDENCE -> ER-20');
