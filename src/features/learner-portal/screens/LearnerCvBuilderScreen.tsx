"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AiConsentModal } from "@/components/ai/AiConsentModal";
import {
  AI_CONSENT_SUMMARY,
  defaultAiConsent,
  formatConsentDate,
  getPortalAiStatus,
  readAiConsent,
  writeAiConsent,
  type AiConsentRecord,
  type PortalAiStatus,
} from "@/lib/ai";
import { LearnerPageShell } from "../components/LearnerPageShell";
import { downloadCvPdf } from "../domain/cv/print-cv";
import { lookupUkAddress, type AddressSuggestion } from "../domain/cv/address-lookup";
import {
  aiImproveCvBullets,
  aiImproveCvEducation,
  aiImproveCvSummary,
  aiRefineCvBullet,
  aiSuggestCvSkills,
  aiTailorCvToJob,
} from "../domain/cv/ai";
import {
  buildCvFromPortal,
  CV_PORTAL_FIELD_NOTE,
  getCvModulesPublic,
  suggestExperienceBulletsFromModules,
} from "../domain/cv/seed-from-portal";
import {
  CV_LIMITS,
  countCvBullets,
  currentMonth,
  formatCvAddress,
  formatReferencePerson,
  formatReferencesForExport,
  formatUkPhone,
  JOB_DESCRIPTION_MIN,
  joinCvBullets,
  maskUkMobileInput,
  maskUkPostcode,
  maxFutureMonth,
  REFERENCES_ON_REQUEST_TEXT,
  splitCvBullets,
  validateCv,
  validateEmailTarget,
  validateSkill,
  type CvReferencePerson,
} from "../domain/cv/validation";
import { ALEX_PROFILE } from "../domain/mock-learner";
import styles from "./learner-pages.module.css";

type AiBusyKey =
  | "summary"
  | "bullets"
  | "skills"
  | "education"
  | "tailor"
  | `refine:${string}:${number}`
  | null;

type CvExperience = {
  id: string;
  role: string;
  company: string;
  location: string;
  start: string;
  end: string;
  current: boolean;
  description: string;
};

type CvEducation = {
  id: string;
  qualification: string;
  institution: string;
  start: string;
  end: string;
  detail: string;
};

type CvState = {
  fullName: string;
  headline: string;
  email: string;
  phone: string;
  houseNumber: string;
  postcode: string;
  /** Selected full address from Find address (house + postcode lookup). */
  addressLine: string;
  summary: string;
  skills: string[];
  experience: CvExperience[];
  education: CvEducation[];
  referencesOnRequest: boolean;
  referencePeople: CvReferencePerson[];
};

const STORAGE_KEY = "gta.learner.cv.v7";

const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

function newId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `id-${Math.random().toString(36).slice(2)}`;
}

function formatMonth(value: string): string {
  if (!value) return "";
  const [year, month] = value.split("-");
  const monthIndex = Number(month) - 1;
  if (!year || Number.isNaN(monthIndex) || monthIndex < 0 || monthIndex > 11) {
    return value;
  }
  return `${MONTHS[monthIndex]} ${year}`;
}

function formatRange(start: string, end: string, current: boolean): string {
  const from = formatMonth(start);
  const to = current ? "Present" : formatMonth(end);
  if (from && to) return `${from} – ${to}`;
  return from || to;
}

/** Turn YYYY-MM into a comparable number, or NaN if blank/invalid. */
function monthValue(value: string): number {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(value)) return Number.NaN;
  const [year, month] = value.split("-").map(Number);
  return year * 12 + (month - 1);
}

/**
 * CV order: current roles first, then newest → oldest.
 * Blank “Add role” rows stay at the bottom until they have dates.
 */
function sortExperience(items: CvExperience[]): CvExperience[] {
  return [...items].sort((a, b) => {
    if (a.current !== b.current) return a.current ? -1 : 1;

    const rank = (item: CvExperience): number => {
      if (item.current) {
        const start = monthValue(item.start);
        // Current roles without a start still sit above past jobs.
        return Number.isFinite(start) ? 1_000_000 + start : 2_000_000;
      }
      const end = monthValue(item.end);
      if (Number.isFinite(end)) return end;
      const start = monthValue(item.start);
      if (Number.isFinite(start)) return start;
      return -1;
    };

    return rank(b) - rank(a);
  });
}

/**
 * Education order by date received / earned:
 * 1. Still studying (no end, or expected end in the future) — newest start first
 * 2. Finished qualifications — by end date, most recently earned first
 * 3. Blank “Add entry” rows last until dates are set
 */
function sortEducation(items: CvEducation[]): CvEducation[] {
  const now = monthValue(currentMonth());

  return [...items].sort((a, b) => {
    const isOngoing = (item: CvEducation): boolean => {
      const end = monthValue(item.end);
      if (!Number.isFinite(end)) {
        // Started (or portal programme with content) but no completion date yet.
        return Boolean(item.start) || Boolean(item.qualification.trim() || item.institution.trim());
      }
      return end > now;
    };

    const aOngoing = isOngoing(a);
    const bOngoing = isOngoing(b);
    // Pure blank rows are not "ongoing" — keep them at the bottom.
    const aBlank =
      !a.qualification.trim() &&
      !a.institution.trim() &&
      !a.start &&
      !a.end &&
      !a.detail.trim();
    const bBlank =
      !b.qualification.trim() &&
      !b.institution.trim() &&
      !b.start &&
      !b.end &&
      !b.detail.trim();

    if (aBlank !== bBlank) return aBlank ? 1 : -1;
    if (aOngoing !== bOngoing) return aOngoing ? -1 : 1;

    const earnedRank = (item: CvEducation): number => {
      const end = monthValue(item.end);
      // For finished study, end date = when the qualification was received.
      if (Number.isFinite(end) && end <= now) return end;
      // Ongoing / expected: rank by start (or expected end) so newest study sits highest.
      if (Number.isFinite(end) && end > now) return 1_000_000 + end;
      const start = monthValue(item.start);
      if (Number.isFinite(start)) return 1_000_000 + start;
      return 900_000; // named entry with no dates — above blanks, below dated
    };

    return earnedRank(b) - earnedRank(a);
  });
}

function buildDefaultState(): CvState {
  return buildCvFromPortal();
}

type GtaCvFile = {
  format: "gta-cv";
  version: 1;
  savedAt: string;
  cv: CvState;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function importedString(value: unknown, max: number): string {
  return typeof value === "string" ? value.slice(0, max) : "";
}

function normaliseImportedCv(value: unknown): CvState | null {
  const source =
    isRecord(value) && value.format === "gta-cv" && isRecord(value.cv)
      ? value.cv
      : value;
  if (!isRecord(source)) return null;
  const recognisedKeys = [
    "fullName",
    "headline",
    "summary",
    "skills",
    "experience",
    "education",
    "referencePeople",
    "referencesOnRequest",
  ];
  if (!recognisedKeys.some((key) => key in source)) return null;

  const experience = Array.isArray(source.experience)
    ? source.experience
        .filter(isRecord)
        .slice(0, 12)
        .map((item) => ({
          id: importedString(item.id, 100) || newId(),
          role: importedString(item.role, CV_LIMITS.role),
          company: importedString(item.company, CV_LIMITS.company),
          location: importedString(item.location, 80),
          start: importedString(item.start, 7),
          end: importedString(item.end, 7),
          current: item.current === true,
          description: importedString(item.description, CV_LIMITS.description),
        }))
    : [];

  const education = Array.isArray(source.education)
    ? source.education
        .filter(isRecord)
        .slice(0, 12)
        .map((item) => ({
          id: importedString(item.id, 100) || newId(),
          qualification: importedString(
            item.qualification,
            CV_LIMITS.qualification,
          ),
          institution: importedString(item.institution, CV_LIMITS.institution),
          start: importedString(item.start, 7),
          end: importedString(item.end, 7),
          detail: importedString(item.detail, CV_LIMITS.detail),
        }))
    : [];

  const referencePeople = Array.isArray(source.referencePeople)
    ? source.referencePeople
        .filter(isRecord)
        .slice(0, CV_LIMITS.referenceCount)
        .map((person) => ({
          id: importedString(person.id, 100) || newId(),
          name: importedString(person.name, CV_LIMITS.referenceName),
          role: importedString(person.role, CV_LIMITS.referenceRole),
          organisation: importedString(
            person.organisation,
            CV_LIMITS.referenceOrganisation,
          ),
          email: importedString(person.email, CV_LIMITS.referenceEmail),
          phone: importedString(person.phone, CV_LIMITS.referencePhone),
        }))
    : [];

  const skills = Array.isArray(source.skills)
    ? source.skills
        .filter((skill): skill is string => typeof skill === "string")
        .map((skill) => skill.trim().slice(0, CV_LIMITS.skillLabel))
        .filter(Boolean)
        .slice(0, CV_LIMITS.skillCount)
    : [];

  return {
    fullName: importedString(source.fullName, CV_LIMITS.fullName),
    headline: importedString(source.headline, CV_LIMITS.headline),
    email: importedString(source.email, CV_LIMITS.email),
    phone: importedString(source.phone, CV_LIMITS.phone),
    houseNumber: importedString(source.houseNumber, CV_LIMITS.houseNumber),
    postcode: importedString(source.postcode, CV_LIMITS.postcode),
    addressLine: importedString(source.addressLine, 250),
    summary: importedString(source.summary, CV_LIMITS.summary),
    skills,
    experience,
    education,
    referencesOnRequest: source.referencesOnRequest !== false,
    referencePeople,
  };
}

function cvFileName(name: string): string {
  const safe =
    name
      .trim()
      .replace(/[^\w\s-]+/g, "")
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-") || "My";
  return `${safe}-CV.gta-cv`;
}

function toAiDraft(state: CvState) {
  return {
    ...state,
    references: formatReferencesForExport(
      state.referencesOnRequest,
      state.referencePeople,
    ),
  };
}

function emptyReferencePerson(): CvReferencePerson {
  return {
    id: newId(),
    name: "",
    role: "",
    organisation: "",
    email: "",
    phone: "",
  };
}

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className={styles.cvFieldError}>{message}</p>;
}

