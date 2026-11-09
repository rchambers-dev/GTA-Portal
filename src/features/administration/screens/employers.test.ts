import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { EmployersForm } from "./EmployersForm";
import type { EmployerListItem } from "../domain/employer-record";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: () => undefined }),
}));

vi.mock("./employer-actions", () => ({
  addEmployerAction: vi.fn(),
  renameEmployerAction: vi.fn(),
  addEmployerSiteAction: vi.fn(),
  removeEmployerSiteAction: vi.fn(),
  saveEmployerManagerAction: vi.fn(),
  removeEmployerManagerAction: vi.fn(),
}));

const siteId = "80f06b62-c953-4acd-aacf-630db3a861c4";

const example: EmployerListItem = {
  employerId: "GTA-EMP-000004",
  companyName: "Example Motors",
  createdAt: "2026-11-09T12:00:00.000Z",
  updatedAt: "2026-11-09T12:00:00.000Z",
  sites: [{ id: siteId, areaName: "Doncaster" }],
  managers: [
    {
      id: "11111111-1111-4111-8111-111111111111",
      siteId,
      firstName: "Jane",
      lastName: "Smith",
      phone: "01302 000000",
      email: "jane@example.test",
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
    expect(html).toContain("Example Motors");
    expect(html).toContain("GTA-EMP-000004");
    expect(html).toContain("Doncaster");
    expect(html).toContain("Jane Smith");
    expect(html).toContain("jane@example.test");
    expect(html).toContain("Hull");
    expect(html).toContain("Sheffield");
    expect(html).toContain("Search employers");
    expect(html).toContain(">Add employer<");
    expect(html).toContain("Save name");
    expect(html).toContain("Add site");
    expect(html).toContain("Add manager");
    expect(html).not.toContain("EXAMPLE DATA");
    expect(html).not.toContain("Saving is disabled");
    expect(html).not.toContain("Postcode");
    expect(html).not.toContain("Sector");
    expect(html).not.toContain("Company size");
    expect(html).not.toContain("Address");
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
