import fs from 'fs';
import path from 'path';

const root = 'tests/artifacts/autocare-v1/evidence-enriched/staging';
const cat = JSON.parse(fs.readFileSync(path.join(root, 'catalogue-resources.json'), 'utf8'));
const resources = Array.isArray(cat) ? cat : cat.resources;
let cea = [], gw = [];
try {
  const c = JSON.parse(fs.readFileSync(path.join(root, 'cea-catalogue/cea-resources.json'), 'utf8'));
  cea = Array.isArray(c) ? c : c.resources || [];
} catch {}
try {
  const g = JSON.parse(fs.readFileSync(path.join(root, 'gateway-catalogue/gateway-resources.json'), 'utf8'));
  gw = Array.isArray(g) ? g : g.resources || [];
} catch {}

const queries = {
  K22: ['hydrogen', 'fuel cell', 'fuel cells'],
  K24: ['customer care', 'customer service', 'challenging conversation', 'customer needs', 'complaint', 'handover'],
  K25: ['business operation', 'efficiency', 'customer satisfaction', 'competitiveness', 'ethical', 'minimising risk', 'business'],
  K26: ['parts cost', 'procurement', 'parts pricing', 'quotation', 'parts order', 'costing', 'parts'],
  K27: ['stock management', 'stock storage', 'resource management', 'stock control', 'stock', 'materials'],
  K29: ['sales process', 'features and benefits', 'consultative', 'mini closing', 'closing', 'show and tell', 'sales'],
  K30: ['team working', 'teamwork', 'team work', 'working as a team', 'team'],
  K32: ['verbal communication', 'communication technique', 'matching style', 'giving and receiving', 'verbal'],
  S17: ['stock rotation', 'parts storage', 'ordering', 'stock check', 'parts ordering', 'stock'],
  S18: ['organisational sales', 'features and benefits', 'consultative selling', 'mini closing', 'show and tell', 'selling'],
  S19: ['team working', 'teamwork', 'collaborate', 'team principles'],
  S21: ['communicate verbally', 'verbal communication', 'customer conversation', 'speak to', 'oral'],
  S22: ['communicate in writing', 'written communication', 'email', 'report writing', 'handover', 'job card'],
  S24: ['learning and development', 'cpd', 'record learning', 'skills progress', 'learning impact', 'professional development'],
  B2: ['impact on the environment', 'environmental impact', 'consider the environment', 'sustainability', 'environmental'],
  B3: ['changing work demands', 'adapt to', 'respond and adapt', 'changing demand', 'prioritis'],
  B4: ['continual professional development', 'cpd', 'seek learning', 'learning and development opportunities', 'professional development']
};

function searchList(list, terms, getText) {
  const out = [];
  for (const r of list) {
    const text = getText(r).toLowerCase();
    const matched = terms.filter((t) => text.includes(t.toLowerCase()));
    if (!matched.length) continue;
    out.push({
      id: r.id,
      file: (r.sourceFilename || r.filename || r.relativePath || '').replace(/\\/g, '/'),
      group: (r.groupAssociation && r.groupAssociation.groupCode) || r.group || null,
      block: r.blockNumber ?? r.block ?? null,
      week: r.weekNumber ?? r.week ?? null,
      matched,
      excerpt: (r.excerpt || (r.fields && (r.fields.objectives || []).join(' ')) || '')
        .replace(/\s+/g, ' ')
        .slice(0, 450)
    });
  }
  out.sort((a, b) => b.matched.length - a.matched.length || b.excerpt.length - a.excerpt.length);
  return out.slice(0, 20);
}

const getCat = (r) => `${r.excerpt || ''} ${r.sourceFilename || ''} ${r.relativePath || ''}`;
const getCea = (r) => `${r.filename || ''} ${JSON.stringify(r.fields || {})} ${r.excerpt || ''}`;
const getGw = (r) => `${r.filename || ''} ${r.excerpt || ''} ${JSON.stringify(r.fields || {})}`;

const hits = {};
for (const [code, terms] of Object.entries(queries)) {
  hits[code] = {
    catalogue: searchList(resources, terms, getCat),
    cea: searchList(cea, terms, getCea),
    gateway: searchList(gw, terms, getGw)
  };
}

const outPath = path.join(root, 'remaining-51-plan/batch-r51-5/_search-hits.json');
fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, JSON.stringify(hits, null, 2));

for (const code of Object.keys(queries)) {
  const h = hits[code];
  const top = h.catalogue[0];
  console.log(
    code,
    'cat',
    h.catalogue.length,
    'cea',
    h.cea.length,
    'gw',
    h.gateway.length,
    '|',
    top ? `${top.file.split('/').pop()} :: ${top.matched.slice(0, 4).join(',')}` : 'NONE'
  );
}
