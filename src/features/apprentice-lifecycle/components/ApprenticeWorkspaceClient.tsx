"use client";

import { useMemo } from "react";
import { useAdminStore } from "@/features/administration/hooks/useAdminStore";
import { buildAdminApprenticeWorkspace } from "../domain/build-admin-apprentice-workspace";
import { buildBlankPackRows } from "../domain/pack-store";
import type { ApprenticeWorkspaceDto } from "../types";
import type { ApprenticeTab } from "@/features/shared-records";
import { ApprenticeWorkspaceScreen } from "../screens/ApprenticeWorkspaceScreen";
import { EmptyState } from "@/components/ui/EmptyState";

type Props = {
  apprenticeId: string;
  /** Server-loaded fictional / portal workspace, if any. */
  initialWorkspace: ApprenticeWorkspaceDto | null;
  activeTab?: ApprenticeTab;
  from?: string | null;
  returnHref?: string;
  returnLabel?: string;
  canViewSupportDetail?: boolean;
};

/**
 * Resolves the pack workspace from the server DTO, or from admin intake
 * records when the apprentice was created through Administration.
 * Always ensures the ADM14 checklist rows are present.
 */
export function ApprenticeWorkspaceClient({
  apprenticeId,
  initialWorkspace,
  ...rest
}: Props) {
  const admin = useAdminStore();

  const workspace = useMemo(() => {
    const apprentice = admin.apprentices.find((l) => l.id === apprenticeId);
    const enrolment =
      admin.enrolments.find((e) => e.apprenticeId === apprenticeId) ?? null;
    const adminWorkspace = apprentice
      ? buildAdminApprenticeWorkspace(apprentice, enrolment)
      : null;

    if (!initialWorkspace && !adminWorkspace) return null;

    if (!initialWorkspace) return adminWorkspace;

    const evidenceRows =
      initialWorkspace.evidenceRows.length > 0
        ? initialWorkspace.evidenceRows
        : (adminWorkspace?.evidenceRows ?? buildBlankPackRows());

    const missingMandatory = evidenceRows.filter(
      (r) =>
        r.requirementKind === "mandatory" &&
        r.status !== "future_requirement" &&
        r.status === "missing",
    ).length;

    return {
      ...initialWorkspace,
      card: {
        ...initialWorkspace.card,
        mentorName:
          initialWorkspace.card.mentorName ??
          adminWorkspace?.card.mentorName ??
          null,
        tutorName:
          initialWorkspace.card.tutorName ??
          adminWorkspace?.card.tutorName ??
          null,
        employerName:
          initialWorkspace.card.employerName ??
          adminWorkspace?.card.employerName ??
          null,
        missingMandatoryEvidenceCount: missingMandatory,
        evidenceTotalCount: evidenceRows.length,
      },
      originalPlannedEndDate:
        initialWorkspace.originalPlannedEndDate ??
        adminWorkspace?.originalPlannedEndDate ??
        enrolment?.originalPlannedEndDate ??
        null,
      complianceStatus:
        initialWorkspace.complianceStatus &&
        !/not loaded/i.test(initialWorkspace.complianceStatus)
          ? initialWorkspace.complianceStatus
          : missingMandatory > 0
            ? `${missingMandatory} mandatory missing`
            : "Pack clear",
      evidenceRows,
    } satisfies ApprenticeWorkspaceDto;
  }, [admin.enrolments, admin.apprentices, initialWorkspace, apprenticeId]);

  if (!workspace) {
    return (
      <EmptyState
        title="Apprentice not found"
        description="This apprentice isn't in administration records yet. Add them on Apprentice Intake first."
      />
    );
  }

  return (
    <ApprenticeWorkspaceScreen
      workspace={workspace}
      apprenticeId={apprenticeId}
      {...rest}
    />
  );
}
