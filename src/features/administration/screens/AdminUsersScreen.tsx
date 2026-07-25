"use client";

import { useMemo, useState } from "react";
import {
  LearnerPageShell,
  LearnerStatusChip,
} from "@/features/learner-portal/components/LearnerPageShell";
import { createUser, updateUser, type UserInput } from "../domain/store";
import type { AdminPortalRole, AdminPortalUser } from "../domain/types";
import { useAdminStore } from "../hooks/useAdminStore";
import styles from "./admin-pages.module.css";

const ROLES: Array<{ role: AdminPortalRole; workspace: string }> = [
  { role: "Learner", workspace: "learner" },
  { role: "Employer", workspace: "employer" },
  { role: "Tutor", workspace: "staff" },
  { role: "Learning and Progress Mentor", workspace: "staff" },
  { role: "Administrator", workspace: "administration" },
  { role: "Quality", workspace: "quality" },
  { role: "Management", workspace: "management" },
];

type FormState = {
  displayName: string;
  email: string;
  role: AdminPortalRole;
  workspace: string;
  linkedEnrolmentId: string;
  linkedEmployerId: string;
  status: AdminPortalUser["status"];
};

function emptyForm(): FormState {
  return {
    displayName: "",
    email: "",
    role: "Learner",
    workspace: "learner",
    linkedEnrolmentId: "",
    linkedEmployerId: "",
    status: "invited",
  };
}

