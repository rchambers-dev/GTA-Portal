"use client";

import { Fragment, useId, useMemo, useState } from "react";
import { FormField } from "@/components/ui/FormField";
import { Select } from "@/components/ui/Select";
import { TextInput } from "@/components/ui/TextInput";
import {
  LearnerPageShell,
} from "@/features/learner-portal/components/LearnerPageShell";
import learnerStyles from "@/features/learner-portal/screens/learner-pages.module.css";
import { useDemoSession } from "@/shell/demo/DemoSessionProvider";
import {
  canManagePortalAccount,
  isNewStarter,
  newStarterDaysRemaining,
  sessionPortalRole,
} from "../domain/account-access";
import { setPortalEnvironment } from "../domain/store";
import type { AdminPortalUser } from "../domain/types";
import { useAdminStore } from "../hooks/useAdminStore";
import styles from "./admin-pages.module.css";

type FormState = {
  status: AdminPortalUser["status"];
};

type ListTab = "all" | "awaiting_enable" | "new_starters";
type SearchMode = "name" | "teacher";
type EnvironmentFilter = "all" | AdminPortalUser["status"];

const SEARCH_MODES: Array<{
  id: SearchMode;
  label: string;
  placeholder: string;
}> = [
  { id: "name", label: "Name", placeholder: "Search by learner name…" },
  {
    id: "teacher",
    label: "Teacher",
    placeholder: "Tutor or mentor name — shows their learners…",
  },
];

type EnrolmentStaff = {
  id: string;
  displayName: string;
  tutorName: string;
  mentorName: string;
};

function linkLabel(
  row: AdminPortalUser,
  enrolments: { id: string; displayName: string }[],
  employers: { id: string; name: string }[],
): string {
  const enrolment = enrolments.find((e) => e.id === row.linkedEnrolmentId);
  const employer = employers.find((e) => e.id === row.linkedEmployerId);
  return enrolment?.displayName || employer?.name || "";
}

