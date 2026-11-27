"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { applicantListSearch } from "../domain/applicant-list";

type FilterValues = {
  query: string;
  site: string;
  programme: string;
  stage: string;
  employer: string;
};

const STAGES = ["All stages", "Stage 1", "Interview", "Stage 2", "Induction", "Started"];
const EMPLOYERS = ["All employer statuses", "Employer needed", "Identified", "Confirmed"];

export function ApplicantFilters({
  base,
  example,
  tab,
  filters,
  sites,
  programmes,
  resultCount,
}: {
  base: string;
  example: boolean;
  tab?: string;
  filters: FilterValues;
  sites: string[];
  programmes: string[];
  resultCount: number;
}) {
  const router = useRouter();
  const [query, setQuery] = useState(filters.query);
  const [seenQuery, setSeenQuery] = useState(filters.query);
  if (filters.query !== seenQuery) {
    setSeenQuery(filters.query);
    setQuery(filters.query);
  }

  function visit(next: Partial<FilterValues>, immediate = false) {
    const url = `${base}/candidates${applicantListSearch({
      example,
      tab,
      query: next.query ?? query,
      site: next.site ?? filters.site,
      programme: next.programme ?? filters.programme,
      stage: next.stage ?? filters.stage,
      employer: next.employer ?? filters.employer,
    })}`;
    if (immediate) router.replace(url, { scroll: false });
    return url;
  }

  useEffect(() => {
    if (query === filters.query) return;
    const timer = window.setTimeout(() => {
      router.replace(`${base}/candidates${applicantListSearch({
        example,
        tab,
        query,
        site: filters.site,
        programme: filters.programme,
        stage: filters.stage,
        employer: filters.employer,
      })}`, { scroll: false });
    }, 250);
    return () => window.clearTimeout(timer);
  }, [query, filters.query, filters.site, filters.programme, filters.stage, filters.employer, example, tab, base, router]);

  const active = [
    filters.query ? { key: "query" as const, label: `Search: ${filters.query}` } : null,
    filters.site !== "All sites" ? { key: "site" as const, label: `Site: ${filters.site}` } : null,
    filters.programme !== "All programmes" ? { key: "programme" as const, label: `Programme: ${filters.programme}` } : null,
    filters.stage !== "All stages" ? { key: "stage" as const, label: `Stage: ${filters.stage}` } : null,
    filters.employer !== "All employer statuses" ? { key: "employer" as const, label: `Employer: ${filters.employer}` } : null,
  ].filter((chip): chip is { key: keyof FilterValues; label: string } => Boolean(chip));

  const cleared: FilterValues = { query: "", site: "All sites", programme: "All programmes", stage: "All stages", employer: "All employer statuses" };

  return (
    <div className="card card-pad applicant-filters">
      <div className="filter-bar">
        <div className="filter-search">
          <SearchIcon />
          <input
            type="search"
            value={query}
            placeholder="Name or ID"
            aria-label="Search applicants by name or ID"
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                visit({ query }, true);
              }
            }}
          />
          {query ? (
            <button type="button" className="filter-x" aria-label="Clear search" onClick={() => { setQuery(""); visit({ query: "" }, true); }}>
              ×
            </button>
          ) : null}
        </div>
        <FilterSelect label="Site" value={filters.site} options={withCurrent(sites, filters.site, "All sites")} onChange={(site) => visit({ site }, true)} />
        <FilterSelect label="Programme" value={filters.programme} options={withCurrent(programmes, filters.programme, "All programmes")} onChange={(programme) => visit({ programme }, true)} />
        <FilterSelect label="Stage" value={filters.stage} options={STAGES} onChange={(stage) => visit({ stage }, true)} />
        <FilterSelect label="Employer status" value={filters.employer} options={EMPLOYERS} onChange={(employer) => visit({ employer }, true)} />
      </div>
      {active.length ? (
        <div className="filter-meta">
          <span className="filter-count">{resultCount} {resultCount === 1 ? "applicant" : "applicants"}</span>
          {active.map((chip) => (
            <a key={chip.key} className="filter-chip" aria-label={`Remove ${chip.label}`} href={`${base}/candidates${applicantListSearch({ example, tab, ...filters, [chip.key]: chip.key === "query" ? "" : cleared[chip.key] })}`}>
              {chip.label}
              <span aria-hidden="true">×</span>
            </a>
          ))}
          <a className="filter-clear" href={`${base}/candidates${applicantListSearch({ example, tab })}`}>Clear all</a>
        </div>
      ) : null}
    </div>
  );
}

function FilterSelect({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: string[];
  onChange: (value: string) => void;
}) {
  const active = value !== options[0];
  return (
    <select aria-label={label} className={active ? "is-on" : undefined} value={value} onChange={(event) => onChange(event.target.value)}>
      {options.map((option) => <option key={option}>{option}</option>)}
    </select>
  );
}

function withCurrent(options: string[], current: string, all: string): string[] {
  const values = current && current !== all ? [current, ...options] : options;
  return [all, ...[...new Set(values)].filter((value) => value !== all).sort()];
}

function SearchIcon() {
  return (
    <svg className="filter-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="11" cy="11" r="7" />
      <path d="M20 20l-3.5-3.5" />
    </svg>
  );
}
