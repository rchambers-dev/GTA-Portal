import { createSeedSnapshot } from "./seed";
import { assertJobTitlesAssignable } from "./staff-job-titles";
import { normalizeEnrolmentTiming } from "./enrolment-status";
import {
  createCohortOps,
  DEFAULT_TEACHING_GROUP_CAPACITY,
  type CohortInput,
  type TeachingGroupInput,
} from "./cohort-ops";
import {
  COHORT_LOCKED_MESSAGE,
  COHORT_VERSION_FROZEN_MESSAGE,
  isCohortStarted,
} from "./cohort-lifecycle";
import type {
  AdminEmployerRecord,
  AdminApprenticeEnrolment,
  AdminApprenticeRecord,
  AdminPackItemStatus,
  AdminPortalUser,
  AdminProgrammeRecord,
  AdminStoreSnapshot,
  EnrolmentKind,
  EnrolmentStatus,
} from "./types";

export {
  DEFAULT_TEACHING_GROUP_CAPACITY,
  type CohortInput,
  type TeachingGroupInput,
};
export { isCohortStarted, COHORT_LOCKED_MESSAGE, COHORT_VERSION_FROZEN_MESSAGE };

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

/** Client mutations always go through live Supabase APIs. */
function isLiveAdminStoreEnabled(): boolean {
  return typeof window !== "undefined";
}

/** Stable seed used for SSR + the first client paint (avoids hydration mismatch). */
const SERVER_SNAPSHOT: AdminStoreSnapshot = createSeedSnapshot();
let snapshot: AdminStoreSnapshot = clone(SERVER_SNAPSHOT);
let hydrated = false;
let hydrateScheduled = false;
const listeners = new Set<() => void>();

function ensureHydrated(): void {
  // Live mode: snapshot is refreshed asynchronously from /api/admin/store.
}

async function fetchLiveAdminSlice(): Promise<void> {
  if (typeof window === "undefined") return;
  const response = await fetch("/api/admin/store", {
    credentials: "include",
    cache: "no-store",
  });
  if (!response.ok) return;
  const data = (await response.json()) as {
    apprentices: AdminApprenticeRecord[];
    enrolments: AdminApprenticeEnrolment[];
    employers?: AdminEmployerRecord[];
    programmes?: AdminProgrammeRecord[];
    cohorts?: AdminStoreSnapshot["cohorts"];
    teachingGroups?: AdminStoreSnapshot["teachingGroups"];
    cohortChangeLogs?: AdminStoreSnapshot["cohortChangeLogs"];
    users?: AdminPortalUser[];
  };
  snapshot = {
    ...snapshot,
    apprentices: data.apprentices,
    enrolments: data.enrolments.map((row) => normalizeEnrolmentTiming(row)),
    employers: data.employers ?? snapshot.employers,
    programmes: data.programmes ?? snapshot.programmes,
    cohorts: data.cohorts ?? snapshot.cohorts,
    teachingGroups: data.teachingGroups ?? snapshot.teachingGroups,
    cohortChangeLogs: data.cohortChangeLogs ?? snapshot.cohortChangeLogs,
    users: data.users ?? snapshot.users,
  };
}

function scheduleHydrateFromStorage(): void {
  if (hydrated || hydrateScheduled || typeof window === "undefined") return;
  hydrateScheduled = true;
  queueMicrotask(() => {
    if (hydrated) return;
    hydrated = true;
    void fetchLiveAdminSlice().then(() => {
      for (const listener of listeners) listener();
    });
  });
}

function emit(): void {
  for (const listener of listeners) listener();
}

function id(prefix: string): string {
  return prefix + "-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 7);
}

/** Assigned after updateEnrolment — used by cohort ops + enrolment placement. */
let cohortOps: ReturnType<typeof createCohortOps>;

function requireCohortUnlocked(cohortId: string): void {
  const cohort = snapshot.cohorts.find((c) => c.id === cohortId);
  if (!cohort) throw new Error("Cohort not found");
  if (cohort.locked !== false) throw new Error(COHORT_LOCKED_MESSAGE);
}

export function subscribeAdminStore(listener: () => void): () => void {
  listeners.add(listener);
  scheduleHydrateFromStorage();
  return () => listeners.delete(listener);
}

