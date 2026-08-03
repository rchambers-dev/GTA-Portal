import {
  formatCohortTeachers,
  normalizeTeacherNames,
  parseCohortTeachers,
} from "./cohort-teachers";
import {
  COHORT_LOCKED_MESSAGE,
  COHORT_VERSION_FROZEN_MESSAGE,
  isCohortStarted,
} from "./cohort-lifecycle";
import { normalizeDeliverySpine } from "./cohort-products";
import {
  collegeDaysOverlap,
  formatCollegeDaysShort,
  parseCollegeDays,
} from "./college-days";
import type {
  AdminCohortChangeLogEntry,
  AdminCohortRecord,
  AdminApprenticeEnrolment,
  AdminTeachingGroupRecord,
} from "./types";

export const DEFAULT_TEACHING_GROUP_CAPACITY = 9;

export type CohortInput = {
  name: string;
  programmeId: string;
  programmeName: string;
  standardCode: string;
  standardVersion: string;
  /** groups = CEA / Temp; blocks = programme blocks / Main. */
  deliverySpine: AdminCohortRecord["deliverySpine"];
  enrolmentOpensDate: string;
  startDate: string;
  expectedEndDate: string;
  teachingGroup: string;
  collegeDays: string;
  /** Teachers delivering this shared intake. */
  teacherNames: string[];
  /** @deprecated Prefer teacherNames */
  tutorName?: string;
  status: AdminCohortRecord["status"];
  notes: string;
  /** Only used on update — create always locks the cohort. */
  locked?: boolean;
};

export type TeachingGroupInput = {
  cohortId: string;
  tutorName: string;
  name: string;
  collegeDays: string;
  capacity?: number;
  notes?: string;
};

type SnapshotAccess = {
  getSnapshot: () => {
    cohorts: AdminCohortRecord[];
    teachingGroups: AdminTeachingGroupRecord[];
    cohortChangeLogs: AdminCohortChangeLogEntry[];
    enrolments: AdminApprenticeEnrolment[];
  };
  setSnapshot: (
    next: ReturnType<SnapshotAccess["getSnapshot"]> & Record<string, unknown>,
  ) => void;
  emit: () => void;
  ensureHydrated: () => void;
  id: (prefix: string) => string;
  updateEnrolment: (
    id: string,
    patch: Partial<AdminApprenticeEnrolment> & {
      allowOverCapacity?: boolean;
      teachingGroupId?: string | null;
    },
  ) => Promise<AdminApprenticeEnrolment | null>;
};

