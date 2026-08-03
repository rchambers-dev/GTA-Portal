"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import { FormField } from "@/components/ui/FormField";
import { Select } from "@/components/ui/Select";
import { TextInput } from "@/components/ui/TextInput";
import {
  ApprenticePageShell,
  ApprenticeStatusChip,
} from "@/features/apprentice-portal/components/ApprenticePageShell";
import { usePortalSession } from "@/shell/demo/PortalSessionProvider";
import {
  assignableRoles,
  canManagePortalAccount,
  sessionPortalRole,
  workspaceForRole,
} from "../domain/account-access";
import {
  createUser,
  setPortalEnvironment,
  updateStaffProfile,
} from "../domain/store";
import { gtaWorkEmail } from "../domain/seed";
import type { AdminPortalRole, AdminPortalUser } from "../domain/types";
import { useAdminStore } from "../hooks/useAdminStore";
import {
  exclusiveTitleHolders,
  formatJobTitles,
  isExclusiveStaffJobTitle,
  normalizeJobTitles,
  STAFF_JOB_TITLE_SECTIONS,
} from "../domain/staff-job-titles";
import styles from "./admin-pages.module.css";

type StaffForm = {
  firstName: string;
  lastName: string;
  email: string;
  role: AdminPortalRole | "";
};

function emptyForm(): StaffForm {
  return { firstName: "", lastName: "", email: "", role: "" };
}

function isStaffAccount(row: AdminPortalUser): boolean {
  return row.role !== "Apprentice" && row.role !== "Employer";
}

function displayName(form: StaffForm): string {
  return [form.firstName, form.lastName]
    .map((part) => part.trim())
    .filter(Boolean)
    .join(" ");
}

function statusTone(
  status: AdminPortalUser["status"],
): "green" | "amber" | "neutral" {
  if (status === "active") return "green";
  if (status === "invited") return "amber";
  return "neutral";
}

function uniqueRoles(
  current: AdminPortalRole,
  options: AdminPortalRole[],
): AdminPortalRole[] {
  if (options.includes(current)) return options;
  return [current, ...options];
}

type StaffGroupFilter = "all" | "management" | "tutors" | "administrators";

const STAFF_GROUP_FILTERS: Array<{
  id: StaffGroupFilter;
  label: string;
  match: (role: string) => boolean;
}> = [
  { id: "all", label: "All staff", match: () => true },
  {
    id: "management",
    label: "Management",
    match: (role) => role === "Management",
  },
  {
    id: "tutors",
    label: "Tutors",
    match: (role) =>
      role === "Tutor" || role === "Learning and Progress Mentor",
  },
  {
    id: "administrators",
    label: "Administrators",
    match: (role) => role === "Administrator" || role === "Quality",
  },
];

type Props = {
  eyebrow?: string;
};

