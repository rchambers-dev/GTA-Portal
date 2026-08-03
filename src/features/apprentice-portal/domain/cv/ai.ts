import type { PortalAiContextBag } from "@/lib/ai";
import { requestPortalAi } from "@/lib/ai";
import {
  ALEX_PROFILE,
  type ApprenticePortalProfile,
} from "../mock-apprentice";
import { getCvModulesPublic } from "./seed-from-portal";

export type CvDraftForAi = {
  fullName: string;
  headline: string;
  email: string;
  phone: string;
  houseNumber: string;
  postcode: string;
  addressLine?: string;
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
  /** Serialised references for the model (on-request line and/or named contacts). */
  references: string;
};

let aiProfile: ApprenticePortalProfile = ALEX_PROFILE;

/** Keep CV AI context aligned with the signed-in apprentice. */
export function setCvAiProfile(profile: ApprenticePortalProfile): void {
  aiProfile = profile;
}

function publicProfile() {
  return {
    displayName: aiProfile.displayName,
    initials: aiProfile.initials,
    employerName: aiProfile.employerName,
  };
}

function publicProgramme() {
  return {
    programmeName: aiProfile.programmeName,
    programmeYear: aiProfile.programmeYear,
    programmeWeek: aiProfile.programmeWeek,
    collegeDays: aiProfile.collegeDays,
  };
}

/**
 * Public module facts for CV AI.
 * Uses getCvModulesPublic() so live apprentice modules can replace the mock
 * without changing this call site.
 */
function publicModules() {
  return { modules: getCvModulesPublic() };
}

function baseContext(draft: CvDraftForAi): PortalAiContextBag[] {
  return [
    { scope: "cv.draft", data: draft },
    { scope: "apprentice.profile_public", data: publicProfile() },
    { scope: "apprentice.programme_public", data: publicProgramme() },
  ];
}

function extractJsonObject(text: string): unknown {
  const trimmed = text.trim();
  try {
    return JSON.parse(trimmed);
  } catch {
    const start = trimmed.indexOf("{");
    const end = trimmed.lastIndexOf("}");
    if (start >= 0 && end > start) {
      return JSON.parse(trimmed.slice(start, end + 1));
    }
    throw new Error("AI returned text that was not valid JSON.");
  }
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => (typeof item === "string" ? item.trim() : ""))
    .filter(Boolean);
}

export async function aiImproveCvSummary(draft: CvDraftForAi): Promise<string> {
  const result = await requestPortalAi({
    feature: "cv.improve_summary",
    action: "text.rewrite",
    context: baseContext(draft),
  });
  return result.text.trim();
}

export async function aiImproveCvBullets(
  draft: CvDraftForAi,
): Promise<Array<{ id: string; description: string }>> {
  const modules = publicModules();
  const result = await requestPortalAi({
    feature: "cv.improve_bullets",
    action: "text.rewrite",
    context: [
      ...baseContext(draft),
      ...(modules.modules.length > 0
        ? [{ scope: "apprentice.modules_public" as const, data: modules }]
        : []),
    ],
  });
  const parsed = extractJsonObject(result.text) as {
    experiences?: Array<{ id?: string; description?: string }>;
  };
  const rows = Array.isArray(parsed.experiences) ? parsed.experiences : [];
  return rows
    .filter((row) => row && typeof row.id === "string")
    .map((row) => ({
      id: row.id as string,
      description: String(row.description ?? "").trim(),
    }))
    .filter((row) => row.description);
}

/**
 * Polish a single experience bullet, optionally using portal module titles.
 */
export async function aiRefineCvBullet(
  draft: CvDraftForAi,
  experienceId: string,
  bulletText: string,
): Promise<string> {
  const text = bulletText.trim();
  if (!text) {
    throw new Error("Write a bullet point first, then refine it.");
  }

  const experience = draft.experience.find((row) => row.id === experienceId);
  if (!experience) {
    throw new Error("That role was not found.");
  }

  const focused: CvDraftForAi = {
    ...draft,
    experience: [
      {
        ...experience,
        description: text,
      },
    ],
  };

  const rows = await aiImproveCvBullets(focused);
  const match = rows.find((row) => row.id === experienceId) ?? rows[0];
  const refined = (match?.description ?? "")
    .split("\n")
    .map((line) => line.replace(/^[\u2022•\-\*]\s*/, "").trim())
    .find(Boolean);
  if (!refined) {
    throw new Error("AI did not return a refined bullet.");
  }
  return refined;
}

