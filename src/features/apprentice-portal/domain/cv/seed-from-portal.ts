/**
 * Seed the CV builder from portal facts only.
 * Invented copy (skills, summary bullets, soft references) stays blank —
 * apprentices add those themselves or via AI.
 */

import {
  CV_LIMITS,
  joinCvBullets,
} from "./validation";
import {
  ALEX_MODULES,
  ALEX_PROFILE,
  type ApprenticeModuleRow,
  type ApprenticePortalProfile,
} from "../mock-apprentice";

export type CvPortalSeed = {
  fullName: string;
  headline: string;
  email: string;
  phone: string;
  houseNumber: string;
  postcode: string;
  /** Full looked-up address line selected by the apprentice (optional). */
  addressLine: string;
  summary: string;
  skills: string[];
  experience: Array<{
    id: string;
    role: string;
    company: string;
    location: string;
    start: string;
    end: string;
    current: boolean;
    description: string;
  }>;
  education: Array<{
    id: string;
    qualification: string;
    institution: string;
    start: string;
    end: string;
    detail: string;
  }>;
  /** Preset line on the CV — apprentice can remove it. */
  referencesOnRequest: boolean;
  referencePeople: Array<{
    id: string;
    name: string;
    role: string;
    organisation: string;
    email: string;
    phone: string;
  }>;
};

/** Public module facts safe to send to AI (no tutor notes or evidence). */
export type CvModulePublic = {
  code: string;
  title: string;
  year: 1 | 2 | 3;
  status: "completed" | "in_progress" | "remaining";
};

function programmeTitle(programmeName: string): string {
  return (
    programmeName.split("·")[0]?.trim().replace(/\s*L\d+\s*$/i, "").trim() ||
    programmeName
  );
}

function apprenticeHeadline(programmeName: string): string {
  const title = programmeTitle(programmeName);
  if (/^apprentice\b/i.test(title)) return title;
  return `Apprentice ${title}`;
}

function toPublicModule(row: ApprenticeModuleRow): CvModulePublic {
  return {
    code: row.code,
    title: row.title,
    year: row.year,
    status: row.status,
  };
}

/**
 * Module list the CV AI may reference.
 * Ready for live portal data — swap ALEX_MODULES for the signed-in apprentice's
 * modules when that feed is wired; shape stays the same.
 */
export function getCvModulesPublic(
  modules: ApprenticeModuleRow[] = ALEX_MODULES,
): CvModulePublic[] {
  return modules
    .filter((m) => m.status === "completed" || m.status === "in_progress")
    .map(toPublicModule);
}

/**
 * Draft experience bullets from completed / in-progress portal modules.
 * Skips modules already reflected in the existing description.
 * Live module feeds plug in via getCvModulesPublic().
 */
export function suggestExperienceBulletsFromModules(
  existingDescription: string,
  limit = 8,
  modules: ApprenticeModuleRow[] = ALEX_MODULES,
): string[] {
  const existing = existingDescription
    .split("\n")
    .map((line) => line.replace(/\u200B/g, "").trim().toLowerCase())
    .filter(Boolean);
  const filled = existing.length;
  const room = Math.max(0, limit - filled);
  if (room === 0) return [];

  const suggestions: string[] = [];
  for (const mod of getCvModulesPublic(modules)) {
    if (suggestions.length >= room) break;
    const titleKey = mod.title.trim().toLowerCase();
    if (!titleKey) continue;
    if (existing.some((line) => line.includes(titleKey))) continue;

    const line =
      mod.status === "completed"
        ? `Applied learning from ${mod.title} in day-to-day workshop tasks`
        : `Building practical skills through ${mod.title}`;
    if (existing.includes(line.toLowerCase())) continue;
    if (suggestions.some((s) => s.toLowerCase() === line.toLowerCase())) continue;
    suggestions.push(line);
  }
  return suggestions;
}

function completedModuleTitles(modules: ApprenticeModuleRow[] = ALEX_MODULES): string[] {
  return modules.filter((m) => m.status === "completed").map((m) => m.title);
}

function educationDetail(
  profile: ApprenticePortalProfile,
  modules: ApprenticeModuleRow[] = ALEX_MODULES,
): string {
  const parts = [
    `Year ${profile.programmeYear}, week ${profile.programmeWeek}`,
    profile.collegeDays ? `College days: ${profile.collegeDays}` : null,
  ].filter(Boolean);

  const completed = completedModuleTitles(modules);
  if (completed.length > 0) {
    parts.push(`Modules completed: ${completed.join("; ")}`);
  }

  return parts.join(". ") + ".";
}

/**
 * Prefill what the portal already knows: profile, employer, education, and
 * draft experience bullets from completed / in-progress modules.
 * Summary, skills, contact extras, and references stay blank for the apprentice.
 */
export function buildCvFromPortal(
  profile: ApprenticePortalProfile = ALEX_PROFILE,
  modules: ApprenticeModuleRow[] = ALEX_MODULES,
): CvPortalSeed {
  const moduleBullets = suggestExperienceBulletsFromModules(
    "",
    Math.min(6, CV_LIMITS.bulletCount),
    modules,
  );

  return {
    fullName: profile.displayName,
    headline: apprenticeHeadline(profile.programmeName),
    email: "",
    phone: "",
    houseNumber: "",
    postcode: "",
    addressLine: "",
    summary: "",
    skills: [],
    experience: [
      {
        id: "cv-exp-portal-employer",
        role: apprenticeHeadline(profile.programmeName),
        company: profile.employerName,
        location: "",
        start: "",
        end: "",
        current: true,
        description: joinCvBullets(moduleBullets),
      },
    ],
    education: [
      {
        id: "cv-edu-portal-programme",
        qualification: profile.programmeName,
        institution: "GTA Apprenticeships",
        start: "",
        end: "",
        detail: educationDetail(profile, modules),
      },
    ],
    referencesOnRequest: true,
    referencePeople: [],
  };
}

export const CV_PORTAL_FIELD_NOTE =
  "Prefilled from your portal record: name, programme, employer, completed modules (as draft work bullets), and education detail. Add your own email, phone, house number, postcode, summary, and skills — and edit any bullets that need to sound more like you.";
