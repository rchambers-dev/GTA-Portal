"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import type {
  BoardColumnDto,
  BoardQuery,
  ApprenticeCardDto,
  LifecycleBoardDto,
  MetricKey,
} from "../types";
import { ApprenticeKanbanCard } from "../components/ApprenticeKanbanCard";
import { HorizontalScrollRegion } from "../components/HorizontalScrollRegion";
import { yearStartWeek } from "@/lib/board-query";
import { apprenticeStatusHref } from "@/features/progress-mentor/lib/metric-links";
import styles from "./LifecycleBoardScreen.module.css";

function buildQueryHref(base: Partial<BoardQuery> & { metric?: MetricKey | null }) {
  const params = new URLSearchParams();
  const year = base.year ?? 1;
  params.set("year", String(year));
  if (base.metric) params.set("metric", base.metric);
  return `/apprentices/lifecycle?${params.toString()}`;
}

function matchesApprentice(apprentice: ApprenticeCardDto, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const haystack = [
    apprentice.displayName,
    apprentice.programmeName,
    apprentice.employerName ?? "",
    apprentice.initials,
    apprentice.apprenticeId,
  ]
    .join(" ")
    .toLowerCase();
  return haystack.includes(q);
}

function filterColumnIds(
  column: BoardColumnDto,
  apprenticesById: Record<string, ApprenticeCardDto>,
  query: string,
): string[] {
  return column.apprenticeIds.filter((id) => {
    const apprentice = apprenticesById[id];
    return apprentice ? matchesApprentice(apprentice, query) : false;
  });
}

type Props = {
  board: LifecycleBoardDto;
  selectedApprenticeId?: string | null;
};

/**
 * Board with apprentice search — filters cards and scrolls to the first match.
 * Horizontal week scrolling remains available.
 */
export function LifecycleBoardView({ board, selectedApprenticeId }: Props) {
  const q = board.query;
  const [search, setSearch] = useState("");
  const columnsRef = useRef<HTMLDivElement>(null);

  const filtered = useMemo(() => {
    const columns = board.columns.map((column) => ({
      ...column,
      apprenticeIds: filterColumnIds(column, board.apprenticesById, search),
    }));
    const overdueColumn = {
      ...board.overdueColumn,
      apprenticeIds: filterColumnIds(board.overdueColumn, board.apprenticesById, search),
    };
    const matchCount =
      columns.reduce((sum, c) => sum + c.apprenticeIds.length, 0) +
      overdueColumn.apprenticeIds.length;
    return { columns, overdueColumn, matchCount };
  }, [board, search]);

  useEffect(() => {
    if (!search.trim() || !columnsRef.current) return;

    const firstMatchColumn = filtered.columns.find((c) => c.apprenticeIds.length > 0);
    const overdueHasMatch = filtered.overdueColumn.apprenticeIds.length > 0;

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
  }, [search, filtered.columns, filtered.overdueColumn.apprenticeIds.length]);

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
            <label className={styles.searchLabel} htmlFor="apprentice-board-search">
              <span className={styles.visuallyHidden}>Search apprentices</span>
              <input
                id="apprentice-board-search"
                type="search"
                className={styles.searchInput}
                placeholder="Search apprentices…"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                autoComplete="off"
              />
            </label>
            {searching ? (
              <span className={styles.searchMeta} aria-live="polite">
                {filtered.matchCount === 0
                  ? "No apprentices found"
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
                <span className={styles.count}>{column.apprenticeIds.length}</span>
              </div>
              <div className={styles.cards}>
                {column.apprenticeIds.length === 0 ? (
                  <p className={styles.emptyColumn}>
                    {searching ? "No matches" : "No apprentices"}
                  </p>
                ) : (
                  column.apprenticeIds.map((id) => {
                    const apprentice = board.apprenticesById[id];
                    if (!apprentice) return null;
                    return (
                      <ApprenticeKanbanCard
                        key={id}
                        apprentice={apprentice}
                        selected={selectedApprenticeId === id}
                        href={`${apprenticeStatusHref(id, apprentice.overallStatus)}&year=${q.year}`}
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
            <span className={styles.count}>{filtered.overdueColumn.apprenticeIds.length}</span>
          </div>
          <p className={styles.overdueHint}>{filtered.overdueColumn.sublabel}</p>
          <div className={styles.cards}>
            {filtered.overdueColumn.apprenticeIds.length === 0 ? (
              <p className={styles.emptyColumn}>
                {searching ? "No matches" : "No apprentices"}
              </p>
            ) : (
              filtered.overdueColumn.apprenticeIds.map((id) => {
                const apprentice = board.apprenticesById[id];
                if (!apprentice) return null;
                return (
                  <ApprenticeKanbanCard
                    key={id}
                    apprentice={apprentice}
                    selected={selectedApprenticeId === id}
                    href={apprenticeStatusHref(id, apprentice.overallStatus)}
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
