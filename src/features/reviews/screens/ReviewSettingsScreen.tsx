"use client";

import { useEffect, useState } from "react";
import { logoutAction } from "@/app/logout/actions";
import type { PlanPageData } from "../domain/plan-repository";
import { savePlanSettingsAction } from "./plan-actions";
import { ReviewFonts } from "./ReviewFonts";
import styles from "./plan.module.css";

const TABS = [
  { id: "account", label: "Account" },
  { id: "plan", label: "Plan" },
  { id: "out", label: "Out" },
  { id: "accessibility", label: "Accessibility" },
  { id: "feedback", label: "Feedback" },
] as const;

type Tab = (typeof TABS)[number]["id"];

export function ReviewSettingsScreen({
  email,
  page,
}: {
  email: string;
  page: PlanPageData;
}) {
  const [tab, setTab] = useState<Tab>("account");
  const [message, setMessage] = useState<string | null>(null);
  const [skipToday, setSkipToday] = useState(page.settings.skipToday);
  const [officePostcode, setOffice] = useState(page.settings.officePostcode);
  const [startTime, setStart] = useState(page.settings.startTime);
  const [callMinutes, setCall] = useState(page.settings.callMinutes);
  const [lunchStart, setLunch] = useState(page.settings.lunchStart);
  const [returnBy, setReturn] = useState(page.settings.returnBy);
  const [stayMinutes, setStay] = useState(page.settings.stayMinutes);
  const [emails, setEmails] = useState(page.settings.extraEmails.join(", "));
  const [hidden, setHidden] = useState(page.settings.hiddenTutorIds);
  const [outEnabled, setOut] = useState(page.settings.outEnabled);

  async function save(next: {
    skipToday?: boolean;
    officePostcode?: string;
    startTime?: string;
    callMinutes?: number;
    lunchStart?: string;
    returnBy?: string;
    stayMinutes?: number;
    extraEmails?: string;
    hiddenTutorIds?: string[];
    outEnabled?: boolean;
  }) {
    if (!page.canWrite) return;
    const result = await savePlanSettingsAction({
      skipToday: next.skipToday ?? skipToday,
      officePostcode: next.officePostcode ?? officePostcode,
      startTime: next.startTime ?? startTime,
      callMinutes: next.callMinutes ?? callMinutes,
      lunchStart: next.lunchStart ?? lunchStart,
      lunchMinutes: page.settings.lunchMinutes,
      returnBy: next.returnBy ?? returnBy,
      stayMinutes: next.stayMinutes ?? stayMinutes,
      extraEmails: next.extraEmails ?? emails,
      hiddenTutorIds: next.hiddenTutorIds ?? hidden,
      outEnabled: next.outEnabled ?? outEnabled,
    });
    setMessage(result.ok ? null : result.formError || "The settings could not be saved.");
  }

  return (
    <div className={styles.settingsPage}>
      <ReviewFonts />
      <nav className={styles.settingsNav} aria-label="Settings sections">
        {TABS.map((item) => (
          <button
            key={item.id}
            type="button"
            className={tab === item.id ? styles.settingsOn : styles.tab}
            onClick={() => setTab(item.id)}
          >
            {item.label}
          </button>
        ))}
      </nav>
      <div>
        <h1>Settings</h1>
        {message ? <p role="alert">{message}</p> : null}
        {tab === "account" ? (
          <section>
            <h2>Signed in</h2>
            <p>{email}</p>
            <form action={logoutAction}>
              <button type="submit" className={styles.solid}>Sign out</button>
            </form>
          </section>
        ) : null}
        {tab === "plan" ? (
          <form
            className={`${styles.inline} ${styles.fields}`}
            onSubmit={(event) => {
              event.preventDefault();
              void save({});
            }}
          >
            <label className={styles.skipBar}>
              <input
                type="checkbox"
                checked={skipToday}
                onChange={(event) => {
                  setSkipToday(event.target.checked);
                  void save({ skipToday: event.target.checked });
                }}
              />
              <span className={styles.checkBox} aria-hidden="true" />
              Skip today and plan from tomorrow
            </label>
            <label>
              Office
              <input value={officePostcode} onChange={(event) => setOffice(event.target.value)} onBlur={() => void save({})} />
            </label>
            <label>
              Start
              <input type="time" value={startTime} onChange={(event) => { setStart(event.target.value); void save({ startTime: event.target.value }); }} />
            </label>
            <label>
              Calls before start (min)
              <input type="number" min={0} max={60} step={5} value={callMinutes} onChange={(event) => { const value = Number(event.target.value); setCall(value); void save({ callMinutes: value }); }} />
            </label>
            <label>
              Lunch
              <input type="time" value={lunchStart} onChange={(event) => { setLunch(event.target.value); void save({ lunchStart: event.target.value }); }} />
            </label>
            <label>
              Back by
              <input type="time" value={returnBy} onChange={(event) => { setReturn(event.target.value); void save({ returnBy: event.target.value }); }} />
            </label>
            <label>
              Stay (min)
              <input type="number" min={15} max={120} step={5} value={stayMinutes} onChange={(event) => { const value = Number(event.target.value); setStay(value); void save({ stayMinutes: value }); }} />
            </label>
            <label>
              Extra email addresses
              <input value={emails} placeholder="e.g. colleague@gta.ac.uk, office@gta.ac.uk" onChange={(event) => setEmails(event.target.value)} onBlur={() => void save({})} />
            </label>
            <div className={styles.tutorBlock}>
              <h2>Hide a tutor’s reviews</h2>
              <p className={styles.meta}>Tick a tutor to take their reviews off Need booking and the planner. Booked or verified people stay where they are.</p>
              <div className={styles.tutorList}>
              {page.tutors.map((tutor) => (
                <label key={tutor.name} className={styles.tutorCard}>
                  <input
                    type="checkbox"
                    checked={Boolean(tutor.id) && hidden.includes(tutor.id)}
                    disabled={!tutor.id || !page.canWrite}
                    onChange={(event) => {
                      if (!tutor.id) return;
                      const next = event.target.checked ? [...hidden, tutor.id] : hidden.filter((id) => id !== tutor.id);
                      setHidden(next);
                      void save({ hiddenTutorIds: next });
                    }}
                  />
                  <span>
                    <strong>{tutor.name}</strong>
                    <span className={styles.meta}>{tutor.department}</span>
                  </span>
                </label>
              ))}
              </div>
            </div>
          </form>
        ) : null}
        {tab === "out" ? (
          <label className={styles.outBox}>
            <input
              type="checkbox"
              checked={outEnabled}
              onChange={(event) => {
                setOut(event.target.checked);
                void save({ outEnabled: event.target.checked });
              }}
            />
            Use the Out page on visit days
          </label>
        ) : null}
        {tab === "accessibility" ? <AccessibilityPanel /> : null}
        {tab === "feedback" ? (
          <section>
            <h2>Suggest an improvement</h2>
            <p className={styles.meta}>Tell us what would make this easier for tutors. We read these and use them to improve the app.</p>
            <form
              className={styles.inline}
              onSubmit={(event) => {
                event.preventDefault();
                setMessage("Suggestions are not stored in the Portal yet.");
              }}
            >
              <label>
                Your suggestion
                <textarea rows={7} maxLength={2000} required placeholder="e.g. The date picker is hard to use on a phone because…" />
              </label>
              <button type="submit" className={styles.solid}>Send suggestion</button>
            </form>
          </section>
        ) : null}
      </div>
    </div>
  );
}

