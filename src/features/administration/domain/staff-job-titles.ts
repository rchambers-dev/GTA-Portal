/** Org-chart job titles, grouped for easier picking on Staff. */

export type StaffJobTitleSection = {
  id: string;
  label: string;
  titles: readonly string[];
};

/**
 * Atomic job titles — one checkbox each. People can hold several.
 * Combined org-chart wording is expanded via LEGACY_TITLE_EXPANSIONS.
 */
export const STAFF_JOB_TITLE_SECTIONS: readonly StaffJobTitleSection[] = [
  {
    id: "leadership",
    label: "Leadership",
    titles: [
      "Chief Executive Officer",
      "Awarding Body Standards & Compliance Officer",
      "Administration Manager",
      "Company Secretary",
      "Director",
      "Operations Manager",
      "Quality & Safeguarding Lead",
    ],
  },
  {
    id: "administration",
    label: "Administration & support",
    titles: [
      "Assistant Administration Manager",
      "Receptionist",
      "Administration",
    ],
  },
  {
    id: "sales-logistics",
    label: "Sales, logistics & mentoring",
    titles: [
      "Sales & Marketing",
      "Learning & Progress Mentor",
      "FLT Instructor",
      "First Aid & Fire Marshal Lead",
      "Logistics",
      "ADR CPC Trainer",
      "DGSA Trainer",
    ],
  },
  {
    id: "delivery",
    label: "Apprenticeship delivery & inclusion",
    titles: [
      "Apprenticeship Tutor",
      "Apprenticeship Tutor – Bodyshop",
      "Apprenticeship Tutor – Mechanical",
      "Learning Support and Inclusion Tutor",
      "Functional Skills and Inclusion Tutor",
    ],
  },
  {
    id: "safeguarding",
    label: "Safeguarding & Ofsted",
    titles: [
      "DSL",
      "Deputy DSL",
      "Ofsted Nominee",
      "Ofsted Shadow Nominee",
    ],
  },
] as const;

export const STAFF_JOB_TITLES: readonly string[] =
  STAFF_JOB_TITLE_SECTIONS.flatMap((section) => [...section.titles]);

export type StaffJobTitle = (typeof STAFF_JOB_TITLES)[number];

/**
 * One-person-only titles. Everything else may sit on more than one person
 * (Sales & Marketing, Administration, tutor streams, Deputy DSL, etc.).
 */
export const EXCLUSIVE_STAFF_JOB_TITLES: ReadonlySet<string> = new Set([
  "Chief Executive Officer",
  "Awarding Body Standards & Compliance Officer",
  "Administration Manager",
  "Company Secretary",
  "Director",
  "Operations Manager",
  "Quality & Safeguarding Lead",
  "Assistant Administration Manager",
  "Receptionist",
  "Learning & Progress Mentor",
  "First Aid & Fire Marshal Lead",
  "DSL",
  "Ofsted Nominee",
  "Ofsted Shadow Nominee",
]);

/** Old combined / alternate labels → atomic titles. */
const LEGACY_TITLE_EXPANSIONS: Record<string, readonly string[]> = {
  "Sales & Marketing / Apprenticeship Tutor": [
    "Sales & Marketing",
    "Apprenticeship Tutor",
  ],
  "Sales and Marketing": ["Sales & Marketing"],
  "Administration Manager, Company Secretary & Director": [
    "Administration Manager",
    "Company Secretary",
    "Director",
  ],
  "Operations Manager, Apprenticeship, Quality & Safeguarding Lead": [
    "Operations Manager",
    "Quality & Safeguarding Lead",
  ],
  "FLT Instructor, First Aid & Fire Marshal Lead": [
    "FLT Instructor",
    "First Aid & Fire Marshal Lead",
  ],
  "Logistics, ADR CPC, DGSA Trainer": [
    "Logistics",
    "ADR CPC Trainer",
    "DGSA Trainer",
  ],
};

export function isExclusiveStaffJobTitle(title: string): boolean {
  return EXCLUSIVE_STAFF_JOB_TITLES.has(title.trim());
}

export function normalizeJobTitles(titles: readonly string[]): string[] {
  const seen = new Set<string>();
  const next: string[] = [];
  for (const raw of titles) {
    const trimmed = raw.trim();
    if (!trimmed) continue;
    const expanded = LEGACY_TITLE_EXPANSIONS[trimmed] ?? [trimmed];
    for (const title of expanded) {
      if (!title || seen.has(title)) continue;
      if (!STAFF_JOB_TITLES.includes(title)) continue;
      seen.add(title);
      next.push(title);
    }
  }
  return next;
}

