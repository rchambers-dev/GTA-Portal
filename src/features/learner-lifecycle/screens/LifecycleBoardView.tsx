"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import type {
  BoardColumnDto,
  BoardQuery,
  LearnerCardDto,
  LifecycleBoardDto,
  MetricKey,
} from "../types";
import { LearnerKanbanCard } from "../components/LearnerKanbanCard";
import { HorizontalScrollRegion } from "../components/HorizontalScrollRegion";
import { yearStartWeek } from "@/lib/board-query";
import { learnerStatusHref } from "@/features/progress-mentor/lib/metric-links";
import styles from "./LifecycleBoardScreen.module.css";

function buildQueryHref(base: Partial<BoardQuery> & { metric?: MetricKey | null }) {
  const params = new URLSearchParams();
  const year = base.year ?? 1;
  params.set("year", String(year));
  if (base.metric) params.set("metric", base.metric);
  return `/learners/lifecycle?${params.toString()}`;
}

function matchesLearner(learner: LearnerCardDto, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const haystack = [
    learner.displayName,
    learner.programmeName,
    learner.employerName ?? "",
    learner.initials,
    learner.learnerId,
  ]
    .join(" ")
    .toLowerCase();
  return haystack.includes(q);
}

function filterColumnIds(
  column: BoardColumnDto,
  learnersById: Record<string, LearnerCardDto>,
  query: string,
): string[] {
  return column.learnerIds.filter((id) => {
    const learner = learnersById[id];
    return learner ? matchesLearner(learner, query) : false;
  });
}

type Props = {
  board: LifecycleBoardDto;
  selectedLearnerId?: string | null;
};

/**
 * Board with learner search — filters cards and scrolls to the first match.
 * Horizontal week scrolling remains available.
 */
export function LifecycleBoardView({ board, selectedLearnerId }: Props) {
  const q = board.query;
  const [search, setSearch] = useState("");
  const columnsRef = useRef<HTMLDivElement>(null);

  const filtered = useMemo(() => {
    const columns = board.columns.map((column) => ({
      ...column,
      learnerIds: filterColumnIds(column, board.learnersById, search),
    }));
    const overdueColumn = {
      ...board.overdueColumn,
      learnerIds: filterColumnIds(board.overdueColumn, board.learnersById, search),
    };
    const matchCount =
      columns.reduce((sum, c) => sum + c.learnerIds.length, 0) +
      overdueColumn.learnerIds.length;
    return { columns, overdueColumn, matchCount };
  }, [board, search]);

  useEffect(() => {
    if (!search.trim() || !columnsRef.current) return;

    const firstMatchColumn = filtered.columns.find((c) => c.learnerIds.length > 0);
    const overdueHasMatch = filtered.overdueColumn.learnerIds.length > 0;

    if (firstMatchColumn) {
      const el = columnsRef.current.querySelector(
        `[data-column-key="${firstMatchColumn.kind}-${firstMatchColumn.weekNumber ?? "pre"}"]`,
      );
      el?.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
    } else if (overdueHasMatch) {
      const el = columnsRef.current.parentElement?.querySelector(
        '[data-column-key="overdue"]',
      );
      el?.scrollIntoView({ behavior: "smooth", inline: "nearest", block: "nearest" });
    }
  }, [search, filtered.columns, filtered.overdueColumn.learnerIds.length]);

  const searching = search.trim().length > 0;

  return (
    <>
      <section className={styles.toolbar} aria-label="Board filters">
        <div className={styles.toolbarInner}>
          <div className={styles.yearTabs} role="tablist" aria-label="Programme year">
            {([1, 2, 3] as const).map((year) => (
              <Link
                key={year}
                href={buildQueryHref({ ...q, year, fromWeek: yearStartWeek(year) })}
                className={q.year === year ? styles.tabActive : styles.tab}
                role="tab"
                aria-selected={q.year === year}
              >
                Year {year}
              </Link>
            ))}
          </div>

          <div className={styles.searchGroup}>
            <label className={styles.searchLabel} htmlFor="learner-board-search">
              <span className={styles.visuallyHidden}>Search learners</span>
              <input
                id="learner-board-search"
                type="search"
                className={styles.searchInput}
                placeholder="Search learners…"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                autoComplete="off"
              />
            </label>
            {searching ? (
              <span className={styles.searchMeta} aria-live="polite">
                {filtered.matchCount === 0
                  ? "No learners found"
                  : `${filtered.matchCount} found`}
              </span>
            ) : null}
          </div>
        </div>
      </section>

      <section className={styles.board} aria-label="Kanban board">
        <HorizontalScrollRegion className={styles.columns} ref={columnsRef}>
          {filtered.columns.map((column) => (
            <div
              key={`${column.kind}-${column.weekNumber ?? "pre"}`}
              className={styles.column}
              data-column-key={`${column.kind}-${column.weekNumber ?? "pre"}`}
            >
              <div className={styles.columnHeader}>
                <div className={styles.columnHeading}>
                  <h2 className={styles.columnTitle}>{column.label}</h2>
                  {column.sublabel ? (
                    <p className={styles.columnDates}>{column.sublabel}</p>
                  ) : null}
                </div>
                <span className={styles.count}>{column.learnerIds.length}</span>
              </div>
              <div className={styles.cards}>
                {column.learnerIds.length === 0 ? (
                  <p className={styles.emptyColumn}>
                    {searching ? "No matches" : "No learners"}
                  </p>
                ) : (
                  column.learnerIds.map((id) => {
                    const learner = board.learnersById[id];
                    if (!learner) return null;
                    return (
                      <LearnerKanbanCard
                        key={id}
                        learner={learner}
                        selected={selectedLearnerId === id}
                        href={`${learnerStatusHref(id, learner.overallStatus)}&year=${q.year}`}
                      />
                    );
                  })
                )}
              </div>
            </div>
          ))}
        </HorizontalScrollRegion>

        <div
          className={styles.overdueColumn}
          aria-label="Programme overdue"
          data-column-key="overdue"
        >
          <div className={styles.columnHeader}>
            <h2 className={styles.columnTitle}>{filtered.overdueColumn.label}</h2>
            <span className={styles.count}>{filtered.overdueColumn.learnerIds.length}</span>
          </div>
          <p className={styles.overdueHint}>{filtered.overdueColumn.sublabel}</p>
          <div className={styles.cards}>
            {filtered.overdueColumn.learnerIds.length === 0 ? (
              <p className={styles.emptyColumn}>
                {searching ? "No matches" : "No learners"}
              </p>
            ) : (
              filtered.overdueColumn.learnerIds.map((id) => {
                const learner = board.learnersById[id];
                if (!learner) return null;
                return (
                  <LearnerKanbanCard
                    key={id}
                    learner={learner}
                    selected={selectedLearnerId === id}
                    href={learnerStatusHref(id, learner.overallStatus)}
                  />
                );
              })
            )}
          </div>
        </div>
      </section>
    </>
  );
}
