import Link from "next/link";
import { ANALYTICS_RANGES, percent, type AnalyticsFilters } from "../domain/analytics";
import type { loadAnalytics } from "../domain/analytics-repository";
import { ReviewLog } from "./AnalyticsLog";
import { JumpSelect, PrintReport } from "./PrintReport";
import styles from "./analytics.module.css";

type Page = Awaited<ReturnType<typeof loadAnalytics>>;

function href(workspace: "administration" | "management", filters: AnalyticsFilters, view: string, patch: Partial<AnalyticsFilters> = {}) {
  const next = { ...filters, ...patch };
  const params = new URLSearchParams();
  if (next.range !== "all") params.set("range", next.range);
  if (next.tutorId !== "all") params.set("tutor", next.tutorId);
  if (next.programmeId !== "all") params.set("programme", next.programmeId);
  if (next.employerId !== "all") params.set("employer", next.employerId);
  if (view !== "reviews") params.set("view", view);
  const query = params.toString();
  return `/${workspace}/reviews/analytics${query ? `?${query}` : ""}`;
}

export function AnalyticsView({
  workspace,
  data,
  view,
}: {
  workspace: "administration" | "management";
  data: Page;
  view: "reviews" | "tutors" | "log";
}) {
  const { page, filters } = data;
  const maxWeek = Math.max(1, ...page.reviewsPerWeek.map((week) => week.total));
  const maxDay = Math.max(1, ...page.weekday.map((day) => day.total));
  const maxMix = Math.max(1, ...page.programmes.map((item) => item.count));
  const maxTrend = Math.max(1, ...page.trend.flatMap((week) => [week.visits, week.received]));

  return (
    <div className={styles.page}>
      <header className={styles.head}>
        <div>
          <h1>Review analytics</h1>
          <p>{page.learners} learner{page.learners === 1 ? "" : "s"}</p>
        </div>
        <div className={styles.actions}>
          <span className={styles.pills}>
            <a className={styles.on} href="#analytics-now">Reviews</a>
            <a href="#analytics-tutors">Tutors</a>
          </span>
          <PrintReport />
          <a href="#analytics-log">Review Log</a>
        </div>
      </header>
      {data.loadError ? <p className={styles.error} role="alert">{data.loadError}</p> : null}
      <div className={styles.filters}>
        {ANALYTICS_RANGES.map((range) => (
          <Link key={range.id} className={filters.range === range.id ? styles.on : ""} href={href(workspace, filters, view, { range: range.id })}>
            {range.label}
          </Link>
        ))}
        <Filter name="tutor" value={filters.tutorId} options={page.options.tutors} all="All tutors" workspace={workspace} filters={filters} view={view} />
        <Filter name="programme" value={filters.programmeId} options={page.options.programmes} all="All programmes" workspace={workspace} filters={filters} view={view} />
        <Filter name="employer" value={filters.employerId} options={page.options.employers} all="All employers" workspace={workspace} filters={filters} view={view} />
      </div>

          <section className={styles.card} id="analytics-now">
            <h2>Now · {page.learners}</h2>
            <div className={styles.now}>
              <div className={styles.flow}>
                {page.flow.map((step) => (
                  <div key={step.id} className={`${styles.step} ${step.tone === "red" ? styles.red : step.tone === "amber" ? styles.amber : styles.green}`}>
                    <strong>{step.label}</strong>
                    <em>{step.count}</em>
                  </div>
                ))}
              </div>
              <article className={styles.cycleFigure}>
                <span>Completed this cycle</span>
                <strong>{page.completedThisCycle}</strong>
              </article>
            </div>
          </section>
          <section className={styles.card}>
            <h2>Overall</h2>
            <div className={styles.stats}>
              <Stat label="Needed each day" value={page.overall.neededEachDay} note={page.overall.cycleNote} />
              <Stat label="Reviews released" value={page.overall.released} />
              <Stat label="Forms received" value={page.overall.received} />
              <Stat label="Reviews completed" value={page.overall.completed} />
              <Stat label="Visits" value={page.overall.visits} />
              <Stat label="Calls" value={page.overall.calls} />
              <Stat label="Teams" value={page.overall.teams} />
            </div>
          </section>
          <div className={styles.split}>
            <section className={styles.card}>
              <h2>Reviews per week</h2>
              {page.reviewsPerWeek.length === 0 ? <p className={styles.muted}>No reviews to show yet.</p> : page.reviewsPerWeek.map((week) => (
                <div key={week.label} className={week.current ? `${styles.bar} ${styles.current}` : styles.bar}>
                  <span className={styles.barLabel}>{week.label}{week.current ? " · This week" : ""}</span>
                  <span className={styles.track}><i className={styles.fill} style={{ width: `${Math.max(8, Math.round((week.total / maxWeek) * 100))}%` }} /></span>
                  <span>{week.total}</span>
                </div>
              ))}
            </section>
            <section className={styles.card}>
              <h2>Reviews by day</h2>
              {page.weekday.map((day) => (
                <div key={day.label} className={day.today ? `${styles.bar} ${styles.today}` : styles.bar}>
                  <span className={styles.barLabel}>{day.label}{day.today ? " · Today" : ""}</span>
                  <span className={styles.track}><i className={styles.fill} style={{ width: `${day.total ? Math.max(8, Math.round((day.total / maxDay) * 100)) : 0}%` }} /></span>
                  <span>{day.total}</span>
                </div>
              ))}
              {page.weekend ? <p className={styles.note}>There is no Today mark.</p> : null}
            </section>
          </div>
          <TutorList page={page} />
          <section className={styles.card}>
            <h2>This week against last week</h2>
            <div className={styles.tiles}>
              {page.weekOnWeek.map((item) => (
                <article key={item.label} className={styles.tile}>
                  <span>{item.label}</span>
                  <strong>{item.now}</strong>
                  <span className={item.delta > 0 ? styles.up : item.delta < 0 ? styles.down : ""}>
                    {item.delta > 0 ? `+${item.delta}` : item.delta} on last week
                  </span>
                </article>
              ))}
            </div>
          </section>
          <section className={styles.card}>
            <h2>Weekly trend</h2>
            <p className={styles.legend}><i className={styles.vis} />Visits <i className={styles.rec} />Forms received</p>
            <ColumnChart weeks={page.trend} max={maxTrend} />
          </section>
          <div className={styles.split}>
            <section className={styles.card}>
              <h2>Overdue and at risk</h2>
              <p className={styles.note}>At risk means the planned date has passed, or the pack has waited more than 7 days to be booked or returned by the tutor.</p>
              {page.risk.map((item) => (
                <div key={item.id} className={styles.row}><span>{item.label}</span><strong>{item.count}</strong></div>
              ))}
            </section>
            <section className={styles.card}>
              <h2>Overdue by tutor</h2>
              {page.overdueByTutor.length === 0 ? <p className={styles.muted}>No overdue learners.</p> : page.overdueByTutor.map((tutor) => (
                <div key={tutor.name} className={styles.row}><span>{tutor.name}</span><strong>{tutor.count}</strong></div>
              ))}
            </section>
          </div>
          <section className={styles.card}>
            <h2>Completion and turnaround</h2>
            <div className={styles.stats}>
              <Stat label="All time" value={percent(page.completion.allTime)} />
              <Stat label="Current cycle" value={percent(page.completion.currentCycle)} />
              <Stat label="In flight" value={page.completion.inFlight} />
              <Stat label="Release to received" value={days(page.completion.releaseToReceived)} />
              <Stat label="Received to completed" value={days(page.completion.receivedToCompleted)} />
            </div>
          </section>
          <div className={styles.mix}>
            <section className={styles.card}>
              <h2>Safeguarding</h2>
              <div className={styles.coverage} aria-hidden="true">
                <i style={{ width: `${page.safeguarding.live ? Math.round((page.safeguarding.recent / page.safeguarding.live) * 100) : 0}%` }} />
              </div>
              <p className={styles.note}>Signed in the last 10 weeks, tracks completed cycles.</p>
              <div className={styles.row}><span>Signed</span><strong>{page.safeguarding.active} of {page.safeguarding.live}</strong></div>
              <div className={styles.row}><span>Without a sign-off</span><strong>{page.safeguarding.without}</strong></div>
              <div className={styles.row}><span>Reversed</span><strong>{page.safeguarding.reversed}</strong></div>
            </section>
            <section className={styles.card}>
              <h2>Concerns</h2>
              <div className={`${styles.tiles} ${styles.concerns}`}>
                <article className={styles.tile}><span>Open concerns</span><strong>{page.concerns.open}</strong></article>
                <article className={styles.tile}><span>Resolved concerns</span><strong>{page.concerns.resolved}</strong></article>
                <article className={styles.tile}><span>Open breaks</span><strong>{page.concerns.breaks}</strong></article>
              </div>
            </section>
            <section className={styles.card}>
              <h2>Programme mix</h2>
              {page.programmes.length === 0 ? <p className={styles.muted}>No learners.</p> : page.programmes.map((item) => (
                <div key={item.name} className={styles.mixRow}>
                  <span className={styles.mixName}>{item.name}</span>
                  <span className={styles.track}><i className={styles.fill} style={{ width: `${Math.round((item.count / maxMix) * 100)}%` }} /></span>
                  <span>{item.count} · {percent(item.share)}</span>
                </div>
              ))}
            </section>
          </div>
          <ReviewLog rows={page.log} />
    </div>
  );
}

