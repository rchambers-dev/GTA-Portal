/**
 * Evidence-sufficiency assessment (AI-1.4).
 * Semantic materiality: essentials vs exemplars. No KSB-code hardcoding.
 */

import type { RetrievalHit } from "./retriever";
import type { OfficialKsbRef } from "./types";

export type EvidenceStrength =
  | "FULL"
  | "NEAR_FULL"
  | "MATERIAL_PARTIAL"
  | "WEAK_ADJACENT"
  | "ABSENT"
  /** Legacy aliases accepted from model output */
  | "PARTIAL"
  | "WEAK_REFERENCE";

export type RequirementComponent = {
  id: string;
  text: string;
  tokens: string[];
  distinctive: boolean;
  performanceOriented: boolean;
  /** Essential to the core competence (not a supporting example). */
  essential: boolean;
  /** Illustrative / "for example" / after-core enumeration. */
  exemplar: boolean;
};

export type EvidenceSufficiency = {
  components: RequirementComponent[];
  coveredComponents: string[];
  missingComponents: string[];
  missingEssentialComponents: string[];
  coverageStrength: EvidenceStrength;
  coverageRatio: number;
  essentialCoverageRatio: number;
  distinctiveCovered: number;
  distinctiveTotal: number;
  practicalRequired: boolean;
  practicalPresent: boolean;
  /** True only when an ESSENTIAL competence element is missing. */
  missingMaterialBreadth: boolean;
  reasons: string[];
};

const STOP = new Set([
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
  "include",
  "including",
  "example",
  "examples",
  "such",
  "purpose",
  "function",
  "location",
  "relevant",
  "occupation",
  "technician",
  "vehicle",
  "vehicles",
  "cars",
  "car",
  "derived",
  "vans",
  "light",
  "goods",
  "following",
  "industry",
  "organisational",
  "organization",
  "processes",
  "process",
  "system",
  "systems",
  "component",
  "components",
  "parts",
  "part",
  "knowledge",
  "awareness",
  "understanding",
  "ability",
  "able",
  "how",
  "what",
  "when",
  "where",
  "which",
  "while",
  "about",
  "other",
  "also",
  "etc",
  "role",
  "impact",
  "good",
  "work",
  "working",
]);

const PERFORMANCE_VERBS =
  /\b(apply|inspect|remove|replace|repair|test|use|comply|balance|calibrat\w*|diagnose|adjust|measure|record|communicate|store|maintain|return|operate|carry\s+out|demonstrate|segregat\w*)\b/i;

/** Soft synonym expansion — semantic not Autocare-specific. */
const SYNONYM_GROUPS: string[][] = [
  ["team", "teamwork", "team-working", "collaborat", "team working", "team support"],
  ["verbal", "orally", "spoken", "conversation", "communicate", "communication", "role-play", "handover", "brief"],
  ["writing", "written", "write", "documentation", "job card", "record", "email", "report"],
  ["adapt", "adapting", "flexible", "changing", "priority", "demands", "workload"],
  ["procurement", "procure", "ordering", "supplier", "purchasing", "goods-in"],
  ["costings", "costing", "pricing", "quotation", "estimate", "price"],
  ["segregat", "waste stream", "recycling", "disposal", "reuse", "waste"],
  ["sustainability", "environmental", "environment", "spill"],
  ["sales", "upsell", "quotation", "features and benefits", "authorisation", "estimate"],
  ["stock", "storage", "inventory", "reorder", "rotation", "consumable"],
];

