import { createSeedSnapshot } from "./seed";
import { isDemoModeEnabled } from "@/lib/env/portal";
import type {
  AdminCohortRecord,
  AdminEmployerRecord,
  AdminLearnerEnrolment,
  AdminLearnerRecord,
  AdminPackItemStatus,
  AdminPortalUser,
  AdminProgrammeRecord,
  AdminStoreSnapshot,
  EnrolmentKind,
  EnrolmentStatus,
} from "./types";

const STORAGE_KEY = "gta-portal.administration.v1";

function isLiveAdminStoreEnabled(): boolean {
  return typeof window !== "undefined" && !isDemoModeEnabled();
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function loadSnapshot(): AdminStoreSnapshot {
  if (typeof window === "undefined") return createSeedSnapshot();
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return createSeedSnapshot();
    const parsed = JSON.parse(raw) as AdminStoreSnapshot;
    if (parsed?.version !== 15) return createSeedSnapshot();
    return parsed;
  } catch {
    return createSeedSnapshot();
  }
}

function persist(snapshot: AdminStoreSnapshot): void {
  if (typeof window === "undefined" || isLiveAdminStoreEnabled()) return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot));
}

/** Stable seed used for SSR + the first client paint (avoids hydration mismatch). */
const SERVER_SNAPSHOT: AdminStoreSnapshot = createSeedSnapshot();
let snapshot: AdminStoreSnapshot = clone(SERVER_SNAPSHOT);
let hydrated = false;
let hydrateScheduled = false;
const listeners = new Set<() => void>();

function ensureHydrated(): void {
  if (hydrated || typeof window === "undefined") return;
  if (isLiveAdminStoreEnabled()) return;
  snapshot = loadSnapshot();
  hydrated = true;
}

/**
 * Load localStorage after the first paint so SSR HTML matches the initial
 * client render. Mutations still call ensureHydrated() synchronously.
 */
async function fetchLiveAdminSlice(): Promise<void> {
  if (typeof window === "undefined") return;
  const response = await fetch("/api/admin/store", {
    credentials: "include",
    cache: "no-store",
  });
  if (!response.ok) return;
  const data = (await response.json()) as {
    learners: AdminLearnerRecord[];
    enrolments: AdminLearnerEnrolment[];
  };
  snapshot = {
    ...snapshot,
    learners: data.learners,
    enrolments: data.enrolments,
  };
}

function scheduleHydrateFromStorage(): void {
  if (hydrated || hydrateScheduled || typeof window === "undefined") return;
  hydrateScheduled = true;
  queueMicrotask(() => {
    if (hydrated) return;
    if (isLiveAdminStoreEnabled()) {
      hydrated = true;
      void fetchLiveAdminSlice().then(() => {
        for (const listener of listeners) listener();
      });
      return;
    }
    const next = loadSnapshot();
    hydrated = true;
    snapshot = next;
    for (const listener of listeners) listener();
  });
}

function emit(): void {
  persist(snapshot);
  for (const listener of listeners) listener();
}

