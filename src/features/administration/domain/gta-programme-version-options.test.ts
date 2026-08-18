import { describe, expect, it } from "vitest";
import {
  formatGtaProgrammeVersionLabel,
  isGtaVersionCompatibleWithIntake,
  pinCompatibilityError,
  selectableGtaVersionsForIntake,
} from "./gta-programme-version-options";
import type { AdminGtaProgrammeVersionOption } from "./types";

function version(
  partial: Partial<AdminGtaProgrammeVersionOption> &
    Pick<AdminGtaProgrammeVersionOption, "id">,
): AdminGtaProgrammeVersionOption {
  return {
    programmeId: "prog-1",
    programmeTitle: "Autocare Technician Level 2",
    standardCode: "ST0499",
    skillsEnglandVersion: "1.3",
    internalVersion: "2",
    status: "published",
    deliverySpine: "Blocks",
    ...partial,
  };
}

describe("GTA Programme Version compatibility", () => {
  it("matches standard code and Skills England version, ignoring a leading v", () => {
    expect(
      isGtaVersionCompatibleWithIntake(version({ id: "a" }), {
        standardCode: "st0499",
        standardVersion: "v1.3",
      }),
    ).toBe(true);
    expect(
      isGtaVersionCompatibleWithIntake(version({ id: "a" }), {
        standardCode: "ST0499",
        standardVersion: "1.5",
      }),
    ).toBe(false);
  });

  it("offers published compatible versions and does not prefer newest", () => {
    const versions = [
      version({ id: "old", internalVersion: "1", status: "superseded" }),
      version({ id: "mid", internalVersion: "2", status: "published" }),
      version({ id: "new", internalVersion: "3", status: "published" }),
      version({
        id: "other-se",
        internalVersion: "4",
        skillsEnglandVersion: "1.5",
        status: "published",
      }),
    ];
    const selectable = selectableGtaVersionsForIntake({
      versions,
      standardCode: "ST0499",
      skillsEnglandVersion: "1.3",
    });
    expect(selectable.map((row) => row.id)).toEqual(["mid", "new"]);
  });

  it("keeps an already-pinned superseded version visible for that enrolment", () => {
    const selectable = selectableGtaVersionsForIntake({
      versions: [
        version({ id: "old", status: "superseded" }),
        version({ id: "live", internalVersion: "3" }),
      ],
      standardCode: "ST0499",
      skillsEnglandVersion: "1.3",
      includeId: "old",
    });
    expect(selectable.map((row) => row.id)).toEqual(["old", "live"]);
  });

  it("formats enough context for staff to choose a pin", () => {
    expect(formatGtaProgrammeVersionLabel(version({ id: "a" }))).toContain(
      "GTA v2",
    );
    expect(formatGtaProgrammeVersionLabel(version({ id: "a" }))).toContain(
      "SE v1.3",
    );
  });

  it("blocks a cohort change that would mix Skills England versions", () => {
    const error = pinCompatibilityError({
      pinId: "a",
      pin: version({ id: "a" }),
      cohort: {
        name: "Jan 2027 Intake",
        standardCode: "ST0499",
        standardVersion: "1.5",
      },
    });
    expect(error).toMatch(/does not match/i);
    expect(error).not.toMatch(/automatically switch|newest/i);
  });

  it("allows assigning a cohort when the learner is still unpinned", () => {
    expect(
      pinCompatibilityError({
        pinId: null,
        pin: null,
        cohort: {
          name: "Sept 2026 Intake",
          standardCode: "ST0499",
          standardVersion: "1.3",
        },
      }),
    ).toBeNull();
  });
});
