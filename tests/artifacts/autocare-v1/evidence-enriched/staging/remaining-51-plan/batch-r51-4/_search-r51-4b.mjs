import fs from "node:fs";
import path from "node:path";

const staging = "tests/artifacts/autocare-v1/evidence-enriched/staging";
const catRes = JSON.parse(
  fs.readFileSync(path.join(staging, "catalogue-resources.json"), "utf8"),
);
const resources = Array.isArray(catRes) ? catRes : catRes.resources;
const cea = JSON.parse(
  fs.readFileSync(path.join(staging, "cea-catalogue/cea-resources.json"), "utf8"),
);
const ceaRes = Array.isArray(cea) ? cea : cea.resources;
const gw = JSON.parse(
  fs.readFileSync(
    path.join(staging, "gateway-catalogue/gateway-resources.json"),
    "utf8",
  ),
);
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

function search(pool, patterns, limit = 16) {
  const hits = [];
  for (const r of pool) {
    const h = hay(r);
    const matched = patterns.filter((p) =>
      typeof p === "string" ? h.includes(p.toLowerCase()) : p.test(h),
    );
    if (!matched.length) continue;
    hits.push({
      id: r.id,
      file: (r.sourceFilename || r.filename || "").slice(0, 95),
      group: r.groupAssociation?.groupCode || r.structure?.groupCode || null,
      block: r.blockAssociationExplicit?.blockNumber ?? null,
      week: r.weekSessionExplicit?.week ?? null,
      matched: matched.map(String).slice(0, 8),
      excerpt: (r.excerpt || r.textPreview || "").slice(0, 580),
      extract: r.extractionStatus || null,
    });
    if (hits.length >= limit) break;
  }
  return hits;
}

const queries = {
  K9: [
    "tyre legislation",
    "eu tyre",
    "sidewall",
    "homologat",
    "tpms",
    "tyre labelling",
    "tyre labeling",
    "tyre repair",
    "run-flat",
    "tyre pressure monitoring",
  ],
  K14: [
    "air conditioning",
    "hvac",
    "climate control",
    "refrigerant",
    "blower motor",
    "heat exchanger",
    "heating and ventilation",
    "fluorinated",
  ],
  K15: [
    "starting and charging",
    "alternator",
    "starter motor",
    "auxiliary battery",
    "e-machine",
    "low voltage batter",
    "charging systems",
  ],
  K16: [
    "replace battery",
    "battery replacement",
    "starter motor",
    "alternator",
    "charging system",
    "starting system",
    "battery and charging",
  ],
  K17: [
    "static and dynamic",
    "adas calibration",
    "calibration methods",
    "calibration equipment",
    "pre-calibration",
    "adas",
  ],
  K19: [
    "ackermann",
    "thrust angle",
    "camber",
    "four-wheel geometry",
    "alignment principles",
    "steering geometry",
    "toe ",
  ],
  S4: [
    "return tools",
    "tool storage",
    "store",
    "calibration checks",
    "equipment to storage",
    "removed from use",
    "pre-use inspection",
  ],
  S8: [
    "diagnostic equipment",
    "measuring tools",
    "select and use tools",
    "multimeter",
    "mechanical and electrical measuring",
    "diagnostic",
    "torque wrench",
  ],
  S14: [
    "job card",
    "record vehicle",
    "service record",
    "documentation",
    "apprentice assessment record",
    "record findings",
  ],
};

const out = {};
for (const [ksb, pats] of Object.entries(queries)) {
  out[ksb] = {
    catalogue: search(resources, pats, 16),
    cea: search(ceaRes, pats, 10),
    gateway: search(gwRes, pats, 6),
  };
}

// Group indexes for key systems
out._groups = {};
for (const g of ["G3", "G4", "G5", "G6", "G7", "G11", "G13", "G14"]) {
  out._groups[g] = resources
    .filter((r) => r.groupAssociation?.groupCode === g)
    .map((r) => ({
      id: r.id,
      file: r.sourceFilename,
      extract: r.extractionStatus,
      excerpt: (r.excerpt || "").slice(0, 200),
    }));
}

const dir = path.join(staging, "remaining-51-plan/batch-r51-4");
fs.writeFileSync(path.join(dir, "_search-hits.json"), JSON.stringify(out, null, 2));
for (const [ksb, v] of Object.entries(out)) {
  if (ksb.startsWith("_")) continue;
  console.log(ksb, "cat", v.catalogue.length, "cea", v.cea.length, "gw", v.gateway.length);
}
for (const [g, arr] of Object.entries(out._groups)) {
  console.log(g, arr.length, "resources");
}