function id(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

export function subscribeAdminStore(listener: () => void): () => void {
  listeners.add(listener);
  scheduleHydrateFromStorage();
  return () => listeners.delete(listener);
}

export function getAdminSnapshot(): AdminStoreSnapshot {
  return snapshot;
}

/** Server / hydration snapshot — never reads localStorage. */
export function getAdminServerSnapshot(): AdminStoreSnapshot {
  return SERVER_SNAPSHOT;
}

export function resetAdminStore(): void {
  snapshot = createSeedSnapshot();
  hydrated = true;
  emit();
}

export type LearnerInput = {
  displayName: string;
  learnerReference: string;
  email: string;
  phone: string;
  dateOfBirth: string;
  uln: string;
  addressLine1: string;
  addressLine2: string;
  town: string;
  postcode: string;
  emergencyContactName: string;
  emergencyContactPhone: string;
  emergencyContactRelationship: string;
  supportNotes: string;
  intakeStatus: AdminLearnerRecord["intakeStatus"];
  notes: string;
};

/** e.g. GTA-2026-04831 */
function generateLearnerReference(): string {
  const year = new Date().getFullYear();
  const serial = String(Math.floor(Math.random() * 90000) + 10000);
  return `GTA-${year}-0${serial.slice(0, 4)}`;
}

export function listLearners(): AdminLearnerRecord[] {
  ensureHydrated();
  return [...snapshot.learners].sort((a, b) =>
    a.displayName.localeCompare(b.displayName),
  );
}

export function getLearner(idValue: string): AdminLearnerRecord | undefined {
  ensureHydrated();
  return snapshot.learners.find((l) => l.id === idValue);
}

export async function createLearner(input: LearnerInput): Promise<AdminLearnerRecord> {
  ensureHydrated();
  if (isLiveAdminStoreEnabled()) {
    const response = await fetch("/api/admin/store", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ action: "createLearner", input }),
    });
    if (!response.ok) {
      throw new Error("Unable to create learner");
    }
    const data = (await response.json()) as { learner: AdminLearnerRecord };
    snapshot = {
      ...snapshot,
      learners: [data.learner, ...snapshot.learners.filter((row) => row.id !== data.learner.id)],
    };
    emit();
    return data.learner;
  }
  const stamp = new Date().toISOString();
  const row: AdminLearnerRecord = {
    id: id("lrn"),
    displayName: input.displayName.trim(),
    learnerReference:
      input.learnerReference.trim() || generateLearnerReference(),
    email: input.email.trim(),
    phone: input.phone.trim(),
    dateOfBirth: input.dateOfBirth,
    uln: input.uln.trim(),
    addressLine1: input.addressLine1.trim(),
    addressLine2: input.addressLine2.trim(),
    town: input.town.trim(),
    postcode: input.postcode.trim().toUpperCase(),
    emergencyContactName: input.emergencyContactName.trim(),
    emergencyContactPhone: input.emergencyContactPhone.trim(),
    emergencyContactRelationship: input.emergencyContactRelationship.trim(),
    supportNotes: input.supportNotes.trim(),
    intakeStatus: input.intakeStatus,
    pack: {},
    notes: input.notes.trim(),
    createdAt: stamp,
    updatedAt: stamp,
  };
  snapshot = {
    ...snapshot,
    learners: [row, ...snapshot.learners],
  };
  emit();
  return row;
}

export async function updateLearner(
  idValue: string,
  patch: Partial<LearnerInput>,
): Promise<AdminLearnerRecord | null> {
  ensureHydrated();
  if (isLiveAdminStoreEnabled()) {
    const response = await fetch("/api/admin/store", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ action: "updateLearner", id: idValue, patch }),
    });
    if (!response.ok) return null;
    const data = (await response.json()) as { learner: AdminLearnerRecord };
    snapshot = {
      ...snapshot,
      learners: snapshot.learners.map((row) => (row.id === idValue ? data.learner : row)),
      enrolments: snapshot.enrolments.map((e) =>
        e.learnerId === idValue
          ? {
              ...e,
              displayName: data.learner.displayName,
              email: data.learner.email,
              phone: data.learner.phone,
              dateOfBirth: data.learner.dateOfBirth,
              uln: data.learner.uln,
            }
          : e,
      ),
    };
    emit();
    return data.learner;
  }
  const existing = snapshot.learners.find((l) => l.id === idValue);
  if (!existing) return null;
  const next: AdminLearnerRecord = {
    ...existing,
    ...patch,
    displayName: (patch.displayName ?? existing.displayName).trim(),
    learnerReference: (
      patch.learnerReference ?? existing.learnerReference
    ).trim(),
    email: (patch.email ?? existing.email).trim(),
    phone: (patch.phone ?? existing.phone).trim(),
    uln: (patch.uln ?? existing.uln).trim(),
    addressLine1: (patch.addressLine1 ?? existing.addressLine1).trim(),
    addressLine2: (patch.addressLine2 ?? existing.addressLine2).trim(),
    town: (patch.town ?? existing.town).trim(),
    postcode: (patch.postcode ?? existing.postcode).trim().toUpperCase(),
    emergencyContactName: (
      patch.emergencyContactName ?? existing.emergencyContactName
    ).trim(),
    emergencyContactPhone: (
      patch.emergencyContactPhone ?? existing.emergencyContactPhone
    ).trim(),
    emergencyContactRelationship: (
      patch.emergencyContactRelationship ??
      existing.emergencyContactRelationship
    ).trim(),
    supportNotes: (patch.supportNotes ?? existing.supportNotes).trim(),
    notes: (patch.notes ?? existing.notes).trim(),
    updatedAt: new Date().toISOString(),
  };
  snapshot = {
    ...snapshot,
    learners: snapshot.learners.map((l) => (l.id === idValue ? next : l)),
    // Keep enrolment snapshots of personal details in step with the record.
    enrolments: snapshot.enrolments.map((e) =>
      e.learnerId === idValue
        ? {
            ...e,
            displayName: next.displayName,
            email: next.email,
            phone: next.phone,
            dateOfBirth: next.dateOfBirth,
            uln: next.uln,
          }
        : e,
    ),
  };
  emit();
  return next;
}

