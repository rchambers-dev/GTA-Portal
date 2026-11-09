import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { AddApprenticeForm } from "./AddApprenticeForm";

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
  usePathname: () => "/administration/onboarding/apprentice",
}));

vi.mock("./add-apprentice-actions", () => ({
  addApprenticeAction: vi.fn(),
}));

const autocare = {
  id: "80f06b62-c953-4acd-aacf-630db3a861c4",
  name: "Autocare Level 2",
  standardCode: "ST0499",
};

describe("Add apprentice page", () => {
  it("asks only for name, programme, and status", () => {
    const html = renderToStaticMarkup(
      createElement(AddApprenticeForm, {
        canAdd: true,
        programmes: [autocare],
        apprentices: [
          {
            gtaId: "GTA-000169",
            firstName: "Alex",
            middleNames: null,
            lastName: "Example",
            programmeId: autocare.id,
            programmeLabel: "Autocare L2 (ST0499)",
            status: "in_learning",
            createdAt: "2026-11-09T12:00:00.000Z",
            updatedAt: "2026-11-09T12:00:00.000Z",
          },
        ],
        loadError: null,
      }),
    );

    expect(html).toContain('data-add-apprentice="live"');
    expect(html).toContain('data-entry-field="firstName"');
    expect(html).toContain('data-entry-field="lastName"');
    expect(html).toContain('data-entry-field="middleNames"');
    expect(html).toContain('data-entry-field="programmeId"');
    expect(html).toContain('data-entry-field="status"');
    expect(html).toContain("In learning");
    expect(html).toContain("No programme");
    expect(html).toContain("GTA-000169");
    expect(html).toContain('href="/administration/onboarding/apprentice/GTA-000169"');
    expect(html).toContain("Autocare L2 (ST0499)");
    expect(html).toContain(">Add apprentice<");
    expect(html).toContain("Search apprentices");
    expect(html).toContain("Search by GTA ID, name, programme, or status");
    expect(html).not.toContain("EXAMPLE DATA");
    expect(html).not.toContain("Saving is disabled");
    expect(html).not.toContain("Future reviews");
    expect(html).not.toContain("reviewer");
    expect(html).not.toContain("Planned review");
    expect(html).not.toContain("Employer");
    expect(html).not.toContain("Start date");
    expect(html).not.toContain("Tutor");
    expect(html).not.toContain("Notes");
  });

  it("hides the form when the signed-in person cannot add", () => {
    const html = renderToStaticMarkup(
      createElement(AddApprenticeForm, {
        canAdd: false,
        programmes: [autocare],
        apprentices: [],
        loadError: "Apprentices could not be loaded. permission denied",
      }),
    );
    expect(html).toContain("Only Administrator and Management can add one.");
    expect(html).toContain("Apprentices could not be loaded. permission denied");
    expect(html).not.toContain("data-add-panel");
    expect(html).not.toContain('type="submit"');
    expect(html).toContain("No apprentices yet.");
  });
});
