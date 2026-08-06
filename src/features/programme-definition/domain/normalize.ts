import { z } from "zod";
import type {
  ImportedDuty,
  ImportedKsb,
  ImportedProduct,
  KsbType,
  OfficialStandardVersion,
} from "./types";

function portableHash(input: string): string {
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(16).padStart(8, "0");
}

const mapsDutySchema = z
  .object({
    dutyId: z.string().optional(),
    dutyDetail: z.string().optional(),
    mappedKnowledge: z.array(z.string()).optional(),
    mappedSkills: z.array(z.string()).optional(),
    mappedBehaviour: z.array(z.string()).optional(),
  })
  .passthrough();

const mapsKsbSchema = z
  .object({
    knowledgeId: z.string().optional(),
    skillId: z.string().optional(),
    behaviourId: z.string().optional(),
    detail: z.string().optional(),
  })
  .passthrough();

export const mapsOccupationSchema = z
  .object({
    stdCode: z.string(),
    name: z.string(),
    versionNo: z.union([z.string(), z.number()]).optional(),
    level: z.number().optional(),
    statusName: z.string().optional(),
    duties: z.array(mapsDutySchema).optional(),
    knowledges: z.array(mapsKsbSchema).optional(),
    skills: z.array(mapsKsbSchema).optional(),
    behaviours: z.array(mapsKsbSchema).optional(),
    products: z.array(z.record(z.string(), z.unknown())).optional(),
    mapHierarchy: z
      .object({
        routeName: z.string().optional(),
        pathwayName: z.string().optional(),
        clusterName: z.string().optional(),
      })
      .passthrough()
      .optional(),
  })
  .passthrough();

export const apprenticeshipStandardSchema = z
  .object({
    referenceNumber: z.string(),
    occupationCode: z.string().optional(),
    title: z.string().optional(),
    version: z.union([z.string(), z.number()]).optional(),
    versionNumber: z.union([z.string(), z.number()]).optional(),
    level: z.number().optional(),
    status: z.string().optional(),
    typicalDuration: z.number().optional(),
    ePALength: z.number().optional(),
    minimumHoursForCompliance: z.union([z.string(), z.number()]).optional(),
    maxFunding: z.number().optional(),
    larsCode: z.number().optional(),
    route: z.string().optional(),
    pathway: z.string().optional(),
    cluster: z.string().optional(),
    assessmentPlanUrl: z.string().optional(),
    approvedForDelivery: z.string().optional(),
    lastUpdated: z.string().optional(),
    changedDate: z.string().optional(),
  })
  .passthrough();

export type MapsOccupation = z.infer<typeof mapsOccupationSchema>;
export type ApprenticeshipStandard = z.infer<typeof apprenticeshipStandardSchema>;

function asVersion(value: unknown): string {
  return String(value ?? "")
    .replace(/^v/i, "")
    .trim();
}

function parseHours(value: unknown): number | null {
  if (value == null || value === "") return null;
  const n = typeof value === "number" ? value : Number(String(value).replace(/,/g, ""));
  return Number.isFinite(n) ? n : null;
}

function parseDate(value: unknown): string | null {
  if (typeof value !== "string" || !value.trim()) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 10);
}

function mapKsbType(kind: "knowledge" | "skill" | "behaviour"): KsbType {
  return kind;
}

