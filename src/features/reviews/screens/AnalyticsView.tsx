import Link from "next/link";
import { Fragment } from "react";
import { ANALYTICS_RANGES, percent, type AnalyticsFilters, type Urgency } from "../domain/analytics";
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
  const maxTrend = Math.max(1, ...page.trend.flatMap((week) => [week.released, week.received, week.completed, week.visits, week.callsTeams]));
  const paceLabel = page.cycle.pace === "on-pace" ? "On pace" : page.cycle.pace === "slightly-behind" ? "Slightly behind" : "Behind";
  const paceTone: Urgency = page.cycle.pace === "on-pace" ? "green" : page.cycle.pace === "slightly-behind" ? "amber" : "red";

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
      <p className={styles.key}><i className={styles.red} />Overdue or behind <i className={styles.amber} />Due soon <i className={styles.green} />On track <i className={styles.neutral} />Information</p>

          <section className={styles.card} id="analytics-now">
            <h2>Now · {page.learners}</h2>
            <div className={styles.steps}>
              {page.flow.map((step, index) => (
                <Fragment key={step.id}>
                  {index > 0 ? <span className={styles.chevron} aria-hidden="true">›</span> : null}
                  <article className={`${styles.stepCard} ${toneClass(step.tone)}`}>
                    <em>{step.count}</em>
                    <strong>{step.label}</strong>
                  </article>
                </Fragment>
              ))}
            </div>
            <div className={styles.pace}>
              <div className={styles.paceTop}>
                <strong>This cycle</strong>
                <span className={`${styles.paceBadge} ${toneClass(paceTone)}`}>{paceLabel}</span>
              </div>
              <div className={styles.track}>
                <i className={toneClass(paceTone)} style={{ width: `${page.cycle.needed ? Math.round((page.cycle.done / page.cycle.needed) * 100) : 0}%` }} />
              </div>
              <p>{page.cycle.done} of {page.cycle.needed} done</p>
              <p>Last cycle: {page.cycle.lastDone} of {page.cycle.needed} completed</p>
            </div>
          </section>
          <section className={styles.card}>
            <h2>Overall</h2>
            <div className={styles.board}>
              <div>
                <h3>Target</h3>
                <Stat label="Needed each day" value={page.overall.neededEachDay} note={page.overall.cycleNote} />
              </div>
              <div>
                <h3>Pipeline</h3>
                <div className={styles.metricRow}>
                  <Stat label="Released" value={page.overall.released} note={page.overall.rangeLabel} delta={delta(page, "Released")} />
                  <Stat label="Received" value={page.overall.received} note={page.overall.rangeLabel} delta={delta(page, "Received")} />
                  <Stat label="Completed" value={page.overall.completed} note={page.overall.rangeLabel} delta={delta(page, "Completed")} />
                </div>
              </div>
              <div>
                <h3>Delivery</h3>
                <div className={styles.metricRow}>
                  <Stat label="Visits" value={page.overall.visits} note={page.overall.rangeLabel} delta={delta(page, "Visits")} />
                  <Stat label="Calls" value={page.overall.calls} note={page.overall.rangeLabel} delta={delta(page, "Calls")} />
                  <Stat label="Teams" value={page.overall.teams} note={page.overall.rangeLabel} delta={delta(page, "Teams")} />
                </div>
              </div>
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
            <h2>Weekly trend</h2>
            <p className={styles.legend}>
              <i className={styles.rel} />Reviews released
              <i className={styles.rec} />Forms received
              <i className={styles.comp} />Reviews completed
              <i className={styles.vis} />Visits
              <i className={styles.call} />Calls/Teams
            </p>
            <ColumnChart weeks={page.trend} max={maxTrend} />
          </section>
          <div className={styles.split}>
            <section className={styles.card}>
              <h2>Overdue and at risk</h2>
              <p className={styles.note}>At risk means the planned date has passed, or the pack has waited more than 7 days to be booked or returned by the tutor.</p>
              <div className={styles.riskGrid}>
                {page.risk.map((item) => (
                  <article key={item.id} className={`${styles.tile} ${toneClass(item.tone)}`}>
                    <span>{item.label}</span>
                    <strong>{item.count}</strong>
                  </article>
                ))}
              </div>
            </section>
            <section className={styles.card}>
              <h2>Overdue by tutor</h2>
              {page.overdueByTutor.length === 0 ? <p className={styles.muted}>No overdue learners.</p> : (
                <div className={styles.sheet}>
                  <div className={`${styles.pair} ${styles.sheetHead}`}><span>Tutor</span><span>Overdue</span></div>
                  {page.overdueByTutor.map((tutor) => (
                    <div key={tutor.name} className={styles.pair}><span>{tutor.name}</span><strong className={styles.redText}>{tutor.count}</strong></div>
                  ))}
                </div>
              )}
            </section>
          </div>
          <section className={styles.card}>
            <h2>Completion and turnaround</h2>
            <div className={styles.stats}>
              <Stat label="All time" value={percent(page.completion.allTime)} tone={page.completion.allTimeTone} note="Completed packs over released packs" />
              <Stat label="Current cycle" value={percent(page.completion.currentCycle)} tone={page.completion.currentCycleTone} note="Learners now waiting" />
              <Stat label="In flight" value={page.completion.inFlight} note="Not waiting" />
              <Stat label="Release to received" value={days(page.completion.releaseToReceived)} />
              <Stat label="Received to completed" value={days(page.completion.receivedToCompleted)} />
            </div>
          </section>
          <div className={styles.mix}>
            <section className={styles.card}>
              <h2>Safeguarding</h2>
              <div className={styles.coverage} aria-hidden="true">
                <i className={toneClass(page.safeguarding.tone)} style={{ width: `${page.safeguarding.live ? Math.round((page.safeguarding.recent / page.safeguarding.live) * 100) : 0}%` }} />
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

