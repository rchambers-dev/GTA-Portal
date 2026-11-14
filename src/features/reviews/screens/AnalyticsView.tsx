import Link from "next/link";
import { ANALYTICS_RANGES, londonStamp, percent, type AnalyticsFilters } from "../domain/analytics";
import type { loadAnalytics } from "../domain/analytics-repository";
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
  const maxTrend = Math.max(1, ...page.trend.flatMap((week) => [week.released, week.received, week.completed, week.visits]));

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
            <div className={styles.flow}>
              {page.flow.map((step) => (
                <div key={step.id} className={styles.step}>
                  <strong>{step.label}</strong>
                  <em>{step.count}</em>
                </div>
              ))}
            </div>
          </section>
          <section className={styles.card}>
            <h2>Overall</h2>
            <div className={styles.stats}>
              <Stat label="Needed each day" value={page.overall.neededEachDay} />
              <Stat label="Released" value={page.overall.released} />
              <Stat label="Received" value={page.overall.received} />
              <Stat label="Completed" value={page.overall.completed} />
              <Stat label="Archived" value={page.overall.archived} />
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
              <h2>Reviews by weekday</h2>
              {page.weekday.map((day) => (
                <div key={day.label} className={day.today ? `${styles.bar} ${styles.today}` : styles.bar}>
                  <span className={styles.barLabel}>{day.label}{day.today ? " · Today" : ""}</span>
                  <span className={styles.track}><i className={styles.fill} style={{ width: `${day.total ? Math.max(8, Math.round((day.total / maxDay) * 100)) : 0}%` }} /></span>
                  <span>{day.total}</span>
                </div>
              ))}
            </section>
          </div>
          <TutorList page={page} />
          <Log page={page} />
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
            <p className={styles.legend}><i className={styles.rel} />Released <i className={styles.rec} />Received <i className={styles.comp} />Completed <i className={styles.vis} />Visits</p>
            {page.trend.length === 0 ? <p className={styles.muted}>No weeks to show yet.</p> : page.trend.map((week) => (
              <div key={week.label} className={styles.bar}>
                <span className={styles.barLabel}>{week.label}{week.current ? " · This week" : ""}</span>
                <span className={styles.series}>
                  <i className={styles.rel} style={{ height: `${Math.round((week.released / maxTrend) * 100)}%` }} />
                  <i className={styles.rec} style={{ height: `${Math.round((week.received / maxTrend) * 100)}%` }} />
                  <i className={styles.comp} style={{ height: `${Math.round((week.completed / maxTrend) * 100)}%` }} />
                  <i className={styles.vis} style={{ height: `${Math.round((week.visits / maxTrend) * 100)}%` }} />
                </span>
                <span>{week.released + week.received + week.completed + week.visits}</span>
              </div>
            ))}
          </section>
          <div className={styles.split}>
            <section className={styles.card}>
              <h2>Overdue and at risk</h2>
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
              <div className={styles.row}><span>Signed</span><strong>{page.safeguarding.active} of {page.safeguarding.live}</strong></div>
              <div className={styles.row}><span>Without a sign-off</span><strong>{page.safeguarding.without}</strong></div>
              <div className={styles.row}><span>Reversed</span><strong>{page.safeguarding.reversed}</strong></div>
            </section>
            <section className={styles.card}>
              <h2>Concerns</h2>
              {page.concerns.open + page.concerns.resolved + page.concerns.breaks === 0 ? (
                <p className={styles.muted}>No concerns or breaks.</p>
              ) : (
                <>
                  <div className={styles.row}><span>Open</span><strong>{page.concerns.open}</strong></div>
                  <div className={styles.row}><span>Resolved</span><strong>{page.concerns.resolved}</strong></div>
                  <div className={styles.row}><span>Open breaks</span><strong>{page.concerns.breaks}</strong></div>
                </>
              )}
            </section>
            <section className={styles.card}>
              <h2>Programme mix</h2>
              {page.programmes.length === 0 ? <p className={styles.muted}>No learners.</p> : page.programmes.map((item) => (
                <div key={item.name} className={styles.bar}>
                  <span className={styles.barLabel}>{item.name}</span>
                  <span className={styles.track}><i className={styles.fill} style={{ width: `${Math.round((item.count / maxMix) * 100)}%` }} /></span>
                  <span>{item.count}</span>
                </div>
              ))}
            </section>
          </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return <article className={styles.stat}><span>{label}</span><strong>{value}</strong></article>;
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

function Log({ page }: { page: Page["page"] }) {
  return (
    <section className={styles.card} id="analytics-log">
      <h2>Review log</h2>
      {page.log.length === 0 ? <p className={styles.muted}>No review log yet.</p> : (
        <table className={styles.log}>
          <thead><tr><th>Learner</th><th>Detail</th><th>Event</th><th>Actor</th><th>Role</th><th>Time</th></tr></thead>
          <tbody>
            {page.log.map((item, index) => (
              <tr key={`${item.at}-${index}`}>
                <td>{item.learner}</td>
                <td>{item.detail}</td>
                <td><span className={styles.pill}>{item.pill}</span></td>
                <td>{item.actor}</td>
                <td>{item.role}</td>
                <td>{londonStamp(item.at)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
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
  options: { id: string; name: string }[];
  all: string;
  workspace: "administration" | "management";
  filters: AnalyticsFilters;
  view: string;
}) {
  const key = name === "tutor" ? "tutorId" : name === "programme" ? "programmeId" : "employerId";
  return (
    <JumpSelect
      label={all}
      value={href(workspace, filters, view, { [key]: value })}
      options={[
        { href: href(workspace, filters, view, { [key]: "all" }), label: all },
        ...options.map((option) => ({ href: href(workspace, filters, view, { [key]: option.id }), label: option.name })),
      ]}
    />
  );
}
