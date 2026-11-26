import Link from "next/link";
import { boardDayLabel, lastReviewLabel, sentLabel, type BoardCard, type ReviewBoard, type WaitingTutorGroup } from "../domain/review-board";
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
  const [firstHalf, secondHalf] = [board.weeks.slice(0, 5), board.weeks.slice(5)];
  const laterNote = board.laterCount === 0
    ? "No reviews are planned after these 10 weeks."
    : `${board.laterCount} ${board.laterCount === 1 ? "review is" : "reviews are"} planned after these 10 weeks.`;
  const undatedNote = board.undatedCount
    ? ` ${board.undatedCount} open ${board.undatedCount === 1 ? "review has" : "reviews have"} no planned date.`
    : "";
  return (
    <div className={styles.page} data-review-board="">
      <div className={styles.toolbar}>
        <Link className={styles.link} href={`/${workspace}/reviews/plan`}>Back to Plan</Link>
        <PrintBoardButton className={styles.print} />
      </div>
      <section className={styles.sheet}>
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
          <div className={styles.overdueCards}>
            {board.overdue.length === 0 ? <p className={styles.none}>None before this week.</p> : board.overdue.map((card) => <Card key={card.gtaId} card={card} />)}
          </div>
        </section>
        <WeekRow weeks={firstHalf} />
      </section>
      <section className={styles.sheet}>
        <header className={`${styles.header} ${styles.continuation}`}>
          <div>
            <p className={styles.kicker}>Reviews</p>
            <h1>Review board · weeks 6-10</h1>
          </div>
        </header>
        <WeekRow weeks={secondHalf} />
        <WaitingOnTutors groups={board.waiting} />
        <footer className={styles.footer}>{laterNote}{undatedNote}</footer>
      </section>
    </div>
  );
}

function WaitingOnTutors({ groups }: { groups: WaitingTutorGroup[] }) {
  if (!groups.length) return null;
  const total = groups.reduce((sum, group) => sum + group.count, 0);
  return (
    <section className={styles.waiting} aria-label="Waiting on tutors">
      <h2>Waiting on tutors <span>{total}</span></h2>
      <div className={styles.waitingGroups}>
        {groups.map((group) => (
          <div className={styles.waitingGroup} key={group.tutor}>
            <h3>{group.tutor} <span>{group.count}</span></h3>
            <div className={styles.chips}>
              {group.apprentices.map((person) => (
                <span className={styles.chip} key={person.gtaId}>
                  <strong>{person.name}</strong>
                  <span>{sentLabel(person.sentOn, person.daysWaiting)}</span>
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function WeekRow({ weeks }: { weeks: ReviewBoard["weeks"] }) {
  return (
    <div className={styles.row}>
      {weeks.map((week) => (
        <section
          key={week.start}
          className={week.excluded ? `${styles.column} ${styles.columnClosed}` : styles.column}
          style={{ ["--cards" as string]: String(Math.max(week.cards.length, 1)) }}
          aria-label={week.label}
        >
          <header>
            <strong>{week.excluded ? "Closed" : week.label}</strong>
            <span>{week.range}</span>
            {week.excluded ? null : <em>{week.cards.length}</em>}
          </header>
          {week.closedDays.length ? (
            <p className={styles.closedNames}>{week.closedDays.map((day) => day.name).join(" · ")}</p>
          ) : null}
          {week.excluded ? null : (
            <div className={styles.stack}>
              {week.cards.map((card) => <Card key={card.gtaId} card={card} />)}
            </div>
          )}
        </section>
      ))}
    </div>
  );
}
