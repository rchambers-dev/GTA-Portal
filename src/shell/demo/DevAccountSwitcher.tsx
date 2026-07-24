"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { DemoAccount } from "@/lib/portal/types";
import { formatRoleLabel } from "@/adapters/fictional/demo-accounts";
import { useDemoSession } from "./DemoSessionProvider";
import styles from "./DevAccountSwitcher.module.css";

function scopeSummary(account: DemoAccount): string | null {
  const parts: string[] = [];
  if (account.department) parts.push(account.department);
  if (account.programmeScope?.length) parts.push(account.programmeScope.join(", "));
  return parts.length ? parts.join(" · ") : null;
}

export function DevAccountSwitcher({
  currentAccount,
}: {
  currentAccount: DemoAccount;
}) {
  const { demoEnabled, accounts, session, switchAccount } = useDemoSession();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const rootRef = useRef<HTMLDivElement>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return accounts;
    return accounts.filter(
      (a) =>
        a.name.toLowerCase().includes(q) ||
        a.baseRole.toLowerCase().includes(q) ||
        a.email.toLowerCase().includes(q) ||
        a.workspace.toLowerCase().includes(q),
    );
  }, [accounts, query]);

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  if (!demoEnabled) {
    return (
      <div className={styles.profileStatic}>
        <div className={styles.avatar} aria-hidden>
          {currentAccount.initials}
        </div>
        <div>
          <p className={styles.userName}>{currentAccount.name}</p>
          <p className={styles.userRole}>{formatRoleLabel(currentAccount)}</p>
        </div>
      </div>
    );
  }

  const tempBadge = session.activeTemporaryAssignments[0];

  return (
    <div className={styles.root} ref={rootRef}>
      <button
        type="button"
        className={styles.trigger}
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="listbox"
      >
        <div className={styles.avatar} aria-hidden>
          {currentAccount.initials}
        </div>
        <div className={styles.triggerText}>
          <p className={styles.userName}>{currentAccount.name}</p>
          <p className={styles.userRole}>{formatRoleLabel(session.account)}</p>
          {tempBadge ? (
            <p className={styles.tempBadge}>
              Temporary: {tempBadge.responsibility} · expires{" "}
              {new Date(tempBadge.expiresAt).toLocaleDateString("en-GB")}
            </p>
          ) : null}
        </div>
        <span className={styles.chevron} aria-hidden>
          ▾
        </span>
      </button>

      {open ? (
        <div className={styles.panel} role="listbox" aria-label="Demo account switcher">
          <p className={styles.notice}>Demo account switcher — development only</p>
          <input
            type="search"
            className={styles.search}
            placeholder="Search accounts…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            autoFocus
          />
          <ul className={styles.list}>
            {filtered.map((account) => {
              const active = account.id === currentAccount.id;
              const scope = scopeSummary(account);
              return (
                <li key={account.id}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={active}
                    className={active ? styles.optionActive : styles.option}
                    onClick={() => {
                      switchAccount(account.id);
                      setOpen(false);
                    }}
                  >
                    <span className={styles.optionHeader}>
                      <span className={styles.optionName}>{account.name}</span>
                      {active ? <span className={styles.currentPill}>Current</span> : null}
                    </span>
                    <span className={styles.optionMeta}>
                      {account.baseRole} · {account.workspace}
                    </span>
                    {scope ? <span className={styles.optionScope}>{scope}</span> : null}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
