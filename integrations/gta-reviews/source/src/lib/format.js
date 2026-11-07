import {
  dateFromKey,
  DEFAULT_ROUTE_EMAIL,
  formatDuration,
  formatShortDate,
  formatWeeksAndDays,
  weekContaining,
} from "../planner.js";

export function formatPlanTitleDate(dateKey) {
  const date = dateFromKey(dateKey);
  if (!date) return null;
  const day = date.getDate();
  const teen = day % 100;
  const suffix =
    teen >= 11 && teen <= 13 ? "th" : { 1: "st", 2: "nd", 3: "rd" }[day % 10] || "th";
  const month = date.toLocaleDateString("en-GB", { month: "long" });
  return { day, suffix, month };
}

export function formatDateKeyLabel(dateKey) {
  const date = dateFromKey(dateKey);
  return date ? formatShortDate(date) : "";
}

export function formatWeekLabel(dateKey) {
  const week = weekContaining(dateKey);
  if (!week) return formatDateKeyLabel(dateKey);
  if (week.startKey === week.endKey) return formatDateKeyLabel(week.startKey);
  return `${formatDateKeyLabel(week.startKey)} – ${formatDateKeyLabel(week.endKey)}`;
}

export function formatDueSpan(due) {
  if (due?.daysUntil == null) return "";
  if (due.window === "behind") return `${formatWeeksAndDays(due.daysUntil)} overdue`;
  if (due.state === "due-soon") return "due this week";
  if (due.daysUntilStart === 0) return "due this week";
  return `due in ${formatWeeksAndDays(due.daysUntilStart)}`;
}

export function formatNextNeededSpan(due) {
  if (due?.daysUntilNeeded == null) return "";
  const span = formatWeeksAndDays(due.daysUntilNeeded);
  if (due.daysUntilNeeded < 0) return `${span} ago`;
  if (due.daysUntilNeeded === 0) return "this week";
  return `in ${span}`;
}

export function formatClock(now, phone = false) {
  if (phone) {
    const date = now.toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "2-digit",
      year: "2-digit",
    });
    const time = now.toLocaleTimeString("en-GB", {
      hour: "2-digit",
      minute: "2-digit",
    });
    return `${date} · ${time}`;
  }
  return now.toLocaleString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

export function formatMiles(metres) {
  if (!Number.isFinite(metres) || metres < 0) return "";
  const miles = metres / 1609.344;
  if (miles < 0.05) return "same site";
  return `${miles < 10 ? miles.toFixed(1) : Math.round(miles)} miles`;
}

export function formatDriveLeg(leg) {
  if (!leg) return "";
  if (leg.sameSite) return "same site";
  const time = Number.isFinite(leg.minutes) ? formatDuration(leg.minutes) : "";
  const dist = formatMiles(leg.metres);
  if (dist && time) return `${dist} / ${time}`;
  return dist || time;
}

export function parseEmailList(value) {
  return [
    ...new Set(
      String(value || "")
        .split(/[,;]+/)
        .map((part) => part.trim())
        .filter(Boolean),
    ),
  ];
}

export function extraRouteEmails(value, defaultRouteEmail = DEFAULT_ROUTE_EMAIL) {
  return parseEmailList(value).filter(
    (email) => email.toLowerCase() !== defaultRouteEmail.toLowerCase(),
  );
}

export function routeEmailAddresses(settingsEmail, defaultRouteEmail = DEFAULT_ROUTE_EMAIL) {
  return [defaultRouteEmail, ...extraRouteEmails(settingsEmail, defaultRouteEmail)];
}

export function routeMailtoHref(
  subject,
  body,
  settingsEmail,
  defaultRouteEmail = DEFAULT_ROUTE_EMAIL,
) {
  return `mailto:${routeEmailAddresses(settingsEmail, defaultRouteEmail).join(",")}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

export function routeEmailStatus(kind, settingsEmail, defaultRouteEmail = DEFAULT_ROUTE_EMAIL) {
  const extras = extraRouteEmails(settingsEmail, defaultRouteEmail);
  const what = kind === "booking" ? "the booking list" : "this day’s Google Maps route";
  if (!extras.length) return `Opened an email to ${defaultRouteEmail} with ${what}.`;
  if (extras.length === 1) {
    return `Opened an email to ${defaultRouteEmail} and ${extras[0]} with ${what}.`;
  }
  return `Opened an email to ${defaultRouteEmail} and ${extras.length} extra addresses with ${what}.`;
}
