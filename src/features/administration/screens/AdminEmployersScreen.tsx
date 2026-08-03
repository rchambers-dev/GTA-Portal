"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ApprenticePageShell,
  ApprenticeStatusChip,
} from "@/features/apprentice-portal/components/ApprenticePageShell";
import {
  createEmployer,
  updateEmployer,
  type EmployerInput,
} from "../domain/store";
import type { AdminEmployerRecord, AdminApprenticeEnrolment } from "../domain/types";
import { useAdminStore } from "../hooks/useAdminStore";
import styles from "./admin-pages.module.css";

type FormState = EmployerInput;

function emptyForm(): FormState {
  return {
    name: "",
    legalName: "",
    companyNumber: "",
    mainContact: "",
    contactRole: "Workplace mentor",
    contactEmail: "",
    contactPhone: "",
    addressLine1: "",
    addressLine2: "",
    town: "",
    postcode: "",
    website: "",
    status: "active",
    notes: "",
  };
}

function formatAddress(row: AdminEmployerRecord): string {
  return [row.addressLine1, row.addressLine2, row.town, row.postcode]
    .filter(Boolean)
    .join(", ");
}

function apprenticesForEmployer(
  enrolments: AdminApprenticeEnrolment[],
  employerId: string,
): AdminApprenticeEnrolment[] {
  return enrolments
    .filter((e) => e.employerId === employerId)
    .sort((a, b) => a.displayName.localeCompare(b.displayName));
}

type GarageSearchMode =
  | "name"
  | "postcode"
  | "contact"
  | "area"
  | "apprentice";

const SEARCH_MODES: Array<{ id: GarageSearchMode; label: string; placeholder: string }> = [
  { id: "name", label: "Name", placeholder: "Search by garage or legal name…" },
  { id: "postcode", label: "Postcode", placeholder: "Search by postcode…" },
  { id: "contact", label: "Contact", placeholder: "Search by contact name, email or phone…" },
  { id: "area", label: "Area", placeholder: "Search by town, street or area…" },
  { id: "apprentice", label: "Apprentice", placeholder: "Search by apprentice name or email…" },
];

function garageMatchesQuery(
  row: AdminEmployerRecord,
  linked: AdminApprenticeEnrolment[],
  query: string,
  mode: GarageSearchMode,
): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;

  const haystack = (() => {
    switch (mode) {
      case "name":
        return [row.name, row.legalName].join(" ").toLowerCase();
      case "postcode":
        return row.postcode.toLowerCase().replace(/\s+/g, "");
      case "contact":
        return [
          row.mainContact,
          row.contactRole,
          row.contactEmail,
          row.contactPhone,
        ]
          .join(" ")
          .toLowerCase();
      case "area":
        return [row.town, row.addressLine1, row.addressLine2]
          .join(" ")
          .toLowerCase();
      case "apprentice":
        return linked
          .map((l) => `${l.displayName} ${l.email}`)
          .join(" ")
          .toLowerCase();
    }
  })();

  if (mode === "postcode") {
    const compact = q.replace(/\s+/g, "");
    return haystack.includes(compact);
  }

  return q.split(/\s+/).every((token) => haystack.includes(token));
}

function statusTone(status: AdminApprenticeEnrolment["status"]) {
  switch (status) {
    case "active":
      return "green" as const;
    case "pending_start":
    case "draft":
      return "amber" as const;
    case "withdrawn":
      return "red" as const;
    default:
      return "neutral" as const;
  }
}