/** Distinctive packages that need MORE than one generic overlapping word. */
const DISTINCTIVE_PACKAGES: Array<{
  whenOfficial: RegExp;
  requireEvidence: RegExp;
  label: string;
}> = [
  {
    whenOfficial: /state[- ]of[- ]health|\bsoh\b/i,
    requireEvidence: /state[- ]of[- ]health|\bsoh\b/i,
    label: "state-of-health",
  },
  {
    whenOfficial: /gdpr|cyber/i,
    requireEvidence: /\bgdpr\b|\bcyber\b/i,
    label: "gdpr/cyber",
  },
  {
    whenOfficial: /equity|diversity|inclusion|inclusive workplace/i,
    requireEvidence: /\binclusion\b|\bdiversity\b|\bequity\b|\binclusive\b/i,
    label: "EDI",
  },
  {
    whenOfficial: /levels of autonomy|passive and active/i,
    requireEvidence: /levels of autonomy|passive and active/i,
    label: "autonomy-levels",
  },
  {
    whenOfficial: /limits of autonomy|reporting channels/i,
    requireEvidence:
      /limits of autonomy|limit(?:s)? of (?:the )?role|reporting (?:channel|line|structure)|escalat(?:e|ion)/i,
    label: "role-autonomy/reporting",
  },
  {
    whenOfficial: /fca|pci|payment card|financial conduct/i,
    requireEvidence: /\bfca\b|\bpci\b|payment card|financial conduct/i,
    label: "FCA/PCI",
  },
  {
    whenOfficial:
      /manufacturer.?s? (schedule|data|specification)|approved schedules|vehicle specific data/i,
    requireEvidence:
      /(manufacturer|oem).{0,40}(schedule|specification|data)|(schedule|specification).{0,40}(manufacturer|oem)|vehicle[- ]specific data|approved schedule/i,
    label: "manufacturer-schedule/data",
  },
  {
    whenOfficial: /workplace instructions?/i,
    requireEvidence:
      /workplace instruction|safe system of work|method statement|standard operating|work instruction/i,
    label: "workplace-instructions",
  },
  {
    whenOfficial: /fluids?.{0,40}filtration|filtration.{0,40}fluids?|oil filter|air filter|pollen filter/i,
    requireEvidence:
      /(fluid|oil|coolant).{0,40}(filter|filtration)|(filter|filtration).{0,40}(fluid|oil|coolant)|replace.{0,20}filter/i,
    label: "fluids-filtration",
  },
  {
    whenOfficial: /balance|demount|strip/i,
    requireEvidence: /\bbalance\b|\bdemount\b|\bstrip\b/i,
    label: "tyre-balance/strip",
  },
];

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ")
    .split(/\s+/)
    .map((t) => t.trim())
    .filter((t) => t.length >= 4 && !STOP.has(t));
}

function isDistinctiveToken(token: string): boolean {
  if (token.length >= 8) return true;
  if (/-/.test(token)) return true;
  return /(?:tion|ment|ology|metry|ance|ency|ular|ical|ware|health|fluid|filter|sensor|stock|sales|geom|brake|steer|suspen|emiss|electr|isolat|gdpr|cyber|inclus|autono|balanc|calibr|procur|sustain|verbal|writ)/i.test(
    token,
  );
}

function expandNeedles(tokens: string[]): string[] {
  const out = new Set(tokens);
  for (const t of tokens) {
    for (const group of SYNONYM_GROUPS) {
      if (group.some((g) => t.includes(g) || g.includes(t))) {
        for (const g of group) out.add(g);
      }
    }
  }
  return [...out];
}

function textHasNeedle(text: string, needle: string): boolean {
  if (needle.includes(" ") || needle.length > 4) return text.includes(needle);
  return new RegExp(`(?<![a-z0-9])${needle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?![a-z0-9])`, "i").test(
    text,
  );
}

/**
 * Decompose official wording into essential vs exemplar components.
 */
