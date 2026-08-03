"use client";

import { useMemo, useState } from "react";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Button } from "@/components/ui/Button";
import { usePortalSession } from "@/shell/demo/PortalSessionProvider";
import { workspaceForRole } from "@/features/administration/domain/account-access";
import {
  createUser,
  revealApprenticePassword,
  setPortalEnvironment,
} from "@/features/administration/domain/store";
import { useAdminStore } from "@/features/administration/hooks/useAdminStore";
import type { AdminPortalUser } from "@/features/administration/domain/types";
import styles from "../screens/ApprenticeWorkspaceScreen.module.css";

type Props = {
  apprenticeId: string;
  apprenticeEmail?: string | null;
};

function statusTone(
  status: AdminPortalUser["status"],
): "on_track" | "monitoring" | "priority" | "neutral" {
  if (status === "active") return "on_track";
  if (status === "invited") return "monitoring";
  return "neutral";
}

function statusLabel(status: AdminPortalUser["status"]): string {
  if (status === "invited") return "Awaiting enable";
  if (status === "disabled") return "Disabled";
  return "Active";
}

/**
 * Pack sidebar: enable/disable apprentice portal + reveal login password
 * (temp portal Apprentices directory pattern).
 */
export function ApprenticeEnvironmentPanel({
  apprenticeId,
  apprenticeEmail,
}: Props) {
  const store = useAdminStore();
  const { session } = usePortalSession();
  const [revealedPassword, setRevealedPassword] = useState<string | null>(null);
  const [justEnabledPassword, setJustEnabledPassword] = useState<string | null>(
    null,
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const apprenticeRecord = useMemo(
    () => store.apprentices.find((a) => a.id === apprenticeId) ?? null,
    [store.apprentices, apprenticeId],
  );

  const enrolment = useMemo(
    () => store.enrolments.find((e) => e.apprenticeId === apprenticeId) ?? null,
    [store.enrolments, apprenticeId],
  );

  const resolvedEmail =
    apprenticeEmail?.trim() ||
    apprenticeRecord?.email?.trim() ||
    enrolment?.email?.trim() ||
    "";

  const portalUser = useMemo(() => {
    const byLink = store.users.find(
      (u) =>
        (u.role === "Apprentice" || u.workspace === "apprentice") &&
        u.linkedApprenticeId === apprenticeId,
    );
    if (byLink) return byLink;
    const email = resolvedEmail.toLowerCase();
    if (!email) return null;
    return (
      store.users.find(
        (u) =>
          (u.role === "Apprentice" || u.workspace === "apprentice") &&
          u.email.trim().toLowerCase() === email,
      ) ?? null
    );
  }, [store.users, apprenticeId, resolvedEmail]);

  async function ensurePortalUser(): Promise<AdminPortalUser> {
    if (portalUser) return portalUser;
    const displayName =
      apprenticeRecord?.displayName?.trim() ||
      enrolment?.displayName?.trim() ||
      "Apprentice";
    if (!resolvedEmail) {
      throw new Error(
        "This apprentice needs an email before a portal login can be created.",
      );
    }
    return createUser({
      displayName,
      email: resolvedEmail,
      role: "Apprentice",
      workspace: workspaceForRole("Apprentice"),
      jobTitles: [],
      linkedEnrolmentId: enrolment?.id ?? null,
      linkedApprenticeId: apprenticeId,
      linkedEmployerId: enrolment?.employerId ?? null,
      programmeStartDate: enrolment?.startDate ?? null,
      status: "invited",
    });
  }

  async function toggleEnable() {
    try {
      setBusy(true);
      setError(null);
      const user = await ensurePortalUser();
      const next = user.status === "active" ? "disabled" : "active";
      const result = await setPortalEnvironment(
        user.id,
        next,
        session.account.name,
      );
      setRevealedPassword(null);
      if (next === "active" && result.temporaryPassword) {
        setJustEnabledPassword(result.temporaryPassword);
        setSuccess(
          `Enabled ${user.displayName}. Login password is shown below — copy it now.`,
        );
      } else {
        setJustEnabledPassword(null);
        setSuccess(
          next === "active"
            ? `Enabled ${user.displayName}. Use Reveal password below to view their login.`
            : `Disabled ${user.displayName}.`,
        );
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Unable to update environment.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function onRevealPassword() {
    if (!portalUser) return;
    try {
      setBusy(true);
      setError(null);
      const result = await revealApprenticePassword(portalUser.id, "");
      setRevealedPassword(result.password);
      setJustEnabledPassword(null);
      setSuccess(
        `Password visible for ${result.displayName || portalUser.displayName}.`,
      );
    } catch (err) {
      setRevealedPassword(null);
      setError(
        err instanceof Error ? err.message : "Unable to reveal password.",
      );
    } finally {
      setBusy(false);
    }
  }

  const canCreate =
    !portalUser &&
    Boolean(resolvedEmail) &&
    Boolean(apprenticeRecord || enrolment);

  return (
    <div className={styles.envBlock}>
      <h2 className={styles.panelTitle}>Portal environment</h2>

      {!portalUser && !canCreate ? (
        <p className={styles.envHint}>
          No portal login linked yet. Add an email on intake, then enable the
          environment here.
        </p>
      ) : null}

      {!portalUser && canCreate ? (
        <>
          <p className={styles.envHint}>
            No portal login yet for <strong>{resolvedEmail}</strong>. Enable to
            create the login and set a password.
          </p>
          <Button
            type="button"
            size="sm"
            disabled={busy}
            onClick={() => void toggleEnable()}
          >
            {busy ? "Creating…" : "Enable environment"}
          </Button>
          {error ? <p className={styles.envError}>{error}</p> : null}
          {success ? <p className={styles.envSuccess}>{success}</p> : null}
          {justEnabledPassword ? (
            <div className={styles.passwordRevealBox}>
              <div className={styles.passwordRevealMeta}>
                <span>Email</span>
                <code>{resolvedEmail}</code>
              </div>
              <div className={styles.passwordRevealMeta}>
                <span>Password</span>
                <code>{justEnabledPassword}</code>
              </div>
            </div>
          ) : null}
        </>
      ) : null}

      {portalUser ? (
        <>
          <div className={styles.envStatusRow}>
            <div className={styles.envIdentity}>
              <span className={styles.envEmail}>{portalUser.email}</span>
              <StatusBadge tone={statusTone(portalUser.status)}>
                {statusLabel(portalUser.status)}
              </StatusBadge>
            </div>
            <Button
              type="button"
              variant={
                portalUser.status === "active" ? "secondary" : "primary"
              }
              size="sm"
              disabled={busy}
              onClick={() => void toggleEnable()}
            >
              {portalUser.status === "active"
                ? "Disable environment"
                : "Enable environment"}
            </Button>
          </div>

          <div className={styles.passwordVault}>
            <h3 className={styles.passwordVaultTitle}>Environment password</h3>
            <p className={styles.envHint}>
              Reveal the apprentice login password while you are signed in as
              staff. Use it to test their environment or share it with them.
            </p>

            {justEnabledPassword || revealedPassword ? (
              <div className={styles.passwordRevealBox}>
                <div className={styles.passwordRevealMeta}>
                  <span>Email</span>
                  <code>{portalUser.email}</code>
                </div>
                <div className={styles.passwordRevealMeta}>
                  <span>Password</span>
                  <code>{justEnabledPassword ?? revealedPassword}</code>
                </div>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    setRevealedPassword(null);
                    setJustEnabledPassword(null);
                    setSuccess(null);
                  }}
                >
                  Hide
                </Button>
              </div>
            ) : (
              <Button
                type="button"
                size="sm"
                disabled={busy}
                onClick={() => void onRevealPassword()}
              >
                {busy ? "Loading…" : "Reveal password"}
              </Button>
            )}
          </div>

          {success ? <p className={styles.envSuccess}>{success}</p> : null}
          {error ? <p className={styles.envError}>{error}</p> : null}
        </>
      ) : null}
    </div>
  );
}
