"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import type { EffectiveSession } from "@/lib/portal/types";
import {
  ApprenticeChatDock,
  ApprenticeChatProvider,
  PortalShareProvider,
} from "@/features/apprentice-portal";
import {
  CHAT_SELF_ADMIN,
  CHAT_SELF_EMPLOYER,
  CHAT_SELF_APPRENTICE,
} from "@/features/apprentice-portal/domain/chat/store";
import { DemoSessionProvider } from "./demo/DemoSessionProvider";
import { PortalMain } from "./PortalMain";
import { SidebarNavigation } from "./SidebarNavigation";
import styles from "./PortalShell.module.css";

function isMessagesRoute(pathname: string | null): boolean {
  if (!pathname) return false;
  const path = pathname.split("?")[0]?.replace(/\/+$/, "") ?? "";
  return path === "/messages" || path.endsWith("/messages");
}

/**
 * TEMPORARY standalone chrome.
 * On portal integration, discard this shell and mount feature screens
 * inside the main portal layout.
 */
export function PortalShell({
  session,
  children,
}: {
  session: EffectiveSession;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const workspace = session.account.workspace;
  const isApprentice = workspace === "apprentice";
  const isEmployer = workspace === "employer";
  const isAdministration = workspace === "administration";
  const isManagement = workspace === "management";
  const withSharedChat =
    isApprentice || isEmployer || isAdministration || isManagement;
  const onMessagesPage = isMessagesRoute(pathname);
  const chatSelfId = isEmployer
    ? CHAT_SELF_EMPLOYER
    : isAdministration || isManagement
      ? CHAT_SELF_ADMIN
      : CHAT_SELF_APPRENTICE;

  const body = (
    <div
      className={styles.shell}
      data-portal-root={isApprentice ? "" : undefined}
    >
      <SidebarNavigation />
      <PortalMain withDock={isApprentice && !onMessagesPage}>{children}</PortalMain>
      {isApprentice && !onMessagesPage ? <ApprenticeChatDock /> : null}
    </div>
  );

  return (
    <DemoSessionProvider initialSession={session}>
      {withSharedChat ? (
        <ApprenticeChatProvider selfContactId={chatSelfId}>
          <PortalShareProvider>{body}</PortalShareProvider>
        </ApprenticeChatProvider>
      ) : (
        body
      )}
    </DemoSessionProvider>
  );
}
