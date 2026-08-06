/**
 * Temporary Skills England Occupational Maps API client.
 * Docs: https://occupational-maps.skillsengland.education.gov.uk/public-api/
 * Swagger: https://occupational-maps-api.skillsengland.education.gov.uk/swagger/index.html
 */

export const BASE_URL =
  "https://occupational-maps-api.skillsengland.education.gov.uk/api/v1";

export function getApiKey() {
  const key = process.env.SKILLS_ENGLAND_API_KEY?.trim();
  if (!key) {
    throw new Error(
      "Missing SKILLS_ENGLAND_API_KEY. Add it to .env.local and run with --env-file=.env.local",
    );
  }
  return key;
}

/**
 * @param {string} path - path after /api/v1 (leading slash optional)
 * @param {Record<string, string | undefined>} [query]
 */
export async function seFetch(path, query = {}) {
  const url = new URL(
    path.startsWith("http")
      ? path
      : `${BASE_URL}/${path.replace(/^\//, "")}`,
  );
  for (const [k, v] of Object.entries(query)) {
    if (v != null && v !== "") url.searchParams.set(k, v);
  }

  const res = await fetch(url, {
    headers: {
      Accept: "application/json",
      "X-API-KEY": getApiKey(),
    },
  });

  const text = await res.text();
  let body;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }

  return {
    ok: res.ok,
    status: res.status,
    url: url.toString(),
    body,
  };
}
