/**
 * CV field validation.
 *
 * Errors block export/email (the CV would look wrong or be unusable).
 * Warnings are advisory — the apprentice can still export.
 */

export const CV_LIMITS = {
  fullName: 60,
  headline: 80,
  email: 254,
  phone: 12, // 11 UK mobile digits + one space
  houseNumber: 20,
  postcode: 8, // e.g. SW1A 1AA
  summary: 700,
  skillLabel: 40,
  skillCount: 20,
  role: 70,
  company: 70,
  description: 700,
  bulletCount: 8,
  bulletLength: 180,
  qualification: 90,
  institution: 90,
  detail: 400,
  referenceName: 60,
  referenceRole: 70,
  referenceOrganisation: 70,
  referenceEmail: 254,
  referencePhone: 20,
  referenceCount: 3,
  jobDescription: 8000,
} as const;

export const REFERENCES_ON_REQUEST_TEXT = "References available on request";

/** Job adverts shorter than this rarely give AI enough to work with. */
export const JOB_DESCRIPTION_MIN = 80;

/** Nothing on a CV predates this. */
const EARLIEST_MONTH = "1950-01";

export type CvExperienceField =
  | "role"
  | "company"
  | "start"
  | "end"
  | "description";

export type CvEducationField =
  | "qualification"
  | "institution"
  | "start"
  | "end"
  | "detail";

export type CvReferenceField =
  | "name"
  | "role"
  | "organisation"
  | "email"
  | "phone";

export type CvValidationResult = {
  errors: {
    fullName?: string;
    headline?: string;
    email?: string;
    phone?: string;
    houseNumber?: string;
    postcode?: string;
    summary?: string;
    references?: string;
    experience: Record<string, Partial<Record<CvExperienceField, string>>>;
    education: Record<string, Partial<Record<CvEducationField, string>>>;
    referencePeople: Record<string, Partial<Record<CvReferenceField, string>>>;
  };
  warnings: string[];
  errorCount: number;
  /** True when the CV is safe to export or email. */
  canExport: boolean;
  /** True when there is enough content to be worth exporting. */
  hasContent: boolean;
};

export type CvReferencePerson = {
  id: string;
  name: string;
  role: string;
  organisation: string;
  email: string;
  phone: string;
};

type ValidatableCv = {
  fullName: string;
  headline: string;
  email: string;
  phone: string;
  houseNumber: string;
  postcode: string;
  summary: string;
  skills: string[];
  experience: Array<{
    id: string;
    role: string;
    company: string;
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
  referencesOnRequest: boolean;
  referencePeople: CvReferencePerson[];
};

/** Current month as `YYYY-MM` — the max sensible date for anything already done. */
export function currentMonth(): string {
  const now = new Date();
  const month = `${now.getMonth() + 1}`.padStart(2, "0");
  return `${now.getFullYear()}-${month}`;
}

/** Ten years ahead — the max sensible date for a planned course end. */
export function maxFutureMonth(): string {
  const now = new Date();
  const month = `${now.getMonth() + 1}`.padStart(2, "0");
  return `${now.getFullYear() + 10}-${month}`;
}

function isValidMonth(value: string): boolean {
  return /^\d{4}-(0[1-9]|1[0-2])$/.test(value);
}

export function validateEmail(value: string): string | undefined {
  const email = value.trim();
  if (!email) return undefined;
  if (email.length > CV_LIMITS.email) return "Email is too long.";
  // Deliberately permissive — catches typos, not exotic-but-valid addresses.
  if (!/^[^\s@]+@[^\s@.]+(\.[^\s@.]+)+$/.test(email)) {
    return "Enter a valid email, e.g. you@example.com";
  }
  return undefined;
}

/** Format a UK postcode as it is typed — uppercase, space before the last 3. */
export function maskUkPostcode(value: string): string {
  const raw = value
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 7);
  if (raw.length <= 3) return raw;
  return `${raw.slice(0, raw.length - 3)} ${raw.slice(-3)}`;
}

