import { createSeedSnapshot } from "./seed";
import type {
  AdminEmployerRecord,
  AdminLearnerEnrolment,
  AdminPortalUser,
  AdminProgrammeRecord,
  AdminStoreSnapshot,
  EnrolmentKind,
  EnrolmentStatus,
} from "./types";

const STORAGE_KEY = "gta-portal.administration.v1";

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function loadSnapshot(): AdminStoreSnapshot {
  if (typeof window === "undefined") return createSeedSnapshot();
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return createSeedSnapshot();
    const parsed = JSON.parse(raw) as AdminStoreSnapshot;
    if (parsed?.version !== 3) return createSeedSnapshot();
    return parsed;
  } catch {
    return createSeedSnapshot();
  }
}

function persist(snapshot: AdminStoreSnapshot): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot));
}

let snapshot: AdminStoreSnapshot = createSeedSnapshot();
let hydrated = false;
const listeners = new Set<() => void>();

function ensureHydrated(): void {
  if (hydrated || typeof window === "undefined") return;
  snapshot = loadSnapshot();
  hydrated = true;
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
  return () => listeners.delete(listener);
}

export function getAdminSnapshot(): AdminStoreSnapshot {
  ensureHydrated();
  return snapshot;
}

export function resetAdminStore(): void {
  snapshot = createSeedSnapshot();
  emit();
}

export type EnrolmentInput = {
  kind: EnrolmentKind;
  status?: EnrolmentStatus;
  displayName: string;
  email: string;
  phone: string;
  dateOfBirth: string;
  uln: string;
  programmeName: string;
  standardCode: string;
  employerId: string;
  employerName: string;
  workplaceContact: string;
  mentorName: string;
  tutorName: string;
  startDate: string;
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

export function createEnrolment(input: EnrolmentInput): AdminLearnerEnrolment {
  ensureHydrated();
  const stamp = new Date().toISOString();
  const row: AdminLearnerEnrolment = {
    id: id("enr"),
    kind: input.kind,
    status:
      input.status ??
      (input.kind === "new_starter" ? "pending_start" : "active"),
    displayName: input.displayName.trim(),
    email: input.email.trim(),
    phone: input.phone.trim(),
    dateOfBirth: input.dateOfBirth,
    uln: input.uln.trim(),
    programmeName: input.programmeName,
    standardCode: input.standardCode,
    employerId: input.employerId,
    employerName: input.employerName,
    workplaceContact: input.workplaceContact.trim(),
    mentorName: input.mentorName.trim(),
    tutorName: input.tutorName.trim(),
    startDate: input.startDate,
    programmeYear: input.programmeYear,
    programmeWeek: input.programmeWeek,
    attendancePercent: input.attendancePercent,
    actualProgressPercent: input.actualProgressPercent,
    collegeDays: input.collegeDays.trim(),
    notes: input.notes.trim(),
    createdAt: stamp,
    updatedAt: stamp,
  };
  snapshot = {
    ...snapshot,
    enrolments: [row, ...snapshot.enrolments],
  };
  emit();
  return row;
}

export function updateEnrolment(
  idValue: string,
  patch: Partial<EnrolmentInput> & { status?: EnrolmentStatus },
): AdminLearnerEnrolment | null {
  ensureHydrated();
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

export type UserInput = {
  displayName: string;
  email: string;
  role: AdminPortalUser["role"];
  workspace: string;
  linkedEnrolmentId: string | null;
  linkedEmployerId: string | null;
  status: AdminPortalUser["status"];
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
    linkedEmployerId: input.linkedEmployerId,
    status: input.status,
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