export function setLearnerPackItem(
  learnerId: string,
  reference: string,
  status: AdminPackItemStatus,
): void {
  ensureHydrated();
  const existing = snapshot.learners.find((l) => l.id === learnerId);
  if (!existing) return;
  const next: AdminLearnerRecord = {
    ...existing,
    pack: { ...existing.pack, [reference]: status },
    updatedAt: new Date().toISOString(),
  };
  snapshot = {
    ...snapshot,
    learners: snapshot.learners.map((l) => (l.id === learnerId ? next : l)),
  };
  emit();
}

export type EnrolmentInput = {
  kind: EnrolmentKind;
  status?: EnrolmentStatus;
  learnerId: string | null;
  displayName: string;
  email: string;
  phone: string;
  dateOfBirth: string;
  uln: string;
  programmeName: string;
  standardCode: string;
  cohortId: string | null;
  employerId: string;
  employerName: string;
  workplaceContact: string;
  mentorName: string;
  tutorName: string;
  startDate: string;
  originalPlannedEndDate: string;
  programmeYear: 1 | 2 | 3 | null;
  programmeWeek: number | null;
  attendancePercent: number | null;
  actualProgressPercent: number | null;
  collegeDays: string;
  notes: string;
};

export function listEnrolments(): AdminLearnerEnrolment[] {
  ensureHydrated();
  return [...snapshot.enrolments].sort((a, b) =>
    b.updatedAt.localeCompare(a.updatedAt),
  );
}

export function getEnrolment(idValue: string): AdminLearnerEnrolment | undefined {
  ensureHydrated();
  return snapshot.enrolments.find((e) => e.id === idValue);
}

export async function createEnrolment(input: EnrolmentInput): Promise<AdminLearnerEnrolment> {
  ensureHydrated();
  if (isLiveAdminStoreEnabled()) {
    const response = await fetch("/api/admin/store", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ action: "createEnrolment", input }),
    });
    if (!response.ok) {
      throw new Error("Unable to create enrolment");
    }
    const data = (await response.json()) as { enrolment: AdminLearnerEnrolment };
    snapshot = {
      ...snapshot,
      enrolments: [
        data.enrolment,
        ...snapshot.enrolments.filter((row) => row.id !== data.enrolment.id),
      ],
    };
    emit();
    return data.enrolment;
  }
  const stamp = new Date().toISOString();
  const row: AdminLearnerEnrolment = {
    id: id("enr"),
    kind: input.kind,
    status:
      input.status ??
      (input.kind === "new_starter" ? "pending_start" : "active"),
    learnerId: input.learnerId,
    displayName: input.displayName.trim(),
    email: input.email.trim(),
    phone: input.phone.trim(),
    dateOfBirth: input.dateOfBirth,
    uln: input.uln.trim(),
    programmeName: input.programmeName,
    standardCode: input.standardCode,
    cohortId: input.cohortId,
    employerId: input.employerId,
    employerName: input.employerName,
    workplaceContact: input.workplaceContact.trim(),
    mentorName: input.mentorName.trim(),
    tutorName: input.tutorName.trim(),
    startDate: input.startDate,
    originalPlannedEndDate: input.originalPlannedEndDate,
    programmeYear: input.programmeYear,
    programmeWeek: input.programmeWeek,
    attendancePercent: input.attendancePercent,
    actualProgressPercent: input.actualProgressPercent,
    collegeDays: input.collegeDays.trim(),
    notes: input.notes.trim(),
    createdAt: stamp,
    updatedAt: stamp,
  };

  /** Enrolment queues Account Setup — staff enable the learner environment. */
  const emailKey = row.email.toLowerCase();
  const alreadyHasPortal = snapshot.users.some(
    (u) =>
      u.linkedLearnerId === row.learnerId ||
      u.linkedEnrolmentId === row.id ||
      (u.email.trim().toLowerCase() === emailKey && emailKey.length > 0),
  );
  const provisionedUser: AdminPortalUser | null = alreadyHasPortal
    ? null
    : {
        id: id("user"),
        displayName: row.displayName,
        email: row.email,
        role: "Learner",
        workspace: "learner",
        linkedEnrolmentId: row.id,
        linkedLearnerId: row.learnerId,
        linkedEmployerId: row.employerId,
        programmeStartDate: row.startDate || null,
        status: "invited",
        enabledBy: null,
        enabledAt: null,
        disabledBy: null,
        disabledAt: null,
        createdAt: stamp,
        updatedAt: stamp,
      };

  snapshot = {
    ...snapshot,
    enrolments: [row, ...snapshot.enrolments],
    users: provisionedUser
      ? [provisionedUser, ...snapshot.users]
      : snapshot.users,
  };
  emit();
  return row;
}

