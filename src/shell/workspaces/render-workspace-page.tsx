import { redirect } from "next/navigation";
import { FeatureStubScreen } from "@/features/learner-lifecycle";
import {
  LearnerAttendanceScreen,
  DocumentsHubScreen,
  DocumentsItemScreen,
  DocumentsSectionScreen,
  LearnerCvBuilderScreen,
  LearnerDashboardScreen,
  LearnerOtjHoursScreen,
  LearnerLearningScreen,
  LearnerMessagesScreen,
  LearnerProgressScreen,
  LearnerReviewDetailScreen,
  LearnerReviewsScreen,
  LearnerSupportScreen,
  EmployerOtjApprovalsScreen,
  TutorOtjApprovalsScreen,
} from "@/features/learner-portal";
import {
  LearnerProgrammeTasksScreen,
  LearnerTaskFillScreen,
  TutorProgrammeDeliveryScreen,
  TutorTaskReviewScreen,
  ManagementLearnerRplScreen,
  ManagementLearnerBragScreen,
  ManagementTaskViewScreen,
} from "@/features/programme-delivery";
import {
  AdministrationDashboardScreen,
  AdminEnrolmentsScreen,
  AdminEmployersScreen,
  AdminCohortsScreen,
  AdminLearnerIntakeScreen,
  AdminProgrammesScreen,
  AdminUsersScreen,
} from "@/features/administration";
import { SharedDriveScreen } from "@/features/shared-drive";
import { getStandalonePorts } from "@/adapters/standalone";
import { getUnauthenticatedRedirect } from "@/lib/auth/routing";
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
  // Old module catalogue — Autocare delivery is blocks + tasks now
  modules: "/staff/programme-delivery",
  "module-sign-offs": "/staff/programme-delivery",
  assessments: "/staff/programme-delivery",
  resources: "/staff/programme-delivery",
  "curriculum-feedback": "/staff/programme-delivery",
};

function renderDocumentsPage(
  audience: "learner" | "employer",
  segment: string,
) {
  const itemMatch = /^documents\/([^/]+)\/([^/]+)$/.exec(segment);
  if (itemMatch) {
    return (
      <DocumentsItemScreen
        audience={audience}
        sectionKey={itemMatch[1]}
        reference={itemMatch[2]}
      />
    );
  }

  const sectionMatch = /^documents\/([^/]+)$/.exec(segment);
  if (sectionMatch) {
    return (
      <DocumentsSectionScreen
        audience={audience}
        sectionKey={sectionMatch[1]}
      />
    );
  }

  if (segment === "documents") {
    return <DocumentsHubScreen audience={audience} />;
  }

  return null;
}

