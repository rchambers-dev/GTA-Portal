const res = await fetch(
  "https://skillsengland.education.gov.uk/api/apprenticeshipstandards/ST0499",
  { headers: { Accept: "application/json" } },
);
const j = await res.json();

function walk(obj, path = "", out = []) {
  if (obj == null || typeof obj !== "object") return out;
  for (const [k, v] of Object.entries(obj)) {
    const p = path ? `${path}.${k}` : k;
    const kl = k.toLowerCase();
    const hit =
      /fund|duration|hour|assess|lars|version|month|epa|otj|compliance|maximum|typical|level|status|reference|route|approved|updated|date/.test(
        kl,
      );
    if (hit && (v == null || ["string", "number", "boolean"].includes(typeof v))) {
      out.push([p, v]);
    } else if (v && typeof v === "object" && !Array.isArray(v) && path.split(".").length < 3) {
      walk(v, p, out);
    }
  }
  return out;
}

console.log("top-level keys:", Object.keys(j).join(", "));
console.log("--- fields of interest ---");
for (const [p, v] of walk(j)) console.log(`${p}: ${JSON.stringify(v)}`);
