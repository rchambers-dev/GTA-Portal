"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import type { EffectiveSession } from "@/lib/portal/types";
import {
  LearnerChatDock,
  LearnerChatProvider,
  PortalShareProvider,
} from "@/features/learner-portal";
import {
  CHAT_SELF_ADMIN,
  CHAT_SELF_EMPLOYER,
  CHAT_SELF_LEARNER,
} from "@/features/learner-portal/domain/chat/store";
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
  const isLearner = workspace === "learner";
  const isEmployer = workspace === "employer";
  const isAdministration = workspace === "administration";
  const isManagement = workspace === "management";
  const withSharedChat =
    isLearner || isEmployer || isAdministration || isManagement;
  const onMessagesPage = isMessagesRoute(pathname);
  const chatSelfId = isEmployer
    ? CHAT_SELF_EMPLOYER
    : isAdministration || isManagement
      ? CHAT_SELF_ADMIN
      : CHAT_SELF_LEARNER;

  const body = (
    <div
      className={styles.shell}
      data-portal-root={isLearner ? "" : undefined}
    >
      <SidebarNavigation />
      <PortalMain withDock={isLearner && !onMessagesPage}>{children}</PortalMain>
      {isLearner && !onMessagesPage ? <LearnerChatDock /> : null}
    </div>
  );

  return (
    <DemoSessionProvider initialSession={session}>
      {withSharedChat ? (
        <LearnerChatProvider selfContactId={chatSelfId}>
          <PortalShareProvider>{body}</PortalShareProvider>
        </LearnerChatProvider>
      ) : (
        body
      )}
    </DemoSessionProvider>
  );
}
