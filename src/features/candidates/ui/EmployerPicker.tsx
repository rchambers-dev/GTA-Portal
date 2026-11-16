"use client";

import { useMemo, useState } from "react";
import type { EmployerChoice } from "../domain/employers";

/** Search existing employers by name. The employer ID is stored, never typed. */
export function EmployerPicker({
  employers,
  required = false,
}: {
  employers: EmployerChoice[];
  required?: boolean;
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [selectedId, setSelectedId] = useState("");
  const selected = employers.find((employer) => employer.employerId === selectedId) ?? null;
  const matches = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return employers.slice(0, 6);
    return employers.filter((employer) => employer.name.toLowerCase().includes(needle)).slice(0, 8);
  }, [employers, query]);

  return (
    <div className="field wide">
      <span className="label">Employer{required ? "" : ", optional"}</span>
      <input type="hidden" name="employerId" value={selected?.employerId ?? ""} />
      {required ? <input className="picker-guard" tabIndex={-1} aria-hidden="true" required value={selected?.name ?? ""} readOnly /> : null}
      {selected ? (
        <div className="employer-picked">
          <div className="side-value">{selected.name}</div>
          <button className="btn-ghost" type="button" onClick={() => { setSelectedId(""); setQuery(""); }}>
            Choose a different employer
          </button>
          <dl className="picked-facts">
            <div><dt>Employer ID</dt><dd className="readonly-id">{selected.employerId}</dd></div>
            <div><dt>Site</dt><dd>{selected.site}</dd></div>
            <div><dt>Address</dt><dd>{selected.address}</dd></div>
            <div><dt>Contact</dt><dd>{selected.contact}</dd></div>
            <div><dt>Phone</dt><dd>{selected.phone}</dd></div>
            <div><dt>Email</dt><dd>{selected.email}</dd></div>
          </dl>
        </div>
      ) : (
        <>
          <input
            type="search"
            value={query}
            placeholder="Type an employer name"
            aria-label="Search employers by name"
            autoComplete="off"
            onFocus={() => setOpen(true)}
            onBlur={() => window.setTimeout(() => setOpen(false), 150)}
            onChange={(event) => { setQuery(event.target.value); setOpen(true); }}
          />
          <div className="hint">Pick an existing employer. The employer ID is assigned by the system and cannot be typed.</div>
          {employers.length === 0 ? (
            <div className="hint">No employers are available yet.</div>
          ) : open ? (
            <ul className="employer-matches">
              {matches.map((employer) => (
                <li key={employer.employerId}>
                  <button type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => { setSelectedId(employer.employerId); setOpen(false); }}>
                    <strong>{employer.name}</strong>
                    <span>{employer.site} · {employer.address}</span>
                  </button>
                </li>
              ))}
              {matches.length === 0 ? <li className="muted">No employer matches that name.</li> : null}
            </ul>
          ) : null}
        </>
      )}
    </div>
  );
}
