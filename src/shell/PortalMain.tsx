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
 * which fights the sticky header. We focus without scrolling and briefly
 * pin scroll position after each focus change.
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
  const [fieldFocused, setFieldFocused] = useState(false);

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

      const y = el.scrollTop;
      pinnedScrollTop.current = y;
      lockUntil.current = Date.now() + 150;
      event.preventDefault();
      target.focus({ preventScroll: true });
      el.scrollTop = y;
      requestAnimationFrame(() => {
        if (el) el.scrollTop = y;
      });
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
      setFieldFocused(true);
      // Undo any scroll-into-view the browser already applied.
      el.scrollTop = pinnedScrollTop.current;
      lockScroll(150);
    }

    function onFocusOut(event: FocusEvent) {
      if (!isFormField(event.target)) return;
      requestAnimationFrame(() => {
        const active = document.activeElement;
        if (isFormField(active) && el?.contains(active)) return;
        setFieldFocused(false);
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
    setHeaderHidden(false);
    setFieldFocused(false);
    lockUntil.current = 0;
    lastScrollTop.current = 0;
    pinnedScrollTop.current = 0;
    scrollRef.current?.scrollTo({ top: 0 });
  }, [pathname]);

  // While a field is focused, keep the header visible so it cannot toggle mid-edit.
  const headerIsHidden = fieldFocused ? false : headerHidden;

  return (
    <div
      ref={scrollRef}
      className={
        withDock ? `${styles.main} ${styles.mainWithDock}` : styles.main
      }
    >
      <GlobalHeader hidden={headerIsHidden} />
      <div className={styles.content}>{children}</div>
    </div>
  );
}
