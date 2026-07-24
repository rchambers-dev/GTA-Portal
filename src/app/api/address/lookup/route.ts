import { NextResponse } from "next/server";
import { maskUkPostcode } from "@/features/learner-portal/domain/cv/validation";

export const runtime = "nodejs";

type AddressSuggestion = {
  id: string;
  label: string;
  line: string;
};

const UK_POSTCODE_RE = /^[A-Z]{1,2}\d[A-Z\d]?\s?\d[A-Z]{2}$/;

function tidyPostcode(value: string): string {
  return maskUkPostcode(value).trim().toUpperCase();
}

function normalisePostcode(value: string): string {
  return value.replace(/\s+/g, "").toUpperCase();
}

function houseMatches(candidate: string, house: string): boolean {
  const needle = house.trim().toLowerCase();
  if (!needle) return true;
  const head = candidate.trim().toLowerCase();
  if (head.startsWith(needle)) return true;
  const firstToken = head.split(/[,\s]/)[0] ?? "";
  return firstToken === needle || firstToken.replace(/^flat\s*/i, "") === needle;
}

function uniqueSuggestions(rows: AddressSuggestion[]): AddressSuggestion[] {
  const seen = new Set<string>();
  const out: AddressSuggestion[] = [];
  for (const row of rows) {
    const key = row.line.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(row);
  }
  return out;
}

/** getAddress.io — full Royal Mail-style lines when GETADDRESS_API_KEY is set. */
async function lookupGetAddress(
  house: string,
  postcode: string,
  apiKey: string,
): Promise<AddressSuggestion[]> {
  const encodedPostcode = encodeURIComponent(postcode);
  const encodedHouse = encodeURIComponent(house);
  const urls = [
    `https://api.getAddress.io/get/${encodedPostcode}/${encodedHouse}?api-key=${encodeURIComponent(apiKey)}`,
    `https://api.getAddress.io/find/${encodedPostcode}?api-key=${encodeURIComponent(apiKey)}&expand=true`,
  ];

  for (const url of urls) {
    const res = await fetch(url, {
      headers: { Accept: "application/json" },
      cache: "no-store",
    });
    if (!res.ok) continue;
    const data = (await res.json()) as {
      addresses?: Array<
        | string
        | {
            formatted_address?: string[];
            line_1?: string;
            town_or_city?: string;
            county?: string;
            postcode?: string;
          }
      >;
    };
    const addresses = Array.isArray(data.addresses) ? data.addresses : [];
    const mapped: AddressSuggestion[] = addresses
      .map((entry, index) => {
        if (typeof entry === "string") {
          const line = entry
            .split(",")
            .map((part) => part.trim())
            .filter(Boolean)
            .join(", ");
          return {
            id: `ga-${index}-${line.slice(0, 24)}`,
            label: line,
            line,
          };
        }
        const formatted = Array.isArray(entry.formatted_address)
          ? entry.formatted_address.filter(Boolean).join(", ")
          : [entry.line_1, entry.town_or_city, entry.county, entry.postcode]
              .filter(Boolean)
              .join(", ");
        if (!formatted) return null;
        return {
          id: `ga-${index}-${formatted.slice(0, 24)}`,
          label: formatted,
          line: formatted,
        };
      })
      .filter((row): row is AddressSuggestion => Boolean(row));

    const filtered = mapped.filter((row) => houseMatches(row.line, house));
    const pick = filtered.length > 0 ? filtered : mapped;
    if (pick.length > 0) return uniqueSuggestions(pick).slice(0, 12);
  }
  return [];
}

/**
 * Free path: validate the postcode and compose a CV line from house number +
 * locality. House + postcode is enough to identify a property for most CVs;
 * street-level lines need getAddress.io.
 */
async function lookupPostcodesIo(
  house: string,
  postcode: string,
): Promise<AddressSuggestion[]> {
  const res = await fetch(
    `https://api.postcodes.io/postcodes/${encodeURIComponent(postcode)}`,
    { headers: { Accept: "application/json" }, cache: "no-store" },
  );
  if (!res.ok) return [];
  const data = (await res.json()) as {
    result?: {
      postcode?: string;
      admin_ward?: string;
      parish?: string;
      admin_district?: string;
      region?: string;
    };
  };
  const result = data.result;
  if (!result?.postcode) return [];

  const locality =
    result.parish ||
    result.admin_ward ||
    result.admin_district ||
    result.region ||
    "";
  const district =
    result.admin_district && result.admin_district !== locality
      ? result.admin_district
      : "";
  const line = [house, locality, district, result.postcode]
    .map((part) => String(part || "").trim())
    .filter(Boolean)
    .join(", ");

  return [
    {
      id: `pci-${normalisePostcode(result.postcode)}-${house}`,
      label: line,
      line,
    },
  ];
}

