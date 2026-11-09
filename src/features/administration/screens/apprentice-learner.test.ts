import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
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

const tutorId = "11111111-1111-4111-8111-111111111111";
const adminId = "22222222-2222-4222-8222-222222222222";

function page(overrides: Partial<ApprenticeLearnerPage> = {}): ApprenticeLearnerPage {
  return {
    requestedId: "GTA-000002",
    apprentice: {
      gtaId: "GTA-000002",
      name: "Jack Elliot",
      programmeLabel: "Vehicle Damage Panel L3 (ST0403)",
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
    loadError: null,
    ...overrides,
  };
}

function render(value: ApprenticeLearnerPage, canAssign = true) {
  return renderToStaticMarkup(
    createElement(ApprenticeLearnerView, {
      workspace: "administration",
      canAssign,
      page: value,
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
    expect(html).toContain('href="/administration/onboarding/apprentice/GTA-000002?tab=tutor"');
    expect(html).toContain('href="/administration/onboarding/apprentice"');
    expect(html).not.toContain("data-tutor-assign");
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