export async function updateEnrolment(
  idValue: string,
  patch: Partial<EnrolmentInput> & { status?: EnrolmentStatus },
): Promise<AdminLearnerEnrolment | null> {
  ensureHydrated();
  if (isLiveAdminStoreEnabled()) {
    const response = await fetch("/api/admin/store", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ action: "updateEnrolment", id: idValue, patch }),
    });
    if (!response.ok) return null;
    const data = (await response.json()) as { enrolment: AdminLearnerEnrolment };
    snapshot = {
      ...snapshot,
      enrolments: snapshot.enrolments.map((row) =>
        row.id === idValue ? data.enrolment : row,
      ),
    };
    emit();
    return data.enrolment;
  }
  const existing = snapshot.enrolments.find((e) => e.id === idValue);
  if (!existing) return null;
  const next: AdminLearnerEnrolment = {
    ...existing,
    ...patch,
    displayName: (patch.displayName ?? existing.displayName).trim(),
    email: (patch.email ?? existing.email).trim(),
    phone: (patch.phone ?? existing.phone).trim(),
    uln: (patch.uln ?? existing.uln).trim(),
    workplaceContact: (patch.workplaceContact ?? existing.workplaceContact).trim(),
    mentorName: (patch.mentorName ?? existing.mentorName).trim(),
    tutorName: (patch.tutorName ?? existing.tutorName).trim(),
    originalPlannedEndDate:
      patch.originalPlannedEndDate ?? existing.originalPlannedEndDate,
    collegeDays: (patch.collegeDays ?? existing.collegeDays).trim(),
    notes: (patch.notes ?? existing.notes).trim(),
    updatedAt: new Date().toISOString(),
  };
  snapshot = {
    ...snapshot,
    enrolments: snapshot.enrolments.map((e) => (e.id === idValue ? next : e)),
  };
  emit();
  return next;
}

export type EmployerInput = {
  name: string;
  legalName: string;
  companyNumber: string;
  mainContact: string;
  contactRole: string;
  contactEmail: string;
  contactPhone: string;
  addressLine1: string;
  addressLine2: string;
  town: string;
  postcode: string;
  website: string;
  status: "active" | "inactive";
  notes: string;
};

export function listEmployers(): AdminEmployerRecord[] {
  ensureHydrated();
  return [...snapshot.employers].sort((a, b) => a.name.localeCompare(b.name));
}

export function createEmployer(input: EmployerInput): AdminEmployerRecord {
  ensureHydrated();
  const stamp = new Date().toISOString();
  const row: AdminEmployerRecord = {
    id: id("emp"),
    name: input.name.trim(),
    legalName: input.legalName.trim(),
    companyNumber: input.companyNumber.trim(),
    mainContact: input.mainContact.trim(),
    contactRole: input.contactRole.trim(),
    contactEmail: input.contactEmail.trim(),
    contactPhone: input.contactPhone.trim(),
    addressLine1: input.addressLine1.trim(),
    addressLine2: input.addressLine2.trim(),
    town: input.town.trim(),
    postcode: input.postcode.trim().toUpperCase(),
    website: input.website.trim(),
    status: input.status,
    notes: input.notes.trim(),
    createdAt: stamp,
    updatedAt: stamp,
  };
  snapshot = {
    ...snapshot,
    employers: [row, ...snapshot.employers],
  };
  emit();
  return row;
}