export function normalizeMapsOccupation(raw: unknown): {
  occupation: MapsOccupation;
  duties: ImportedDuty[];
  ksbs: ImportedKsb[];
  products: ImportedProduct[];
} {
  const occupation = mapsOccupationSchema.parse(raw);
  const duties: ImportedDuty[] = (occupation.duties ?? []).map((d, i) => {
    const code = (d.dutyId ?? `D${i + 1}`).trim();
    const mapped = [
      ...(d.mappedKnowledge ?? []),
      ...(d.mappedSkills ?? []),
      ...(d.mappedBehaviour ?? []),
    ]
      .map((c) => c.trim())
      .filter((c) => /^[KSB]\d+/i.test(c));
    return {
      code,
      description: (d.dutyDetail ?? "").trim(),
      mappedKsbCodes: [...new Set(mapped.map((c) => c.toUpperCase()))],
    };
  });

  const ksbs: ImportedKsb[] = [];
  for (const k of occupation.knowledges ?? []) {
    if (!k.knowledgeId) continue;
    ksbs.push({
      code: k.knowledgeId.toUpperCase(),
      type: mapKsbType("knowledge"),
      description: (k.detail ?? "").trim(),
    });
  }
  for (const s of occupation.skills ?? []) {
    if (!s.skillId) continue;
    ksbs.push({
      code: s.skillId.toUpperCase(),
      type: mapKsbType("skill"),
      description: (s.detail ?? "").trim(),
    });
  }
  for (const b of occupation.behaviours ?? []) {
    if (!b.behaviourId) continue;
    ksbs.push({
      code: b.behaviourId.toUpperCase(),
      type: mapKsbType("behaviour"),
      description: (b.detail ?? "").trim(),
    });
  }

  const products: ImportedProduct[] = (occupation.products ?? []).map((p) => ({
    code: String(p.productCode ?? p.code ?? ""),
    name: String(p.name ?? ""),
    type: String(p.typeName ?? p.type ?? ""),
    level: typeof p.level === "number" ? p.level : undefined,
    status: typeof p.statusName === "string" ? p.statusName : undefined,
  }));

  return { occupation, duties, ksbs, products };
}

export function normalizeApprenticeshipStandard(raw: unknown): {
  standard: ApprenticeshipStandard;
  complete: boolean;
} {
  const standard = apprenticeshipStandardSchema.parse(raw);
  const complete =
    standard.typicalDuration != null &&
    standard.maxFunding != null &&
    standard.larsCode != null &&
    parseHours(standard.minimumHoursForCompliance) != null;
  return { standard, complete };
}

export function buildOfficialStandardVersion(args: {
  id: string;
  mapsRaw: unknown;
  apprenticeshipRaw: unknown | null;
}): OfficialStandardVersion {
  const { occupation, duties, ksbs, products } = normalizeMapsOccupation(
    args.mapsRaw,
  );
  let apprenticeship: ApprenticeshipStandard | null = null;
  let complete = false;
  if (args.apprenticeshipRaw) {
    try {
      const n = normalizeApprenticeshipStandard(args.apprenticeshipRaw);
      apprenticeship = n.standard;
      complete = n.complete;
    } catch {
      apprenticeship = null;
      complete = false;
    }
  }

  const stCode =
    products.find((p) => p.type.toLowerCase().includes("apprenticeship"))
      ?.code ||
    apprenticeship?.referenceNumber ||
    "";

  const version =
    asVersion(apprenticeship?.version ?? apprenticeship?.versionNumber) ||
    asVersion(occupation.versionNo) ||
    "unknown";

  const hash = portableHash(
    JSON.stringify({ maps: args.mapsRaw, st: args.apprenticeshipRaw }),
  );

  return {
    id: args.id,
    standardCode: stCode || "UNKNOWN",
    occupationCode: occupation.stdCode,
    title: apprenticeship?.title?.trim() || occupation.name,
    externalVersion: version,
    level: apprenticeship?.level ?? occupation.level ?? 2,
    status: apprenticeship?.status ?? occupation.statusName ?? "",
    typicalDurationMonths: apprenticeship?.typicalDuration ?? null,
    assessmentPeriodMonths: apprenticeship?.ePALength ?? null,
    minimumComplianceHours: parseHours(
      apprenticeship?.minimumHoursForCompliance,
    ),
    maximumFundingPounds: apprenticeship?.maxFunding ?? null,
    larsCode: apprenticeship?.larsCode ?? null,
    route:
      apprenticeship?.route ??
      occupation.mapHierarchy?.routeName ??
      "",
    pathway:
      apprenticeship?.pathway ??
      occupation.mapHierarchy?.pathwayName ??
      "",
    cluster:
      apprenticeship?.cluster ??
      occupation.mapHierarchy?.clusterName ??
      "",
    assessmentPlanUrl: apprenticeship?.assessmentPlanUrl ?? "",
    approvedForDeliveryDate: parseDate(apprenticeship?.approvedForDelivery),
    updatedDate: parseDate(
      apprenticeship?.lastUpdated ?? apprenticeship?.changedDate,
    ),
    apprenticeshipDetailsComplete: complete,
    duties,
    ksbs,
    linkedProducts: products,
    occupationRawPayload: args.mapsRaw,
    apprenticeshipRawPayload: args.apprenticeshipRaw,
    sourceHash: hash,
    importedAt: new Date().toISOString(),
    locked: true,
  };
}
