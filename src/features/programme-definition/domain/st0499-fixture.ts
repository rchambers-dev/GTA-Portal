/**
 * Offline / bootstrap snapshot for ST0499 v1.3 when live import is unavailable.
 * KSBs from local catalogue; duties + product meta from confirmed live probes (Aug 2026).
 */

import { latestSt0499KsbVersion } from "@/features/programme-delivery/domain/st0499-ksb-catalog";
import { buildOfficialStandardVersion } from "./normalize";
import type { OfficialStandardVersion } from "./types";

const DUTIES: Array<{ code: string; description: string; mapped: string[] }> = [
  {
    code: "D1",
    description:
      "Communicate with customers establishing vehicle problems and their requirements.",
    mapped: [
      "K1","K2","K6","K7","K8","K9","K10","K11","K12","K13","K14","K15","K16","K17","K18","K19","K24","K25","K26","K27","K28","K29","K30","K31","K32","K33","K34",
      "S5","S7","S8","S9","S10","S11","S12","S13","S14","S15","S16","S17","S18","S19","S20","S21","S22","S23","S24",
      "B1","B2","B3","B4","B5",
    ],
  },
  {
    code: "D2",
    description: "Conduct vehicle inspections and routine maintenance work.",
    mapped: [
      "K1","K2","K3","K4","K5","K6","K7","K8","K9","K10","K11","K12","K13","K14","K15","K16","K19","K21","K22","K23","K27","K30","K31","K32","K33","K34",
      "S1","S2","S3","S4","S5","S6","S7","S8","S9","S10","S11","S12","S13","S14","S15","S16","S17","S19","S20","S21","S22","S24","S25",
      "B1","B2","B3","B4","B5",
    ],
  },
  {
    code: "D3",
    description:
      "Work independently and as part of a team, contributing to business outcomes.",
    mapped: [
      "K1","K2","K3","K4","K5","K6","K7","K8","K9","K10","K11","K12","K13","K14","K15","K16","K17","K18","K19","K21","K22","K23","K24","K25","K26","K27","K28","K29","K30","K31","K32","K33","K34",
      "S1","S2","S3","S4","S5","S6","S7","S8","S9","S10","S11","S12","S13","S14","S15","S16","S17","S18","S19","S20","S21","S22","S23","S24",
      "B1","B2","B3","B4","B5",
    ],
  },
  {
    code: "D4",
    description:
      "Inspect, repair, and replace car, car derived van, or light goods vehicle tyres and vehicle systems components.",
    mapped: [
      "K1","K3","K4","K5","K6","K7","K8","K9","K10","K11","K12","K13","K14","K15","K16","K17","K18","K19","K20","K26","K30","K32","K33","K34",
      "S1","S2","S3","S4","S5","S6","S7","S8","S9","S10","S11","S12","S14","S15","S16","S19","S20","S21","S22","S24","S25",
      "B1","B2","B4",
    ],
  },
  {
    code: "D5",
    description:
      "Identify and source, vehicle components in line with workplace procedures.",
    mapped: [
      "K1","K4","K6","K8","K9","K10","K11","K12","K13","K14","K15","K16","K17","K18","K26","K27","K28","K29","K30","K32","K33","K34",
      "S1","S2","S3","S4","S5","S6","S7","S8","S9","S10","S11","S12","S13","S14","S15","S16","S17","S18","S19","S20","S21","S22","S23","S24",
      "B1","B2","B4",
    ],
  },
  {
    code: "D6",
    description:
      "Follow workplace instructions or procedures for vehicle maintenance or repair.",
    mapped: [
      "K1","K2","K3","K4","K5","K6","K7","K8","K9","K10","K11","K12","K13","K14","K15","K16","K17","K18","K19","K21","K22","K24","K25","K26","K27","K28","K29","K30","K31","K32","K34",
      "S1","S2","S3","S5","S6","S7","S8","S9","S10","S11","S12","S13","S14","S15","S16","S17","S18","S19","S20","S21","S22","S23","S24",
      "B1","B2","B3","B5",
    ],
  },
  {
    code: "D7",
    description:
      "Maintain the workplace environment, follow good housekeeping practices in accordance with health and safety procedures.",
    mapped: [
      "K1","K2","K3","K4","K5","K6","K7","K8","K9","K10","K11","K12","K13","K14","K15","K16","K17","K18","K19","K21","K22","K23","K24","K26","K27","K29","K30","K31","K32","K33","K34",
      "S1","S2","S3","S4","S5","S6","S7","S8","S9","S10","S11","S12","S13","S14","S15","S16","S17","S19","S20","S21","S22","S24",
      "B1","B2","B3","B4","B5",
    ],
  },
  {
    code: "D8",
    description:
      "Post inspection, provide customer quotation of the work required, before agreeing and commencing the work.",
    mapped: [
      "K1","K4","K8","K9","K10","K11","K12","K13","K14","K15","K16","K19","K23","K24","K25","K26","K27","K28","K29","K30","K31","K32","K33","K34",
      "S7","S8","S9","S10","S11","S12","S14","S15","S16","S17","S18","S19","S20","S21","S22","S23","S24",
      "B4","B5",
    ],
  },
  {
    code: "D9",
    description:
      "Contribute to stock management routines. For example, ordering, booking, receiving, and ensuring safe storage, of stock and consumables.",
    mapped: [
      "K1","K4","K7","K8","K9","K10","K11","K12","K13","K14","K15","K16","K24","K25","K26","K27","K28","K29","K33","K34",
      "S9","S10","S12","S14","S15","S16","S17","S18","S19","S20","S21","S22","S23","S24",
      "B1","B2","B4","B5",
    ],
  },
  {
    code: "D10",
    description:
      "Promote the safety of themselves, customers, colleagues, and the environment.",
    mapped: [
      "K1","K2","K3","K4","K5","K6","K7","K19","K21","K22","K23","K24","K26","K27","K30","K31","K32","K33","K34",
      "S1","S2","S3","S4","S5","S6","S7","S13","S14","S19","S20","S21","S22","S24",
      "B1","B2","B3","B4","B5",
    ],
  },
];