export function updateEmployer(
  idValue: string,
  patch: Partial<EmployerInput>,
): AdminEmployerRecord | null {
  ensureHydrated();
  const existing = snapshot.employers.find((e) => e.id === idValue);
  if (!existing) return null;
  const next: AdminEmployerRecord = {
    ...existing,
    ...patch,
    name: (patch.name ?? existing.name).trim(),
    legalName: (patch.legalName ?? existing.legalName).trim(),
    companyNumber: (patch.companyNumber ?? existing.companyNumber).trim(),
    mainContact: (patch.mainContact ?? existing.mainContact).trim(),
    contactRole: (patch.contactRole ?? existing.contactRole).trim(),
    contactEmail: (patch.contactEmail ?? existing.contactEmail).trim(),
    contactPhone: (patch.contactPhone ?? existing.contactPhone).trim(),
    addressLine1: (patch.addressLine1 ?? existing.addressLine1).trim(),
    addressLine2: (patch.addressLine2 ?? existing.addressLine2).trim(),
    town: (patch.town ?? existing.town).trim(),
    postcode: (patch.postcode ?? existing.postcode).trim().toUpperCase(),
    website: (patch.website ?? existing.website).trim(),
    notes: (patch.notes ?? existing.notes).trim(),
    updatedAt: new Date().toISOString(),
  };
  snapshot = {
    ...snapshot,
    employers: snapshot.employers.map((e) => (e.id === idValue ? next : e)),
  };
  emit();
  return next;
}

export type ProgrammeInput = {
  name: string;
  standardCode: string;
  level: AdminProgrammeRecord["level"];
  route: string;
  durationMonths: number;
  awardingBody: string;
  status: AdminProgrammeRecord["status"];
  summary: string;
  skillsEnglandUrl: string;
  notes: string;
};

export function listProgrammes(): AdminProgrammeRecord[] {
  ensureHydrated();
  return [...snapshot.programmes].sort((a, b) =>
    a.name.localeCompare(b.name),
  );
}

export function createProgramme(input: ProgrammeInput): AdminProgrammeRecord {
  ensureHydrated();
  const stamp = new Date().toISOString();
  const row: AdminProgrammeRecord = {
    id: id("prog"),
    name: input.name.trim(),
    standardCode: input.standardCode.trim().toUpperCase(),
    level: input.level,
    route: input.route.trim(),
    durationMonths: Number.isFinite(input.durationMonths)
      ? Math.max(1, Math.round(input.durationMonths))
      : 12,
    awardingBody: input.awardingBody.trim(),
    status: input.status,
    summary: input.summary.trim(),
    skillsEnglandUrl: input.skillsEnglandUrl.trim(),
    notes: input.notes.trim(),
    createdAt: stamp,
    updatedAt: stamp,
  };
  snapshot = {
    ...snapshot,
    programmes: [row, ...snapshot.programmes],
  };
  emit();
  return row;
}

export function updateProgramme(
  idValue: string,
  patch: Partial<ProgrammeInput>,
): AdminProgrammeRecord | null {
  ensureHydrated();
  const existing = snapshot.programmes.find((p) => p.id === idValue);
  if (!existing) return null;
  const next: AdminProgrammeRecord = {
    ...existing,
    ...patch,
    name: (patch.name ?? existing.name).trim(),
    standardCode: (patch.standardCode ?? existing.standardCode)
      .trim()
      .toUpperCase(),
    route: (patch.route ?? existing.route).trim(),
    durationMonths: Number.isFinite(patch.durationMonths ?? existing.durationMonths)
      ? Math.max(1, Math.round(patch.durationMonths ?? existing.durationMonths))
      : existing.durationMonths,
    awardingBody: (patch.awardingBody ?? existing.awardingBody).trim(),
    summary: (patch.summary ?? existing.summary).trim(),
    skillsEnglandUrl: (patch.skillsEnglandUrl ?? existing.skillsEnglandUrl).trim(),
    notes: (patch.notes ?? existing.notes).trim(),
    updatedAt: new Date().toISOString(),
  };
  snapshot = {
    ...snapshot,
    programmes: snapshot.programmes.map((p) => (p.id === idValue ? next : p)),
  };
  emit();
  return next;
}

