import {
  LearnerPageShell,
  LearnerStatusChip,
} from "../components/LearnerPageShell";
import { ALEX_ATTENDANCE_DAYS, ALEX_PROFILE } from "../domain/mock-learner";
import styles from "./learner-pages.module.css";

function tone(status: (typeof ALEX_ATTENDANCE_DAYS)[number]["status"]) {
  switch (status) {
    case "attended":
      return "green" as const;
    case "late":
      return "amber" as const;
    case "absent":
      return "red" as const;
    case "authorised":
      return "blue" as const;
  }
}

function label(status: (typeof ALEX_ATTENDANCE_DAYS)[number]["status"]) {
  switch (status) {
    case "attended":
      return "Attended";
    case "late":
      return "Late";
    case "absent":
      return "Absent";
    case "authorised":
      return "Authorised";
  }
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function LearnerAttendanceScreen() {
  return (
    <LearnerPageShell
      title="Attendance"
      description={`College days are ${ALEX_PROFILE.collegeDays}. Overall attendance is ${ALEX_PROFILE.attendancePercent}%.`}
    >
      <div className={styles.stack}>
        <div className={styles.grid}>
          <div className={styles.glance}>
            <p className={styles.glanceLabel}>Attendance</p>
            <p className={styles.glanceValue}>{ALEX_PROFILE.attendancePercent}%</p>
            <p className={styles.glanceHint}>Year-to-date college sessions</p>
          </div>
          <div className={styles.glance}>
            <p className={styles.glanceLabel}>Pattern</p>
            <p className={styles.glanceValueSmall}>
              {ALEX_PROFILE.collegeDays}
            </p>
            <p className={styles.glanceHint}>Expected on campus</p>
          </div>
        </div>

        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Recent college days</h2>
          <ul className={styles.list}>
            {ALEX_ATTENDANCE_DAYS.map((day) => (
              <li key={`${day.date}-${day.session}`} className={styles.row}>
                <div className={styles.rowMain}>
                  <strong>
                    {day.dayName} · {formatDate(day.date)}
                  </strong>
                  <span>{day.session}</span>
                </div>
                <LearnerStatusChip tone={tone(day.status)}>
                  {label(day.status)}
                </LearnerStatusChip>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </LearnerPageShell>
  );
}
