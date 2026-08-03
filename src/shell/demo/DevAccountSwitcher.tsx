"use client";

import { useTransition } from "react";
import type { DemoAccount } from "@/lib/portal/types";
import { formatRoleLabel } from "@/adapters/fictional/demo-accounts";
import { logoutAction } from "@/app/logout/actions";
import { usePortalSession } from "./PortalSessionProvider";
import styles from "./DevAccountSwitcher.module.css";

/**
 * Signed-in profile chip for the active portal environment.
 */
export function DevAccountSwitcher({
  currentAccount,
}: {
  currentAccount: DemoAccount;
}) {
  const { session } = usePortalSession();
  const [isPending, startTransition] = useTransition();

  return (
    <div className={styles.profileStatic}>
      <div className={styles.avatar} aria-hidden>
        {currentAccount.initials}
      </div>
      <div>
        <p className={styles.userName}>{currentAccount.name}</p>
        <p className={styles.userRole}>
          {formatRoleLabel(session?.account ?? currentAccount)}
        </p>
      </div>
      <button
        type="button"
        className={styles.signOut}
        disabled={isPending}
        onClick={() => startTransition(() => logoutAction())}
      >
        {isPending ? "Signing out…" : "Sign out"}
      </button>
    </div>
  );
}