export function getAdminSnapshot(): AdminStoreSnapshot {
  // Must return a stable reference for useSyncExternalStore — never allocate here.
  return snapshot;
}

/** Server / hydration snapshot — blank seed until live fetch lands. */
export function getAdminServerSnapshot(): AdminStoreSnapshot {
  return SERVER_SNAPSHOT;
}

export function resetAdminStore(): void {
  snapshot = createSeedSnapshot();
  hydrated = true;
  emit();
}

export type ApprenticeInput = {
  displayName: string;
  apprenticeReference: string;
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
  intakeStatus: AdminApprenticeRecord["intakeStatus"];
  notes: string;
};

/** e.g. GTA-2026-04831 */
function generateApprenticeReference(): string {
  const year = new Date().getFullYear();
  const serial = String(Math.floor(Math.random() * 90000) + 10000);
  return `GTA-${year}-0${serial.slice(0, 4)}`;
}

export function listApprentices(): AdminApprenticeRecord[] {
  ensureHydrated();
  return [...snapshot.apprentices].sort((a, b) =>
    a.displayName.localeCompare(b.displayName),
  );
}

export function getApprentice(idValue: string): AdminApprenticeRecord | undefined {
  ensureHydrated();
  return snapshot.apprentices.find((l) => l.id === idValue);
}

export async function createApprentice(input: ApprenticeInput): Promise<AdminApprenticeRecord> {
  ensureHydrated();
  if (isLiveAdminStoreEnabled()) {
    const response = await fetch("/api/admin/store", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ action: "createApprentice", input }),
    });
    if (!response.ok) {
      throw new Error("Unable to create apprentice");
    }
    const data = (await response.json()) as { apprentice: AdminApprenticeRecord };
    snapshot = {
      ...snapshot,
      apprentices: [data.apprentice, ...snapshot.apprentices.filter((row) => row.id !== data.apprentice.id)],
    };
    emit();
    return data.apprentice;
  }
  const stamp = new Date().toISOString();
  const row: AdminApprenticeRecord = {
    id: id("lrn"),
    displayName: input.displayName.trim(),
    apprenticeReference:
      input.apprenticeReference.trim() || generateApprenticeReference(),
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
    apprentices: [row, ...snapshot.apprentices],
  };
  emit();
  return row;
}

