/**
 * Persist ONLY the 15 human-approved Primary mappings.
 * Leaves spine/OTJ/parameters/SOW untouched; does not write gap/proposed KSBs.
 */
import { randomUUID } from "crypto";
import { writeFileSync } from "fs";

const PROGRAMME_VERSION_ID = "231a8a32-d876-4312-a178-960d19dcf938";
const STANDARD_CODE = "ST0499";
const BASE = process.env.PORTAL_BASE_URL || "http://localhost:3000";

const FORBIDDEN = new Set([
  "B5",
  "K1",
  "K2",
  "K7",
  "K13",
  "K18",
  "K20",
  "K31",
  "K34",
  "S7",
  "S11",
  "S20",
  "S23",
  "S25",
]);

/** Exact approved list from human approval */
const APPROVED = [
  { ksbCode: "K12", blockNumber: 2, blockId: "dfdf81db-7ed0-46ba-856a-df0f87b07782" },
  { ksbCode: "K24", blockNumber: 2, blockId: "dfdf81db-7ed0-46ba-856a-df0f87b07782" },
  { ksbCode: "S12", blockNumber: 2, blockId: "dfdf81db-7ed0-46ba-856a-df0f87b07782" },
  { ksbCode: "S15", blockNumber: 2, blockId: "dfdf81db-7ed0-46ba-856a-df0f87b07782" },
  { ksbCode: "K29", blockNumber: 3, blockId: "06873abc-907b-4f07-a360-44afc76d2843" },
  { ksbCode: "K30", blockNumber: 3, blockId: "06873abc-907b-4f07-a360-44afc76d2843" },
  { ksbCode: "S1", blockNumber: 3, blockId: "06873abc-907b-4f07-a360-44afc76d2843" },
  { ksbCode: "S2", blockNumber: 3, blockId: "06873abc-907b-4f07-a360-44afc76d2843" },
  { ksbCode: "S3", blockNumber: 3, blockId: "06873abc-907b-4f07-a360-44afc76d2843" },
  { ksbCode: "S19", blockNumber: 3, blockId: "06873abc-907b-4f07-a360-44afc76d2843" },
  { ksbCode: "S4", blockNumber: 4, blockId: "fe75972c-69c5-466b-819e-65eeb8ce7666" },
  { ksbCode: "K21", blockNumber: 6, blockId: "41b13e4c-a689-4a0a-b883-51139a0537cc" },
  { ksbCode: "K23", blockNumber: 6, blockId: "41b13e4c-a689-4a0a-b883-51139a0537cc" },
  { ksbCode: "S13", blockNumber: 6, blockId: "41b13e4c-a689-4a0a-b883-51139a0537cc" },
  { ksbCode: "S14", blockNumber: 6, blockId: "41b13e4c-a689-4a0a-b883-51139a0537cc" },
];

function assertSafety() {
  if (APPROVED.length !== 15) throw new Error(`Expected 15, got ${APPROVED.length}`);
  for (const row of APPROVED) {
    if (FORBIDDEN.has(row.ksbCode)) {
      throw new Error(`Refusing to persist forbidden gap KSB ${row.ksbCode}`);
    }
  }
  const codes = APPROVED.map((r) => r.ksbCode);
  if (new Set(codes).size !== 15) throw new Error("Duplicate KSB in approved list");
}

