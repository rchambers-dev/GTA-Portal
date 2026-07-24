"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { DevAccountSwitcher } from "./demo/DevAccountSwitcher";
import { useDemoSession } from "./demo/DemoSessionProvider";
import { resolveNavigation } from "./workspaces/resolve-navigation";
import styles from "./GlobalHeader.module.css";

/**
 * TEMPORARY standalone header.
 * Replace with portal header on integration.
 */
export function GlobalHeader({ hidden = false }: { hidden?: boolean }) {
  const { session } = useDemoSession();
  const router = useRouter();
  const pathname = usePathname();
  const inputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const account = session?.account;

  const pages = useMemo(
    () =>
      session
        ? resolveNavigation(session).flatMap((section) =>
            section.items.map((item) => ({
              ...item,
              section: section.title ?? "Portal",
            })),
          )
        : [],
    [session],
  );

  const results = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return pages;
    return pages.filter(
      (page) =>
        page.label.toLowerCase().includes(term) ||
        page.section.toLowerCase().includes(term) ||
        page.href.toLowerCase().includes(term),
    );
  }, [pages, query]);

  useEffect(() => {
    function onShortcut(event: KeyboardEvent) {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setOpen((current) => !current);
      }
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", onShortcut);
    return () => document.removeEventListener("keydown", onShortcut);
  }, []);

  useEffect(() => {
    if (!open) return;
    setQuery("");
    setSelectedIndex(0);
    requestAnimationFrame(() => inputRef.current?.focus());
  }, [open]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  if (!account) return null;

  function goTo(href: string) {
    setOpen(false);
    router.push(href);
  }

  return (
    <>
      <header
        className={hidden ? `${styles.header} ${styles.headerHidden}` : styles.header}
      >
        <div className={styles.headerStart} aria-hidden />
        <button
          type="button"
          className={styles.commandTrigger}
          onClick={() => setOpen(true)}
          aria-haspopup="dialog"
          aria-expanded={open}
        >
          <span className={styles.commandIcon} aria-hidden>
            ⌕
          </span>
          <span className={styles.commandPlaceholder}>
            Search pages and commands…
          </span>
          <kbd>Ctrl K</kbd>
        </button>

        <div className={styles.actions}>
          <button type="button" className={styles.iconBtn} aria-label="Notifications (preview)">
            <span className={styles.iconGlyph} aria-hidden>
              N
            </span>
            <span className={styles.badge}>12</span>
          </button>
          <button type="button" className={styles.iconBtn} aria-label="Flags (preview)">
            <span className={styles.iconGlyph} aria-hidden>
              F
            </span>
            <span className={`${styles.badge} ${styles.badgeAmber}`}>9</span>
          </button>
          <div className={styles.user}>
            <DevAccountSwitcher currentAccount={account} />
          </div>
        </div>
      </header>

      {open ? (
        <div
          className={styles.commandBackdrop}
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setOpen(false);
          }}
        >
          <section
            className={styles.commandPalette}
            role="dialog"
            aria-modal="true"
            aria-label="Go to a portal page"
          >
            <div className={styles.commandSearch}>
              <span aria-hidden>⌕</span>
              <input
                ref={inputRef}
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "ArrowDown") {
                    event.preventDefault();
                    setSelectedIndex((index) =>
                      Math.min(index + 1, results.length - 1),
                    );
                  } else if (event.key === "ArrowUp") {
                    event.preventDefault();
                    setSelectedIndex((index) => Math.max(index - 1, 0));
                  } else if (event.key === "Enter" && results[selectedIndex]) {
                    event.preventDefault();
                    goTo(results[selectedIndex].href);
                  }
                }}
                placeholder="Type a page name…"
                aria-label="Search portal pages"
                aria-controls="portal-command-results"
              />
              <kbd>Esc</kbd>
            </div>

            <div
              id="portal-command-results"
              className={styles.commandResults}
              role="listbox"
            >
              {results.length ? (
                results.map((page, index) => {
                  const active = pathname === page.href.split("?")[0];
                  const selected = index === selectedIndex;
                  return (
                    <button
                      key={page.href}
                      type="button"
                      role="option"
                      aria-selected={selected}
                      className={
                        selected
                          ? styles.commandResultSelected
                          : styles.commandResult
                      }
                      onMouseEnter={() => setSelectedIndex(index)}
                      onClick={() => goTo(page.href)}
                    >
                      <span className={styles.resultIcon} aria-hidden>
                        →
                      </span>
                      <span className={styles.resultMain}>
                        <strong>{page.label}</strong>
                        <span>{page.section}</span>
                      </span>
                      {active ? (
                        <span className={styles.currentBadge}>Current</span>
                      ) : (
                        <span className={styles.resultPath}>{page.href}</span>
                      )}
                    </button>
                  );
                })
              ) : (
                <p className={styles.commandEmpty}>
                  No portal pages match “{query}”.
                </p>
              )}
            </div>

            <footer className={styles.commandFooter}>
              <span><kbd>↑</kbd><kbd>↓</kbd> navigate</span>
              <span><kbd>Enter</kbd> open</span>
              <span><kbd>Esc</kbd> close</span>
            </footer>
          </section>
        </div>
      ) : null}
    </>
  );
}
