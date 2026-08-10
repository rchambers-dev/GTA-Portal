import fs from 'fs';
import path from 'path';

const root = 'tests/artifacts/autocare-v1/evidence-enriched/staging';
const cat = JSON.parse(fs.readFileSync(path.join(root, 'catalogue-resources.json'), 'utf8'));
const resources = Array.isArray(cat) ? cat : cat.resources;

const needles = [
  /Fuel Cells/i,
  /hydrogen/i,
  /LESSON PLAN\s*25/i,
  /LESSON PLAN\s*26/i,
  /LESSON PLAN\s*27/i,
  /LESSON PLAN\s*28/i,
  /LESSON PLAN\s*29/i,
  /Task Sheet/i,
  /customer service/i,
  /sales package/i,
  /stock/i,
  /Week_029|Week_028|Week_038|Week_062|Week_075|Week_080|Week_081|Week_019|Week_018/i,
  /FS06|FS09|FS10/i,
  /Learning_Impact|Skills_Progress|Learning Impact|Skills Progress/i,
  /Block_2_Task|Block_3_Task|Block_8_Task|Block_10_/i,
  /challenging|complaint|features and benefit|consultative|procurement|quotation|teamwork|adapt|CPD|professional development|ethical|competitiveness|efficiency/i
];

const hits = [];
for (const r of resources) {
  const f = `${r.sourceFilename || ''} ${r.relativePath || ''}`;
  const ex = r.excerpt || '';
  if (!needles.some((n) => n.test(f) || n.test(ex))) continue;
  // keep only useful ones
  if (
    /Fuel Cells|hydrogen|LESSON PLAN\s*2[5-9]|Task Sheet|customer service|sales|stock|Week_0(18|19|28|29|38|62)|Week_08[01]|FS0[69]|FS10|Learning_Impact|Skills_Progress|Block_[238]_Task|Block_10_|challenging|complaint|features|consultative|procurement|quotation|teamwork|adapt|CPD|professional development|ethical|competitiveness|efficiency|handover|job card|environmental/i.test(
      f + ' ' + ex
    )
  ) {
    hits.push({
      id: r.id,
      file: (r.sourceFilename || '').split('/').pop(),
      group: (r.groupAssociation && r.groupAssociation.groupCode) || null,
      block: r.blockNumber ?? null,
      week: r.weekNumber ?? null,
      excerpt: ex.replace(/\s+/g, ' ').slice(0, 520)
    });
  }
}

// Deduplicate by id and print targeted
const byId = new Map(hits.map((h) => [h.id, h]));
const list = [...byId.values()];

function show(re, label) {
  console.log('\n==== ' + label);
  for (const h of list.filter((x) => re.test(x.file + ' ' + x.excerpt))) {
    console.log('-', h.id, '|', h.group || '', 'B' + (h.block ?? '?'), 'W' + (h.week ?? '?'), '|', h.file);
    console.log(' ', h.excerpt.slice(0, 380));
  }
}

show(/Fuel Cells|hydrogen/i, 'K22 hydrogen');
show(/LESSON PLAN\s*25|LESSON PLAN\s*26|customer service legislation|challenging|complaint/i, 'K24 customer');
show(/LESSON PLAN\s*27|sales package|features and benefit|consultative|LESSON PLAN\s*28|LESSON PLAN\s*29|sales process/i, 'K29/S18 sales');
show(/stock|Task Sheet|Week_029|procurement|quotation|Week_038|parts/i, 'K26/K27/S17 stock parts');
show(/FS06|teamwork|team working/i, 'K30/S19 team');
show(/FS10|handover|report writing|job card|written/i, 'S22 written');
show(/Learning_Impact|Skills_Progress|learning and development|CPD|professional development|FS09/i, 'S24/B4 CPD');
show(/environmental|sustainability|spill|waste/i, 'B2 env');
show(/adapt|prioritis|changing|Week_062/i, 'B3 adapt');
show(/ethical|efficiency|competitiveness|business operation|customer satisfaction/i, 'K25 business');
show(/verbal|communication technique|matching style|oral/i, 'K32/S21 verbal');
