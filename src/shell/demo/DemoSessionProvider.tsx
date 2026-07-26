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
import type { DemoAccount, DemoAuditEvent, EffectiveSession, TemporaryAssignment } from "@/lib/portal/types";
import { buildEffectiveSession } from "@/lib/permissions/effective-permissions";
import { canAccessRoute } from "@/lib/permissions/route-access";
import { getDefaultWorkspaceRoute } from "@/lib/permissions/workspace";
import { DEMO_ACCOUNTS } from "@/adapters/fictional/demo-accounts";
import { CURRICULUM_EDITOR_PACK } from "@/lib/permissions/capabilities";
import {
  appendAuditEvent,
  isClientDemoMode,
  persistAssignments,
  persistDemoAccountId,
  readAssignments,
  readAuditLog,
  readDemoAccountId,
} from "./demo-client";

type DemoSessionContextValue = {
  demoEnabled: boolean;
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

const DemoSessionContext = createContext<DemoSessionContextValue | null>(null);

export function DemoSessionProvider({
  initialSession,
  children,
}: {
  initialSession: EffectiveSession;
  children: ReactNode;
}) {
  const router = useRouter();
  const demoEnabled = isClientDemoMode();
  const [activeAccountId, setActiveAccountId] = useState(initialSession.account.id);
  const [assignments, setAssignments] = useState<TemporaryAssignment[]>(() =>
    demoEnabled ? readAssignments() : [],
  );
  const [auditLog, setAuditLog] = useState<DemoAuditEvent[]>(() =>
    demoEnabled ? readAuditLog() : [],
  );
  const [prevInitialAccountId, setPrevInitialAccountId] = useState(
    initialSession.account.id,
  );

  if (initialSession.account.id !== prevInitialAccountId) {
    setPrevInitialAccountId(initialSession.account.id);
    setActiveAccountId(initialSession.account.id);
  }

  /** Keep HTTPS cookie in sync with localStorage so Vercel server renders the switched user. */
  useEffect(() => {
    if (!demoEnabled) return;
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
    // Intentionally once on mount for cookie/localStorage hydration.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- hydrate once
  }, [demoEnabled]);

  useEffect(() => {
    if (!demoEnabled) return;
    queueMicrotask(() => {
      const stored = readAssignments();
      if (stored.length > 0) {
        persistAssignments(stored);
      }
    });
  }, [demoEnabled]);

  const activeAccount = useMemo(
    () =>
      DEMO_ACCOUNTS.find((a) => a.id === activeAccountId) ?? initialSession.account,
    [activeAccountId, initialSession.account],
  );

  const effectiveSession = useMemo(
    () => buildEffectiveSession(activeAccount, assignments),
    [activeAccount, assignments],
  );

  const switchAccount = useCallback(
    (accountId: string) => {
      const account = DEMO_ACCOUNTS.find((a) => a.id === accountId);
      if (!account) return;

      const next = buildEffectiveSession(account, assignments);
      if (demoEnabled) {
        persistDemoAccountId(accountId);
      }
      setActiveAccountId(accountId);

      const pathname = window.location.pathname;
      const destination = canAccessRoute(next, pathname)
        ? pathname
        : getDefaultWorkspaceRoute(account.workspace, next);

      router.push(destination);
      router.refresh();
    },
    [assignments, demoEnabled, router],
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

      const nextAssignments = [...assignments.filter((a) => !(a.userId === input.targetUserId && a.responsibility === "Curriculum Editor" && !a.revokedAt)), assignment];
      setAssignments(nextAssignments);
      if (demoEnabled) persistAssignments(nextAssignments);

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
    [assignments, demoEnabled, router],
  );

  const revokeAssignment = useCallback(
    (assignmentId: string, actor: EffectiveSession) => {
      const nextAssignments = assignments.map((a) =>
        a.id === assignmentId
          ? { ...a, revokedAt: new Date().toISOString() }
          : a,
      );
      setAssignments(nextAssignments);
      if (demoEnabled) persistAssignments(nextAssignments);

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
    [assignments, demoEnabled, router],
  );

  const value = useMemo(
    () => ({
      demoEnabled,
      accounts: DEMO_ACCOUNTS,
      session: effectiveSession,
      assignments,
      auditLog,
      switchAccount,
      grantTemporaryCurriculumEditor,
      revokeAssignment,
    }),
    [assignments, auditLog, demoEnabled, effectiveSession, grantTemporaryCurriculumEditor, revokeAssignment, switchAccount],
  );

  return (
    <DemoSessionContext.Provider value={value}>{children}</DemoSessionContext.Provider>
  );
}

export function useDemoSession(): DemoSessionContextValue {
  const ctx = useContext(DemoSessionContext);
  if (!ctx) {
    throw new Error("useDemoSession must be used within DemoSessionProvider");
  }
  return ctx;
}
