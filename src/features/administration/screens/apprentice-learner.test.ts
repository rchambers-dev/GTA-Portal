import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import type { ApprenticeProgrammePage } from "../domain/apprentice-programme";
import { ApprenticeLearnerView } from "./ApprenticeLearnerView";
import type { ApprenticeLearnerPage } from "../domain/apprentice-tutor-repository";

const nav = vi.hoisted(() => ({ search: "" }));

vi.mock("next/link", () => ({
  default: ({
    href,
    children,
    ...props
  }: {
    href: string;
    children?: import("react").ReactNode;
  }) => createElement("a", { ...props, href }, children),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: () => undefined }),
  usePathname: () => "/administration/onboarding/apprentice/GTA-000002",
  useSearchParams: () => new URLSearchParams(nav.search),
}));

vi.mock("./apprentice-tutor-actions", () => ({
  assignApprenticeTutorAction: vi.fn(),
}));

vi.mock("./apprentice-programme-actions", () => ({
  saveApprenticeCourseDatesAction: vi.fn(),
  requestPlannedDateChangeAction: vi.fn(),
  approvePlannedDateChangeAction: vi.fn(),
  rejectPlannedDateChangeAction: vi.fn(),
  setExtensionPaperworkAction: vi.fn(),
  startBreakInLearningAction: vi.fn(),
  recordReturnCheckResultAction: vi.fn(),
  signOffReturnToLearningAction: vi.fn(),
  returnFromBreakAction: vi.fn(),
}));

const tutorId = "11111111-1111-4111-8111-111111111111";
const adminId = "22222222-2222-4222-8222-222222222222";

function page(overrides: Partial<ApprenticeLearnerPage> = {}): ApprenticeLearnerPage {
  return {
    requestedId: "GTA-000002",
    apprentice: {
      gtaId: "GTA-000002",
      name: "Jack Elliot",
      programmeLabel: "Vehicle Damage Panel L3 (ST0403)",
      programmeName: "Vehicle Damage Panel Level 3",
      standardCode: "ST0403",
      status: "in_learning",
      statusLabel: "In learning",
    },
    currentTutor: {
      id: "open",
      tutorId,
      displayName: "Alex Tutor",
      email: "alex@example.com",
      startDate: "2025-01-27",
      endDate: null,
    },
    tutorHistory: [
      {
        id: "past",
        tutorId: adminId,
        displayName: "Anne Admin",
        email: "anne@example.com",
        startDate: "2024-01-01",
        endDate: "2025-01-26",
      },
    ],
    tutorOptions: [
      { id: tutorId, displayName: "Alex Tutor", email: "alex@example.com" },
      { id: adminId, displayName: "Anne Admin", email: "anne@example.com" },
    ],
    currentEmployment: null,
    loadError: null,
    ...overrides,
  };
}

const reasonId = "44444444-4444-4444-8444-444444444444";
const breakId = "55555555-5555-4555-8555-555555555555";
const changeId = "66666666-6666-4666-8666-666666666666";
const safeguardingId = "77777777-7777-4777-8777-777777777777";

function programmePage(
  overrides: Partial<ApprenticeProgrammePage> = {},
): ApprenticeProgrammePage {
  return {
    today: "2026-11-09",
    dates: {
      courseStart: "2025-09-01",
      plannedCourseEnd: "2026-07-01",
      actualCourseEnd: null,
      plannedGateway1: "2026-03-01",
      actualGateway1: null,
      plannedGateway2: null,
      actualGateway2: null,
      plannedEpa: "2026-06-01",
      actualEpa: "2026-06-02",
    },
    effective: {
      courseEnd: "2027-06-01",
      gateway1: "2026-03-01",
      gateway2: null,
      epa: "2026-06-01",
      originalCourseEnd: "2026-07-01",
      originalGateway1: "2026-03-01",
      originalGateway2: null,
      originalEpa: "2026-06-01",
      courseEndChanged: true,
      gateway1Changed: false,
      gateway2Changed: false,
      epaChanged: false,
    },
    changes: [
      {
        id: changeId,
        dateType: "course_end",
        oldDate: "2026-07-01",
        newDate: "2027-06-01",
        reason: "Learner needs more time to complete the work",
        isSafeguarding: false,
        explanation: "The panel work is still open.",
        extensionPaperwork: false,
        status: "pending",
        requestedByName: "Anne Admin",
        requestedAt: "2026-11-09T14:05:00.000Z",
        signedOffByName: null,
        signedOffAt: null,
      },
      {
        id: safeguardingId,
        dateType: "gateway_1",
        oldDate: "2026-03-01",
        newDate: "2026-05-01",
        reason: "Safeguarding",
        isSafeguarding: true,
        explanation: "The learner is being supported by the safeguarding team.",
        extensionPaperwork: false,
        status: "approved",
        requestedByName: "Anne Admin",
        requestedAt: "2026-10-01T09:00:00.000Z",
        signedOffByName: "Anne Admin",
        signedOffAt: "2026-10-02T09:00:00.000Z",
      },
    ],
    dateChangeReasons: [
      { id: reasonId, label: "Learner needs more time to complete the work", sortOrder: 10, isSafeguarding: false },
    ],
    breaks: {
      open: {
        id: breakId,
        startDate: "2026-11-09",
        plannedReturn: "2027-01-18",
        actualReturn: null,
        reason: "Illness, injury or medical treatment",
        explanation: "Recovering after surgery.",
        startedByName: "Anne Admin",
        signedOff: false,
        signedOffByName: null,
        signedOffAt: null,
        checks: [],
        checksUnavailable: false,
      },
      history: [
        {
          id: "past-break",
          startDate: "2025-01-06",
          plannedReturn: "2025-03-17",
          actualReturn: "2025-02-01",
          reason: "Bereavement",
          explanation: "Family funeral.",
          startedByName: "Anne Admin",
        },
      ],
      reasons: [
        { id: reasonId, label: "Illness, injury or medical treatment", sortOrder: 10, isSafeguarding: false },
      ],
      multipleOpen: false,
    },
    loadError: null,
    ...overrides,
  };
}

