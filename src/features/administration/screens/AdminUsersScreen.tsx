"use client";

import { Fragment, useId, useMemo, useState } from "react";
import { FormField } from "@/components/ui/FormField";
import { Select } from "@/components/ui/Select";
import { TextInput } from "@/components/ui/TextInput";
import { ApprenticePageShell } from "@/features/apprentice-portal/components/ApprenticePageShell";
import apprenticeStyles from "@/features/apprentice-portal/screens/apprentice-pages.module.css";
import { usePortalSession } from "@/shell/demo/PortalSessionProvider";
import {
  assignableRoles,
  canManagePortalAccount,
  isNewStarter,
  newStarterDaysRemaining,
  sessionPortalRole,
  workspaceForRole,
} from "../domain/account-access";
import { createUser, setPortalEnvironment } from "../domain/store";
import type { AdminPortalRole, AdminPortalUser } from "../domain/types";
import { useAdminStore } from "../hooks/useAdminStore";
import styles from "./admin-pages.module.css";

export type AccountSetupScope = "apprentice" | "staff";

type FormState = {
  status: AdminPortalUser["status"];
};

type StaffCreateForm = {
  displayName: string;
  email: string;
  role: AdminPortalRole | "";
};

type ListTab = "all" | "awaiting_enable" | "new_starters" | "disabled";
type SearchMode = "name" | "teacher" | "role";
type EnvironmentFilter = "all" | AdminPortalUser["status"];

type EnrolmentStaff = {
  id: string;
  displayName: string;
  tutorName: string;
  mentorName: string;
};

function emptyStaffCreateForm(): StaffCreateForm {
  return { displayName: "", email: "", role: "" };
}

function formatWorkspace(workspace: string): string {
  if (!workspace) return "—";
  return workspace.charAt(0).toUpperCase() + workspace.slice(1);
}

function isStaffAccount(row: AdminPortalUser): boolean {
  return row.role !== "Apprentice" && row.role !== "Employer";
}

function linkLabel(
  row: AdminPortalUser,
  enrolments: { id: string; displayName: string }[],
  employers: { id: string; name: string }[],
): string {
  const enrolment = enrolments.find((e) => e.id === row.linkedEnrolmentId);
  const employer = employers.find((e) => e.id === row.linkedEmployerId);
  return enrolment?.displayName || employer?.name || "";
}

/** Tutor / mentor names from the apprentice's enrolment. */
function staffForApprentice(
  row: AdminPortalUser,
  enrolments: EnrolmentStaff[],
): { tutorName: string; mentorName: string } | null {
  const enrolment = enrolments.find((e) => e.id === row.linkedEnrolmentId);
  if (!enrolment) return null;
  return {
    tutorName: enrolment.tutorName.trim(),
    mentorName: enrolment.mentorName.trim(),
  };
}

function matchesTeacher(
  row: AdminPortalUser,
  query: string,
  enrolments: EnrolmentStaff[],
): boolean {
  const staff = staffForApprentice(row, enrolments);
  if (!staff) return false;
  const q = query.toLowerCase();
  return (
    staff.tutorName.toLowerCase().includes(q) ||
    staff.mentorName.toLowerCase().includes(q)
  );
}

function accountRowTone(
  status: AdminPortalUser["status"],
  isStarter: boolean,
): "green" | "amber" | "red" | "navy" {
  if (status === "disabled") return "red";
  if (status === "invited") return "amber";
  if (isStarter) return "navy";
  return "green";
}

const COPY = {
  apprentice: {
    title: "Apprentice Account Setup",
    description:
      "Apprentice environments only — they arrive here after enrolment. Enable or disable each apprentice’s portal. Staff accounts are managed on Management.",
    personSingular: "apprentice",
    personPlural: "apprentices",
    personColumn: "Apprentice",
    linksColumn: "Links",
    remitLabel: "Apprentices",
    remitHint: "Apprentice accounts in your remit",
    allTab: "All apprentices",
    searchLabel: "Search apprentices",
    searchAria: "Search apprentices by",
    envHint:
      "Turn this apprentice’s portal on or off. Identity and links stay with enrolment.",
    empty: "No apprentices match this view.",
  },
  staff: {
    title: "Staff Account Setup",
    description:
      "Staff environments only — enable or disable each staff member’s portal. Apprentices are managed on Apprentice Account Setup.",
    personSingular: "staff member",
    personPlural: "staff",
    personColumn: "Staff",
    linksColumn: "Role",
    remitLabel: "Staff",
    remitHint: "Staff accounts in your remit",
    allTab: "All staff",
    searchLabel: "Search staff",
    searchAria: "Search staff by",
    envHint:
      "Turn this staff member’s portal on or off. Role and workspace stay as set at intake.",
    empty: "No staff match this view.",
  },
} as const;