async function main() {
  assertSafety();

  const getUrl = new URL(`${BASE}/api/management/programme-definition/spine`);
  getUrl.searchParams.set("programmeVersionId", PROGRAMME_VERSION_ID);
  getUrl.searchParams.set("standardCode", STANDARD_CODE);
  const getRes = await fetch(getUrl);
  const getJson = await getRes.json();
  if (!getJson.ok || !getJson.programme) {
    console.error("GET failed", getJson);
    process.exit(1);
  }

  const programme = getJson.programme;
  if (programme.id !== PROGRAMME_VERSION_ID) {
    throw new Error(`Unexpected programme version ${programme.id}`);
  }

  const existing = programme.ksbMappings ?? [];
  if (existing.length > 0) {
    console.error(
      "REFUSING: programme already has mappings; expected 0 before this exclusive write.",
      existing.map((m) => `${m.ksbCode}@${m.blockId}:P=${m.isPrimary}`),
    );
    process.exit(1);
  }

  const byId = new Map(programme.spineItems.map((i) => [i.id, i]));
  const gatewayEpaIds = new Set(
    programme.spineItems
      .filter((i) => i.itemType === "gateway" || i.itemType === "epa")
      .map((i) => i.id),
  );

  const now = new Date().toISOString();
  const ksbMappings = APPROVED.map((row) => {
    const item = byId.get(row.blockId);
    if (!item) throw new Error(`Missing spine item ${row.blockId}`);
    if (item.itemType !== "block") {
      throw new Error(`${row.ksbCode} targets non-block ${item.itemType}`);
    }
    if (gatewayEpaIds.has(row.blockId)) {
      throw new Error(`${row.ksbCode} targets gateway/EPA`);
    }
    return {
      id: randomUUID(),
      blockId: row.blockId,
      ksbCode: row.ksbCode,
      isPrimary: true,
      learningIntent: "introduce",
      curriculumValue: 1.0,
      mappingSource: "manual",
      recommendationProvider: null,
      recommendationFeature: null,
      recommendedIntent: null,
      recommendationAccepted: null,
      confidence: null,
      aiReasonSummary: null,
      createdBy: "human-approved-primary-batch",
      createdAt: now,
      updatedAt: now,
    };
  });

  const putRes = await fetch(`${BASE}/api/management/programme-definition/spine`, {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      programmeId: programme.programmeId,
      programmeVersionId: programme.id,
      programmeTitle: programme.programmeTitle,
      standardCode: programme.standardCode || STANDARD_CODE,
      standardVersionId: programme.standardVersionId,
      status: programme.status,
      internalVersion: programme.internalVersion,
      spineItems: programme.spineItems,
      ksbMappings,
      parameters: programme.parameters,
    }),
  });
  const putJson = await putRes.json();
  if (!putRes.ok || !putJson.ok) {
    console.error("PUT failed", putRes.status, putJson);
    process.exit(1);
  }

  const verifyRes = await fetch(getUrl);
  const verifyJson = await verifyRes.json();
  if (!verifyJson.ok || !verifyJson.programme) {
    console.error("Verify GET failed", verifyJson);
    process.exit(1);
  }

  const p = verifyJson.programme;
  const maps = p.ksbMappings ?? [];
  const primaries = maps.filter((m) => m.isPrimary);
  const byCode = new Map();
  for (const m of primaries) {
    const c = m.ksbCode.toUpperCase();
    byCode.set(c, (byCode.get(c) || 0) + 1);
  }
  const multi = [...byCode.entries()].filter(([, n]) => n !== 1);
  const items = new Map(p.spineItems.map((i) => [i.id, i]));
  const nonBlock = primaries.filter((m) => items.get(m.blockId)?.itemType !== "block");
  const gapHit = primaries.filter((m) => FORBIDDEN.has(m.ksbCode.toUpperCase()));
  const gwEpaMaps = maps.filter((m) => {
    const t = items.get(m.blockId)?.itemType;
    return t === "gateway" || t === "epa";
  });

  const report = {
    at: new Date().toISOString(),
    programmeVersionId: PROGRAMME_VERSION_ID,
    expectedOtjHours: p.parameters?.expectedOtjHours,
    mappingCount: maps.length,
    primaryCount: primaries.length,
    multiPrimaryCodes: multi.map(([c]) => c),
    nonBlockPrimaryCount: nonBlock.length,
    forbiddenGapPrimaryCount: gapHit.length,
    gatewayEpaMappingCount: gwEpaMaps.length,
    rows: primaries.map((m) => ({
      ksbCode: m.ksbCode,
      blockId: m.blockId,
      itemType: items.get(m.blockId)?.itemType,
      title: items.get(m.blockId)?.title,
      isPrimary: m.isPrimary,
      learningIntent: m.learningIntent,
      curriculumValue: m.curriculumValue,
    })),
    ok:
      maps.length === 15 &&
      primaries.length === 15 &&
      multi.length === 0 &&
      nonBlock.length === 0 &&
      gapHit.length === 0 &&
      gwEpaMaps.length === 0 &&
      p.parameters?.expectedOtjHours === 611.5,
  };

  writeFileSync(
    ".tmp-persist-15-approved-primaries-report.json",
    JSON.stringify(report, null, 2),
  );
  console.log(JSON.stringify(report, null, 2));
  if (!report.ok) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
