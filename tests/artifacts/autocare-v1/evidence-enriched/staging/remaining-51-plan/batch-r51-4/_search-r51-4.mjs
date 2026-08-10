import fs from "node:fs";
import path from "node:path";

const cat = JSON.parse(
  fs.readFileSync("docs/standards/st0499/st0499-ksb-catalog.json", "utf8"),
);
const v13 = cat.versions.find((v) => v.occupationVersion === "1.3");
const codes = ["K9", "K14", "K15", "K16", "K17", "K19", "S4", "S8", "S14"];
for (const c of codes) {
  const k = v13.ksbs.find((x) => x.code === c);
  console.log("---" + c + "|" + k.kind);
  console.log(k.statement);
}

const t = fs.readFileSync(
  "src/features/programme-definition/domain/curriculum-analysis/golden-eval.ts",
  "utf8",
);
const gapSec = t.slice(
  t.indexOf("GOLDEN_GAPS"),
  t.indexOf("GOLDEN_DISTRIBUTED"),
);
for (const c of codes) {
  const re = new RegExp(
    String.raw`\{\s*ksbCode:\s*"${c}",\s*blockNumber:\s*(\d+)\s*\}`,
  );
  const m = t.match(re);
  const gap = gapSec.includes(`"${c}"`);
  console.log("GA", c, m ? "PRIMARY_B" + m[1] : gap ? "GAP" : "?");
}

const staging = "tests/artifacts/autocare-v1/evidence-enriched/staging";
const resources = JSON.parse(
  fs.readFileSync(path.join(staging, "catalogue-resources.json"), "utf8"),
);
const cea = JSON.parse(
  fs.readFileSync(path.join(staging, "cea-catalogue/cea-resources.json"), "utf8"),
);
const gw = JSON.parse(
  fs.readFileSync(
    path.join(staging, "gateway-catalogue/gateway-resources.json"),
    "utf8",
  ),
);
const catRes = Array.isArray(resources) ? resources : resources.resources;
const ceaRes = Array.isArray(cea) ? cea : cea.resources;
const gwRes = Array.isArray(gw) ? gw : gw.resources;

function hay(r) {
  return [
    r.excerpt,
    r.sourceFilename,
    r.relativePath,
    r.filename,
    r.textPreview,
    JSON.stringify(r.fields || {}),
  ]
    .filter(Boolean)
    .join("\n")
    .toLowerCase();
}

function search(pool, patterns, limit = 14) {
  const hits = [];
  for (const r of pool) {
    const h = hay(r);
    const matched = patterns.filter((p) =>
      typeof p === "string" ? h.includes(p.toLowerCase()) : p.test(h),
    );
    if (!matched.length) continue;
    hits.push({
      id: r.id,
      file: (r.sourceFilename || r.filename || "").slice(0, 90),
      group: r.groupAssociation?.groupCode || r.structure?.groupCode || null,
      block: r.blockAssociationExplicit?.blockNumber ?? null,
      week: r.weekSessionExplicit?.week ?? null,
      matched: matched.map(String).slice(0, 6),
      excerpt: (r.excerpt || r.textPreview || "").slice(0, 520),
      extract: r.extractionStatus || null,
    });
    if (hits.length >= limit) break;
  }
  return hits;
}

const queries = {
  K9: [
    "steering",
    "suspension",
    "tyre legislation",
    "sidewall",
    "homologat",
    "tpms",
    "eu tyre",
  ],
  K14: [
    "braking systems",
    "hydraulic",
    "brake pad",
    "brake disc",
    "abs",
    "electronic parking",
  ],
  K15: [
    "starting and charging",
    "alternator",
    "starter motor",
    "charging system",
    "battery and charging",
  ],
  K16: [
    "battery",
    "starting system",
    "charging system",
    "state of charge",
    "state of health",
  ],
  K17: [
    "adas",
    "static and dynamic",
    "calibration",
    "adas calibration",
    "driver-assistance",
  ],
  K19: [
    "four-wheel geometry",
    "ackermann",
    "camber",
    "thrust angle",
    "toe",
    "wheel alignment",
  ],
  S4: [
    "store, maintain",
    "return tools",
    "calibration checks",
    "tool storage",
    "return tools and equipment",
  ],
  S8: [
    "remove and replace",
    "wheels and tyres",
    "balance",
    "tyre repair",
    "run-flat",
  ],
  S14: [
    "record vehicle service",
    "parts replacement",
    "repair record",
    "job card",
    "service maintenance",
  ],
};

// Refine K9 - need official wording first from print above; search will be refined after
const out = {};
for (const [ksb, pats] of Object.entries(queries)) {
  out[ksb] = {
    catalogue: search(catRes, pats, 14),
    cea: search(ceaRes, pats, 8),
    gateway: search(gwRes, pats, 6),
  };
}

const dir = path.join(staging, "remaining-51-plan/batch-r51-4");
fs.mkdirSync(dir, { recursive: true });
fs.writeFileSync(path.join(dir, "_search-hits.json"), JSON.stringify(out, null, 2));
for (const [ksb, v] of Object.entries(out)) {
  console.log(ksb, "cat", v.catalogue.length, "cea", v.cea.length, "gw", v.gateway.length);
}
