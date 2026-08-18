"use client";

import { useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import {
  ApprenticePageShell,
  ApprenticeStatusChip,
} from "@/features/apprentice-portal/components/ApprenticePageShell";
import { Select } from "@/components/ui/Select";
import {
  createTeachingGroup,
  deleteTeachingGroup,
  updateTeachingGroup,
  assignEnrolmentToTeachingGroup,
  DEFAULT_TEACHING_GROUP_CAPACITY,
} from "../domain/store";
import {
  formatGtaProgrammeVersionLabel,
} from "../domain/gta-programme-version-options";
import {
  formatTeachingGroupOptionLabel,
  currentMemberCount,
} from "../domain/teaching-group-placement";
import { listTutorStaff } from "../domain/tutor-options";
import { formatCollegeDaysShort } from "../domain/college-days";
import { CollegeDaysPicker } from "../components/CollegeDaysPicker";
import type {
  AdminGtaProgrammeVersionOption,
  AdminTeachingGroupRecord,
} from "../domain/types";
import { useAdminStore } from "../hooks/useAdminStore";
import styles from "./admin-pages.module.css";

type FormState = {
  name: string;
  gtaProgrammeVersionId: string;
  tutorUserId: string;
  collegeDays: string;
  capacity: string;
  status: "active" | "inactive";
  notes: string;
};

type StatusFilter = "all" | "active" | "inactive" | "review";

function emptyForm(): FormState {
  return {
    name: "",
    gtaProgrammeVersionId: "",
    tutorUserId: "",
    collegeDays: "",
    capacity: String(DEFAULT_TEACHING_GROUP_CAPACITY),
    status: "active",
    notes: "",
  };
}

function formFromGroup(
  group: AdminTeachingGroupRecord,
  users: { id: string; displayName: string }[],
): FormState {
  const tutor = users.find(
    (row) =>
      row.displayName.toLowerCase() === group.tutorName.trim().toLowerCase(),
  );
  return {
    name: group.name,
    gtaProgrammeVersionId: group.gtaProgrammeVersionId ?? "",
    tutorUserId: tutor?.id ?? "",
    collegeDays: group.collegeDays,
    capacity: String(group.capacity),
    status: group.status,
    notes: group.notes,
  };
}

export function AdminTeachingGroupsScreen() {
  const store = useAdminStore();
  const pathname = usePathname();
  const cohortsHref = pathname.includes("/management/")
    ? "/management/cohorts"
    : "/administration/cohorts";
  const tutors = listTutorStaff(store.users);
  const versions = store.gtaProgrammeVersions ?? [];
  const publishedVersions = versions.filter((row) => row.status === "published");
  const programmes = store.programmes;

  const [query, setQuery] = useState("");
  const [programmeFilter, setProgrammeFilter] = useState("");
  const [versionFilter, setVersionFilter] = useState("");
  const [tutorFilter, setTutorFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(() => emptyForm());
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const filteredVersions = useMemo(() => {
    if (!programmeFilter) return publishedVersions;
    const programme = programmes.find((row) => row.id === programmeFilter);
    if (!programme) return publishedVersions;
    return publishedVersions.filter(
      (row) =>
        row.programmeId === programme.id ||
        row.standardCode.toUpperCase() === programme.standardCode.toUpperCase(),
    );
  }, [publishedVersions, programmeFilter, programmes]);

  const groups = useMemo(() => {
    const q = query.trim().toLowerCase();
    return [...(store.teachingGroups ?? [])]
      .filter((group) => {
        if (statusFilter === "active" && group.status !== "active") return false;
        if (statusFilter === "inactive" && group.status !== "inactive") return false;
        if (statusFilter === "review" && !group.versionReviewRequired) return false;
        if (tutorFilter && group.tutorName !== tutorFilter) return false;
        if (versionFilter && group.gtaProgrammeVersionId !== versionFilter) {
          return false;
        }
        if (programmeFilter) {
          const programme = programmes.find((row) => row.id === programmeFilter);
          const version = versions.find(
            (row) => row.id === group.gtaProgrammeVersionId,
          );
          if (programme && version) {
            if (
              version.programmeId !== programme.id &&
              version.standardCode.toUpperCase() !==
                programme.standardCode.toUpperCase()
            ) {
              return false;
            }
          } else if (programme) {
            return false;
          }
        }
        if (!q) return true;
        const version = versions.find(
          (row) => row.id === group.gtaProgrammeVersionId,
        );
        return (
          group.name.toLowerCase().includes(q) ||
          group.tutorName.toLowerCase().includes(q) ||
          (version?.programmeTitle.toLowerCase().includes(q) ?? false)
        );
      })
      .sort((a, b) => {
        const tutor = a.tutorName.localeCompare(b.tutorName);
        return tutor !== 0 ? tutor : a.name.localeCompare(b.name);
      });
  }, [
    store.teachingGroups,
    query,
    statusFilter,
    tutorFilter,
    versionFilter,
    programmeFilter,
    programmes,
    versions,
  ]);

  function versionLabel(version: AdminGtaProgrammeVersionOption): string {
    return formatGtaProgrammeVersionLabel(version);
  }

  function openCreate() {
    setEditingId(null);
    setForm(emptyForm());
    setShowForm(true);
    setError(null);
    setSuccess(null);
  }

  function openEdit(group: AdminTeachingGroupRecord) {
    setEditingId(group.id);
    setForm(formFromGroup(group, tutors));
    setShowForm(true);
    setError(null);
    setSuccess(null);
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const tutor = tutors.find((row) => row.id === form.tutorUserId);
    if (!form.gtaProgrammeVersionId) {
      setError("Choose the GTA Programme Version this group delivers.");
      return;
    }
    if (!tutor) {
      setError("Choose a tutor who owns this group.");
      return;
    }
    if (!form.name.trim()) {
      setError("Enter a teaching group name.");
      return;
    }
    if (!form.collegeDays.trim()) {
      setError("Choose the college day this group attends.");
      return;
    }
    try {
      setBusy(true);
      setError(null);
      const input = {
        gtaProgrammeVersionId: form.gtaProgrammeVersionId,
        tutorName: tutor.displayName,
        tutorUserId: tutor.id,
        tutorEmail: tutor.email,
        name: form.name.trim(),
        collegeDays: form.collegeDays,
        capacity: Math.max(
          1,
          Number(form.capacity) || DEFAULT_TEACHING_GROUP_CAPACITY,
        ),
        status: form.status,
        notes: form.notes,
      };
      if (editingId) {
        await updateTeachingGroup(editingId, input);
        setSuccess(`Updated ${input.name}.`);
        setExpandedId(editingId);
      } else {
        const created = await createTeachingGroup(input);
        setSuccess(`Created ${created.name}.`);
        setExpandedId(created.id);
      }
      setShowForm(false);
      setEditingId(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to save teaching group.");
    } finally {
      setBusy(false);
    }
  }

  async function setInactive(group: AdminTeachingGroupRecord) {
    try {
      setBusy(true);
      await updateTeachingGroup(group.id, { status: "inactive" });
      setSuccess(`${group.name} is now inactive. Historic memberships are kept.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to update group.");
    } finally {
      setBusy(false);
    }
  }

  async function removeGroup(group: AdminTeachingGroupRecord) {
    try {
      setBusy(true);
      await deleteTeachingGroup(group.id);
      setSuccess(`Deleted ${group.name}.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to delete group.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <ApprenticePageShell
      eyebrow="Administration"
      title="Teaching Groups"
      description="Independent tutor-led classes pinned to a GTA Programme Version. Learners from different intakes can share a group when their programme version matches."
      actions={
        <button type="button" className={styles.primaryBtn} onClick={openCreate}>
          Add teaching group
        </button>
      }
    >
      <div className={styles.stack}>
        {success ? <p className={styles.success}>{success}</p> : null}
        {error && !showForm ? <p className={styles.error}>{error}</p> : null}
        <p className={styles.formGroupMeta}>
          Intakes are managed on{" "}
          <a href={cohortsHref}>Cohorts</a>. This screen does not own a cohort
          and does not set current Block or Session yet.
        </p>

        {showForm ? (
          <form className={styles.formStack} onSubmit={(event) => void submit(event)}>
            <section className={styles.formGroup}>
              <div className={styles.formGroupHead}>
                <h2 className={styles.formGroupTitle}>
                  {editingId ? "Edit teaching group" : "Add teaching group"}
                </h2>
              </div>
              <div className={styles.formGrid}>
                <label className={styles.field}>
                  <span>
                    GTA Programme Version{" "}
                    <em className={styles.fieldRequired}>required</em>
                  </span>
                  <Select
                    value={form.gtaProgrammeVersionId}
                    placeholder="Choose programme version…"
                    options={[
                      { value: "", label: "Choose programme version…" },
                      ...filteredVersions.map((version) => ({
                        value: version.id,
                        label: versionLabel(version),
                      })),
                    ]}
                    onChange={(gtaProgrammeVersionId) =>
                      setForm((prev) => ({ ...prev, gtaProgrammeVersionId }))
                    }
                  />
                </label>
                <label className={styles.field}>
                  <span>
                    Group name <em className={styles.fieldRequired}>required</em>
                  </span>
                  <input
                    value={form.name}
                    onChange={(e) =>
                      setForm((prev) => ({ ...prev, name: e.target.value }))
                    }
                    required
                    placeholder="e.g. Monday Autocare Group"
                  />
                </label>
                <label className={styles.field}>
                  <span>
                    Tutor <em className={styles.fieldRequired}>required</em>
                  </span>
                  <Select
                    value={form.tutorUserId}
                    placeholder="Choose tutor…"
                    options={[
                      { value: "", label: "Choose tutor…" },
                      ...tutors.map((tutor) => ({
                        value: tutor.id,
                        label: tutor.displayName,
                      })),
                    ]}
                    onChange={(tutorUserId) =>
                      setForm((prev) => ({ ...prev, tutorUserId }))
                    }
                  />
                </label>
                <label className={`${styles.field} ${styles.fieldWide}`}>
                  <span>
                    College day(s){" "}
                    <em className={styles.fieldRequired}>required</em>
                  </span>
                  <CollegeDaysPicker
                    value={form.collegeDays}
                    onChange={(collegeDays) =>
                      setForm((prev) => ({ ...prev, collegeDays }))
                    }
                  />
                </label>
                <label className={styles.field}>
                  <span>Capacity</span>
                  <input
                    type="number"
                    min={1}
                    value={form.capacity}
                    onChange={(e) =>
                      setForm((prev) => ({ ...prev, capacity: e.target.value }))
                    }
                  />
                </label>
                <label className={styles.field}>
                  <span>Status</span>
                  <Select
                    value={form.status}
                    options={[
                      { value: "active", label: "Active" },
                      { value: "inactive", label: "Inactive" },
                    ]}
                    onChange={(status) =>
                      setForm((prev) => ({
                        ...prev,
                        status: status as FormState["status"],
                      }))
                    }
                  />
                </label>
                <label className={`${styles.field} ${styles.fieldWide}`}>
                  <span>Notes</span>
                  <textarea
                    value={form.notes}
                    onChange={(e) =>
                      setForm((prev) => ({ ...prev, notes: e.target.value }))
                    }
                    rows={3}
                  />
                </label>
              </div>
              {error ? <p className={styles.error}>{error}</p> : null}
              <div className={styles.formActions}>
                <button
                  type="submit"
                  className={styles.primaryBtn}
                  disabled={busy}
                >
                  {busy ? "Saving…" : editingId ? "Save group" : "Create group"}
                </button>
                <button
                  type="button"
                  className={styles.secondaryBtn}
                  onClick={() => {
                    setShowForm(false);
                    setEditingId(null);
                    setError(null);
                  }}
                >
                  Cancel
                </button>
              </div>
            </section>
          </form>
        ) : null}

        <div className={styles.toolbar}>
          <input
            className={styles.detailFieldInput}
            value={query}
            placeholder="Search by group, tutor or programme…"
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <div className={styles.formGrid}>
          <label className={styles.field}>
            <span>Programme</span>
            <Select
              value={programmeFilter}
              options={[
                { value: "", label: "All programmes" },
                ...programmes.map((row) => ({
                  value: row.id,
                  label: `${row.name} (${row.standardCode})`,
                })),
              ]}
              onChange={setProgrammeFilter}
            />
          </label>
          <label className={styles.field}>
            <span>GTA Programme Version</span>
            <Select
              value={versionFilter}
              options={[
                { value: "", label: "All versions" },
                ...versions.map((row) => ({
                  value: row.id,
                  label: versionLabel(row),
                })),
              ]}
              onChange={setVersionFilter}
            />
          </label>
          <label className={styles.field}>
            <span>Tutor</span>
            <Select
              value={tutorFilter}
              options={[
                { value: "", label: "All tutors" },
                ...tutors.map((row) => ({
                  value: row.displayName,
                  label: row.displayName,
                })),
              ]}
              onChange={setTutorFilter}
            />
          </label>
          <label className={styles.field}>
            <span>Status</span>
            <Select
              value={statusFilter}
              options={[
                { value: "all", label: "All" },
                { value: "active", label: "Active" },
                { value: "inactive", label: "Inactive" },
                { value: "review", label: "Programme version required" },
              ]}
              onChange={(value) => setStatusFilter(value as StatusFilter)}
            />
          </label>
        </div>

        {groups.length === 0 ? (
          <p className={styles.empty}>No teaching groups match these filters.</p>
        ) : (
          groups.map((group) => {
            const count = currentMemberCount(store.enrolments, group.id);
            const version = versions.find(
              (row) => row.id === group.gtaProgrammeVersionId,
            );
            const open = expandedId === group.id;
            const members = store.enrolments.filter(
              (row) => row.teachingGroupId === group.id,
            );
            return (
              <article
                key={group.id}
                className={styles.employerCard}
                data-open={open ? "true" : "false"}
              >
                <div className={styles.employerCardHeader}>
                  <button
                    type="button"
                    className={styles.employerCardMain}
                    onClick={() => setExpandedId(open ? null : group.id)}
                  >
                    <strong className={styles.employerName}>{group.name}</strong>
                    <span>
                      {group.tutorName}
                      {group.collegeDays
                        ? ` · ${formatCollegeDaysShort(group.collegeDays)}`
                        : ""}
                      {` · ${count}/${group.capacity}`}
                    </span>
                    <span>
                      {version
                        ? formatGtaProgrammeVersionLabel(version)
                        : group.versionReviewRequired
                          ? "Programme version required"
                          : "No GTA Programme Version"}
                    </span>
                  </button>
                  <div className={styles.employerPillColumn}>
                    <ApprenticeStatusChip
                      tone={group.status === "active" ? "green" : "neutral"}
                    >
                      {group.status}
                    </ApprenticeStatusChip>
                    {group.versionReviewRequired ? (
                      <ApprenticeStatusChip tone="amber">
                        Version required
                      </ApprenticeStatusChip>
                    ) : null}
                  </div>
                </div>
                {open ? (
                  <div className={styles.employerCardBody}>
                    <p className={styles.formGroupMeta}>
                      {formatTeachingGroupOptionLabel(group, count)}
                    </p>
                    <div className={styles.formActions}>
                      <button
                        type="button"
                        className={styles.secondaryBtn}
                        onClick={() => openEdit(group)}
                      >
                        Edit
                      </button>
                      {group.status === "active" ? (
                        <button
                          type="button"
                          className={styles.secondaryBtn}
                          disabled={busy}
                          onClick={() => void setInactive(group)}
                        >
                          Set inactive
                        </button>
                      ) : null}
                      <button
                        type="button"
                        className={styles.secondaryBtn}
                        disabled={busy}
                        onClick={() => void removeGroup(group)}
                      >
                        Delete
                      </button>
                    </div>
                    {members.length === 0 ? (
                      <p className={styles.empty}>No current apprentices.</p>
                    ) : (
                      <ul className={styles.linkedApprenticeList}>
                        {members.map((member) => (
                          <li key={member.id}>
                            <div className={styles.linkedApprenticeRow}>
                              <div className={styles.linkedApprenticeMain}>
                                <strong>{member.displayName}</strong>
                                <span>
                                  {member.programmeName}
                                  {member.cohortId
                                    ? ` · intake ${store.cohorts.find((c) => c.id === member.cohortId)?.name ?? ""}`
                                    : ""}
                                </span>
                              </div>
                              <button
                                type="button"
                                className={styles.secondaryBtn}
                                onClick={() =>
                                  void assignEnrolmentToTeachingGroup(
                                    member.id,
                                    null,
                                  )
                                }
                              >
                                Remove
                              </button>
                            </div>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                ) : null}
              </article>
            );
          })
        )}
      </div>
    </ApprenticePageShell>
  );
}
