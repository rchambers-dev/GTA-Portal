const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function portalStaff() {
  const value = globalThis.__PORTAL_REVIEW_STAFF__;
  if (!Array.isArray(value)) return null;
  return value.filter((item) => item && UUID.test(String(item.id || "")) && String(item.name || "").trim());
}

export function portalTutorMode() {
  return portalStaff() !== null;
}

export function tutorLabel(value) {
  const staff = portalStaff();
  const text = String(value || "").trim();
  if (!staff) return text;
  return staff.find((item) => item.id === text)?.name || "Unassigned";
}

export const GTA_TUTORS = [];

export function defaultGtaReviewer() {
  const session = globalThis.__PORTAL_REVIEW_SESSION__;
  const staff = globalThis.__PORTAL_REVIEW_STAFF__;
  if (!session?.user || !Array.isArray(staff)) return "";
  return staff.find((item) => item.id === session.user.id)?.name || "";
}

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
  const staff = portalStaff();
  if (staff) return staff.some((item) => item.id === text) ? text : "";
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
  const staff = portalStaff();
  if (staff) return staff.map((item) => item.id);
  return [];
}

export function tutorRecord(name) {
  const key = tutorMatchKey(name);
  return GTA_TUTORS.find((tutor) => tutorMatchKey(tutor.name) === key) || null;
}

export function mergedTutorNames(...groups) {
  const staff = portalStaff();
  if (staff) return staff.map((item) => item.id).sort((a, b) => a.localeCompare(b));
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
