/** One Portal employer, with its sites and any recruitment figures. */
export type EmployerDirectoryRow = {
  employerId: string;
  name: string;
  site: string;
  detail: string;
  openVacancies: number;
  placesAvailable: number;
  lastContact: string | null;
  nextFollowUp: string | null;
  followUpOverdue: boolean;
  source: string | null;
};

export type EmployerDirectoryInput = {
  employers: { employerId: string; name: string }[];
  sites: { employerId: string; areaName: string; postcode: string; active: boolean }[];
  vacancies: { id: string; employerId: string; status: string; totalPlaces: number }[];
  allocations: { vacancyId: string; released: boolean; releaseReason: string | null }[];
  reoffers: { vacancyId: string; decision: string }[];
  activities: { id: string; employerId: string; actualOn: string }[];
  followUps: { activityId: string; dueOn: string; completedOn: string | null }[];
  today: string;
};

/** Distinct employer records, the same list the rest of the Portal reads from employers. Sites stay on the row. */
export function buildEmployerDirectory(input: EmployerDirectoryInput): EmployerDirectoryRow[] {
  const sites = new Map<string, EmployerDirectoryInput["sites"]>();
  for (const site of input.sites) {
    const list = sites.get(site.employerId) ?? [];
    list.push(site);
    sites.set(site.employerId, list);
  }
  const vacancies = new Map<string, EmployerDirectoryInput["vacancies"]>();
  for (const vacancy of input.vacancies) {
    const list = vacancies.get(vacancy.employerId) ?? [];
    list.push(vacancy);
    vacancies.set(vacancy.employerId, list);
  }
  const allocated = new Map<string, number>();
  for (const allocation of input.allocations) {
    if (allocation.released) continue;
    allocated.set(allocation.vacancyId, (allocated.get(allocation.vacancyId) ?? 0) + 1);
  }
  const waiting = new Set(
    input.reoffers.filter((row) => row.decision === "pending").map((row) => row.vacancyId),
  );
  const lastContact = new Map<string, string>();
  const activityEmployer = new Map(input.activities.map((row) => [row.id, row.employerId]));
  for (const activity of input.activities) {
    const current = lastContact.get(activity.employerId);
    if (!current || activity.actualOn > current) lastContact.set(activity.employerId, activity.actualOn);
  }
  const nextFollow = new Map<string, string>();
  for (const follow of input.followUps) {
    if (follow.completedOn) continue;
    const employerId = activityEmployer.get(follow.activityId);
    if (!employerId) continue;
    const current = nextFollow.get(employerId);
    if (!current || follow.dueOn < current) nextFollow.set(employerId, follow.dueOn);
  }
  return [...input.employers]
    .sort((a, b) => a.name.localeCompare(b.name, "en", { sensitivity: "base" }) || a.employerId.localeCompare(b.employerId))
    .map((employer) => {
      const place = (sites.get(employer.employerId) ?? []).filter((site) => site.areaName || site.postcode);
      const active = place.filter((site) => site.active);
      const shown = active.length ? active : place;
      const areas = [...new Set(shown.map((site) => site.areaName).filter(Boolean))];
      const postcodes = [...new Set(shown.map((site) => site.postcode).filter(Boolean))];
      const open = (vacancies.get(employer.employerId) ?? []).filter((row) => row.status === "open" || row.status === "potential");
      let places = 0;
      for (const vacancy of open) {
        const held = allocated.get(vacancy.id) ?? 0;
        const pending = waiting.has(vacancy.id) ? 1 : 0;
        places += Math.max(0, vacancy.totalPlaces - held - pending);
      }
      const follow = nextFollow.get(employer.employerId) ?? null;
      return {
        employerId: employer.employerId,
        name: employer.name,
        site: areas.join(", ") || "—",
        detail: shown.length > 1 ? `${shown.length} sites` : postcodes[0] || "",
        openVacancies: open.length,
        placesAvailable: places,
        lastContact: lastContact.get(employer.employerId) ?? null,
        nextFollowUp: follow,
        followUpOverdue: Boolean(follow && follow < input.today),
        source: null,
      };
    });
}

/** An employer the vacancy and candidate forms can offer. IDs are never typed. */
export type EmployerChoice = {
  employerId: string;
  name: string;
  site: string;
  address: string;
  contact: string;
  phone: string;
  email: string;
};

export const EXAMPLE_EMPLOYERS: EmployerChoice[] = [
  {
    employerId: "GTA-EMP-000014",
    name: "Northbridge Motors",
    site: "Doncaster",
    address: "Unit 4, Wheatley Hall Road, Doncaster",
    contact: "Diane Copeland, workshop manager",
    phone: "01302 555 014",
    email: "diane.copeland@northbridge-motors.example",
  },
  {
    employerId: "GTA-EMP-000021",
    name: "Ashfield Coachworks",
    site: "Sheffield",
    address: "Attercliffe, Sheffield",
    contact: "Workshop office",
    phone: "0114 555 021",
    email: "office@ashfield-coachworks.example",
  },
  {
    employerId: "GTA-EMP-000008",
    name: "Riverside Fleet Services",
    site: "Doncaster",
    address: "Lakeside, Doncaster",
    contact: "Fleet desk",
    phone: "01302 555 008",
    email: "fleet@riverside-fleet.example",
  },
  {
    employerId: "GTA-EMP-000033",
    name: "Hallam Street Garage",
    site: "Sheffield",
    address: "Walkley, Sheffield",
    contact: "Reception",
    phone: "0114 555 033",
    email: "hello@hallam-street.example",
  },
];