export async function updateApprentice(
  idValue: string,
  patch: Partial<ApprenticeInput>,
): Promise<AdminApprenticeRecord | null> {
  ensureHydrated();
  if (isLiveAdminStoreEnabled()) {
    const response = await fetch("/api/admin/store", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ action: "updateApprentice", id: idValue, patch }),
    });
    if (!response.ok) return null;
    const data = (await response.json()) as { apprentice: AdminApprenticeRecord };
    snapshot = {
      ...snapshot,
      apprentices: snapshot.apprentices.map((row) => (row.id === idValue ? data.apprentice : row)),
      enrolments: snapshot.enrolments.map((e) =>
        e.apprenticeId === idValue
          ? {
              ...e,
              displayName: data.apprentice.displayName,
              email: data.apprentice.email,
              phone: data.apprentice.phone,
              dateOfBirth: data.apprentice.dateOfBirth,
              uln: data.apprentice.uln,
            }
          : e,
      ),
    };
    emit();
    return data.apprentice;
  }
  const existing = snapshot.apprentices.find((l) => l.id === idValue);
  if (!existing) return null;
  const next: AdminApprenticeRecord = {
    ...existing,
    ...patch,
    displayName: (patch.displayName ?? existing.displayName).trim(),
    apprenticeReference: (
      patch.apprenticeReference ?? existing.apprenticeReference
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
    apprentices: snapshot.apprentices.map((l) => (l.id === idValue ? next : l)),
    // Keep enrolment snapshots of personal details in step with the record.
    enrolments: snapshot.enrolments.map((e) =>
      e.apprenticeId === idValue
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

export function setApprenticePackItem(
  apprenticeId: string,
  reference: string,
  status: AdminPackItemStatus,
): void {
  ensureHydrated();
  const existing = snapshot.apprentices.find((l) => l.id === apprenticeId);
  if (!existing) return;
  const next: AdminApprenticeRecord = {
    ...existing,
    pack: { ...existing.pack, [reference]: status },
    updatedAt: new Date().toISOString(),
  };
  snapshot = {
    ...snapshot,
    apprentices: snapshot.apprentices.map((l) => (l.id === apprenticeId ? next : l)),
  };
  emit();
}

export type EnrolmentInput = {
  kind: EnrolmentKind;
  status?: EnrolmentStatus;
  apprenticeId: string | null;
  displayName: string;
  email: string;
  phone: string;
  dateOfBirth: string;
  uln: string;
  programmeName: string;
  standardCode: string;
  cohortId: string | null;
  teachingGroupId?: string | null;
  /** When true, allow placing into a full teaching group. */
  allowOverCapacity?: boolean;
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

export function listEnrolments(): AdminApprenticeEnrolment[] {
  ensureHydrated();
  return snapshot.enrolments
    .map((row) => normalizeEnrolmentTiming(row))
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export function getEnrolment(idValue: string): AdminApprenticeEnrolment | undefined {
  ensureHydrated();
  const row = snapshot.enrolments.find((e) => e.id === idValue);
  return row ? normalizeEnrolmentTiming(row) : undefined;
}

export async function createEnrolment(input: EnrolmentInput): Promise<AdminApprenticeEnrolment> {
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
    const data = (await response.json()) as { enrolment: AdminApprenticeEnrolment };
    const enrolment = normalizeEnrolmentTiming(data.enrolment);
    snapshot = {
      ...snapshot,
      enrolments: [
        enrolment,
        ...snapshot.enrolments.filter((row) => row.id !== enrolment.id),
      ],
    };
    emit();
    return enrolment;
  }
  let teachingGroupId = input.teachingGroupId ?? null;
  let tutorName = input.tutorName.trim();
  let collegeDays = input.collegeDays.trim();
  let cohortId = input.cohortId;
  if (teachingGroupId) {
    const applied = cohortOps.applyTeachingGroupToEnrolmentPatch(
      teachingGroupId,
      Boolean(input.allowOverCapacity),
      "",
    );
    if ("error" in applied) {
      throw new Error(applied.error);
    }
    teachingGroupId = applied.patch.teachingGroupId ?? teachingGroupId;
    tutorName = (applied.patch.tutorName ?? tutorName).trim();
    collegeDays = (applied.patch.collegeDays ?? collegeDays).trim();
    cohortId = applied.patch.cohortId ?? cohortId;
  }

  const stamp = new Date().toISOString();
  const row = normalizeEnrolmentTiming({
    id: id("enr"),
    kind: input.kind,
    status:
      input.status ??
      (input.kind === "new_starter" ? "pending_start" : "active"),
    apprenticeId: input.apprenticeId,
    displayName: input.displayName.trim(),
    email: input.email.trim(),
    phone: input.phone.trim(),
    dateOfBirth: input.dateOfBirth,
    uln: input.uln.trim(),
    programmeName: input.programmeName,
    standardCode: input.standardCode,
    cohortId,
    teachingGroupId,
    employerId: input.employerId,
    employerName: input.employerName,
    workplaceContact: input.workplaceContact.trim(),
    mentorName: input.mentorName.trim(),
    tutorName,
    startDate: input.startDate,
    originalPlannedEndDate: input.originalPlannedEndDate,
    programmeYear: input.programmeYear,
    programmeWeek: input.programmeWeek,
    attendancePercent: input.attendancePercent,
    actualProgressPercent: input.actualProgressPercent,
    collegeDays,
    notes: input.notes.trim(),
    createdAt: stamp,
    updatedAt: stamp,
  });

  /** Enrolment queues Account Setup — staff enable the apprentice environment. */
  const emailKey = row.email.toLowerCase();
  const alreadyHasPortal = snapshot.users.some(
    (u) =>
      u.linkedApprenticeId === row.apprenticeId ||
      u.linkedEnrolmentId === row.id ||
      (u.email.trim().toLowerCase() === emailKey && emailKey.length > 0),
  );
  const provisionedUser: AdminPortalUser | null = alreadyHasPortal
    ? null
    : {
        id: id("user"),
        displayName: row.displayName,
        email: row.email,
        role: "Apprentice",
        workspace: "apprentice",
        jobTitles: [],
        linkedEnrolmentId: row.id,
        linkedApprenticeId: row.apprenticeId,
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
): Promise<AdminApprenticeEnrolment | null> {
  ensureHydrated();
  if (isLiveAdminStoreEnabled()) {
    const response = await fetch("/api/admin/store", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ action: "updateEnrolment", id: idValue, patch }),
    });
    if (!response.ok) return null;
    const data = (await response.json()) as { enrolment: AdminApprenticeEnrolment };
    const enrolment = normalizeEnrolmentTiming(data.enrolment);
    snapshot = {
      ...snapshot,
      enrolments: snapshot.enrolments.map((row) =>
        row.id === idValue ? enrolment : row,
      ),
    };
    emit();
    return enrolment;
  }
  const existing = snapshot.enrolments.find((e) => e.id === idValue);
  if (!existing) return null;

  let derived: Partial<AdminApprenticeEnrolment> = {};
  if (patch.teachingGroupId !== undefined) {
    if (patch.teachingGroupId) {
      const group = snapshot.teachingGroups.find(
        (g) => g.id === patch.teachingGroupId,
      );
      if (group) requireCohortUnlocked(group.cohortId);
    } else if (existing.cohortId) {
      requireCohortUnlocked(existing.cohortId);
    }
    const applied = cohortOps.applyTeachingGroupToEnrolmentPatch(
      patch.teachingGroupId,
      Boolean(patch.allowOverCapacity),
      idValue,
    );
    if ("error" in applied) {
      throw new Error(applied.error);
    }
    derived = applied.patch;
  }

  const next: AdminApprenticeEnrolment = {
    ...existing,
    ...patch,
    ...derived,
    displayName: (patch.displayName ?? existing.displayName).trim(),
    email: (patch.email ?? existing.email).trim(),
    phone: (patch.phone ?? existing.phone).trim(),
    uln: (patch.uln ?? existing.uln).trim(),
    workplaceContact: (patch.workplaceContact ?? existing.workplaceContact).trim(),
    mentorName: (patch.mentorName ?? existing.mentorName).trim(),
    tutorName: (derived.tutorName ?? patch.tutorName ?? existing.tutorName).trim(),
    originalPlannedEndDate:
      patch.originalPlannedEndDate ?? existing.originalPlannedEndDate,
    collegeDays: (
      derived.collegeDays ??
      patch.collegeDays ??
      existing.collegeDays
    ).trim(),
    teachingGroupId:
      derived.teachingGroupId !== undefined
        ? derived.teachingGroupId
        : (patch.teachingGroupId ?? existing.teachingGroupId),
    cohortId:
      derived.cohortId !== undefined
        ? derived.cohortId
        : (patch.cohortId ?? existing.cohortId),
    notes: (patch.notes ?? existing.notes).trim(),
    updatedAt: new Date().toISOString(),
  };
  // EnrolmentInput extras must not persist on the row.
  delete (next as AdminApprenticeEnrolment & { allowOverCapacity?: boolean })
    .allowOverCapacity;
  const normalised = normalizeEnrolmentTiming(next);
  snapshot = {
    ...snapshot,
    enrolments: snapshot.enrolments.map((e) =>
      e.id === idValue ? normalised : e,
    ),
  };
  emit();
  return normalised;
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

export async function createEmployer(
  input: EmployerInput,
): Promise<AdminEmployerRecord> {
  ensureHydrated();
  if (isLiveAdminStoreEnabled()) {
    const data = await liveAdminPost<{ employer: AdminEmployerRecord }>(
      { action: "createEmployer", input },
      "Unable to create employer",
    );
    snapshot = {
      ...snapshot,
      employers: [
        data.employer,
        ...snapshot.employers.filter((row) => row.id !== data.employer.id),
      ],
    };
    emit();
    return data.employer;
  }
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

export async function updateEmployer(
  idValue: string,
  patch: Partial<EmployerInput>,
): Promise<AdminEmployerRecord | null> {
  ensureHydrated();
  if (isLiveAdminStoreEnabled()) {
    const data = await liveAdminPost<{ employer: AdminEmployerRecord }>(
      { action: "updateEmployer", id: idValue, patch },
      "Unable to update employer",
    );
    snapshot = {
      ...snapshot,
      employers: snapshot.employers.map((e) =>
        e.id === idValue ? data.employer : e,
      ),
    };
    emit();
    return data.employer;
  }
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

export async function createProgramme(
  input: ProgrammeInput,
): Promise<AdminProgrammeRecord> {
  ensureHydrated();
  if (isLiveAdminStoreEnabled()) {
    const data = await liveAdminPost<{ programme: AdminProgrammeRecord }>(
      { action: "createProgramme", input },
      "Unable to create programme",
    );
    snapshot = {
      ...snapshot,
      programmes: [
        data.programme,
        ...snapshot.programmes.filter((row) => row.id !== data.programme.id),
      ],
    };
    emit();
    return data.programme;
  }
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

export async function updateProgramme(
  idValue: string,
  patch: Partial<ProgrammeInput>,
): Promise<AdminProgrammeRecord | null> {
  ensureHydrated();
  if (isLiveAdminStoreEnabled()) {
    const data = await liveAdminPost<{ programme: AdminProgrammeRecord }>(
      { action: "updateProgramme", id: idValue, patch },
      "Unable to update programme",
    );
    snapshot = {
      ...snapshot,
      programmes: snapshot.programmes.map((p) =>
        p.id === idValue ? data.programme : p,
      ),
    };
    emit();
    return data.programme;
  }
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

cohortOps = createCohortOps({
  getSnapshot: () => ({
    cohorts: snapshot.cohorts,
    teachingGroups: snapshot.teachingGroups,
    cohortChangeLogs: snapshot.cohortChangeLogs,
    enrolments: snapshot.enrolments,
  }),
  setSnapshot: (next) => {
    snapshot = { ...snapshot, ...next };
  },
  emit,
  ensureHydrated,
  id,
  updateEnrolment,
});

export const listCohorts = cohortOps.listCohorts;
export const listCohortChangeLogs = cohortOps.listCohortChangeLogs;
export const findIntakeCohort = cohortOps.findIntakeCohort;
export const listTeachingGroups = cohortOps.listTeachingGroups;

async function liveAdminPost<T>(
  body: Record<string, unknown>,
  fallbackError: string,
): Promise<T> {
  const response = await fetch("/api/admin/store", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    const data = (await response.json().catch(() => null)) as {
      error?: string;
    } | null;
    throw new Error(data?.error ?? fallbackError);
  }
  return (await response.json()) as T;
}

export async function createCohort(
  input: CohortInput,
): Promise<AdminStoreSnapshot["cohorts"][number]> {
  if (isLiveAdminStoreEnabled()) {
    const data = await liveAdminPost<{
      cohort: AdminStoreSnapshot["cohorts"][number];
    }>({ action: "createCohort", input }, "Unable to create cohort");
    snapshot = {
      ...snapshot,
      cohorts: [
        data.cohort,
        ...snapshot.cohorts.filter((row) => row.id !== data.cohort.id),
      ],
    };
    emit();
    return data.cohort;
  }
  return cohortOps.createCohort(input);
}

export async function updateCohort(
  idValue: string,
  patch: Partial<CohortInput>,
): Promise<AdminStoreSnapshot["cohorts"][number] | null> {
  if (isLiveAdminStoreEnabled()) {
    const data = await liveAdminPost<{
      cohort: AdminStoreSnapshot["cohorts"][number];
    }>(
      { action: "updateCohort", id: idValue, patch },
      "Unable to update cohort — it may be locked.",
    );
    snapshot = {
      ...snapshot,
      cohorts: snapshot.cohorts.map((row) =>
        row.id === idValue ? data.cohort : row,
      ),
    };
    emit();
    return data.cohort;
  }
  return cohortOps.updateCohort(idValue, patch);
}

export async function lockCohortWithSessionLog(
  cohortId: string,
  sessionEdits: string[],
  actorName = "",
): Promise<{
  cohort: AdminStoreSnapshot["cohorts"][number];
  entry: AdminStoreSnapshot["cohortChangeLogs"][number];
} | null> {
  if (isLiveAdminStoreEnabled()) {
    const details = sessionEdits.map((line) => line.trim()).filter(Boolean);
    const resolvedActor = actorName.trim() || "Administrator";
    const summary = details.length
      ? `${resolvedActor} saved ${details.length} change${details.length === 1 ? "" : "s"}`
      : `${resolvedActor} locked with no structural changes`;
    const data = await liveAdminPost<{
      cohort: AdminStoreSnapshot["cohorts"][number];
      entry: AdminStoreSnapshot["cohortChangeLogs"][number];
    }>(
      {
        action: "lockCohortSession",
        id: cohortId,
        summary,
        details,
        actorName: resolvedActor,
      },
      "Unable to lock cohort",
    );
    snapshot = {
      ...snapshot,
      cohorts: snapshot.cohorts.map((row) =>
        row.id === cohortId ? data.cohort : row,
      ),
      cohortChangeLogs: [
        data.entry,
        ...(snapshot.cohortChangeLogs ?? []).filter(
          (row) => row.id !== data.entry.id,
        ),
      ],
    };
    emit();
    return data;
  }
  return cohortOps.lockCohortWithSessionLog(cohortId, sessionEdits, actorName);
}

export async function setEnrolmentCohort(
  enrolmentId: string,
  cohortId: string | null,
): Promise<AdminApprenticeEnrolment | null> {
  return cohortOps.setEnrolmentCohort(enrolmentId, cohortId);
}

export async function assignEnrolmentToTeachingGroup(
  enrolmentId: string,
  teachingGroupId: string | null,
  opts?: { allowOverCapacity?: boolean },
): Promise<AdminApprenticeEnrolment | null> {
  return cohortOps.assignEnrolmentToTeachingGroup(
    enrolmentId,
    teachingGroupId,
    opts,
  );
}

export async function createTeachingGroup(
  input: TeachingGroupInput,
): Promise<AdminStoreSnapshot["teachingGroups"][number]> {
  if (isLiveAdminStoreEnabled()) {
    const data = await liveAdminPost<{
      teachingGroup: AdminStoreSnapshot["teachingGroups"][number];
    }>(
      { action: "createTeachingGroup", input },
      "Unable to create teaching group",
    );
    snapshot = {
      ...snapshot,
      teachingGroups: [
        data.teachingGroup,
        ...snapshot.teachingGroups.filter(
          (g) => g.id !== data.teachingGroup.id,
        ),
      ],
    };
    emit();
    return data.teachingGroup;
  }
  return cohortOps.createTeachingGroup(input);
}

export async function updateTeachingGroup(
  idValue: string,
  patch: Partial<TeachingGroupInput>,
): Promise<AdminStoreSnapshot["teachingGroups"][number] | null> {
  if (isLiveAdminStoreEnabled()) {
    const data = await liveAdminPost<{
      teachingGroup: AdminStoreSnapshot["teachingGroups"][number];
    }>(
      { action: "updateTeachingGroup", id: idValue, patch },
      "Unable to update teaching group",
    );
    snapshot = {
      ...snapshot,
      teachingGroups: snapshot.teachingGroups.map((g) =>
        g.id === idValue ? data.teachingGroup : g,
      ),
      enrolments: snapshot.enrolments.map((e) => {
        if (e.teachingGroupId !== idValue) return e;
        return {
          ...e,
          tutorName: data.teachingGroup.tutorName,
          collegeDays: data.teachingGroup.collegeDays,
          updatedAt: new Date().toISOString(),
        };
      }),
    };
    emit();
    return data.teachingGroup;
  }
  return cohortOps.updateTeachingGroup(idValue, patch);
}

export async function deleteTeachingGroup(idValue: string): Promise<void> {
  if (isLiveAdminStoreEnabled()) {
    await liveAdminPost<{ ok: boolean }>(
      { action: "deleteTeachingGroup", id: idValue },
      "Unable to delete teaching group",
    );
    snapshot = {
      ...snapshot,
      teachingGroups: snapshot.teachingGroups.filter((g) => g.id !== idValue),
    };
    emit();
    return;
  }
  return cohortOps.deleteTeachingGroup(idValue);
}

export type UserInput = {
  displayName: string;
  email: string;
  role: AdminPortalUser["role"];
  workspace: string;
  jobTitles?: string[];
  linkedEnrolmentId: string | null;
  linkedApprenticeId: string | null;
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

export async function createUser(
  input: UserInput,
): Promise<AdminPortalUser> {
  ensureHydrated();
  if (isLiveAdminStoreEnabled()) {
    const data = await liveAdminPost<{
      user: AdminPortalUser;
      temporaryPassword?: string;
    }>({ action: "createStaff", input }, "Unable to create staff member");
    snapshot = {
      ...snapshot,
      users: [
        data.user,
        ...snapshot.users.filter((row) => row.id !== data.user.id),
      ],
    };
    emit();
    return data.user;
  }
  const stamp = new Date().toISOString();
  const row: AdminPortalUser = {
    id: id("user"),
    displayName: input.displayName.trim(),
    email: input.email.trim(),
    role: input.role,
    workspace: input.workspace,
    jobTitles: (input.jobTitles ?? []).map((t) => t.trim()).filter(Boolean),
    linkedEnrolmentId: input.linkedEnrolmentId,
    linkedApprenticeId: input.linkedApprenticeId,
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
    jobTitles: (patch.jobTitles ?? existing.jobTitles ?? []).map((t) =>
      t.trim(),
    ),
    updatedAt: new Date().toISOString(),
  };
  snapshot = {
    ...snapshot,
    users: snapshot.users.map((u) => (u.id === idValue ? next : u)),
  };
  emit();
  return next;
}

export async function updateStaffProfile(
  idValue: string,
  patch: {
    role?: AdminPortalUser["role"];
    workspace?: string;
    jobTitles?: string[];
  },
): Promise<AdminPortalUser | null> {
  ensureHydrated();
  if (isLiveAdminStoreEnabled()) {
    if (patch.jobTitles) {
      assertJobTitlesAssignable(idValue, patch.jobTitles, snapshot.users);
    }
    const data = await liveAdminPost<{ user: AdminPortalUser }>(
      { action: "updateStaffProfile", id: idValue, patch },
      "Unable to update staff profile",
    );
    snapshot = {
      ...snapshot,
      users: snapshot.users.map((u) => (u.id === idValue ? data.user : u)),
    };
    emit();
    return data.user;
  }
  if (patch.jobTitles) {
    assertJobTitlesAssignable(idValue, patch.jobTitles, snapshot.users);
  }
  return updateUser(idValue, patch);
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
export async function setPortalEnvironment(
  idValue: string,
  status: AdminPortalUser["status"],
  actorName: string,
): Promise<{ user: AdminPortalUser; temporaryPassword?: string }> {
  ensureHydrated();
  if (isLiveAdminStoreEnabled()) {
    const data = await liveAdminPost<{
      user: AdminPortalUser;
      temporaryPassword?: string;
    }>(
      {
        action: "setPortalEnvironment",
        id: idValue,
        status,
        actorName,
      },
      "Unable to update portal environment",
    );
    snapshot = {
      ...snapshot,
      users: snapshot.users.map((u) => (u.id === idValue ? data.user : u)),
    };
    emit();
    return {
      user: data.user,
      temporaryPassword: data.temporaryPassword,
    };
  }
  const stamp = new Date().toISOString();
  if (status === "active") {
    const user = updateUser(idValue, {
      status,
      enabledBy: actorName,
      enabledAt: stamp,
    });
    if (!user) throw new Error("Unable to update portal environment");
    if (user.role === "Apprentice" || user.workspace === "apprentice") {
      const { generateTempPassword } = await import("./temp-password");
      return { user, temporaryPassword: generateTempPassword() };
    }
    return { user };
  }
  if (status === "disabled") {
    const user = updateUser(idValue, {
      status,
      disabledBy: actorName,
      disabledAt: stamp,
    });
    if (!user) throw new Error("Unable to update portal environment");
    return { user };
  }
  const user = updateUser(idValue, { status });
  if (!user) throw new Error("Unable to update portal environment");
  return { user };
}

export async function revealApprenticePassword(
  portalUserId: string,
  adminPassword: string,
): Promise<{ password: string; email: string; displayName: string }> {
  ensureHydrated();
  if (!isLiveAdminStoreEnabled()) {
    const { generateTempPassword } = await import("./temp-password");
    const user = snapshot.users.find((u) => u.id === portalUserId);
    return {
      password: generateTempPassword(),
      email: user?.email ?? "demo@example.gta.local",
      displayName: user?.displayName ?? "Demo apprentice",
    };
  }
  const data = await liveAdminPost<{
    password: string;
    email?: string;
    displayName?: string;
  }>(
    {
      action: "revealApprenticePassword",
      id: portalUserId,
      adminPassword,
    },
    "Unable to reveal password",
  );
  return {
    password: data.password,
    email: data.email ?? "",
    displayName: data.displayName ?? "",
  };
}

export function getAdminStats() {
  ensureHydrated();
  const activeApprentices = snapshot.enrolments.filter(
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
    activeApprentices,
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