/** Temp-portal staff directory: add people, create logins, set role, enable. */
export function AdminStaffScreen({ eyebrow = "Administration" }: Props) {
  const store = useAdminStore();
  const { session } = usePortalSession();
  const actorRole = sessionPortalRole(session?.account);
  const actorName = session?.account?.name?.trim() || "Administrator";
  const actorEmail = session?.account?.email?.trim().toLowerCase() || "";

  const [groupFilter, setGroupFilter] = useState<StaffGroupFilter>("all");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [draftTitles, setDraftTitles] = useState<string[]>([]);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState<StaffForm>(() => emptyForm());
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  /** Signed-in staff should show as enabled in this directory. */
  useEffect(() => {
    if (!actorEmail) return;
    const self = store.users.find(
      (u) =>
        isStaffAccount(u) &&
        u.email.trim().toLowerCase() === actorEmail &&
        u.status !== "active",
    );
    if (!self) return;
    void setPortalEnvironment(self.id, "active", actorName);
  }, [actorEmail, actorName, store.users]);

  const roleOptions = useMemo(
    () =>
      assignableRoles(actorRole).filter(
        (role) => role === "Tutor" || role === "Administrator",
      ),
    [actorRole],
  );

  const allStaff = useMemo(
    () => store.users.filter(isStaffAccount),
    [store.users],
  );

  const heldExclusive = useMemo(
    () => exclusiveTitleHolders(allStaff),
    [allStaff],
  );

  const groupCounts = useMemo(() => {
    const counts = {} as Record<StaffGroupFilter, number>;
    for (const group of STAFF_GROUP_FILTERS) {
      counts[group.id] =
        group.id === "all"
          ? allStaff.length
          : allStaff.filter((row) => group.match(row.role)).length;
    }
    return counts;
  }, [allStaff]);

  const staff = useMemo(() => {
    const group =
      STAFF_GROUP_FILTERS.find((item) => item.id === groupFilter) ??
      STAFF_GROUP_FILTERS[0];
    return allStaff
      .filter((row) => group.match(row.role))
      .sort((a, b) => a.displayName.localeCompare(b.displayName));
  }, [allStaff, groupFilter]);

  async function addStaff() {
    const name = displayName(form);
    if (!form.firstName.trim() || !form.lastName.trim()) {
      setError("Enter first and last name.");
      return;
    }
    const workEmail = (form.email.trim() || gtaWorkEmail(name)).toLowerCase();
    if (store.users.some((u) => u.email.trim().toLowerCase() === workEmail)) {
      setError("An account with that email already exists.");
      return;
    }
    const role: AdminPortalRole = form.role || "Tutor";
    try {
      setBusyId("create");
      await createUser({
        displayName: name,
        email: workEmail,
        role,
        workspace: workspaceForRole(role),
        jobTitles: [],
        linkedEnrolmentId: null,
        linkedApprenticeId: null,
        linkedEmployerId: null,
        programmeStartDate: null,
        status: "invited",
      });
      setSuccess(
        form.role
          ? `${name} added as ${role} (${workEmail}) — enable their login when ready.`
          : `${name} added as Tutor (${workEmail}) — set their role below, then enable.`,
      );
      setError(null);
      setForm(emptyForm());
      setCreating(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to add staff.");
    } finally {
      setBusyId(null);
    }
  }

  async function toggleEnable(row: AdminPortalUser) {
    const next = row.status === "active" ? "disabled" : "active";
    try {
      setBusyId(row.id);
      await setPortalEnvironment(row.id, next, actorName);
      setSuccess(
        next === "active"
          ? `Enabled login for ${row.displayName}.`
          : `Disabled login for ${row.displayName}.`,
      );
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to update login.");
    } finally {
      setBusyId(null);
    }
  }

  async function changeRole(row: AdminPortalUser, role: AdminPortalRole) {
    if (!canManagePortalAccount(actorRole, role)) {
      setError("You can only assign roles below your own.");
      return;
    }
    try {
      setBusyId(row.id);
      await updateStaffProfile(row.id, {
        role,
        workspace: workspaceForRole(role),
      });
      setSuccess(`${row.displayName} set as ${role}.`);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to update role.");
    } finally {
      setBusyId(null);
    }
  }

  function openJobTitles(row: AdminPortalUser) {
    const nextId = expandedId === row.id ? null : row.id;
    setExpandedId(nextId);
    setDraftTitles(
      nextId ? normalizeJobTitles(row.jobTitles ?? []) : [],
    );
    setError(null);
    setSuccess(null);
  }

  function toggleDraftJobTitle(row: AdminPortalUser, title: string) {
    const selected = draftTitles.includes(title);
    if (!selected && isExclusiveStaffJobTitle(title)) {
      const ownerId = heldExclusive.get(title);
      if (ownerId && ownerId !== row.id) {
        const owner = allStaff.find((u) => u.id === ownerId);
        setError(
          `${title} is already attached to ${owner?.displayName ?? "another staff member"}.`,
        );
        return;
      }
    }
    setError(null);
    setDraftTitles((prev) =>
      selected ? prev.filter((t) => t !== title) : [...prev, title],
    );
  }

  async function saveJobTitles(row: AdminPortalUser) {
    const next = normalizeJobTitles(draftTitles);
    try {
      setBusyId(row.id);
      await updateStaffProfile(row.id, { jobTitles: next });
      setDraftTitles(next);
      setSuccess(
        next.length
          ? `${row.displayName} job titles saved.`
          : `${row.displayName} job titles cleared.`,
      );
      setError(null);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Unable to save job titles.",
      );
    } finally {
      setBusyId(null);
    }
  }

  function discardJobTitleDraft(row: AdminPortalUser) {
    setDraftTitles(normalizeJobTitles(row.jobTitles ?? []));
    setError(null);
    setSuccess(null);
  }

  if (creating) {
    return (
      <ApprenticePageShell
        eyebrow={`${eyebrow} · Staff`}
        title="Add a staff member"
        description="Create their login first. You can set or change their role afterwards."
      >
        <div className={styles.stack}>
          <section className={styles.formGroup}>
            <div className={styles.formGroupHead}>
              <h2 className={styles.formGroupTitle}>Add staff</h2>
              <span className={styles.formGroupBadge}>Login</span>
            </div>
            <p className={styles.formGroupMeta}>
              They start as awaiting enable. Role can be assigned now or later
              from the staff list.
            </p>
            <div className={styles.formGrid}>
              <FormField label="First name">
                <TextInput
                  value={form.firstName}
                  autoFocus
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, firstName: e.target.value }))
                  }
                />
              </FormField>
              <FormField label="Last name">
                <TextInput
                  value={form.lastName}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, lastName: e.target.value }))
                  }
                />
              </FormField>
              <FormField label="Email">
                <TextInput
                  type="email"
                  value={form.email}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, email: e.target.value }))
                  }
                />
              </FormField>
              <FormField
                label="Portal access"
                hint="Optional — defaults to Tutor until you change it"
              >
                <Select
                  value={form.role}
                  placeholder="Assign later…"
                  options={[
                    { value: "", label: "Assign later…" },
                    ...roleOptions.map((role) => ({
                      value: role,
                      label: role,
                    })),
                  ]}
                  onChange={(role) =>
                    setForm((prev) => ({
                      ...prev,
                      role: role as AdminPortalRole | "",
                    }))
                  }
                />
              </FormField>
            </div>
            {error ? <p className={styles.error}>{error}</p> : null}
            <div className={styles.formActions}>
              <button
                type="button"
                className={styles.secondaryBtn}
                onClick={() => {
                  setCreating(false);
                  setError(null);
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                className={styles.primaryBtn}
                onClick={addStaff}
              >
                Create login
              </button>
            </div>
          </section>
        </div>
      </ApprenticePageShell>
    );
  }

  return (
    <ApprenticePageShell
      eyebrow={`${eyebrow} · Staff`}
      title="Staff"
      description="Attach one or more job titles per person. Unique titles like CEO can only sit on one staff member. Portal access stays Tutor or Administrator."
      actions={
        <button
          type="button"
          className={styles.primaryBtn}
          onClick={() => {
            setCreating(true);
            setForm(emptyForm());
            setError(null);
            setSuccess(null);
          }}
        >
          Add staff
        </button>
      }
    >
      <div className={styles.stack}>
        {success ? <p className={styles.success}>{success}</p> : null}
        {error ? <p className={styles.error}>{error}</p> : null}

        <div className={styles.tabRow} role="tablist" aria-label="Staff groups">
          {STAFF_GROUP_FILTERS.map((group) => {
            const count = groupCounts[group.id];
            const active = groupFilter === group.id;
            return (
              <button
                key={group.id}
                type="button"
                role="tab"
                aria-selected={active}
                className={active ? styles.tabActive : styles.tab}
                onClick={() => {
                  setGroupFilter(group.id);
                  setExpandedId(null);
                }}
              >
                {group.label}
                <span className={styles.tabCount}>{count}</span>
              </button>
            );
          })}
        </div>

        <p className={styles.searchResultCount}>
          Showing {staff.length}
          {groupFilter === "all" ? ` of ${allStaff.length}` : ""}
        </p>

        {staff.length === 0 ? (
          <p className={styles.empty}>No staff match this group or search.</p>
        ) : (
          <div className={`${styles.panel} ${styles.tableWrap}`}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Staff</th>
                  <th>Job titles</th>
                  <th>Portal access</th>
                  <th>Status</th>
                  <th>Login</th>
                </tr>
              </thead>
              <tbody>
                {staff.map((row) => {
                  const canManage = canManagePortalAccount(actorRole, row.role);
                  const editableRoles = roleOptions.filter((role) =>
                    canManagePortalAccount(actorRole, role),
                  );
                  const expanded = expandedId === row.id;
                  const savedTitles = normalizeJobTitles(row.jobTitles ?? []);
                  const titles = expanded ? draftTitles : savedTitles;
                  const titlesDirty =
                    expanded &&
                    (draftTitles.length !== savedTitles.length ||
                      draftTitles.some((t) => !savedTitles.includes(t)));
                  return (
                    <Fragment key={row.id}>
                      <tr
                        className={styles.clickableRow}
                        onClick={() => openJobTitles(row)}
                      >
                        <td>
                          <span className={styles.rowName}>
                            {row.displayName}
                          </span>
                          <span className={styles.rowMeta}>{row.email}</span>
                        </td>
                        <td>
                          <span className={styles.rowMeta}>
                            {savedTitles.length
                              ? formatJobTitles(savedTitles)
                              : "None yet — expand to attach"}
                          </span>
                        </td>
                        <td onClick={(e) => e.stopPropagation()}>
                          <Select
                            aria-label={`Portal access for ${row.displayName}`}
                            value={row.role}
                            disabled={!canManage}
                            options={uniqueRoles(row.role, editableRoles).map(
                              (role) => ({ value: role, label: role }),
                            )}
                            onChange={(role) =>
                              void changeRole(row, role as AdminPortalRole)
                            }
                          />
                        </td>
                        <td>
                          <ApprenticeStatusChip tone={statusTone(row.status)}>
                            {row.status === "invited"
                              ? "Awaiting enable"
                              : row.status}
                          </ApprenticeStatusChip>
                        </td>
                        <td onClick={(e) => e.stopPropagation()}>
                          <button
                            type="button"
                            className={
                              row.status === "active"
                                ? styles.secondaryBtn
                                : styles.primaryBtn
                            }
                            disabled={busyId === row.id || !canManage}
                            onClick={() => void toggleEnable(row)}
                          >
                            {row.status === "active"
                              ? "Disable"
                              : "Enable login"}
                          </button>
                        </td>
                      </tr>
                      {expanded ? (
                        <tr className={styles.staffExpandRow}>
                          <td colSpan={5}>
                            <details className={styles.jobTitleDetails} open>
                              <summary className={styles.jobTitleSummary}>
                                Job roles
                                <span>
                                  {titles.length
                                    ? `${titles.length} selected`
                                    : "None selected"}
                                </span>
                              </summary>
                              <p className={styles.fieldHint}>
                                Tick job titles for {row.displayName}. Unique
                                titles can only belong to one person. Press Save
                                to keep the titles you pick.
                              </p>
                              <div
                                className={styles.jobTitlePicker}
                                role="group"
                                aria-label={`Job titles for ${row.displayName}`}
                              >
                                {STAFF_JOB_TITLE_SECTIONS.map((section) => (
                                  <div
                                    key={section.id}
                                    className={styles.jobTitleSection}
                                  >
                                    <h4 className={styles.jobTitleSectionLabel}>
                                      {section.label}
                                    </h4>
                                    <div
                                      className={styles.jobTitleSectionOptions}
                                    >
                                      {section.titles.map((title) => {
                                        const checked = titles.includes(title);
                                        const ownerId =
                                          heldExclusive.get(title);
                                        const takenByOther =
                                          isExclusiveStaffJobTitle(title) &&
                                          !!ownerId &&
                                          ownerId !== row.id;
                                        const ownerName = takenByOther
                                          ? allStaff.find(
                                              (u) => u.id === ownerId,
                                            )?.displayName
                                          : null;
                                        return (
                                          <label
                                            key={title}
                                            className={styles.jobTitleOption}
                                            data-checked={
                                              checked ? "true" : "false"
                                            }
                                            data-disabled={
                                              takenByOther || !canManage
                                                ? "true"
                                                : "false"
                                            }
                                            title={
                                              takenByOther
                                                ? `Already attached to ${ownerName}`
                                                : undefined
                                            }
                                          >
                                            <input
                                              type="checkbox"
                                              checked={checked}
                                              disabled={
                                                busyId === row.id ||
                                                takenByOther ||
                                                !canManage
                                              }
                                              onChange={() =>
                                                toggleDraftJobTitle(row, title)
                                              }
                                            />
                                            <span>{title}</span>
                                            {takenByOther ? (
                                              <em> · {ownerName}</em>
                                            ) : null}
                                            {isExclusiveStaffJobTitle(title) &&
                                            !takenByOther ? (
                                              <em> · unique</em>
                                            ) : null}
                                          </label>
                                        );
                                      })}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </details>
                            {canManage ? (
                              <div className={styles.formActions}>
                                <button
                                  type="button"
                                  className={styles.secondaryBtn}
                                  disabled={busyId === row.id || !titlesDirty}
                                  onClick={() => discardJobTitleDraft(row)}
                                >
                                  Discard
                                </button>
                                <button
                                  type="button"
                                  className={styles.primaryBtn}
                                  disabled={busyId === row.id || !titlesDirty}
                                  onClick={() => void saveJobTitles(row)}
                                >
                                  Save job titles
                                </button>
                              </div>
                            ) : null}
                          </td>
                        </tr>
                      ) : null}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </ApprenticePageShell>
  );
}