function EmployerInlineField({
  label,
  value,
  onCommit,
  type = "text",
  placeholder,
  wide = false,
  multiline = false,
}: {
  label: string;
  value: string;
  onCommit: (next: string) => void;
  type?: "text" | "email" | "tel" | "url";
  placeholder?: string;
  wide?: boolean;
  multiline?: boolean;
}) {
  const [draft, setDraft] = useState(value);
  const [prevValue, setPrevValue] = useState(value);
  if (value !== prevValue) {
    setPrevValue(value);
    setDraft(value);
  }

  function commit() {
    if (draft.trim() !== value.trim()) onCommit(draft);
    else setDraft(value);
  }

  return (
    <label className={`${styles.detailField}${wide ? ` ${styles.detailFieldWide}` : ""}`}>
      <span className={styles.detailFieldLabel}>{label}</span>
      {multiline ? (
        <textarea
          className={styles.detailFieldInput}
          value={draft}
          placeholder={placeholder}
          rows={3}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
        />
      ) : (
        <input
          className={styles.detailFieldInput}
          type={type}
          value={draft}
          placeholder={placeholder}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
        />
      )}
    </label>
  );
}

export function AdminEmployersScreen() {
  const store = useAdminStore();
  const [query, setQuery] = useState("");
  const [searchMode, setSearchMode] = useState<GarageSearchMode>("name");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [apprenticeMenuId, setApprenticeMenuId] = useState<string | null>(null);
  const [selectedApprenticeId, setSelectedApprenticeId] = useState<string | null>(
    null,
  );
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const apprenticeMenuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!apprenticeMenuId) return;
    function onPointerDown(event: MouseEvent) {
      const target = event.target as Node;
      if (
        apprenticeMenuRef.current &&
        !apprenticeMenuRef.current.contains(target)
      ) {
        setApprenticeMenuId(null);
      }
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setApprenticeMenuId(null);
    }
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [apprenticeMenuId]);

  const filtered = useMemo(() => {
    const rows = [...store.employers].sort((a, b) =>
      a.name.localeCompare(b.name),
    );
    return rows.filter((row) =>
      garageMatchesQuery(
        row,
        apprenticesForEmployer(store.enrolments, row.id),
        query,
        searchMode,
      ),
    );
  }, [query, searchMode, store.employers, store.enrolments]);

  const totalGarages = store.employers.length;
  const activeSearch = SEARCH_MODES.find((m) => m.id === searchMode)!;

  function openCreate() {
    setEditingId(null);
    setForm(emptyForm());
    setError(null);
    setSuccess(null);
    setShowForm(true);
  }

  function openEdit(row: AdminEmployerRecord) {
    setEditingId(row.id);
    setForm({
      name: row.name,
      legalName: row.legalName,
      companyNumber: row.companyNumber,
      mainContact: row.mainContact,
      contactRole: row.contactRole,
      contactEmail: row.contactEmail,
      contactPhone: row.contactPhone,
      addressLine1: row.addressLine1,
      addressLine2: row.addressLine2,
      town: row.town,
      postcode: row.postcode,
      website: row.website,
      status: row.status,
      notes: row.notes,
    });
    setError(null);
    setSuccess(null);
    setShowForm(true);
    setExpandedId(row.id);
  }

  function buildInput(): EmployerInput | null {
    if (!form.name.trim() || !form.mainContact.trim()) {
      setError("Garage name and main contact are required.");
      return null;
    }
    if (!form.addressLine1.trim() || !form.town.trim() || !form.postcode.trim()) {
      setError("Address line 1, town and postcode are required.");
      return null;
    }
    return {
      ...form,
      name: form.name,
      legalName: form.legalName,
      companyNumber: form.companyNumber,
      mainContact: form.mainContact,
      contactRole: form.contactRole,
      contactEmail: form.contactEmail,
      contactPhone: form.contactPhone,
      addressLine1: form.addressLine1,
      addressLine2: form.addressLine2,
      town: form.town,
      postcode: form.postcode,
      website: form.website,
      notes: form.notes,
    };
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    const input = buildInput();
    if (!input) return;
    try {
      if (editingId) {
        await updateEmployer(editingId, input);
        setSuccess(`Updated ${input.name}.`);
        setExpandedId(editingId);
      } else {
        const created = await createEmployer(input);
        setSuccess(`Added garage ${input.name}.`);
        setExpandedId(created.id);
      }
      setShowForm(false);
      setEditingId(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to save garage.");
    }
  }

  return (
    <ApprenticePageShell
      eyebrow="Administration"
      title="Employer Records"
      description="Garage and workplace details, plus which apprentices are linked to each one."
      actions={
        <button type="button" className={styles.primaryBtn} onClick={openCreate}>
          Add garage
        </button>
      }
    >
      <div className={styles.stack}>
        {success ? <p className={styles.success}>{success}</p> : null}

        {showForm ? (
          <form className={styles.formStack} onSubmit={submit}>
            <section className={styles.formGroup}>
              <div className={styles.formGroupHead}>
                <h2 className={styles.formGroupTitle}>
                  {editingId ? "Edit garage" : "Add garage"}
                </h2>
                <span className={styles.formGroupBadge}>
                  {editingId ? "Existing record" : "New workplace"}
                </span>
              </div>
              <p className={styles.formGroupMeta}>
                Capture the workplace details used for visits, contacts and
                enrolments. Apprentices are linked through Apprentice Enrolments —
                not by programme list here.
              </p>

              <div className={styles.formGrid}>
                <label className={styles.field}>
                  <span>
                    Garage / trading name{" "}
                    <em className={styles.fieldRequired}>required</em>
                  </span>
                  <input
                    value={form.name}
                    onChange={(e) =>
                      setForm((prev) => ({ ...prev, name: e.target.value }))
                    }
                    required
                  />
                </label>
                <label className={styles.field}>
                  <span>Legal company name</span>
                  <input
                    value={form.legalName}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        legalName: e.target.value,
                      }))
                    }
                    placeholder="If different from trading name"
                  />
                </label>
                <label className={styles.field}>
                  <span>Status</span>
                  <select
                    value={form.status}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        status: e.target.value as "active" | "inactive",
                      }))
                    }
                  >
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </label>
                <label className={`${styles.field} ${styles.fieldWide}`}>
                  <span>Website</span>
                  <input
                    value={form.website}
                    onChange={(e) =>
                      setForm((prev) => ({ ...prev, website: e.target.value }))
                    }
                    placeholder="https://"
                  />
                </label>
              </div>
            </section>

            <section className={styles.formGroup}>
              <div className={styles.formGroupHead}>
                <h2 className={styles.formGroupTitle}>Address</h2>
                <span className={styles.formGroupBadge}>Visit location</span>
              </div>
              <div className={styles.formGrid}>
                <label className={styles.field}>
                  <span>
                    Address line 1{" "}
                    <em className={styles.fieldRequired}>required</em>
                  </span>
                  <input
                    value={form.addressLine1}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        addressLine1: e.target.value,
                      }))
                    }
                    required
                  />
                </label>
                <label className={styles.field}>
                  <span>Address line 2</span>
                  <input
                    value={form.addressLine2}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        addressLine2: e.target.value,
                      }))
                    }
                  />
                </label>
                <label className={styles.field}>
                  <span>
                    Town / city{" "}
                    <em className={styles.fieldRequired}>required</em>
                  </span>
                  <input
                    value={form.town}
                    onChange={(e) =>
                      setForm((prev) => ({ ...prev, town: e.target.value }))
                    }
                    required
                  />
                </label>
                <label className={styles.field}>
                  <span>
                    Postcode{" "}
                    <em className={styles.fieldRequired}>required</em>
                  </span>
                  <input
                    value={form.postcode}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        postcode: e.target.value,
                      }))
                    }
                    required
                  />
                </label>
              </div>
            </section>

            <section className={styles.formGroup}>
              <div className={styles.formGroupHead}>
                <h2 className={styles.formGroupTitle}>Main contact</h2>
                <span className={styles.formGroupBadge}>Workplace</span>
              </div>
              <div className={styles.formGrid}>
                <label className={styles.field}>
                  <span>
                    Main contact{" "}
                    <em className={styles.fieldRequired}>required</em>
                  </span>
                  <input
                    value={form.mainContact}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        mainContact: e.target.value,
                      }))
                    }
                    required
                  />
                </label>
                <label className={styles.field}>
                  <span>Contact role</span>
                  <input
                    value={form.contactRole}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        contactRole: e.target.value,
                      }))
                    }
                    placeholder="e.g. Workplace mentor"
                  />
                </label>
                <label className={styles.field}>
                  <span>Contact email</span>
                  <input
                    type="email"
                    value={form.contactEmail}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        contactEmail: e.target.value,
                      }))
                    }
                  />
                </label>
                <label className={styles.field}>
                  <span>Contact phone</span>
                  <input
                    value={form.contactPhone}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        contactPhone: e.target.value,
                      }))
                    }
                  />
                </label>
              </div>
            </section>

            <section className={styles.formGroup}>
              <div className={styles.formGroupHead}>
                <h2 className={styles.formGroupTitle}>Notes</h2>
                <span className={styles.formGroupBadge}>Optional</span>
              </div>
              <label className={styles.field}>
                <span>Visit notes</span>
                <textarea
                  value={form.notes}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, notes: e.target.value }))
                  }
                  placeholder="Visit notes, access info, parking…"
                />
                <p className={styles.fieldHint}>
                  Anything useful for tutors or assessors visiting this garage.
                </p>
              </label>
            </section>

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
                {editingId ? "Save changes" : "Save garage"}
              </button>
            </div>
          </form>
        ) : null}

        <div className={styles.searchBlock}>
          <div className={styles.searchModeRow}>
            <p className={styles.searchModeLabel}>Search by</p>
            <div
              className={styles.searchModeTabs}
              role="group"
              aria-label="Search garages by"
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
              {query.trim()
                ? `Showing ${filtered.length} of ${totalGarages}`
                : `${totalGarages} garage${totalGarages === 1 ? "" : "s"}`}
            </p>
          </div>
          <label className={styles.searchField}>
            <span>Search garages</span>
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={activeSearch.placeholder}
            />
          </label>
        </div>

        {filtered.length === 0 ? (
          <p className={styles.empty}>No garages match this search.</p>
        ) : (
          <div className={styles.employerList}>
            {filtered.map((row) => {
              const linked = apprenticesForEmployer(store.enrolments, row.id);
              const open = expandedId === row.id;
              const selectedHere = linked.find((l) => l.id === selectedApprenticeId);
              const tone =
                row.status !== "active"
                  ? "neutral"
                  : linked.length > 0
                    ? "green"
                    : "amber";
              return (
                <article
                  key={row.id}
                  className={styles.employerCard}
                  data-tone={tone}
                  data-open={open ? "true" : "false"}
                  data-menu-open={apprenticeMenuId === row.id ? "true" : "false"}
                  role="button"
                  tabIndex={0}
                  aria-expanded={open}
                  aria-label={`${open ? "Collapse" : "Expand"} details for ${row.name}`}
                  onClick={() =>
                    setExpandedId((current) =>
                      current === row.id ? null : row.id,
                    )
                  }
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      setExpandedId((current) =>
                        current === row.id ? null : row.id,
                      );
                    }
                  }}
                >
                  <div className={styles.employerCardHeader}>
                    <div className={styles.employerCardMain}>
                      <strong className={styles.employerName}>{row.name}</strong>
                      <span>
                        {formatAddress(row) || "Address not complete"}
                      </span>
                      <span>
                        {row.mainContact}
                        {row.contactRole ? ` · ${row.contactRole}` : ""}
                        {row.contactPhone ? ` · ${row.contactPhone}` : ""}
                      </span>
                    </div>

                    <div
                      className={styles.employerPillColumn}
                      onClick={(event) => event.stopPropagation()}
                      onKeyDown={(event) => event.stopPropagation()}
                    >
                      <button
                        type="button"
                        className={styles.employerStatusToggle}
                        data-active={
                          row.status === "active" ? "true" : "false"
                        }
                        aria-pressed={row.status === "active"}
                        aria-label={`${row.status === "active" ? "Deactivate" : "Activate"} ${row.name}`}
                        title={`Click to ${row.status === "active" ? "deactivate" : "activate"} this garage`}
                        onClick={() => {
                          const nextStatus =
                            row.status === "active" ? "inactive" : "active";
                          void updateEmployer(row.id, { status: nextStatus });
                          setSuccess(`${row.name} is now ${nextStatus}.`);
                        }}
                      >
                        {row.status === "active" ? "Active" : "Inactive"}
                      </button>

                      {linked.length === 0 ? (
                        <span
                          className={styles.employerApprenticePill}
                          data-has="false"
                        >
                          No apprentices
                        </span>
                      ) : (
                        <div
                          className={styles.employerApprenticeMenu}
                          ref={
                            apprenticeMenuId === row.id
                              ? apprenticeMenuRef
                              : undefined
                          }
                        >
                          <button
                            type="button"
                            className={styles.employerApprenticePill}
                            data-has="true"
                            data-open={
                              apprenticeMenuId === row.id ? "true" : "false"
                            }
                            aria-haspopup="listbox"
                            aria-expanded={apprenticeMenuId === row.id}
                            onClick={() =>
                              setApprenticeMenuId((current) =>
                                current === row.id ? null : row.id,
                              )
                            }
                          >
                            <span>
                              {selectedHere
                                ? selectedHere.displayName
                                : linked.length === 1
                                  ? "1 apprentice"
                                  : `${linked.length} apprentices`}
                            </span>
                            <span aria-hidden>▾</span>
                          </button>
                          {apprenticeMenuId === row.id ? (
                            <ul
                              className={styles.employerApprenticeDropdown}
                              role="listbox"
                              aria-label={`Apprentices at ${row.name}`}
                            >
                              {linked.map((apprentice) => (
                                <li
                                  key={apprentice.id}
                                  role="option"
                                  aria-selected={
                                    selectedApprenticeId === apprentice.id
                                  }
                                >
                                  <button
                                    type="button"
                                    className={styles.employerApprenticeOption}
                                    data-selected={
                                      selectedApprenticeId === apprentice.id
                                        ? "true"
                                        : "false"
                                    }
                                    onClick={() => {
                                      setSelectedApprenticeId(apprentice.id);
                                      setExpandedId(row.id);
                                      setApprenticeMenuId(null);
                                      setSuccess(
                                        `Selected ${apprentice.displayName} at ${row.name}.`,
                                      );
                                    }}
                                  >
                                    <strong>{apprentice.displayName}</strong>
                                    <span>
                                      {apprentice.kind === "new_starter"
                                        ? "New starter"
                                        : "Currently studying"}
                                      {" · "}
                                      {apprentice.programmeName}
                                    </span>
                                  </button>
                                </li>
                              ))}
                            </ul>
                          ) : null}
                        </div>
                      )}
                    </div>
                  </div>

                  {open ? (
                    <div
                      className={styles.employerCardBody}
                      onClick={(event) => event.stopPropagation()}
                      onKeyDown={(event) => event.stopPropagation()}
                    >
                      <div className={styles.employerDetailGrid}>
                        <EmployerInlineField
                          label="Trading name"
                          value={row.name}
                          onCommit={(next) =>
                            void updateEmployer(row.id, { name: next })
                          }
                        />
                        <EmployerInlineField
                          label="Legal name"
                          value={row.legalName}
                          placeholder="If different from trading name"
                          onCommit={(next) =>
                            void updateEmployer(row.id, { legalName: next })
                          }
                        />
                        <EmployerInlineField
                          label="Website"
                          value={row.website}
                          type="url"
                          placeholder="https://"
                          onCommit={(next) =>
                            void updateEmployer(row.id, { website: next })
                          }
                        />
                        <EmployerInlineField
                          label="Address line 1"
                          value={row.addressLine1}
                          onCommit={(next) =>
                            void updateEmployer(row.id, { addressLine1: next })
                          }
                        />
                        <EmployerInlineField
                          label="Address line 2"
                          value={row.addressLine2}
                          onCommit={(next) =>
                            void updateEmployer(row.id, { addressLine2: next })
                          }
                        />
                        <EmployerInlineField
                          label="Town / city"
                          value={row.town}
                          onCommit={(next) =>
                            void updateEmployer(row.id, { town: next })
                          }
                        />
                        <EmployerInlineField
                          label="Postcode"
                          value={row.postcode}
                          onCommit={(next) =>
                            void updateEmployer(row.id, { postcode: next })
                          }
                        />
                        <EmployerInlineField
                          label="Main contact"
                          value={row.mainContact}
                          onCommit={(next) =>
                            void updateEmployer(row.id, { mainContact: next })
                          }
                        />
                        <EmployerInlineField
                          label="Contact role"
                          value={row.contactRole}
                          onCommit={(next) =>
                            void updateEmployer(row.id, { contactRole: next })
                          }
                        />
                        <EmployerInlineField
                          label="Email"
                          value={row.contactEmail}
                          type="email"
                          onCommit={(next) =>
                            void updateEmployer(row.id, { contactEmail: next })
                          }
                        />
                        <EmployerInlineField
                          label="Phone"
                          value={row.contactPhone}
                          type="tel"
                          onCommit={(next) =>
                            void updateEmployer(row.id, { contactPhone: next })
                          }
                        />
                        <EmployerInlineField
                          label="Notes"
                          value={row.notes}
                          wide
                          multiline
                          placeholder="Visit notes, access details, anything useful…"
                          onCommit={(next) =>
                            void updateEmployer(row.id, { notes: next })
                          }
                        />
                      </div>

                      <div className={styles.linkedApprentices}>
                        <div className={styles.linkedApprenticesHead}>
                          <h3>Linked apprentices</h3>
                          <Link
                            href="/administration/enrolments"
                            className={styles.secondaryBtn}
                          >
                            Manage enrolments
                          </Link>
                        </div>
                        {linked.length === 0 ? (
                          <p className={styles.empty}>
                            No apprentices linked to this garage yet. Add them
                            under Apprentice Enrolments and choose this employer.
                          </p>
                        ) : (
                          <ul className={styles.linkedApprenticeList}>
                            {linked.map((apprentice) => (
                              <li
                                key={apprentice.id}
                                data-selected={
                                  selectedApprenticeId === apprentice.id
                                    ? "true"
                                    : "false"
                                }
                              >
                                <button
                                  type="button"
                                  className={styles.linkedApprenticeSelect}
                                  onClick={() => {
                                    setSelectedApprenticeId(apprentice.id);
                                    setSuccess(
                                      `Selected ${apprentice.displayName} at ${row.name}.`,
                                    );
                                  }}
                                >
                                  <div className={styles.linkedApprenticeMain}>
                                    <strong>{apprentice.displayName}</strong>
                                    <span>
                                      {apprentice.kind === "new_starter"
                                        ? "New starter"
                                        : "Currently studying"}
                                      {apprentice.kind === "currently_studying" &&
                                      apprentice.programmeYear != null
                                        ? ` · Y${apprentice.programmeYear} · W${apprentice.programmeWeek}`
                                        : ` · starts ${apprentice.startDate}`}
                                      {" · "}
                                      {apprentice.programmeName}
                                    </span>
                                  </div>
                                  <ApprenticeStatusChip
                                    tone={statusTone(apprentice.status)}
                                  >
                                    {apprentice.status.replace("_", " ")}
                                  </ApprenticeStatusChip>
                                </button>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>

                      <div className={styles.formActions}>
                        <button
                          type="button"
                          className={styles.secondaryBtn}
                          onClick={() => openEdit(row)}
                        >
                          Open full edit form
                        </button>
                      </div>
                    </div>
                  ) : null}
                </article>
              );
            })}
          </div>
        )}
      </div>
    </ApprenticePageShell>
  );
}
