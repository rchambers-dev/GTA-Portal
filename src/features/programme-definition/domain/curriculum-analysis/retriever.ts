/**
 * Per-KSB evidence retrieval + lexical false-friend guards.
 * General apprenticeship curriculum rules only — no golden-label injection.
 */

import type { EvidenceSession } from "./evidence";
import type { CurriculumEvidenceRef, OfficialKsbRef } from "./types";

export type RetrievalHit = {
  session: EvidenceSession;
  score: number;
  reasons: string[];
  rejected: boolean;
  rejectReason?: string;
};

const FALSE_FRIENDS: Array<{
  whenKsbMatches: RegExp;
  rejectEvidence: RegExp;
  label: string;
}> = [
  {
    whenKsbMatches: /gdpr|cyber|digital technology/i,
    rejectEvidence: /\bstock\b.*\bsecur|\bsecur(?:e|ity)\b(?!ity of data)/i,
    label: "security≠cyber/GDPR",
  },
  {
    whenKsbMatches: /geometry|alignment|ackermann|camber|thrust angle/i,
    rejectEvidence: /\bwheel security\b|\btyre condition\b/i,
    label: "wheel/tyre inspect≠geometry",
  },
  {
    whenKsbMatches: /customer care|challenging conversation|customer service/i,
    rejectEvidence: /\bservice schedule\b|\broutine service\b|\bservice reception\b/i,
    label: "service≠customer service",
  },
  {
    whenKsbMatches: /team working|teamwork/i,
    rejectEvidence: /\bteam support\b(?!.*team working)/i,
    label: "team mention≠team-working principles",
  },
  {
    whenKsbMatches: /state-of-health|state of health|soh/i,
    rejectEvidence: /\bev\b|\belectrified\b|\bhigh.?voltage\b|\bhybrid\b/i,
    label: "EV≠HV SoH testing",
  },
  {
    whenKsbMatches: /brake fluid|oil filter|air filter|filtration/i,
    rejectEvidence: /\bbrake\b(?!.*fluid)|\bbraking\b/i,
    label: "brake≠fluids/filters",
  },
  {
    // Tool/equipment calibration & storage ≠ ADAS / sensor / alignment pre-calibration
    whenKsbMatches:
      /tools? and equipment|return tools|store,\s*maintain|calibration checks/i,
    rejectEvidence:
      /\bpre-?calibration\b|\bsensor inputs?\b|\balignment,?\s*ride height\b|\badas\b|\bnon-invasive\b/i,
    label: "ADAS/sensor calibration≠tool calibration/storage",
  },
  {
    whenKsbMatches: /organisational sales|sales processes|consultative selling/i,
    rejectEvidence: /\bwarranty\b|\bparts identification\b|\bstock rotation\b/i,
    label: "parts/stock≠sales process",
  },
];

function wordishIncludes(text: string, phrase: string): boolean {
  const p = phrase.toLowerCase().trim();
  if (!p) return false;
  if (p.includes(" ") || p.length > 4) return text.includes(p);
  return new RegExp(`(?<![a-z0-9])${escapeReg(p)}(?![a-z0-9])`, "i").test(text);
}

