/** Shared portal navigation icons — sidebar, command palette, etc. */

export function NavIcon({ href }: { href: string }) {
  const key = href.split("?")[0] ?? href;
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

  if (key.includes("/learning")) {
    return (
      <svg {...common}>
        <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
        <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
      </svg>
    );
  }
  if (key.includes("/modules")) {
    return (
      <svg {...common}>
        <rect x="3" y="3" width="7" height="7" rx="1.2" />
        <rect x="14" y="3" width="7" height="7" rx="1.2" />
        <rect x="3" y="14" width="7" height="7" rx="1.2" />
        <rect x="14" y="14" width="7" height="7" rx="1.2" />
      </svg>
    );
  }
  if (key.includes("/progress")) {
    return (
      <svg {...common}>
        <path d="M4 19V5" />
        <path d="M4 19h16" />
        <path d="M8 15v-4" />
        <path d="M12 15V8" />
        <path d="M16 15v-7" />
      </svg>
    );
  }
  if (key.includes("/cea")) {
    return (
      <svg {...common}>
        <path d="M9 11l2 2 4-4" />
        <path d="M5 5h14v14H5z" />
      </svg>
    );
  }
  if (key.includes("/otj") || key.includes("/evidence")) {
    return (
      <svg {...common}>
        <circle cx="12" cy="12" r="8" />
        <path d="M12 8v4l2.5 2.5" />
      </svg>
    );
  }
  if (
    key.includes("/apprentice/documents") ||
    key.includes("/employer/documents") ||
    key.includes("/training-plan") ||
    key.includes("/commitments")
  ) {
    return (
      <svg {...common}>
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <path d="M14 2v6h6" />
        <path d="M8 13h8M8 17h6" />
      </svg>
    );
  }
  if (key.includes("/attendance")) {
    return (
      <svg {...common}>
        <rect x="3" y="5" width="18" height="16" rx="2" />
        <path d="M8 3v4M16 3v4M3 10h18" />
      </svg>
    );
  }
  if (key.includes("/reviews")) {
    return (
      <svg {...common}>
        <path d="M8 10a3 3 0 1 0 0-6 3 3 0 0 0 0 6z" />
        <path d="M16 11a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z" />
        <path d="M3.5 19a4.5 4.5 0 0 1 9 0" />
        <path d="M14 19a3.5 3.5 0 0 1 6.5-1.8" />
      </svg>
    );
  }
  if (key.includes("/messages")) {
    return (
      <svg {...common}>
        <path d="M21 12a8 8 0 0 1-11.4 7.2L4 20l1-4.2A8 8 0 1 1 21 12z" />
      </svg>
    );
  }
  if (key.includes("/support")) {
    return (
      <svg {...common}>
        <circle cx="12" cy="12" r="8" />
        <path d="M12 10v6" />
        <path d="M12 7.5h.01" />
      </svg>
    );
  }
  if (key.includes("/cv")) {
    return (
      <svg {...common}>
        <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
        <path d="M14 3v5h5" />
        <path d="M9 13h6" />
        <path d="M9 17h6" />
      </svg>
    );
  }

  // Administration / Management shared apprentice-ops surfaces
  if (
    key.includes("/administration/employers") ||
    key.includes("/management/employers")
  ) {
    return (
      <svg {...common}>
        <path d="M3 21h18" />
        <path d="M5 21V8l7-4 7 4v13" />
        <path d="M9 21v-6h6v6" />
        <path d="M9 10h.01M15 10h.01M12 10h.01" />
      </svg>
    );
  }
  if (
    key.includes("/management/course-builder") ||
    key.includes("/curriculum/course-builder")
  ) {
    return (
      <svg {...common}>
        <rect x="3" y="3" width="7" height="7" rx="1.5" />
        <rect x="14" y="3" width="7" height="7" rx="1.5" />
        <rect x="3" y="14" width="7" height="7" rx="1.5" />
        <path d="M14 17.5h7M17.5 14v7" />
      </svg>
    );
  }
  if (
    key.includes("/administration/programmes") ||
    key.includes("/management/programmes-records")
  ) {
    return (
      <svg {...common}>
        <path d="M22 10 12 5 2 10l10 5 10-5z" />
        <path d="M6 12.5v4.2c0 .7 2.7 2.3 6 2.3s6-1.6 6-2.3v-4.2" />
        <path d="M22 10v6" />
      </svg>
    );
  }
  if (
    key.includes("/administration/cohorts") ||
    key.includes("/management/cohorts")
  ) {
    return (
      <svg {...common}>
        <path d="M16 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6z" />
        <path d="M8 13a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7z" />
        <path d="M2.5 20a5 5 0 0 1 11 0" />
        <path d="M14 20a4.5 4.5 0 0 1 7.5-3.3" />
      </svg>
    );
  }
  if (
    key.includes("/administration/intake") ||
    key.includes("/management/intake") ||
    key.includes("/management/staff-intake")
  ) {
    return (
      <svg {...common}>
        <circle cx="9" cy="8" r="3.5" />
        <path d="M2.5 20a6.5 6.5 0 0 1 13 0" />
        <path d="M18 5v6M15 8h6" />
      </svg>
    );
  }
  if (
    key.includes("/administration/enrolments") ||
    key.includes("/management/enrolments") ||
    key.includes("/management/apprentice-funding") ||
    key.includes("/management/ksb-rpl") ||
    key.includes("/management/apprentice-brag") ||
    key.includes("/management/progression-brag")
  ) {
    return (
      <svg {...common}>
        <path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2" />
        <rect x="9" y="3" width="6" height="4" rx="1" />
        <path d="M9 12h6M9 16h4" />
      </svg>
    );
  }
  if (
    key.includes("/administration/accounts") ||
    key.includes("/management/accounts") ||
    key.includes("/management/staff-accounts")
  ) {
    return (
      <svg {...common}>
        <circle cx="12" cy="8" r="3.5" />
        <path d="M5.5 20a6.5 6.5 0 0 1 13 0" />
        <path d="M19 8v4M17 10h4" />
      </svg>
    );
  }
  if (key.includes("/administration/safeguarding") || key.includes("/safeguarding") || key.includes("/management/safeguarding")) {
    return (
      <svg {...common}>
        <path d="M12 3 4.5 6.5v5.2c0 4.4 3.1 7.7 7.5 9.3 4.4-1.6 7.5-4.9 7.5-9.3V6.5L12 3z" />
        <path d="M9.2 12.2 11 14l3.8-4" />
      </svg>
    );
  }
  if (
    key.includes("/shared-drive") ||
    key.includes("/administration/documents")
  ) {
    return (
      <svg {...common}>
        <path d="M4 7.5A2.5 2.5 0 0 1 6.5 5H10l2 2h5.5A2.5 2.5 0 0 1 20 9.5v7A2.5 2.5 0 0 1 17.5 19h-11A2.5 2.5 0 0 1 4 16.5v-9z" />
        <path d="M8 13h8M8 16h5" />
      </svg>
    );
  }
  if (key.includes("/administration/data-quality")) {
    return (
      <svg {...common}>
        <path d="M12 3 4.5 6.5v5.2c0 4.4 3.1 7.7 7.5 9.3 4.4-1.6 7.5-4.9 7.5-9.3V6.5L12 3z" />
        <path d="M9.2 12.2 11 14l3.8-4" />
      </svg>
    );
  }
  if (
    key.includes("/administration/system") ||
    key.includes("/management/system")
  ) {
    return (
      <svg {...common}>
        <circle cx="12" cy="12" r="3" />
        <path d="M12 3v2.2M12 18.8V21M4.9 4.9l1.6 1.6M17.5 17.5l1.6 1.6M3 12h2.2M18.8 12H21M4.9 19.1l1.6-1.6M17.5 6.5l1.6-1.6" />
      </svg>
    );
  }
  if (
    key.includes("/administration/dashboard") ||
    key.endsWith("/administration") ||
    key.includes("/management/dashboard") ||
    key.endsWith("/management")
  ) {
    return (
      <svg {...common}>
        <rect x="3" y="3" width="8" height="8" rx="1.4" />
        <rect x="13" y="3" width="8" height="5" rx="1.4" />
        <rect x="13" y="10" width="8" height="11" rx="1.4" />
        <rect x="3" y="13" width="8" height="8" rx="1.4" />
      </svg>
    );
  }
  if (key.includes("/apprentice/college-tasks") || key.includes("/staff/programme-delivery")) {
    return (
      <svg {...common}>
        <path d="M8 4h8a2 2 0 0 1 2 2v14l-6-3-6 3V6a2 2 0 0 1 2-2z" />
        <path d="M10 9h4M10 12h4" />
      </svg>
    );
  }
  if (key === "/apprentices" || key.startsWith("/apprentices?")) {
    return (
      <svg {...common}>
        <circle cx="11" cy="11" r="6.5" />
        <path d="M16.2 16.2 21 21" />
        <path d="M9 11h4M11 9v4" />
      </svg>
    );
  }
  if (key === "/staff-records" || key.startsWith("/staff-records?")) {
    return (
      <svg {...common}>
        <circle cx="9" cy="8" r="3.5" />
        <path d="M2.5 20a6.5 6.5 0 0 1 13 0" />
        <path d="M16 7h5M16 11h5M16 15h3" />
      </svg>
    );
  }

  // Dashboard / default
  return (
    <svg {...common}>
      <path d="M4 11.5 12 4l8 7.5" />
      <path d="M6.5 10.5V20h11V10.5" />
    </svg>
  );
}
