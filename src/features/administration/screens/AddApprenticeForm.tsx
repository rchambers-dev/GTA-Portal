"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Select } from "@/components/ui";
import { ApprenticePageShell } from "@/features/apprentice-portal/components/ApprenticePageShell";
import { addApprenticeAction } from "./add-apprentice-actions";
import {
  APPRENTICE_STATUSES,
  APPRENTICE_STATUS_LABELS,
  DEFAULT_APPRENTICE_STATUS,
  apprenticeStatusLabel,
  formatApprenticeName,
  formatProgrammeChoice,
  savedApprenticeToListItem,
  validateNewApprentice,
  type ApprenticeFieldErrors,
  type ApprenticeListItem,
  type ApprenticeProgrammeOption,
} from "../domain/apprentice-record";
import styles from "./admin-pages.module.css";

const EMPTY_FORM = {
  firstName: "",
  middleNames: "",
  lastName: "",
  programmeId: "",
  status: DEFAULT_APPRENTICE_STATUS as string,
};

export function AddApprenticeForm({
  canAdd,
  programmes,
  apprentices,
  loadError,
}: {
  canAdd: boolean;
  programmes: ApprenticeProgrammeOption[];
  apprentices: ApprenticeListItem[];
  loadError: string | null;
}) {
  const router = useRouter();
  const [form, setForm] = useState(EMPTY_FORM);
  const [fieldErrors, setFieldErrors] = useState<ApprenticeFieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [assignedGtaId, setAssignedGtaId] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [added, setAdded] = useState<ApprenticeListItem[]>([]);

  const knownIds = new Set(apprentices.map((row) => row.gtaId));
  const rows = [
    ...added.filter((row) => !knownIds.has(row.gtaId)),
    ...apprentices,
  ];

  function setField(field: keyof typeof EMPTY_FORM, value: string) {
    setForm((current) => ({ ...current, [field]: value }));
    setFieldErrors((current) => {
      if (!current[field]) return current;
      const next = { ...current };
      delete next[field];
      return next;
    });
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);
    const parsed = validateNewApprentice(form);
    if (!parsed.ok) {
      setFieldErrors(parsed.fieldErrors);
      setAssignedGtaId(null);
      return;
    }
    setFieldErrors({});
    setPending(true);
    try {
      const result = await addApprenticeAction(form);
      if (!result.ok) {
        setFieldErrors(result.fieldErrors);
        setFormError(result.formError);
        setAssignedGtaId(null);
        return;
      }
      setAssignedGtaId(result.apprentice.gtaId);
      setAdded((current) => [
        savedApprenticeToListItem(result.apprentice, programmes),
        ...current.filter((row) => row.gtaId !== result.apprentice.gtaId),
      ]);
      setForm(EMPTY_FORM);
      router.refresh();
    } catch (error) {
      setAssignedGtaId(null);
      setFormError(
        error instanceof Error
          ? error.message
          : "The apprentice could not be saved.",
      );
    } finally {
      setPending(false);
    }
  }

  return (
    <ApprenticePageShell
      eyebrow="Onboarding"
      title="Add apprentice"
      description="First name and last name are required. The database assigns the GTA ID when the apprentice is saved."
    >
      <div className={styles.stack} data-add-apprentice="live">
        {loadError ? (
          <p className={styles.error} role="alert">
            {loadError}
          </p>
        ) : null}

        {canAdd ? null : (
          <p className={styles.formGroupMeta} role="status">
            You can view apprentices. Only Administrator and Management can add one.
          </p>
        )}

        {assignedGtaId ? (
          <div
            className={styles.successPanel}
            role="status"
            data-save-result="success"
            data-assigned-gta-id={assignedGtaId}
          >
            <p className={styles.confirmTitle}>Apprentice saved</p>
            <p className={styles.successMeta}>
              The GTA ID is <strong className={styles.assignedId}>{assignedGtaId}</strong>.
            </p>
          </div>
        ) : null}

        {canAdd ? (
          <section className={styles.learnerAdd} data-add-panel="apprentice">
            <p className={styles.learnerKicker}>Manual entry</p>
            <h2 className={styles.learnerHeading}>Add apprentice</h2>
            <p className={styles.learnerMuted}>
              Middle names and programme can be left blank. Status starts as In learning.
            </p>
            <article className={styles.learnerCard}>
              <form onSubmit={onSubmit} noValidate>
                <div className={styles.learnerGrid}>
                  <TextField
                    field="firstName"
                    label="First name"
                    required
                    value={form.firstName}
                    error={fieldErrors.firstName}
                    disabled={pending}
                    autoComplete="given-name"
                    onChange={setField}
                  />
                  <TextField
                    field="lastName"
                    label="Last name"
                    required
                    value={form.lastName}
                    error={fieldErrors.lastName}
                    disabled={pending}
                    autoComplete="family-name"
                    onChange={setField}
                  />
                  <TextField
                    field="middleNames"
                    label="Middle names"
                    value={form.middleNames}
                    error={fieldErrors.middleNames}
                    disabled={pending}
                    autoComplete="additional-name"
                    onChange={setField}
                  />
                  <ChoiceField
                    field="programmeId"
                    label="Programme"
                    value={form.programmeId}
                    error={fieldErrors.programmeId}
                    disabled={pending}
                    placeholder="No programme"
                    options={[
                      { value: "", label: "No programme" },
                      ...programmes.map((programme) => ({
                        value: programme.id,
                        label: formatProgrammeChoice(
                          programme.name,
                          programme.standardCode,
                        ),
                      })),
                    ]}
                    onChange={setField}
                  />
                  <ChoiceField
                    field="status"
                    label="Status"
                    value={form.status}
                    error={fieldErrors.status}
                    disabled={pending}
                    options={APPRENTICE_STATUSES.map((status) => ({
                      value: status,
                      label: APPRENTICE_STATUS_LABELS[status],
                    }))}
                    onChange={setField}
                  />
                </div>
                {formError ? (
                  <p className={styles.error} role="alert">
                    {formError}
                  </p>
                ) : null}
                <div className={styles.learnerActions}>
                  <button type="submit" className={styles.primaryBtn} disabled={pending}>
                    {pending ? "Saving…" : "Add apprentice"}
                  </button>
                </div>
              </form>
            </article>
          </section>
        ) : null}

        <section className={styles.stack} aria-labelledby="apprentice-list-heading">
          <h2 id="apprentice-list-heading" className={styles.formGroupTitle}>
            Apprentices
          </h2>
          {rows.length === 0 ? (
            <p className={styles.empty} role="status">
              No apprentices yet.
            </p>
          ) : (
            <ul className={styles.pillList} data-apprentice-list="live">
              {rows.map((row) => (
                <li key={row.gtaId} className={`${styles.pillRow} ${styles.apprenticeRow}`}>
                  <span className={styles.pillName}>{formatApprenticeName(row)}</span>
                  <span className={styles.pillMeta}>
                    <span className={styles.assignedId}>{row.gtaId}</span>
                    <span>{row.programmeLabel ?? "No programme"}</span>
                    <span>{apprenticeStatusLabel(row.status)}</span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </ApprenticePageShell>
  );
}

type EntryField = "firstName" | "middleNames" | "lastName" | "programmeId" | "status";

function TextField({
  field,
  label,
  value,
  error,
  required = false,
  disabled,
  autoComplete,
  onChange,
}: {
  field: "firstName" | "middleNames" | "lastName";
  label: string;
  value: string;
  error?: string;
  required?: boolean;
  disabled: boolean;
  autoComplete: string;
  onChange: (field: EntryField, value: string) => void;
}) {
  const errorId = error ? `${field}-error` : undefined;
  return (
    <label className={styles.learnerField} data-entry-field={field}>
      <span>
        {label}
        {required ? <em className={styles.fieldRequired}> required</em> : null}
      </span>
      <input
        type="text"
        value={value}
        required={required}
        disabled={disabled}
        autoComplete={autoComplete}
        aria-invalid={error ? true : undefined}
        aria-describedby={errorId}
        onChange={(event) => onChange(field, event.target.value)}
      />
      {error ? (
        <p id={errorId} className={styles.error} role="alert">
          {error}
        </p>
      ) : null}
    </label>
  );
}

function ChoiceField({
  field,
  label,
  value,
  error,
  disabled,
  options,
  placeholder,
  onChange,
}: {
  field: "programmeId" | "status";
  label: string;
  value: string;
  error?: string;
  disabled: boolean;
  options: { value: string; label: string }[];
  placeholder?: string;
  onChange: (field: EntryField, value: string) => void;
}) {
  const errorId = error ? `${field}-error` : undefined;
  return (
    <div
      className={styles.learnerField}
      data-entry-field={field}
      aria-describedby={errorId}
    >
      <span id={`${field}-label`}>{label}</span>
      <Select
        aria-label={label}
        value={value}
        disabled={disabled}
        invalid={Boolean(error)}
        placeholder={placeholder}
        options={options}
        onChange={(next) => onChange(field, next)}
      />
      {error ? (
        <p id={errorId} className={styles.error} role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