/** Tutor / mentor names from the learner's enrolment. */
function staffForLearner(
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
  const staff = staffForLearner(row, enrolments);
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

export function AdminUsersScreen() {
  const store = useAdminStore();
  const { session } = useDemoSession();
  const actorRole = sessionPortalRole(session.account);
  const searchInputId = useId();

  const [query, setQuery] = useState("");
  const [searchMode, setSearchMode] = useState<SearchMode>("name");
  const [tab, setTab] = useState<ListTab>("all");
  const [environmentFilter, setEnvironmentFilter] =
    useState<EnvironmentFilter>("all");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const editingUser = editingId
    ? store.users.find((u) => u.id === editingId)
    : null;

  const activeSearch =
    SEARCH_MODES.find((mode) => mode.id === searchMode) ?? SEARCH_MODES[0];

  /**
   * Account Setup is learners only — staff environments are managed on
   * Management. You still only see accounts ranked below your own role.
   */
  const manageableUsers = useMemo(
    () =>
      store.users.filter(
        (row) =>
          row.role === "Learner" &&
          canManagePortalAccount(actorRole, row.role),
      ),
    [actorRole, store.users],
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
    }

    if (environmentFilter !== "all") {
      rows = rows.filter((row) => row.status === environmentFilter);
    }

    if (!q) return rows;
    return rows.filter((row) => {
      if (searchMode === "teacher") {
        return matchesTeacher(row, q, store.enrolments);
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
    if (!row || row.role !== "Learner") return;
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

  function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!editingUser || !form) return;
    setError(null);
    if (!canManagePortalAccount(actorRole, editingUser.role)) {
      setError("You can only manage accounts below your own role.");
      return;
    }
    setPortalEnvironment(editingUser.id, form.status, session.account.name);
    setSuccess(
      form.status === "active"
        ? `Enabled portal environment for ${editingUser.displayName}.`
        : form.status === "disabled"
          ? `Disabled portal environment for ${editingUser.displayName}.`
          : `Updated environment for ${editingUser.displayName}.`,
    );
    closeEdit();
  }

  /** Quick toggle from the status pill — stamps who enabled / disabled. */
  function toggleEnvironmentFromPill(
    event: React.MouseEvent,
    row: AdminPortalUser,
  ) {
    event.stopPropagation();
    if (row.role !== "Learner") return;
    if (!canManagePortalAccount(actorRole, row.role)) return;
    const nextStatus: AdminPortalUser["status"] =
      row.status === "active" ? "disabled" : "active";
    setPortalEnvironment(row.id, nextStatus, session.account.name);
    if (editingId === row.id) {
      setForm({ status: nextStatus });
    }
    setSuccess(
      nextStatus === "active"
        ? `Enabled portal environment for ${row.displayName}.`
        : `Disabled portal environment for ${row.displayName}.`,
    );
    setError(null);
  }

  return (
    <LearnerPageShell
      eyebrow="Administration"
      title="Account Setup"
      description="Learner environments only — they arrive here after enrolment. Enable or disable each learner’s portal. Staff accounts are managed on Management."
    >
      <div className={styles.stack}>
        <div className={learnerStyles.grid}>
          <button
            type="button"
            className={learnerStyles.glanceLink}
            data-tone="navy"
            onClick={() => {
              setTab("all");
              setQuery("");
              setEnvironmentFilter("all");
              setSearchMode("name");
            }}
          >
            <p className={learnerStyles.glanceLabel}>Learners</p>
            <p className={learnerStyles.glanceValue}>
              {manageableUsers.length}
            </p>
            <p className={learnerStyles.glanceHint}>
              Learner accounts in your remit
            </p>
          </button>
          <button
            type="button"
            className={learnerStyles.glanceLink}
            data-tone="amber"
            onClick={() => setTab("awaiting_enable")}
          >
            <p className={learnerStyles.glanceLabel}>Awaiting enable</p>
            <p className={learnerStyles.glanceValue}>{awaitingEnableCount}</p>
            <p className={learnerStyles.glanceHint}>
              Ready for environment setup
            </p>
          </button>
          <button
            type="button"
            className={learnerStyles.glanceLink}
            data-tone="green"
            onClick={() => setTab("new_starters")}
          >
            <p className={learnerStyles.glanceLabel}>New starters</p>
            <p className={learnerStyles.glanceValue}>{newStarterCount}</p>
            <p className={learnerStyles.glanceHint}>
              First 14 days — badge on the row
            </p>
          </button>
        </div>

        {success ? <p className={styles.success}>{success}</p> : null}
        {error && !form ? <p className={styles.error}>{error}</p> : null}

        <div className={styles.tabRow} role="tablist" aria-label="Account queues">
          <button
            type="button"
            role="tab"
            aria-selected={tab === "all"}
            className={tab === "all" ? styles.tabActive : styles.tab}
            onClick={() => setTab("all")}
          >
            All learners
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
        </div>

        <div className={styles.searchBlock}>
          <div className={styles.searchModeRow}>
            <p className={styles.searchModeLabel}>Search by</p>
            <div
              className={styles.searchModeTabs}
              role="group"
              aria-label="Search learners by"
            >
              {SEARCH_MODES.map((mode) => (
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
                : `${manageableUsers.length} learner${manageableUsers.length === 1 ? "" : "s"}`}
            </p>
          </div>

          <FormField label="Search learners" htmlFor={searchInputId}>
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
                <th scope="col">Learner</th>
                <th scope="col">Links</th>
                <th scope="col">Status</th>
                <th scope="col">By</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={4}>
                    <p className={styles.muted}>No learners match this view.</p>
                  </td>
                </tr>
              ) : (
                filtered.map((row) => {
                  const linked =
                    linkLabel(row, store.enrolments, store.employers) || "—";
                  const staff = staffForLearner(row, store.enrolments);
                  const daysLeft = newStarterDaysRemaining(
                    row.programmeStartDate,
                  );
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
                          {staff?.tutorName || staff?.mentorName ? (
                            <span className={styles.rowMeta}>
                              {[
                                staff.tutorName
                                  ? `Tutor ${staff.tutorName}`
                                  : null,
                                staff.mentorName &&
                                staff.mentorName !== staff.tutorName
                                  ? `Mentor ${staff.mentorName}`
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
                                    hint="Turn this learner’s portal on or off. Identity and links stay with enrolment."
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
    </LearnerPageShell>
  );
}
