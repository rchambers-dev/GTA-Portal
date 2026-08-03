"use client";

import type { TaskFieldDef } from "@/features/programme-delivery/domain/task-schema";
import {
  parseActionRows,
  parseDifficultyFeedback,
  parseJsonList,
  parsePartsRows,
  parseRatingRows,
  serializeDifficultyFeedback,
} from "@/features/programme-delivery/domain/task-schema";
import styles from "@/features/programme-delivery/screens/programme-delivery.module.css";

export function fieldRole(field: TaskFieldDef): "apprentice" | "mentor" | "trainer" | "assessor" {
  return field.filledBy ?? field.signOffRole ?? "apprentice";
}

export function isApprenticeEditableField(field: TaskFieldDef): boolean {
  return fieldRole(field) === "apprentice";
}

export function staffRoleHint(field: TaskFieldDef): string {
  const role = fieldRole(field);
  if (role === "mentor") return "Your workplace mentor completes this after review.";
  if (role === "assessor") return "Your assessor completes this after review.";
  return "Your trainer / assessor completes this after review.";
}

export function WrenchCheckbox({
  checked,
  disabled,
  onChange,
  label,
}: {
  checked: boolean;
  disabled?: boolean;
  onChange: (next: boolean) => void;
  label: string;
}) {
  return (
    <button
      type="button"
      className={`${styles.wrenchCheck}${disabled ? ` ${styles.wrenchCheckDisabled}` : ""}${checked ? ` ${styles.wrenchCheckOn}` : ""}`}
      disabled={disabled}
      aria-pressed={checked}
      onClick={() => {
        if (disabled) return;
        onChange(!checked);
      }}
    >
      <span className={styles.wrenchCheckBox} aria-hidden>
        <svg
          className={styles.wrenchIcon}
          viewBox="0 0 24 24"
          width="20"
          height="20"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.25"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
        >
          <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.1-3.1a5.5 5.5 0 0 1-7.3 7.3l-6.6 6.6a2 2 0 0 1-2.8-2.8l6.6-6.6a5.5 5.5 0 0 1 7.3-7.3l-3.1 3.1z" />
        </svg>
      </span>
      <span>{label}</span>
    </button>
  );
}