function render(
  value: ApprenticeLearnerPage,
  canAssignOrOptions:
    | boolean
    | {
        canAssign?: boolean;
        canManage?: boolean;
        programme?: ApprenticeProgrammePage | null;
      } = true,
) {
  const options = typeof canAssignOrOptions === "boolean" ? { canAssign: canAssignOrOptions } : canAssignOrOptions;
  const canAssign = options.canAssign ?? true;
  const canManage = options.canManage ?? canAssign;
  return renderToStaticMarkup(
    createElement(ApprenticeLearnerView, {
      workspace: "administration",
      canAssign,
      canManageProgramme: canManage,
      page: value,
      programme: options.programme === undefined ? programmePage() : options.programme,
    }),
  );
}

describe("learner page", () => {
  it("shows the apprentice in the header and on the overview tab", () => {
    nav.search = "";
    const html = render(page());
    expect(html).toContain("Jack Elliot");
    expect(html).toContain("GTA-000002");
    expect(html).toContain("Vehicle Damage Panel L3 (ST0403)");
    expect(html).toContain("In learning");
    expect(html).toContain('data-learner-section="overview"');
    expect(html).not.toContain("<dt>Programme</dt>");
    expect(html).not.toContain("data-learner-programme-name");
    expect(html).toContain('href="/administration/onboarding/apprentice/GTA-000002?tab=programme"');
    expect(html).toContain('href="/administration/onboarding/apprentice/GTA-000002?tab=tutor"');
    expect(html).toContain('href="/administration/onboarding/apprentice"');
    expect(html).toContain("No current employer");
    expect(html).not.toContain("data-tutor-assign");
  });

  it("shows the current employer, site, and manager on the overview", () => {
    nav.search = "";
    const html = render(
      page({
        currentEmployment: {
          companyName: "BCA",
          postcode: "DN2 4SF",
          areaName: "Barnby Dun with Kirk Sandall",
          siteName: null,
          managerName: "Jane Ann Smith",
          startDate: "2024-09-02",
        },
      }),
    );
    expect(html).toContain('data-learner-employer="BCA"');
    expect(html).toContain('data-learner-site="DN2 4SF"');
    expect(html).toContain("DN2 4SF · Barnby Dun with Kirk Sandall");
    expect(html).toContain('data-learner-manager="Jane Ann Smith"');
    expect(html).not.toContain("No current employer");
  });

  it("shows the programme, effective dates, and break tools to an administrator", () => {
    nav.search = "tab=programme";
    const html = render(page());
    expect(html).toContain('data-learner-section="programme"');
    expect(html).toContain('data-learner-programme-name="Vehicle Damage Panel Level 3"');
    expect(html).toContain('data-learner-standard-code="ST0403"');
    expect(html).toContain("data-date-changed=\"course_end\"");
    expect(html).toContain("Original: 1 Jul 2026");
    expect(html).toContain("1 Jun 2027");
    expect(html).toContain('data-date-overdue="gateway_1"');
    expect(html).toContain("Passed, no actual date");
    expect(html).not.toContain('data-date-overdue="epa"');
    expect(html).toContain('data-save-course-dates="live"');
    expect(html).toContain('data-date-change-request="live"');
    expect(html).toContain("employer, the learner and the tutor");
    expect(html).toContain("Extension paperwork must be ticked before this course end change can be approved.");
    expect(html).toContain(`data-approve-change="${changeId}"`);
    expect(html).toContain("The learner is being supported by the safeguarding team.");
    expect(html).toContain('data-break-section="live"');
    expect(html).toContain('data-open-break="live"');
    expect(html).toContain('data-checklist-empty="live"');
    expect(html).toContain("No checklist items are set up yet.");
    expect(html).toContain('data-sign-off-return="live"');
    expect(html).toContain('data-return-from-break="live"');
    expect(html).toContain("Recovering after surgery.");
    expect(html).toContain("Family funeral.");
    expect(html).toContain("18 Jan 2027");
  });

  it("offers a start-break form when the learner is not already on a break", () => {
    nav.search = "tab=programme";
    const programme = programmePage();
    programme.breaks!.open = null;
    const html = render(page(), { programme });
    expect(html).toContain("Start break in learning");
    expect(html).toContain("The planned return is 10 weeks after the start date.");
    expect(html).not.toContain('data-open-break="live"');
  });

  it("keeps tutors on a read-only programme view with no breaks", () => {
    nav.search = "tab=programme";
    const tutorProgramme = programmePage({
      dateChangeReasons: [],
      breaks: {
        open: {
          id: breakId,
          startDate: "2026-11-09",
          plannedReturn: "2027-01-18",
          actualReturn: null,
          reason: "Safeguarding",
          explanation: "This must not be shown to a tutor.",
          startedByName: "Anne Admin",
          signedOff: false,
          signedOffByName: null,
          signedOffAt: null,
          checks: [],
          checksUnavailable: false,
        },
        history: [],
        reasons: [],
        multipleOpen: false,
      },
      changes: [
        {
          id: safeguardingId,
          dateType: "gateway_1",
          oldDate: "2026-03-01",
          newDate: "2026-05-01",
          reason: "Safeguarding",
          isSafeguarding: true,
          explanation: null,
          extensionPaperwork: false,
          status: "approved",
          requestedByName: "Anne Admin",
          requestedAt: "2026-10-01T09:00:00.000Z",
          signedOffByName: "Anne Admin",
          signedOffAt: "2026-10-02T09:00:00.000Z",
        },
      ],
    });
    const learner = page({
      apprentice: {
        ...page().apprentice!,
        status: "break_in_learning",
        statusLabel: "Break in learning",
      },
    });
    const html = render(learner, { canAssign: false, canManage: false, programme: tutorProgramme });
    expect(html).toContain("Break in learning");
    expect(html).toContain('data-learner-standard-code="ST0403"');
    expect(html).toContain("Original: 1 Jul 2026");
    expect(html).toContain('data-date-overdue="gateway_1"');
    expect(html).toContain('data-safeguarding-redacted="true"');
    expect(html).toContain("Reason: Safeguarding");
    expect(html).not.toContain("The learner is being supported by the safeguarding team.");
    expect(html).not.toContain("This must not be shown to a tutor.");
    expect(html).not.toContain("Recovering after surgery.");
    expect(html).not.toContain('data-break-section');
    expect(html).not.toContain("Start break in learning");
    expect(html).not.toContain("data-date-change-request");
    expect(html).not.toContain("data-save-course-dates");
    expect(html).not.toContain("data-approve-change");
    expect(html).toContain("You can view these dates.");
    expect(html).toContain('data-date-change-history="live"');
  });

  it("enables return only after sign-off, including when the checklist is empty", () => {
    nav.search = "tab=programme";
    const blocked = render(page());
    expect(blocked).toContain("Sign off the return before the learner can come back.");
    expect(blocked).toMatch(/data-return-from-break="live"[^>]*disabled/);

    const ready = programmePage();
    ready.breaks!.open!.signedOff = true;
    ready.breaks!.open!.signedOffByName = "Anne Admin";
    ready.breaks!.open!.signedOffAt = "2026-11-09T15:00:00.000Z";
    const html = render(page(), { programme: ready });
    expect(html).toContain("data-return-signed-off");
    expect(html).not.toMatch(/data-return-from-break="live"[^>]*disabled/);
    expect(html).toContain("A learner can return at any time.");
  });

  it("shows the current tutor, history, and the people who can be assigned", () => {
    nav.search = "tab=tutor";
    const html = render(page());
    expect(html).toContain('data-learner-section="tutor"');
    expect(html).toContain("Alex Tutor");
    expect(html).toContain("alex@example.com");
    expect(html).toContain("Started 27 Jan 2025");
    expect(html).toContain("Anne Admin");
    expect(html).toContain("Ended 26 Jan 2025");
    expect(html).toContain('data-tutor-assign="live"');
    expect(html).toContain("Change tutor");
  });

  it("keeps the tutor tab read-only and allows an apprentice with no tutor", () => {
    nav.search = "tab=tutor";
    const readOnly = render(page(), false);
    expect(readOnly).toContain("Only Administrator and Management can assign or change one.");
    expect(readOnly).not.toContain("data-tutor-assign");
    expect(readOnly).not.toContain('type="submit"');

    const empty = render(
      page({
        currentTutor: null,
        tutorHistory: [],
      }),
    );
    expect(empty).toContain("No tutor is assigned.");
    expect(empty).toContain("No previous tutors.");
    expect(empty).toContain("Assign tutor");
  });

  it("says when the apprentice cannot be found", () => {
    nav.search = "tab=tutor";
    const html = render(
      page({
        requestedId: "GTA-999999",
        apprentice: null,
        currentTutor: null,
        tutorHistory: [],
        tutorOptions: [],
      }),
    );
    expect(html).toContain("No apprentice has the GTA ID GTA-999999.");
    expect(html).not.toContain("data-learner-tab");
  });
});