type AdminUsersScreenProps = {
  scope?: AccountSetupScope;
  /** Workspace eyebrow — Administration or Management. */
  eyebrow?: string;
};

/**
 * Shared Account Setup — identical UI for apprentices and staff; only the
 * filtered remit and copy differ.
 */
export function AdminUsersScreen({
  scope = "apprentice",
  eyebrow = "Administration",
}: AdminUsersScreenProps) {
  const store = useAdminStore();
  const { session } = usePortalSession();
  const actorRole = sessionPortalRole(session.account);
  const searchInputId = useId();
  const copy = COPY[scope];
  const isStaff = scope === "staff";

  const searchModes = useMemo(
    () =>
      isStaff
        ? ([
            {
              id: "name" as const,
              label: "Name",
              placeholder: "Search by staff name…",
            },
            {
              id: "role" as const,
              label: "Role",
              placeholder: "Search by role…",
            },
          ] as const)
        : ([
            {
              id: "name" as const,
              label: "Name",
              placeholder: "Search by apprentice name…",
            },
            {
              id: "teacher" as const,
              label: "Teacher",
              placeholder: "Tutor or mentor name — shows their apprentices…",
            },
          ] as const),
    [isStaff],
  );

  const [query, setQuery] = useState("");
  const [searchMode, setSearchMode] = useState<SearchMode>("name");
  const [tab, setTab] = useState<ListTab>("all");
  const [environmentFilter, setEnvironmentFilter] =
    useState<EnvironmentFilter>("all");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState | null>(null);
  const [creating, setCreating] = useState(false);
  const [createForm, setCreateForm] = useState<StaffCreateForm>(() =>
    emptyStaffCreateForm(),
  );
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const editingUser = editingId
    ? store.users.find((u) => u.id === editingId)
    : null;

  const activeSearch =
    searchModes.find((mode) => mode.id === searchMode) ?? searchModes[0];

  const staffRoleOptions = useMemo(
    () => assignableRoles(actorRole).filter((role) => role !== "Apprentice"),
    [actorRole],
  );

  const manageableUsers = useMemo(
    () =>
      store.users.filter((row) => {
        const inScope = isStaff
          ? isStaffAccount(row)
          : row.role === "Apprentice";
        return inScope && canManagePortalAccount(actorRole, row.role);
      }),
    [actorRole, isStaff, store.users],
  );

  const newStarterCount = useMemo(
    () =>
      manageableUsers.filter((row) => isNewStarter(row.programmeStartDate))
        .length,
    [manageableUsers],
  );

  const awaitingEnableCount = useMemo(
    () => manageableUsers.filter((row) => row.status === "invited").length,
    [manageableUsers],
  );

  const disabledCount = useMemo(
    () => manageableUsers.filter((row) => row.status === "disabled").length,
    [manageableUsers],
  );

  const filtersActive =
    environmentFilter !== "all" ||
    query.trim().length > 0 ||
    tab !== "all";

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    let rows = [...manageableUsers].sort((a, b) =>
      a.displayName.localeCompare(b.displayName),
    );

    if (tab === "awaiting_enable") {
      rows = rows.filter((row) => row.status === "invited");
    } else if (tab === "new_starters") {
      rows = rows.filter((row) => isNewStarter(row.programmeStartDate));
    } else if (tab === "disabled") {
      rows = rows.filter((row) => row.status === "disabled");
    }

    if (environmentFilter !== "all") {
      rows = rows.filter((row) => row.status === environmentFilter);
    }

    if (!q) return rows;
    return rows.filter((row) => {
      if (searchMode === "teacher") {
        return matchesTeacher(row, q, store.enrolments);
      }
      if (searchMode === "role") {
        return row.role.toLowerCase().includes(q);
      }
      return row.displayName.toLowerCase().includes(q);
    });
  }, [
    environmentFilter,
    manageableUsers,
    query,
    searchMode,
    store.enrolments,
    tab,
  ]);

  function clearFilters() {
    setQuery("");
    setSearchMode("name");
    setTab("all");
    setEnvironmentFilter("all");
  }

  function openEdit(idValue: string) {
    const row = store.users.find((u) => u.id === idValue);
    if (!row) return;
    if (isStaff ? !isStaffAccount(row) : row.role !== "Apprentice") return;
    if (!canManagePortalAccount(actorRole, row.role)) {
      setError("You can only manage accounts below your own role.");
      return;
    }
    if (editingId === row.id) {
      closeEdit();
      return;
    }
    setEditingId(row.id);
    setForm({ status: row.status });
    setError(null);
    setSuccess(null);
  }

  function closeEdit() {
    setEditingId(null);
    setForm(null);
    setError(null);
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!editingUser || !form) return;
    setError(null);
    if (!canManagePortalAccount(actorRole, editingUser.role)) {
      setError("You can only manage accounts below your own role.");
      return;
    }
    try {
      await setPortalEnvironment(
        editingUser.id,
        form.status,
        session.account.name,
      );
      setSuccess(
        form.status === "active"
          ? `Enabled portal environment for ${editingUser.displayName}.`
          : form.status === "disabled"
            ? `Disabled portal environment for ${editingUser.displayName}.`
            : `Updated environment for ${editingUser.displayName}.`,
      );
      closeEdit();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Unable to update environment.",
      );
    }
  }

  /** Quick toggle from the status pill — stamps who enabled / disabled. */
  async function toggleEnvironmentFromPill(
    event: React.MouseEvent,
    row: AdminPortalUser,
  ) {
    event.stopPropagation();
    if (isStaff ? !isStaffAccount(row) : row.role !== "Apprentice") return;
    if (!canManagePortalAccount(actorRole, row.role)) return;
    const nextStatus: AdminPortalUser["status"] =
      row.status === "active" ? "disabled" : "active";
    try {
      await setPortalEnvironment(row.id, nextStatus, session.account.name);
      if (editingId === row.id) {
        setForm({ status: nextStatus });
      }
      setSuccess(
        nextStatus === "active"
          ? `Enabled portal environment for ${row.displayName}.`
          : `Disabled portal environment for ${row.displayName}.`,
      );
      setError(null);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Unable to update environment.",
      );
    }
  }

  function startCreateStaff() {
    setCreating(true);
    setCreateForm(emptyStaffCreateForm());
    setEditingId(null);
    setForm(null);
    setError(null);
    setSuccess(null);
  }

  async function createStaffMember() {
    if (!createForm.displayName.trim()) {
      setError("A name is needed to add a staff member.");
      return;
    }
    if (!createForm.email.trim()) {
      setError("An email is needed so their account can be set up.");
      return;
    }
    if (!createForm.role) {
      setError("Choose the role they'll hold.");
      return;
    }
    const emailKey = createForm.email.trim().toLowerCase();
    if (store.users.some((u) => u.email.trim().toLowerCase() === emailKey)) {
      setError("An account with that email already exists.");
      return;
    }
    try {
      await createUser({
        displayName: createForm.displayName,
        email: createForm.email,
        role: createForm.role,
        workspace: workspaceForRole(createForm.role),
        jobTitles: [],
        linkedEnrolmentId: null,
        linkedApprenticeId: null,
        linkedEmployerId: null,
        programmeStartDate: null,
        status: "invited",
      });
      setSuccess(
        `${createForm.displayName.trim()} added as ${createForm.role} — enable their environment below.`,
      );
      setError(null);
      setCreating(false);
      setCreateForm(emptyStaffCreateForm());
      setTab("awaiting_enable");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to add staff.");
    }
  }

  if (creating && isStaff) {
    return (
      <ApprenticePageShell
        eyebrow={`${eyebrow} · Staff Account Setup`}
        title="Add a staff member"
        description="Capture who they are and the role they hold. Their workspace is set automatically from the role — enable their environment once created."
      >
        <div className={styles.stack}>
          <section className={styles.formGroup}>
            <div className={styles.formGroupHead}>
              <h2 className={styles.formGroupTitle}>Add a staff member</h2>
              <span className={styles.formGroupBadge}>Account details</span>
            </div>
            <p className={styles.formGroupMeta}>
              They&apos;ll appear as awaiting enable. You can only create roles
              below your own.
            </p>
            <div className={styles.formGrid}>
              <FormField label="Full name">
                <TextInput
                  value={createForm.displayName}
                  autoFocus
                  onChange={(e) =>
                    setCreateForm((prev) => ({
                      ...prev,
                      displayName: e.target.value,
                    }))
                  }
                />
              </FormField>
              <FormField label="Email">
                <TextInput
                  type="email"
                  value={createForm.email}
                  onChange={(e) =>
                    setCreateForm((prev) => ({
                      ...prev,
                      email: e.target.value,
                    }))
                  }
                />
              </FormField>
              <FormField
                label="Role"
                hint={
                  createForm.role
                    ? `Workspace: ${formatWorkspace(workspaceForRole(createForm.role))}`
                    : "Sets which workspace they sign into"
                }
              >
                <Select
                  value={createForm.role}
                  placeholder="Choose a role…"
                  onChange={(next) =>
                    setCreateForm((prev) => ({
                      ...prev,
                      role: next as AdminPortalRole,
                    }))
                  }
                  options={staffRoleOptions.map((role) => ({
                    value: role,
                    label: role,
                  }))}
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
                onClick={createStaffMember}
              >
                Add staff member
              </button>
            </div>
          </section>
        </div>
      </ApprenticePageShell>
    );
  }

  return (
    <ApprenticePageShell
      eyebrow={eyebrow}
      title={copy.title}
      description={copy.description}
      actions={
        isStaff ? (
          <button
            type="button"
            className={styles.primaryBtn}
            onClick={startCreateStaff}
          >
            Add staff member
          </button>
        ) : undefined
      }
    >
      <div className={styles.stack}>
        <div className={apprenticeStyles.grid}>
          <button
            type="button"
            className={apprenticeStyles.glanceLink}
            data-tone="navy"
            onClick={() => {
              setTab("all");
              setQuery("");
              setEnvironmentFilter("all");
              setSearchMode("name");
            }}
          >
            <p className={apprenticeStyles.glanceLabel}>{copy.remitLabel}</p>
            <p className={apprenticeStyles.glanceValue}>
              {manageableUsers.length}
            </p>
            <p className={apprenticeStyles.glanceHint}>{copy.remitHint}</p>
          </button>
          <button
            type="button"
            className={apprenticeStyles.glanceLink}
            data-tone="amber"
            onClick={() => setTab("awaiting_enable")}
          >
            <p className={apprenticeStyles.glanceLabel}>Awaiting enable</p>
            <p className={apprenticeStyles.glanceValue}>{awaitingEnableCount}</p>
            <p className={apprenticeStyles.glanceHint}>
              Ready for environment setup
            </p>
          </button>
          {isStaff ? (
            <button
              type="button"
              className={apprenticeStyles.glanceLink}
              data-tone="red"
              onClick={() => setTab("disabled")}
            >
              <p className={apprenticeStyles.glanceLabel}>Disabled</p>
              <p className={apprenticeStyles.glanceValue}>{disabledCount}</p>
              <p className={apprenticeStyles.glanceHint}>
                Environments turned off
              </p>
            </button>
          ) : (
            <button
              type="button"
              className={apprenticeStyles.glanceLink}
              data-tone="green"
              onClick={() => setTab("new_starters")}
            >
              <p className={apprenticeStyles.glanceLabel}>New starters</p>
              <p className={apprenticeStyles.glanceValue}>{newStarterCount}</p>
              <p className={apprenticeStyles.glanceHint}>
                First 14 days — badge on the row
              </p>
            </button>
          )}
        </div>

        {success ? <p className={styles.success}>{success}</p> : null}
        {error && !form ? <p className={styles.error}>{error}</p> : null}

        <div
          className={styles.tabRow}
          role="tablist"
          aria-label="Account queues"
        >
          <button
            type="button"
            role="tab"
            aria-selected={tab === "all"}
            className={tab === "all" ? styles.tabActive : styles.tab}
            onClick={() => setTab("all")}
          >
            {copy.allTab}
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === "awaiting_enable"}
            className={
              tab === "awaiting_enable" ? styles.tabActiveAmber : styles.tabAmber
            }
            onClick={() => setTab("awaiting_enable")}
          >
            Awaiting enable
            {awaitingEnableCount > 0 ? (
              <span className={styles.tabCount}>{awaitingEnableCount}</span>
            ) : null}
          </button>
          {isStaff ? (
            <button
              type="button"
              role="tab"
              aria-selected={tab === "disabled"}
              className={tab === "disabled" ? styles.tabActive : styles.tab}
              onClick={() => setTab("disabled")}
            >
              Disabled
              {disabledCount > 0 ? (
                <span className={styles.tabCount}>{disabledCount}</span>
              ) : null}
            </button>
          ) : (
            <button
              type="button"
              role="tab"
              aria-selected={tab === "new_starters"}
              className={
                tab === "new_starters" ? styles.tabActiveNavy : styles.tabNavy
              }
              onClick={() => setTab("new_starters")}
            >
              New starters
              {newStarterCount > 0 ? (
                <span className={styles.tabCount}>{newStarterCount}</span>
              ) : null}
            </button>
          )}
        </div>

        <div className={styles.searchBlock}>
          <div className={styles.searchModeRow}>
            <p className={styles.searchModeLabel}>Search by</p>
            <div
              className={styles.searchModeTabs}
              role="group"
              aria-label={copy.searchAria}
            >
              {searchModes.map((mode) => (
                <button
                  key={mode.id}
                  type="button"
                  className={
                    searchMode === mode.id
                      ? styles.searchModeActive
                      : styles.searchModeBtn
                  }
                  aria-pressed={searchMode === mode.id}
                  onClick={() => setSearchMode(mode.id)}
                >
                  {mode.label}
                </button>
              ))}
            </div>
            <p className={styles.searchResultCount}>
              {filtersActive
                ? `Showing ${filtered.length} of ${manageableUsers.length}`
                : `${manageableUsers.length} ${
                    manageableUsers.length === 1
                      ? copy.personSingular
                      : copy.personPlural
                  }`}
            </p>
          </div>

          <FormField label={copy.searchLabel} htmlFor={searchInputId}>
            <TextInput
              id={searchInputId}
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={activeSearch.placeholder}
            />
          </FormField>

          <div className={styles.filterGrid}>
            <FormField label="Environment">
              <Select
                value={environmentFilter}
                onChange={(next) =>
                  setEnvironmentFilter(next as EnvironmentFilter)
                }
                options={[
                  { value: "all", label: "Any status" },
                  { value: "invited", label: "Awaiting enable" },
                  { value: "active", label: "Enabled" },
                  { value: "disabled", label: "Disabled" },
                ]}
              />
            </FormField>
            {filtersActive ? (
              <div className={styles.filterActions}>
                <button
                  type="button"
                  className={styles.secondaryBtn}
                  onClick={clearFilters}
                >
                  Clear filters
                </button>
              </div>
            ) : null}
          </div>
        </div>

        <div className={`${styles.panel} ${styles.tableWrap}`}>
          <table className={`${styles.table} ${styles.accountsTable}`}>
            <colgroup>
              <col className={styles.colUser} />
              <col className={styles.colLinks} />
              <col className={styles.colStatus} />
              <col className={styles.colActions} />
            </colgroup>
            <thead>
              <tr>
                <th scope="col">{copy.personColumn}</th>
                <th scope="col">{copy.linksColumn}</th>
                <th scope="col">Status</th>
                <th scope="col">By</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={4}>
                    <p className={styles.muted}>{copy.empty}</p>
                  </td>
                </tr>
              ) : (
                filtered.map((row) => {
                  const linked = isStaff
                    ? `${row.role} · ${formatWorkspace(row.workspace)}`
                    : linkLabel(row, store.enrolments, store.employers) || "—";
                  const teachers = isStaff
                    ? null
                    : staffForApprentice(row, store.enrolments);
                  const daysLeft = isStaff
                    ? null
                    : newStarterDaysRemaining(row.programmeStartDate);
                  const canManage = canManagePortalAccount(actorRole, row.role);
                  const tone = accountRowTone(row.status, daysLeft != null);
                  const expanded = editingId === row.id && form != null;
                  return (
                    <Fragment key={row.id}>
                      <tr
                        data-tone={tone}
                        data-clickable={canManage ? "true" : undefined}
                        data-expanded={expanded ? "true" : undefined}
                        className={canManage ? styles.clickableRow : undefined}
                        onClick={
                          canManage ? () => openEdit(row.id) : undefined
                        }
                        tabIndex={canManage ? 0 : undefined}
                        role={canManage ? "button" : undefined}
                        aria-expanded={canManage ? expanded : undefined}
                        aria-label={
                          canManage
                            ? `Set up environment for ${row.displayName}`
                            : undefined
                        }
                        onKeyDown={
                          canManage
                            ? (e) => {
                                if (e.key === "Enter" || e.key === " ") {
                                  e.preventDefault();
                                  openEdit(row.id);
                                }
                              }
                            : undefined
                        }
                      >
                        <td>
                          <span className={styles.rowName}>
                            {row.displayName}
                          </span>
                        </td>
                        <td>
                          <span className={styles.cellText}>{linked}</span>
                          {teachers?.tutorName || teachers?.mentorName ? (
                            <span className={styles.rowMeta}>
                              {[
                                teachers.tutorName
                                  ? `Tutor ${teachers.tutorName}`
                                  : null,
                                teachers.mentorName &&
                                teachers.mentorName !== teachers.tutorName
                                  ? `Mentor ${teachers.mentorName}`
                                  : null,
                              ]
                                .filter(Boolean)
                                .join(" · ")}
                            </span>
                          ) : null}
                        </td>
                        <td>
                          <div className={styles.statusStack}>
                            {canManage ? (
                              <button
                                type="button"
                                className={styles.statusPill}
                                data-tone={
                                  row.status === "active"
                                    ? "green"
                                    : row.status === "invited"
                                      ? "amber"
                                      : "red"
                                }
                                aria-label={
                                  row.status === "active"
                                    ? `Disable environment for ${row.displayName}`
                                    : `Enable environment for ${row.displayName}`
                                }
                                title={
                                  row.status === "active"
                                    ? "Click to disable"
                                    : "Click to enable"
                                }
                                onClick={(e) =>
                                  toggleEnvironmentFromPill(e, row)
                                }
                              >
                                {row.status === "invited"
                                  ? "awaiting enable"
                                  : row.status}
                              </button>
                            ) : (
                              <span
                                className={styles.statusPill}
                                data-tone={
                                  row.status === "active"
                                    ? "green"
                                    : row.status === "invited"
                                      ? "amber"
                                      : "red"
                                }
                                data-static="true"
                              >
                                {row.status === "invited"
                                  ? "awaiting enable"
                                  : row.status}
                              </span>
                            )}
                            {daysLeft != null ? (
                              <span
                                className={styles.statusPill}
                                data-tone="navy"
                                data-static="true"
                              >
                                new starter · {daysLeft}d
                              </span>
                            ) : null}
                          </div>
                        </td>
                        <td>
                          {row.status === "active" && row.enabledBy ? (
                            <span className={styles.actionBy}>
                              <span className={styles.actionByLabel}>
                                Enabled
                              </span>
                              <span className={styles.actionByName}>
                                {row.enabledBy}
                              </span>
                            </span>
                          ) : row.status === "disabled" && row.disabledBy ? (
                            <span className={styles.actionBy}>
                              <span className={styles.actionByLabel}>
                                Disabled
                              </span>
                              <span className={styles.actionByName}>
                                {row.disabledBy}
                              </span>
                            </span>
                          ) : row.status === "invited" ? (
                            <span className={styles.muted}>Not enabled yet</span>
                          ) : row.status === "disabled" ? (
                            <span className={styles.muted}>Disabled</span>
                          ) : (
                            <span className={styles.muted}>—</span>
                          )}
                        </td>
                      </tr>
                      {expanded ? (
                        <tr className={styles.expandRow} data-tone={tone}>
                          <td colSpan={4}>
                            <form
                              className={styles.expandPanel}
                              onSubmit={submit}
                              onClick={(e) => e.stopPropagation()}
                            >
                              <div className={styles.expandBody}>
                                <div className={styles.envSetupField}>
                                  <FormField
                                    label="Environment"
                                    hint={copy.envHint}
                                  >
                                    <Select
                                      value={form.status}
                                      onChange={(next) =>
                                        setForm({
                                          status:
                                            next as AdminPortalUser["status"],
                                        })
                                      }
                                      options={[
                                        {
                                          value: "invited",
                                          label: "Awaiting enable",
                                        },
                                        { value: "active", label: "Enabled" },
                                        {
                                          value: "disabled",
                                          label: "Disabled",
                                        },
                                      ]}
                                    />
                                  </FormField>
                                </div>
                                <div className={styles.expandActions}>
                                  {error ? (
                                    <p className={styles.error}>{error}</p>
                                  ) : null}
                                  <button
                                    type="button"
                                    className={styles.secondaryBtn}
                                    onClick={closeEdit}
                                  >
                                    Cancel
                                  </button>
                                  <button
                                    type="submit"
                                    className={styles.primaryBtn}
                                  >
                                    Save environment
                                  </button>
                                </div>
                              </div>
                            </form>
                          </td>
                        </tr>
                      ) : null}
                    </Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </ApprenticePageShell>
  );
}
