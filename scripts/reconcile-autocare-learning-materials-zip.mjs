/**
 * Reconcile ZIP inventory against catalogue-resources.json and controlled DB resources.
 * Read-only. Does not attach files to Sessions.
 */
import fs from "fs";
import path from "path";

const INV = path.resolve(".tmp/source-pack-inventory/zip-inventory.json");
const DB = path.resolve(".tmp/source-pack-inventory/controlled-resources.json");
const CATALOGUE = path.resolve(
  "tests/artifacts/autocare-v1/evidence-enriched/staging/catalogue-resources.json",
);
const OUT = path.resolve(".tmp/source-pack-inventory/reconciliation.json");

const zip = JSON.parse(fs.readFileSync(INV, "utf8"));
const db = JSON.parse(fs.readFileSync(DB, "utf8"));
const catalogue = JSON.parse(fs.readFileSync(CATALOGUE, "utf8"));

const zipFiles = zip.files || [];
const dbResources = db.resources || [];
const catByHash = new Map();
const catByName = new Map();
for (const row of catalogue) {
  if (row.contentHashSha256) catByHash.set(row.contentHashSha256, row);
  const key = String(row.sourceFilename || "").toLowerCase();
  if (!catByName.has(key)) catByName.set(key, []);
  catByName.get(key).push(row);
}

const dbByKey = new Map(dbResources.map((r) => [r.resource_key, r]));
const dbByFilename = new Map();
for (const r of dbResources) {
  const key = String(r.filename || "").toLowerCase();
  if (!dbByFilename.has(key)) dbByFilename.set(key, []);
  dbByFilename.get(key).push(r);
}

function classify(file) {
  const name = String(file.filename || "").toLowerCase();
  const cat = catByHash.get(file.sha256);
  const dbExact = (dbByFilename.get(name) || []).find(
    (r) =>
      String(r.source_path || "").replace(/\\/g, "/").toLowerCase().endsWith(
        String(file.path || "").replace(/\\/g, "/").toLowerCase().split("/").slice(-3).join("/"),
      ) ||
      String(r.source_path || "").replace(/\\/g, "/").toLowerCase().includes(
        name,
      ),
  );
  const dbNameHits = dbByFilename.get(name) || [];
  const catNameHits = catByName.get(name) || [];

  if (cat && dbByKey.has(cat.id)) {
    const resource = dbByKey.get(cat.id);
    return {
      class: "MATCHED_HIGH",
      reason: "ZIP sha256 matches catalogue evidence id that is already a controlled resource_key",
      catalogueId: cat.id,
      resourceId: resource.id,
      resourceKey: resource.resource_key,
      versionReview: "SAME",
    };
  }
  if (cat && dbNameHits.length === 1 && dbNameHits[0].evidence_resource_id === cat.id) {
    return {
      class: "MATCHED_HIGH",
      reason: "ZIP sha256 + evidence_resource_id match",
      catalogueId: cat.id,
      resourceId: dbNameHits[0].id,
      resourceKey: dbNameHits[0].resource_key,
      versionReview: "SAME",
    };
  }
  if (dbNameHits.length && cat && dbNameHits.some((r) => r.resource_key === cat.id)) {
    const resource = dbNameHits.find((r) => r.resource_key === cat.id);
    return {
      class: "MATCHED_HIGH",
      reason: "filename + catalogue hash + resource_key",
      catalogueId: cat.id,
      resourceId: resource.id,
      resourceKey: resource.resource_key,
      versionReview: "SAME",
    };
  }
  if (dbExact && cat && dbExact.resource_key === cat.id) {
    return {
      class: "MATCHED_HIGH",
      reason: "source path + catalogue hash",
      catalogueId: cat.id,
      resourceId: dbExact.id,
      resourceKey: dbExact.resource_key,
      versionReview: "SAME",
    };
  }
  if (dbNameHits.length && !cat) {
    const expected = catNameHits[0]?.contentHashSha256 || null;
    return {
      class: "MATCHED_MEDIUM",
      reason: "filename matches a controlled resource but ZIP hash is not in catalogue (possible version)",
      resourceId: dbNameHits[0].id,
      resourceKey: dbNameHits[0].resource_key,
      catalogueId: catNameHits[0]?.id || null,
      expectedHash: expected,
      versionReview: expected && expected !== file.sha256 ? "UNRESOLVED_VERSION" : "UNRESOLVED_VERSION",
    };
  }
  if (cat && !dbByKey.has(cat.id)) {
    return {
      class: "NEW_RESOURCE",
      reason: "Known in evidence catalogue by hash, not a controlled programme resource. Not auto-placed.",
      catalogueId: cat.id,
      versionReview: "SAME",
    };
  }
  if (catNameHits.length && !cat) {
    const hashes = [...new Set(catNameHits.map((c) => c.contentHashSha256))];
    return {
      class: hashes.length > 1 ? "UNRESOLVED" : "MATCHED_LOW",
      reason:
        hashes.length > 1
          ? "Filename exists in catalogue with different hashes; this ZIP hash is new/unlisted"
          : "Filename matches catalogue but hash differs — version conflict, not auto-placed",
      catalogueIds: catNameHits.map((c) => c.id),
      catalogueHashes: hashes,
      versionReview: "UNRESOLVED_VERSION",
    };
  }
  return {
    class: "NEW_RESOURCE",
    reason: "Not in controlled catalogue and not a hash-matched evidence record",
    versionReview: "UNRESOLVED_VERSION",
  };
}

const classified = zipFiles.map((f) => ({ ...f, ...classify(f) }));
const byClass = {};
for (const row of classified) {
  byClass[row.class] = (byClass[row.class] || 0) + 1;
}

const hybrid = classified.filter((f) =>
  /features of hybrid vehicles\.ppt$/i.test(f.filename),
);

const groups = (zip.groups || []).map((g) => {
  const rows = classified.filter((f) => f.sourceGroupCode === g.code);
  const counts = {};
  for (const r of rows) counts[r.class] = (counts[r.class] || 0) + 1;
  return { ...g, classes: counts };
});

const report = {
  zipEntryCount: zipFiles.length,
  classCounts: byClass,
  groups,
  duplicateFilenames: zip.duplicateFilenames,
  duplicateBinaries: zip.duplicateBinaries,
  hybrid,
  highMatches: classified.filter((f) => f.class === "MATCHED_HIGH"),
  medium: classified.filter((f) => f.class === "MATCHED_MEDIUM"),
  low: classified.filter((f) => f.class === "MATCHED_LOW"),
  unresolved: classified.filter((f) => f.class === "UNRESOLVED"),
  newResources: classified.filter((f) => f.class === "NEW_RESOURCE"),
  classified,
};

fs.writeFileSync(OUT, JSON.stringify(report, null, 2));
console.log(
  JSON.stringify(
    {
      ok: true,
      classCounts: byClass,
      hybrid,
      highMatches: report.highMatches.map((f) => ({
        path: f.path,
        sha256: f.sha256,
        resourceKey: f.resourceKey,
        resourceId: f.resourceId,
      })),
      mediumCount: report.medium.length,
      lowCount: report.low.length,
      unresolvedCount: report.unresolved.length,
      newCount: report.newResources.length,
      duplicateFilenames: zip.duplicateFilenames,
      out: OUT,
    },
    null,
    2,
  ),
);
