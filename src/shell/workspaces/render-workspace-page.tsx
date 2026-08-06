import { redirect } from "next/navigation";
import { FeatureStubScreen } from "@/features/apprentice-lifecycle";
import {
  ApprenticeAttendanceScreen,
  DocumentsHubScreen,
  DocumentsItemScreen,
  DocumentsSectionScreen,
  ApprenticeCvBuilderScreen,
  ApprenticeDashboardScreen,
  ApprenticeOtjHoursScreen,
  ApprenticeLearningScreen,
  ApprenticeMessagesScreen,
  ApprenticeProgressScreen,
  ApprenticeCeaTaskScreen,
  ApprenticeReviewDetailScreen,
  ApprenticeReviewsScreen,
  ApprenticeSupportScreen,
  EmployerOtjApprovalsScreen,
  TutorOtjApprovalsScreen,
} from "@/features/apprentice-portal";
import { resolveApprenticeDeliveryContext } from "@/features/apprentice-portal/domain/delivery-spine";
import {
  ApprenticeProgrammeTasksScreen,
  ApprenticeTaskFillScreen,
  TutorProgrammeDeliveryScreen,
  TutorTaskReviewScreen,
  TutorCeaSignOffScreen,
  TutorCeaReviewRoute,
  ManagementApprenticeRplScreen,
  ManagementApprenticeBragScreen,
  ManagementTaskViewScreen,
  CourseBuilderScreen,
} from "@/features/programme-delivery";
import { ProgrammeBuilderScreen } from "@/features/programme-definition";
import type { EffectiveSession } from "@/lib/portal/types";
import {
  AdministrationDashboardScreen,
  AdminEnrolmentsScreen,
  AdminEmployersScreen,
  AdminCohortsScreen,
  AdminApprenticeIntakeScreen,
  AdminProgrammesScreen,
  AdminUsersScreen,
  AdminStaffScreen,
} from "@/features/administration";
import { SharedDriveScreen } from "@/features/shared-drive";
import { getStandalonePorts } from "@/adapters/standalone";
import { getUnauthenticatedRedirect } from "@/lib/auth/routing";
import { assertRouteAccess } from "@/shell/guards/require-route-access";
import { isMentorStaffSession } from "@/lib/permissions/workspace";
import { EmployerDashboardScreen } from "./EmployerDashboardScreen";
import { ManagementDashboardScreen } from "./ManagementDashboardScreen";
import { resolveWorkspaceStub } from "./workspace-stubs";

/** Workspace-local stubs that duplicate shared operational queues. */
const STAFF_SHARED_REDIRECTS: Record<string, string> = {
  reviews: "/reviews?from=staff",
  interventions: "/interventions?from=staff",
  actions: "/actions?from=staff",
  "employer-concerns": "/employer-concerns?from=staff",
  "employer-contacts": "/employers?from=staff",
  // Old module catalogue — Autocare delivery is blocks + tasks now
  modules: "/staff/programme-delivery",
  "module-sign-offs": "/staff/cea-sign-offs",
  assessments: "/staff/programme-delivery",
  resources: "/staff/programme-delivery",
  "curriculum-feedback": "/staff/programme-delivery",
};