export function TaskFieldInput({
  field,
  value,
  onChange,
  disabled,
  staffLocked,
}: {
  field: TaskFieldDef;
  value: string;
  onChange: (next: string) => void;
  disabled?: boolean;
  staffLocked?: boolean;
}) {
  const locked = Boolean(disabled || staffLocked);
  const wrapClass = `${styles.field}${staffLocked ? ` ${styles.fieldStaffOnly}` : ""}`;

  if (field.type === "heading" || field.type === "description") {
    return <p className={styles.purposeBody}>{field.label}</p>;
  }

  if (field.type === "sign_off") {
    return (
      <div className={wrapClass}>
        <span className={styles.fieldLabel}>{field.label}</span>
        <p className={staffLocked ? styles.fieldStaffNote : styles.fieldHint}>
          {staffLocked
            ? staffRoleHint(field)
            : `Role: ${field.signOffRole ?? "signer"} — confirm below when ready.`}
        </p>
        <WrenchCheckbox
          checked={value === "signed"}
          disabled={locked}
          onChange={(next) => onChange(next ? "signed" : "")}
          label="I confirm / sign"
        />
      </div>
    );
  }

  if (field.type === "checkbox_group") {
    const selected = parseJsonList(value);
    return (
      <div className={wrapClass}>
        <span className={styles.fieldLabel}>{field.label}</span>
        {staffLocked ? (
          <p className={styles.fieldStaffNote}>{staffRoleHint(field)}</p>
        ) : field.hint ? (
          <p className={styles.fieldHint}>{field.hint}</p>
        ) : null}
        <div className={styles.choiceStack}>
          {(field.options ?? []).map((opt) => {
            const checked = selected.includes(opt);
            return (
              <WrenchCheckbox
                key={opt}
                checked={checked}
                disabled={locked}
                label={opt}
                onChange={(next) => {
                  const set = new Set(selected);
                  if (next) set.add(opt);
                  else set.delete(opt);
                  onChange(JSON.stringify([...set]));
                }}
              />
            );
          })}
        </div>
      </div>
    );
  }

  if (field.type === "difficulty_feedback") {
    const parsed = parseDifficultyFeedback(value);
    const whyId = `${field.key}-why`;
    return (
      <div className={wrapClass}>
        <span className={styles.fieldLabel}>{field.label}</span>
        {staffLocked ? (
          <p className={styles.fieldStaffNote}>{staffRoleHint(field)}</p>
        ) : field.hint ? (
          <p className={styles.fieldHint}>{field.hint}</p>
        ) : null}
        <div className={styles.difficultySplit}>
          <div
            className={styles.choiceStack}
            role="radiogroup"
            aria-label={field.label}
          >
            {(field.options ?? []).map((opt) => (
              <label key={opt} className={styles.radioOption}>
                <input
                  type="radio"
                  name={field.key}
                  value={opt}
                  checked={parsed.rating === opt}
                  disabled={locked}
                  onChange={() =>
                    onChange(
                      serializeDifficultyFeedback({
                        rating: opt,
                        why: parsed.why,
                      }),
                    )
                  }
                />
                <span>{opt}</span>
              </label>
            ))}
          </div>
          <div className={styles.difficultyWhy}>
            <label className={styles.fieldLabel} htmlFor={whyId}>
              Why?
            </label>
            <textarea
              id={whyId}
              className={styles.textarea}
              value={parsed.why}
              disabled={locked}
              readOnly={staffLocked}
              placeholder={
                staffLocked
                  ? "Waiting for staff…"
                  : "Briefly say why you chose that rating"
              }
              rows={5}
              onChange={(e) =>
                onChange(
                  serializeDifficultyFeedback({
                    rating: parsed.rating,
                    why: e.target.value,
                  }),
                )
              }
            />
          </div>
        </div>
      </div>
    );
  }

  if (field.type === "radio_group") {
    return (
      <div className={wrapClass}>
        <span className={styles.fieldLabel}>{field.label}</span>
        {staffLocked ? (
          <p className={styles.fieldStaffNote}>{staffRoleHint(field)}</p>
        ) : field.hint ? (
          <p className={styles.fieldHint}>{field.hint}</p>
        ) : null}
        <div className={styles.choiceStack} role="radiogroup" aria-label={field.label}>
          {(field.options ?? []).map((opt) => (
            <label key={opt} className={styles.radioOption}>
              <input
                type="radio"
                name={field.key}
                value={opt}
                checked={value === opt}
                disabled={locked}
                onChange={() => onChange(opt)}
              />
              <span>{opt}</span>
            </label>
          ))}
        </div>
      </div>
    );
  }

  if (field.type === "rating_rows") {
    const rows = parseRatingRows(value, field.rowCount ?? 6);
    return (
      <div className={wrapClass}>
        <span className={styles.fieldLabel}>{field.label}</span>
        {staffLocked ? (
          <p className={styles.fieldStaffNote}>{staffRoleHint(field)}</p>
        ) : field.hint ? (
          <p className={styles.fieldHint}>{field.hint}</p>
        ) : null}
        <div className={styles.tableScroll}>
          <table className={styles.dataTable}>
            <thead>
              <tr>
                <th>Knowledge / skill / behaviour</th>
                <th>Before (1–5)</th>
                <th>Now (1–5)</th>
                <th>Evidence or example</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => (
                <tr key={i}>
                  <td>
                    <input
                      className={styles.input}
                      value={row.area}
                      disabled={locked}
                      readOnly={staffLocked}
                      onChange={(e) => {
                        const next = [...rows];
                        next[i] = { ...next[i], area: e.target.value };
                        onChange(JSON.stringify(next));
                      }}
                    />
                  </td>
                  <td>
                    <input
                      className={styles.input}
                      type="number"
                      min={1}
                      max={5}
                      value={row.before}
                      disabled={locked}
                      readOnly={staffLocked}
                      onChange={(e) => {
                        const next = [...rows];
                        next[i] = { ...next[i], before: e.target.value };
                        onChange(JSON.stringify(next));
                      }}
                    />
                  </td>
                  <td>
                    <input
                      className={styles.input}
                      type="number"
                      min={1}
                      max={5}
                      value={row.now}
                      disabled={locked}
                      readOnly={staffLocked}
                      onChange={(e) => {
                        const next = [...rows];
                        next[i] = { ...next[i], now: e.target.value };
                        onChange(JSON.stringify(next));
                      }}
                    />
                  </td>
                  <td>
                    <input
                      className={styles.input}
                      value={row.evidence}
                      disabled={locked}
                      readOnly={staffLocked}
                      onChange={(e) => {
                        const next = [...rows];
                        next[i] = { ...next[i], evidence: e.target.value };
                        onChange(JSON.stringify(next));
                      }}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  if (field.type === "action_rows") {
    const rows = parseActionRows(value, field.rowCount ?? 3);
    return (
      <div className={wrapClass}>
        <span className={styles.fieldLabel}>{field.label}</span>
        {staffLocked ? (
          <p className={styles.fieldStaffNote}>{staffRoleHint(field)}</p>
        ) : field.hint ? (
          <p className={styles.fieldHint}>{field.hint}</p>
        ) : null}
        <div className={styles.tableScroll}>
          <table className={styles.dataTable}>
            <thead>
              <tr>
                <th>No.</th>
                <th>Agreed action / development objective</th>
                <th>Support or opportunity needed</th>
                <th>Owner / review date</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => (
                <tr key={i}>
                  <td>{i + 1}</td>
                  <td>
                    <input
                      className={styles.input}
                      value={row.action}
                      disabled={locked}
                      readOnly={staffLocked}
                      onChange={(e) => {
                        const next = [...rows];
                        next[i] = { ...next[i], action: e.target.value };
                        onChange(JSON.stringify(next));
                      }}
                    />
                  </td>
                  <td>
                    <input
                      className={styles.input}
                      value={row.support}
                      disabled={locked}
                      readOnly={staffLocked}
                      onChange={(e) => {
                        const next = [...rows];
                        next[i] = { ...next[i], support: e.target.value };
                        onChange(JSON.stringify(next));
                      }}
                    />
                  </td>
                  <td>
                    <input
                      className={styles.input}
                      value={row.ownerReview}
                      disabled={locked}
                      readOnly={staffLocked}
                      onChange={(e) => {
                        const next = [...rows];
                        next[i] = { ...next[i], ownerReview: e.target.value };
                        onChange(JSON.stringify(next));
                      }}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  if (field.type === "parts_rows") {
    const rows = parsePartsRows(value, field.rowCount ?? 4);
    return (
      <div className={wrapClass}>
        <span className={styles.fieldLabel}>{field.label}</span>
        {staffLocked ? (
          <p className={styles.fieldStaffNote}>{staffRoleHint(field)}</p>
        ) : field.hint ? (
          <p className={styles.fieldHint}>{field.hint}</p>
        ) : null}
        <div className={styles.tableScroll}>
          <table className={styles.dataTable}>
            <thead>
              <tr>
                <th>Qty</th>
                <th>Part / material description</th>
                <th>Part no.</th>
                <th>Supplier / notes</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => (
                <tr key={i}>
                  <td>
                    <input
                      className={styles.input}
                      value={row.qty}
                      disabled={locked}
                      readOnly={staffLocked}
                      onChange={(e) => {
                        const next = [...rows];
                        next[i] = { ...next[i], qty: e.target.value };
                        onChange(JSON.stringify(next));
                      }}
                    />
                  </td>
                  <td>
                    <input
                      className={styles.input}
                      value={row.description}
                      disabled={locked}
                      readOnly={staffLocked}
                      onChange={(e) => {
                        const next = [...rows];
                        next[i] = { ...next[i], description: e.target.value };
                        onChange(JSON.stringify(next));
                      }}
                    />
                  </td>
                  <td>
                    <input
                      className={styles.input}
                      value={row.partNo}
                      disabled={locked}
                      readOnly={staffLocked}
                      onChange={(e) => {
                        const next = [...rows];
                        next[i] = { ...next[i], partNo: e.target.value };
                        onChange(JSON.stringify(next));
                      }}
                    />
                  </td>
                  <td>
                    <input
                      className={styles.input}
                      value={row.supplier}
                      disabled={locked}
                      readOnly={staffLocked}
                      onChange={(e) => {
                        const next = [...rows];
                        next[i] = { ...next[i], supplier: e.target.value };
                        onChange(JSON.stringify(next));
                      }}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  if (field.type === "textarea" || field.type === "knowledge_question") {
    return (
      <div className={wrapClass}>
        <label className={styles.fieldLabel} htmlFor={field.key}>
          {field.label}
        </label>
        {staffLocked ? (
          <p className={styles.fieldStaffNote}>{staffRoleHint(field)}</p>
        ) : field.hint ? (
          <p className={styles.fieldHint}>{field.hint}</p>
        ) : null}
        <textarea
          id={field.key}
          className={styles.textarea}
          value={value}
          disabled={locked}
          readOnly={staffLocked}
          placeholder={staffLocked ? "Waiting for staff…" : undefined}
          onChange={(e) => onChange(e.target.value)}
        />
      </div>
    );
  }

  return (
    <div className={wrapClass}>
      <label className={styles.fieldLabel} htmlFor={field.key}>
        {field.label}
      </label>
      {staffLocked ? (
        <p className={styles.fieldStaffNote}>{staffRoleHint(field)}</p>
      ) : field.hint ? (
        <p className={styles.fieldHint}>{field.hint}</p>
      ) : null}
      <input
        id={field.key}
        className={styles.input}
        type={
          field.type === "number"
            ? "number"
            : field.type === "date"
              ? "date"
              : "text"
        }
        value={value}
        disabled={locked}
        readOnly={staffLocked}
        placeholder={staffLocked ? "Waiting for staff…" : undefined}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}
