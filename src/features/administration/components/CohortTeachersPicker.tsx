"use client";

import { Select } from "@/components/ui/Select";
import { listTutorStaff } from "../domain/tutor-options";
import type { AdminPortalUser } from "../domain/types";
import styles from "../screens/admin-pages.module.css";

type Props = {
  users: AdminPortalUser[];
  selected: string[];
  disabled?: boolean;
  onChange: (teacherNames: string[]) => void;
};

/**
 * Admin picks which tutors teach this intake — not every tutor by default.
 */
export function CohortTeachersPicker({
  users,
  selected,
  disabled,
  onChange,
}: Props) {
  const tutors = listTutorStaff(users);
  const selectedSet = new Set(selected.map((n) => n.toLowerCase()));
  const available = tutors.filter(
    (t) => !selectedSet.has(t.displayName.toLowerCase()),
  );

  // Keep any selected names that are no longer Tutor-role staff (still show chip).
  const orphanSelected = selected.filter(
    (name) =>
      !tutors.some((t) => t.displayName.toLowerCase() === name.toLowerCase()),
  );

  function addTeacher(name: string) {
    const trimmed = name.trim();
    if (!trimmed) return;
    if (selectedSet.has(trimmed.toLowerCase())) return;
    onChange([...selected, trimmed]);
  }

  function removeTeacher(name: string) {
    onChange(selected.filter((n) => n !== name));
  }

  return (
    <div className={styles.stack} style={{ gap: "0.65rem" }}>
      {selected.length === 0 ? (
        <p className={styles.fieldHint}>
          No teachers selected yet. Add only the tutors who teach this intake.
        </p>
      ) : (
        <ul className={styles.linkedApprenticeList}>
          {selected.map((name) => (
            <li key={name}>
              <div className={styles.linkedApprenticeRow}>
                <div className={styles.linkedApprenticeMain}>
                  <strong>{name}</strong>
                  {orphanSelected.includes(name) ? (
                    <span>Not on current Tutor staff list</span>
                  ) : (
                    <span>Teaches this cohort</span>
                  )}
                </div>
                <div className={styles.linkedApprenticeAside}>
                  {!disabled ? (
                    <button
                      type="button"
                      className={styles.secondaryBtn}
                      onClick={() => removeTeacher(name)}
                    >
                      Remove
                    </button>
                  ) : null}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      {!disabled ? (
        <label className={styles.field}>
          <span>Add a teacher</span>
          <Select
            value=""
            disabled={available.length === 0}
            placeholder={
              available.length === 0
                ? selected.length
                  ? "All tutors already added"
                  : "No tutors available"
                : "Choose tutor to add…"
            }
            options={available.map((tutor) => ({
              value: tutor.displayName,
              label: tutor.displayName,
            }))}
            onChange={(name) => addTeacher(name)}
          />
        </label>
      ) : null}
    </div>
  );
}
