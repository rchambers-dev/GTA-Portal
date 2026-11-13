export type DashboardPerson = {
  tutorName: string;
  invited: boolean;
  submitted: boolean;
  email: string | null;
  isTest?: boolean;
};

export type RoundKpis = {
  invited: number;
  submitted: number;
  responseRate: number | null;
  noEmail: number;
  failedEmails: number;
  concerns: number;
};

export function roundKpis(input: {
  people: DashboardPerson[];
  failedEmails: number;
  concerns: number;
}): RoundKpis {
  const people = input.people.filter((person) => person.isTest !== true);
  const invited = people.filter((person) => person.invited).length;
  const submitted = people.filter((person) => person.submitted).length;
  const noEmail = people.filter((person) => !person.email?.trim()).length;
  return {
    invited,
    submitted,
    responseRate: invited ? Math.round((submitted / invited) * 100) : null,
    noEmail,
    failedEmails: input.failedEmails,
    concerns: input.concerns,
  };
}

export function tutorResponseRates(people: DashboardPerson[], tutorNames: string[] = []): { tutorName: string; invited: number; submitted: number; rate: number }[] {
  const groups = new Map<string, { invited: number; submitted: number }>();
  for (const name of tutorNames) groups.set(name, { invited: 0, submitted: 0 });
  for (const person of people) {
    if (person.isTest || !person.invited) continue;
    const row = groups.get(person.tutorName) ?? { invited: 0, submitted: 0 };
    row.invited += 1;
    if (person.submitted) row.submitted += 1;
    groups.set(person.tutorName, row);
  }
  return [...groups.entries()]
    .map(([tutorName, row]) => ({ tutorName, ...row, rate: row.invited ? Math.round((row.submitted / row.invited) * 100) : 0 }))
    .sort((a, b) => b.rate - a.rate || a.tutorName.localeCompare(b.tutorName));
}

export function roundSchedule(opensOn: string, closesOn: string, today: string): { range: string; count: number | null; suffix: string } {
  const range = `Open ${formatRoundDate(opensOn, false)} – ${formatRoundDate(closesOn, true)}`;
  const day = 86_400_000;
  const start = Date.parse(`${today}T00:00:00Z`);
  const opens = Date.parse(`${opensOn}T00:00:00Z`);
  const closes = Date.parse(`${closesOn}T00:00:00Z`);
  if (start < opens) {
    return { range, count: Math.round((opens - start) / day), suffix: "until this round opens" };
  }
  if (start > closes) return { range, count: null, suffix: "This round is closed" };
  const left = Math.round((closes - start) / day);
  if (left <= 0) return { range, count: null, suffix: "This round closes today" };
  return { range, count: left, suffix: left === 1 ? "day left" : "days left" };
}

function formatRoundDate(isoDate: string, withYear: boolean): string {
  const [year, month, day] = isoDate.split("-").map(Number);
  const date = new Date(Date.UTC(year, (month || 1) - 1, day || 1, 12));
  const weekday = new Intl.DateTimeFormat("en-GB", { weekday: "long", timeZone: "UTC" }).format(date);
  const monthName = new Intl.DateTimeFormat("en-GB", { month: "long", timeZone: "UTC" }).format(date);
  return withYear ? `${weekday} ${day} ${monthName} ${year}` : `${weekday} ${day} ${monthName}`;
}

export function daysUntil(today: string, opensOn: string, closesOn: string): string {
  const day = 86_400_000;
  const start = Date.parse(`${today}T00:00:00Z`);
  const opens = Date.parse(`${opensOn}T00:00:00Z`);
  const closes = Date.parse(`${closesOn}T00:00:00Z`);
  if (start < opens) {
    const days = Math.round((opens - start) / day);
    return days === 1 ? "Opens in 1 day" : `Opens in ${days} days`;
  }
  if (start > closes) return "Closed";
  const left = Math.round((closes - start) / day);
  if (left <= 0) return "Closes today";
  return left === 1 ? "1 day left" : `${left} days left`;
}