function renderDocumentsPage(
  audience: "apprentice" | "employer",
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

function renderApprenticeTracking(spine: "groups" | "blocks") {
  // Groups apprentices work from Progress (CEA documents). Blocks keep college tasks.
  if (spine === "blocks") return <ApprenticeProgrammeTasksScreen />;
  redirect("/apprentice/progress");
}

async function renderApprenticePage(
  segment: string,
  session: EffectiveSession,
) {
  const spine =
    session.account.deliverySpine ??
    (
      await resolveApprenticeDeliveryContext(session.account.linkedApprenticeId)
    ).deliverySpine;

  const reviewMatch = /^reviews\/([^/]+)$/.exec(segment);
  if (reviewMatch) {
    return <ApprenticeReviewDetailScreen reviewId={reviewMatch[1]} />;
  }

  // Retired module catalogue paths → personal tracking.
  if (/^modules(?:\/|$)/.test(segment)) {
    redirect("/apprentice/tracking");
  }

  // Task fill lives under /tracking/[taskId] (blocks). Legacy college-tasks kept as alias.
  const trackingTaskMatch =
    /^tracking\/([^/]+)$/.exec(segment) ??
    /^college-tasks\/([^/]+)$/.exec(segment);
  if (trackingTaskMatch) {
    if (spine !== "blocks") redirect("/apprentice/progress");
    return <ApprenticeTaskFillScreen taskId={trackingTaskMatch[1]} />;
  }

  const progressTaskMatch = /^progress\/([^/]+)$/.exec(segment);
  if (progressTaskMatch) {
    if (spine === "blocks") redirect("/apprentice/progress");
    return <ApprenticeCeaTaskScreen taskId={progressTaskMatch[1]} />;
  }

  const documentsPage = renderDocumentsPage("apprentice", segment);
  if (documentsPage) return documentsPage;

  switch (segment) {
    case "dashboard":
      return <ApprenticeDashboardScreen />;
    case "learning":
      return <ApprenticeLearningScreen />;
    case "tracking":
      return renderApprenticeTracking(spine);
    // Legacy aliases — groups → Progress; blocks tracking is college tasks.
    case "cea":
    case "personal-tracking":
    case "college-tasks":
    case "modules":
    case "assignments":
      redirect(spine === "blocks" ? "/apprentice/tracking" : "/apprentice/progress");
    case "otj":
      return <ApprenticeOtjHoursScreen />;
    case "training-plan":
      // Legacy path — Documents hub replaces the single training-plan page.
      redirect("/apprentice/documents");
    case "evidence":
      // Legacy path — OTJ hours used to live under /apprentice/evidence.
      redirect("/apprentice/otj");
    case "progress":
      return <ApprenticeProgressScreen />;
    case "reviews":
      return <ApprenticeReviewsScreen />;
    case "attendance":
      return <ApprenticeAttendanceScreen />;
    case "support":
      return <ApprenticeSupportScreen />;
    case "cv":
      return <ApprenticeCvBuilderScreen />;
    case "messages":
      return <ApprenticeMessagesScreen />;
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

  // Learning & Progress Mentor dashboard is the Apprentice Lifecycle board.
  if (
    workspace === "staff" &&
    (segment === "dashboard" || !slug?.length) &&
    isMentorStaffSession(session)
  ) {
    redirect("/apprentices/lifecycle");
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

  if (workspace === "apprentice") {
    const page = await renderApprenticePage(segment, session);
    if (page) return page;
  }

  if (workspace === "staff" && segment === "otj-approvals") {
    return <TutorOtjApprovalsScreen />;
  }

  if (workspace === "staff" && segment === "cea-sign-offs") {
    return <TutorCeaSignOffScreen audience="teacher" />;
  }

  const staffCeaReview =
    workspace === "staff" && segment === "cea-sign-offs/review";
  if (staffCeaReview) {
    // Params read client-side from URL search — pass via wrapper page pattern.
    return <TutorCeaReviewRoute audience="teacher" />;
  }

  if (workspace === "employer" && segment === "cea-sign-offs") {
    return <TutorCeaSignOffScreen audience="employer" />;
  }

  if (workspace === "employer" && segment === "cea-sign-offs/review") {
    return <TutorCeaReviewRoute audience="employer" />;
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
      <ApprenticeMessagesScreen
        eyebrow="Employer workspace"
        description="Message your apprentice, GTA mentor, and others in your employer scope."
      />
    );
  }

  if (workspace === "employer" && segment === "support") {
    return <ApprenticeSupportScreen audience="employer" />;
  }

  if (workspace === "employer" && segment === "attendance") {
    return <ApprenticeAttendanceScreen audience="employer" />;
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
        redirect("/apprentices?from=administration");
      case "enrolments":
        return <AdminEnrolmentsScreen />;
      case "accounts":
        return (
          <AdminUsersScreen scope="apprentice" eyebrow="Administration" />
        );
      case "employers":
        return <AdminEmployersScreen />;
      case "programmes":
        return <AdminProgrammesScreen />;
      case "cohorts":
        return <AdminCohortsScreen />;
      case "intake":
        return <AdminApprenticeIntakeScreen />;
      case "staff":
        return <AdminStaffScreen eyebrow="Administration" />;
      case "shared-drive":
        return <SharedDriveScreen audience="administration" />;
      case "documents":
        redirect("/administration/shared-drive");
      case "messages":
        return (
          <ApprenticeMessagesScreen
            eyebrow="Administration"
            description="Message apprentices, employers, and GTA colleagues from the administration workspace."
          />
        );
      case "safeguarding":
        return <ApprenticeSupportScreen audience="administration" />;
      default:
        break;
    }
  }

  if (workspace === "management") {
    switch (segment) {
      case "dashboard":
        return <ManagementDashboardScreen />;
      case "accounts":
        return <AdminUsersScreen scope="apprentice" eyebrow="Management" />;
      case "staff-accounts":
      case "staff":
        return <AdminStaffScreen eyebrow="Management" />;
      case "employers":
        return <AdminEmployersScreen />;
      case "programmes-records":
        return <AdminProgrammesScreen />;
      case "programme-builder":
        return <ProgrammeBuilderScreen />;
      case "course-builder":
        return <CourseBuilderScreen />;
      case "cohorts":
        return <AdminCohortsScreen />;
      case "intake":
        return <AdminApprenticeIntakeScreen />;
      case "enrolments":
        return <AdminEnrolmentsScreen />;
      case "apprentice-funding":
      case "ksb-rpl":
        return <ManagementApprenticeRplScreen />;
      case "apprentice-brag":
      case "progression-brag":
        return <ManagementApprenticeBragScreen />;
      case "shared-drive":
        return <SharedDriveScreen audience="management" />;
      case "messages":
        return (
          <ApprenticeMessagesScreen
            eyebrow="Management"
            description="Message apprentices, employers, and GTA colleagues from the management workspace."
          />
        );
      case "safeguarding":
        return <ApprenticeSupportScreen audience="management" />;
      default: {
        const bragTaskMatch = /^apprentice-brag\/task\/([^/]+)$/.exec(segment);
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

  if (workspace === "curriculum" && segment === "course-builder") {
    return <CourseBuilderScreen />;
  }

  // Shared safeguarding contacts page (case management not built yet).
  if (workspace === "safeguarding") {
    return <ApprenticeSupportScreen audience="administration" />;
  }

  const stub = resolveWorkspaceStub(workspace, slug);
  return <FeatureStubScreen title={stub.title} description={stub.description} />;
}
