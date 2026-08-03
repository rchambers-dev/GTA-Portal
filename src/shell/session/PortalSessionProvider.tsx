"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import type {
  PortalAuditEvent,
  EffectiveSession,
  TemporaryAssignment,
} from "@/lib/portal/types";
import { CURRICULUM_EDITOR_PACK } from "@/lib/permissions/capabilities";

type PortalSessionContextValue = {
  session: EffectiveSession;
  assignments: TemporaryAssignment[];
  auditLog: PortalAuditEvent[];
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
 * Always the authenticated person's server session (live Supabase).
 */
export function PortalSessionProvider({
  initialSession,
  children,
}: {
  initialSession: EffectiveSession;
  children: ReactNode;
}) {
  const router = useRouter();
  const [assignments, setAssignments] = useState<TemporaryAssignment[]>([]);
  const [auditLog, setAuditLog] = useState<PortalAuditEvent[]>([]);

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

      setAssignments((prev) => [
        ...prev.filter(
          (a) =>
            !(
              a.userId === input.targetUserId &&
              a.responsibility === "Curriculum Editor" &&
              !a.revokedAt
            ),
        ),
        assignment,
      ]);

      setAuditLog((prev) => [
        {
          id: `audit-${Date.now()}`,
          occurredAt: new Date().toISOString(),
          actorId: input.grantedBy.account.id,
          actorName: input.grantedBy.account.name,
          action: "temporary_access.granted",
          summary: `Granted temporary Curriculum Editor for ${input.programmeScope.join(", ")}`,
          targetUserId: input.targetUserId,
          metadata: { expiresAt: input.expiresAt },
        },
        ...prev,
      ]);
      router.refresh();
    },
    [router],
  );

  const revokeAssignment = useCallback(
    (assignmentId: string, actor: EffectiveSession) => {
      setAssignments((prev) => {
        const target = prev.find((a) => a.id === assignmentId);
        setAuditLog((log) => [
          {
            id: `audit-${Date.now()}`,
            occurredAt: new Date().toISOString(),
            actorId: actor.account.id,
            actorName: actor.account.name,
            action: "temporary_access.revoked",
            summary: `Revoked temporary ${target?.responsibility ?? "access"}`,
            targetUserId: target?.userId,
          },
          ...log,
        ]);
        return prev.map((a) =>
          a.id === assignmentId
            ? { ...a, revokedAt: new Date().toISOString() }
            : a,
        );
      });
      router.refresh();
    },
    [router],
  );

  const value = useMemo(
    () => ({
      session: initialSession,
      assignments,
      auditLog,
      grantTemporaryCurriculumEditor,
      revokeAssignment,
    }),
    [
      assignments,
      auditLog,
      grantTemporaryCurriculumEditor,
      initialSession,
      revokeAssignment,
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

