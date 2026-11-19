import Link from "next/link";
import type { SearchDirectory, SearchFilter } from "../domain/search-directory";
import styles from "./search.module.css";

const FILTERS: { value: SearchFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "in_learning", label: "In learning" },
  { value: "review_due", label: "Review due" },
  { value: "concern", label: "Concern" },
];

function hint(filter: SearchFilter, query: string): string {
  if (!query.trim() && filter === "all") return "Showing learners and employers. Type a name, GTA ID, applicant ID, employer, site, manager, programme, tutor, or postcode to narrow the list.";
  if (filter === "in_learning") return "In learning is on, so only learners who are in learning are listed. Employers and applicants still appear.";
  if (filter === "review_due") return "Showing learners and applicants with a review due.";
  if (filter === "concern") return "Showing learners with an open concern.";
  return "In learning is off, so people who have left or not started still appear.";
}

export function SearchView({
  workspace,
  page,
}: {
  workspace: "staff" | "administration" | "management";
  page: SearchDirectory;
}) {
  const query = page.query.trim();
  const selected = page.filter;
  const action = `/${workspace}/search`;

  return (
    <div className={styles.page}>
      <h1 className={styles.title}>Search</h1>
      <p className={styles.lead}>
        All staff. One box searches everyone: name, GTA ID, applicant ID, employer, site, manager, programme, tutor, or postcode.
      </p>
      <form className={styles.search} action={action} method="get">
        <input
          name="q"
          defaultValue={query}
          aria-label="Search learners, employers and applicants"
          placeholder="Search learners, employers and applicants"
        />
        {selected !== "all" ? <input type="hidden" name="filter" value={selected} /> : null}
        <button type="submit">Search</button>
      </form>
      <div className={styles.filters}>
        {FILTERS.map((item) => (
          <form key={item.value} action={action} method="get">
            {query ? <input type="hidden" name="q" value={query} /> : null}
            <button type="submit" name="filter" value={item.value} className={selected === item.value ? styles.on : undefined}>
              {item.label}
            </button>
          </form>
        ))}
      </div>
      <p className={styles.hint}>{hint(selected, query)}</p>
      {page.loadError ? <p className={styles.hint}>{page.loadError}</p> : null}
      {query && !page.loadError && page.learners.length + page.employers.length + page.candidates.length === 0 ? (
        <p className={styles.hint}>No matches.</p>
      ) : null}
      {page.learners.length ? (
        <section>
          <h2 className={styles.group}>Learners · {page.learners.length}{page.totals.learners > page.learners.length ? ` of ${page.totals.learners}` : ""}</h2>
          {page.learners.map((row) => (
            <article key={row.gtaId} className={styles.card}>
              <div>
                <div className={styles.name}>{row.name} · {row.gtaId}</div>
                {row.detail ? <div className={styles.meta}>{row.detail}</div> : null}
              </div>
              <div className={styles.chips}>
                {row.inLearning ? <span className={`${styles.chip} ${styles.navy}`}>In learning</span> : <span className={styles.chip}>{row.statusLabel}</span>}
                {row.reviewDue ? <span className={`${styles.chip} ${styles.amber}`}>Review due</span> : null}
                {row.concern ? <span className={`${styles.chip} ${styles.red}`}>Concern</span> : null}
                <Link className={styles.open} href={`/${workspace}/onboarding/apprentice/${encodeURIComponent(row.gtaId)}`}>Open learner</Link>
              </div>
            </article>
          ))}
          {page.totals.learners > page.learners.length ? (
            <ShowMore workspace={workspace} page={page} group="learners" next={page.learners.length + 10} />
          ) : null}
        </section>
      ) : null}
      {page.employers.length ? (
        <section>
          <h2 className={styles.group}>Employers · {page.employers.length}{page.totals.employers > page.employers.length ? ` of ${page.totals.employers}` : ""}</h2>
          {page.employers.map((row) => (
            <article key={row.id} className={styles.card}>
              <div>
                <div className={styles.name}>{row.name}</div>
                {row.detail ? <div className={styles.meta}>{row.detail}</div> : null}
              </div>
              <div className={styles.chips}>
                <Link className={styles.open} href={`/${workspace}/onboarding/employer?open=${encodeURIComponent(row.id)}`}>Open employer</Link>
              </div>
            </article>
          ))}
          {page.totals.employers > page.employers.length ? (
            <ShowMore workspace={workspace} page={page} group="employers" next={page.employers.length + 10} />
          ) : null}
        </section>
      ) : null}
      {page.candidates.length ? (
        <section>
          <h2 className={styles.group}>Applicants · {page.candidates.length}{page.totals.applicants > page.candidates.length ? ` of ${page.totals.applicants}` : ""}</h2>
          {page.candidates.map((row) => (
            <article key={row.id} className={styles.card}>
              <div>
                <div className={styles.name}>{row.name} · {row.id}</div>
                {row.detail ? <div className={styles.meta}>{row.detail}</div> : null}
              </div>
              <div className={styles.chips}>
                <span className={row.active ? `${styles.chip} ${styles.green}` : styles.chip}>{row.statusLabel}</span>
                {row.reviewDue ? <span className={`${styles.chip} ${styles.amber}`}>Review due</span> : null}
                <Link className={styles.open} href={candidateHref(workspace, row.id)}>Open applicant</Link>
              </div>
            </article>
          ))}
          {page.totals.applicants > page.candidates.length ? (
            <ShowMore workspace={workspace} page={page} group="applicants" next={page.candidates.length + 10} />
          ) : null}
        </section>
      ) : null}
    </div>
  );
}

function ShowMore({
  workspace,
  page,
  group,
  next,
}: {
  workspace: "staff" | "administration" | "management";
  page: SearchDirectory;
  group: "learners" | "employers" | "applicants";
  next: number;
}) {
  const shown = {
    learners: page.learners.length,
    employers: page.employers.length,
    applicants: page.candidates.length,
  };
  shown[group] = next;
  return (
    <form action={`/${workspace}/search`} method="get">
      {page.query.trim() ? <input type="hidden" name="q" value={page.query.trim()} /> : null}
      {page.filter !== "all" ? <input type="hidden" name="filter" value={page.filter} /> : null}
      <input type="hidden" name="learners" value={String(shown.learners)} />
      <input type="hidden" name="employers" value={String(shown.employers)} />
      <input type="hidden" name="applicants" value={String(shown.applicants)} />
      <button className={styles.more} type="submit">Show more</button>
    </form>
  );
}

function candidateHref(workspace: "staff" | "administration" | "management", id: string): string {
  const home = workspace === "staff" ? "administration" : workspace;
  return `/${home}/onboarding/candidates/${encodeURIComponent(id)}`;
}
