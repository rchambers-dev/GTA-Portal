"use client";

import { useMemo, useState } from "react";
import { addDays } from "../domain/plan-due";
import styles from "./tutor-form.module.css";

function uk(iso: string) {
  const [year, month, day] = iso.split("-");
  return `${day}/${month}/${year}`;
}

function labelFor(iso: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return "Choose a date";
  const weekday = new Intl.DateTimeFormat("en-GB", { weekday: "short", timeZone: "UTC" }).format(new Date(`${iso}T00:00:00Z`));
  return `${weekday} ${uk(iso)}`;
}

function monthTitle(monthKey: string) {
  const [year, month] = monthKey.split("-").map(Number);
  if (!year || !month) return "";
  return new Intl.DateTimeFormat("en-GB", { month: "long", year: "numeric", timeZone: "UTC" }).format(
    new Date(Date.UTC(year, month - 1, 1)),
  );
}

function shiftMonth(monthKey: string, delta: number) {
  const [year, month] = monthKey.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1 + delta, 1));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

/** The Review Assistant target-date calendar. Green days are inside today and the 10-week window. */
export function TutorDatePicker({
  value,
  today,
  weeks,
  disabled,
  onChange,
}: {
  value: string;
  today: string;
  weeks: number;
  disabled?: boolean;
  onChange: (value: string) => void;
}) {
  const max = addDays(today, weeks * 7);
  const [open, setOpen] = useState(false);
  const [month, setMonth] = useState(value.slice(0, 7) || today.slice(0, 7));
  const shortcuts = [0, 2, 4, 6, 8, 10].map((step) => ({
    key: addDays(today, step * 7),
    label: step === 0 ? "Today" : `${step} weeks`,
  }));
  const cells = useMemo(() => {
    const [year, monthNumber] = month.split("-").map(Number);
    const first = new Date(Date.UTC(year, monthNumber - 1, 1));
    const lead = (first.getUTCDay() + 6) % 7;
    const last = new Date(Date.UTC(year, monthNumber, 0)).getUTCDate();
    const days: { key: string; day: number; allowed: boolean }[] = [];
    for (let day = 1; day <= last; day += 1) {
      const key = `${year}-${String(monthNumber).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
      days.push({ key, day, allowed: key >= today && key <= max });
    }
    return { lead, days };
  }, [max, month, today]);

  function choose(key: string) {
    if (key < today || key > max) return;
    onChange(key);
    setMonth(key.slice(0, 7));
    setOpen(false);
  }

  return (
    <div className={styles.datePicker}>
      <button
        type="button"
        className={`${styles.dateTrigger} ${value ? "" : styles.dateEmpty}`}
        disabled={disabled}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen(true)}
      >
        {labelFor(value)}
      </button>
      {open && !disabled ? (
        <div className={styles.datePopup}>
          <button type="button" className={styles.dateBackdrop} aria-label="Close date picker" onClick={() => setOpen(false)} />
          <div className={styles.dateMenu} role="dialog" aria-label="Choose a target date">
            <p className={styles.dateWindow}>Pick a date between {uk(today)} and {uk(max)}.</p>
            <div className={styles.dateShortcuts}>
              {shortcuts.map((item) => (
                <button
                  key={item.key}
                  type="button"
                  className={`${styles.dateShortcut} ${item.key === value ? styles.dateOn : ""}`}
                  disabled={item.key < today || item.key > max}
                  onClick={() => choose(item.key)}
                >
                  {item.label}
                </button>
              ))}
            </div>
            <div className={styles.dateHead}>
              <button type="button" className={styles.dateNav} aria-label="Previous month" onClick={() => setMonth(shiftMonth(month, -1))}>‹</button>
              <strong>{monthTitle(month)}</strong>
              <button type="button" className={styles.dateNav} aria-label="Next month" onClick={() => setMonth(shiftMonth(month, 1))}>›</button>
            </div>
            <div className={styles.dateGrid}>
              {["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"].map((day) => (
                <span key={day} className={styles.dateDow}>{day}</span>
              ))}
              {Array.from({ length: cells.lead }, (_, index) => (
                <span key={`empty-${index}`} />
              ))}
              {cells.days.map((day) => (
                <button
                  key={day.key}
                  type="button"
                  disabled={!day.allowed}
                  className={`${styles.dateCell} ${day.allowed ? styles.dateOpen : styles.dateOff} ${day.key === today ? styles.dateToday : ""} ${day.key === value ? styles.dateOn : ""}`}
                  onClick={() => choose(day.key)}
                >
                  {day.day}
                </button>
              ))}
            </div>
            <p className={styles.dateLegend}><span className={styles.dateSwatch} /> Green days can be picked</p>
          </div>
        </div>
      ) : null}
    </div>
  );
}
