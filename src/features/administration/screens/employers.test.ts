import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { EmployersForm } from "./EmployersForm";
import type { EmployerListItem } from "../domain/employer-record";

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
  usePathname: () => "/administration/onboarding/employer",
}));

vi.mock("./employer-actions", () => ({
  addEmployerAction: vi.fn(),
  renameEmployerAction: vi.fn(),
  addEmployerSiteAction: vi.fn(),
  updateEmployerSiteAction: vi.fn(),
  setEmployerSiteActiveAction: vi.fn(),
  lookupEmployerPostcodeAction: vi.fn(),
  saveEmployerManagerAction: vi.fn(),
  removeEmployerManagerAction: vi.fn(),
}));

const siteId = "80f06b62-c953-4acd-aacf-630db3a861c4";
const leedsId = "90f06b62-c953-4acd-aacf-630db3a861c4";
const inactiveId = "a0f06b62-c953-4acd-aacf-630db3a861c4";
const managerId = "11111111-1111-4111-8111-111111111111";

const example: EmployerListItem = {
  employerId: "GTA-EMP-000011",
  companyName: "BCA",
  createdAt: "2026-11-09T12:00:00.000Z",
  updatedAt: "2026-11-09T12:00:00.000Z",
  sites: [
    {
      id: siteId,
      postcode: "DN2 4SF",
      areaName: "Barnby Dun with Kirk Sandall",
      siteName: null,
      isActive: true,
    },
    {
      id: leedsId,
      postcode: "LS9 0PS",
      areaName: "Leeds",
      siteName: "North yard",
      isActive: true,
    },
    {
      id: inactiveId,
      postcode: "HD6 1XE",
      areaName: "Brighouse",
      siteName: null,
      isActive: false,
    },
  ],
  managers: [
    {
      id: managerId,
      siteId,
      firstName: "Jane",
      middleNames: "Ann",
      lastName: "Smith",
      phone: "01302 000000",
      email: "jane@example.test",
    },
  ],
  placements: [
    {
      gtaId: "GTA-000002",
      name: "Jack Elliot",
      siteId,
      managerId,
      startDate: "2024-09-02",
    },
  ],
};

describe("Employers page", () => {
  it("lists an employer and edits the company, sites, and managers", () => {
    const html = renderToStaticMarkup(
      createElement(EmployersForm, {
        canWrite: true,
        employers: [example],
        loadError: null,
        initialOpenId: example.employerId,
      }),
    );

    expect(html).toContain('data-employers="live"');
    expect(html).toContain('data-entry-field="companyName"');
    expect(html).toContain('data-entry-field="postcode"');
    expect(html).toContain('data-entry-field="middleNames"');
    expect(html).toContain("BCA");
    expect(html).toContain("GTA-EMP-000011");
    expect(html).toContain("DN2 4SF");
    expect(html).toContain("Barnby Dun with Kirk Sandall");
    expect(html).toContain("LS9 0PS");
    expect(html).toContain("North yard");
    expect(html).toContain("HD6 1XE");
    expect(html).toContain("Inactive");
    expect(html).toContain("Jane Ann Smith");
    expect(html).toContain("jane@example.test");
    expect(html).toContain("Jack Elliot");
    expect(html).toContain('href="/administration/onboarding/apprentice/GTA-000002"');
    expect(html).toContain("Started 2 Sep 2024");
    expect(html).toContain("Deactivate");
    expect(html).toContain("Make active");
    expect(html).toContain("Search employers");
    expect(html).toContain(">Add employers<");
    expect(html).toContain(">Add employer<");
    expect(html).toContain("Save name");
    expect(html).toContain("Add site");
    expect(html).toContain("Add manager");
    expect(html).not.toContain("Doncaster, Hull, or Sheffield");
    expect(html).not.toContain("EXAMPLE DATA");
    expect(html).not.toContain("Saving is disabled");
  });

  it("hides writes when the signed-in person cannot change employers", () => {
    const html = renderToStaticMarkup(
      createElement(EmployersForm, {
        canWrite: false,
        employers: [],
        loadError: "Employers could not be loaded. permission denied",
      }),
    );
    expect(html).toContain("Only Administrator and Management can change them.");
    expect(html).toContain("Employers could not be loaded. permission denied");
    expect(html).not.toContain("data-add-panel");
    expect(html).not.toContain('type="submit"');
    expect(html).toContain("No employers yet.");
  });
});