export function formatJobTitles(titles: readonly string[]): string {
  return normalizeJobTitles(titles).join(" · ");
}

/** Who already holds each exclusive title (title → staff id). */
export function exclusiveTitleHolders(
  users: Array<{
    id: string;
    jobTitles?: readonly string[];
    jobTitle?: string;
  }>,
): Map<string, string> {
  const held = new Map<string, string>();
  for (const user of users) {
    const titles = normalizeJobTitles(
      user.jobTitles ?? (user.jobTitle ? [user.jobTitle] : []),
    );
    for (const title of titles) {
      if (isExclusiveStaffJobTitle(title) && !held.has(title)) {
        held.set(title, user.id);
      }
    }
  }
  return held;
}

export function assertJobTitlesAssignable(
  staffId: string,
  nextTitles: readonly string[],
  users: Array<{
    id: string;
    displayName: string;
    jobTitles?: readonly string[];
    jobTitle?: string;
  }>,
): void {
  const held = exclusiveTitleHolders(users);
  for (const title of normalizeJobTitles(nextTitles)) {
    if (!isExclusiveStaffJobTitle(title)) continue;
    const ownerId = held.get(title);
    if (ownerId && ownerId !== staffId) {
      const owner = users.find((u) => u.id === ownerId);
      throw new Error(
        `${title} is already attached to ${owner?.displayName ?? "another staff member"}.`,
      );
    }
  }
}

/** Canonical org-chart mapping by email (multi titles allowed). */
export const ORG_CHART_JOB_TITLES_BY_EMAIL: Record<string, string[]> = {
  "jon.mace@doncastergta.co.uk": ["Chief Executive Officer"],
  "richard.appleyard@doncastergta.co.uk": [
    "Awarding Body Standards & Compliance Officer",
  ],
  "annette.scott@doncastergta.co.uk": [
    "Administration Manager",
    "Company Secretary",
    "Director",
  ],
  "nicola.mitchell@doncastergta.co.uk": [
    "Operations Manager",
    "Quality & Safeguarding Lead",
    "DSL",
    "Ofsted Nominee",
  ],
  "anne-marie.sanderson@doncastergta.co.uk": [
    "Sales & Marketing",
    "Apprenticeship Tutor",
    "Deputy DSL",
  ],
  "neil.corfield@doncastergta.co.uk": ["Sales & Marketing"],
  "reisschambers@doncastergta.co.uk": ["Learning & Progress Mentor"],
  "rob.ruston@doncastergta.co.uk": [
    "FLT Instructor",
    "First Aid & Fire Marshal Lead",
  ],
  "ian.kettleborough@doncastergta.co.uk": [
    "Logistics",
    "ADR CPC Trainer",
    "DGSA Trainer",
  ],
  "rachael.allen@doncastergta.co.uk": ["Assistant Administration Manager"],
  "diane.meadows@doncastergta.co.uk": ["Receptionist"],
  "charlotte.mclaughlin@doncastergta.co.uk": ["Administration"],
  "trudy.hartley@doncastergta.co.uk": ["Administration"],
  "lucy.butler@doncastergta.co.uk": ["Administration"],
  "john.pearson@doncastergta.co.uk": ["Apprenticeship Tutor – Bodyshop"],
  "andrew.ross@doncastergta.co.uk": ["Apprenticeship Tutor – Bodyshop"],
  "mike.hepworth@doncastergta.co.uk": ["Apprenticeship Tutor – Mechanical"],
  "marc.hadfield@doncastergta.co.uk": ["Apprenticeship Tutor – Mechanical"],
  "mark.illingworth@doncastergta.co.uk": [
    "Apprenticeship Tutor – Mechanical",
  ],
  "tony.reid@doncastergta.co.uk": ["Apprenticeship Tutor – Mechanical"],
  "martin.farthing@doncastergta.co.uk": ["Apprenticeship Tutor – Mechanical"],
  "dan.hanmer@doncastergta.co.uk": ["Apprenticeship Tutor – Mechanical"],
  "robert.mason@doncastergta.co.uk": ["Apprenticeship Tutor – Mechanical"],
  "murtala.kasimu@doncastergta.co.uk": ["Apprenticeship Tutor – Mechanical"],
  "rebecca.harper@doncastergta.co.uk": [
    "Learning Support and Inclusion Tutor",
    "Deputy DSL",
  ],
  "benjamin.williams@doncastergta.co.uk": [
    "Functional Skills and Inclusion Tutor",
    "Deputy DSL",
    "Ofsted Shadow Nominee",
  ],
};
