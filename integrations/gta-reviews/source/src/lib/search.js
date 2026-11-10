import { learnerProfileFrom } from "../planner.js";

export function learnerSearchQuery(input) {
  return (input?.value || "").trim().toLowerCase();
}

export function learnerSearchText(item) {
  const profile = learnerProfileFrom(item);
  return [
    item.name,
    item.company,
    item.postcode,
    profile.tutor,
    profile.apprenticeship,
    profile.gtaReviewer,
    profile.employerContact,
    profile.employerEmail,
    profile.contactNumber,
  ]
    .map((value) => String(value || "").toLowerCase())
    .join(" ");
}

export function matchesQuery(item, query) {
  if (!query) return true;
  return learnerSearchText(item).includes(query);
}

export function filterSearchRows(list, selector, query) {
  if (!list) return null;
  const rows = list.querySelectorAll(selector);
  if (!rows.length) return null;
  let visible = 0;
  rows.forEach((row) => {
    const show = !query || (row.dataset.searchText || "").includes(query);
    row.hidden = !show;
    row.classList.toggle("is-search-hidden", !show);
    if (show) visible += 1;
  });
  return visible;
}
