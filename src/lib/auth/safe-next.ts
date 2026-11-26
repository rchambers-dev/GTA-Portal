/** Same-origin relative path for the login next parameter. Anything else stays on /. */

const MAX_DECODE = 3;

export function safeNextPath(raw: string | null | undefined): string {
  if (typeof raw !== "string") return "/";
  let value = raw.trim();
  if (!value || value.length > 2000) return "/";
  for (let i = 0; i < MAX_DECODE; i += 1) {
    if (!value.includes("%")) break;
    try {
      const decoded = decodeURIComponent(value);
      if (decoded === value) break;
      value = decoded.trim();
    } catch {
      return "/";
    }
  }
  if (!value.startsWith("/")) return "/";
  if (value.startsWith("//") || value.startsWith("/\\") || value.startsWith("/\t")) return "/";
  if (value.includes("\\") || value.includes("\0") || /[\u0000-\u001f]/.test(value)) return "/";
  if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(value)) return "/";
  return value;
}