/**
 * Ask AI to draft experience bullets from completed / in-progress modules.
 */
export async function aiSuggestBulletsFromModules(
  draft: CvDraftForAi,
  experienceId: string,
): Promise<string[]> {
  const modules = publicModules();
  if (modules.modules.length === 0) {
    throw new Error(
      "No completed or in-progress modules are available yet to pull from.",
    );
  }

  const experience = draft.experience.find((row) => row.id === experienceId);
  if (!experience) {
    throw new Error("That role was not found.");
  }

  const focused: CvDraftForAi = {
    ...draft,
    experience: [experience],
  };

  const result = await requestPortalAi({
    feature: "cv.suggest_experience_bullets",
    action: "text.suggest",
    context: [
      ...baseContext(focused),
      { scope: "apprentice.modules_public", data: modules },
    ],
  });

  const parsed = extractJsonObject(result.text) as { bullets?: unknown };
  const bullets = asStringArray(parsed.bullets);
  if (bullets.length === 0) {
    throw new Error("AI did not return any module-based bullets.");
  }
  return bullets;
}

export async function aiSuggestCvSkills(draft: CvDraftForAi): Promise<string[]> {
  const result = await requestPortalAi({
    feature: "cv.suggest_skills",
    action: "text.suggest",
    context: baseContext(draft),
  });
  const parsed = extractJsonObject(result.text) as { skills?: unknown };
  const skills = asStringArray(parsed.skills);
  if (skills.length === 0) {
    throw new Error("AI did not return any skills.");
  }
  return skills;
}

/**
 * Rewrite education detail using programme progress + public module titles.
 * Ready for live module feeds via getCvModulesPublic().
 */
export async function aiImproveCvEducation(
  draft: CvDraftForAi,
): Promise<Array<{ id: string; detail: string }>> {
  const modules = publicModules();
  if (modules.modules.length === 0) {
    throw new Error(
      "No completed or in-progress modules are available yet to reference.",
    );
  }

  const result = await requestPortalAi({
    feature: "cv.improve_education",
    action: "text.rewrite",
    context: [
      ...baseContext(draft),
      { scope: "apprentice.modules_public", data: modules },
    ],
  });

  const parsed = extractJsonObject(result.text) as {
    education?: Array<{ id?: string; detail?: string }>;
  };
  const rows = Array.isArray(parsed.education) ? parsed.education : [];
  const updated = rows
    .filter((row) => row && typeof row.id === "string")
    .map((row) => ({
      id: row.id as string,
      detail: String(row.detail ?? "").trim(),
    }))
    .filter((row) => row.detail);

  if (updated.length === 0) {
    throw new Error("AI did not return any education updates.");
  }
  return updated;
}

export async function aiTailorCvToJob(
  draft: CvDraftForAi,
  jobDescription: string,
): Promise<{
  summary?: string;
  skills?: string[];
  experiences?: Array<{ id: string; description: string }>;
}> {
  const job = jobDescription.trim();
  if (!job) {
    throw new Error("Paste a job description first.");
  }

  const result = await requestPortalAi({
    feature: "cv.tailor_to_job",
    action: "text.rewrite",
    context: [
      ...baseContext(draft),
      { scope: "cv.job_description", data: { text: job } },
    ],
  });

  const parsed = extractJsonObject(result.text) as {
    summary?: string;
    skills?: unknown;
    experiences?: Array<{ id?: string; description?: string }>;
  };

  return {
    summary: typeof parsed.summary === "string" ? parsed.summary.trim() : undefined,
    skills: asStringArray(parsed.skills),
    experiences: Array.isArray(parsed.experiences)
      ? parsed.experiences
          .filter((row) => row && typeof row.id === "string")
          .map((row) => ({
            id: row.id as string,
            description: String(row.description ?? "").trim(),
          }))
          .filter((row) => row.description)
      : [],
  };
}
