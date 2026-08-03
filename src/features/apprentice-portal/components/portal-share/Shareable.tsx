"use client";

import type {
  CSSProperties,
  MouseEvent as ReactMouseEvent,
  ReactNode,
} from "react";
import type { PortalShareDescriptor, PortalShareKind } from "../../domain/portal-share/types";
import { usePortalShareOptional } from "./PortalShareProvider";
import styles from "./Shareable.module.css";

/**
 * Marks a region as right-click shareable across the portal.
 * - kind="action" → forms, approvals, tasks needing input
 * - kind="view"   → charts, pies, read-only summaries
 */
export function Shareable({
  kind,
  href,
  title,
  detail,
  area,
  actionLabel,
  children,
  className,
  style,
  as = "div",
  id,
  dataAttrs,
}: {
  kind: PortalShareKind;
  href: string;
  title: string;
  detail: string;
  area: string;
  actionLabel?: string;
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
  as?: "div" | "section" | "article" | "li" | "span";
  id?: string;
  /** Extra data-* attributes for host styling / deep-link highlight */
  dataAttrs?: Record<string, string | undefined>;
}) {
  const shareApi = usePortalShareOptional();
  const Tag = as;
  const resolvedActionLabel =
    actionLabel ?? (kind === "action" ? "Open to action" : "Open to view");

  const share: PortalShareDescriptor = {
    kind,
    href,
    title,
    detail,
    area,
    actionLabel: resolvedActionLabel,
  };

  function handleContextMenu(event: ReactMouseEvent) {
    // Always kill the browser menu on shareable regions.
    event.preventDefault();
    event.stopPropagation();
    shareApi?.openShareMenu(share, event.clientX, event.clientY);
  }

  return (
    <Tag
      id={id}
      data-portal-share=""
      data-share-kind={kind}
      data-share-href={href}
      data-share-title={title}
      data-share-detail={detail}
      data-share-area={area}
      data-share-action-label={resolvedActionLabel}
      {...dataAttrs}
      className={[styles.shareable, className].filter(Boolean).join(" ")}
      style={style}
      title="Right-click to share"
      onContextMenu={handleContextMenu}
    >
      {children}
    </Tag>
  );
}
