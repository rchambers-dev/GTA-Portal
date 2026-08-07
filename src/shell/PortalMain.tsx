"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { GlobalHeader } from "./GlobalHeader";
import styles from "./PortalShell.module.css";

function isFormField(target: EventTarget | null): target is
  | HTMLInputElement
  | HTMLTextAreaElement
  | HTMLSelectElement {
  return (
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    target instanceof HTMLSelectElement
  );
}

/**
 * Main column with auto-hiding header: scrolls down to hide, up to reveal.
 *
 * Focus must not jump the page — browsers scroll focused fields into view,
 * which fights the sticky header. We pin scroll position around focus changes
 * without forcing the header to reappear (that stays scroll-driven only).
 */
export function PortalMain({
  children,
  withDock = false,
}: {
  children: ReactNode;
  withDock?: boolean;
}) {
  const pathname = usePathname();
  const scrollRef = useRef<HTMLDivElement>(null);
  const lastScrollTop = useRef(0);
  const pinnedScrollTop = useRef(0);
  const lockUntil = useRef(0);
  const [headerHidden, setHeaderHidden] = useState(false);
  const [prevPathname, setPrevPathname] = useState(pathname);

  if (pathname !== prevPathname) {
    setPrevPathname(pathname);
    setHeaderHidden(false);
  }

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    function lockScroll(ms = 120) {
      if (!el) return;
      pinnedScrollTop.current = el.scrollTop;
      lockUntil.current = Date.now() + ms;
      el.scrollTop = pinnedScrollTop.current;
      requestAnimationFrame(() => {
        if (!el) return;
        el.scrollTop = pinnedScrollTop.current;
        requestAnimationFrame(() => {
          if (!el) return;
          el.scrollTop = pinnedScrollTop.current;
        });
      });
    }

    function onPointerDown(event: MouseEvent | TouchEvent) {
      const target = event.target;
      if (!isFormField(target)) return;
      if (!el?.contains(target)) return;
      if ("button" in event && event.button !== 0) return;

      // Pin the scroll position but let the browser handle focus natively —
      // preventDefault() here would break caret placement and text selection.
      // onFocusIn + onScroll undo any scroll-into-view during the lock window.
      pinnedScrollTop.current = el.scrollTop;
      lockUntil.current = Date.now() + 150;
    }

    /** Capture scroll before Tab moves focus (browser scrolls after). */
    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== "Tab" || !el) return;
      pinnedScrollTop.current = el.scrollTop;
      lockUntil.current = Date.now() + 150;
    }

    function onFocusIn(event: FocusEvent) {
      if (!isFormField(event.target)) return;
      if (!el?.contains(event.target)) return;
      // Undo any scroll-into-view the browser already applied.
      // Do not force the header visible — only scroll-up should reveal it.
      el.scrollTop = pinnedScrollTop.current;
      lockScroll(150);
    }

    function onFocusOut(event: FocusEvent) {
      if (!isFormField(event.target)) return;
      requestAnimationFrame(() => {
        if (el) {
          lastScrollTop.current = el.scrollTop;
          pinnedScrollTop.current = el.scrollTop;
        }
      });
    }

    function onScroll() {
      if (!el) return;
      if (Date.now() < lockUntil.current) {
        if (el.scrollTop !== pinnedScrollTop.current) {
          el.scrollTop = pinnedScrollTop.current;
        }
        return;
      }

      const y = el.scrollTop;
      const delta = y - lastScrollTop.current;

      if (y <= 8) {
        setHeaderHidden(false);
      } else if (delta > 10) {
        setHeaderHidden(true);
      } else if (delta < -10) {
        setHeaderHidden(false);
      }

      lastScrollTop.current = y;
      pinnedScrollTop.current = y;
    }

    el.addEventListener("mousedown", onPointerDown);
    el.addEventListener("touchstart", onPointerDown, { passive: false });
    el.addEventListener("keydown", onKeyDown, true);
    el.addEventListener("focusin", onFocusIn);
    el.addEventListener("focusout", onFocusOut);
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      el.removeEventListener("mousedown", onPointerDown);
      el.removeEventListener("touchstart", onPointerDown);
      el.removeEventListener("keydown", onKeyDown, true);
      el.removeEventListener("focusin", onFocusIn);
      el.removeEventListener("focusout", onFocusOut);
      el.removeEventListener("scroll", onScroll);
    };
  }, []);

  useEffect(() => {
    lockUntil.current = 0;
    lastScrollTop.current = 0;
    pinnedScrollTop.current = 0;
    scrollRef.current?.scrollTo({ top: 0 });
  }, [pathname]);

  // Full-height pages (e.g. Messages) manage their own internal scrolling and
  // should fill the viewport rather than float with wasted space below.
  const activePath = pathname.split("?")[0] ?? pathname;
  const isFillPage = FILL_ROUTES.some((route) => activePath.endsWith(route));

  const mainClass = [
    styles.main,
    withDock && !isFillPage ? styles.mainWithDock : "",
    isFillPage ? styles.mainFill : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div ref={scrollRef} className={mainClass}>
      <GlobalHeader hidden={headerHidden} />
      <div
        className={
          isFillPage ? `${styles.content} ${styles.contentFill}` : styles.content
        }
      >
        {children}
      </div>
    </div>
  );
}

/** Routes that should fill the viewport height (own internal scroll). */
const FILL_ROUTES = ["/messages"];
