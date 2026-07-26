"use client";

import { useMemo } from "react";
import { useAdminStore } from "@/features/administration/hooks/useAdminStore";
import { buildAdminLearnerWorkspace } from "../domain/build-admin-learner-workspace";
import type { LearnerWorkspaceDto } from "../types";
import type { LearnerTab } from "@/features/shared-records";
import { LearnerWorkspaceScreen } from "../screens/LearnerWorkspaceScreen";
import { EmptyState } from "@/components/ui/EmptyState";

type Props = {
  learnerId: string;
  /** Server-loaded fictional / portal workspace, if any. */
  initialWorkspace: LearnerWorkspaceDto | null;
  activeTab?: LearnerTab;
  from?: string | null;
  returnHref?: string;
  returnLabel?: string;
  canViewSupportDetail?: boolean;
};

/**
 * Resolves the pack workspace from the server DTO, or from admin intake
 * records when the learner was created through Administration.
 */
export function LearnerWorkspaceClient({
  learnerId,
  initialWorkspace,
  ...rest
}: Props) {
  const admin = useAdminStore();

  const workspace = useMemo(() => {
    if (initialWorkspace) return initialWorkspace;
    const learner = admin.learners.find((l) => l.id === learnerId);
    if (!learner) return null;
    const enrolment =
      admin.enrolments.find((e) => e.learnerId === learnerId) ?? null;
    return buildAdminLearnerWorkspace(learner, enrolment);
  }, [admin.enrolments, admin.learners, initialWorkspace, learnerId]);

  if (!workspace) {
    return (
      <EmptyState
        title="Learner not found"
        description="This learner isn't in the demo pack or administration records."
      />
    );
  }

  return (
    <LearnerWorkspaceScreen
      workspace={workspace}
      learnerId={learnerId}
      {...rest}
    />
  );
}
