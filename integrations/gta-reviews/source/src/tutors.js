export const GTA_TUTORS = [
  { name: "John Pearson", trade: "Bodyshop", email: "johnpearson@doncastergta.co.uk" },
  {
    name: "Andrew Ross",
    trade: "Bodyshop",
    email: "andrewross@doncastergta.co.uk",
    emails: ["tutordemo@doncastergta.co.uk"],
    aliases: ["Andy Ross"],
  },
  { name: "Mike Hepworth", trade: "Mechanical", email: "mikehepworth@doncastergta.co.uk" },
  { name: "Marc Hadfield", trade: "Mechanical", email: "marchadfield@doncastergta.co.uk" },
  { name: "Mark Illingworth", trade: "Mechanical", email: "markillingworth@doncastergta.co.uk" },
  { name: "Tony Reid", trade: "Mechanical", email: "tonyreid@doncastergta.co.uk" },
  { name: "Martin Farthing", trade: "Mechanical", email: "martinfarthing@doncastergta.co.uk" },
  { name: "Dan Hanmer", trade: "Mechanical", email: "danhammer@doncastergta.co.uk", aliases: ["Dan Hammer"] },
  { name: "Robert Mason", trade: "Mechanical", email: "robertmason@doncastergta.co.uk", aliases: ["Rob Mason"] },
  {
    name: "Murtala Kasimu",
    trade: "Mechanical",
    email: "murtaikasimu@doncastergta.co.uk",
    aliases: ["Murtai Kasimu", "Mtalas Kasimu", "Murtai", "Mtalas"],
  },
  {
    name: "Anne-Marie Sanderson",
    trade: "Business administration",
    email: "annemariesanderson@doncastergta.co.uk",
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