export function AdminUsersScreen() {
  const store = useAdminStore();
  const [query, setQuery] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const rows = [...store.users].sort((a, b) =>
      a.displayName.localeCompare(b.displayName),
    );
    if (!q) return rows;
    return rows.filter((row) =>
      [row.displayName, row.email, row.role, row.workspace, row.status]
        .join(" ")
        .toLowerCase()
        .includes(q),
    );
  }, [query, store.users]);

  function openCreate() {
    setEditingId(null);
    setForm(emptyForm());
    setError(null);
    setSuccess(null);
    setShowForm(true);
  }

  function openEdit(idValue: string) {
    const row = store.users.find((u) => u.id === idValue);
    if (!row) return;
    setEditingId(row.id);
    setForm({
      displayName: row.displayName,
      email: row.email,
      role: row.role,
      workspace: row.workspace,
      linkedEnrolmentId: row.linkedEnrolmentId ?? "",
      linkedEmployerId: row.linkedEmployerId ?? "",
      status: row.status,
    });
    setError(null);
    setSuccess(null);
    setShowForm(true);
  }

  function onRoleChange(role: AdminPortalRole) {
    const match = ROLES.find((r) => r.role === role);
    setForm((prev) => ({
      ...prev,
      role,
      workspace: match?.workspace ?? prev.workspace,
    }));
  }

  function buildInput(): UserInput | null {
    if (!form.displayName.trim() || !form.email.trim()) {
      setError("Name and email are required.");
      return null;
    }
    return {
      displayName: form.displayName,
      email: form.email,
      role: form.role,
      workspace: form.workspace,
      linkedEnrolmentId: form.linkedEnrolmentId || null,
      linkedEmployerId: form.linkedEmployerId || null,
      status: form.status,
    };
  }

  function submit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    const input = buildInput();
    if (!input) return;
    if (editingId) {
      updateUser(editingId, input);
      setSuccess(`Updated ${input.displayName}.`);
    } else {
      createUser(input);
      setSuccess(`Created portal user ${input.displayName}.`);
    }
    setShowForm(false);
    setEditingId(null);
  }

  return (
    <LearnerPageShell
      eyebrow="Administration"
      title="Account Setup"
      description="Portal accounts for learners, employers, and GTA staff. Link a user to an enrolment or employer where it helps."
      actions={
        <button type="button" className={styles.primaryBtn} onClick={openCreate}>
          Add user
        </button>
      }
    >
      <div className={styles.stack}>
        {success ? <p className={styles.success}>{success}</p> : null}

        {showForm ? (
          <form className={styles.panel} onSubmit={submit}>
            <h2 className={styles.panelTitle}>
              {editingId ? "Edit user" : "Add portal user"}
            </h2>
            <div className={styles.formGrid}>
              <label className={styles.field}>
                <span>Full name</span>
                <input
                  value={form.displayName}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, displayName: e.target.value }))
                  }
                  required
                />
              </label>
              <label className={styles.field}>
                <span>Email</span>
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, email: e.target.value }))
                  }
                  required
                />
              </label>
              <label className={styles.field}>
                <span>Role</span>
                <select
                  value={form.role}
                  onChange={(e) =>
                    onRoleChange(e.target.value as AdminPortalRole)
                  }
                >
                  {ROLES.map((r) => (
                    <option key={r.role} value={r.role}>
                      {r.role}
                    </option>
                  ))}
                </select>
              </label>
              <label className={styles.field}>
                <span>Workspace</span>
                <input value={form.workspace} readOnly />
              </label>
              <label className={styles.field}>
                <span>Linked enrolment</span>
                <select
                  value={form.linkedEnrolmentId}
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      linkedEnrolmentId: e.target.value,
                    }))
                  }
                >
                  <option value="">None</option>
                  {store.enrolments.map((row) => (
                    <option key={row.id} value={row.id}>
                      {row.displayName}
                    </option>
                  ))}
                </select>
              </label>
              <label className={styles.field}>
                <span>Linked employer</span>
                <select
                  value={form.linkedEmployerId}
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      linkedEmployerId: e.target.value,
                    }))
                  }
                >
                  <option value="">None</option>
                  {store.employers.map((row) => (
                    <option key={row.id} value={row.id}>
                      {row.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className={styles.field}>
                <span>Status</span>
                <select
                  value={form.status}
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      status: e.target.value as AdminPortalUser["status"],
                    }))
                  }
                >
                  <option value="invited">Invited</option>
                  <option value="active">Active</option>
                  <option value="disabled">Disabled</option>
                </select>
              </label>
            </div>
            {error ? <p className={styles.error}>{error}</p> : null}
            <div className={styles.formActions}>
              <button
                type="button"
                className={styles.secondaryBtn}
                onClick={() => setShowForm(false)}
              >
                Cancel
              </button>
              <button type="submit" className={styles.primaryBtn}>
                {editingId ? "Save changes" : "Create user"}
              </button>
            </div>
          </form>
        ) : null}

        <div className={styles.toolbar}>
          <label className={styles.searchField}>
            <span>Search users</span>
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Name, email, role…"
            />
          </label>
          <p className={styles.muted}>
            {filtered.length} user{filtered.length === 1 ? "" : "s"}
          </p>
        </div>

        <div className={`${styles.panel} ${styles.tableWrap}`}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>User</th>
                <th>Role</th>
                <th>Workspace</th>
                <th>Links</th>
                <th>Status</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {filtered.map((row) => {
                const enrolment = store.enrolments.find(
                  (e) => e.id === row.linkedEnrolmentId,
                );
                const employer = store.employers.find(
                  (e) => e.id === row.linkedEmployerId,
                );
                return (
                  <tr key={row.id}>
                    <td>
                      <span className={styles.rowName}>{row.displayName}</span>
                      <span className={styles.rowMeta}>{row.email}</span>
                    </td>
                    <td>{row.role}</td>
                    <td>{row.workspace}</td>
                    <td>
                      {enrolment?.displayName || employer?.name || "—"}
                    </td>
                    <td>
                      <LearnerStatusChip
                        tone={
                          row.status === "active"
                            ? "green"
                            : row.status === "invited"
                              ? "amber"
                              : "red"
                        }
                      >
                        {row.status}
                      </LearnerStatusChip>
                    </td>
                    <td>
                      <button
                        type="button"
                        className={styles.secondaryBtn}
                        onClick={() => openEdit(row.id)}
                      >
                        Edit
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </LearnerPageShell>
  );
}
