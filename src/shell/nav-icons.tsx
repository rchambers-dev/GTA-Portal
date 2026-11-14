/** Shared portal navigation icons — sidebar, command palette, etc. */

export type NavGlyph =
  | "dashboard"
  | "book"
  | "chart"
  | "tasks"
  | "clock"
  | "history"
  | "document"
  | "page"
  | "id-card"
  | "calendar"
  | "calendar-check"
  | "reviews"
  | "messages"
  | "support"
  | "workplace"
  | "workplace-plus"
  | "cap"
  | "folder"
  | "megaphone"
  | "staff"
  | "person"
  | "person-plus"
  | "people"
  | "shield"
  | "gear"
  | "clipboard"
  | "audit"
  | "coins"
  | "tag"
  | "gauge"
  | "key"
  | "door"
  | "directory"
  | "kanban"
  | "teaching"
  | "delivery"
  | "builder-list"
  | "builder-grid"
  | "modules"
  | "package"
  | "pencil"
  | "mapping"
  | "comment"
  | "layers"
  | "eye"
  | "funnel"
  | "badge"
  | "alert"
  | "trend"
  | "flag"
  | "paperclip"
  | "checklist";

const common = {
  width: 18,
  height: 18,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.9,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true as const,
};

/** Which glyph a route shows. Specific paths are matched before broader ones. */
export function navGlyphForHref(href: string): NavGlyph {
  const key = href.split("?")[0] ?? href;

  if (key === "/category/onboarding") return "person-plus";
  if (key === "/category/marketing") return "megaphone";
  if (key === "/category/staff") return "staff";
  if (key === "/category/apprenticeship") return "cap";

  if (key.includes("/employer-concerns")) return "alert";
  if (key.includes("/onboarding/apprentice")) return "person-plus";
  if (key.includes("/onboarding/candidates")) return "people";
  if (key.includes("/onboarding/interviews")) return "calendar-check";
  if (key.includes("/onboarding/inductions")) return "door";
  if (key.includes("/onboarding/employers")) return "workplace";
  if (key.includes("/onboarding/calendar")) return "calendar";
  if (key.includes("/onboarding/actions")) return "tasks";
  if (key.includes("/onboarding/reports")) return "chart";
  if (key.includes("/onboarding/employer")) return "workplace-plus";
  if (key.includes("/onboarding/directory")) return "directory";
  if (key.includes("/onboarding")) return "door";
  if (key.includes("/marketing")) return "megaphone";
  if (key.includes("/apprentice-funding") || key.includes("/ksb-rpl")) return "coins";
  if (key.includes("/apprentice-tnp") || key.includes("/tnp1")) return "tag";
  if (key.includes("/apprentice-brag") || key.includes("/progression-brag")) return "gauge";
  if (key.includes("/data-quality")) return "checklist";
  if (key.includes("/programme-builder")) return "builder-list";
  if (key.includes("/course-builder")) return "builder-grid";
  if (key.includes("/programme-delivery")) return "delivery";
  if (key.includes("/training-plan")) return "clipboard";
  if (key.includes("/safeguarding")) return "shield";
  if (key.includes("/interventions")) return "flag";
  if (key.includes("/employer/apprentice")) return "person";

  if (key.endsWith("/dashboard") || key.endsWith("/overview")) return "dashboard";
  if (key.includes("/learning")) return "book";
  if (
    key.includes("/feedback-trends") ||
    key.includes("/progress-monitoring") ||
    /\/progress(\/|$)/.test(key)
  ) {
    return "chart";
  }
  if (key.includes("/feedback")) return "comment";
  if (key.includes("/tracking") || key.includes("/cea") || key.includes("/actions")) return "tasks";
  if (key.includes("/evidence")) return "paperclip";
  if (key.includes("/otj")) return "clock";
  if (key.includes("/history")) return "history";
  if (key.includes("/attendance")) return "calendar-check";
  if (key.includes("/schedule")) return "calendar";
  if (key.includes("/reviews/plan")) return "calendar";
  if (key.includes("/reviews/cycle")) return "clipboard";
  if (key.includes("/reviews/out")) return "workplace";
  if (key.includes("/reviews/archive")) return "folder";
  if (key.includes("/reviews/analytics")) return "chart";
  if (key.includes("/reviews/log")) return "history";
  if (key.includes("/reviews/tutor-reviews")) return "comment";
  if (key.includes("/reviews/settings")) return "gear";
  if (key.includes("/reviews")) return "reviews";
  if (key.includes("/messages")) return "messages";
  if (key.includes("/support")) return "support";
  if (key.includes("/cv")) return "id-card";
  if (key.includes("/shared-drive") || key.includes("/administration/documents")) return "folder";
  if (key.includes("/documents") || key.includes("/commitments")) return "document";
  if (key.includes("/employers")) return "workplace";
  if (key.includes("/teaching-groups")) return "teaching";
  if (key.includes("/cohorts")) return "people";
  if (key.includes("/enrolments")) return "clipboard";
  if (key.includes("/programmes") || key.includes("/curriculum/programme")) return "cap";
  if (key.includes("/modules")) return "modules";
  if (key.includes("/resources")) return "package";
  if (key.includes("/assessments")) return "pencil";
  if (key.includes("/ksb")) return "mapping";
  if (key.includes("/versions")) return "layers";
  if (key.includes("/audits")) return "audit";
  if (key.includes("/observations")) return "eye";
  if (key.includes("/sampling")) return "funnel";
  if (key.includes("/compliance")) return "badge";
  if (key.includes("/findings")) return "alert";
  if (key.includes("/improvements")) return "trend";
  if (key.includes("/accounts")) return "key";
  if (key.includes("/intake") || key.includes("/staff-intake")) return "person-plus";
  if (key.includes("/system")) return "gear";
  if (key.includes("/lifecycle")) return "kanban";
  if (key === "/apprentices" || key.startsWith("/apprentices?")) return "person";
  if (key === "/staff-records" || key.startsWith("/staff-records")) return "staff";

  return "page";
}