export function buildSt0499FixtureOfficial(): OfficialStandardVersion {
  const pack = latestSt0499KsbVersion();
  const knowledges = pack.ksbs
    .filter((k) => k.kind === "knowledge")
    .map((k) => ({ knowledgeId: k.code, detail: k.statement }));
  const skills = pack.ksbs
    .filter((k) => k.kind === "skills")
    .map((k) => ({ skillId: k.code, detail: k.statement }));
  const behaviours = pack.ksbs
    .filter((k) => k.kind === "behaviours")
    .map((k) => ({ behaviourId: k.code, detail: k.statement }));

  const mapsRaw = {
    stdCode: "OCC0499",
    name: "Autocare technician",
    versionNo: "1.3",
    level: 2,
    statusName: "Approved occupation",
    mapHierarchy: {
      routeName: "Engineering and manufacturing",
      pathwayName: "Maintenance, installation and repair",
      clusterName: "Service, repair and/or overhaul operative or technician",
    },
    duties: DUTIES.map((d) => ({
      dutyId: d.code,
      dutyDetail: d.description,
      mappedKnowledge: d.mapped.filter((c) => c.startsWith("K")),
      mappedSkills: d.mapped.filter((c) => c.startsWith("S")),
      mappedBehaviour: d.mapped.filter((c) => c.startsWith("B")),
    })),
    knowledges,
    skills,
    behaviours,
    products: [
      {
        productCode: "ST0499",
        name: "Autocare technician",
        typeName: "Apprenticeship",
        level: 2,
        statusName: "Approved for delivery",
      },
    ],
  };

  const stRaw = {
    referenceNumber: "ST0499",
    occupationCode: "OCC0499",
    title: "Autocare technician",
    version: "1.3",
    versionNumber: "1.3",
    level: 2,
    status: "Approved for delivery",
    typicalDuration: 30,
    ePALength: 3,
    minimumHoursForCompliance: "605",
    maxFunding: 13000,
    larsCode: 283,
    route: "Engineering and manufacturing",
    pathway: "Maintenance, installation and repair",
    cluster: "Service, repair and/or overhaul operative or technician",
    assessmentPlanUrl:
      "https://skillsengland.education.gov.uk/apprenticeships/st0499-v1-3?view=epa",
    approvedForDelivery: "2018-05-24T00:00:00 +00:00",
    lastUpdated: "2025-09-19T00:00:00 +00:00",
  };

  return buildOfficialStandardVersion({
    id: crypto.randomUUID(),
    mapsRaw,
    apprenticeshipRaw: stRaw,
  });
}