export function decomposeOfficialRequirement(
  ksb: OfficialKsbRef,
): RequirementComponent[] {
  const desc = ksb.description.trim();
  const exampleSplit = desc.split(/\bfor example,?/i);
  const main = (exampleSplit[0] || desc).trim();
  const exampleTail = exampleSplit.slice(1).join(" ").trim();

  // Core clauses: sentence / semicolon. Avoid exploding "A. B. C." legislation lists
  // into mandatory essentials — keep first 1–2 sentences as core, rest as exemplars
  // when they look like enumerated terms.
  const sentences = main
    .split(/(?<=\.)\s+/)
    .map((s) => s.trim())
    .filter(Boolean);

  const components: RequirementComponent[] = [];
  let idx = 0;

  const push = (
    text: string,
    flags: { essential: boolean; exemplar: boolean },
  ) => {
    const tokens = tokenize(text).slice(0, 14);
    if (!tokens.length && text.length < 8) return;
    idx += 1;
    components.push({
      id: `C${idx}`,
      text: text.slice(0, 180),
      tokens: tokens.length ? tokens : tokenize(text.replace(/[^a-z0-9\s]/gi, " ")),
      distinctive:
        tokens.some(isDistinctiveToken) ||
        DISTINCTIVE_PACKAGES.some((p) => p.whenOfficial.test(text)),
      performanceOriented: PERFORMANCE_VERBS.test(text),
      essential: flags.essential,
      exemplar: flags.exemplar,
    });
  };

  if (!sentences.length) {
    push(main, { essential: true, exemplar: false });
  } else {
    // First sentence always essential. Second essential if not a pure enumeration.
    push(sentences[0]!, { essential: true, exemplar: false });
    for (let i = 1; i < sentences.length; i++) {
      const s = sentences[i]!;
      const looksLikeEnum =
        s.split(/,/).length >= 3 ||
        /\bAct\b|\bPPE\b|\bCOSHH\b|\bLOLER\b|\bPUWER\b|regulations?/i.test(s);
      // Short follow-on fragments after a broad awareness statement are usually exemplars.
      const isSupportingList =
        looksLikeEnum ||
        (s.length < 120 &&
          /awareness|regulations|standards|guidance/i.test(sentences[0]!));
      push(s, {
        essential: !isSupportingList,
        exemplar: isSupportingList,
      });
    }
  }

  if (exampleTail) {
    push(exampleTail, { essential: false, exemplar: true });
  }

  // Package checks as essential overlays (never skip just because wording appears in C1).
  for (const p of DISTINCTIVE_PACKAGES) {
    if (!p.whenOfficial.test(desc)) continue;
    if (components.some((c) => c.id === `D-${p.label}`)) continue;
    components.push({
      id: `D-${p.label}`,
      text: p.label,
      tokens: tokenize(p.label),
      distinctive: true,
      performanceOriented: /balance|strip|fluid|filter|apply|inspect/i.test(p.label),
      essential: true,
      exemplar: false,
    });
  }

  return components.slice(0, 12);
}

function corpusText(hits: RetrievalHit[]): {
  strong: string;
  practical: string;
  all: string;
} {
  const usable = hits.filter((h) => !h.rejected);
  const strong = usable.map((h) => h.session.strongText).join(" ");
  const practical = usable.map((h) => h.session.practicalText).join(" ");
  const all = usable.map((h) => h.session.searchableText).join(" ");
  return { strong, practical, all };
}

function componentCovered(
  component: RequirementComponent,
  corpus: { strong: string; practical: string; all: string },
): boolean {
  // Distinctive packages: require package regex, not loose token overlap.
  if (component.id.startsWith("D-")) {
    const pack = DISTINCTIVE_PACKAGES.find((p) => p.label === component.text);
    if (pack) return pack.requireEvidence.test(corpus.all);
  }

  if (!component.tokens.length) return false;
  const needles = expandNeedles(
    component.tokens.filter((t) => t.length >= 4 || isDistinctiveToken(t)),
  );
  const pool = needles.length ? needles : expandNeedles(component.tokens);
  let hits = 0;
  for (const t of pool) {
    if (textHasNeedle(corpus.strong, t) || textHasNeedle(corpus.all, t)) hits += 1;
  }
  // Essentials that are distinctive need slightly stronger token support.
  const need =
    component.essential && component.distinctive
      ? Math.min(2, Math.max(1, Math.ceil(pool.length * 0.2)))
      : 1;
  return hits >= need;
}

export function normalizeEvidenceStrength(
  strength: EvidenceStrength | string | undefined,
): Exclude<EvidenceStrength, "PARTIAL" | "WEAK_REFERENCE"> | undefined {
  if (!strength) return undefined;
  const s = String(strength).toUpperCase();
  if (s === "PARTIAL") return "MATERIAL_PARTIAL";
  if (s === "WEAK_REFERENCE") return "WEAK_ADJACENT";
  if (
    s === "FULL" ||
    s === "NEAR_FULL" ||
    s === "MATERIAL_PARTIAL" ||
    s === "WEAK_ADJACENT" ||
    s === "ABSENT"
  ) {
    return s;
  }
  return undefined;
}

