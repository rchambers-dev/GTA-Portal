/**
 * Skills England Occupational Maps client (documented, X-API-KEY).
 * Server-only — do not import from client components.
 */

const BASE =
  "https://occupational-maps-api.skillsengland.education.gov.uk/api/v1";

const FULL_EXPAND = [
  "occupation.overview",
  "occupation.summary",
  "occupation.soc",
  "occupation.maphierarchy",
  "occupation.typicaljobtitles",
  "occupation.products",
  "occupation.keywords",
  "occupation.involvedemployers",
  "occupation.links",
  "occupation.green",
  "occupation.dutiesKSB",
].join(",");

export class OccupationalMapsClient {
  constructor(private readonly apiKey: string) {
    if (!apiKey?.trim()) {
      throw new Error("SKILLS_ENGLAND_API_KEY is required for Occupational Maps");
    }
  }

  async fetchOccupation(occupationCode: string): Promise<unknown> {
    const code = occupationCode.trim().toUpperCase();
    const url = new URL(`${BASE}/Occupations/${encodeURIComponent(code)}`);
    url.searchParams.set("expand", FULL_EXPAND);
    const res = await fetch(url, {
      headers: {
        Accept: "application/json",
        "X-API-KEY": this.apiKey.trim(),
      },
      cache: "no-store",
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(
        `Occupational Maps ${code} failed (${res.status}): ${text.slice(0, 240)}`,
      );
    }
    return res.json();
  }
}

/**
 * Undocumented Skills England apprenticeship product JSON (website-backed).
 * Soft dependency — callers must tolerate failure / shape change.
 */
export class ApprenticeshipStandardsClient {
  async fetchStandard(standardCode: string): Promise<unknown> {
    const code = standardCode.trim().toUpperCase();
    const url = `https://skillsengland.education.gov.uk/api/apprenticeshipstandards/${encodeURIComponent(code)}`;
    const res = await fetch(url, {
      headers: { Accept: "application/json" },
      cache: "no-store",
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(
        `Apprenticeship standards ${code} failed (${res.status}): ${text.slice(0, 240)}`,
      );
    }
    return res.json();
  }
}

export function resolveApprenticeshipProductCode(mapsOccupation: {
  products?: Array<{ productCode?: string; typeName?: string }>;
}): string | null {
  const products = mapsOccupation.products ?? [];
  const apprenticeship = products.find((p) =>
    String(p.typeName ?? "")
      .toLowerCase()
      .includes("apprenticeship"),
  );
  return apprenticeship?.productCode?.trim().toUpperCase() ?? null;
}
