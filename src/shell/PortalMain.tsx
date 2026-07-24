"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { GlobalHeader } from "./GlobalHeader";
import styles from "./PortalShell.module.css";

/**
 * Main column with auto-hiding header: scrolls down to hide, up to reveal.
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
  const [headerHidden, setHeaderHidden] = useState(false);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    function onScroll() {
      if (!el) return;
      const y = el.scrollTop;
      const delta = y - lastScrollTop.current;

      if (y <= 8) {
        setHeaderHidden(false);
      } else if (delta > 8) {
        setHeaderHidden(true);
      } else if (delta < -8) {
        setHeaderHidden(false);
      }

      lastScrollTop.current = y;
    }

    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    setHeaderHidden(false);
    lastScrollTop.current = 0;
    scrollRef.current?.scrollTo({ top: 0 });
  }, [pathname]);

  return (
    <div
      ref={scrollRef}
      className={
        withDock ? `${styles.main} ${styles.mainWithDock}` : styles.main
      }
    >
      <GlobalHeader hidden={headerHidden} />
      <div className={styles.content}>{children}</div>
    </div>
  );
}
