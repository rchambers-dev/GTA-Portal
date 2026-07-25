import { redirect } from "next/navigation";
import { FeatureStubScreen } from "@/features/learner-lifecycle";
import {
  LearnerAttendanceScreen,
  LearnerCeaScreen,
  LearnerCvBuilderScreen,
  LearnerDashboardScreen,
  LearnerOtjHoursScreen,
  LearnerLearningScreen,
  LearnerMessagesScreen,
  LearnerModuleDetailScreen,
  LearnerModuleTopicScreen,
  LearnerModulesScreen,
  LearnerProgressScreen,
  LearnerReviewDetailScreen,
  LearnerReviewsScreen,
  LearnerSupportScreen,
  TutorModuleSignOffScreen,
  EmployerOtjApprovalsScreen,
  TutorOtjApprovalsScreen,
} from "@/features/learner-portal";
import { getStandalonePorts } from "@/adapters/standalone";
import { assertRouteAccess } from "@/shell/guards/require-route-access";
import { isMentorStaffSession } from "@/lib/permissions/workspace";
import { EmployerDashboardScreen } from "./EmployerDashboardScreen";
import { resolveWorkspaceStub } from "./workspace-stubs";

/** Workspace-local stubs that duplicate shared operational queues. */
const STAFF_SHARED_REDIRECTS: Record<string, string> = {
  reviews: "/reviews?from=staff",
  interventions: "/interventions?from=staff",
  actions: "/actions?from=staff",
  "employer-concerns": "/employer-concerns?from=staff",
  "support-plans": "/support-plans?from=staff",
  "employer-contacts": "/employers?from=staff",
  modules: "/modules?from=staff",
  "curriculum-feedback": "/curriculum-feedback?from=staff",
};

function renderLearnerPage(segment: string) {
  const moduleMatch = /^modules\/([^/]+)(?:\/([^/]+))?$/.exec(segment);
  if (moduleMatch) {
    const moduleId = moduleMatch[1];
    const topicId = moduleMatch[2];
    if (topicId) {
      return (
        <LearnerModuleTopicScreen moduleId={moduleId} topicId={topicId} />
      );
    }
    return <LearnerModuleDetailScreen moduleId={moduleId} />;
  }

  const reviewMatch = /^reviews\/([^/]+)$/.exec(segment);
  if (reviewMatch) {
    return <LearnerReviewDetailScreen reviewId={reviewMatch[1]} />;
  }

  switch (segment) {
    case "dashboard":
      return <LearnerDashboardScreen />;
    case "learning":
      return <LearnerLearningScreen />;
    case "modules":
      return <LearnerModulesScreen />;
    case "cea":
      return <LearnerCeaScreen />;
    case "otj":
      return <LearnerOtjHoursScreen />;
    case "assignments":
      // Legacy path — CEA replaced Assignments.
      redirect("/learner/cea");
    case "evidence":
      // Legacy path — OTJ hours used to live under /learner/evidence.
      redirect("/learner/otj");
    case "progress":
      return <LearnerProgressScreen />;
    case "reviews":
      return <LearnerReviewsScreen />;
    case "attendance":
      return <LearnerAttendanceScreen />;
    case "support":
      return <LearnerSupportScreen />;
    case "cv":
      return <LearnerCvBuilderScreen />;
    case "messages":
      return <LearnerMessagesScreen />;
    default:
      return null;
  }
}

export async function renderWorkspacePage(
  workspace: string,
  slug?: string[],
) {
  const ports = getStandalonePorts();
  const session = await ports.auth.getEffectiveSession();
  if (!session) redirect("/");

  const rawSegment = slug?.join("/") ?? "";
  const segment = rawSegment || "dashboard";
  const pathname = `/${workspace}/${segment}`;
  assertRouteAccess(session, pathname);

  // Learning & Progress Mentor dashboard is the Learner Lifecycle board.
  if (
    workspace === "staff" &&
    (segment === "dashboard" || !slug?.length) &&
    isMentorStaffSession(session)
  ) {
    redirect("/learners/lifecycle");
  }

  // Soft-redirect legacy staff stubs that duplicate mentor workspace pages
  if (workspace === "staff") {
    const key = slug?.[0] ?? "";
    const mentorRedirects: Record<string, string> = {
      ...STAFF_SHARED_REDIRECTS,
      progress: "/workspaces/progress-mentor/progress-monitoring?from=staff",
      messages: "/workspaces/progress-mentor/messages",
    };
    // Only mentors should land on progress-mentor routes for progress/messages
    const target =
      key === "progress" || key === "messages"
        ? isMentorStaffSession(session)
          ? mentorRedirects[key]
          : undefined
        : STAFF_SHARED_REDIRECTS[key];
    if (target) redirect(target);
  }

  if (workspace === "learner") {
    const page = renderLearnerPage(segment);
    if (page) return page;
  }

  if (workspace === "staff" && segment === "module-sign-offs") {
    return <TutorModuleSignOffScreen />;
  }

  if (workspace === "staff" && segment === "otj-approvals") {
    return <TutorOtjApprovalsScreen />;
  }

  if (workspace === "employer" && segment === "dashboard") {
    return <EmployerDashboardScreen />;
  }

  if (workspace === "employer" && segment === "messages") {
    return (
      <LearnerMessagesScreen
        eyebrow="Employer workspace"
        description="Message your apprentice, GTA mentor, and others in your employer scope."
      />
    );
  }

  if (workspace === "employer" && segment === "support") {
    return <LearnerSupportScreen audience="employer" />;
  }

  if (workspace === "employer" && segment === "attendance") {
    return <LearnerAttendanceScreen audience="employer" />;
  }

  if (workspace === "employer" && segment === "otj") {
    return <EmployerOtjApprovalsScreen />;
  }

  const stub = resolveWorkspaceStub(workspace, slug);
  return <FeatureStubScreen title={stub.title} description={stub.description} />;
}
