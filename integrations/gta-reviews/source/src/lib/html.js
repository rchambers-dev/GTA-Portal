// Null and undefined become "" before escaping. The main.js copy stringified
// those to the words "null" and "undefined"; the character replacements match.
export function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

export function cssEscape(value) {
  const text = String(value);
  if (typeof CSS !== "undefined" && typeof CSS.escape === "function") return CSS.escape(text);
  return text.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}
