export const GTA_TUTORS = [
  { name: "John Pearson", trade: "Bodyshop", email: "" },
  {
    name: "Andrew Ross",
    trade: "Bodyshop",
    email: "",
    emails: [],
    aliases: ["Andy Ross"],
  },
  { name: "Mike Hepworth", trade: "Mechanical", email: "" },
  { name: "Marc Hadfield", trade: "Mechanical", email: "" },
  { name: "Mark Illingworth", trade: "Mechanical", email: "" },
  { name: "Tony Reid", trade: "Mechanical", email: "" },
  { name: "Martin Farthing", trade: "Mechanical", email: "" },
  { name: "Dan Hanmer", trade: "Mechanical", email: "", aliases: ["Dan Hammer"] },
  { name: "Robert Mason", trade: "Mechanical", email: "", aliases: ["Rob Mason"] },
  {
    name: "Murtala Kasimu",
    trade: "Mechanical",
    email: "",
    aliases: ["Murtai Kasimu", "Mtalas Kasimu", "Murtai", "Mtalas"],
  },
  {
    name: "Anne-Marie Sanderson",
    trade: "Business administration",
    email: "",
    aliases: ["Anne Marie Sanderson", "Annemarie Sanderson", "Ann-Marie Sanderson"],
  },
];

export function tutorMatchKey(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function canonTutorName(value) {
  const text = String(value || "").replace(/\s+/g, " ").trim();
  if (!text) return "";
  const key = tutorMatchKey(text);
  for (const tutor of GTA_TUTORS) {
    const names = [tutor.name, ...(tutor.aliases || [])];
    if (names.some((name) => tutorMatchKey(name) === key)) return tutor.name;
  }
  if (/[A-Z]/.test(text) && /[a-z]/.test(text)) return text;
  return text.toLowerCase().replace(/\b([a-z])/g, (letter) => letter.toUpperCase());
}

export function tutorFromEmail(email) {
  const key = String(email || "").trim().toLowerCase();
  return (
    GTA_TUTORS.find(
      (tutor) =>
        tutor.email === key ||
        (tutor.emails || []).some((item) => String(item || "").trim().toLowerCase() === key),
    ) || null
  );
}

export function isTutorEmail(email) {
  return Boolean(tutorFromEmail(email));
}

export function isTutorSession(session) {
  const email = session?.user?.email || "";
  return isTutorEmail(email) || session?.user?.app_metadata?.role === "tutor";
}

export function officialTutorNames() {
  return GTA_TUTORS.map((tutor) => tutor.name);
}

export function tutorRecord(name) {
  const key = tutorMatchKey(name);
  return GTA_TUTORS.find((tutor) => tutorMatchKey(tutor.name) === key) || null;
}

export function mergedTutorNames(...groups) {
  const names = new Map();
  for (const tutor of GTA_TUTORS) {
    names.set(tutorMatchKey(tutor.name), tutor.name);
  }
  for (const group of groups) {
    for (const value of group || []) {
      const name = canonTutorName(value);
      if (!name) continue;
      const key = tutorMatchKey(name);
      if (!names.has(key)) names.set(key, name);
    }
  }
  return [...names.values()].sort((a, b) => a.localeCompare(b));
}
