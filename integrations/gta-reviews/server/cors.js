// Locked to the site origin. Do not reflect the request Origin header.
export const SITE_ORIGIN = "https://gta-reviews-chi.vercel.app";
export const ALLOWED_METHODS = "GET, POST, OPTIONS";
export const ALLOWED_HEADERS = "Authorization, Content-Type";

export function sendPreflight(res) {
  res.setHeader("Access-Control-Allow-Origin", SITE_ORIGIN);
  res.setHeader("Access-Control-Allow-Methods", ALLOWED_METHODS);
  res.setHeader("Access-Control-Allow-Headers", ALLOWED_HEADERS);
  res.setHeader("Vary", "Origin");
  res.statusCode = 204;
  res.end();
}