export function validateHouseNumber(value: string): string | undefined {
  const house = value.trim();
  if (!house) return undefined;
  if (house.length > CV_LIMITS.houseNumber) {
    return `Keep house number under ${CV_LIMITS.houseNumber} characters.`;
  }
  if (!/^[0-9A-Za-z][0-9A-Za-z\s./-]{0,19}$/.test(house)) {
    return "Use a house number or flat, e.g. 12 or Flat 2.";
  }
  return undefined;
}

export function validatePostcode(value: string): string | undefined {
  const postcode = value.trim().toUpperCase();
  if (!postcode) return undefined;
  // Standard UK outward + inward code, with optional space.
  if (!/^[A-Z]{1,2}\d[A-Z\d]?\s?\d[A-Z]{2}$/.test(postcode)) {
    return "Enter a valid UK postcode, e.g. M1 1AE.";
  }
  return undefined;
}

/** Contact line for the CV preview / email. Prefers a looked-up full address. */
export function formatCvAddress(
  houseNumber: string,
  postcode: string,
  addressLine?: string,
): string {
  const selected = (addressLine || "").trim();
  if (selected) return selected;
  const house = houseNumber.trim();
  const code = maskUkPostcode(postcode).trim();
  if (house && code) return `${house} · ${code}`;
  return house || code;
}

/**
 * Reduce any UK phone input to national digits starting with a single 0.
 * Accepts +44, 0044, 44… and (0)… variants.
 */
export function normaliseUkPhone(value: string): string {
  let raw = value.replace(/[^\d+]/g, "");
  if (raw.startsWith("+44")) raw = `0${raw.slice(3)}`;
  else if (raw.startsWith("0044")) raw = `0${raw.slice(4)}`;
  else if (raw.startsWith("44") && raw.length >= 11) raw = `0${raw.slice(2)}`;
  const digits = raw.replace(/\D/g, "");
  // Collapse a leading 00 / duplicate 0 down to one.
  return digits.replace(/^0+/, "0");
}

/** Hard cap: UK mobiles are exactly 11 digits. */
export const UK_MOBILE_DIGITS = 11;

/**
 * Live input mask — keeps at most 11 digits and inserts a space after the
 * first 5 (07123 456789). Extra keystrokes are dropped.
 */
export function maskUkMobileInput(value: string): string {
  let digits = value.replace(/\D/g, "");
  if (digits.startsWith("44") && digits.length > 2) {
    digits = `0${digits.slice(2)}`;
  }
  digits = digits.slice(0, UK_MOBILE_DIGITS);
  if (digits.length <= 5) return digits;
  return `${digits.slice(0, 5)} ${digits.slice(5)}`;
}

export function validatePhone(value: string): string | undefined {
  const phone = value.trim();
  if (!phone) return undefined;
  if (!/^[\d\s+()-]+$/.test(phone)) {
    return "Use digits only — spaces are added automatically.";
  }

  const national = normaliseUkPhone(phone);
  if (national.length < UK_MOBILE_DIGITS) {
    return `Phone number needs ${UK_MOBILE_DIGITS} digits, e.g. 07123 456789.`;
  }
  if (national.length > UK_MOBILE_DIGITS) {
    return `Phone numbers are exactly ${UK_MOBILE_DIGITS} digits.`;
  }
  return undefined;
}

/** True when the value is a non-empty 11-digit number. */
export function isValidUkPhone(value: string): boolean {
  return Boolean(value.trim()) && validatePhone(value) === undefined;
}

/** Format as 5 digits, space, 6 digits. */
export function formatUkPhone(value: string): string {
  return maskUkMobileInput(value);
}

/** Validates a skill before it is added to the list. */
export function validateSkill(
  value: string,
  existing: string[],
): string | undefined {
  const skill = value.trim();
  if (!skill) return "Enter a skill first.";
  if (skill.length < 2) return "Skills need at least 2 characters.";
  if (skill.length > CV_LIMITS.skillLabel) {
    return `Keep skills under ${CV_LIMITS.skillLabel} characters.`;
  }
  if (existing.some((s) => s.toLowerCase() === skill.toLowerCase())) {
    return "You have already added that skill.";
  }
  if (existing.length >= CV_LIMITS.skillCount) {
    return `You can list up to ${CV_LIMITS.skillCount} skills.`;
  }
  return undefined;
}

