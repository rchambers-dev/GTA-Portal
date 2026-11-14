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
  ApprenticeSessionDetailScreen,
  ApprenticeMessagesScreen,
  ApprenticeProgressScreen,
  ApprenticeReviewDetailScreen,
  ApprenticeReviewsScreen,
  ApprenticeSupportScreen,
  EmployerOtjApprovalsScreen,
  TutorOtjApprovalsScreen,
} from "@/features/apprentice-portal";
import {
  ApprenticeProgrammeTasksScreen,
  TutorProgrammeDeliveryScreen,
  TutorBlock1DeliveryScreen,
  TutorTaskReviewScreen,
  ManagementApprenticeRplScreen,
  ManagementApprenticeTnpScreen,
  ManagementApprenticeBragScreen,
  ManagementTaskViewScreen,
  CourseBuilderScreen,
} from "@/features/programme-delivery";
import { ProgrammeBuilderScreen } from "@/features/programme-definition";
import type { EffectiveSession } from "@/lib/portal/types";
import {
  AdministrationDashboardScreen,
  AdminEnrolmentsScreen,
  AdminCohortsScreen,
  AdminTeachingGroupsScreen,
  AdminProgrammesScreen,
  AdminUsersScreen,
  AdminStaffScreen,
} from "@/features/administration";
import { AddApprenticeScreen } from "@/features/administration/screens/AddApprenticeScreen";
import { ApprenticeLearnerScreen } from "@/features/administration/screens/ApprenticeLearnerScreen";
import { apprenticeLearnerGtaId } from "@/features/administration/domain/apprentice-tutor";
import { EmployersScreen } from "@/features/administration/screens/EmployersScreen";
import { AnalyticsScreen } from "@/features/reviews/screens/AnalyticsScreen";
import { ReviewLogScreen } from "@/features/reviews/screens/ReviewLogScreen";
import { CycleScreen } from "@/features/reviews/screens/CycleScreen";
import { PlanScreen } from "@/features/reviews/screens/PlanScreen";
import { SettingsScreen } from "@/features/reviews/screens/SettingsScreen";
import { ReviewStubScreen } from "@/features/reviews/screens/ReviewStubScreen";
import { TutorReviewsScreen } from "@/features/tutor-reviews/screens/TutorReviewsScreen";
import { OnboardingDirectory } from "@/features/administration/screens/OnboardingDirectory";
import { MarketingOverview } from "@/features/administration/screens/MarketingOverview";
import { OnboardingOverview } from "@/features/administration/screens/OnboardingOverview";
import { RecruitmentGapScreen } from "@/features/administration/screens/RecruitmentGapScreen";
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
  "module-sign-offs": "/staff/programme-delivery",
  assessments: "/staff/programme-delivery",
  resources: "/staff/programme-delivery",
  "curriculum-feedback": "/staff/programme-delivery",
};

function searchValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function renderOnboarding(
  workspace: "administration" | "management",
  segment: string,
) {
  if (segment === "onboarding") return <OnboardingOverview workspace={workspace} />;
  if (segment === "onboarding/apprentices") {
    redirect(`/${workspace}/onboarding/apprentice`);
  }
  if (segment === "onboarding/interviews") {
    return (
      <RecruitmentGapScreen
        eyebrow="Onboarding"
        title="Interviews"
        description="Interview groups are not built. Nothing on this page can be booked or saved."
        gaps={[
          "Groups are Mondays, with at most 8 learners, not eight timeslots.",
          "England and Wales bank-holiday Mondays are excluded.",
          "Cancelling a place asks whether that seat is released.",
          "A no-show is not a failed assessment.",
          "Three failures, then six calendar months, then one further attempt.",
          "An employer is not required before an interview.",
          "A pass does not open Stage 2.",
        ]}
      />
    );
  }
  if (segment === "onboarding/apprentice") return <AddApprenticeScreen />;
  if (segment === "onboarding/employer") return <EmployersScreen />;
  if (segment === "onboarding/directory" || segment === "onboarding/directory/apprentices") {
    return <OnboardingDirectory initialView="apprentices" />;
  }
  if (segment === "onboarding/directory/employers") {
    return <OnboardingDirectory initialView="employers" />;
  }
  return null;
}