function escapeReg(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function tokensFromOfficial(description: string): string[] {
  const stop = new Set([
    "the",
    "and",
    "for",
    "with",
    "from",
    "that",
    "this",
    "into",
    "onto",
    "their",
    "they",
    "have",
    "has",
    "are",
    "was",
    "were",
    "will",
    "can",
    "may",
    "not",
    "use",
    "used",
    "using",
    "including",
    "include",
    "purpose",
    "function",
    "location",
    "systems",
    "system",
    "components",
    "component",
    "relevant",
    "occupation",
    "technician",
    "vehicle",
    "vehicles",
    "cars",
    "example",
    "examples",
    "following",
    "industry",
    "organisational",
    "organization",
    "processes",
    "process",
  ]);
  return description
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ")
    .split(/\s+/)
    .map((t) => t.trim())
    .filter((t) => t.length >= 4 && !stop.has(t))
    .slice(0, 24);
}

function ksbQueryBoosts(ksb: OfficialKsbRef): string[] {
  const d = ksb.description.toLowerCase();
  const boosts: string[] = [];
  if (/hydrogen/.test(d)) boosts.push("hydrogen", "fuel cell");
  if (/tyre|tire|tpms/.test(d)) boosts.push("tyre", "tpms", "balance");
  if (/alignment|geometry|ackermann|camber|toe/.test(d))
    boosts.push("alignment", "geometry", "toe", "camber");
  if (/suspension/.test(d)) boosts.push("suspension");
  if (/steering/.test(d) && !/geometry|alignment/.test(d))
    boosts.push("steering system", "power assisted", "epas", "hydraulic");
  if (/air conditioning|climate|hvac|refrigerant/.test(d))
    boosts.push("air-conditioning", "climate", "hvac");
  if (/alternator|starter|charging system|low voltage batter/.test(d))
    boosts.push("electrical", "battery", "alternator", "starter", "charging");
  if (/adas|driver-assistance|driver assistance|calibration/.test(d) &&
    !/tools? and equipment|return tools|store,\s*maintain/.test(d))
    boosts.push("adas", "calibration", "pre-calibration", "sensor");
  if (/environment|sustainability|recycling|waste/.test(d))
    boosts.push("environment", "spill", "waste", "recycling");
  if (/health and safety|coshh|ppe|puwer|loler/.test(d))
    boosts.push("safety", "hazard", "ppe", "coshh");
  if (/quotation|quote|estimate|parts|procurement|supplier|stock/.test(d))
    boosts.push("quotation", "estimate", "supplier", "stock", "parts");
  if (/fca|pci|payment card|financial conduct/.test(d))
    boosts.push("fca", "pci", "payment", "financial conduct");
  if (/communicate|verbal|handover|customer update/.test(d))
    boosts.push("customer", "handover", "communication", "role-play");
  if (/written|documentation|job card|terminology|communicate in writing/.test(d))
    boosts.push("documentation", "job card", "record", "written", "handover");
  if (/learning and development|cpd|reflective|portfolio/.test(d))
    boosts.push("portfolio", "reflective", "development");
  if (/equity|diversity|inclusion|inclusive/.test(d))
    boosts.push("inclusion", "diversity", "equity", "inclusive");
  if (/gdpr|cyber/.test(d)) boosts.push("gdpr", "cyber");
  if (/state-of-health|state of health|soh/.test(d))
    boosts.push("state-of-health", "soh");
  if (/emission|catalytic|dpf|egr|scr/.test(d))
    boosts.push("emission", "dpf", "catalytic", "egr");
  if (/electrified|high voltage|isolation|electric vehicle/.test(d))
    boosts.push("electrified", "isolation", "high voltage", "ev");
  if (/tools? and equipment|hand tools|power tools|store,\s*maintain|return tools/.test(d))
    boosts.push(
      "tools",
      "equipment",
      "tool use",
      "safe tool",
      "calibration",
      "housekeeping",
      "storage",
    );
  if (/sales processes|consultative selling|features and benefits|mini closing|show and tell/.test(d))
    boosts.push(
      "sales",
      "quotation",
      "upsell",
      "features and benefits",
      "authorisation",
      "customer",
    );
  if (/stock|stock rotation|parts storage|resource management|costings|procurement/.test(d))
    boosts.push(
      "stock",
      "stock rotation",
      "parts storage",
      "goods-in",
      "reorder",
      "supplier",
      "parts",
    );
  // Multi-system remove/replace breadth (description-driven, not code-specific)
  if (
    /inspect,\s*remove,?\s*and\s*replace|remove and replace/.test(d) &&
    /steering|suspension|braking|emission|air conditioning|engine/.test(d)
  ) {
    boosts.push("remove", "replace", "suspension", "brake", "steering");
  }
  if (/balance|demount|strip/.test(d) && /tyre|tire/.test(d)) {
    boosts.push("tyre", "balance", "replace", "remove", "strip");
  }
  return [...new Set(boosts)];
}

function isReinforcementish(session: EvidenceSession): boolean {
  const blob = `${session.topic} ${session.weakText}`.toLowerCase();
  return (
    /\bconsolidat|\brevision\b|\brecap\b|\brefresher\b|\bend of programme\b|\bportfolio showcase\b|\brevisit\b/.test(
      blob,
    ) || session.week >= 90
  );
}

function selectDiverseHits(scored: RetrievalHit[], topN: number): RetrievalHit[] {
  if (!scored.length) return [];
  const sorted = [...scored].sort(
    (a, b) => b.score - a.score || a.session.week - b.session.week,
  );
  const best = sorted[0]!.score;
  const selected: RetrievalHit[] = [];
  const perBlock = new Map<number, number>();

  const tryAdd = (h: RetrievalHit, maxPerBlock: number) => {
    if (selected.some((s) => s.session.evidenceRefId === h.session.evidenceRefId)) {
      return;
    }
    const n = perBlock.get(h.session.blockNumber) ?? 0;
    if (n >= maxPerBlock) return;
    selected.push(h);
    perBlock.set(h.session.blockNumber, n + 1);
  };

  // First pass: strong hits, cap 2 per block
  for (const h of sorted) {
    if (selected.length >= topN) break;
    tryAdd(h, 2);
  }

  // Second pass: ensure competitive earlier-block representatives are visible
  const earlyCompetitive = sorted.filter(
    (h) =>
      h.session.week <= 40 &&
      h.score >= best * 0.4 &&
      !h.rejected,
  );
  for (const h of earlyCompetitive) {
    if (selected.length >= topN) break;
    tryAdd(h, 2);
  }

  // Third pass: fill remaining by score with looser block cap
  for (const h of sorted) {
    if (selected.length >= topN) break;
    tryAdd(h, 3);
  }

  return selected.sort(
    (a, b) => b.score - a.score || a.session.week - b.session.week,
  );
}

export function retrieveEvidenceForKsb(
  ksb: OfficialKsbRef,
  sessions: EvidenceSession[],
  topN = 10,
): RetrievalHit[] {
  const tokens = tokensFromOfficial(ksb.description);
  const boosts = ksbQueryBoosts(ksb);
  const hits: RetrievalHit[] = [];

  for (const session of sessions) {
    // Late consolidation weeks demoted for Primary ownership.
    const latePenalty = session.week >= 100 ? 0.5 : session.week >= 85 ? 0.72 : 1;
    let score = 0;
    const reasons: string[] = [];

    for (const b of boosts) {
      if (wordishIncludes(session.topic.toLowerCase(), b)) {
        score += 4.5;
        reasons.push(`topic:${b}`);
      } else if (wordishIncludes(session.strongText, b)) {
        score += 2.8;
        reasons.push(`strong:${b}`);
      } else if (wordishIncludes(session.practicalText, b)) {
        score += 2.2;
        reasons.push(`practical:${b}`);
      } else if (wordishIncludes(session.weakText, b)) {
        score += 0.6;
        reasons.push(`weak:${b}`);
      }
    }

    let tokenHits = 0;
    for (const t of tokens) {
      if (wordishIncludes(session.strongText, t)) tokenHits += 1;
      else if (wordishIncludes(session.searchableText, t)) tokenHits += 0.35;
    }
    score += Math.min(tokenHits, 10) * 0.45;

    if (session.practicalText.length > 80) score += 0.8;
    if (session.objectivesText.length > 40) score += 0.4;

    // Mild early-teaching preference when lexical scores are competitive.
    const earlyBias = 1 + Math.max(0, (55 - session.week) / 200);
    score *= earlyBias;

    if (isReinforcementish(session)) {
      score *= 0.62;
      reasons.push("demote:reinforcement/consolidation");
    }

    // Awareness / fire-safety false home for LV electrical.
    if (
      /low voltage|alternator|starter|charging system/i.test(ksb.description) &&
      /fire safety|battery awareness|hybrid and high-voltage vehicle awareness/i.test(
        session.topic,
      )
    ) {
      score *= 0.25;
      reasons.push("demote:awareness-only");
    }

    let rejected = false;
    let rejectReason: string | undefined;
    for (const ff of FALSE_FRIENDS) {
      if (!ff.whenKsbMatches.test(ksb.description)) continue;
      if (ff.rejectEvidence.test(session.searchableText)) {
        // Soft reject unless boosted title is exact technical match
        if (!boosts.some((b) => wordishIncludes(session.topic.toLowerCase(), b))) {
          rejected = true;
          rejectReason = ff.label;
          score *= 0.15;
        }
      }
    }

    score *= latePenalty;
    if (score < 1.05) continue;

    hits.push({
      session,
      score,
      reasons: reasons.slice(0, 8),
      rejected,
      rejectReason,
    });
  }

  return selectDiverseHits(hits, topN);
}

export function hitsToEvidenceRefs(hits: RetrievalHit[]): CurriculumEvidenceRef[] {
  return hits.map((h) => ({
    sourceDocumentId: h.session.sourceDocumentId,
    sourceType: h.session.sourceType,
    evidenceStatus: h.session.evidenceStatus,
    title: h.session.topic || h.session.title,
    version: h.session.version,
    week: h.session.week,
    sessionLabel: `W${String(h.session.week).padStart(2, "0")}`,
    blockNumber: h.session.blockNumber,
    locationRef: h.session.evidenceRefId,
    contentHashSha256: h.session.contentHashSha256,
    excerpt: h.session.excerptSeed,
    strength: h.rejected ? "rejected" : h.score >= 6 ? "strong" : "weak",
    acceptRejectReason: h.rejected
      ? h.rejectReason || "false-friend guard"
      : h.reasons.join("; ") || "lexical/title/practical match",
  }));
}
