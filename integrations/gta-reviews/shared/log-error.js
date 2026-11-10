// Logs a label plus safe diagnostics. Never log error.message: provider
// errors can include tokens, keys, or response bodies.
const SAFE_CODE = /^[A-Za-z0-9_.:-]{1,64}$/;
const SAFE_ROUTE = /^\/[A-Za-z0-9/_.-]{1,80}$/;

function httpStatus(status) {
  const code = Number(status);
  return Number.isInteger(code) && code >= 100 && code <= 599 ? code : null;
}

export function logClientError(label, details) {
  const status = typeof details === "number" ? details : details?.status;
  const code = typeof details === "object" && details ? details.code : undefined;
  const route = typeof details === "object" && details ? details.route : undefined;
  let line = String(label || "Request failed");
  if (typeof details === "number") {
    const http = httpStatus(status);
    if (http) line += ` (HTTP ${http})`;
  } else {
    const extras = [];
    const safeCode = SAFE_CODE.test(String(code ?? "")) ? String(code) : "";
    const safeRoute = SAFE_ROUTE.test(String(route ?? "")) ? String(route) : "";
    const http = httpStatus(status);
    if (safeCode) extras.push(`code=${safeCode}`);
    if (http) extras.push(`HTTP ${http}`);
    if (safeRoute) extras.push(`route=${safeRoute}`);
    if (extras.length) line += ` (${extras.join(" ")})`;
  }
  console.error(line);
}
