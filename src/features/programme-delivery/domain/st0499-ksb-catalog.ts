/**
 * ST0499 / OCC0499 Autocare Technician — versioned official KSB catalogues.
 * Sourced from Skills England occupation pages (Jul 2026 snapshot).
 *
 * These are the **standard** Knowledge / Skills / Behaviours statements.
 * They are not the same as apprentice RPL K/S/B % steppers on funding screens.
 */

import catalogJson from "./st0499-ksb-catalog.json";

export type KsbKind = "knowledge" | "skills" | "behaviours";

export type OfficialKsbItem = {
  code: string;
  kind: KsbKind;
  statement: string;
};

export type OfficialKsbVersion = {
  occupationCode: string;
  standardCode: string;
  occupationVersion: string;
  status: "approved" | "retired";
  apprenticeshipVersions: string[];
  fundingBandGbp: number;
  typicalDurationMonths: number;
  notes: string;
  sources: string[];
  counts: {
    knowledge: number;
    skills: number;
    behaviours: number;
  };
  ksbs: OfficialKsbItem[];
};

export type OfficialKsbCatalog = {
  generatedFrom: string;
  versions: OfficialKsbVersion[];
};

export const ST0499_KSB_CATALOG = catalogJson as OfficialKsbCatalog;

/** Newest occupation catalogue (aligned to ST0499 v1.3). */
export function latestSt0499KsbVersion(): OfficialKsbVersion {
  const approved = ST0499_KSB_CATALOG.versions.find((v) => v.status === "approved");
  if (approved) return approved;
  return ST0499_KSB_CATALOG.versions[ST0499_KSB_CATALOG.versions.length - 1]!;
}

export function st0499KsbVersion(
  occupationVersion: string,
): OfficialKsbVersion | undefined {
  return ST0499_KSB_CATALOG.versions.find(
    (v) => v.occupationVersion === occupationVersion,
  );
}

/** Map a Skills England apprenticeship version (e.g. "1.3") to its KSB pack. */
export function st0499KsbForApprenticeshipVersion(
  apprenticeshipVersion: string,
): OfficialKsbVersion | undefined {
  const needle = apprenticeshipVersion.replace(/^v/i, "");
  return ST0499_KSB_CATALOG.versions.find((v) =>
    v.apprenticeshipVersions.includes(needle),
  );
}

export type KsbVersionDiff = {
  fromVersion: string;
  toVersion: string;
  added: OfficialKsbItem[];
  removed: OfficialKsbItem[];
  changed: Array<{
    code: string;
    from: string;
    to: string;
  }>;
  /** Skill codes that only renumbered (same statement text, different code). */
  renumbered: Array<{ fromCode: string; toCode: string; statement: string }>;
};

/**
 * Compare two occupation KSB packs.
 * Prefer statement-text matching for skills so renumbers (S11→S10) are not
 * misread as edits to the same code.
 */
export function diffSt0499KsbVersions(
  fromVersion: string,
  toVersion: string,
): KsbVersionDiff | null {
  const from = st0499KsbVersion(fromVersion);
  const to = st0499KsbVersion(toVersion);
  if (!from || !to) return null;

  const fromRemaining = new Map(from.ksbs.map((k) => [k.code, k]));
  const toRemaining = new Map(to.ksbs.map((k) => [k.code, k]));
  const renumbered: KsbVersionDiff["renumbered"] = [];
  const changed: KsbVersionDiff["changed"] = [];

  // 1) Exact statement matches across different codes → renumber
  for (const [toCode, toItem] of [...toRemaining]) {
    const fromMatch = [...fromRemaining.values()].find(
      (f) => f.statement === toItem.statement && f.code !== toCode,
    );
    if (!fromMatch) continue;
    renumbered.push({
      fromCode: fromMatch.code,
      toCode,
      statement: toItem.statement,
    });
    fromRemaining.delete(fromMatch.code);
    toRemaining.delete(toCode);
  }

  // 2) Same code remaining → unchanged or edited
  for (const [code, toItem] of [...toRemaining]) {
    const fromItem = fromRemaining.get(code);
    if (!fromItem) continue;
    if (fromItem.statement !== toItem.statement) {
      changed.push({
        code,
        from: fromItem.statement,
        to: toItem.statement,
      });
    }
    fromRemaining.delete(code);
    toRemaining.delete(code);
  }

  return {
    fromVersion,
    toVersion,
    added: [...toRemaining.values()],
    removed: [...fromRemaining.values()],
    changed,
    renumbered,
  };
}
