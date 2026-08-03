"use client";

import { useTransition } from "react";
import type { PortalAccount } from "@/lib/portal/types";
import { logoutAction } from "@/app/logout/actions";
import { usePortalSession } from "./PortalSessionProvider";
import styles from "./SignedInProfileChip.module.css";

function formatRoleLabel(account: PortalAccount): string {
  if (account.responsibilities.length === 0) return account.baseRole;
  return `${account.baseRole} · ${account.responsibilities.join(" · ")}`;
}

/**
 * Signed-in profile chip (name, role, sign out).
 */
export function SignedInProfileChip({
  currentAccount,
}: {
  currentAccount: PortalAccount;
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
