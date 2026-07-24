import type { ReactNode } from "react";
import type { EffectiveSession } from "@/lib/portal/types";
import {
  LearnerChatDock,
  LearnerChatProvider,
  PortalShareProvider,
} from "@/features/learner-portal";
import { DemoSessionProvider } from "./demo/DemoSessionProvider";
import { GlobalHeader } from "./GlobalHeader";
import { SidebarNavigation } from "./SidebarNavigation";
import styles from "./PortalShell.module.css";

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
  const isLearner = session.account.workspace === "learner";

  const body = (
    <div
      className={styles.shell}
      data-portal-root={isLearner ? "" : undefined}
    >
      <SidebarNavigation />
      <div className={styles.main}>
        <GlobalHeader />
        <div
          className={
            isLearner ? `${styles.content} ${styles.contentWithDock}` : styles.content
          }
        >
          {children}
        </div>
      </div>
      {isLearner ? <LearnerChatDock /> : null}
    </div>
  );

  return (
    <DemoSessionProvider initialSession={session}>
      {isLearner ? (
        <LearnerChatProvider>
          <PortalShareProvider>{body}</PortalShareProvider>
        </LearnerChatProvider>
      ) : (
        body
      )}
    </DemoSessionProvider>
  );
}