export function createCohortOps(access: SnapshotAccess) {
  function requireCohortUnlocked(cohortId: string): void {
    const cohort = access.getSnapshot().cohorts.find((c) => c.id === cohortId);
    if (!cohort) throw new Error("Cohort not found");
    if (cohort.locked !== false) throw new Error(COHORT_LOCKED_MESSAGE);
  }

  function assertCohortProductEditable(
    existing: AdminCohortRecord,
    patch: Partial<CohortInput>,
  ): void {
    if (!isCohortStarted(existing)) return;
    if (patch.standardVersion != null) {
      const next = patch.standardVersion.trim().replace(/^v/i, "");
      if (next !== existing.standardVersion) {
        throw new Error(COHORT_VERSION_FROZEN_MESSAGE);
      }
    }
    if (patch.deliverySpine != null) {
      const next = normalizeDeliverySpine(patch.deliverySpine);
      if (next !== existing.deliverySpine) {
        throw new Error(COHORT_VERSION_FROZEN_MESSAGE);
      }
    }
  }

  function applyTeachingGroupToEnrolmentPatch(
    teachingGroupId: string | null,
    allowOverCapacity: boolean,
    enrolmentId: string,
  ): { patch: Partial<AdminApprenticeEnrolment> } | { error: string } {
    const snap = access.getSnapshot();
    if (!teachingGroupId) {
      return { patch: { teachingGroupId: null } };
    }
    const group = snap.teachingGroups.find((g) => g.id === teachingGroupId);
    if (!group) return { error: "Teaching group not found" };
    const count = snap.enrolments.filter(
      (e) => e.teachingGroupId === teachingGroupId && e.id !== enrolmentId,
    ).length;
    if (count >= group.capacity && !allowOverCapacity) {
      return {
        error: `Group is full (${count}/${group.capacity}). Admins can confirm to add over capacity.`,
      };
    }
    return {
      patch: {
        teachingGroupId: group.id,
        cohortId: group.cohortId,
        tutorName: group.tutorName,
        collegeDays: group.collegeDays,
      },
    };
  }

  function listCohorts(): AdminCohortRecord[] {
    access.ensureHydrated();
    return [...access.getSnapshot().cohorts].sort((a, b) =>
      b.startDate.localeCompare(a.startDate),
    );
  }

  function listCohortChangeLogs(
    cohortId?: string,
  ): AdminCohortChangeLogEntry[] {
    access.ensureHydrated();
    const rows = [...(access.getSnapshot().cohortChangeLogs ?? [])];
    const filtered = cohortId
      ? rows.filter((row) => row.cohortId === cohortId)
      : rows;
    return filtered.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  async function createCohort(input: CohortInput): Promise<AdminCohortRecord> {
    access.ensureHydrated();
    const stamp = new Date().toISOString();
    const teacherNames = normalizeTeacherNames(
      input.teacherNames ?? parseCohortTeachers(input.tutorName),
    );
    const row: AdminCohortRecord = {
      id: access.id("cohort"),
      name: input.name.trim(),
      programmeId: input.programmeId,
      programmeName: input.programmeName.trim(),
      standardCode: input.standardCode.trim().toUpperCase(),
      standardVersion: input.standardVersion.trim().replace(/^v/i, ""),
      deliverySpine: normalizeDeliverySpine(input.deliverySpine ?? "blocks"),
      enrolmentOpensDate: input.enrolmentOpensDate,
      startDate: input.startDate,
      expectedEndDate: input.expectedEndDate,
      teachingGroup: input.teachingGroup.trim(),
      collegeDays: input.collegeDays.trim(),
      teacherNames,
      tutorName: formatCohortTeachers(teacherNames),
      status: input.status,
      notes: input.notes.trim(),
      locked: true,
      createdAt: stamp,
      updatedAt: stamp,
    };
    const snap = access.getSnapshot();
    access.setSnapshot({
      ...snap,
      cohorts: [row, ...snap.cohorts],
    });
    access.emit();
    return row;
  }

  async function updateCohort(
    idValue: string,
    patch: Partial<CohortInput>,
  ): Promise<AdminCohortRecord | null> {
    access.ensureHydrated();
    const snap = access.getSnapshot();
    const existing = snap.cohorts.find((c) => c.id === idValue);
    if (!existing) return null;
    const patchKeys = Object.keys(patch).filter(
      (key) => patch[key as keyof CohortInput] !== undefined,
    );
    const unlockOnly = patchKeys.length === 1 && patch.locked === false;
    if (existing.locked && !unlockOnly) {
      throw new Error(COHORT_LOCKED_MESSAGE);
    }
    assertCohortProductEditable(existing, patch);
    const nextTeachers =
      patch.teacherNames != null
        ? normalizeTeacherNames(patch.teacherNames)
        : patch.tutorName != null
          ? parseCohortTeachers(patch.tutorName)
          : existing.teacherNames;
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
      deliverySpine: normalizeDeliverySpine(
        patch.deliverySpine ?? existing.deliverySpine,
      ),
      teachingGroup: (patch.teachingGroup ?? existing.teachingGroup).trim(),
      collegeDays: (patch.collegeDays ?? existing.collegeDays).trim(),
      teacherNames: nextTeachers,
      tutorName: formatCohortTeachers(nextTeachers),
      notes: (patch.notes ?? existing.notes).trim(),
      locked: patch.locked ?? existing.locked,
      updatedAt: new Date().toISOString(),
    };
    access.setSnapshot({
      ...snap,
      cohorts: snap.cohorts.map((c) => (c.id === idValue ? next : c)),
    });
    access.emit();
    return next;
  }

  async function lockCohortWithSessionLog(
    cohortId: string,
    sessionEdits: string[],
    actorName = "",
  ): Promise<{
    cohort: AdminCohortRecord;
    entry: AdminCohortChangeLogEntry;
  } | null> {
    access.ensureHydrated();
    const details = sessionEdits.map((line) => line.trim()).filter(Boolean);
    const resolvedActor = actorName.trim() || "Administrator";
    const summary = details.length
      ? `${resolvedActor} saved ${details.length} change${details.length === 1 ? "" : "s"}`
      : `${resolvedActor} locked with no structural changes`;

    const snap = access.getSnapshot();
    const existing = snap.cohorts.find((c) => c.id === cohortId);
    if (!existing) return null;

    const stamp = new Date().toISOString();
    const entry: AdminCohortChangeLogEntry = {
      id: access.id("clog"),
      cohortId,
      createdAt: stamp,
      summary,
      details,
      actorName: resolvedActor,
    };
    const cohort: AdminCohortRecord = {
      ...existing,
      locked: true,
      updatedAt: stamp,
    };
    access.setSnapshot({
      ...snap,
      cohorts: snap.cohorts.map((c) => (c.id === cohortId ? cohort : c)),
      cohortChangeLogs: [entry, ...(snap.cohortChangeLogs ?? [])],
    });
    access.emit();
    return { cohort, entry };
  }

  function findIntakeCohort(
    standardCode: string,
    onDate: string = new Date().toISOString().slice(0, 10),
  ): AdminCohortRecord | null {
    access.ensureHydrated();
    const code = standardCode.trim().toUpperCase();
    const eligible = access
      .getSnapshot()
      .cohorts.filter(
        (c) =>
          c.standardCode.toUpperCase() === code &&
          c.status === "planned" &&
          (!c.enrolmentOpensDate || c.enrolmentOpensDate <= onDate),
      )
      .sort((a, b) => a.startDate.localeCompare(b.startDate));
    return eligible[0] ?? null;
  }

  async function setEnrolmentCohort(
    enrolmentId: string,
    cohortId: string | null,
  ): Promise<AdminApprenticeEnrolment | null> {
    access.ensureHydrated();
    if (!cohortId) {
      return access.updateEnrolment(enrolmentId, {
        cohortId: null,
        teachingGroupId: null,
      });
    }
    return access.updateEnrolment(enrolmentId, { cohortId });
  }

  async function assignEnrolmentToTeachingGroup(
    enrolmentId: string,
    teachingGroupId: string | null,
    opts?: { allowOverCapacity?: boolean },
  ): Promise<AdminApprenticeEnrolment | null> {
    return access.updateEnrolment(enrolmentId, {
      teachingGroupId,
      allowOverCapacity: opts?.allowOverCapacity,
    });
  }

  function listTeachingGroups(
    cohortId?: string,
  ): AdminTeachingGroupRecord[] {
    access.ensureHydrated();
    const rows = [...access.getSnapshot().teachingGroups];
    const filtered = cohortId
      ? rows.filter((g) => g.cohortId === cohortId)
      : rows;
    return filtered.sort((a, b) => {
      const tutor = a.tutorName.localeCompare(b.tutorName);
      if (tutor !== 0) return tutor;
      return a.name.localeCompare(b.name);
    });
  }

  async function createTeachingGroup(
    input: TeachingGroupInput,
  ): Promise<AdminTeachingGroupRecord> {
    access.ensureHydrated();
    requireCohortUnlocked(input.cohortId);

    const tutorName = input.tutorName.trim();
    const collegeDays = input.collegeDays.trim();
    if (!tutorName) {
      throw new Error("Choose a tutor who owns this group.");
    }
    if (!collegeDays || parseCollegeDays(collegeDays).length === 0) {
      throw new Error("Choose the college day this group attends.");
    }
    const snap = access.getSnapshot();
    const clash = snap.teachingGroups.find(
      (g) =>
        g.cohortId === input.cohortId &&
        g.tutorName.toLowerCase() === tutorName.toLowerCase() &&
        collegeDaysOverlap(g.collegeDays, collegeDays),
    );
    if (clash) {
      throw new Error(
        `${tutorName} already has “${clash.name}” on ${formatCollegeDaysShort(clash.collegeDays)}. Pick a free day.`,
      );
    }

    const stamp = new Date().toISOString();
    const row: AdminTeachingGroupRecord = {
      id: access.id("tgroup"),
      cohortId: input.cohortId,
      tutorName,
      name: input.name.trim() || "Group",
      collegeDays,
      capacity: Math.max(1, input.capacity ?? DEFAULT_TEACHING_GROUP_CAPACITY),
      notes: (input.notes ?? "").trim(),
      createdAt: stamp,
      updatedAt: stamp,
    };
    access.setSnapshot({
      ...snap,
      teachingGroups: [row, ...snap.teachingGroups],
    });
    access.emit();
    return row;
  }

  async function updateTeachingGroup(
    idValue: string,
    patch: Partial<TeachingGroupInput>,
  ): Promise<AdminTeachingGroupRecord | null> {
    access.ensureHydrated();
    const snap = access.getSnapshot();
    const existing = snap.teachingGroups.find((g) => g.id === idValue);
    if (!existing) return null;
    requireCohortUnlocked(existing.cohortId);
    const next: AdminTeachingGroupRecord = {
      ...existing,
      tutorName: (patch.tutorName ?? existing.tutorName).trim(),
      name: (patch.name ?? existing.name).trim(),
      collegeDays: (patch.collegeDays ?? existing.collegeDays).trim(),
      capacity: Math.max(1, patch.capacity ?? existing.capacity),
      notes: (patch.notes ?? existing.notes).trim(),
      updatedAt: new Date().toISOString(),
    };
    access.setSnapshot({
      ...snap,
      teachingGroups: snap.teachingGroups.map((g) =>
        g.id === idValue ? next : g,
      ),
      enrolments: snap.enrolments.map((e) => {
        if (e.teachingGroupId !== idValue) return e;
        return {
          ...e,
          tutorName: next.tutorName,
          collegeDays: next.collegeDays,
          updatedAt: new Date().toISOString(),
        };
      }),
    });
    access.emit();
    return next;
  }

  async function deleteTeachingGroup(idValue: string): Promise<void> {
    access.ensureHydrated();
    const snap = access.getSnapshot();
    const existingGroup = snap.teachingGroups.find((g) => g.id === idValue);
    if (existingGroup) {
      requireCohortUnlocked(existingGroup.cohortId);
    }
    const attached = snap.enrolments.some((e) => e.teachingGroupId === idValue);
    if (attached) {
      throw new Error(
        "Move or remove apprentices from this group before deleting it.",
      );
    }
    access.setSnapshot({
      ...snap,
      teachingGroups: snap.teachingGroups.filter((g) => g.id !== idValue),
    });
    access.emit();
  }

  return {
    listCohorts,
    listCohortChangeLogs,
    createCohort,
    updateCohort,
    lockCohortWithSessionLog,
    findIntakeCohort,
    setEnrolmentCohort,
    assignEnrolmentToTeachingGroup,
    applyTeachingGroupToEnrolmentPatch,
    listTeachingGroups,
    createTeachingGroup,
    updateTeachingGroup,
    deleteTeachingGroup,
  };
}