function renderMarketing(workspace: "administration" | "management", segment: string) {
  if (segment === "marketing") return <MarketingOverview workspace={workspace} />;
  if (segment === "marketing/employers") {
    return (
      <OnboardingDirectory
        initialView="employers"
        lockView
        eyebrow="Marketing & Recruitment"
        title="Employers & vacancies"
        description="These are the same example employer records as Onboarding. Vacancy places are not a separate list."
        notice="EXAMPLE DATA. Saving is disabled. Vacancy statuses, allocation, and withdrawal reopening are not built."
      />
    );
  }
  if (segment === "marketing/calendar") {
    return (
      <RecruitmentGapScreen
        eyebrow="Marketing & Recruitment"
        title="Activity calendar"
        description="The shared activity calendar is not built. This is not the programme-week calendar."
        gaps={[
          "A row would have a title, audience, date, owner, status, and notes.",
          "Participant attendance tracking is not part of this calendar.",
          "Apprentices reached is unresolved and is not shown as zero.",
        ]}
      />
    );
  }
  if (segment === "marketing/actions") {
    return (
      <RecruitmentGapScreen
        eyebrow="Marketing & Recruitment"
        title="Actions"
        description="Recruitment actions are not built. This is not the progress-mentor Action Centre."
        gaps={[
          "An action would record the decision, owner, deadline, impact check, and status.",
          "Nothing on this page sends a message or an invite.",
        ]}
      />
    );
  }
  if (segment === "marketing/settings") {
    return (
      <RecruitmentGapScreen
        eyebrow="Marketing & Recruitment"
        title="Settings"
        description="Recruitment settings are not built. This page does not change access or delete records."
        gaps={["Invites, role assignment, and permanent deletion are not available here."]}
      />
    );
  }
  return null;
}

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