/** Split a stored experience description into editable bullet lines. */
export function splitCvBullets(description: string): string[] {
  if (!description) return [];
  return description.split("\n").map((line) =>
    line
      .replace(/^[\u2022•\-\*]\s*/, "")
      .replace(/\u200B/g, "")
      .trim(),
  );
}

/**
 * Join bullet lines back into the stored description string.
 * Blank rows are kept as a zero-width space so the editor can show empty bullets.
 */
export function joinCvBullets(bullets: string[]): string {
  return bullets
    .map((line) =>
      line.replace(/^[\u2022•\-\*]\s*/, "").replace(/\u200B/g, "").trim(),
    )
    .map((line) => (line === "" ? "\u200B" : line))
    .join("\n");
}

/** Count non-empty bullet points (ignores blank editor rows). */
export function countCvBullets(description: string): number {
  return splitCvBullets(description).filter(Boolean).length;
}

function validateBullets(description: string): string | undefined {
  const bullets = splitCvBullets(description).filter(Boolean);
  if (bullets.length > CV_LIMITS.bulletCount) {
    return `Use at most ${CV_LIMITS.bulletCount} points — the rest will not fit.`;
  }
  if (bullets.some((line) => line.length > CV_LIMITS.bulletLength)) {
    return `Keep each point under ${CV_LIMITS.bulletLength} characters.`;
  }
  if (description.replace(/\u200B/g, "").length > CV_LIMITS.description) {
    return `Keep this under ${CV_LIMITS.description} characters.`;
  }
  return undefined;
}

/**
 * A row counts as "started" once any field is filled. Untouched blank rows
 * are ignored so adding a row does not immediately show errors.
 */
function experienceTouched(item: ValidatableCv["experience"][number]): boolean {
  return Boolean(
    item.role.trim() ||
      item.company.trim() ||
      item.start ||
      item.end ||
      item.description.replace(/\u200B/g, "").trim(),
  );
}

function educationTouched(item: ValidatableCv["education"][number]): boolean {
  return Boolean(
    item.qualification.trim() ||
      item.institution.trim() ||
      item.start ||
      item.end ||
      item.detail.trim(),
  );
}

function referenceTouched(item: CvReferencePerson): boolean {
  return Boolean(
    item.name.trim() ||
      item.role.trim() ||
      item.organisation.trim() ||
      item.email.trim() ||
      item.phone.trim(),
  );
}

/** One reference block for the CV preview / plain text. */
export function formatReferencePerson(person: CvReferencePerson): string {
  const lines = [
    person.name.trim(),
    [person.role.trim(), person.organisation.trim()].filter(Boolean).join(" · "),
    [person.email.trim(), person.phone.trim()].filter(Boolean).join(" · "),
  ].filter(Boolean);
  return lines.join("\n");
}

/** Compact text for AI / legacy string contexts. */
export function formatReferencesForExport(
  onRequest: boolean,
  people: CvReferencePerson[],
): string {
  const named = people
    .filter(referenceTouched)
    .map(formatReferencePerson)
    .filter(Boolean);
  const parts: string[] = [];
  if (onRequest) parts.push(REFERENCES_ON_REQUEST_TEXT);
  if (named.length) parts.push(named.join("\n\n"));
  return parts.join("\n\n");
}