function renderLearnerPage(segment: string) {
  const moduleMatch = /^modules\/([^/]+)(?:\/([^/]+))?$/.exec(segment);
  if (moduleMatch) {
    // Old MV module catalogue — superseded by Autocare college tasks (blocks)
    redirect("/learner/college-tasks");
  }

  const reviewMatch = /^reviews\/([^/]+)$/.exec(segment);
  if (reviewMatch) {
    return <LearnerReviewDetailScreen reviewId={reviewMatch[1]} />;
  }

  const collegeTaskMatch = /^college-tasks\/([^/]+)$/.exec(segment);
  if (collegeTaskMatch) {
    return <LearnerTaskFillScreen taskId={collegeTaskMatch[1]} />;
  }

  const documentsPage = renderDocumentsPage("learner", segment);
  if (documentsPage) return documentsPage;

  switch (segment) {
    case "dashboard":
      return <LearnerDashboardScreen />;
    case "learning":
      return <LearnerLearningScreen />;
    case "college-tasks":
      return <LearnerProgrammeTasksScreen />;
    case "modules":
      redirect("/learner/college-tasks");
    case "cea":
      // Old CEA personal-tracking UI — college delivery is block tasks now
      redirect("/learner/college-tasks");
    case "otj":
      return <LearnerOtjHoursScreen />;
    case "training-plan":
      // Legacy path — Documents hub replaces the single training-plan page.
      redirect("/learner/documents");
    case "assignments":
      redirect("/learner/college-tasks");
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
  if (!session) redirect(getUnauthenticatedRedirect(`/${workspace}`));

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

  if (workspace === "staff" && segment === "otj-approvals") {
    return <TutorOtjApprovalsScreen />;
  }

  if (workspace === "staff" && segment === "programme-delivery") {
    return <TutorProgrammeDeliveryScreen />;
  }

  const staffTaskMatch =
    workspace === "staff"
      ? /^programme-delivery\/([^/]+)$/.exec(segment)
      : null;
  if (staffTaskMatch) {
    return <TutorTaskReviewScreen taskId={staffTaskMatch[1]} />;
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

  if (workspace === "employer") {
    const documentsPage = renderDocumentsPage("employer", segment);
    if (documentsPage) return documentsPage;
  }

  if (workspace === "employer" && segment === "commitments") {
    // Legacy path — Documents hub replaces employer commitments.
    redirect("/employer/documents");
  }

  if (workspace === "administration") {
    switch (segment) {
      case "dashboard":
        return <AdministrationDashboardScreen />;
      case "users":
        redirect("/learners?from=administration");
      case "enrolments":
        return <AdminEnrolmentsScreen />;
      case "accounts":
        return (
          <AdminUsersScreen scope="learner" eyebrow="Administration" />
        );
      case "employers":
        return <AdminEmployersScreen />;
      case "programmes":
        return <AdminProgrammesScreen />;
      case "cohorts":
        return <AdminCohortsScreen />;
      case "intake":
        return <AdminLearnerIntakeScreen />;
      case "shared-drive":
        return <SharedDriveScreen audience="administration" />;
      case "documents":
        redirect("/administration/shared-drive");
      case "messages":
        return (
          <LearnerMessagesScreen
            eyebrow="Administration"
            description="Message learners, employers, and GTA colleagues from the administration workspace."
          />
        );
      case "safeguarding":
        return <LearnerSupportScreen audience="administration" />;
      default:
        break;
    }
  }

  if (workspace === "management") {
    switch (segment) {
      case "accounts":
        return <AdminUsersScreen scope="learner" eyebrow="Management" />;
      case "staff-accounts":
        return <AdminUsersScreen scope="staff" eyebrow="Management" />;
      case "employers":
        return <AdminEmployersScreen />;
      case "programmes-records":
        return <AdminProgrammesScreen />;
      case "cohorts":
        return <AdminCohortsScreen />;
      case "intake":
        return <AdminLearnerIntakeScreen />;
      case "enrolments":
        return <AdminEnrolmentsScreen />;
      case "learner-funding":
      case "ksb-rpl":
        return <ManagementLearnerRplScreen />;
      case "learner-brag":
      case "progression-brag":
        return <ManagementLearnerBragScreen />;
      case "shared-drive":
        return <SharedDriveScreen audience="management" />;
      case "messages":
        return (
          <LearnerMessagesScreen
            eyebrow="Management"
            description="Message learners, employers, and GTA colleagues from the management workspace."
          />
        );
      case "safeguarding":
        return <LearnerSupportScreen audience="management" />;
      default: {
        const bragTaskMatch = /^learner-brag\/task\/([^/]+)$/.exec(segment);
        if (bragTaskMatch) {
          return <ManagementTaskViewScreen taskId={bragTaskMatch[1]} />;
        }
        break;
      }
    }
  }

  if (workspace === "staff" && segment === "shared-drive") {
    return <SharedDriveScreen audience="staff" />;
  }

  if (workspace === "quality" && segment === "shared-drive") {
    return <SharedDriveScreen audience="quality" />;
  }

  const stub = resolveWorkspaceStub(workspace, slug);
  return <FeatureStubScreen title={stub.title} description={stub.description} />;
}
