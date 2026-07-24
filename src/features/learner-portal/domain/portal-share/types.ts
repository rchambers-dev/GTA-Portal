import type { ChatPortalLinkAttachment } from "../chat/types";

/**
 * action — needs someone to approve, deny, fill, or complete something
 * view   — display-only (charts, summaries, read-only records) for sharing context
 */
export type PortalShareKind = "action" | "view";

export type PortalShareDescriptor = {
  kind: PortalShareKind;
  href: string;
  title: string;
  detail: string;
  area: string;
  actionLabel?: string;
};

const CLIPBOARD_MARKER = "gta-share:1:";

export function toChatPortalLink(
  share: PortalShareDescriptor,
): ChatPortalLinkAttachment {
  const isAction = share.kind === "action";
  return {
    type: "portal_link",
    href: share.href,
    title: share.title,
    detail: share.detail,
    area: share.area,
    actionLabel:
      share.actionLabel ??
      (isAction ? "Open to action" : "Open to view"),
  };
}

/** Compact clipboard payload — paste in chat becomes a clickable action card. */
export function encodeShareClipboard(share: PortalShareDescriptor): string {
  const json = JSON.stringify({
    kind: share.kind,
    href: share.href,
    title: share.title,
    detail: share.detail,
    area: share.area,
    actionLabel: share.actionLabel,
  });
  return `${CLIPBOARD_MARKER}${json}`;
}

export function decodeShareClipboard(
  text: string,
): PortalShareDescriptor | null {
  const trimmed = text.trim();
  const idx = trimmed.indexOf(CLIPBOARD_MARKER);
  if (idx === -1) return null;
  try {
    const raw = trimmed.slice(idx + CLIPBOARD_MARKER.length);
    const parsed = JSON.parse(raw) as Partial<PortalShareDescriptor>;
    if (
      !parsed.href ||
      !parsed.title ||
      !parsed.detail ||
      !parsed.area ||
      (parsed.kind !== "action" && parsed.kind !== "view")
    ) {
      return null;
    }
    return {
      kind: parsed.kind,
      href: parsed.href,
      title: parsed.title,
      detail: parsed.detail,
      area: parsed.area,
      actionLabel: parsed.actionLabel,
    };
  } catch {
    return null;
  }
}