async function renderApprenticePage(
  segment: string,
  _session: EffectiveSession,
) {
  const reviewMatch = /^reviews\/([^/]+)$/.exec(segment);
  if (reviewMatch) {
    return <ApprenticeReviewDetailScreen reviewId={reviewMatch[1]} />;
  }

  const learningSessionMatch = /^learning\/([^/]+)$/.exec(segment);
  if (learningSessionMatch) {
    return (
      <ApprenticeSessionDetailScreen sessionId={learningSessionMatch[1]} />
    );
  }

  // Retired module / CEA group-task paths.
  if (/^modules(?:\/|$)/.test(segment)) {
    redirect("/apprentice/learning");
  }
  if (/^progress\/([^/]+)$/.test(segment)) {
    redirect("/apprentice/progress");
  }
  if (/^(?:tracking|college-tasks)\/([^/]+)$/.test(segment)) {
    redirect("/apprentice/tracking");
  }

  const documentsPage = renderDocumentsPage("apprentice", segment);
  if (documentsPage) return documentsPage;

  switch (segment) {
    case "dashboard":
      return <ApprenticeDashboardScreen />;
    case "learning":
      return <ApprenticeLearningScreen />;
    case "tracking":
      return <ApprenticeProgrammeTasksScreen />;
    case "cea":
    case "personal-tracking":
    case "college-tasks":
    case "modules":
    case "assignments":
      redirect("/apprentice/learning");
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
  search?: Record<string, string | string[] | undefined>,
) {
  const ports = getStandalonePorts();
  const session = await ports.auth.getEffectiveSession();
  if (!session) {
    const segment = slug?.join("/") ?? "";
    const path = segment ? `/${workspace}/${segment}` : `/${workspace}`;
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(search ?? {})) {
      if (typeof value === "string") params.set(key, value);
      else if (Array.isArray(value)) {
        for (const item of value) params.append(key, item);
      }
    }
    const query = params.toString();
    redirect(getUnauthenticatedRedirect(query ? `${path}?${query}` : path));
  }

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

  if (
    workspace === "staff" &&
    (segment === "cea-sign-offs" || segment === "cea-sign-offs/review")
  ) {
    redirect("/staff/programme-delivery");
  }

  if (
    workspace === "employer" &&
    (segment === "cea-sign-offs" || segment === "cea-sign-offs/review")
  ) {
    redirect("/employer/dashboard");
  }

  if (workspace === "staff" && segment === "programme-delivery/block1") {
    return <TutorBlock1DeliveryScreen blockNumber={1} />;
  }

  if (workspace === "staff" && segment === "programme-delivery/block2") {
    return <TutorBlock1DeliveryScreen blockNumber={2} />;
  }

  if (workspace === "staff" && segment === "programme-delivery") {
    return <TutorProgrammeDeliveryScreen />;
  }

  const staffTaskMatch =
    workspace === "staff"
      ? /^programme-delivery\/([^/]+)$/.exec(segment)
      : null;
  if (
    staffTaskMatch &&
    staffTaskMatch[1] !== "block1" &&
    staffTaskMatch[1] !== "block2"
  ) {
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

  if (workspace === "administration" || workspace === "management") {
    const learnerGtaId = apprenticeLearnerGtaId(segment);
    if (learnerGtaId) {
      return (
        <ApprenticeLearnerScreen workspace={workspace} gtaId={learnerGtaId} />
      );
    }
  }

  if (workspace === "administration") {
    switch (segment) {
      case "dashboard":
        return <AdministrationDashboardScreen />;
      case "users":
        redirect("/administration/onboarding/directory/apprentices");
      case "enrolments":
        return <AdminEnrolmentsScreen />;
      case "accounts":
        return (
          <AdminUsersScreen scope="apprentice" eyebrow="Administration" />
        );
      case "employers":
        redirect("/administration/onboarding/directory/employers");
      case "programmes":
        return <AdminProgrammesScreen />;
      case "cohorts":
        return <AdminCohortsScreen />;
      case "teaching-groups":
        return <AdminTeachingGroupsScreen />;
      case "intake":
        redirect("/administration/onboarding/directory/apprentices");
      case "marketing":
      case "marketing/employers":
      case "marketing/calendar":
      case "marketing/actions":
      case "marketing/settings":
        return renderMarketing("administration", segment);
      case "onboarding":
      case "onboarding/apprentices":
      case "onboarding/interviews":
      case "onboarding/apprentice":
      case "onboarding/employer":
      case "onboarding/directory":
      case "onboarding/directory/apprentices":
      case "onboarding/directory/employers":
        return renderOnboarding("administration", segment);
      case "reviews/plan":
        return (
          <PlanScreen
            workspace="administration"
            date={searchValue(search?.date)}
            month={searchValue(search?.month)}
          />
        );
      case "reviews/cycle":
        return <CycleScreen workspace="administration" />;
      case "reviews/out":
        return <ReviewStubScreen title="Out" />;
      case "reviews/archive":
        return <ReviewStubScreen title="Archive" />;
      case "reviews/analytics":
        return (
          <AnalyticsScreen
            workspace="administration"
            range={searchValue(search?.range)}
            tutor={searchValue(search?.tutor)}
            programme={searchValue(search?.programme)}
            employer={searchValue(search?.employer)}
            view={searchValue(search?.view)}
          />
        );
      case "reviews/log":
        return (
          <ReviewLogScreen
            workspace="administration"
            q={searchValue(search?.q)}
            learner={searchValue(search?.learner)}
            tutor={searchValue(search?.tutor)}
            event={searchValue(search?.event)}
            range={searchValue(search?.range)}
            page={searchValue(search?.page)}
          />
        );
      case "reviews/tutor-reviews":
        return <TutorReviewsScreen workspace="administration" />;
      case "reviews/settings":
        return <SettingsScreen />;
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
        redirect("/management/onboarding/directory/employers");
      case "programmes-records":
        return <AdminProgrammesScreen />;
      case "programme-builder":
        return <ProgrammeBuilderScreen />;
      case "course-builder":
        return <CourseBuilderScreen />;
      case "cohorts":
        return <AdminCohortsScreen />;
      case "teaching-groups":
        return <AdminTeachingGroupsScreen />;
      case "intake":
        redirect("/management/onboarding/directory/apprentices");
      case "marketing":
      case "marketing/employers":
      case "marketing/calendar":
      case "marketing/actions":
      case "marketing/settings":
        return renderMarketing("management", segment);
      case "onboarding":
      case "onboarding/apprentices":
      case "onboarding/interviews":
      case "onboarding/apprentice":
      case "onboarding/employer":
      case "onboarding/directory":
      case "onboarding/directory/apprentices":
      case "onboarding/directory/employers":
        return renderOnboarding("management", segment);
      case "reviews/plan":
        return (
          <PlanScreen
            workspace="management"
            date={searchValue(search?.date)}
            month={searchValue(search?.month)}
          />
        );
      case "reviews/cycle":
        return <CycleScreen workspace="management" />;
      case "reviews/out":
        return <ReviewStubScreen title="Out" />;
      case "reviews/archive":
        return <ReviewStubScreen title="Archive" />;
      case "reviews/analytics":
        return (
          <AnalyticsScreen
            workspace="management"
            range={searchValue(search?.range)}
            tutor={searchValue(search?.tutor)}
            programme={searchValue(search?.programme)}
            employer={searchValue(search?.employer)}
            view={searchValue(search?.view)}
          />
        );
      case "reviews/log":
        return (
          <ReviewLogScreen
            workspace="management"
            q={searchValue(search?.q)}
            learner={searchValue(search?.learner)}
            tutor={searchValue(search?.tutor)}
            event={searchValue(search?.event)}
            range={searchValue(search?.range)}
            page={searchValue(search?.page)}
          />
        );
      case "reviews/tutor-reviews":
        return <TutorReviewsScreen workspace="management" />;
      case "reviews/settings":
        return <SettingsScreen />;
      case "enrolments":
        return <AdminEnrolmentsScreen />;
      case "apprentice-funding":
      case "ksb-rpl":
        return <ManagementApprenticeRplScreen />;
      case "apprentice-tnp":
      case "tnp1":
        return <ManagementApprenticeTnpScreen />;
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