export function assessEvidenceSufficiency(input: {
  ksb: OfficialKsbRef;
  hits: RetrievalHit[];
}): EvidenceSufficiency {
  const components = decomposeOfficialRequirement(input.ksb);
  const corpus = corpusText(input.hits);
  const usable = input.hits.filter((h) => !h.rejected && h.score >= 1.8);
  const reasons: string[] = [];

  if (!usable.length) {
    return {
      components,
      coveredComponents: [],
      missingComponents: components.map((c) => `${c.id}:${c.text.slice(0, 60)}`),
      missingEssentialComponents: components
        .filter((c) => c.essential)
        .map((c) => `${c.id}:${c.text.slice(0, 60)}`),
      coverageStrength: "ABSENT",
      coverageRatio: 0,
      essentialCoverageRatio: 0,
      distinctiveCovered: 0,
      distinctiveTotal: components.filter((c) => c.distinctive && c.essential).length,
      practicalRequired: false,
      practicalPresent: false,
      missingMaterialBreadth: true,
      reasons: ["No usable retrieved evidence."],
    };
  }

  const covered: RequirementComponent[] = [];
  const missing: RequirementComponent[] = [];
  for (const c of components) {
    if (componentCovered(c, corpus)) covered.push(c);
    else missing.push(c);
  }

  // Overlay: distinctive packages must pass their own evidence regex even if a
  // broad parent clause looked covered via generic shared terms.
  for (const p of DISTINCTIVE_PACKAGES) {
    if (!p.whenOfficial.test(input.ksb.description)) continue;
    if (p.requireEvidence.test(corpus.all)) continue;
    const id = `D-${p.label}`;
    if (!missing.some((m) => m.id === id)) {
      missing.push({
        id,
        text: p.label,
        tokens: tokenize(p.label),
        distinctive: true,
        performanceOriented: false,
        essential: true,
        exemplar: false,
      });
    }
    // Remove false "covered" entry for the package id if present
    const idx = covered.findIndex((c) => c.id === id);
    if (idx >= 0) covered.splice(idx, 1);
  }

  const type = String(input.ksb.type || "").toLowerCase();
  const desc = input.ksb.description;
  const practicalRequired =
    type === "skill" ||
    (PERFORMANCE_VERBS.test(desc) &&
      /\b(apply|inspect|remove|replace|repair|test|balance|comply|segregat)\b/i.test(
        desc,
      ));
  const practicalPresent =
    corpus.practical.length > 40 &&
    (PERFORMANCE_VERBS.test(corpus.practical) ||
      /\b(workshop|practical|carry out|task|activity|exercise|role-?play|scenario)\b/i.test(
        corpus.practical,
      ));

  if (practicalRequired && !practicalPresent) {
    reasons.push("Performance/skill wording lacks practical/application evidence.");
  }

  // Behaviour must be deliberate — implication is not enough.
  if (type === "behaviour" || /^b\d/i.test(input.ksb.code)) {
    const explicitBehaviour =
      /\b(behaviour|professional|ethic|attitude|respect|inclusive|teamwork|team working|communication expectation|reflective|observation|adapt|customer (?:care|service) scenario)\b/i.test(
        corpus.strong + " " + corpus.all,
      );
    if (!explicitBehaviour) {
      reasons.push("Behaviour KSBs need deliberate behaviour-specific teaching/scenario.");
      missing.push({
        id: "BEH",
        text: "explicit behaviour-specific teaching",
        tokens: ["behaviour"],
        distinctive: true,
        performanceOriented: false,
        essential: true,
        exemplar: false,
      });
    }
  }

  // Knowledge: related practical alone is weak if no concept signal for soft-covered essentials
  if ((type === "knowledge" || /^k\d/i.test(input.ksb.code)) && covered.length) {
    const conceptSignal =
      /\b(principle|purpose|function|explain|identify|describe|theory|understand|locate|types?|operation|awareness|regulation|procedure)\b/i.test(
        corpus.strong + " " + corpus.all,
      );
    if (!conceptSignal && covered.every((c) => c.exemplar || !c.essential)) {
      reasons.push("Knowledge KSB lacks concept/principle teaching signals.");
    }
  }

  const essentials = components.filter((c) => c.essential);
  const essentialCovered = essentials.filter((c) =>
    covered.some((x) => x.id === c.id),
  );
  const missingEssentials = [
    ...missing.filter((m) => m.essential),
    // BEH injected above
    ...missing.filter((m) => m.id === "BEH"),
  ].filter((m, i, arr) => arr.findIndex((x) => x.id === m.id) === i);

  if (practicalRequired && !practicalPresent) {
    missingEssentials.push({
      id: "PRAC",
      text: "required practical/application evidence",
      tokens: [],
      distinctive: true,
      performanceOriented: true,
      essential: true,
      exemplar: false,
    });
  }

  const coverageRatio = covered.length / Math.max(1, components.length);
  const essentialCoverageRatio =
    essentialCovered.length / Math.max(1, essentials.length || 1);
  const distinctiveEssentials = essentials.filter((c) => c.distinctive);
  const distinctiveCovered = distinctiveEssentials.filter((c) =>
    covered.some((x) => x.id === c.id),
  ).length;

  const missingMaterialBreadth = missingEssentials.length > 0;

  let coverageStrength: EvidenceStrength;
  if (essentialCoverageRatio <= 0 && distinctiveCovered === 0) {
    // Some lexical adjacency may exist via retrieval score.
    coverageStrength =
      usable.some((h) => h.score >= 4) ? "WEAK_ADJACENT" : "ABSENT";
    reasons.push(
      coverageStrength === "WEAK_ADJACENT"
        ? "Adjacent/retrieved topic without essential competence evidence."
        : "No substantive evidence of the core competence.",
    );
  } else if (missingEssentials.length > 0) {
    // Core competence incomplete.
    if (essentialCoverageRatio >= 0.5) {
      coverageStrength = "MATERIAL_PARTIAL";
      reasons.push(
        `Material essential missing: ${missingEssentials.map((m) => m.text).slice(0, 3).join("; ")}`,
      );
    } else {
      coverageStrength = "WEAK_ADJACENT";
      reasons.push("Only weak coverage of essential competence elements.");
    }
  } else if (missing.some((m) => m.exemplar) && essentialCoverageRatio >= 0.99) {
    coverageStrength = "NEAR_FULL";
    reasons.push(
      "Core competence covered; missing items are exemplars/supporting detail only.",
    );
  } else if (essentialCoverageRatio >= 0.99 && coverageRatio >= 0.85) {
    coverageStrength = "FULL";
    reasons.push("Official essential breadth substantively covered.");
  } else if (essentialCoverageRatio >= 0.99) {
    coverageStrength = "NEAR_FULL";
    reasons.push("Essentials covered; supporting detail incomplete.");
  } else {
    coverageStrength = "NEAR_FULL";
    reasons.push("Near-full essential coverage of the official competence.");
  }

  return {
    components,
    coveredComponents: covered.map((c) => `${c.id}:${c.text.slice(0, 60)}`),
    missingComponents: missing.map((c) => `${c.id}:${c.text.slice(0, 60)}`),
    missingEssentialComponents: missingEssentials.map(
      (c) => `${c.id}:${c.text.slice(0, 80)}`,
    ),
    coverageStrength,
    coverageRatio,
    essentialCoverageRatio,
    distinctiveCovered,
    distinctiveTotal: distinctiveEssentials.length,
    practicalRequired,
    practicalPresent,
    missingMaterialBreadth,
    reasons,
  };
}

export function sufficiencyToCoverage(
  strength: EvidenceStrength,
): "covered" | "partial" | "absent" {
  const n = normalizeEvidenceStrength(strength) ?? "ABSENT";
  if (n === "FULL" || n === "NEAR_FULL") return "covered";
  if (n === "MATERIAL_PARTIAL") return "partial";
  return "absent";
}

export function strengthAllowsPrimary(strength: EvidenceStrength): boolean {
  const n = normalizeEvidenceStrength(strength);
  return n === "FULL" || n === "NEAR_FULL";
}