function FieldStatus({
  ok,
  error,
}: {
  ok?: string;
  error?: string;
}) {
  if (ok) return <p className={styles.cvFieldOk}>{ok}</p>;
  if (error) return <p className={styles.cvFieldError}>{error}</p>;
  // Reserve the line so ok/error appearing later does not shove neighbours.
  return <p className={styles.cvFieldError} aria-hidden>{"\u00a0"}</p>;
}

function CharCount({ value, max }: { value: string; max: number }) {
  const length = value.length;
  if (length < max * 0.7) return null;
  return (
    <span className={styles.cvCharCount} data-over={length > max ? "true" : undefined}>
      {length}/{max}
    </span>
  );
}

export function LearnerCvBuilderScreen() {
  const [cv, setCv] = useState<CvState>(buildDefaultState);
  const [skillDraft, setSkillDraft] = useState("");
  const [jobDescription, setJobDescription] = useState("");
  const [hydrated, setHydrated] = useState(false);
  const [aiStatus, setAiStatus] = useState<PortalAiStatus | null>(null);
  const [aiBusy, setAiBusy] = useState<AiBusyKey>(null);
  const [aiMessage, setAiMessage] = useState<string | null>(null);
  const [aiError, setAiError] = useState<string | null>(null);
  const [consent, setConsent] = useState<AiConsentRecord>(defaultAiConsent);
  const [consentOpen, setConsentOpen] = useState(false);
  const sheetRef = useRef<HTMLDivElement | null>(null);
  const importCvRef = useRef<HTMLInputElement | null>(null);
  const [pageEstimate, setPageEstimate] = useState(1);
  const [pageHeightPx, setPageHeightPx] = useState(0);
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [showAllErrors, setShowAllErrors] = useState(false);
  const [skillError, setSkillError] = useState<string | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);
  const [addressSuggestions, setAddressSuggestions] = useState<AddressSuggestion[]>(
    [],
  );
  const [addressLookupBusy, setAddressLookupBusy] = useState(false);
  const [addressLookupError, setAddressLookupError] = useState<string | null>(null);
  const [pdfBusy, setPdfBusy] = useState(false);

  useEffect(() => {
    const el = sheetRef.current;
    if (!el) return;

    const compute = () => {
      const width = el.getBoundingClientRect().width;
      if (width < 1) return;
      const pageHeight = width * (297 / 210);
      setPageHeightPx(pageHeight);
      // After min-height is applied, measure the real sheet height.
      requestAnimationFrame(() => {
        // scrollHeight includes content past max-height so over-length is detected.
        const height = Math.max(el.scrollHeight, el.getBoundingClientRect().height);
        const pages = Math.max(1, Math.ceil(height / pageHeight - 0.02));
        setPageEstimate(pages);
      });
    };

    compute();
    const observer = new ResizeObserver(compute);
    observer.observe(el);
    return () => observer.disconnect();
  }, [cv, hydrated]);

  useEffect(() => {
    try {
      const raw =
        window.localStorage.getItem(STORAGE_KEY) ||
        window.localStorage.getItem("gta.learner.cv.v6") ||
        window.localStorage.getItem("gta.learner.cv.v5");
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<CvState> & {
          references?: string;
        };
        setCv((prev) => {
          const legacyText =
            typeof parsed.references === "string" ? parsed.references.trim() : "";
          const referencesOnRequest =
            typeof parsed.referencesOnRequest === "boolean"
              ? parsed.referencesOnRequest
              : !legacyText ||
                /references available on request/i.test(legacyText);
          const referencePeople = Array.isArray(parsed.referencePeople)
            ? parsed.referencePeople.map((person) => ({
                id: person.id || newId(),
                name: person.name || "",
                role: person.role || "",
                organisation: person.organisation || "",
                email: person.email || "",
                phone: person.phone || "",
              }))
            : [];

          const {
            references: _legacyReferences,
            ...parsedWithoutLegacy
          } = parsed;

          const merged: CvState = {
            ...prev,
            ...parsedWithoutLegacy,
            addressLine:
              typeof parsed.addressLine === "string" ? parsed.addressLine : "",
            referencesOnRequest,
            referencePeople,
            experience: sortExperience(parsed.experience ?? prev.experience),
            education: sortEducation(parsed.education ?? prev.education),
          };
          // Auto-draft empty current-role bullets from portal modules (no button).
          const moduleDrafts = suggestExperienceBulletsFromModules(
            "",
            Math.min(6, CV_LIMITS.bulletCount),
          );
          if (moduleDrafts.length === 0) return merged;
          return {
            ...merged,
            experience: merged.experience.map((item) => {
              if (!item.current || countCvBullets(item.description) > 0) return item;
              return { ...item, description: joinCvBullets(moduleDrafts) };
            }),
          };
        });
      }
    } catch {
      // Ignore malformed storage; fall back to defaults.
    }
    // Read consent only after mount so SSR HTML matches the first client paint.
    const storedConsent = readAiConsent();
    setConsent(storedConsent);
    if (storedConsent.agreed === null) {
      setConsentOpen(true);
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(cv));
    } catch {
      // Storage full or unavailable — not fatal for a preview.
    }
  }, [cv, hydrated]);

  useEffect(() => {
    let cancelled = false;
    getPortalAiStatus()
      .then((status) => {
        if (!cancelled) setAiStatus(status);
      })
      .catch(() => {
        if (!cancelled) setAiStatus(null);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const setField = useCallback(
    <K extends keyof CvState>(key: K, value: CvState[K]) => {
      setCv((prev) => ({ ...prev, [key]: value }));
    },
    [],
  );

  const validation = useMemo(() => validateCv(cv), [cv]);
  const monthMax = useMemo(() => currentMonth(), []);
  const eduMonthMax = useMemo(() => maxFutureMonth(), []);

  const markTouched = useCallback((key: string) => {
    setTouched((prev) => (prev[key] ? prev : { ...prev, [key]: true }));
  }, []);

  /** Only surface an error once the learner has left the field, or tried to export. */
  const visibleError = useCallback(
    (key: string, message?: string) =>
      message && (showAllErrors || touched[key]) ? message : undefined,
    [showAllErrors, touched],
  );

  const aiConsented = consent.agreed === true;
  const aiReady = Boolean(aiStatus?.configured && aiStatus?.canUse && aiConsented);
  const aiBusyAny = aiBusy !== null;
  const modulesAvailable = getCvModulesPublic().length > 0;
  const jobDescriptionTooShort =
    jobDescription.trim().length > 0 &&
    jobDescription.trim().length < JOB_DESCRIPTION_MIN;

  function agreeToAi() {
    const next = writeAiConsent(true);
    setConsent(next);
    setConsentOpen(false);
    setAiMessage("AI enabled. You can turn it off again from the agreement panel.");
    setAiError(null);
  }

  function declineAi() {
    const next = writeAiConsent(false);
    setConsent(next);
    setConsentOpen(false);
    setAiMessage(null);
    setAiError(null);
  }

  function turnOffAi() {
    const next = writeAiConsent(false);
    setConsent(next);
    setAiMessage("AI turned off. Agree again if you want to use AI features.");
    setAiError(null);
  }

  function requestAiAccess() {
    if (consent.agreed === true) return true;
    setConsentOpen(true);
    return false;
  }

  async function runAiAction(key: Exclude<AiBusyKey, null>, work: () => Promise<void>) {
    if (aiBusyAny) return;
    if (!requestAiAccess()) return;
    setAiBusy(key);
    setAiError(null);
    setAiMessage(null);
    try {
      await work();
      const status = await getPortalAiStatus().catch(() => null);
      if (status) setAiStatus(status);
    } catch (err) {
      setAiError(err instanceof Error ? err.message : "AI request failed.");
    } finally {
      setAiBusy(null);
    }
  }

  function addSkill() {
    const value = skillDraft.trim();
    const problem = validateSkill(value, cv.skills);
    if (problem) {
      setSkillError(problem);
      return;
    }
    setCv((prev) => ({ ...prev, skills: [...prev.skills, value] }));
    setSkillDraft("");
    setSkillError(null);
  }

  function removeSkill(skill: string) {
    setCv((prev) => ({
      ...prev,
      skills: prev.skills.filter((s) => s !== skill),
    }));
    setSkillError(null);
  }

  function addExperience() {
    setCv((prev) => ({
      ...prev,
      experience: sortExperience([
        ...prev.experience,
        {
          id: newId(),
          role: "",
          company: "",
          location: "",
          start: "",
          end: "",
          current: false,
          description: "",
        },
      ]),
    }));
  }

  function updateExperience(id: string, patch: Partial<CvExperience>) {
    setCv((prev) => ({
      ...prev,
      experience: sortExperience(
        prev.experience.map((item) => {
          if (item.id !== id) return item;
          const next = { ...item, ...patch };
          // An ongoing role cannot also have an end date.
          if (next.current) next.end = "";
          return next;
        }),
      ),
    }));
  }

  function removeExperience(id: string) {
    setCv((prev) => ({
      ...prev,
      experience: prev.experience.filter((item) => item.id !== id),
    }));
  }

  function addEducation() {
    setCv((prev) => ({
      ...prev,
      education: sortEducation([
        ...prev.education,
        {
          id: newId(),
          qualification: "",
          institution: "",
          start: "",
          end: "",
          detail: "",
        },
      ]),
    }));
  }

  function updateEducation(id: string, patch: Partial<CvEducation>) {
    setCv((prev) => ({
      ...prev,
      education: sortEducation(
        prev.education.map((item) =>
          item.id === id ? { ...item, ...patch } : item,
        ),
      ),
    }));
  }

  function removeEducation(id: string) {
    setCv((prev) => ({
      ...prev,
      education: prev.education.filter((item) => item.id !== id),
    }));
  }

  function addReferencePerson() {
    setCv((prev) => {
      if (prev.referencePeople.length >= CV_LIMITS.referenceCount) return prev;
      return {
        ...prev,
        referencePeople: [...prev.referencePeople, emptyReferencePerson()],
      };
    });
  }

  function updateReferencePerson(id: string, patch: Partial<CvReferencePerson>) {
    setCv((prev) => ({
      ...prev,
      referencePeople: prev.referencePeople.map((person) =>
        person.id === id ? { ...person, ...patch } : person,
      ),
    }));
  }

  function removeReferencePerson(id: string) {
    setCv((prev) => ({
      ...prev,
      referencePeople: prev.referencePeople.filter((person) => person.id !== id),
    }));
  }

  function restoreReferencesOnRequest() {
    setField("referencesOnRequest", true);
  }

  function removeReferencesOnRequest() {
    setField("referencesOnRequest", false);
  }

  function resetCv() {
    const confirmed = window.confirm(
      "Reset to portal facts only? This clears your written summary, skills, bullets, and other manual extras.",
    );
    if (!confirmed) return;
    const fresh = buildDefaultState();
    setCv(fresh);
    setJobDescription("");
    setAiMessage(null);
    setAiError(null);
    setTouched({});
    setShowAllErrors(false);
    setSkillError(null);
    setExportError(null);
  }

  function saveEditableCopy() {
    const file: GtaCvFile = {
      format: "gta-cv",
      version: 1,
      savedAt: new Date().toISOString(),
      cv,
    };
    const blob = new Blob([JSON.stringify(file, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = cvFileName(cv.fullName);
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    setExportError(null);
    setAiMessage("Editable GTA CV copy downloaded.");
  }

  async function importPreviousCv(file: File) {
    setExportError(null);
    setAiMessage(null);
    try {
      const parsed = JSON.parse(await file.text()) as unknown;
      const imported = normaliseImportedCv(parsed);
      if (!imported) {
        throw new Error("This is not a recognised GTA CV file.");
      }

      const confirmed = window.confirm(
        "Import this GTA CV? It will replace the CV currently in the builder.",
      );
      if (!confirmed) return;

      setCv(imported);
      setTouched({});
      setShowAllErrors(false);
      setSkillError(null);
      setAddressSuggestions([]);
      setAddressLookupError(null);
      setAiMessage("Previous GTA CV imported. Review it before downloading.");
    } catch (error) {
      setExportError(
        error instanceof Error
          ? error.message
          : "Could not import that GTA CV file.",
      );
    } finally {
      if (importCvRef.current) importCvRef.current.value = "";
    }
  }

  /** Reveals every outstanding error and returns false when export should stop. */
  function blockedByValidation(): boolean {
    if (validation.canExport) {
      setExportError(null);
      return false;
    }
    setShowAllErrors(true);
    setExportError(
      validation.hasContent
        ? `Fix ${validation.errorCount} ${
            validation.errorCount === 1 ? "problem" : "problems"
          } in the form before exporting.`
        : "Add your full name before exporting.",
    );
    return true;
  }

  async function downloadPdf() {
    if (blockedByValidation() || pdfBusy) return;
    const sheet = sheetRef.current;
    if (!sheet) {
      setExportError("CV preview is not ready yet. Try again in a moment.");
      return;
    }
    setExportError(null);
    setAiMessage(null);
    setPdfBusy(true);
    try {
      await downloadCvPdf(sheet, cv.fullName);
      setAiMessage("Your CV PDF has been downloaded.");
    } catch {
      setExportError(
        "Could not create the PDF. Check your browser permissions and try again.",
      );
    } finally {
      setPdfBusy(false);
    }
  }

  const plainText = useMemo(() => buildPlainText(cv), [cv]);

  function emailCopy() {
    if (blockedByValidation()) return;
    const emailProblem = validateEmailTarget(cv.email);
    if (emailProblem) {
      setShowAllErrors(true);
      setExportError(emailProblem);
      return;
    }
    const subject = `CV — ${cv.fullName || "My CV"}`;
    const body = `${plainText}\n\n---\nTip: for the formatted version, use “Download PDF” in the CV builder and attach the saved file to this email.`;
    const href = `mailto:${encodeURIComponent(cv.email)}?subject=${encodeURIComponent(
      subject,
    )}&body=${encodeURIComponent(body)}`;
    window.location.href = href;
  }

  function improveSummary() {
    void runAiAction("summary", async () => {
      const next = await aiImproveCvSummary(toAiDraft(cv));
      setField("summary", next);
      setAiMessage("Summary updated with AI. Review it before exporting.");
    });
  }

  function improveBullets() {
    void runAiAction("bullets", async () => {
      const rows = await aiImproveCvBullets(toAiDraft(cv));
      if (rows.length === 0) {
        throw new Error("AI did not return any experience updates.");
      }
      setCv((prev) => ({
        ...prev,
        experience: prev.experience.map((item) => {
          const match = rows.find((row) => row.id === item.id);
          return match ? { ...item, description: match.description } : item;
        }),
      }));
      setAiMessage("Experience bullets updated with AI. Check they still sound like you.");
    });
  }

  function setExperienceBullets(experienceId: string, bullets: string[]) {
    updateExperience(experienceId, { description: joinCvBullets(bullets) });
  }

  function addExperienceBullet(experienceId: string) {
    const item = cv.experience.find((row) => row.id === experienceId);
    if (!item) return;
    const bullets = splitCvBullets(item.description);
    const rows = bullets.length > 0 ? bullets : [""];
    if (countCvBullets(item.description) >= CV_LIMITS.bulletCount) {
      setAiError(`You can add up to ${CV_LIMITS.bulletCount} points per role.`);
      return;
    }
    if (rows.length >= CV_LIMITS.bulletCount) {
      setAiError(`You can add up to ${CV_LIMITS.bulletCount} points per role.`);
      return;
    }
    setExperienceBullets(experienceId, [...rows, ""]);
    markTouched(`exp:${experienceId}:description`);
  }

  function removeExperienceBullet(experienceId: string, index: number) {
    const item = cv.experience.find((row) => row.id === experienceId);
    if (!item) return;
    const rows = splitCvBullets(item.description);
    const next = (rows.length > 0 ? rows : [""]).filter((_, i) => i !== index);
    setExperienceBullets(experienceId, next.length > 0 ? next : []);
    markTouched(`exp:${experienceId}:description`);
  }

  function refineExperienceBullet(experienceId: string, index: number) {
    const item = cv.experience.find((row) => row.id === experienceId);
    if (!item) return;
    const bullets = splitCvBullets(item.description);
    const rows = bullets.length > 0 ? bullets : [""];
    const current = rows[index]?.trim() ?? "";
    void runAiAction(`refine:${experienceId}:${index}`, async () => {
      const next = await aiRefineCvBullet(toAiDraft(cv), experienceId, current);
      const updated = [...rows];
      updated[index] = next.slice(0, CV_LIMITS.bulletLength);
      setExperienceBullets(experienceId, updated);
      markTouched(`exp:${experienceId}:description`);
      setAiMessage("Bullet refined with AI. Check it still sounds like you.");
    });
  }

  function suggestSkills() {
    void runAiAction("skills", async () => {
      const skills = await aiSuggestCvSkills(toAiDraft(cv));
      setField("skills", skills);
      setAiMessage("Skills refreshed with AI suggestions. Remove any that do not fit.");
    });
  }

  function improveEducation() {
    void runAiAction("education", async () => {
      const rows = await aiImproveCvEducation(toAiDraft(cv));
      setCv((prev) => ({
        ...prev,
        education: prev.education.map((item) => {
          const match = rows.find((row) => row.id === item.id);
          return match ? { ...item, detail: match.detail } : item;
        }),
      }));
      setAiMessage(
        "Education detail updated from your modules. Check it still sounds like you.",
      );
    });
  }

  function tailorToJob() {
    void runAiAction("tailor", async () => {
      const tailored = await aiTailorCvToJob(toAiDraft(cv), jobDescription);
      setCv((prev) => ({
        ...prev,
        summary: tailored.summary || prev.summary,
        skills:
          tailored.skills && tailored.skills.length > 0 ? tailored.skills : prev.skills,
        experience: prev.experience.map((item) => {
          const match = tailored.experiences?.find((row) => row.id === item.id);
          return match ? { ...item, description: match.description } : item;
        }),
      }));
      setAiMessage("CV tailored to the job description. Review every change carefully.");
    });
  }

  return (
    <>
    <LearnerPageShell
      title="CV builder"
      description="Build a clean, professional CV from your details. Use AI to polish wording — everything saves as you type, then export as PDF or email yourself a copy."
      actions={
        <div className={styles.cvActions} data-print-hide>
          <input
            ref={importCvRef}
            className={styles.cvImportInput}
            type="file"
            accept=".gta-cv,.json,application/json"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void importPreviousCv(file);
            }}
          />
          <button
            type="button"
            className={styles.ghostBtn}
            onClick={() => importCvRef.current?.click()}
          >
            Import previous CV
          </button>
          <button
            type="button"
            className={styles.ghostBtn}
            onClick={saveEditableCopy}
          >
            Save editable copy
          </button>
          <button type="button" className={styles.ghostBtn} onClick={emailCopy}>
            Email a copy
          </button>
          <button type="button" className={styles.ghostBtn} onClick={resetCv}>
            Reset
          </button>
          <button
            type="button"
            className={styles.primaryBtn}
            onClick={() => void downloadPdf()}
            disabled={pdfBusy}
          >
            {pdfBusy ? "Preparing PDF…" : "Download PDF"}
          </button>
        </div>
      }
    >
      <div className={styles.cvLayout}>
        <div className={styles.cvEditor} data-print-hide>
          <section
            className={styles.cvAiBar}
            data-state={aiConsented ? "on" : "off"}
            aria-label="AI assist and agreement"
          >
            <div className={styles.cvAiBarMain}>
              <div className={styles.cvAiBarTitleRow}>
                <div className={styles.cvAiBarHeading}>
                  <span className={styles.cvAiStatusDot} aria-hidden />
                  <p className={styles.cvAiBarTitle}>AI assist</p>
                  <span className={styles.cvAiStateChip}>
                    {aiConsented ? "Active" : "Off"}
                  </span>
                </div>
                <p className={styles.cvAiBarMeta}>
                  {aiStatus?.configured
                    ? `${aiStatus.remainingToday ?? "∞"} uses left today`
                    : "Not configured"}
                </p>
              </div>
              <p className={styles.cvAiBarCopy}>
                {!aiStatus?.configured
                  ? "AI is not ready yet. Check the API key in .env.local and refresh."
                  : aiConsented
                    ? "Improve wording inside a locked access container — only your CV draft and public programme details are shared."
                    : "AI is available, but turned off until you agree to the AI notice."}
              </p>
              {aiConsented ? (
                <div className={styles.cvAiAgreement}>
                  <p className={styles.cvConsentNoticeCopy}>{AI_CONSENT_SUMMARY}</p>
                  {consent.decidedAt ? (
                    <p className={styles.cvConsentNoticeMeta}>
                      Agreed {formatConsentDate(consent.decidedAt)}
                    </p>
                  ) : null}
                </div>
              ) : null}
            </div>
            <div className={styles.cvAiBarSide}>
              {aiConsented ? (
                <button
                  type="button"
                  className={styles.cvAiToggleOn}
                  onClick={turnOffAi}
                  title="Click to turn AI off"
                >
                  <span className={styles.cvAiToggleDot} aria-hidden />
                  Turn AI off
                </button>
              ) : (
                <button
                  type="button"
                  className={styles.cvAiToggleOff}
                  onClick={() => setConsentOpen(true)}
                  disabled={!aiStatus?.configured || !aiStatus?.canUse}
                  title="Click to agree and enable AI"
                >
                  <span className={styles.cvAiToggleDot} aria-hidden />
                  Enable AI
                </button>
              )}
            </div>
          </section>

          {aiMessage ? (
            <p className={styles.cvAiSuccess} role="status">
              <span className={styles.cvNoticeLabel}>Done</span>
              {aiMessage}
            </p>
          ) : null}
          {aiError ? (
            <p className={styles.cvAiError} role="alert">
              <span className={styles.cvNoticeLabel}>Problem</span>
              {aiError}
            </p>
          ) : null}
          {exportError ? (
            <p className={styles.cvAiError} role="alert">
              <span className={styles.cvNoticeLabel}>Export blocked</span>
              {exportError}
            </p>
          ) : null}

          {validation.errorCount > 0 && showAllErrors ? (
            <p className={styles.cvIssueBanner} data-tone="error" role="alert">
              <span className={styles.cvNoticeLabel}>Fix before export</span>
              {validation.errorCount === 1
                ? "1 field needs fixing before you can export."
                : `${validation.errorCount} fields need fixing before you can export.`}
            </p>
          ) : validation.warnings.length > 0 ? (
            <div className={styles.cvIssueBanner} data-tone="warning" role="status">
              <p className={styles.cvIssueTitle}>To make this CV stronger</p>
              <ul className={styles.cvIssueList}>
                {validation.warnings.slice(0, 4).map((warning) => (
                  <li key={warning}>{warning}</li>
                ))}
              </ul>
            </div>
          ) : null}

          <p className={styles.cvPortalNote}>{CV_PORTAL_FIELD_NOTE}</p>

          <section className={styles.cvGroup}>
            <div className={styles.cvGroupHead}>
              <h2 className={styles.cvGroupTitle}>Personal details</h2>
              <span className={styles.cvPortalBadge}>Portal + your extras</span>
            </div>
            <div className={styles.cvField}>
              <label className={styles.cvLabel} htmlFor="cv-name">
                Full name <span className={styles.cvRequired}>required</span>
              </label>
              <input
                id="cv-name"
                className={styles.cvInput}
                value={cv.fullName}
                maxLength={CV_LIMITS.fullName}
                autoComplete="name"
                aria-invalid={visibleError("fullName", validation.errors.fullName) ? true : undefined}
                onBlur={() => markTouched("fullName")}
                onChange={(e) => setField("fullName", e.target.value)}
                placeholder="e.g. Alex Morgan"
              />
              <FieldError message={visibleError("fullName", validation.errors.fullName)} />
            </div>
            <div className={styles.cvField}>
              <label className={styles.cvLabel} htmlFor="cv-headline">
                Headline / role
              </label>
              <input
                id="cv-headline"
                className={styles.cvInput}
                value={cv.headline}
                maxLength={CV_LIMITS.headline}
                aria-invalid={visibleError("headline", validation.errors.headline) ? true : undefined}
                onBlur={() => markTouched("headline")}
                onChange={(e) => setField("headline", e.target.value)}
                placeholder="e.g. Apprentice Autocare Technician"
              />
              <FieldError message={visibleError("headline", validation.errors.headline)} />
              <p className={styles.cvFieldHint}>
                The job title under your name on the CV — usually your apprentice role.
              </p>
            </div>
            <div className={styles.cvRow}>
              <div className={styles.cvField}>
                <label className={styles.cvLabel} htmlFor="cv-email">
                  Email
                </label>
                <input
                  id="cv-email"
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  className={styles.cvInput}
                  value={cv.email}
                  maxLength={CV_LIMITS.email}
                  data-valid={
                    cv.email.trim() && !validation.errors.email ? "true" : undefined
                  }
                  aria-invalid={visibleError("email", validation.errors.email) ? true : undefined}
                  onBlur={() => markTouched("email")}
                  onChange={(e) => setField("email", e.target.value)}
                  placeholder="e.g. alex.morgan@email.com"
                />
                <FieldStatus
                  ok={
                    cv.email.trim() && !validation.errors.email
                      ? "Looks like a valid email"
                      : undefined
                  }
                  error={visibleError("email", validation.errors.email)}
                />
              </div>
              <div className={styles.cvField}>
                <label className={styles.cvLabel} htmlFor="cv-phone">
                  Phone
                </label>
                <input
                  id="cv-phone"
                  type="tel"
                  inputMode="numeric"
                  autoComplete="tel"
                  className={styles.cvInput}
                  value={cv.phone}
                  maxLength={CV_LIMITS.phone}
                  data-valid={
                    cv.phone.trim() && !validation.errors.phone ? "true" : undefined
                  }
                  aria-invalid={visibleError("phone", validation.errors.phone) ? true : undefined}
                  onBlur={() => {
                    markTouched("phone");
                    const tidy = formatUkPhone(cv.phone);
                    if (tidy !== cv.phone) setField("phone", tidy);
                  }}
                  onChange={(e) => setField("phone", maskUkMobileInput(e.target.value))}
                  placeholder="e.g. 07123 456789"
                />
                <FieldStatus
                  ok={
                    cv.phone.trim() && !validation.errors.phone
                      ? "Valid phone number"
                      : undefined
                  }
                  error={visibleError("phone", validation.errors.phone)}
                />
              </div>
            </div>
            <div className={styles.cvRow}>
              <div className={styles.cvField}>
                <label className={styles.cvLabel} htmlFor="cv-house">
                  House number
                </label>
                <input
                  id="cv-house"
                  className={styles.cvInput}
                  value={cv.houseNumber}
                  maxLength={CV_LIMITS.houseNumber}
                  autoComplete="address-line1"
                  data-valid={
                    cv.houseNumber.trim() && !validation.errors.houseNumber
                      ? "true"
                      : undefined
                  }
                  aria-invalid={
                    visibleError("houseNumber", validation.errors.houseNumber)
                      ? true
                      : undefined
                  }
                  onBlur={() => markTouched("houseNumber")}
                  onChange={(e) => {
                    const value = e.target.value;
                    setCv((prev) => ({
                      ...prev,
                      houseNumber: value,
                      addressLine: "",
                    }));
                    setAddressSuggestions([]);
                    setAddressLookupError(null);
                  }}
                  placeholder="e.g. 12 or Flat 2"
                />
                <FieldStatus
                  ok={
                    cv.houseNumber.trim() && !validation.errors.houseNumber
                      ? "Looks good"
                      : undefined
                  }
                  error={visibleError("houseNumber", validation.errors.houseNumber)}
                />
              </div>
              <div className={styles.cvField}>
                <label className={styles.cvLabel} htmlFor="cv-postcode">
                  Postcode
                </label>
                <input
                  id="cv-postcode"
                  className={styles.cvInput}
                  value={cv.postcode}
                  maxLength={CV_LIMITS.postcode}
                  autoComplete="postal-code"
                  spellCheck={false}
                  data-valid={
                    cv.postcode.trim() && !validation.errors.postcode
                      ? "true"
                      : undefined
                  }
                  aria-invalid={
                    visibleError("postcode", validation.errors.postcode)
                      ? true
                      : undefined
                  }
                  onBlur={() => {
                    markTouched("postcode");
                    const tidy = maskUkPostcode(cv.postcode);
                    if (tidy !== cv.postcode) setField("postcode", tidy);
                  }}
                  onChange={(e) => {
                    const value = maskUkPostcode(e.target.value);
                    setCv((prev) => ({
                      ...prev,
                      postcode: value,
                      addressLine: "",
                    }));
                    setAddressSuggestions([]);
                    setAddressLookupError(null);
                  }}
                  placeholder="e.g. M1 1AE"
                />
                <FieldStatus
                  ok={
                    cv.postcode.trim() && !validation.errors.postcode
                      ? "Valid UK postcode"
                      : undefined
                  }
                  error={visibleError("postcode", validation.errors.postcode)}
                />
              </div>
            </div>
            <div className={styles.cvAddressLookup}>
              <div className={styles.cvAddressLookupActions}>
                <button
                  type="button"
                  className={styles.ghostBtn}
                  disabled={
                    addressLookupBusy ||
                    !cv.houseNumber.trim() ||
                    Boolean(validation.errors.houseNumber) ||
                    !cv.postcode.trim() ||
                    Boolean(validation.errors.postcode)
                  }
                  onClick={() => {
                    void (async () => {
                      setAddressLookupBusy(true);
                      setAddressLookupError(null);
                      setAddressSuggestions([]);
                      try {
                        const result = await lookupUkAddress(
                          cv.houseNumber,
                          cv.postcode,
                        );
                        setAddressSuggestions(result.suggestions);
                        if (result.suggestions.length === 1) {
                          const only = result.suggestions[0];
                          setField("addressLine", only.line);
                          setAddressSuggestions([]);
                        }
                      } catch (err) {
                        setAddressLookupError(
                          err instanceof Error
                            ? err.message
                            : "Address lookup failed.",
                        );
                      } finally {
                        setAddressLookupBusy(false);
                      }
                    })();
                  }}
                >
                  {addressLookupBusy ? "Searching…" : "Find address"}
                </button>
                {cv.addressLine ? (
                  <p className={styles.cvAddressSelected}>
                    Using: <strong>{cv.addressLine}</strong>
                  </p>
                ) : (
                  <p className={styles.cvBulletHint}>
                    Enter house number and postcode, then Find address to confirm
                    the match for your CV.
                  </p>
                )}
              </div>
              {addressLookupError ? (
                <p className={styles.cvFieldError}>{addressLookupError}</p>
              ) : null}
              {addressSuggestions.length > 1 ? (
                <ul className={styles.cvAddressResults} role="listbox" aria-label="Address matches">
                  {addressSuggestions.map((suggestion) => (
                    <li key={suggestion.id}>
                      <button
                        type="button"
                        className={styles.cvAddressResultBtn}
                        onClick={() => {
                          setField("addressLine", suggestion.line);
                          setAddressSuggestions([]);
                          setAddressLookupError(null);
                        }}
                      >
                        {suggestion.label}
                      </button>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          </section>

          <section className={styles.cvGroup}>
            <div className={styles.cvGroupHead}>
              <h2 className={styles.cvGroupTitle}>Professional summary</h2>
              <div className={styles.cvGroupActions}>
                <span className={styles.cvManualBadge}>Add yourself</span>
                <button
                  type="button"
                  className={styles.cvAiBtn}
                  onClick={improveSummary}
                  disabled={!aiReady || aiBusyAny || !cv.summary.trim()}
                >
                  {aiBusy === "summary" ? "Improving…" : "Improve with AI"}
                </button>
              </div>
            </div>
            <p className={styles.meta}>
              3–5 short sentences about you: your programme, where you work, what you are
              good at, and what you want next. Keep it honest — employers read this first.
            </p>
            <div className={styles.cvField}>
              <textarea
                className={styles.cvTextarea}
                value={cv.summary}
                maxLength={CV_LIMITS.summary}
                aria-invalid={visibleError("summary", validation.errors.summary) ? true : undefined}
                onBlur={() => markTouched("summary")}
                onChange={(e) => setField("summary", e.target.value)}
                rows={4}
                placeholder="e.g. Motivated Autocare Technician apprentice with hands-on workshop experience. Confident with routine services, health & safety, and supporting senior technicians. Looking for a full-time technician role where I can keep building diagnostic skills."
              />
              <div className={styles.cvFieldFoot}>
                <FieldError message={visibleError("summary", validation.errors.summary)} />
                <CharCount value={cv.summary} max={CV_LIMITS.summary} />
              </div>
            </div>
          </section>

          <section className={styles.cvGroup}>
            <div className={styles.cvGroupHead}>
              <h2 className={styles.cvGroupTitle}>Skills</h2>
              <div className={styles.cvGroupActions}>
                <span className={styles.cvManualBadge}>Add yourself</span>
                <button
                  type="button"
                  className={styles.cvAiBtn}
                  onClick={suggestSkills}
                  disabled={!aiReady || aiBusyAny}
                >
                  {aiBusy === "skills" ? "Suggesting…" : "Suggest with AI"}
                </button>
              </div>
            </div>
            <p className={styles.meta}>
              List tools, systems, and strengths an employer would care about — keep each
              skill short (a few words).
            </p>
            <div className={styles.cvSkillAdd}>
              <input
                className={styles.cvInput}
                value={skillDraft}
                maxLength={CV_LIMITS.skillLabel}
                aria-invalid={skillError ? true : undefined}
                onChange={(e) => {
                  setSkillDraft(e.target.value);
                  if (skillError) setSkillError(null);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addSkill();
                  }
                }}
                placeholder="e.g. Diagnostic scanners, customer handover, MOT prep"
              />
              <button
                type="button"
                className={styles.ghostBtn}
                onClick={addSkill}
                disabled={cv.skills.length >= CV_LIMITS.skillCount}
              >
                Add
              </button>
            </div>
            <FieldError message={skillError ?? undefined} />
            {cv.skills.length >= CV_LIMITS.skillCount ? (
              <p className={styles.meta}>
                Skill list is full ({CV_LIMITS.skillCount}). Remove one to add another.
              </p>
            ) : null}
            {cv.skills.length > 0 ? (
              <ul className={styles.cvChips}>
                {cv.skills.map((skill) => (
                  <li key={skill} className={styles.cvChip}>
                    <span>{skill}</span>
                    <button
                      type="button"
                      className={styles.cvChipRemove}
                      onClick={() => removeSkill(skill)}
                      aria-label={`Remove ${skill}`}
                    >
                      ×
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className={styles.meta}>No skills added yet.</p>
            )}
          </section>

          <section className={styles.cvGroup}>
            <div className={styles.cvGroupHead}>
              <h2 className={styles.cvGroupTitle}>Work experience</h2>
              <div className={styles.cvGroupActions}>
                <span className={styles.cvPortalBadge}>Employer from portal</span>
                <button
                  type="button"
                  className={styles.cvAiBtn}
                  onClick={improveBullets}
                  disabled={!aiReady || aiBusyAny || cv.experience.length === 0}
                >
                  {aiBusy === "bullets" ? "Improving…" : "Improve bullets"}
                </button>
                <button type="button" className={styles.ghostBtn} onClick={addExperience}>
                  Add role
                </button>
              </div>
            </div>
            <p className={styles.meta}>
              Your current employer is prefilled. Work bullets are drafted automatically
              from your completed and in-progress modules — edit anything that does not
              match what you actually do. Add older jobs yourself. Roles sort newest first
              once dates are set.
            </p>
            {cv.experience.map((item) => {
              const rowErrors = validation.errors.experience[item.id] ?? {};
              return (
              <div key={item.id} className={styles.cvItem}>
                <div className={styles.cvItemHead}>
                  <span className={styles.cvItemLabel}>Role</span>
                  <button
                    type="button"
                    className={styles.cvItemRemove}
                    onClick={() => removeExperience(item.id)}
                  >
                    Remove
                  </button>
                </div>
                <div className={styles.cvRow}>
                  <div className={styles.cvField}>
                    <label className={styles.cvLabel}>
                      Job title <span className={styles.cvRequired}>required</span>
                    </label>
                    <input
                      className={styles.cvInput}
                      value={item.role}
                      maxLength={CV_LIMITS.role}
                      aria-invalid={visibleError(`exp:${item.id}:role`, rowErrors.role) ? true : undefined}
                      onBlur={() => markTouched(`exp:${item.id}:role`)}
                      onChange={(e) => updateExperience(item.id, { role: e.target.value })}
                      placeholder="e.g. Apprentice Technician"
                    />
                    <FieldError message={visibleError(`exp:${item.id}:role`, rowErrors.role)} />
                  </div>
                  <div className={styles.cvField}>
                    <label className={styles.cvLabel}>
                      Employer <span className={styles.cvRequired}>required</span>
                    </label>
                    <input
                      className={styles.cvInput}
                      value={item.company}
                      maxLength={CV_LIMITS.company}
                      aria-invalid={visibleError(`exp:${item.id}:company`, rowErrors.company) ? true : undefined}
                      onBlur={() => markTouched(`exp:${item.id}:company`)}
                      onChange={(e) => updateExperience(item.id, { company: e.target.value })}
                      placeholder="e.g. Smith Motors Ltd"
                    />
                    <FieldError message={visibleError(`exp:${item.id}:company`, rowErrors.company)} />
                  </div>
                </div>
                <div className={styles.cvRow}>
                  <div className={styles.cvField}>
                    <label className={styles.cvLabel}>Start</label>
                    <input
                      type="month"
                      className={styles.cvInput}
                      value={item.start}
                      max={monthMax}
                      aria-invalid={visibleError(`exp:${item.id}:start`, rowErrors.start) ? true : undefined}
                      onBlur={() => markTouched(`exp:${item.id}:start`)}
                      onChange={(e) => updateExperience(item.id, { start: e.target.value })}
                    />
                    <FieldError message={visibleError(`exp:${item.id}:start`, rowErrors.start)} />
                  </div>
                  <div className={styles.cvField}>
                    <label className={styles.cvLabel}>End</label>
                    <input
                      type="month"
                      className={styles.cvInput}
                      value={item.end}
                      min={item.start || undefined}
                      max={monthMax}
                      disabled={item.current}
                      aria-invalid={visibleError(`exp:${item.id}:end`, rowErrors.end) ? true : undefined}
                      onBlur={() => markTouched(`exp:${item.id}:end`)}
                      onChange={(e) => updateExperience(item.id, { end: e.target.value })}
                    />
                    <FieldError message={visibleError(`exp:${item.id}:end`, rowErrors.end)} />
                  </div>
                </div>
                <label className={styles.cvCheck}>
                  <input
                    type="checkbox"
                    checked={item.current}
                    onChange={(e) => updateExperience(item.id, { current: e.target.checked })}
                  />
                  <span>I currently work here</span>
                </label>
                <div className={styles.cvBulletField}>
                  <div className={styles.cvBulletHead}>
                    <label className={styles.cvLabel}>What you do</label>
                    <span className={styles.cvBulletMeta}>
                      {countCvBullets(item.description)}/{CV_LIMITS.bulletCount}{" "}
                      points
                    </span>
                  </div>
                  <p className={styles.cvBulletHint}>
                    Drafted from your portal modules where possible. Edit each point so it
                    sounds like your real day-to-day work — start with a strong verb.
                  </p>
                  <ul className={styles.cvBulletList}>
                    {((): string[] => {
                      const rows = splitCvBullets(item.description);
                      return rows.length > 0 ? rows : [""];
                    })().map((bullet, index, rows) => {
                      const refineKey = `refine:${item.id}:${index}` as const;
                      const refining = aiBusy === refineKey;
                      return (
                        <li key={`${item.id}-bullet-${index}`} className={styles.cvBulletRow}>
                          <span className={styles.cvBulletMarker} aria-hidden>
                            •
                          </span>
                          <input
                            className={styles.cvBulletInput}
                            value={bullet}
                            maxLength={CV_LIMITS.bulletLength}
                            aria-label={`Bullet point ${index + 1}`}
                            aria-invalid={
                              visibleError(
                                `exp:${item.id}:description`,
                                rowErrors.description,
                              )
                                ? true
                                : undefined
                            }
                            onBlur={() => markTouched(`exp:${item.id}:description`)}
                            onChange={(e) => {
                              const next = [...rows];
                              next[index] = e.target.value;
                              setExperienceBullets(item.id, next);
                            }}
                            placeholder={
                              index === 0
                                ? "e.g. Carried out oil and filter changes under supervision"
                                : index === 1
                                  ? "e.g. Used hand tools and workshop equipment safely"
                                  : "e.g. Kept the bay tidy and followed health & safety"
                            }
                          />
                          <div className={styles.cvBulletRowActions}>
                            <button
                              type="button"
                              className={styles.cvBulletRefine}
                              onClick={() => refineExperienceBullet(item.id, index)}
                              disabled={!aiReady || aiBusyAny || !bullet.trim()}
                              title={
                                aiReady
                                  ? "Refine this bullet with AI"
                                  : "Enable AI to refine bullets"
                              }
                            >
                              {refining ? "…" : "Refine"}
                            </button>
                            <button
                              type="button"
                              className={styles.cvBulletRemove}
                              onClick={() => removeExperienceBullet(item.id, index)}
                              disabled={rows.length <= 1 && !bullet.trim()}
                              aria-label={`Remove bullet point ${index + 1}`}
                            >
                              ×
                            </button>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                  <div className={styles.cvBulletActions}>
                    <button
                      type="button"
                      className={styles.ghostBtn}
                      onClick={() => addExperienceBullet(item.id)}
                      disabled={
                        countCvBullets(item.description) >= CV_LIMITS.bulletCount ||
                        splitCvBullets(item.description).length >= CV_LIMITS.bulletCount
                      }
                    >
                      + Add bullet point
                    </button>
                  </div>
                  <div className={styles.cvFieldFoot}>
                    <FieldError
                      message={visibleError(
                        `exp:${item.id}:description`,
                        rowErrors.description,
                      )}
                    />
                    <CharCount
                      value={item.description.replace(/\u200B/g, "")}
                      max={CV_LIMITS.description}
                    />
                  </div>
                </div>
              </div>
              );
            })}
            {cv.experience.length === 0 ? (
              <p className={styles.meta}>No experience added yet.</p>
            ) : null}
          </section>

          <section className={styles.cvGroup}>
            <div className={styles.cvGroupHead}>
              <h2 className={styles.cvGroupTitle}>Education & training</h2>
              <div className={styles.cvGroupActions}>
                <span className={styles.cvPortalBadge}>Programme from portal</span>
                <button
                  type="button"
                  className={styles.cvAiBtn}
                  onClick={improveEducation}
                  disabled={
                    !aiReady ||
                    aiBusyAny ||
                    !modulesAvailable ||
                    cv.education.length === 0
                  }
                  title={
                    modulesAvailable
                      ? "Rewrite education detail using your completed modules"
                      : "Module list not available yet"
                  }
                >
                  {aiBusy === "education" ? "Improving…" : "Improve with AI"}
                </button>
                <button type="button" className={styles.ghostBtn} onClick={addEducation}>
                  Add entry
                </button>
              </div>
            </div>
            <p className={styles.meta}>
              Your GTA programme is prefilled. In Detail, say what you have covered so far
              (modules, year/week) — or use Improve with AI. Add school or other qualifications
              yourself. Entries sort newest first by date.
            </p>
            {cv.education.map((item) => {
              const rowErrors = validation.errors.education[item.id] ?? {};
              return (
              <div key={item.id} className={styles.cvItem}>
                <div className={styles.cvItemHead}>
                  <span className={styles.cvItemLabel}>Qualification</span>
                  <button
                    type="button"
                    className={styles.cvItemRemove}
                    onClick={() => removeEducation(item.id)}
                  >
                    Remove
                  </button>
                </div>
                <div className={styles.cvRow}>
                  <div className={styles.cvField}>
                    <label className={styles.cvLabel}>
                      Qualification <span className={styles.cvRequired}>required</span>
                    </label>
                    <input
                      className={styles.cvInput}
                      value={item.qualification}
                      maxLength={CV_LIMITS.qualification}
                      aria-invalid={visibleError(`edu:${item.id}:qualification`, rowErrors.qualification) ? true : undefined}
                      onBlur={() => markTouched(`edu:${item.id}:qualification`)}
                      onChange={(e) => updateEducation(item.id, { qualification: e.target.value })}
                      placeholder="e.g. Autocare Technician Level 2"
                    />
                    <FieldError
                      message={visibleError(`edu:${item.id}:qualification`, rowErrors.qualification)}
                    />
                  </div>
                  <div className={styles.cvField}>
                    <label className={styles.cvLabel}>
                      Institution <span className={styles.cvRequired}>required</span>
                    </label>
                    <input
                      className={styles.cvInput}
                      value={item.institution}
                      maxLength={CV_LIMITS.institution}
                      aria-invalid={visibleError(`edu:${item.id}:institution`, rowErrors.institution) ? true : undefined}
                      onBlur={() => markTouched(`edu:${item.id}:institution`)}
                      onChange={(e) => updateEducation(item.id, { institution: e.target.value })}
                      placeholder="e.g. GTA Apprenticeships or your school / college"
                    />
                    <FieldError
                      message={visibleError(`edu:${item.id}:institution`, rowErrors.institution)}
                    />
                  </div>
                </div>
                <div className={styles.cvRow}>
                  <div className={styles.cvField}>
                    <label className={styles.cvLabel}>Start</label>
                    <input
                      type="month"
                      className={styles.cvInput}
                      value={item.start}
                      max={monthMax}
                      aria-invalid={visibleError(`edu:${item.id}:start`, rowErrors.start) ? true : undefined}
                      onBlur={() => markTouched(`edu:${item.id}:start`)}
                      onChange={(e) => updateEducation(item.id, { start: e.target.value })}
                    />
                    <FieldError message={visibleError(`edu:${item.id}:start`, rowErrors.start)} />
                  </div>
                  <div className={styles.cvField}>
                    <label className={styles.cvLabel}>End (or expected)</label>
                    <input
                      type="month"
                      className={styles.cvInput}
                      value={item.end}
                      min={item.start || undefined}
                      max={eduMonthMax}
                      aria-invalid={visibleError(`edu:${item.id}:end`, rowErrors.end) ? true : undefined}
                      onBlur={() => markTouched(`edu:${item.id}:end`)}
                      onChange={(e) => updateEducation(item.id, { end: e.target.value })}
                    />
                    <FieldError message={visibleError(`edu:${item.id}:end`, rowErrors.end)} />
                  </div>
                </div>
                <div className={styles.cvField}>
                  <label className={styles.cvLabel}>Detail (optional)</label>
                  <textarea
                    className={styles.cvTextarea}
                    value={item.detail}
                    rows={2}
                    maxLength={CV_LIMITS.detail}
                    aria-invalid={visibleError(`edu:${item.id}:detail`, rowErrors.detail) ? true : undefined}
                    onBlur={() => markTouched(`edu:${item.id}:detail`)}
                    onChange={(e) => updateEducation(item.id, { detail: e.target.value })}
                    placeholder="e.g. Year 2 — completed health & safety, routine maintenance, and customer communication."
                  />
                  <div className={styles.cvFieldFoot}>
                    <FieldError message={visibleError(`edu:${item.id}:detail`, rowErrors.detail)} />
                    <CharCount value={item.detail} max={CV_LIMITS.detail} />
                  </div>
                </div>
              </div>
              );
            })}
            {cv.education.length === 0 ? (
              <p className={styles.meta}>No education added yet.</p>
            ) : null}
          </section>

          <section className={styles.cvGroup}>
            <div className={styles.cvGroupHead}>
              <h2 className={styles.cvGroupTitle}>References</h2>
              <div className={styles.cvGroupActions}>
                <span className={styles.cvManualBadge}>Optional</span>
                <button
                  type="button"
                  className={styles.ghostBtn}
                  onClick={addReferencePerson}
                  disabled={cv.referencePeople.length >= CV_LIMITS.referenceCount}
                >
                  Add reference
                </button>
              </div>
            </div>
            <p className={styles.meta}>
              Keep the preset, or name people who have agreed to be contacted.
            </p>

            {cv.referencesOnRequest ? (
              <div className={styles.cvPresetRow}>
                <p className={styles.cvPresetText}>{REFERENCES_ON_REQUEST_TEXT}</p>
                <button
                  type="button"
                  className={styles.cvItemRemove}
                  onClick={removeReferencesOnRequest}
                >
                  Remove
                </button>
              </div>
            ) : (
              <button
                type="button"
                className={styles.ghostBtn}
                onClick={restoreReferencesOnRequest}
              >
                Use “{REFERENCES_ON_REQUEST_TEXT}”
              </button>
            )}

            {cv.referencePeople.map((person, index) => {
              const rowErrors = validation.errors.referencePeople[person.id] ?? {};
              return (
                <div key={person.id} className={styles.cvItem}>
                  <div className={styles.cvItemHead}>
                    <span className={styles.cvItemLabel}>
                      Reference {index + 1}
                    </span>
                    <button
                      type="button"
                      className={styles.cvItemRemove}
                      onClick={() => removeReferencePerson(person.id)}
                    >
                      Remove
                    </button>
                  </div>
                  <div className={styles.cvField}>
                    <label className={styles.cvLabel}>
                      Full name <span className={styles.cvRequired}>required</span>
                    </label>
                    <input
                      className={styles.cvInput}
                      value={person.name}
                      maxLength={CV_LIMITS.referenceName}
                      aria-invalid={
                        visibleError(`ref:${person.id}:name`, rowErrors.name)
                          ? true
                          : undefined
                      }
                      onBlur={() => markTouched(`ref:${person.id}:name`)}
                      onChange={(e) =>
                        updateReferencePerson(person.id, { name: e.target.value })
                      }
                      placeholder="e.g. Sam Patel"
                    />
                    <FieldError
                      message={visibleError(`ref:${person.id}:name`, rowErrors.name)}
                    />
                  </div>
                  <div className={styles.cvRow}>
                    <div className={styles.cvField}>
                      <label className={styles.cvLabel}>Job title</label>
                      <input
                        className={styles.cvInput}
                        value={person.role}
                        maxLength={CV_LIMITS.referenceRole}
                        onChange={(e) =>
                          updateReferencePerson(person.id, { role: e.target.value })
                        }
                        placeholder="e.g. Workshop Supervisor"
                      />
                      <FieldError
                        message={visibleError(`ref:${person.id}:role`, rowErrors.role)}
                      />
                    </div>
                    <div className={styles.cvField}>
                      <label className={styles.cvLabel}>Organisation</label>
                      <input
                        className={styles.cvInput}
                        value={person.organisation}
                        maxLength={CV_LIMITS.referenceOrganisation}
                        onChange={(e) =>
                          updateReferencePerson(person.id, {
                            organisation: e.target.value,
                          })
                        }
                        placeholder="e.g. Smith Motors Ltd"
                      />
                      <FieldError
                        message={visibleError(
                          `ref:${person.id}:organisation`,
                          rowErrors.organisation,
                        )}
                      />
                    </div>
                  </div>
                  <div className={styles.cvRow}>
                    <div className={styles.cvField}>
                      <label className={styles.cvLabel}>Email</label>
                      <input
                        type="email"
                        inputMode="email"
                        className={styles.cvInput}
                        value={person.email}
                        maxLength={CV_LIMITS.referenceEmail}
                        aria-invalid={
                          visibleError(`ref:${person.id}:email`, rowErrors.email)
                            ? true
                            : undefined
                        }
                        onBlur={() => markTouched(`ref:${person.id}:email`)}
                        onChange={(e) =>
                          updateReferencePerson(person.id, { email: e.target.value })
                        }
                        placeholder="e.g. sam.patel@company.com"
                      />
                      <FieldError
                        message={visibleError(
                          `ref:${person.id}:email`,
                          rowErrors.email,
                        )}
                      />
                    </div>
                    <div className={styles.cvField}>
                      <label className={styles.cvLabel}>Phone</label>
                      <input
                        type="tel"
                        inputMode="tel"
                        className={styles.cvInput}
                        value={person.phone}
                        maxLength={CV_LIMITS.referencePhone}
                        aria-invalid={
                          visibleError(`ref:${person.id}:phone`, rowErrors.phone)
                            ? true
                            : undefined
                        }
                        onBlur={() => markTouched(`ref:${person.id}:phone`)}
                        onChange={(e) =>
                          updateReferencePerson(person.id, { phone: e.target.value })
                        }
                        placeholder="e.g. 0114 123 4567"
                      />
                      <FieldError
                        message={visibleError(
                          `ref:${person.id}:phone`,
                          rowErrors.phone,
                        )}
                      />
                    </div>
                  </div>
                </div>
              );
            })}

            <FieldError message={validation.errors.references} />
          </section>

          <section className={styles.cvGroup}>
            <div className={styles.cvGroupHead}>
              <h2 className={styles.cvGroupTitle}>Tailor to a job</h2>
              <button
                type="button"
                className={styles.cvAiBtn}
                onClick={tailorToJob}
                disabled={
                  !aiReady ||
                  aiBusyAny ||
                  jobDescription.trim().length < JOB_DESCRIPTION_MIN
                }
              >
                {aiBusy === "tailor" ? "Tailoring…" : "Tailor with AI"}
              </button>
            </div>
            <p className={styles.meta}>
              Paste a real job advert (duties and requirements). AI will tweak your summary,
              skills, and bullets to match the wording — it will not invent experience you
              did not add.
            </p>
            <div className={styles.cvField}>
              <label className={styles.cvLabel} htmlFor="cv-job">
                Job description
              </label>
              <textarea
                id="cv-job"
                className={styles.cvTextarea}
                value={jobDescription}
                rows={6}
                maxLength={CV_LIMITS.jobDescription}
                onChange={(e) => setJobDescription(e.target.value)}
                placeholder="Paste the full job advert here — role title, main duties, and essential skills work best."
              />
              <div className={styles.cvFieldFoot}>
                {jobDescriptionTooShort ? (
                  <p className={styles.cvFieldHint}>
                    Paste a bit more — at least {JOB_DESCRIPTION_MIN} characters so AI has
                    something to work with.
                  </p>
                ) : null}
                <CharCount value={jobDescription} max={CV_LIMITS.jobDescription} />
              </div>
            </div>
          </section>
        </div>

        <div className={styles.cvPreviewWrap}>
          <p
            className={styles.cvPageMeter}
            data-tone={pageEstimate > 2 ? "over" : pageEstimate === 2 ? "limit" : "ok"}
            data-print-hide
          >
            {pageEstimate <= 1
              ? "Estimated length: 1 page — ideal"
              : pageEstimate === 2
                ? "Estimated length: 2 pages — the maximum"
                : "Over 2 pages — trim your content. The PDF cuts off after page 2."}
          </p>
          <div
            className={styles.cvSheet}
            data-cv-sheet
            ref={sheetRef}
            style={
              pageHeightPx > 0
                ? {
                    minHeight: pageHeightPx,
                    maxHeight: pageHeightPx * 2,
                    overflow: "hidden",
                  }
                : undefined
            }
          >
            {pageHeightPx > 0 && pageEstimate > 1
              ? Array.from({ length: Math.min(pageEstimate, 2) - 1 }, (_, index) => (
                  <div
                    key={index}
                    className={styles.cvPageBreak}
                    style={{ top: pageHeightPx * (index + 1) }}
                    data-print-hide
                    aria-hidden
                  >
                    <span>Page {index + 2}</span>
                  </div>
                ))
              : null}
            {pageHeightPx > 0 && pageEstimate > 2 ? (
              <div
                className={styles.cvPageBreak}
                style={{ top: pageHeightPx * 2 }}
                data-print-hide
                aria-hidden
              >
                <span data-cut="true">Cut off in PDF</span>
              </div>
            ) : null}
            <header className={styles.cvSheetHead}>
              <div className={styles.cvBrandRow}>
                <span className={styles.cvBrandMark} aria-hidden>
                  GTA
                </span>
                <span className={styles.cvBrandText}>GTA Apprenticeship</span>
              </div>
              <h1 className={styles.cvName}>{cv.fullName || "Your name"}</h1>
              {cv.headline ? <p className={styles.cvHeadline}>{cv.headline}</p> : null}
              <ul className={styles.cvContact}>
                {cv.email ? <li>{cv.email}</li> : null}
                {cv.phone ? <li>{cv.phone}</li> : null}
                {formatCvAddress(cv.houseNumber, cv.postcode, cv.addressLine) ? (
                  <li>{formatCvAddress(cv.houseNumber, cv.postcode, cv.addressLine)}</li>
                ) : null}
              </ul>
            </header>

            <div className={styles.cvSheetBody}>
              {cv.summary ? (
                <section className={styles.cvSheetSection}>
                  <h2 className={styles.cvSheetSectionTitle}>Profile</h2>
                  <p className={styles.cvSheetSummary}>{cv.summary}</p>
                </section>
              ) : null}

              {cv.skills.length > 0 ? (
                <section className={styles.cvSheetSection}>
                  <h2 className={styles.cvSheetSectionTitle}>Skills</h2>
                  <ul className={styles.cvSheetSkills}>
                    {cv.skills.map((skill) => (
                      <li key={skill}>{skill}</li>
                    ))}
                  </ul>
                </section>
              ) : null}

              {cv.experience.some((e) => e.role || e.company || e.description) ? (
                <section className={styles.cvSheetSection}>
                  <h2 className={styles.cvSheetSectionTitle}>Experience</h2>
                  {sortExperience(
                    cv.experience.filter((e) => e.role || e.company || e.description),
                  ).map((item) => (
                      <article key={item.id} className={styles.cvEntry}>
                        <div className={styles.cvEntryHead}>
                          <span className={styles.cvEntryRole}>
                            {item.role || "Role"}
                            {item.company ? ` · ${item.company}` : ""}
                          </span>
                          <span className={styles.cvEntryMeta}>
                            {formatRange(item.start, item.end, item.current)}
                          </span>
                        </div>
                        {item.location ? (
                          <p className={styles.cvEntrySub}>{item.location}</p>
                        ) : null}
                        {splitCvBullets(item.description).some(Boolean) ? (
                          <ul className={styles.cvBullets}>
                            {splitCvBullets(item.description)
                              .filter(Boolean)
                              .map((line, index) => (
                                <li key={index}>{line}</li>
                              ))}
                          </ul>
                        ) : null}
                      </article>
                    ))}
                </section>
              ) : null}

              {cv.education.some((e) => e.qualification || e.institution) ? (
                <section className={styles.cvSheetSection}>
                  <h2 className={styles.cvSheetSectionTitle}>Education &amp; training</h2>
                  {sortEducation(
                    cv.education.filter((e) => e.qualification || e.institution),
                  ).map((item) => (
                      <article key={item.id} className={styles.cvEntry}>
                        <div className={styles.cvEntryHead}>
                          <span className={styles.cvEntryRole}>
                            {item.qualification || "Qualification"}
                          </span>
                          <span className={styles.cvEntryMeta}>
                            {formatRange(item.start, item.end, false)}
                          </span>
                        </div>
                        {item.institution ? (
                          <p className={styles.cvEntrySub}>{item.institution}</p>
                        ) : null}
                        {item.detail ? (
                          <p className={styles.cvEntryDesc}>{item.detail}</p>
                        ) : null}
                      </article>
                    ))}
                </section>
              ) : null}

              {cv.referencesOnRequest ||
              cv.referencePeople.some(
                (person) =>
                  person.name.trim() ||
                  person.role.trim() ||
                  person.organisation.trim() ||
                  person.email.trim() ||
                  person.phone.trim(),
              ) ? (
                <section className={styles.cvSheetSection}>
                  <h2 className={styles.cvSheetSectionTitle}>References</h2>
                  {cv.referencesOnRequest ? (
                    <p className={styles.cvSheetSummary}>{REFERENCES_ON_REQUEST_TEXT}</p>
                  ) : null}
                  {cv.referencePeople
                    .filter(
                      (person) =>
                        person.name.trim() ||
                        person.role.trim() ||
                        person.organisation.trim() ||
                        person.email.trim() ||
                        person.phone.trim(),
                    )
                    .map((person) => (
                      <article key={person.id} className={styles.cvEntry}>
                        <pre className={styles.cvReferenceBlock}>
                          {formatReferencePerson(person)}
                        </pre>
                      </article>
                    ))}
                </section>
              ) : null}
            </div>

            <footer className={styles.cvSheetFoot}>
              <span className={styles.cvSheetFootBrand}>GTA Apprenticeship</span>
              <span>{ALEX_PROFILE.programmeName}</span>
            </footer>
          </div>
        </div>
      </div>
    </LearnerPageShell>
    <AiConsentModal
      open={consentOpen}
      onAgree={agreeToAi}
      onDecline={declineAi}
    />
    </>
  );
}

function buildPlainText(cv: CvState): string {
  const lines: string[] = [];
  lines.push(cv.fullName || "Your name");
  if (cv.headline) lines.push(cv.headline);
  const contact = [
    cv.email,
    cv.phone,
    formatCvAddress(cv.houseNumber, cv.postcode, cv.addressLine),
  ].filter(Boolean);
  if (contact.length) lines.push(contact.join(" | "));

  if (cv.summary) {
    lines.push("", "PROFILE", cv.summary);
  }
  if (cv.skills.length) {
    lines.push("", "SKILLS", cv.skills.join(", "));
  }
  const experience = sortExperience(
    cv.experience.filter((e) => e.role || e.company || e.description),
  );
  if (experience.length) {
    lines.push("", "EXPERIENCE");
    for (const item of experience) {
      const header = [item.role, item.company].filter(Boolean).join(" · ");
      const range = formatRange(item.start, item.end, item.current);
      lines.push(range ? `${header} (${range})` : header);
      for (const bullet of splitCvBullets(item.description).filter(Boolean)) {
        lines.push(`  - ${bullet}`);
      }
    }
  }
  const education = sortEducation(
    cv.education.filter((e) => e.qualification || e.institution),
  );
  if (education.length) {
    lines.push("", "EDUCATION & TRAINING");
    for (const item of education) {
      const range = formatRange(item.start, item.end, false);
      const header = [item.qualification, item.institution].filter(Boolean).join(" · ");
      lines.push(range ? `${header} (${range})` : header);
      if (item.detail) lines.push(`  ${item.detail}`);
    }
  }
  const referencesText = formatReferencesForExport(
    cv.referencesOnRequest,
    cv.referencePeople,
  );
  if (referencesText) {
    lines.push("", "REFERENCES", referencesText);
  }
  return lines.join("\n");
}
