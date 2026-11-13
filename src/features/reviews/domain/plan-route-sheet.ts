import { formatNoteDate } from "./plan-notes";
import type { PackedDay } from "./plan-route";
import type { PlanPageData, PlanStop } from "./plan-repository";
import { minutesToTime, weekdayName } from "./plan-due";

/** The Review Assistant always addresses the route email here, then any extra addresses. */
export const DEFAULT_ROUTE_EMAIL = "reiss.kc@gmail.com";

export type RouteSheetStop = PlanStop & { arriveMinutes: number | null; leaveMinutes: number | null };

export function formatSheetPostcode(value: string): string {
  const compact = value.replace(/\s+/g, "").toUpperCase();
  if (compact.length < 5) return compact;
  return `${compact.slice(0, -3)} ${compact.slice(-3)}`;
}

export function formatDriveDuration(totalMinutes: number): string {
  const rounded = Math.max(0, Math.round(totalMinutes));
  if (rounded < 60) return `${rounded} min`;
  const hours = Math.floor(rounded / 60);
  const minutes = rounded % 60;
  if (!minutes) return `${hours} hr`;
  return `${hours} hr ${minutes} min`;
}

export function routeDateLabel(date: string): string {
  return `${weekdayName(date)} ${formatNoteDate(date)}`;
}

export function googleMapsDirUrl(origin: string, waypoints: string[], destination: string): string {
  return `https://www.google.com/maps/dir/${[origin, ...waypoints, destination].map((postcode) => encodeURIComponent(formatSheetPostcode(postcode))).join("/")}`;
}

export function routeEmailAddresses(extraEmails: string[]): string[] {
  const extras = [...new Set(extraEmails.map((email) => email.trim()).filter(Boolean))].filter(
    (email) => email.toLowerCase() !== DEFAULT_ROUTE_EMAIL.toLowerCase(),
  );
  return [DEFAULT_ROUTE_EMAIL, ...extras];
}

function placeLine(stop: RouteSheetStop): string {
  return [stop.company, stop.postcode, stop.tutor ? `tutor ${stop.tutor}` : "tutor not set", stop.releaseDay ? `college ${stop.releaseDay}` : ""]
    .filter(Boolean)
    .join(" · ");
}

export function sheetStops(stops: PlanStop[], packed: PackedDay | null): RouteSheetStop[] {
  const times = new Map((packed?.stops ?? []).map((stop) => [stop.id, stop]));
  return stops.map((stop) => {
    const timed = times.get(stop.gtaId);
    return {
      ...stop,
      arriveMinutes: timed?.arrive ?? stop.arriveMinutes,
      leaveMinutes: timed?.leave ?? stop.leaveMinutes,
    };
  });
}

export function buildRouteEmail(page: PlanPageData, stops: RouteSheetStop[], date: string, packed: PackedDay | null): { subject: string; body: string; href: string } {
  const label = routeDateLabel(date);
  const visits = stops.filter((stop) => stop.kind !== "phone");
  const phones = stops.filter((stop) => stop.kind === "phone");
  const leave = minutesToTime(packed?.leaveMinutes ?? null) || page.settings.startTime;
  const back = minutesToTime(packed?.returnArrive ?? null);
  const maps = googleMapsDirUrl(page.settings.officePostcode, visits.map((stop) => stop.postcode), page.settings.officePostcode);
  const lines = [
    `${label} workplace review round`,
    "",
    "Google Maps route:",
    maps,
    "",
    `Leave office ${page.settings.officePostcode} at ${leave}`,
    ...phones.map((stop) => `Phone ${stop.name} ${minutesToTime(stop.arriveMinutes)}–${minutesToTime(stop.leaveMinutes)} (${placeLine(stop)}, 20 min)`),
    ...visits.map((stop, index) => `${index + 1}. ${stop.name}${stop.company ? `, ${stop.company}` : ""}, ${stop.postcode}, arrive ${minutesToTime(stop.arriveMinutes)}, leave ${minutesToTime(stop.leaveMinutes)}`),
    `Back at office ${back}`,
  ];
  const subject = `${label} review round`;
  const body = lines.join("\r\n");
  const href = `mailto:${routeEmailAddresses(page.settings.extraEmails).join(",")}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  return { subject, body, href };
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char] || char);
}

export function buildRoutePrintHtml(page: PlanPageData, stops: RouteSheetStop[], date: string, packed: PackedDay | null): string {
  const label = routeDateLabel(date);
  const visits = stops.filter((stop) => stop.kind !== "phone");
  const phones = stops.filter((stop) => stop.kind === "phone");
  const leave = minutesToTime(packed?.leaveMinutes ?? null) || page.settings.startTime;
  const back = minutesToTime(packed?.returnArrive ?? null);
  const drive = packed?.driveTotal ? ` · ${escapeHtml(formatDriveDuration(packed.driveTotal))} driving` : "";
  const phoneHtml = phones
    .map((stop) => {
      return `<article class="print-stop"><div class="print-when">${escapeHtml(minutesToTime(stop.arriveMinutes))}–${escapeHtml(minutesToTime(stop.leaveMinutes))}</div><div><h2>Phone · ${escapeHtml(stop.name || "Learner")}</h2><p>${escapeHtml(placeLine(stop))}</p></div></article>`;
    })
    .join("");
  const visitHtml = visits
    .map((stop, index) => {
      const details = [stop.company, stop.postcode, stop.releaseDay ? `college ${stop.releaseDay}` : "", stop.contact ? `contact ${stop.contact}` : "", stop.phone]
        .filter(Boolean)
        .join(" · ");
      return `<article class="print-stop"><div class="print-when">${escapeHtml(minutesToTime(stop.arriveMinutes))}–${escapeHtml(minutesToTime(stop.leaveMinutes))}</div><div><h2>${index + 1}. ${escapeHtml(stop.name || "Learner")}</h2><p>${escapeHtml(details || "No workplace details")}</p><p>Tutor ${escapeHtml(stop.tutor || "not set")}</p></div></article>`;
    })
    .join("");
  return `<!doctype html><html lang="en"><head><meta charset="utf-8" /><title>${escapeHtml(label)} review round</title><style>html,body{background:#fff;color:#111}body{font:13px/1.4 Calibri,Arial,sans-serif;color:#111;margin:24px}h1,h2,p,.print-when,.lede,.end{color:#111}h1{font-size:22px;margin:0 0 4px}.lede{margin:0 0 18px;color:#444}.print-stop{display:grid;grid-template-columns:92px 1fr;gap:12px;padding:10px 0;border-top:1px solid #ccc}.print-when{font-weight:700}h2{font-size:16px;margin:0 0 4px}p{margin:0 0 2px}.end{border-top:1px solid #111;margin-top:8px;padding-top:10px;font-weight:700}@media print{body{margin:12mm;background:#fff;color:#111}}</style></head><body><h1>${escapeHtml(label)} workplace review round</h1><p class="lede">Leave ${escapeHtml(page.settings.officePostcode)} at ${escapeHtml(leave)} · ${visits.length} visit${visits.length === 1 ? "" : "s"}${drive}</p>${phoneHtml}${visitHtml}<p class="end">Back at ${escapeHtml(page.settings.officePostcode)} at ${escapeHtml(back)}</p></body></html>`;
}
