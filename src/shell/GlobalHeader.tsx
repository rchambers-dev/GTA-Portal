"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { DevAccountSwitcher } from "./demo/DevAccountSwitcher";
import { useDemoSession } from "./demo/DemoSessionProvider";
import { NavIcon } from "./nav-icons";
import {
  categoryLabel,
  getPortalNotifications,
  type PortalNotification,
} from "./notifications";
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
  const notifWrapRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [readIds, setReadIds] = useState<string[]>([]);
  const account = session?.account;

  const allNotifications = useMemo(
    () => (account ? getPortalNotifications(account.workspace) : []),
    [account],
  );

  const unreadNotifications = useMemo(
    () => allNotifications.filter((item) => !readIds.includes(item.id)),
    [allNotifications, readIds],
  );

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
        setNotifOpen(false);
      }
      if (event.key === "Escape") {
        setOpen(false);
        setNotifOpen(false);
      }
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

  useEffect(() => {
    if (!notifOpen) return;
    function onPointerDown(event: MouseEvent) {
      const target = event.target as Node | null;
      if (!target || !notifWrapRef.current) return;
      if (notifWrapRef.current.contains(target)) return;
      setNotifOpen(false);
    }
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [notifOpen]);

  if (!account) return null;

  function goTo(href: string) {
    setOpen(false);
    setNotifOpen(false);
    router.push(href);
  }

  function selectNotification(item: PortalNotification) {
    setReadIds((prev) =>
      prev.includes(item.id) ? prev : [...prev, item.id],
    );
    goTo(item.href);
  }

  function markAllRead() {
    setReadIds(allNotifications.map((item) => item.id));
  }

  const unreadCount = unreadNotifications.length;

  return (
    <>
      <header
        className={
          hidden ? `${styles.header} ${styles.headerHidden}` : styles.header
        }
      >
        <div className={styles.headerStart} aria-hidden />
        <button
          type="button"
          className={styles.commandTrigger}
          onClick={() => {
            setOpen(true);
            setNotifOpen(false);
          }}
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
          <div className={styles.notifWrap} ref={notifWrapRef}>
            <button
              type="button"
              className={styles.iconBtn}
              aria-label={
                unreadCount
                  ? `Notifications, ${unreadCount} unread`
                  : "Notifications"
              }
              aria-haspopup="menu"
              aria-expanded={notifOpen}
              onClick={() => {
                setNotifOpen((current) => !current);
                setOpen(false);
              }}
            >
              <span className={styles.iconGlyph} aria-hidden>
                N
              </span>
              {unreadCount > 0 ? (
                <span className={styles.badge}>
                  {unreadCount > 99 ? "99+" : unreadCount}
                </span>
              ) : null}
            </button>

            {notifOpen ? (
              <div
                className={styles.notifPanel}
                role="menu"
                aria-label="Notifications"
              >
                <div className={styles.notifHead}>
                  <div>
                    <strong>Notifications</strong>
                    <span>
                      {unreadCount
                        ? `${unreadCount} to action`
                        : "You're up to date"}
                    </span>
                  </div>
                  {unreadCount > 0 ? (
                    <button
                      type="button"
                      className={styles.notifMarkAll}
                      onClick={markAllRead}
                    >
                      Mark all read
                    </button>
                  ) : null}
                </div>

                <div className={styles.notifList}>
                  {unreadNotifications.length === 0 ? (
                    <p className={styles.notifEmpty}>
                      No open notifications. New actions and messages will show
                      here.
                    </p>
                  ) : (
                    unreadNotifications.map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        role="menuitem"
                        className={styles.notifItem}
                        data-urgent={item.urgent ? "true" : "false"}
                        onClick={() => selectNotification(item)}
                      >
                        <span className={styles.notifItemTop}>
                          <span
                            className={styles.notifCategory}
                            data-category={item.category}
                          >
                            {categoryLabel(item.category)}
                          </span>
                          <span className={styles.notifWhen}>{item.when}</span>
                        </span>
                        <strong className={styles.notifTitle}>
                          {item.title}
                        </strong>
                        <span className={styles.notifDetail}>{item.detail}</span>
                        <span className={styles.notifCta}>
                          {item.hrefLabel} →
                        </span>
                      </button>
                    ))
                  )}
                </div>
              </div>
            ) : null}
          </div>

          <button
            type="button"
            className={styles.iconBtn}
            aria-label="Flags (preview)"
            title="Flags coming soon"
          >
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
                        <NavIcon href={page.href} />
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
              <span>
                <kbd>↑</kbd>
                <kbd>↓</kbd> navigate
              </span>
              <span>
                <kbd>Enter</kbd> open
              </span>
              <span>
                <kbd>Esc</kbd> close
              </span>
            </footer>
          </section>
        </div>
      ) : null}
    </>
  );
}
