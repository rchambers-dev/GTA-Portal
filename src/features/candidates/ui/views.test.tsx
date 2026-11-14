import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { AddCandidate, CandidatesList, DuePage, OverviewPage } from "./views";

const props = {
  base: "/administration/onboarding",
  example: true,
  missing: false,
  error: null,
  query: "",
};

describe("candidates pages", () => {
  it("uses the approved candidate id and keeps the started tab off the active list", () => {
    const html = renderToStaticMarkup(createElement(CandidatesList, props));
    expect(html).toContain("GTA-C-000042");
    expect(html).toContain("Maya Henshaw");
    expect(html).toContain("Started");
    expect(html).toContain("Due for review");
    expect(html).not.toContain("supabase");
  });

  it("asks for email and phone at entry", () => {
    const html = renderToStaticMarkup(createElement(AddCandidate, props));
    expect(html).toContain("Email");
    expect(html).toContain("Phone");
    expect(html).toContain('name="firstContact"');
    expect(html).toContain("GTA-C-000001");
  });

  it("requires the candidate name before a permanent delete", () => {
    const html = renderToStaticMarkup(
      createElement(DuePage, { ...props, confirmName: "Amira Khan" }),
    );
    expect(html).toContain("Type the full name to confirm");
    expect(html).toContain("Nothing is deleted automatically");
    expect(html).toContain('name="confirmedName"');
  });

  it("renders an empty overview without throwing when example data is off", () => {
    const html = renderToStaticMarkup(
      createElement(OverviewPage, { ...props, example: false, missing: true }),
    );
    expect(html).toContain("Candidates overview");
    expect(html).toContain("Tables not applied yet");
    expect(html).toContain(">0<");
  });
});