type NominatimHit = {
  place_id?: number;
  display_name?: string;
  address?: {
    house_number?: string;
    house_name?: string;
    road?: string;
    residential?: string;
    suburb?: string;
    village?: string;
    town?: string;
    city?: string;
    city_district?: string;
    county?: string;
    state_district?: string;
    postcode?: string;
  };
};

function formatNominatimLine(hit: NominatimHit, house: string, postcode: string): string {
  const a = hit.address ?? {};
  const number = (a.house_number || a.house_name || house).trim();
  const street = (a.road || a.residential || "").trim();
  const locality =
    a.village ||
    a.town ||
    a.suburb ||
    a.city_district ||
    a.city ||
    a.state_district ||
    "";
  const county = a.county || "";
  const code = (a.postcode || postcode).trim().toUpperCase();
  const parts = [
    street ? `${number} ${street}` : number,
    locality,
    county,
    code,
  ]
    .map((part) => part.trim())
    .filter(Boolean);
  if (parts.length >= 2) return parts.join(", ");
  return (hit.display_name || `${house}, ${postcode}`)
    .split(",")
    .map((part) => part.trim())
    .filter((part) => !/^united kingdom$/i.test(part))
    .join(", ");
}

/** Only keep Nominatim hits whose postcode matches exactly. */
async function lookupNominatimStrict(
  house: string,
  postcode: string,
): Promise<AddressSuggestion[]> {
  const url = new URL("https://nominatim.openstreetmap.org/search");
  url.searchParams.set("q", `${house}, ${postcode}, UK`);
  url.searchParams.set("countrycodes", "gb");
  url.searchParams.set("format", "json");
  url.searchParams.set("addressdetails", "1");
  url.searchParams.set("limit", "10");

  const res = await fetch(url.toString(), {
    headers: {
      Accept: "application/json",
      "User-Agent": "GTA-Portal-CV-Builder/1.0 (learner address lookup)",
    },
    cache: "no-store",
  });
  if (!res.ok) return [];
  const data = (await res.json()) as NominatimHit[];
  if (!Array.isArray(data)) return [];

  const want = normalisePostcode(postcode);
  return uniqueSuggestions(
    data
      .filter((hit) => normalisePostcode(hit.address?.postcode || "") === want)
      .map((hit, index) => {
        const line = formatNominatimLine(hit, house, postcode);
        return {
          id: `osm-${hit.place_id ?? index}`,
          label: line,
          line,
        };
      }),
  ).slice(0, 8);
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const house = (searchParams.get("house") || "").trim();
  const postcode = tidyPostcode(searchParams.get("postcode") || "");

  if (!house) {
    return NextResponse.json(
      { error: "Enter a house number (or flat) first." },
      { status: 400 },
    );
  }
  if (!postcode || !UK_POSTCODE_RE.test(postcode)) {
    return NextResponse.json(
      { error: "Enter a valid UK postcode first." },
      { status: 400 },
    );
  }

  try {
    const apiKey = process.env.GETADDRESS_API_KEY?.trim();
    let suggestions: AddressSuggestion[] = [];
    let provider = "none";

    if (apiKey) {
      suggestions = await lookupGetAddress(house, postcode, apiKey);
      if (suggestions.length > 0) provider = "getaddress";
    }

    if (suggestions.length === 0) {
      suggestions = await lookupNominatimStrict(house, postcode);
      if (suggestions.length > 0) provider = "nominatim";
    }

    if (suggestions.length === 0) {
      suggestions = await lookupPostcodesIo(house, postcode);
      if (suggestions.length > 0) provider = "postcodes.io";
    }

    if (suggestions.length === 0) {
      return NextResponse.json(
        {
          error:
            "No address found for that house number and postcode. Check both and try again.",
          suggestions: [],
          provider,
        },
        { status: 404 },
      );
    }

    return NextResponse.json({ suggestions, provider });
  } catch (err) {
    return NextResponse.json(
      {
        error:
          err instanceof Error
            ? err.message
            : "Address lookup failed. Try again in a moment.",
      },
      { status: 502 },
    );
  }
}
