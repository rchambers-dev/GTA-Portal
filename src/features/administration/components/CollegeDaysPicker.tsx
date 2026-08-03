"use client";

import {
  COLLEGE_WEEKDAYS,
  parseCollegeDays,
  toggleCollegeDay,
  type CollegeWeekday,
} from "../domain/college-days";
import styles from "../screens/admin-pages.module.css";

type CollegeDaysPickerProps = {
  value: string;
  onChange: (next: string) => void;
  disabled?: boolean;
  /** Multi = several days; single = one college day for this group. */
  mode?: "multi" | "single";
  /** Days that cannot be selected (e.g. already used by this tutor). */
  disabledDays?: readonly CollegeWeekday[];
  "aria-label"?: string;
};

export function CollegeDaysPicker({
  value,
  onChange,
  disabled = false,
  mode = "multi",
  disabledDays = [],
  "aria-label": ariaLabel = "College days",
}: CollegeDaysPickerProps) {
  const selected = parseCollegeDays(value);
  const blocked = new Set(disabledDays);

  return (
    <div
      className={styles.dayPicker}
      role="group"
      aria-label={ariaLabel}
      data-disabled={disabled ? "true" : "false"}
    >
      {COLLEGE_WEEKDAYS.map((day: CollegeWeekday) => {
        const isSelected = selected.includes(day);
        const isBlocked = blocked.has(day);
        const dayDisabled = disabled || isBlocked;
        return (
          <label
            key={day}
            className={styles.dayPickerOption}
            data-selected={isSelected ? "true" : "false"}
            data-disabled={dayDisabled ? "true" : "false"}
            title={
              isBlocked
                ? `${day.slice(0, 3)} already has a group for this tutor`
                : day
            }
          >
            <input
              type={mode === "single" ? "radio" : "checkbox"}
              name={mode === "single" ? "college-day" : undefined}
              checked={isSelected}
              disabled={dayDisabled}
              onChange={() => {
                if (dayDisabled) return;
                if (mode === "single") {
                  onChange(isSelected ? "" : day);
                  return;
                }
                onChange(toggleCollegeDay(value, day));
              }}
            />
            <span>{day.slice(0, 3)}</span>
          </label>
        );
      })}
    </div>
  );
}
