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
import { useRouter } from "next/navigation";
import type {
  DemoAccount,
  DemoAuditEvent,
  EffectiveSession,
  TemporaryAssignment,
} from "@/lib/portal/types";
import { buildEffectiveSession } from "@/lib/permissions/effective-permissions";
import { canAccessRoute } from "@/lib/permissions/route-access";
import { getDefaultWorkspaceRoute } from "@/lib/permissions/workspace";
import { DEMO_ACCOUNTS } from "@/adapters/fictional/demo-accounts";
import { CURRICULUM_EDITOR_PACK } from "@/lib/permissions/capabilities";
import { isDemoModeEnabled } from "@/lib/env/portal";
import {
  appendAuditEvent,
  persistAssignments,
  persistDemoAccountId,
  readAssignments,
  readAuditLog,
  readDemoAccountId,
} from "./demo-client";

type PortalSessionContextValue = {
  /** True only when NEXT_PUBLIC_DEMO_MODE=true (fictional account switcher). */
  fictionMode: boolean;
  accounts: DemoAccount[];
  session: EffectiveSession;
  assignments: TemporaryAssignment[];
  auditLog: DemoAuditEvent[];
  switchAccount: (accountId: string) => void;
  grantTemporaryCurriculumEditor: (input: {
    targetUserId: string;
    programmeScope: string[];
    expiresAt: string;
    grantedBy: EffectiveSession;
  }) => void;
  revokeAssignment: (assignmentId: string, actor: EffectiveSession) => void;
};

const PortalSessionContext = createContext<PortalSessionContextValue | null>(
  null,
);

/**
 * Holds the signed-in portal session for client screens.
 * Live mode always uses the server session for the logged-in person.
 * Fiction mode (explicit DEMO_MODE) can switch between seeded accounts.
 */
