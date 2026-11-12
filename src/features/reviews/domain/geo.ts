const POSTCODES_API = "https://api.postcodes.io";
const POSTCODES_URL = `${POSTCODES_API}/postcodes`;
const OSRM_TABLE = "https://router.project-osrm.org/table/v1/driving";
const OSRM_ROUTE = "https://router.project-osrm.org/route/v1/driving";

export type GeoPoint = { lat: number; lon: number; formatted?: string };

export type DriveMatrix = {
  durations: number[][];
  distances: number[][];
  source: "osrm" | "estimate" | "none";
};

export function normalisePostcode(value: string): string {
  return String(value || "")
    .replace(/\s+/g, "")
    .toUpperCase();
}

export function formatPostcode(value: string): string {
  const compact = normalisePostcode(value);
  if (compact.length < 5) return compact;
  return `${compact.slice(0, -3)} ${compact.slice(-3)}`;
}

export async function geocodePostcodes(postcodes: string[]): Promise<Record<string, GeoPoint>> {
  const unique = [...new Set(postcodes.map(formatPostcode).filter(Boolean))];
  if (!unique.length) return {};
  const lookup: Record<string, GeoPoint> = {};

  try {
    const response = await fetch(POSTCODES_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ postcodes: unique }),
    });
    if (response.ok) {
      const payload = (await response.json()) as {
        result?: { query: string; result?: { latitude: number; longitude: number; postcode: string } | null }[];
      };
      for (const row of payload.result || []) {
        if (!row?.result) continue;
        lookup[normalisePostcode(row.query)] = {
          lat: row.result.latitude,
          lon: row.result.longitude,
          formatted: row.result.postcode,
        };
      }
    }
  } catch {
    // Fall through to one-by-one lookups.
  }

  const missing = unique.filter((postcode) => !lookup[normalisePostcode(postcode)]);
  await Promise.all(
    missing.map(async (postcode) => {
      const point = await geocodeOne(postcode);
      if (point) lookup[normalisePostcode(postcode)] = point;
    }),
  );
  return lookup;
}

async function geocodeOne(postcode: string): Promise<GeoPoint | null> {
  const compact = encodeURIComponent(formatPostcode(postcode));
  for (const path of ["postcodes", "terminated_postcodes"]) {
    try {
      const response = await fetch(`${POSTCODES_API}/${path}/${compact}`);
      if (!response.ok) continue;
      const payload = (await response.json()) as {
        result?: { latitude?: number; longitude?: number; postcode?: string };
      };
      const result = payload.result;
      if (result?.latitude == null || result?.longitude == null) continue;
      return { lat: result.latitude, lon: result.longitude, formatted: result.postcode || formatPostcode(postcode) };
    } catch {
      // Try the next lookup path.
    }
  }
  return null;
}

function haversineKm(a: GeoPoint, b: GeoPoint): number {
  const earthKm = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLon = ((b.lon - a.lon) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * earthKm * Math.asin(Math.min(1, Math.sqrt(h)));
}

function fallbackMatrix(points: GeoPoint[]): DriveMatrix {
  const n = points.length;
  const durations = Array.from({ length: n }, () => Array(n).fill(0));
  const distances = Array.from({ length: n }, () => Array(n).fill(0));
  for (let i = 0; i < n; i += 1) {
    for (let j = 0; j < n; j += 1) {
      if (i === j) continue;
      const km = haversineKm(points[i], points[j]) * 1.35;
      distances[i][j] = km * 1000;
      durations[i][j] = (km / 38) * 3600;
    }
  }
  return { durations, distances, source: "estimate" };
}

export async function drivingMatrix(points: GeoPoint[]): Promise<DriveMatrix> {
  if (points.length < 2) return { durations: [[0]], distances: [[0]], source: "none" };
  const coords = points.map((point) => `${point.lon},${point.lat}`).join(";");
  const url = `${OSRM_TABLE}/${coords}?annotations=duration,distance`;
  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error("routing failed");
    const payload = (await response.json()) as { durations?: number[][]; distances?: number[][] };
    if (!payload.durations) throw new Error("routing failed");
    return { durations: payload.durations, distances: payload.distances || [], source: "osrm" };
  } catch {
    return fallbackMatrix(points);
  }
}

export async function drivingGeometry(points: GeoPoint[]): Promise<{ coordinates: [number, number][] } | null> {
  if (points.length < 2) return null;
  const coords = points.map((point) => `${point.lon},${point.lat}`).join(";");
  const url = `${OSRM_ROUTE}/${coords}?overview=full&geometries=geojson`;
  try {
    const response = await fetch(url);
    if (!response.ok) return null;
    const payload = (await response.json()) as { routes?: { geometry?: { coordinates: [number, number][] } }[] };
    return payload.routes?.[0]?.geometry || null;
  } catch {
    return null;
  }
}
