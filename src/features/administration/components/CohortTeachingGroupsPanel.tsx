"use client";

import { useMemo, useState } from "react";
import { ApprenticeStatusChip } from "@/features/apprentice-portal/components/ApprenticePageShell";
import {
  createTeachingGroup,
  deleteTeachingGroup,
  updateTeachingGroup,
  assignEnrolmentToTeachingGroup,
  DEFAULT_TEACHING_GROUP_CAPACITY,
} from "../domain/store";
import type {
  AdminCohortRecord,
  AdminApprenticeEnrolment,
  AdminTeachingGroupRecord,
} from "../domain/types";
import { cohortTeacherList } from "../domain/tutor-options";
import {
  COLLEGE_WEEKDAYS,
  formatCollegeDaysShort,
  parseCollegeDays,
  type CollegeWeekday,
} from "../domain/college-days";
import { Select } from "@/components/ui/Select";
import { CollegeDaysPicker } from "./CollegeDaysPicker";
import { enrolmentKindLabel } from "../domain/enrolment-status";
import styles from "../screens/admin-pages.module.css";

type Props = {
  cohort: AdminCohortRecord;
  groups: AdminTeachingGroupRecord[];
  enrolments: AdminApprenticeEnrolment[];
  /** Same-standard enrolments that can be added to this cohort. */
  candidates: AdminApprenticeEnrolment[];
  locked?: boolean;
  onSessionEdit?: (message: string) => void;
  onError: (message: string | null) => void;
  onSuccess: (message: string | null) => void;
};

function statusTone(
  status: AdminApprenticeEnrolment["status"],
): "green" | "amber" | "neutral" {
  if (status === "active") return "green";
  if (status === "pending_start" || status === "draft") return "amber";
  return "neutral";
}

function apprenticeMeta(apprentice: AdminApprenticeEnrolment, cohortId: string): string {
  const bits = [
    apprentice.employerName || "No employer",
    enrolmentKindLabel(apprentice.startDate, apprentice.kind),
  ];
  if (apprentice.cohortId && apprentice.cohortId !== cohortId) {
    bits.push("on another cohort");
  } else if (apprentice.cohortId === cohortId && !apprentice.teachingGroupId) {
    bits.push("on cohort, no group yet");
  }
  return bits.join(" · ");
}

function nextGroupNumber(existingForTutor: number): number {
  return existingForTutor + 1;
}

/** e.g. Group 1 Monday · Group 2 Wednesday */
function presetGroupName(groupNumber: number, day: CollegeWeekday): string {
  return `Group ${groupNumber} ${day}`;
}

function daysTakenByTutor(
  tutorGroups: AdminTeachingGroupRecord[],
): CollegeWeekday[] {
  const taken = new Set<CollegeWeekday>();
  for (const group of tutorGroups) {
    for (const day of parseCollegeDays(group.collegeDays)) {
      taken.add(day);
    }
  }
  return COLLEGE_WEEKDAYS.filter((day) => taken.has(day));
}

