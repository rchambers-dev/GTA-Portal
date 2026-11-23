import Link from "next/link";
import { boardDayLabel, lastReviewLabel, type BoardCard, type ReviewBoard } from "../domain/review-board";
import { PrintBoardButton } from "./PrintBoardButton";
import styles from "./review-board.module.css";

function Card({ card }: { card: BoardCard }) {
  return (
    <article className={`${styles.card} ${styles[card.stage]}`} data-stage={card.stage}>
      <p className={styles.line}>
        <strong>{card.name}</strong>
        <span className={styles.dates}>
          <span className={styles.last}>{lastReviewLabel(card.lastOn)}</span>
          <span>{card.plannedOn ? boardDayLabel(card.plannedOn) : "No date"}</span>
        </span>
      </p>
      <p className={styles.line}>
        <span className={styles.meta}>{card.employer} · {card.tutor}</span>
        <span className={styles.pills}>
          <em className={styles.stage}>{card.stageLabel}</em>
          {card.hold ? <em className={styles.hold}>On hold</em> : null}
          {card.concern ? <em className={styles.concern}>Concern</em> : null}
        </span>
      </p>
    </article>
  );
}

export function ReviewBoardView({
  workspace,
  board,
}: {
  workspace: "administration" | "management";
  board: ReviewBoard;
}) {
  const shown = board.weeks.reduce((sum, week) => sum + week.cards.length, 0) + board.overdue.length;
  return (
    <div className={styles.page} data-review-board="">
      <div className={styles.toolbar}>
        <Link className={styles.link} href={`/${workspace}/reviews/plan`}>Back to Plan</Link>
        <PrintBoardButton className={styles.print} />
      </div>
      <header className={styles.header}>
        <div>
          <p className={styles.kicker}>Reviews</p>
          <h1>Review board</h1>
        </div>
        <p className={styles.summary}>
          {shown} on this sheet
          {board.laterCount ? ` · ${board.laterCount} after week 10` : ""}
          {board.undatedCount ? ` · ${board.undatedCount} with no date` : ""}
        </p>
      </header>
      <section className={styles.overdue} aria-label="Overdue">
        <h2>Overdue <span>{board.overdue.length}</span></h2>
        <div className={styles.overdueCards} style={{ ["--cards" as string]: String(Math.max(board.overdue.length, 1)) }}>
          {board.overdue.length === 0 ? <p className={styles.none}>None before this week.</p> : board.overdue.map((card) => <Card key={card.gtaId} card={card} />)}
        </div>
      </section>
      <div className={styles.rows}>
        {[board.weeks.slice(0, 5), board.weeks.slice(5)].map((row) => (
          <div className={styles.row} key={row[0]?.start}>
            {row.map((week) => (
              <section
                key={week.start}
                className={styles.column}
                style={{ ["--cards" as string]: String(Math.max(week.cards.length, 1)) }}
                aria-label={week.label}
              >
                <header>
                  <strong>{week.label}</strong>
                  <span>{week.range}</span>
                  <em>{week.cards.length}</em>
                </header>
                <div className={styles.stack}>
                  {week.cards.map((card) => <Card key={card.gtaId} card={card} />)}
                </div>
              </section>
            ))}
          </div>
        ))}
      </div>
      <footer className={styles.footer}>
        {board.laterCount === 0
          ? "No reviews are planned after these 10 weeks."
          : `${board.laterCount} ${board.laterCount === 1 ? "review is" : "reviews are"} planned after these 10 weeks.`}
        {board.undatedCount
          ? ` ${board.undatedCount} open ${board.undatedCount === 1 ? "review has" : "reviews have"} no planned date.`
          : ""}
      </footer>
    </div>
  );
}