function toneClass(tone: Urgency) {
  if (tone === "red") return styles.red;
  if (tone === "amber") return styles.amber;
  if (tone === "green") return styles.green;
  return styles.neutral;
}

function delta(page: Page["page"], label: string) {
  return page.weekOnWeek.find((item) => item.label === label)?.delta ?? 0;
}

function Stat({ label, value, note, delta: change, tone = "neutral" }: { label: string; value: string | number; note?: string; delta?: number; tone?: Urgency }) {
  return (
    <article className={`${styles.stat} ${toneClass(tone)}`}>
      <span>{label}</span>
      <strong>{value}</strong>
      {note ? <span className={styles.note}>{note}</span> : null}
      {change == null ? null : <span className={change > 0 ? styles.up : change < 0 ? styles.down : styles.note}>{change > 0 ? `+${change}` : change} on last week</span>}
    </article>
  );
}

function ColumnChart({ weeks, max }: { weeks: Page["page"]["trend"]; max: number }) {
  const ticks = [max, Math.ceil(max / 2), 0];
  const series = [
    { key: "released" as const, className: styles.rel, name: "Reviews released" },
    { key: "received" as const, className: styles.rec, name: "Forms received" },
    { key: "completed" as const, className: styles.comp, name: "Reviews completed" },
    { key: "visits" as const, className: styles.vis, name: "Visits" },
    { key: "callsTeams" as const, className: styles.call, name: "Calls/Teams" },
  ];
  return (
    <>
      <div className={styles.chart}>
        <div className={styles.axis} aria-hidden="true">
          {ticks.map((tick) => <span key={tick}>{tick}</span>)}
        </div>
        <div className={styles.plot} role="img" aria-label="Released, received, completed, visits and calls or Teams over the last five weeks">
          {[0, 50, 100].map((mark) => <span key={mark} className={styles.grid} style={{ bottom: `${mark}%` }} />)}
          {weeks.map((week) => (
            <div key={week.label} className={week.current && week.behind ? `${styles.cluster} ${styles.behind}` : week.current ? `${styles.cluster} ${styles.currentWeek}` : styles.cluster}>
              {series.map((item) => {
                const value = week[item.key];
                return <i key={item.key} className={item.className} title={`${item.name}: ${value}`} style={{ height: value ? `${Math.round((value / max) * 100)}%` : 0, minHeight: value ? 2 : 0 }} />;
              })}
              <span>{week.label}{week.current ? " · This week" : ""}</span>
            </div>
          ))}
        </div>
      </div>
      <table className={styles.weekTable}>
        <thead>
          <tr><th>Week</th><th>Released</th><th>Received</th><th>Completed</th><th>Visits</th><th>Calls/Teams</th></tr>
        </thead>
        <tbody>
          {weeks.map((week) => (
            <tr key={week.label} className={week.behind ? styles.behindRow : undefined}>
              <td>{week.label}{week.current ? " · This week" : ""}</td>
              <td>{week.released}</td>
              <td>{week.received}</td>
              <td>{week.completed}</td>
              <td>{week.visits}</td>
              <td>{week.callsTeams}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
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
      {page.tutors.length === 0 ? <p className={styles.muted}>No tutors to show yet.</p> : (
        <div className={styles.sheet}>
          <div className={`${styles.tutorCols} ${styles.sheetHead}`}>
            <span>Tutor</span><span>Learners</span><span>Need doing</span><span>Coming up</span><span>Not due yet</span><span>Sent back</span><span>Visits</span>
          </div>
          {page.tutors.map((tutor) => (
            <div key={tutor.name} className={styles.tutorCols}>
              <span><strong>{tutor.name}</strong>{tutor.trade ? <small>{tutor.trade}</small> : null}</span>
              <span>{tutor.learners}</span>
              <span className={styles.redText}>{tutor.bands["need-doing"] || 0}</span>
              <span className={styles.amberText}>{tutor.bands["coming-up"] || 0}</span>
              <span>{tutor.bands["not-due"] || 0}</span>
              <span className={styles.greenText}>{tutor.bands["sent-back"] || 0}</span>
              <span>{tutor.visits}</span>
            </div>
          ))}
        </div>
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