export type CohortInput = {
  name: string;
  programmeId: string;
  programmeName: string;
  standardCode: string;
  standardVersion: string;
  enrolmentOpensDate: string;
  startDate: string;
  expectedEndDate: string;
  teachingGroup: string;
  collegeDays: string;
  tutorName: string;
  status: AdminCohortRecord["status"];
  notes: string;
};

export function listCohorts(): AdminCohortRecord[] {
  ensureHydrated();
  return [...snapshot.cohorts].sort((a, b) =>
    b.startDate.localeCompare(a.startDate),
  );
}

export function createCohort(input: CohortInput): AdminCohortRecord {
  ensureHydrated();
  const stamp = new Date().toISOString();
  const row: AdminCohortRecord = {
    id: id("cohort"),
    name: input.name.trim(),
    programmeId: input.programmeId,
    programmeName: input.programmeName.trim(),
    standardCode: input.standardCode.trim().toUpperCase(),
    standardVersion: input.standardVersion.trim().replace(/^v/i, ""),
    enrolmentOpensDate: input.enrolmentOpensDate,
    startDate: input.startDate,
    expectedEndDate: input.expectedEndDate,
    teachingGroup: input.teachingGroup.trim(),
    collegeDays: input.collegeDays.trim(),
    tutorName: input.tutorName.trim(),
    status: input.status,
    notes: input.notes.trim(),
    createdAt: stamp,
    updatedAt: stamp,
  };
  snapshot = {
    ...snapshot,
    cohorts: [row, ...snapshot.cohorts],
  };
  emit();
  return row;
}

export function updateCohort(
  idValue: string,
  patch: Partial<CohortInput>,
): AdminCohortRecord | null {
  ensureHydrated();
  const existing = snapshot.cohorts.find((c) => c.id === idValue);
  if (!existing) return null;
  const next: AdminCohortRecord = {
    ...existing,
    ...patch,
    name: (patch.name ?? existing.name).trim(),
    programmeName: (patch.programmeName ?? existing.programmeName).trim(),
    standardCode: (patch.standardCode ?? existing.standardCode)
      .trim()
      .toUpperCase(),
    standardVersion: (patch.standardVersion ?? existing.standardVersion)
      .trim()
      .replace(/^v/i, ""),
    teachingGroup: (patch.teachingGroup ?? existing.teachingGroup).trim(),
    collegeDays: (patch.collegeDays ?? existing.collegeDays).trim(),
    tutorName: (patch.tutorName ?? existing.tutorName).trim(),
    notes: (patch.notes ?? existing.notes).trim(),
    updatedAt: new Date().toISOString(),
  };
  snapshot = {
    ...snapshot,
    cohorts: snapshot.cohorts.map((c) => (c.id === idValue ? next : c)),
  };
  emit();
  return next;
}

/**
 * Find the cohort a new pupil should auto-flow into for a given standard.
 * Only planned (not-yet-active) cohorts accept auto-flow, and only once their
 * enrolment window has opened. Once a cohort is active, learners must be placed
 * manually for accuracy. Returns the soonest-starting eligible cohort.
 */
export function findIntakeCohort(
  standardCode: string,
  onDate: string = new Date().toISOString().slice(0, 10),
): AdminCohortRecord | null {
  ensureHydrated();
  const code = standardCode.trim().toUpperCase();
  const eligible = snapshot.cohorts
    .filter(
      (c) =>
        c.standardCode.toUpperCase() === code &&
        c.status === "planned" &&
        (!c.enrolmentOpensDate || c.enrolmentOpensDate <= onDate),
    )
    .sort((a, b) => a.startDate.localeCompare(b.startDate));
  return eligible[0] ?? null;
}

/** Assign or remove a learner from a cohort (pins them to that version). */
export async function setEnrolmentCohort(
  enrolmentId: string,
  cohortId: string | null,
): Promise<AdminLearnerEnrolment | null> {
  ensureHydrated();
  if (isLiveAdminStoreEnabled()) {
    return updateEnrolment(enrolmentId, { cohortId });
  }
  const existing = snapshot.enrolments.find((e) => e.id === enrolmentId);
  if (!existing) return null;
  if (cohortId) {
    const cohort = snapshot.cohorts.find((c) => c.id === cohortId);
    if (!cohort) return null;
  }
  const next: AdminLearnerEnrolment = {
    ...existing,
    cohortId,
    updatedAt: new Date().toISOString(),
  };
  snapshot = {
    ...snapshot,
    enrolments: snapshot.enrolments.map((e) =>
      e.id === enrolmentId ? next : e,
    ),
  };
  emit();
  return next;
}