export function validateCv(cv: ValidatableCv): CvValidationResult {
  const errors: CvValidationResult["errors"] = {
    experience: {},
    education: {},
    referencePeople: {},
  };
  const warnings: string[] = [];
  const now = currentMonth();

  // --- Personal details ---
  const name = cv.fullName.trim();
  if (!name) {
    errors.fullName = "Add your full name — a CV needs it.";
  } else if (name.length < 2) {
    errors.fullName = "Name looks too short.";
  } else if (name.length > CV_LIMITS.fullName) {
    errors.fullName = `Keep your name under ${CV_LIMITS.fullName} characters.`;
  } else if (!/^[\p{L}][\p{L}\s'.-]*$/u.test(name)) {
    errors.fullName = "Use letters, spaces, hyphens and apostrophes only.";
  }

  if (cv.headline.trim().length > CV_LIMITS.headline) {
    errors.headline = `Keep your headline under ${CV_LIMITS.headline} characters.`;
  }

  errors.email = validateEmail(cv.email);
  errors.phone = validatePhone(cv.phone);
  errors.houseNumber = validateHouseNumber(cv.houseNumber);
  errors.postcode = validatePostcode(cv.postcode);

  if (cv.summary.length > CV_LIMITS.summary) {
    errors.summary = `Keep your summary under ${CV_LIMITS.summary} characters.`;
  }

  // --- Experience ---
  for (const item of cv.experience) {
    if (!experienceTouched(item)) continue;
    const rowErrors: Partial<Record<CvExperienceField, string>> = {};

    if (!item.role.trim()) {
      rowErrors.role = "Add a job title.";
    } else if (item.role.trim().length > CV_LIMITS.role) {
      rowErrors.role = `Keep the job title under ${CV_LIMITS.role} characters.`;
    }

    if (!item.company.trim()) {
      rowErrors.company = "Add the employer name.";
    } else if (item.company.trim().length > CV_LIMITS.company) {
      rowErrors.company = `Keep the employer under ${CV_LIMITS.company} characters.`;
    }

    if (!item.start) {
      rowErrors.start = "Add a start date.";
    } else if (!isValidMonth(item.start)) {
      rowErrors.start = "Enter a valid month.";
    } else if (item.start > now) {
      rowErrors.start = "Start date cannot be in the future.";
    } else if (item.start < EARLIEST_MONTH) {
      rowErrors.start = "That start date looks too far back.";
    }

    if (item.current) {
      if (item.end) {
        rowErrors.end = "Clear the end date, or untick “I currently work here”.";
      }
    } else if (!item.end) {
      rowErrors.end = "Add an end date, or tick “I currently work here”.";
    } else if (!isValidMonth(item.end)) {
      rowErrors.end = "Enter a valid month.";
    } else if (item.end > now) {
      rowErrors.end = "End date cannot be in the future.";
    } else if (item.start && item.end < item.start) {
      rowErrors.end = "End date must be after the start date.";
    }

    const bulletError = validateBullets(item.description);
    if (bulletError) rowErrors.description = bulletError;

    if (!item.description.replace(/\u200B/g, "").trim()) {
      warnings.push(
        `Add a few points about what you do at ${item.company.trim() || "this role"}.`,
      );
    }

    if (Object.keys(rowErrors).length > 0) {
      errors.experience[item.id] = rowErrors;
    }
  }

  // --- Education ---
  const futureLimit = maxFutureMonth();
  for (const item of cv.education) {
    if (!educationTouched(item)) continue;
    const rowErrors: Partial<Record<CvEducationField, string>> = {};

    if (!item.qualification.trim()) {
      rowErrors.qualification = "Add the qualification.";
    } else if (item.qualification.trim().length > CV_LIMITS.qualification) {
      rowErrors.qualification = `Keep this under ${CV_LIMITS.qualification} characters.`;
    }

    if (!item.institution.trim()) {
      rowErrors.institution = "Add where you studied.";
    } else if (item.institution.trim().length > CV_LIMITS.institution) {
      rowErrors.institution = `Keep this under ${CV_LIMITS.institution} characters.`;
    }

    if (item.start) {
      if (!isValidMonth(item.start)) {
        rowErrors.start = "Enter a valid month.";
      } else if (item.start > now) {
        rowErrors.start = "Start date cannot be in the future.";
      } else if (item.start < EARLIEST_MONTH) {
        rowErrors.start = "That start date looks too far back.";
      }
    }

    if (item.end) {
      if (!isValidMonth(item.end)) {
        rowErrors.end = "Enter a valid month.";
      } else if (item.end > futureLimit) {
        rowErrors.end = "That end date is too far ahead.";
      } else if (item.start && item.end < item.start) {
        rowErrors.end = "End date must be after the start date.";
      }
    }

    if (item.detail.length > CV_LIMITS.detail) {
      rowErrors.detail = `Keep this under ${CV_LIMITS.detail} characters.`;
    }

    if (Object.keys(rowErrors).length > 0) {
      errors.education[item.id] = rowErrors;
    }
  }

  // --- References ---
  if (cv.referencePeople.length > CV_LIMITS.referenceCount) {
    errors.references = `You can list up to ${CV_LIMITS.referenceCount} named references.`;
  }

  for (const person of cv.referencePeople) {
    if (!referenceTouched(person)) continue;
    const rowErrors: Partial<Record<CvReferenceField, string>> = {};

    if (!person.name.trim()) {
      rowErrors.name = "Add their name.";
    } else if (person.name.trim().length > CV_LIMITS.referenceName) {
      rowErrors.name = `Keep the name under ${CV_LIMITS.referenceName} characters.`;
    }

    if (person.role.trim().length > CV_LIMITS.referenceRole) {
      rowErrors.role = `Keep the job title under ${CV_LIMITS.referenceRole} characters.`;
    }

    if (person.organisation.trim().length > CV_LIMITS.referenceOrganisation) {
      rowErrors.organisation = `Keep this under ${CV_LIMITS.referenceOrganisation} characters.`;
    }

    if (person.email.trim()) {
      const emailProblem = validateEmail(person.email);
      if (emailProblem) rowErrors.email = emailProblem;
    }

    if (person.phone.trim()) {
      const phoneProblem = validatePhone(person.phone);
      if (phoneProblem) rowErrors.phone = phoneProblem;
    }

    if (!person.email.trim() && !person.phone.trim()) {
      rowErrors.email = "Add an email or phone so they can be contacted.";
    }

    if (Object.keys(rowErrors).length > 0) {
      errors.referencePeople[person.id] = rowErrors;
    }
  }

  if (
    !cv.referencesOnRequest &&
    cv.referencePeople.filter(referenceTouched).length === 0
  ) {
    warnings.push(
      "Add a named reference, or put back “References available on request”.",
    );
  }

  // --- Advisory warnings ---
  if (!cv.email.trim()) {
    warnings.push("Add an email so employers can contact you.");
  }
  if (!cv.phone.trim()) {
    warnings.push("Add a phone number so employers can reach you.");
  }
  if (!cv.summary.trim()) {
    warnings.push("Add a short profile summary — it is the first thing read.");
  }
  if (cv.skills.length === 0) {
    warnings.push("Add some skills.");
  }
  if (cv.experience.length === 0) {
    warnings.push("Add at least one role.");
  }

  const topLevelErrors = [
    errors.fullName,
    errors.headline,
    errors.email,
    errors.phone,
    errors.houseNumber,
    errors.postcode,
    errors.summary,
    errors.references,
  ].filter(Boolean).length;

  const rowErrors =
    Object.values(errors.experience).reduce(
      (total, row) => total + Object.keys(row).length,
      0,
    ) +
    Object.values(errors.education).reduce(
      (total, row) => total + Object.keys(row).length,
      0,
    ) +
    Object.values(errors.referencePeople).reduce(
      (total, row) => total + Object.keys(row).length,
      0,
    );

  const errorCount = topLevelErrors + rowErrors;
  const hasContent = Boolean(cv.fullName.trim());

  return {
    errors,
    warnings,
    errorCount,
    canExport: errorCount === 0 && hasContent,
    hasContent,
  };
}

/** Email-a-copy needs a valid destination address. */
export function validateEmailTarget(email: string): string | undefined {
  if (!email.trim()) return "Add your email address first.";
  return validateEmail(email);
}