function AccessibilityPanel() {
  const [text, setText] = useState("default");
  const [font, setFont] = useState("outfit");
  const [theme, setTheme] = useState("default");
  useEffect(() => {
    document.documentElement.dataset.text = text;
    document.documentElement.dataset.font = font;
    document.documentElement.dataset.theme = theme;
  }, [text, font, theme]);
  function pickText(value: string) {
    setText(value);
  }
  function pickFont(value: string) {
    setFont(value);
  }
  function pickTheme(value: string) {
    setTheme(value);
  }
  return (
    <section>
      <h2>Text size</h2>
      <p className={styles.meta}>Make the words on screen bigger if they are hard to read.</p>
      <div className={styles.presets}>
        {[["default", "Default"], ["large", "Large"], ["xl", "Extra large"]].map(([value, label]) => (
          <button key={value} type="button" className={text === value ? styles.choiceOn : styles.pill} onClick={() => pickText(value)}>{label}</button>
        ))}
      </div>
      <h2>Text font</h2>
      <p className={styles.meta}>Pick a font that is easier for you to read.</p>
      <div className={styles.presets}>
        {[["outfit", "Outfit"], ["system", "System"], ["verdana", "Verdana"], ["atkinson", "Atkinson"], ["georgia", "Georgia"]].map(([value, label]) => (
          <button key={value} type="button" className={font === value ? styles.choiceOn : styles.pill} onClick={() => pickFont(value)}>{label}</button>
        ))}
      </div>
      <h2>Colour scheme</h2>
      <p className={styles.meta}>Change the colours across the whole app.</p>
      <div className={styles.presets}>
        {[["default", "Warm"], ["calm", "Calm"], ["dark", "Dark"], ["contrast", "High contrast"]].map(([value, label]) => (
          <button key={value} type="button" className={theme === value ? styles.choiceOn : styles.pill} onClick={() => pickTheme(value)}>{label}</button>
        ))}
      </div>
    </section>
  );
}