export type UserInput = {
  displayName: string;
  email: string;
  role: AdminPortalUser["role"];
  workspace: string;
  linkedEnrolmentId: string | null;
  linkedLearnerId: string | null;
  linkedEmployerId: string | null;
  programmeStartDate: string | null;
  status: AdminPortalUser["status"];
  enabledBy?: string | null;
  enabledAt?: string | null;
  disabledBy?: string | null;
  disabledAt?: string | null;
};

export function listUsers(): AdminPortalUser[] {
  ensureHydrated();
  return [...snapshot.users].sort((a, b) =>
    a.displayName.localeCompare(b.displayName),
  );
}

export function createUser(input: UserInput): AdminPortalUser {
  ensureHydrated();
  const stamp = new Date().toISOString();
  const row: AdminPortalUser = {
    id: id("user"),
    displayName: input.displayName.trim(),
    email: input.email.trim(),
    role: input.role,
    workspace: input.workspace,
    linkedEnrolmentId: input.linkedEnrolmentId,
    linkedLearnerId: input.linkedLearnerId,
    linkedEmployerId: input.linkedEmployerId,
    programmeStartDate: input.programmeStartDate,
    status: input.status,
    enabledBy: input.enabledBy ?? null,
    enabledAt: input.enabledAt ?? null,
    disabledBy: input.disabledBy ?? null,
    disabledAt: input.disabledAt ?? null,
    createdAt: stamp,
    updatedAt: stamp,
  };
  snapshot = {
    ...snapshot,
    users: [row, ...snapshot.users],
  };
  emit();
  return row;
}

export function updateUser(
  idValue: string,
  patch: Partial<UserInput>,
): AdminPortalUser | null {
  ensureHydrated();
  const existing = snapshot.users.find((u) => u.id === idValue);
  if (!existing) return null;
  const next: AdminPortalUser = {
    ...existing,
    ...patch,
    displayName: (patch.displayName ?? existing.displayName).trim(),
    email: (patch.email ?? existing.email).trim(),
    updatedAt: new Date().toISOString(),
  };
  snapshot = {
    ...snapshot,
    users: snapshot.users.map((u) => (u.id === idValue ? next : u)),
  };
  emit();
  return next;
}

/** Staff turn on the portal environment after enrolment / invite. */
export function enablePortalEnvironment(
  idValue: string,
  enabledBy: string,
): AdminPortalUser | null {
  return updateUser(idValue, {
    status: "active",
    enabledBy,
    enabledAt: new Date().toISOString(),
  });
}

/** Change environment state, stamping who enabled or disabled it. */
export function setPortalEnvironment(
  idValue: string,
  status: AdminPortalUser["status"],
  actorName: string,
): AdminPortalUser | null {
  const stamp = new Date().toISOString();
  if (status === "active") {
    return updateUser(idValue, {
      status,
      enabledBy: actorName,
      enabledAt: stamp,
    });
  }
  if (status === "disabled") {
    return updateUser(idValue, {
      status,
      disabledBy: actorName,
      disabledAt: stamp,
    });
  }
  return updateUser(idValue, { status });
}

export function getAdminStats() {
  ensureHydrated();
  const activeLearners = snapshot.enrolments.filter(
    (e) => e.status === "active",
  ).length;
  const pendingStart = snapshot.enrolments.filter(
    (e) => e.status === "pending_start" || e.status === "draft",
  ).length;
  const activeEmployers = snapshot.employers.filter(
    (e) => e.status === "active",
  ).length;
  const activeProgrammes = snapshot.programmes.filter(
    (p) => p.status === "active",
  ).length;
  const portalUsers = snapshot.users.filter((u) => u.status !== "disabled")
    .length;
  return {
    activeLearners,
    pendingStart,
    activeEmployers,
    activeProgrammes,
    portalUsers,
  };
}

/** Test helper — replace in-memory snapshot without touching storage until emit. */
export function __replaceAdminSnapshotForTests(next: AdminStoreSnapshot): void {
  snapshot = clone(next);
  hydrated = true;
}
