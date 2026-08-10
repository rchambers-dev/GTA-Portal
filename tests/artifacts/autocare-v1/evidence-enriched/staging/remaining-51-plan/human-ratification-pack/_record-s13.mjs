import fs from 'fs';
import path from 'path';

const pack =
  'tests/artifacts/autocare-v1/evidence-enriched/staging/remaining-51-plan/human-ratification-pack';
const cardsPath = path.join(pack, 'cards-64.json');
const cards = JSON.parse(fs.readFileSync(cardsPath, 'utf8'));
const c = cards.cards.find((x) => x.code === 'S13');
c.humanDecision = 'HOLD_FOR_EVIDENCE';
c.humanDecisionNotes =
  'Human hold 2026-08-10: leave REVIEW unresolved pending ER-04 (HV isolation competence evidence — learner-performed / assessed). Structural ownership remains CLEAR @ B6 and is not remapped; rules teaching must not be credited as S13 competence until assessed isolation artefact reviewed.';
c.humanDecisionAt = '2026-08-10';
c.humanDecisionQueue = 'A';
c.linkedEvidenceRequests = ['ER-04'];
c.unresolved = true;
fs.writeFileSync(cardsPath, JSON.stringify(cards, null, 2) + '\n');

const logPath = path.join(pack, 'DECISIONS-LOG.json');
const log = JSON.parse(fs.readFileSync(logPath, 'utf8'));
log.decisions = log.decisions.filter((d) => d.code !== 'S13');
log.decisions.push({
  code: 'S13',
  queue: 'A',
  decision: 'HOLD_FOR_EVIDENCE',
  decidedAt: '2026-08-10',
  proposedDirectionBucket: 'REVIEW',
  shadowPosition: 'REVIEW',
  goldenAPosition: c.goldenAPosition,
  rationale: c.humanDecisionNotes,
  amendedPosition: null,
  linkedEvidenceRequests: ['ER-04'],
  unresolved: true
});
log.lastUpdated = '2026-08-10';
fs.writeFileSync(logPath, JSON.stringify(log, null, 2) + '\n');

const mdPath = path.join(pack, 'QUEUE-A-DECISIONS.md');
let lines = fs.readFileSync(mdPath, 'utf8').split(/\r?\n/);
lines = lines.filter((line) => !line.startsWith('| S13 |'));
while (lines.length && lines[lines.length - 1] === '') lines.pop();
lines.push(
  '| S13 | HOLD FOR EVIDENCE | — | ER-04 | Unresolved pending assessed HV isolation competence | 2026-08-10 |'
);
lines.push('');
fs.writeFileSync(mdPath, lines.join('\n'));
console.log('Recorded S13 HOLD_FOR_EVIDENCE -> ER-04');