function Stat({ label, value, note }: { label: string; value: string | number; note?: string }) {
  return <article className={styles.stat}><span>{label}</span><strong>{value}</strong>{note ? <span className={styles.note}>{note}</span> : null}</article>;
}

function ColumnChart({ weeks, max }: { weeks: Page["page"]["trend"]; max: number }) {
  const ticks = [max, Math.round(max / 2), 0];
  return (
    <div className={styles.chart}>
      <div className={styles.axis} aria-hidden="true">
        {ticks.map((tick) => <span key={tick}>{tick}</span>)}
      </div>
      <div className={styles.plot} role="img" aria-label="Visits and forms received over the last five weeks">
        {[0, 50, 100].map((mark) => <span key={mark} className={styles.grid} style={{ bottom: `${mark}%` }} />)}
        {weeks.map((week) => (
          <div key={week.label} className={week.current ? `${styles.cluster} ${styles.currentWeek}` : styles.cluster}>
            <i className={styles.vis} style={{ height: week.visits ? `${Math.round((week.visits / max) * 100)}%` : 0, minHeight: week.visits ? 2 : 0 }} />
            <i className={styles.rec} style={{ height: week.received ? `${Math.round((week.received / max) * 100)}%` : 0, minHeight: week.received ? 2 : 0 }} />
            <span>{week.label}{week.current ? " · This week" : ""}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function days(value: { median: number | null; average: number | null }) {
  if (value.median == null) return "—";
  return `${value.median}d median · ${value.average}d avg`;
}

function TutorList({ page }: { page: Page["page"] }) {
  return (
    <section className={styles.card} id="analytics-tutors">
      <h2>Tutors · {page.tutors.length}</h2>
      {page.tutors.length === 0 ? <p className={styles.muted}>No tutors to show yet.</p> : page.tutors.map((tutor) => (
        <article key={tutor.name} className={styles.row}>
          <div>
            <strong>{tutor.name}</strong>
            <span className={styles.muted}> {tutor.trade ? `${tutor.trade} · ` : ""}{tutor.learners} learner{tutor.learners === 1 ? "" : "s"}</span>
          </div>
          <div className={styles.pills}>
            <span className={`${styles.pill} ${styles.late}`}>Need doing · {tutor.bands["need-doing"] || 0}</span>
            <span className={`${styles.pill} ${styles.soon}`}>Coming up · {tutor.bands["coming-up"] || 0}</span>
            <span className={styles.pill}>Not due yet · {tutor.bands["not-due"] || 0}</span>
            <span className={`${styles.pill} ${styles.done}`}>Sent back · {tutor.bands["sent-back"] || 0}</span>
            <span className={`${styles.pill} ${styles.done}`}>Visits · {tutor.visits}</span>
          </div>
        </article>
      ))}
    </section>
  );
}

function Filter({
  name,
  value,
  options,
  all,
  workspace,
  filters,
  view,
}: {
  name: "tutor" | "programme" | "employer";
  value: string;
  options: { id: string; name: string; count: number }[];
  all: string;
  workspace: "administration" | "management";
  filters: AnalyticsFilters;
  view: string;
}) {
  const key = name === "tutor" ? "tutorId" : name === "programme" ? "programmeId" : "employerId";
  const total = options.reduce((sum, option) => sum + option.count, 0);
  return (
    <JumpSelect
      label={all}
      value={href(workspace, filters, view, { [key]: value })}
      options={[
        { href: href(workspace, filters, view, { [key]: "all" }), label: `${all} (${total})` },
        ...options.map((option) => ({ href: href(workspace, filters, view, { [key]: option.id }), label: `${option.name} (${option.count})` })),
      ]}
    />
  );
}
