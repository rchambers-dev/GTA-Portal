"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  encodeShareClipboard,
  toChatPortalLink,
  type PortalShareDescriptor,
  type PortalShareKind,
} from "../../domain/portal-share/types";
import { useApprenticeChat } from "../ApprenticeChatProvider";
import styles from "./PortalShareProvider.module.css";

type MenuState = {
  x: number;
  y: number;
  share: PortalShareDescriptor;
};

type PortalShareContextValue = {
  openShareMenu: (
    share: PortalShareDescriptor,
    clientX: number,
    clientY: number,
  ) => void;
};

const PortalShareContext = createContext<PortalShareContextValue | null>(null);

export function usePortalShare(): PortalShareContextValue {
  const ctx = useContext(PortalShareContext);
  if (!ctx) {
    throw new Error("usePortalShare must be used within PortalShareProvider");
  }
  return ctx;
}

/** Optional — Shareable falls back to data-* + document listener if absent. */
export function usePortalShareOptional(): PortalShareContextValue | null {
  return useContext(PortalShareContext);
}

function readShareFromElement(el: HTMLElement): PortalShareDescriptor | null {
  const href = el.getAttribute("data-share-href");
  const title = el.getAttribute("data-share-title");
  const detail = el.getAttribute("data-share-detail");
  const area = el.getAttribute("data-share-area");
  const kind = el.getAttribute("data-share-kind") as PortalShareKind | null;
  if (!href || !title || !detail || !area || !kind) return null;
  if (kind !== "action" && kind !== "view") return null;
  return {
    kind,
    href,
    title,
    detail,
    area,
    actionLabel: el.getAttribute("data-share-action-label") ?? undefined,
  };
}

function isEditableTarget(target: Element): boolean {
  return Boolean(
    target.closest("input, textarea, select, [contenteditable='true']"),
  );
}

/**
 * Global right-click: Copy action (paste in chat → clickable card)
 * or Share data (drop straight into Messages).
 * Also suppresses the browser context menu inside the apprentice portal.
 */
export function PortalShareProvider({ children }: { children: ReactNode }) {
  const { queueShare, requestOpenDock } = useApprenticeChat();
  const [menu, setMenu] = useState<MenuState | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const closeMenu = useCallback(() => setMenu(null), []);

  const openShareMenu = useCallback(
    (share: PortalShareDescriptor, clientX: number, clientY: number) => {
      setMenu({
        x: Math.min(clientX, window.innerWidth - 220),
        y: Math.min(clientY, window.innerHeight - 140),
        share,
      });
    },
    [],
  );

  const contextValue = useMemo(
    () => ({ openShareMenu }),
    [openShareMenu],
  );

  useEffect(() => {
    function onContextMenu(event: MouseEvent) {
      const target = event.target;
      if (!(target instanceof Element)) return;

      // Keep native cut / copy / paste on form fields.
      if (isEditableTarget(target)) return;

      const host = target.closest("[data-portal-share]");
      if (host instanceof HTMLElement) {
        const share = readShareFromElement(host);
        if (share) {
          event.preventDefault();
          event.stopPropagation();
          openShareMenu(share, event.clientX, event.clientY);
          return;
        }
      }

      // No shareable under the cursor — still block Chrome's menu in the portal.
      if (target.closest("[data-portal-root]")) {
        event.preventDefault();
        setMenu(null);
      }
    }

    function onPointerDown(event: MouseEvent) {
      const target = event.target;
      if (!(target instanceof Element)) return;
      if (target.closest("[data-portal-share-menu]")) return;
      setMenu(null);
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setMenu(null);
    }

    document.addEventListener("contextmenu", onContextMenu, true);
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("contextmenu", onContextMenu, true);
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [openShareMenu]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 2200);
    return () => window.clearTimeout(timer);
  }, [toast]);

  async function copyAction(share: PortalShareDescriptor) {
    const payload = encodeShareClipboard(share);
    try {
      await navigator.clipboard.writeText(payload);
      setToast(
        share.kind === "action"
          ? "Action copied — paste in chat"
          : "View copied — paste in chat",
      );
    } catch {
      setToast("Could not copy — try Share data instead");
    }
    closeMenu();
  }

  function shareData(share: PortalShareDescriptor) {
    queueShare(toChatPortalLink(share));
    requestOpenDock();
    setToast(
      share.kind === "action"
        ? "Ready to send — action attached"
        : "Ready to send — data attached",
    );
    closeMenu();
  }

  return (
    <PortalShareContext.Provider value={contextValue}>
      {children}
      {menu ? (
        <div
          className={styles.menu}
          data-portal-share-menu=""
          role="menu"
          style={{ left: menu.x, top: menu.y }}
        >
          <p className={styles.menuKicker} data-kind={menu.share.kind}>
            {menu.share.kind === "action" ? "Needs input" : "View only"}
            {" · "}
            {menu.share.area}
          </p>
          <p className={styles.menuTitle}>{menu.share.title}</p>
          <button
            type="button"
            role="menuitem"
            className={styles.menuItem}
            onClick={() => copyAction(menu.share)}
          >
            {menu.share.kind === "action" ? "Copy action" : "Copy view"}
          </button>
          <button
            type="button"
            role="menuitem"
            className={styles.menuItem}
            onClick={() => shareData(menu.share)}
          >
            Share data
          </button>
        </div>
      ) : null}
      {toast ? <div className={styles.toast}>{toast}</div> : null}
    </PortalShareContext.Provider>
  );
}
