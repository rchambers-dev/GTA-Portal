import Link from "next/link";
import { eventLabel, londonStamp } from "../domain/analytics";
import { LOG_PAGE_SIZE, filterLog, latestUndoableIds, pageOf, undoSummary, type ReviewLogEvent, type ReviewLogFilters } from "../domain/review-log";
import { UndoControl } from "./UndoControl";
import styles from "./review-log.module.css";

const RANGES = [
  { id: "all", label: "All time" },
  { id: "week", label: "This week" },
  { id: "4", label: "Last 4 weeks" },
  { id: "12", label: "Last 12 weeks" },
] as const;

function href(workspace: "administration" | "management", filters: ReviewLogFilters, page: number) {
  const params = new URLSearchParams();
  if (filters.query) params.set("q", filters.query);
  if (filters.learnerId !== "all") params.set("learner", filters.learnerId);
  if (filters.tutorId !== "all") params.set("tutor", filters.tutorId);
  if (filters.eventType !== "all") params.set("event", filters.eventType);
  if (filters.range !== "all") params.set("range", filters.range);
  if (page > 1) params.set("page", String(page));
  const query = params.toString();
  return `/${workspace}/reviews/log${query ? `?${query}` : ""}`;
}

export function ReviewLogView({
  workspace,
  events,
  filters,
  today,
  undoReady,
  canUndo,
  loadError,
}: {
  workspace: "administration" | "management";
  events: ReviewLogEvent[];
  filters: ReviewLogFilters;
  today: string;
  undoReady: boolean;
  canUndo: boolean;
  loadError: string | null;
}) {
  const filtered = filterLog(events, filters, today);
  const page = pageOf(filtered, filters.page, LOG_PAGE_SIZE);
  const undoIds = latestUndoableIds(events, new Date());
  const undoneBy = new Map(events.filter((event) => event.undoes).map((event) => [event.undoes, event]));
  const learners = unique(events.map((event) => ({ id: event.gtaId, name: event.learner })));
  const tutors = unique(events.map((event) => ({ id: event.tutorId || "", name: event.tutor })).filter((item) => item.id));
  const types = [...new Set(events.map((event) => event.type).filter((type) => type !== "created"))].sort();

  return (
    <div className={styles.page}>
      <header className={styles.head}>
        <div>
          <h1>Review log</h1>
          <p>{filtered.length} event{filtered.length === 1 ? "" : "s"}</p>
        </div>
        <Link href={`/${workspace}/reviews/analytics`}>Back to analytics</Link>
      </header>
      {loadError ? <p className={styles.error} role="alert">{loadError}</p> : null}
      <form className={styles.filters} method="get">
        <input name="q" defaultValue={filters.query} placeholder="Search learner, detail or actor" aria-label="Search the log" />
        <select name="learner" defaultValue={filters.learnerId} aria-label="Learner">
          <option value="all">All learners</option>
          {learners.map((learner) => <option key={learner.id} value={learner.id}>{learner.name}</option>)}
        </select>
        <select name="tutor" defaultValue={filters.tutorId} aria-label="Tutor">
          <option value="all">All tutors</option>
          {tutors.map((tutor) => <option key={tutor.id} value={tutor.id}>{tutor.name}</option>)}
        </select>
        <select name="event" defaultValue={filters.eventType} aria-label="Event type">
          <option value="all">All events</option>
          {types.map((type) => <option key={type} value={type}>{eventLabel(type)}</option>)}
        </select>
        <select name="range" defaultValue={filters.range} aria-label="Date range">
          {RANGES.map((range) => <option key={range.id} value={range.id}>{range.label}</option>)}
        </select>
        <button type="submit">Apply</button>
      </form>
      {page.rows.length === 0 ? <p className={styles.muted}>No events match.</p> : (
        <div className={styles.card}>
          <table className={styles.log}>
            <thead>
              <tr><th>Learner</th><th>Detail</th><th>Event</th><th>Actor</th><th>Role</th><th>Time</th><th>Undo</th></tr>
            </thead>
            <tbody>
              {page.rows.map((event) => {
                const undo = undoneBy.get(event.id);
                return (
                  <tr key={event.id}>
                    <td>{event.learner}</td>
                    <td>
                      {event.detail}
                      {undo ? <span className={styles.tag}>Undone by {undo.actor} on {londonStamp(undo.at)}</span> : null}
                    </td>
                    <td><span className={styles.pill}>{eventLabel(event.type)}</span></td>
                    <td>{event.actor}</td>
                    <td>{event.role}</td>
                    <td>{londonStamp(event.at)}</td>
                    <td>
                      {canUndo && undoIds.has(event.id) ? (
                        <UndoControl ready={undoReady} summary={undoSummary(event)} eventId={event.id} />
                      ) : null}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <div className={styles.pager}>
            {page.page > 1 ? <Link href={href(workspace, filters, page.page - 1)}>Previous</Link> : <span>Previous</span>}
            <span>Page {page.page} of {page.pages}</span>
            {page.page < page.pages ? <Link href={href(workspace, filters, page.page + 1)}>Next</Link> : <span>Next</span>}
          </div>
        </div>
      )}
    </div>
  );
}

function unique(items: { id: string; name: string }[]) {
  const seen = new Map<string, string>();
  for (const item of items) if (item.id && !seen.has(item.id)) seen.set(item.id, item.name);
  return [...seen.entries()].map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name));
}
