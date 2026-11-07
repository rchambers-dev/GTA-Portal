export const GTA_STAFF = [
  {
    name: "Lucy Butler",
    title: "Administration",
    email: "lucybutler@doncastergta.co.uk",
  },
];

// Office staff can access: learner records, reviews, archive
export const OFFICE_PAGES = ["records", "reviews", "archive"];

// Admin can access ALL pages except tutor-specific reviews-only view
export const ADMIN_PAGES = ["records", "plan", "out", "reviews", "archive", "analytics"];

// Tutors stay on reviews. Office and admin stay inside their page lists.
// A phone Out session uses the field page, and a switched-off Out page
// falls back to records for office and admin, otherwise the plan.
export function gatedPage(page, {
  tutorMode = false,
  officeMode = false,
  adminMode = false,
  phoneOut = false,
  outEnabled = true,
} = {}) {
  let nextPage = page;
  if (tutorMode) nextPage = "reviews";
  else if (adminMode && !ADMIN_PAGES.includes(nextPage)) nextPage = "records";
  else if (officeMode && !OFFICE_PAGES.includes(nextPage)) nextPage = "records";
  else if (phoneOut) nextPage = "out";
  if (nextPage === "out" && !outEnabled) nextPage = officeMode || adminMode ? "records" : "plan";
  return nextPage;
}

function staffEmailKey(value) {
  return String(value || "").trim().toLowerCase();
}

export function staffFromEmail(email) {
  const key = staffEmailKey(email);
  return GTA_STAFF.find((item) => item.email === key) || null;
}

export function isStaffEmail(email) {
  return Boolean(staffFromEmail(email));
}

export function isOfficeSession(session) {
  const email = session?.user?.email || "";
  const role = String(session?.user?.app_metadata?.role || "")
    .trim()
    .toLowerCase();
  return isStaffEmail(email) || role === "office";
}

export function isAdminSession(session) {
  const role = String(session?.user?.app_metadata?.role || "")
    .trim()
    .toLowerCase();
  return role === "admin";
}