export function PortalSessionProvider({
  initialSession,
  children,
}: {
  initialSession: EffectiveSession;
  children: ReactNode;
}) {
  const router = useRouter();
  const fictionMode = isDemoModeEnabled();
  const [activeAccountId, setActiveAccountId] = useState(
    initialSession.account.id,
  );
  const [assignments, setAssignments] = useState<TemporaryAssignment[]>(() =>
    fictionMode ? readAssignments() : [],
  );
  const [auditLog, setAuditLog] = useState<DemoAuditEvent[]>(() =>
    fictionMode ? readAuditLog() : [],
  );
  const [prevInitialAccountId, setPrevInitialAccountId] = useState(
    initialSession.account.id,
  );

  if (initialSession.account.id !== prevInitialAccountId) {
    setPrevInitialAccountId(initialSession.account.id);
    setActiveAccountId(initialSession.account.id);
  }

  useEffect(() => {
    if (!fictionMode) return;
    queueMicrotask(() => {
      const stored = readDemoAccountId();
      if (!stored) {
        persistDemoAccountId(initialSession.account.id);
        return;
      }
      persistDemoAccountId(stored);
      if (stored !== initialSession.account.id) {
        setActiveAccountId(stored);
        const account = DEMO_ACCOUNTS.find((a) => a.id === stored);
        if (!account) return;
        const next = buildEffectiveSession(account, readAssignments());
        const pathname = window.location.pathname;
        const destination = canAccessRoute(next, pathname)
          ? pathname
          : getDefaultWorkspaceRoute(account.workspace, next);
        if (destination !== pathname) {
          router.replace(destination);
        }
        router.refresh();
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- hydrate once
  }, [fictionMode]);

  useEffect(() => {
    if (!fictionMode) return;
    queueMicrotask(() => {
      const stored = readAssignments();
      if (stored.length > 0) {
        persistAssignments(stored);
      }
    });
  }, [fictionMode]);

  const effectiveSession = useMemo(() => {
    // Live / production: always the authenticated person's server session.
    if (!fictionMode) {
      return initialSession;
    }
    const activeAccount =
      DEMO_ACCOUNTS.find((a) => a.id === activeAccountId) ??
      initialSession.account;
    return buildEffectiveSession(activeAccount, assignments);
  }, [activeAccountId, assignments, fictionMode, initialSession]);

  const switchAccount = useCallback(
    (accountId: string) => {
      if (!fictionMode) return;
      const account = DEMO_ACCOUNTS.find((a) => a.id === accountId);
      if (!account) return;

      const next = buildEffectiveSession(account, assignments);
      persistDemoAccountId(accountId);
      setActiveAccountId(accountId);

      const pathname = window.location.pathname;
      const destination = canAccessRoute(next, pathname)
        ? pathname
        : getDefaultWorkspaceRoute(account.workspace, next);

      router.push(destination);
      router.refresh();
    },
    [assignments, fictionMode, router],
  );

  const grantTemporaryCurriculumEditor = useCallback(
    (input: {
      targetUserId: string;
      programmeScope: string[];
      expiresAt: string;
      grantedBy: EffectiveSession;
    }) => {
      const assignment: TemporaryAssignment = {
        id: `assign-${Date.now()}`,
        userId: input.targetUserId,
        responsibility: "Curriculum Editor",
        permissions: [...CURRICULUM_EDITOR_PACK],
        programmeScope: input.programmeScope,
        startsAt: new Date().toISOString(),
        expiresAt: input.expiresAt,
        grantedBy: input.grantedBy.account.id,
        grantedByName: input.grantedBy.account.name,
      };

      const nextAssignments = [
        ...assignments.filter(
          (a) =>
            !(
              a.userId === input.targetUserId &&
              a.responsibility === "Curriculum Editor" &&
              !a.revokedAt
            ),
        ),
        assignment,
      ];
      setAssignments(nextAssignments);
      if (fictionMode) persistAssignments(nextAssignments);

      const events = appendAuditEvent({
        actorId: input.grantedBy.account.id,
        actorName: input.grantedBy.account.name,
        action: "temporary_access.granted",
        summary: `Granted temporary Curriculum Editor for ${input.programmeScope.join(", ")}`,
        targetUserId: input.targetUserId,
        metadata: { expiresAt: input.expiresAt },
      });
      setAuditLog(events);
      router.refresh();
    },
    [assignments, fictionMode, router],
  );

  const revokeAssignment = useCallback(
    (assignmentId: string, actor: EffectiveSession) => {
      const nextAssignments = assignments.map((a) =>
        a.id === assignmentId
          ? { ...a, revokedAt: new Date().toISOString() }
          : a,
      );
      setAssignments(nextAssignments);
      if (fictionMode) persistAssignments(nextAssignments);

      const target = assignments.find((a) => a.id === assignmentId);
      const events = appendAuditEvent({
        actorId: actor.account.id,
        actorName: actor.account.name,
        action: "temporary_access.revoked",
        summary: `Revoked temporary ${target?.responsibility ?? "access"}`,
        targetUserId: target?.userId,
      });
      setAuditLog(events);
      router.refresh();
    },
    [assignments, fictionMode, router],
  );

  const value = useMemo(
    () => ({
      fictionMode,
      accounts: fictionMode ? DEMO_ACCOUNTS : [],
      session: effectiveSession,
      assignments,
      auditLog,
      switchAccount,
      grantTemporaryCurriculumEditor,
      revokeAssignment,
    }),
    [
      assignments,
      auditLog,
      effectiveSession,
      fictionMode,
      grantTemporaryCurriculumEditor,
      revokeAssignment,
      switchAccount,
    ],
  );

  return (
    <PortalSessionContext.Provider value={value}>
      {children}
    </PortalSessionContext.Provider>
  );
}

export function usePortalSession(): PortalSessionContextValue {
  const ctx = useContext(PortalSessionContext);
  if (!ctx) {
    throw new Error("usePortalSession must be used within PortalSessionProvider");
  }
  return ctx;
}

/** @deprecated Use usePortalSession */
export function useDemoSession(): PortalSessionContextValue {
  return usePortalSession();
}

/** @deprecated Use PortalSessionProvider */
export const DemoSessionProvider = PortalSessionProvider;