export function CohortTeachingGroupsPanel({
  cohort,
  groups,
  enrolments,
  candidates,
  locked = false,
  onSessionEdit,
  onError,
  onSuccess,
}: Props) {
  const teachers = cohortTeacherList(cohort);
  const cohortGroups = useMemo(
    () =>
      groups
        .filter((g) => g.cohortId === cohort.id)
        .sort((a, b) => {
          const t = a.tutorName.localeCompare(b.tutorName);
          return t !== 0 ? t : a.name.localeCompare(b.name);
        }),
    [groups, cohort.id],
  );

  const [newTutor, setNewTutor] = useState("");
  const [newDay, setNewDay] = useState("");
  const [newCapacity, setNewCapacity] = useState(
    String(DEFAULT_TEACHING_GROUP_CAPACITY),
  );
  const [busy, setBusy] = useState(false);
  const [localStatus, setLocalStatus] = useState<{
    tone: "success" | "error";
    message: string;
  } | null>(null);
  const [editingCapacityId, setEditingCapacityId] = useState<string | null>(null);
  const [capacityDraft, setCapacityDraft] = useState("");
  const [overCapacityPrompt, setOverCapacityPrompt] = useState<{
    enrolment: AdminApprenticeEnrolment;
    teachingGroupId: string;
    message: string;
  } | null>(null);

  const onCohort = enrolments.filter((e) => e.cohortId === cohort.id);
  const addable = candidates.filter((e) => e.cohortId !== cohort.id);

  const groupsForSelectedTutor = useMemo(
    () =>
      cohortGroups.filter(
        (g) =>
          g.tutorName.toLowerCase() === newTutor.trim().toLowerCase(),
      ),
    [cohortGroups, newTutor],
  );
  const takenDays = useMemo(
    () => daysTakenByTutor(groupsForSelectedTutor),
    [groupsForSelectedTutor],
  );
  const freeDays = COLLEGE_WEEKDAYS.filter((day) => !takenDays.includes(day));
  const selectedDay = parseCollegeDays(newDay)[0] ?? null;
  const groupNumber = nextGroupNumber(groupsForSelectedTutor.length);
  const presetName = selectedDay
    ? presetGroupName(groupNumber, selectedDay)
    : `Group ${groupNumber} (pick a day)`;

  function chooseTutor(tutor: string) {
    setNewTutor(tutor);
    setNewDay("");
    setEditingCapacityId(null);
    setLocalStatus(null);
  }

  async function addGroup() {
    if (locked) {
      onError("Unlock this cohort before adding groups.");
      return;
    }
    if (!newTutor.trim()) {
      onError("1. Choose the tutor who owns this group.");
      return;
    }
    if (!selectedDay) {
      onError("2. Choose the college day this group attends.");
      return;
    }
    if (takenDays.includes(selectedDay)) {
      onError(
        `${newTutor} already teaches a group on ${selectedDay}. Pick another day.`,
      );
      return;
    }

    const name = presetGroupName(groupNumber, selectedDay);
    const capacity = Math.max(
      1,
      Number(newCapacity) || DEFAULT_TEACHING_GROUP_CAPACITY,
    );
    const summary = `${newTutor.trim()} · ${name} · capacity ${capacity}`;

    try {
      setBusy(true);
      setLocalStatus(null);
      onError(null);
      await createTeachingGroup({
        cohortId: cohort.id,
        tutorName: newTutor.trim(),
        name,
        collegeDays: selectedDay,
        capacity,
      });
      const remaining = freeDays.filter((day) => day !== selectedDay);
      const message =
        remaining.length === 0
          ? `Saved ${summary}. ${newTutor.trim()} now has a group on every weekday — pick another tutor to add more.`
          : `Saved ${summary}. Add another day for this tutor if needed.`;
      setLocalStatus({ tone: "success", message });
      onSuccess(message);
      onSessionEdit?.(`Added group ${name} for ${newTutor.trim()} (capacity ${capacity})`);
      setNewDay("");
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Unable to create group";
      setLocalStatus({ tone: "error", message });
      onError(message);
    } finally {
      setBusy(false);
    }
  }

  async function placeApprentice(
    enrolment: AdminApprenticeEnrolment,
    teachingGroupId: string,
    allowOverCapacity = false,
  ) {
    if (locked) {
      onError("Unlock this cohort before placing apprentices.");
      return;
    }
    try {
      setBusy(true);
      onError(null);
      await assignEnrolmentToTeachingGroup(enrolment.id, teachingGroupId, {
        allowOverCapacity,
      });
      const group = groups.find((g) => g.id === teachingGroupId);
      const message = `${enrolment.displayName} → ${group?.tutorName ?? "tutor"} · ${group?.name ?? "group"}`;
      onSuccess(message);
      onSessionEdit?.(
        `Placed ${enrolment.displayName} into ${group?.name ?? "group"}${allowOverCapacity ? " (over capacity)" : ""}`,
      );
      setOverCapacityPrompt(null);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Unable to assign apprentice";
      if (/full/i.test(message) && !allowOverCapacity) {
        setOverCapacityPrompt({ enrolment, teachingGroupId, message });
        onError(`${message} Confirm below to add over capacity.`);
        return;
      }
      onError(message);
    } finally {
      setBusy(false);
    }
  }

  async function removeFromGroup(enrolment: AdminApprenticeEnrolment) {
    if (locked) {
      onError("Unlock this cohort before removing apprentices.");
      return;
    }
    try {
      setBusy(true);
      onError(null);
      await assignEnrolmentToTeachingGroup(enrolment.id, null);
      onSuccess(`${enrolment.displayName} removed from teaching group.`);
      onSessionEdit?.(`Removed ${enrolment.displayName} from teaching group`);
    } catch (err) {
      onError(err instanceof Error ? err.message : "Unable to remove");
    } finally {
      setBusy(false);
    }
  }

  async function saveCapacity(group: AdminTeachingGroupRecord) {
    if (locked) {
      onError("Unlock this cohort before editing capacity.");
      return;
    }
    const capacity = Math.max(1, Number(capacityDraft) || group.capacity);
    try {
      setBusy(true);
      setLocalStatus(null);
      onError(null);
      await updateTeachingGroup(group.id, { capacity });
      const message = `Capacity for ${group.name} set to ${capacity}.`;
      setLocalStatus({ tone: "success", message });
      onSuccess(message);
      onSessionEdit?.(`Capacity for ${group.name} set to ${capacity}`);
      setEditingCapacityId(null);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Unable to update capacity";
      setLocalStatus({ tone: "error", message });
      onError(message);
    } finally {
      setBusy(false);
    }
  }

  async function deleteGroup(group: AdminTeachingGroupRecord) {
    if (locked) {
      onError("Unlock this cohort before deleting groups.");
      return;
    }
    try {
      setBusy(true);
      setLocalStatus(null);
      onError(null);
      await deleteTeachingGroup(group.id);
      const message = `Deleted ${group.name}.`;
      setLocalStatus({ tone: "success", message });
      onSuccess(message);
      onSessionEdit?.(`Deleted group ${group.name}`);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Unable to delete";
      setLocalStatus({ tone: "error", message });
      onError(message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={styles.stack}>
      <div className={styles.formGroupHead}>
        <h3 className={styles.formGroupTitle}>Teaching groups</h3>
        <span className={styles.formGroupBadge}>
          {newTutor
            ? `${groupsForSelectedTutor.length} for ${newTutor}`
            : `${cohortGroups.length} group${cohortGroups.length === 1 ? "" : "s"}`}
        </span>
      </div>
      <p className={styles.formGroupMeta}>
        {locked
          ? "Cohort is locked — groups and placements are read-only until you unlock."
          : "Choose a tutor to view and manage their groups. Name is set for you (e.g. Group 1 Monday). One group per tutor per day."}
      </p>

      {teachers.length === 0 ? (
        <p className={styles.fieldHint}>
          Add teachers to this cohort above before creating groups.
        </p>
      ) : (
        <div className={styles.formGrid}>
          <label className={styles.field}>
            <span>{locked ? "Tutor" : "1. Tutor (group owner)"}</span>
            <Select
              value={newTutor}
              options={teachers.map((name) => ({ value: name, label: name }))}
              onChange={chooseTutor}
              placeholder="Choose tutor…"
              aria-label="Tutor who owns this group"
            />
          </label>
          {locked || !newTutor.trim() ? null : (
            <>
              <label className={`${styles.field} ${styles.fieldWide}`}>
                <span>2. College day</span>
                <CollegeDaysPicker
                  mode="single"
                  value={newDay}
                  onChange={setNewDay}
                  disabledDays={takenDays}
                  aria-label="College day for this group"
                />
                <span className={styles.fieldHint}>
                  {takenDays.length === 0
                    ? "Pick the day this group attends college. Used days for this tutor stay locked."
                    : freeDays.length === 0
                      ? `${newTutor} already has a group on Mon–Fri. Choose another tutor, or delete a group first.`
                      : `${newTutor} already has: ${takenDays
                          .map((d) => d.slice(0, 3))
                          .join(", ")}. Free: ${freeDays
                          .map((d) => d.slice(0, 3))
                          .join(", ")}.`}
                </span>
              </label>
              <label className={styles.field}>
                <span>Group name (auto)</span>
                <input
                  className={styles.detailFieldInput}
                  value={presetName}
                  readOnly
                />
                <span className={styles.fieldHint}>
                  Built from group number + day for this tutor.
                </span>
              </label>
              <label className={styles.field}>
                <span>3. Capacity</span>
                <input
                  className={styles.detailFieldInput}
                  type="number"
                  min={1}
                  value={newCapacity}
                  onChange={(e) => setNewCapacity(e.target.value)}
                />
              </label>
              <div className={styles.formActions}>
                <button
                  type="button"
                  className={styles.primaryBtn}
                  disabled={busy || freeDays.length === 0 || !selectedDay}
                  onClick={() => void addGroup()}
                >
                  {busy ? "Saving…" : "Save group"}
                </button>
              </div>
              {localStatus ? (
                <p
                  className={
                    localStatus.tone === "success" ? styles.success : styles.error
                  }
                  style={{ gridColumn: "1 / -1" }}
                >
                  {localStatus.message}
                </p>
              ) : null}
            </>
          )}
          {!locked && !newTutor.trim() ? (
            <p className={styles.fieldHint} style={{ gridColumn: "1 / -1" }}>
              Choose a tutor first, then pick the college day and capacity.
            </p>
          ) : null}
        </div>
      )}

      {!newTutor ? (
        <p className={styles.empty}>
          Choose a tutor above to view their groups
          {locked ? "" : " or create a new one"}.
        </p>
      ) : groupsForSelectedTutor.length === 0 ? (
        <p className={styles.empty}>
          {cohortGroups.length === 0
            ? "No teaching groups yet."
            : `${newTutor} has no groups on this cohort yet.`}
        </p>
      ) : (
        <section className={styles.formGroup}>
          <div className={styles.formGroupHead}>
            <h4 className={styles.formGroupTitle}>{newTutor}</h4>
            <span className={styles.formGroupBadge}>
              {groupsForSelectedTutor.length} group
              {groupsForSelectedTutor.length === 1 ? "" : "s"}
            </span>
          </div>
          <ul className={styles.linkedApprenticeList}>
            {groupsForSelectedTutor.map((group) => {
              const members = onCohort.filter(
                (e) => e.teachingGroupId === group.id,
              );
              const full = members.length >= group.capacity;
              return (
                <li key={group.id}>
                  <div className={styles.linkedApprenticeRow}>
                    <div className={styles.linkedApprenticeMain}>
                      <strong>
                        {group.name}
                        {group.collegeDays
                          ? ` · College ${formatCollegeDaysShort(group.collegeDays)}`
                          : ""}
                      </strong>
                      <span>
                        {members.length}/{group.capacity} apprentices
                        {full ? " · full" : ""}
                      </span>
                    </div>
                    <div className={styles.formActions}>
                      {locked ? null : editingCapacityId === group.id ? (
                        <div className={styles.capacityEdit}>
                          <label className={styles.capacityEditField}>
                            <span>Capacity</span>
                            <input
                              className={styles.capacityEditInput}
                              type="number"
                              min={1}
                              inputMode="numeric"
                              value={capacityDraft}
                              onChange={(e) => setCapacityDraft(e.target.value)}
                              disabled={busy}
                              aria-label={`Capacity for ${group.name}`}
                            />
                          </label>
                          <button
                            type="button"
                            className={styles.primaryBtn}
                            disabled={busy}
                            onClick={() => void saveCapacity(group)}
                          >
                            Save
                          </button>
                          <button
                            type="button"
                            className={styles.secondaryBtn}
                            disabled={busy}
                            onClick={() => setEditingCapacityId(null)}
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <>
                          <button
                            type="button"
                            className={styles.secondaryBtn}
                            disabled={busy}
                            onClick={() => {
                              setEditingCapacityId(group.id);
                              setCapacityDraft(String(group.capacity));
                            }}
                          >
                            Edit capacity
                          </button>
                          <button
                            type="button"
                            className={styles.secondaryBtn}
                            disabled={busy || members.length > 0}
                            title={
                              members.length
                                ? "Move apprentices out before deleting"
                                : "Delete group"
                            }
                            onClick={() => void deleteGroup(group)}
                          >
                            Delete
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                  {members.length > 0 ? (
                    <ul className={styles.linkedApprenticeList}>
                      {members.map((m) => (
                        <li key={m.id}>
                          <div className={styles.linkedApprenticeRow}>
                            <div className={styles.linkedApprenticeMain}>
                              <strong>{m.displayName}</strong>
                              <span>{apprenticeMeta(m, cohort.id)}</span>
                            </div>
                            <div className={styles.linkedApprenticeAside}>
                              <ApprenticeStatusChip tone={statusTone(m.status)}>
                                {m.status.replace(/_/g, " ")}
                              </ApprenticeStatusChip>
                              {locked ? null : (
                                <button
                                  type="button"
                                  className={styles.secondaryBtn}
                                  disabled={busy}
                                  onClick={() => void removeFromGroup(m)}
                                >
                                  Remove
                                </button>
                              )}
                            </div>
                          </div>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <div className={styles.formGroupHead}>
        <h3 className={styles.formGroupTitle}>Place apprentices into groups</h3>
      </div>
      <p className={styles.formGroupMeta}>
        {locked
          ? "Unlock the cohort to place or move apprentices."
          : "Choosing a group sets the tutor and college days from that group."}
      </p>
      {locked ? null : overCapacityPrompt ? (
        <div className={styles.formActions}>
          <p className={styles.fieldHint}>{overCapacityPrompt.message}</p>
          <button
            type="button"
            className={styles.primaryBtn}
            disabled={busy}
            onClick={() =>
              void placeApprentice(
                overCapacityPrompt.enrolment,
                overCapacityPrompt.teachingGroupId,
                true,
              )
            }
          >
            Add over capacity
          </button>
          <button
            type="button"
            className={styles.secondaryBtn}
            disabled={busy}
            onClick={() => {
              setOverCapacityPrompt(null);
              onError(null);
            }}
          >
            Cancel
          </button>
        </div>
      ) : null}
      {locked ? null : addable.length === 0 &&
        onCohort.filter((e) => !e.teachingGroupId).length === 0 ? (
        <p className={styles.empty}>
          No {cohort.standardCode} apprentices waiting to place.
        </p>
      ) : locked ? null : (
        <ul className={styles.linkedApprenticeList}>
          {[
            ...onCohort.filter((e) => !e.teachingGroupId),
            ...addable,
          ].map((apprentice) => (
            <li key={apprentice.id}>
              <div className={styles.linkedApprenticeRow}>
                <div className={styles.linkedApprenticeMain}>
                  <strong>{apprentice.displayName}</strong>
                  <span>{apprenticeMeta(apprentice, cohort.id)}</span>
                </div>
                <div className={styles.linkedApprenticeAside}>
                  <ApprenticeStatusChip tone={statusTone(apprentice.status)}>
                    {apprentice.status.replace(/_/g, " ")}
                  </ApprenticeStatusChip>
                  <Select
                    value=""
                    placeholder="Choose group…"
                    aria-label={`Teaching group for ${apprentice.displayName}`}
                    disabled={busy || cohortGroups.length === 0}
                    options={cohortGroups.map((g) => {
                      const n = onCohort.filter(
                        (e) => e.teachingGroupId === g.id,
                      ).length;
                      return {
                        value: g.id,
                        label: `${g.tutorName} · ${g.name}${
                          g.collegeDays
                            ? ` · ${formatCollegeDaysShort(g.collegeDays)}`
                            : ""
                        } · ${n}/${g.capacity}`,
                      };
                    })}
                    onChange={(id) => {
                      if (!id) return;
                      void placeApprentice(apprentice, id);
                    }}
                  />
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