export function NavIcon({ href }: { href: string }) {
  return <Glyph name={navGlyphForHref(href)} />;
}

function Glyph({ name }: { name: NavGlyph }) {
  switch (name) {
    case "dashboard":
      return (
        <svg {...common}>
          <rect x="3" y="3" width="8" height="8" rx="1.4" />
          <rect x="13" y="3" width="8" height="5" rx="1.4" />
          <rect x="13" y="10" width="8" height="11" rx="1.4" />
          <rect x="3" y="13" width="8" height="8" rx="1.4" />
        </svg>
      );
    case "book":
      return (
        <svg {...common}>
          <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
          <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
        </svg>
      );
    case "chart":
      return (
        <svg {...common}>
          <path d="M4 19V5" />
          <path d="M4 19h16" />
          <path d="M8 15v-4" />
          <path d="M12 15V8" />
          <path d="M16 15v-7" />
        </svg>
      );
    case "tasks":
      return (
        <svg {...common}>
          <path d="M9 11l2 2 4-4" />
          <path d="M5 5h14v14H5z" />
        </svg>
      );
    case "clock":
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="8" />
          <path d="M12 8v4l2.5 2.5" />
        </svg>
      );
    case "history":
      return (
        <svg {...common}>
          <path d="M3.5 12a8.5 8.5 0 1 0 2.2-5.7" />
          <path d="M3.5 4.5V9H8" />
          <path d="M12 8v4l2.5 2" />
        </svg>
      );
    case "document":
      return (
        <svg {...common}>
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <path d="M14 2v6h6" />
          <path d="M8 13h8M8 17h6" />
        </svg>
      );
    case "page":
      return (
        <svg {...common}>
          <path d="M7 3h7l5 5v13a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z" />
          <path d="M14 3v5h5" />
        </svg>
      );
    case "id-card":
      return (
        <svg {...common}>
          <rect x="3" y="5" width="18" height="14" rx="2" />
          <circle cx="9" cy="11" r="2" />
          <path d="M14 10h5M14 14h3" />
        </svg>
      );
    case "calendar":
      return (
        <svg {...common}>
          <rect x="3" y="5" width="18" height="16" rx="2" />
          <path d="M8 3v4M16 3v4M3 10h18" />
        </svg>
      );
    case "calendar-check":
      return (
        <svg {...common}>
          <rect x="3" y="5" width="18" height="16" rx="2" />
          <path d="M8 3v4M16 3v4M3 10h18" />
          <path d="M8.5 15.5 11 18l4.5-5" />
        </svg>
      );
    case "reviews":
      return (
        <svg {...common}>
          <path d="M8 4h8a2 2 0 0 1 2 2v14l-6-3-6 3V6a2 2 0 0 1 2-2z" />
          <path d="M10 9h4" />
        </svg>
      );
    case "messages":
      return (
        <svg {...common}>
          <path d="M21 12a8 8 0 0 1-11.4 7.2L4 20l1-4.2A8 8 0 1 1 21 12z" />
        </svg>
      );
    case "support":
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="8" />
          <circle cx="12" cy="12" r="3" />
          <path d="M9.2 9.2 6.4 6.4M14.8 9.2l2.8-2.8M9.2 14.8l-2.8 2.8M14.8 14.8l2.8 2.8" />
        </svg>
      );
    case "workplace":
      return (
        <svg {...common}>
          <path d="M3 21h18" />
          <path d="M5 21V8l7-4 7 4v13" />
          <path d="M9 21v-6h6v6" />
          <path d="M9 10h.01M15 10h.01M12 10h.01" />
        </svg>
      );
    case "workplace-plus":
      return (
        <svg {...common}>
          <path d="M3 21h12" />
          <path d="M5 21V9l5-3v15" />
          <path d="M16 7v6M13 10h6" />
        </svg>
      );
    case "cap":
      return (
        <svg {...common}>
          <path d="M22 10 12 5 2 10l10 5 10-5z" />
          <path d="M6 12.5v4.2c0 .7 2.7 2.3 6 2.3s6-1.6 6-2.3v-4.2" />
          <path d="M22 10v6" />
        </svg>
      );
    case "folder":
      return (
        <svg {...common}>
          <path d="M4 7.5A2.5 2.5 0 0 1 6.5 5H10l2 2h5.5A2.5 2.5 0 0 1 20 9.5v7A2.5 2.5 0 0 1 17.5 19h-11A2.5 2.5 0 0 1 4 16.5v-9z" />
        </svg>
      );
    case "megaphone":
      return (
        <svg {...common}>
          <path d="M5 10v4h3l8 4V6L8 10H5z" />
          <path d="M16 10.2a3.2 3.2 0 0 1 0 3.6" />
        </svg>
      );
    case "staff":
      return (
        <svg {...common}>
          <circle cx="9" cy="8" r="3.5" />
          <path d="M2.5 20a6.5 6.5 0 0 1 13 0" />
          <path d="M16 7h5M16 11h5M16 15h3" />
        </svg>
      );
    case "person":
      return (
        <svg {...common}>
          <circle cx="12" cy="8" r="3.5" />
          <path d="M5.5 20a6.5 6.5 0 0 1 13 0" />
        </svg>
      );
    case "person-plus":
      return (
        <svg {...common}>
          <circle cx="9" cy="8" r="3.5" />
          <path d="M2.5 20a6.5 6.5 0 0 1 13 0" />
          <path d="M18 5v6M15 8h6" />
        </svg>
      );
    case "people":
      return (
        <svg {...common}>
          <path d="M16 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6z" />
          <path d="M8 13a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7z" />
          <path d="M2.5 20a5 5 0 0 1 11 0" />
          <path d="M14 20a4.5 4.5 0 0 1 7.5-3.3" />
        </svg>
      );
    case "shield":
      return (
        <svg {...common}>
          <path d="M12 3 4.5 6.5v5.2c0 4.4 3.1 7.7 7.5 9.3 4.4-1.6 7.5-4.9 7.5-9.3V6.5L12 3z" />
          <path d="M9.2 12.2 11 14l3.8-4" />
        </svg>
      );
    case "gear":
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="3" />
          <path d="M12 3v2.2M12 18.8V21M4.9 4.9l1.6 1.6M17.5 17.5l1.6 1.6M3 12h2.2M18.8 12H21M4.9 19.1l1.6-1.6M17.5 6.5l1.6-1.6" />
        </svg>
      );
    case "clipboard":
      return (
        <svg {...common}>
          <path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2" />
          <rect x="9" y="3" width="6" height="4" rx="1" />
          <path d="M9 12h6M9 16h4" />
        </svg>
      );
    case "audit":
      return (
        <svg {...common}>
          <path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2" />
          <rect x="9" y="3" width="6" height="4" rx="1" />
          <path d="M8.5 13.2 11 15.5l4.5-4.8" />
        </svg>
      );
    case "coins":
      return (
        <svg {...common}>
          <ellipse cx="12" cy="7" rx="7" ry="3" />
          <path d="M5 7v5c0 1.7 3.1 3 7 3s7-1.3 7-3V7" />
          <path d="M5 12v5c0 1.7 3.1 3 7 3s7-1.3 7-3v-5" />
        </svg>
      );
    case "tag":
      return (
        <svg {...common}>
          <path d="M12 21 3 12V4h8l9 9-8 8z" />
          <circle cx="8" cy="8" r="1.2" />
        </svg>
      );
    case "gauge":
      return (
        <svg {...common}>
          <path d="M5 16a7 7 0 0 1 14 0" />
          <path d="M12 16 16 11" />
          <path d="M8 19h8" />
        </svg>
      );
    case "key":
      return (
        <svg {...common}>
          <circle cx="8" cy="14" r="3.5" />
          <path d="M11.2 14H20" />
          <path d="M17 14v3M20 14v2.2" />
        </svg>
      );
    case "door":
      return (
        <svg {...common}>
          <path d="M4 21V5a1 1 0 0 1 1-1h9v17H4z" />
          <path d="M14 4h6v17" />
          <path d="M11.5 12h.01" />
        </svg>
      );
    case "directory":
      return (
        <svg {...common}>
          <path d="M5 4h12a2 2 0 0 1 2 2v13H7" />
          <path d="M5 4v14a2 2 0 0 0 2 2h12" />
          <circle cx="12" cy="10" r="2" />
          <path d="M9.2 15.2a3 3 0 0 1 5.6 0" />
        </svg>
      );
    case "kanban":
      return (
        <svg {...common}>
          <rect x="3" y="4" width="5" height="16" rx="1" />
          <rect x="10" y="4" width="5" height="10" rx="1" />
          <rect x="17" y="4" width="4" height="13" rx="1" />
        </svg>
      );
    case "teaching":
      return (
        <svg {...common}>
          <rect x="3" y="4" width="18" height="11" rx="1.5" />
          <path d="M8 21h8M12 15v6M7 9h10" />
        </svg>
      );
    case "delivery":
      return (
        <svg {...common}>
          <rect x="3" y="5" width="18" height="14" rx="2" />
          <path d="M10 9v6l6-3-6-3z" />
        </svg>
      );
    case "builder-list":
      return (
        <svg {...common}>
          <path d="M4 6h16" />
          <path d="M4 12h16" />
          <path d="M4 18h10" />
          <path d="M16 16v4M14 18h4" />
        </svg>
      );
    case "builder-grid":
      return (
        <svg {...common}>
          <rect x="3" y="3" width="7" height="7" rx="1.5" />
          <rect x="14" y="3" width="7" height="7" rx="1.5" />
          <rect x="3" y="14" width="7" height="7" rx="1.5" />
          <path d="M14 17.5h7M17.5 14v7" />
        </svg>
      );
    case "modules":
      return (
        <svg {...common}>
          <rect x="3" y="3" width="7" height="7" rx="1.2" />
          <rect x="14" y="3" width="7" height="7" rx="1.2" />
          <rect x="3" y="14" width="7" height="7" rx="1.2" />
          <rect x="14" y="14" width="7" height="7" rx="1.2" />
        </svg>
      );
    case "package":
      return (
        <svg {...common}>
          <path d="M12 3 4 7l8 4 8-4-8-4z" />
          <path d="M4 7v10l8 4 8-4V7" />
          <path d="M12 11v10" />
        </svg>
      );
    case "pencil":
      return (
        <svg {...common}>
          <path d="M12 20h8" />
          <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4 11.5-11.5z" />
        </svg>
      );
    case "mapping":
      return (
        <svg {...common}>
          <circle cx="6" cy="6" r="2" />
          <circle cx="6" cy="18" r="2" />
          <circle cx="18" cy="12" r="2" />
          <path d="M8 6h3a4 4 0 0 1 4 4" />
          <path d="M8 18h3a4 4 0 0 0 4-4" />
        </svg>
      );
    case "comment":
      return (
        <svg {...common}>
          <path d="M5 5h14a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H9l-4 3v-3H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2z" />
        </svg>
      );
    case "layers":
      return (
        <svg {...common}>
          <path d="M12 3 3 8l9 5 9-5-9-5z" />
          <path d="M3 13l9 5 9-5" />
          <path d="M3 17l9 5 9-5" />
        </svg>
      );
    case "eye":
      return (
        <svg {...common}>
          <path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12z" />
          <circle cx="12" cy="12" r="2.5" />
        </svg>
      );
    case "funnel":
      return (
        <svg {...common}>
          <path d="M4 5h16l-6 7v5l-4 2v-7L4 5z" />
        </svg>
      );
    case "badge":
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="8" />
          <path d="M8.5 12.5 11 15l4.5-5" />
        </svg>
      );
    case "alert":
      return (
        <svg {...common}>
          <path d="M12 4 2.5 20h19L12 4z" />
          <path d="M12 10v4" />
          <path d="M12 17h.01" />
        </svg>
      );
    case "trend":
      return (
        <svg {...common}>
          <path d="M4 16l5-5 4 4 7-7" />
          <path d="M14 8h6v6" />
        </svg>
      );
    case "flag":
      return (
        <svg {...common}>
          <path d="M5 21V4" />
          <path d="M5 5h11l-2.5 3.5L16 12H5" />
        </svg>
      );
    case "paperclip":
      return (
        <svg {...common}>
          <path d="M8 12.5V7a4 4 0 0 1 8 0v8.5a3 3 0 0 1-6 0V8" />
        </svg>
      );
    case "checklist":
      return (
        <svg {...common}>
          <path d="M10 6h10M10 12h10M10 18h10" />
          <path d="M3.5 6.2 5 7.7 7.8 4.8" />
          <path d="M3.5 12.2 5 13.7 7.8 10.8" />
          <path d="M3.5 18.2 5 19.7 7.8 16.8" />
        </svg>
      );
    default: {
      const unreachable: never = name;
      return unreachable;
    }
  }
}
